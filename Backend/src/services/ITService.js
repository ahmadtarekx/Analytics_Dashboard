// src/services/ITService.js
// Service Layer: all business logic for IT department operations.
// Orchestrates EmployeeRepository, TicketRepository, EmailBodyFactory, and mailer.

const bcrypt             = require('bcrypt');
const EmployeeRepository = require('../repositories/EmployeeRepository');
const TicketRepository   = require('../repositories/TicketRepository');
const EmailBodyFactory   = require('../factories/EmailBodyFactory');
const { transporter, IT_EMAIL } = require('../config/mailer');

const ALLOWED_TICKET_TYPES = [
    'Password Reset', 'Hardware Issue', 'Software Issue',
    'Network Access', 'Account Setup', 'Other',
];
const TYPE_MAP = {
    'Password Reset': 'Urgent',
    'Hardware Issue': 'Technical',
    'Software Issue': 'Technical',
    'Network Access': 'Technical',
    'Account Setup':  'Support',
    'Other':          'Inquiry',
};

class ITService {
    /** Validate and submit an IT ticket (admin or employee submitted). */
    async sendTicket({ target_emp_id, ticket_type, description, test_mode }) {
        const isTestMode = test_mode === true;
        const empId      = parseInt(target_emp_id);

        if (!empId || isNaN(empId) || empId <= 0)
            throw Object.assign(new Error('Invalid employee ID.'), { status: 400 });
        if (!ALLOWED_TICKET_TYPES.includes(ticket_type))
            throw Object.assign(new Error(`Invalid ticket type. Allowed: ${ALLOWED_TICKET_TYPES.join(', ')}`), { status: 400 });
        if (!description?.trim())
            throw Object.assign(new Error('Description is required.'), { status: 400 });

        const emp = await EmployeeRepository.findBasicById(empId);
        if (!emp) throw Object.assign(new Error(`No employee found with ID ${empId}.`), { status: 404 });

        const { first_name, last_name, mail: targetEmail } = emp;
        const targetName   = `${first_name} ${last_name}`;
        const tempPassword = Math.random().toString(36).slice(-8);
        const dbType       = TYPE_MAP[ticket_type] || 'Inquiry';

        const { emailBody, priority, cleanDesc } = EmailBodyFactory.build({
            isTestMode, ticket_type, targetName, description, tempPassword,
        });

        // DB write is always first — email is best-effort
        if (!isTestMode) {
            const fullDesc = ticket_type === 'Password Reset'
                ? `[Priority: ${priority}]\nPassword Reset requested by Admin. ${cleanDesc}`
                : `[Priority: ${priority}]\n${cleanDesc}`;
            const type = ticket_type === 'Password Reset' ? 'Urgent' : dbType;
            await TicketRepository.create(empId, type, fullDesc);
        } else {
            const fromInfo = description.match(/\[From:\s*([^\]]+)\]/i)?.[1] || targetName;
            await TicketRepository.create(empId, dbType, `[From: ${fromInfo}]\n${cleanDesc}`);
        }

        let emailError = null;
        try {
            await transporter.sendMail({
                from:    IT_EMAIL,
                to:      isTestMode ? IT_EMAIL : targetEmail,
                subject: isTestMode
                    ? `[Admin Support Request] ${ticket_type} — from ${targetName}`
                    : `Admin Support Ticket: ${ticket_type}`,
                text: emailBody,
            });
        } catch (e) {
            emailError = e;
            console.error('Email failed (ticket already saved):', e.message);
        }

