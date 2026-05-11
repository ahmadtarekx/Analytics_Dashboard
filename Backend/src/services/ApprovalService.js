// src/services/ApprovalService.js
// Service Layer: the approval resolution workflow (the most complex service).
// Uses a transaction to execute the correct DB mutation based on action type,
// then deletes the pending ticket — applying the Command Pattern internally.

const { getConnection }  = require('../config/database');
const EmployeeRepository = require('../repositories/EmployeeRepository');
const TicketRepository   = require('../repositories/TicketRepository');
const ProductRepository  = require('../repositories/ProductRepository');

class ApprovalService {
    async getApprovals(requesterId) {
        return TicketRepository.findPendingApprovals(requesterId);
    }

    async resolveApproval(ticket_id, status) {
        const tickets = await TicketRepository.findPendingApprovals(null); // need raw find
        // Re-fetch via direct connection for transaction use
        const connection = await getConnection();
        try {
            const [ticketRows] = await connection.execute(
                `SELECT ticket_id, description FROM ticket WHERE ticket_id = ?`,
                [parseInt(ticket_id)]
            );
            if (!ticketRows.length) {
                await connection.end();
                throw Object.assign(new Error(`Ticket #${ticket_id} not found.`), { status: 404 });
            }

            let data = {};
            try { data = JSON.parse(ticketRows[0].description.replace('[PENDING_APPROVAL] ', '')); }
            catch { await connection.end(); throw Object.assign(new Error('Could not parse ticket payload.'), { status: 400 }); }

            await connection.beginTransaction();

            if (status === 'approve') {
                await this._executeApproval(connection, data);
            }

            // Always delete the pending ticket after resolve (approve or reject)
            await connection.execute(`DELETE FROM ticket WHERE ticket_id = ?`, [parseInt(ticket_id)]);
            await connection.commit();
            await connection.end();

            return {
                message: status === 'approve'
                    ? 'Request approved and saved to database successfully.'
                    : 'Request rejected and discarded.',
                action: data.action || null,
            };
        } catch (err) {
            try { await connection.rollback(); } catch {}
            try { await connection.end(); } catch {}
            throw err;
        }
    }

    /** Dispatch the correct DB mutation based on data.action. */
    async _executeApproval(connection, data) {
        switch (data.action) {
            case 'UPDATE_INFO': {
                const { first_name, last_name, phone, address } = data.payload;
                const fields = []; const values = [];
                if (first_name) { fields.push('first_name = ?'); values.push(first_name); }
                if (last_name)  { fields.push('last_name = ?');  values.push(last_name); }
                if (phone   !== undefined) { fields.push('phone = ?');   values.push(phone || null); }
                if (address !== undefined) { fields.push('address = ?'); values.push(address || null); }
                if (fields.length > 0) {
                    values.push(data.target_emp_id);
                    await connection.execute(`UPDATE employee SET ${fields.join(', ')} WHERE emp_id = ?`, values);
                }
                break;
            }
            case 'UPDATE_EMAIL':
                await connection.execute(
                    `UPDATE account SET mail = ? WHERE employee_id = ?`,
                    [data.payload.new_email, data.target_emp_id]
                );
                break;
            case 'UPDATE_BRANCH': {
                const bf = []; const bv = [];
                if (data.payload.branch_id !== undefined)           { bf.push('branch_id = ?');           bv.push(data.payload.branch_id || null); }
                if (data.payload.secondary_branch_id !== undefined) { bf.push('secondary_branch_id = ?'); bv.push(data.payload.secondary_branch_id || null); }
                if (bf.length > 0) { bv.push(data.target_emp_id); await connection.execute(`UPDATE employee SET ${bf.join(', ')} WHERE emp_id = ?`, bv); }
                break;
            }
            case 'ADD_PRODUCT': {
                const p = data.payload;
                await connection.execute(
                    `INSERT INTO product (product_id, name, type, model, price_before_profit, price_after_profit, amount_avail, image) VALUES (?,?,?,?,?,?,?,?)`,
                    [p.product_id, p.name, p.type||null, p.model||null, parseFloat(p.price_before_profit)||0, parseFloat(p.price_after_profit)||0, parseInt(p.amount_avail)||0, p.image||null]
                );
                break;
            }
            case 'DELETE_PRODUCT':
                await connection.execute(`DELETE FROM product WHERE product_id = ?`, [data.payload.product_id]);
                break;
            case 'DELETE_TICKET':
                await connection.execute(`DELETE FROM ticket WHERE ticket_id = ?`, [data.ticket_id]);
                break;
            case 'SALARY_ADJUSTMENT':
                await connection.execute(
                    `UPDATE employee SET salary = ? WHERE emp_id = ?`,
                    [parseFloat(data.adjustment.new_salary), parseInt(data.target_emp_id)]
                );
                break;
            case 'LEAVE_REQUEST': {
                const leavePayload = { leave_type: data.leave_type, start_date: data.start_date, end_date: data.end_date, reason: data.reason, emp_name: data.emp_name || null, approved_at: new Date().toISOString() };
                console.log(`[LEAVE_APPROVE] Saving for emp_id=${data.target_emp_id} | ${data.leave_type} | ${data.start_date} → ${data.end_date}`);
                await connection.execute(
                    `INSERT INTO ticket (employee_id, time, type, description) VALUES (?, NOW(), 'Support', ?)`,
                    [parseInt(data.target_emp_id), `[LEAVE_APPROVED] ${JSON.stringify(leavePayload)}`]
                );
                console.log(`[LEAVE_APPROVE] ✓ Saved for emp_id=${data.target_emp_id}`);
                break;
            }
            default:
                console.warn(`[ApprovalService] Unknown action: ${data.action}`);
        }
    }
}

module.exports = new ApprovalService();
