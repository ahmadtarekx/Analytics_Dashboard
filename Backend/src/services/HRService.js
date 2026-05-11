// src/services/HRService.js
// Service Layer: all business logic for HR operations (salary, leave, approvals).

const EmployeeRepository = require('../repositories/EmployeeRepository');
const TicketRepository   = require('../repositories/TicketRepository');

const OWNER_ID = 91949;

// ── Leave type → DB ENUM mapping ──────────────────────────────────────────────
function mapLeaveType(frontendType) {
    const t = frontendType.toLowerCase();
    if (t.includes('sick'))      return 'sick';
    if (t.includes('annual'))    return 'annual';
    if (t.includes('emergency')) return 'excuse';
    if (t.includes('unpaid'))    return 'upl';
    return 'off';
}

// ── Timezone-safe local date parser ──────────────────────────────────────────
function parseLocalDate(s) {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
}

class HRService {
    /** Submit a staged salary adjustment for HR Manager approval. */
    async stageSalaryAdjustment({ target_emp_id, adjustment_type, amount, reason, submitted_by_id, submitted_by_name }) {
        if (!['bonus', 'deduction'].includes(adjustment_type))
            throw Object.assign(new Error('adjustment_type must be "bonus" or "deduction".'), { status: 400 });

        const amt = parseFloat(amount);
        if (isNaN(amt) || amt <= 0)
            throw Object.assign(new Error('amount must be a positive number.'), { status: 400 });

        const managerId = await EmployeeRepository.findManagerIdByDept(3);
        if (!managerId) throw Object.assign(new Error('No HR Manager found.'), { status: 400 });

        const emp = await EmployeeRepository.findSalaryById(target_emp_id);
        if (!emp) throw Object.assign(new Error('Employee not found.'), { status: 404 });

        const currentSalary = parseFloat(emp.salary) || 0;
        const newSalary     = adjustment_type === 'bonus'
            ? currentSalary + amt
            : Math.max(0, currentSalary - amt);

        const payload = JSON.stringify({
            action:       'SALARY_ADJUSTMENT',
            target_emp_id: parseInt(target_emp_id),
            submitted_by: { id: submitted_by_id || null, name: submitted_by_name || 'HR' },
            changes:      { salary: { before: `${currentSalary.toLocaleString()} EGP`, after: `${newSalary.toLocaleString()} EGP` } },
            adjustment:   { type: adjustment_type, amount: amt, reason: reason.trim(), new_salary: newSalary },
            payload:      { target_emp_id: parseInt(target_emp_id), new_salary: newSalary },
        });
        await TicketRepository.create(managerId, 'Inquiry', `[PENDING_APPROVAL] ${payload}`);

        return {
            message: `${adjustment_type === 'bonus' ? 'Bonus' : 'Deduction'} of ${amt.toLocaleString()} EGP submitted for ${emp.full_name}. Awaiting HR Manager approval.`,
        };
    }

