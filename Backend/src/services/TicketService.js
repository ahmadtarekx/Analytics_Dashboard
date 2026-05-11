// src/services/TicketService.js
// Service Layer: employee-facing ticket management (view, delete, request deletion).

const EmployeeRepository = require('../repositories/EmployeeRepository');
const TicketRepository   = require('../repositories/TicketRepository');

class TicketService {
    async getMyTickets(empId) {
        const rows = await TicketRepository.findByEmployee(empId);
        return rows.map(row => {
            const priorityMatch = row.description?.match(/\[Priority:\s*(\w+)\]/i);
            const hasAdminReply = !!(row.description?.includes('[Admin Reply') || row.description?.includes('[IT Reply'));
            const cleanDesc     = row.description
                ?.replace(/\[Priority:[^\]]*\]\s*/i, '')
                ?.replace(/\[From:[^\]]*\]\s*/i, '')
                ?.replace(/\n──────────────────────────────[\s\S]*/i, '')
                ?.trim() || '';
            return { ...row, priority: priorityMatch ? priorityMatch[1] : null, cleanDescription: cleanDesc, status: hasAdminReply ? 'Replied' : 'Pending' };
        });
    }

    async deleteMyTicket(ticketId, empId) {
        const deleted = await TicketRepository.deleteOwnedBy(ticketId, empId);
        if (!deleted) throw Object.assign(new Error('Ticket not found or does not belong to you.'), { status: 403 });
        return { message: 'Ticket deleted successfully.' };
    }

    async requestTicketDeletion(ticketId, it_emp_id, reason) {
        const ticket = await TicketRepository.findById(ticketId);
        if (!ticket) throw Object.assign(new Error('Ticket not found.'), { status: 404 });

        const prManagerId = await EmployeeRepository.findManagerIdByDept(4);
        if (!prManagerId) throw Object.assign(new Error('No PR Manager found.'), { status: 400 });

        const payload = JSON.stringify({
            action: 'DELETE_TICKET', ticket_id: ticketId,
            requested_by_it: it_emp_id || null,
            reason: reason?.trim() || 'No reason provided.',
            ticket_summary: `#${ticketId} | ${ticket.type} | ${ticket.employee_name}`,
        });
        await TicketRepository.create(prManagerId, 'Inquiry', `[PENDING_APPROVAL] ${payload}`);
        return { message: 'Deletion request sent to PR Manager for approval.' };
    }

    async submitAdminTicket({ employee_id, emp_id, issue_type, description, emp_name }) {
        const employeeId = employee_id || emp_id;
        let dbType = 'Support';
        const t = (issue_type || '').toLowerCase();
        if (t.includes('hardware') || t.includes('software') || t.includes('network')) dbType = 'Technical';
        else if (t.includes('other')) dbType = 'Inquiry';
        const finalDesc = `[From: ${emp_name || 'Employee'}] ${description}`;
        await TicketRepository.create(parseInt(employeeId), dbType, finalDesc);
        return { message: 'Ticket submitted successfully.' };
    }
}

module.exports = new TicketService();
