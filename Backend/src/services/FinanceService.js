// src/services/FinanceService.js
// Service Layer: business logic for expense reports and their two-level approval workflow.

const EmployeeRepository = require('../repositories/EmployeeRepository');
const TicketRepository   = require('../repositories/TicketRepository');

class FinanceService {
    async submitExpense({ emp_id, emp_name, category, amount, description, receipt_note }) {
        if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)
            throw Object.assign(new Error('Amount must be a positive number.'), { status: 400 });

        const managerId = await EmployeeRepository.findManagerIdByDept(2);
        if (!managerId) throw Object.assign(new Error('No Finance Manager found.'), { status: 400 });

        const submitterIsManager = parseInt(emp_id) === managerId;
        let targetId, stage, stageMsg;

        if (submitterIsManager) {
            const ownerId = await EmployeeRepository.findOwnerId();
            if (!ownerId) throw Object.assign(new Error('No Owner found.'), { status: 400 });
            targetId = ownerId; stage = 'pending_owner'; stageMsg = 'submitted to Owner for approval';
        } else {
            targetId = managerId; stage = 'pending_manager'; stageMsg = 'submitted to Finance Manager for approval';
        }

        const payload = JSON.stringify({
            action: 'EXPENSE_REPORT', stage, emp_id: parseInt(emp_id),
            emp_name: emp_name || 'Unknown', managerId,
            category, amount: parseFloat(amount),
            description: description.trim(),
            receipt_note: receipt_note?.trim() || null,
            submitted_at: new Date().toISOString(),
        });
        await TicketRepository.create(targetId, 'Billing', `[EXPENSE_REPORT] ${payload}`);
        return { message: `Expense report of ${parseFloat(amount).toLocaleString()} EGP ${stageMsg}.` };
    }

    async getMyExpenses(empId) {
        const rows = await TicketRepository.findAllByPrefix('[EXPENSE_REPORT]%');
        return rows
            .map(r => { let d = {}; try { d = JSON.parse(r.description.replace('[EXPENSE_REPORT] ', '')); } catch {} return { ticket_id: r.ticket_id, time: r.time, ...d }; })
            .filter(r => r.emp_id === empId)
            .map(r => {
                let statusLabel;
                if (r.stage === 'approved_by_owner')  statusLabel = 'Approved ✓';
                else if (r.stage === 'pending_owner') statusLabel = 'Awaiting Owner Approval';
                else                                  statusLabel = 'Awaiting Manager Approval';
                return { ...r, status: statusLabel };
            });
    }

    async getPendingExpenses(requesterId) {
        const rows = await TicketRepository.findByEmployeeAndPrefix(requesterId, '[EXPENSE_REPORT]%');
        const result = rows.map(r => { let d = {}; try { d = JSON.parse(r.description.replace('[EXPENSE_REPORT] ', '')); } catch {} return { ticket_id: r.ticket_id, time: r.time, ...d }; });
        const isOwner = requesterId === 91949;
        return result.filter(r => isOwner ? r.stage === 'pending_owner' : r.stage === 'pending_manager' || r.stage === 'approved_by_owner');
    }

    async resolveExpense(ticket_id, action) {
        const ticket = await TicketRepository.findById(ticket_id);
        if (!ticket) throw Object.assign(new Error('Ticket not found.'), { status: 404 });

        let payload = {};
        try { payload = JSON.parse(ticket.description.replace('[EXPENSE_REPORT] ', '')); } catch {}

        if (action === 'reject') {
            await TicketRepository.delete(ticket_id);
            return { message: 'Expense report rejected.' };
        }

        if (payload.stage === 'pending_manager') {
            const ownerId = await EmployeeRepository.findOwnerId();
            if (!ownerId) { await TicketRepository.delete(ticket_id); return { message: 'Expense approved (no owner to escalate to).' }; }
            payload.stage = 'pending_owner';
            payload.manager_approved_at = new Date().toISOString();
            await TicketRepository.reassign(ticket_id, ownerId, `[EXPENSE_REPORT] ${JSON.stringify(payload)}`);
            return { message: 'Expense approved by manager — escalated to owner for final approval.' };
        }

        await TicketRepository.delete(ticket_id);
        const managerId = payload.managerId || await EmployeeRepository.findManagerIdByDept(2);
        if (managerId) {
            const notif = JSON.stringify({ action: 'EXPENSE_REPORT', stage: 'approved_by_owner', emp_id: payload.emp_id, emp_name: payload.emp_name, category: payload.category, amount: payload.amount, description: payload.description, receipt_note: payload.receipt_note || null, submitted_at: payload.submitted_at, approved_at: new Date().toISOString() });
            await TicketRepository.create(managerId, 'Billing', `[EXPENSE_REPORT] ${notif}`);
        }
        return { message: 'Expense report fully approved by owner.' };
    }
}

module.exports = new FinanceService();