    /** Submit a leave request — routing depends on role. */
    async submitLeaveRequest({ emp_id, emp_name, start_date, end_date, reason, leave_type }) {
        // ── Validation per type ───────────────────────────────────────────────
        const today   = new Date(); today.setHours(0, 0, 0, 0);
        const startDt = parseLocalDate(start_date);
        const diffDays = Math.round((startDt - today) / (1000 * 60 * 60 * 24));

        if (['Annual', 'Unpaid'].includes(leave_type) && diffDays < 1)
            throw Object.assign(new Error(`${leave_type} leave requires at least 1 day advance notice.`), { status: 400 });
        if (leave_type === 'Maternity/Paternity' && diffDays < 7)
            throw Object.assign(new Error('Maternity/Paternity leave requires at least 7 days advance notice.'), { status: 400 });
        if (leave_type === 'Sick' && diffDays < 0)
            throw Object.assign(new Error('Sick leave must start from today onwards.'), { status: 400 });
        if (leave_type === 'Emergency' && (diffDays < 0 || diffDays > 1))
            throw Object.assign(new Error('Emergency leave can only start today or tomorrow.'), { status: 400 });

        const empInfo      = await EmployeeRepository.findRoleAndDept(emp_id);
        const employeeName = empInfo?.full_name || emp_name || 'Unknown';
        const empRole      = empInfo?.role || 'emp';
        const empDeptId    = empInfo?.departement_id;
        const isOwner      = parseInt(emp_id) === OWNER_ID;
        const isManager    = empRole === 'dep_manager' || empRole === 'sales_manager';
        const isHRManager  = isManager && empDeptId == 3;

        const payload = JSON.stringify({
            action: 'LEAVE_REQUEST', target_emp_id: parseInt(emp_id),
            emp_name: employeeName, leave_type, start_date, end_date, reason: reason.trim(),
        });

        // Owner → auto-approve
        if (isOwner) {
            const leaveDesc = `[LEAVE_APPROVED] ${JSON.stringify({ leave_type, start_date, end_date, reason: reason.trim(), approved_at: new Date().toISOString(), auto_approved: true })}`;
            await TicketRepository.create(parseInt(emp_id), 'Support', leaveDesc);
            return { message: `${leave_type} leave from ${start_date} to ${end_date} automatically approved (owner).` };
        }
        // HR Manager → goes to PR Manager
        if (isHRManager) {
            const prManagerId = await EmployeeRepository.findManagerIdByDept(4);
            if (!prManagerId) throw Object.assign(new Error('No PR Manager found to approve HR Manager leave.'), { status: 400 });
            await TicketRepository.create(prManagerId, 'Support', `[PENDING_APPROVAL] ${payload}`);
            return { message: `${leave_type} leave from ${start_date} to ${end_date} submitted to PR Manager for approval.` };
        }
        // Other managers → goes to Owner
        if (isManager) {
            await TicketRepository.create(OWNER_ID, 'Support', `[PENDING_APPROVAL] ${payload}`);
            return { message: `${leave_type} leave from ${start_date} to ${end_date} submitted to owner for approval.` };
        }
        // Regular employees → HR Manager
        const hrManagerId = await EmployeeRepository.findManagerIdByDept(3);
        if (!hrManagerId) throw Object.assign(new Error('No HR Manager found.'), { status: 400 });
        await TicketRepository.create(hrManagerId, 'Support', `[PENDING_APPROVAL] ${payload}`);
        return { message: `${leave_type} leave from ${start_date} to ${end_date} submitted to HR Manager for approval.` };
    }

    /** Get pending leave requests for a manager (from ticket table). */
    async getPendingLeaves(managerId) {
        const rows = await TicketRepository.findPendingApprovals(managerId);
        return rows
            .map(r => {
                try {
                    const data = JSON.parse(r.description.replace('[PENDING_APPROVAL] ', ''));
                    if (data.action !== 'LEAVE_REQUEST') return null;
                    return { ticket_id: r.ticket_id, time: r.time, ...data };
                } catch { return null; }
            })
            .filter(Boolean);
    }

    /** Approve or reject a leave request. */
    async resolveLeave(ticketId, action) {
        if (action === 'reject') {
            await TicketRepository.delete(ticketId);
            return { message: 'Leave request rejected.' };
        }

        const ticket = await TicketRepository.findById(ticketId);
        if (!ticket) throw Object.assign(new Error('Request not found.'), { status: 404 });

        const data        = JSON.parse(ticket.description.replace('[PENDING_APPROVAL] ', ''));
        const dbLeaveType = mapLeaveType(data.leave_type);

        await TicketRepository.approveLeave(
            ticketId, data.target_emp_id, data.start_date, data.end_date, dbLeaveType
        );
        return { message: 'Leave request approved and saved to adherence log.' };
    }
}

module.exports = new HRService();