        return {
            message: emailError
                ? (isTestMode
                    ? 'Your request was saved. Email notification to Admin could not be sent, but the ticket is recorded.'
                    : 'Ticket saved to database. Email notification failed but the record is preserved.')
                : (isTestMode
                    ? 'Support request sent to Admin team successfully!'
                    : 'Ticket logged and email sent successfully!'),
        };
    }

    /** Fetch a full employee profile by ID. */
    async getEmployee(id) {
        const empId = parseInt(id);
        if (isNaN(empId) || empId <= 0)
            throw Object.assign(new Error('Invalid employee ID.'), { status: 400 });
        const e = await EmployeeRepository.findById(empId);
        if (!e) throw Object.assign(new Error(`No employee found with ID ${empId}.`), { status: 404 });
        return {
            id: e.emp_id, first_name: e.first_name, last_name: e.last_name,
            full_name: `${e.first_name} ${e.last_name}`, email: e.mail,
            phone: e.phone, address: e.address, gender: e.gender, role: e.role,
            department_id: e.departement_id, department_name: e.department_name,
            branch_id: e.branch_id, primary_branch: e.primary_branch,
            secondary_branch_id: e.secondary_branch_id, secondary_branch: e.secondary_branch,
        };
    }

    /** Stage an info update for HR Manager approval. */
    async stageInfoUpdate({ empId, submitterId, submitterName, first_name, last_name, phone, address }) {
        const managerId = await EmployeeRepository.findManagerIdByDept(3);
        if (!managerId) throw Object.assign(new Error('No HR Manager found.'), { status: 400 });

        const current = await EmployeeRepository.findById(empId);
        if (!current) throw Object.assign(new Error('Employee not found.'), { status: 404 });

        const changes = {};
        if (first_name && first_name !== current.first_name) changes.first_name = { before: current.first_name, after: first_name };
        if (last_name  && last_name  !== current.last_name)  changes.last_name  = { before: current.last_name,  after: last_name  };
        if (phone !== undefined && phone !== (current.phone || ''))     changes.phone   = { before: current.phone   || '—', after: phone   || '—' };
        if (address !== undefined && address !== (current.address || '')) changes.address = { before: current.address || '—', after: address || '—' };

        const payload = JSON.stringify({
            action: 'UPDATE_INFO', target_emp_id: empId,
            submitted_by: { id: submitterId, name: submitterName },
            changes, payload: { first_name, last_name, phone, address },
        });
        await TicketRepository.create(managerId, 'Inquiry', `[PENDING_APPROVAL] ${payload}`);
        return { message: 'Info change requested. Sent to HR Manager for approval.' };
    }

    /** Stage an email update for HR Manager approval. */
    async stageEmailUpdate({ empId, submitterId, submitterName, new_email }) {
        const managerId = await EmployeeRepository.findManagerIdByDept(3);
        if (!managerId) throw Object.assign(new Error('No HR Manager found.'), { status: 400 });

        const oldEmail = await EmployeeRepository.findEmailById(empId) || '—';
        const payload  = JSON.stringify({
            action: 'UPDATE_EMAIL', target_emp_id: empId,
            submitted_by: { id: submitterId, name: submitterName },
            changes: { email: { before: oldEmail, after: new_email } },
            payload: { new_email },
        });
        await TicketRepository.create(managerId, 'Inquiry', `[PENDING_APPROVAL] ${payload}`);
        return { message: 'Email change requested. Sent to HR Manager for approval.' };
    }

    /** Immediately reset an employee's password and email them the temp one. */
    async resetPassword(empId) {
        const emp = await EmployeeRepository.findBasicById(empId);
        if (!emp) throw Object.assign(new Error(`No employee found with ID ${empId}.`), { status: 404 });

        const temp   = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
        const hashed = await bcrypt.hash(temp, 10);
        await EmployeeRepository.updatePassword(empId, hashed);

        await transporter.sendMail({
            from:    IT_EMAIL,
            to:      emp.mail,
            subject: 'Your Password Has Been Reset',
            text:    `Hello ${emp.first_name},\n\nYour account password has been reset by Admin.\n\nTemporary Password: ${temp}\n\nPlease log in immediately and change this password.\n\nAdmin Support Team`,
        });
        return {
            message: `Password reset for ${emp.first_name} ${emp.last_name}. Email sent to ${emp.mail}.`,
            temp_password: temp,
        };
    }

    /** Stage a branch assignment change for HR Manager approval. */
    async stageBranchUpdate({ empId, submitterId, submitterName, branch_id, secondary_branch_id }) {
        const managerId = await EmployeeRepository.findManagerIdByDept(3);
        if (!managerId) throw Object.assign(new Error('No HR Manager found.'), { status: 400 });

        const cur = await EmployeeRepository.findBranchAssignmentById(empId) || {};
        const newBranchId = branch_id !== undefined ? branch_id : cur.branch_id;
        const newSecId    = secondary_branch_id !== undefined ? secondary_branch_id : cur.secondary_branch_id;

        const newBranchName = newBranchId ? await EmployeeRepository.findBranchNameById(newBranchId) : null;
        const newSecName    = newSecId    ? await EmployeeRepository.findBranchNameById(newSecId)    : null;

        const changes = {};
        if (branch_id !== undefined)
            changes.primary_branch   = { before: cur.branch_name || `#${cur.branch_id}` || '—', after: newBranchName || (newBranchId ? `#${newBranchId}` : '—') };
        if (secondary_branch_id !== undefined)
            changes.secondary_branch = { before: cur.sec_branch_name || (cur.secondary_branch_id ? `#${cur.secondary_branch_id}` : '—'), after: newSecName || (newSecId ? `#${newSecId}` : 'None') };

        const payload = JSON.stringify({
            action: 'UPDATE_BRANCH', target_emp_id: empId,
            submitted_by: { id: submitterId, name: submitterName },
            changes, payload: { branch_id, secondary_branch_id },
        });
        await TicketRepository.create(managerId, 'Inquiry', `[PENDING_APPROVAL] ${payload}`);
        return { message: 'Branch reassignment requested. Sent to HR Manager for approval.' };
    }

    /** Get all IT inbox tickets for a given period. */
    async getTicketsInbox(period) {
        const rows = await TicketRepository.findInbox(period);
        const tickets = rows.map(row => {
            const priorityMatch = row.description?.match(/\[Priority:\s*(\w+)\]/i);
            const cleanDesc     = row.description
                ?.replace(/\[Priority:[^\]]*\]\s*/i, '')
                ?.replace(/\[From:[^\]]*\]\s*/i, '')
                ?.trim() || '';
            return { ...row, priority: priorityMatch ? priorityMatch[1] : null, cleanDescription: cleanDesc };
        });
        return { tickets, count: tickets.length, period };
    }

    /** Append an admin reply to a ticket and email the employee. */
    async replyTicket({ ticket_id, reply_message }) {
        const ticket = await TicketRepository.findById(ticket_id);
        if (!ticket) throw Object.assign(new Error('Ticket not found.'), { status: 404 });
        if (!ticket.employee_email) throw Object.assign(new Error('No email address for this employee.'), { status: 400 });

        const ts          = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const updatedDesc = (ticket.description || '').trimEnd() +
            `\n\n──────────────────────────────\n[Admin Reply — ${ts}]\n${reply_message.trim()}`;

        await TicketRepository.updateDescription(ticket_id, updatedDesc);

        await transporter.sendMail({
            from:    IT_EMAIL,
            to:      ticket.employee_email,
            subject: `Re: Admin Support Ticket #${ticket_id} — ${ticket.type}`,
            text:    `Hello ${ticket.first_name},\n\nThe Admin team has responded to your support ticket.\n\n──────────────────────────────\nTicket #${ticket_id} (${ticket.type})\n──────────────────────────────\n\nAdmin Response:\n${reply_message.trim()}\n\n──────────────────────────────\n\nBest regards,\nAdmin Support Team`,
        });
        return { message: `Reply sent to ${ticket.employee_email} and logged.` };
    }
}

module.exports = new ITService();
