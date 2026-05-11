// src/repositories/TicketRepository.js
// Repository Pattern: encapsulates every SQL query for the `ticket` table.

const { getConnection } = require('../config/database');

class TicketRepository {
    /**
     * Insert a new ticket.
     * @param {number} employeeId
     * @param {string} type    - DB ENUM value
     * @param {string} description
     */
    async create(employeeId, type, description) {
        const connection = await getConnection();
        const [result] = await connection.execute(
            `INSERT INTO ticket (employee_id, time, type, description)
             VALUES (?, NOW(), ?, ?)`,
            [employeeId, type, description]
        );
        await connection.end();
        return result.insertId;
    }

    /**
     * Find a ticket by ID.
     * @param {number} ticketId
     * @returns {object|null}
     */
    async findById(ticketId) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT t.ticket_id, t.employee_id, t.type, t.description,
                    CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
                    a.mail AS employee_email, e.first_name
             FROM ticket t
             LEFT JOIN employee e ON t.employee_id = e.emp_id
             LEFT JOIN account  a ON e.emp_id = a.employee_id
             WHERE t.ticket_id = ?`,
            [parseInt(ticketId)]
        );
        await connection.end();
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Get all tickets for an employee (filtered — excludes system tickets).
     * @param {number} empId
     * @returns {Array}
     */
    async findByEmployee(empId) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT ticket_id, employee_id, time, type, description
             FROM ticket
             WHERE employee_id = ?
               AND description NOT LIKE '[PENDING_APPROVAL]%'
               AND description NOT LIKE '[Admin Reply%'
               AND description NOT LIKE '[PENDING_DELETE]%'
             ORDER BY time DESC`,
            [empId]
        );
        await connection.end();
        return rows;
    }

    /**
     * Get the IT inbox tickets for a given date period.
     * @param {string} period - 'daily' | 'weekly' | 'monthly' | 'yearly'
     * @returns {Array}
     */
    async findInbox(period) {
        const dateFilters = {
            daily:   `DATE(time) = CURDATE()`,
            weekly:  `time >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
            monthly: `time >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`,
            yearly:  `time >= DATE_SUB(NOW(), INTERVAL 1 YEAR)`,
        };
        const dateFilter = dateFilters[period] || dateFilters.daily;

        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT t.ticket_id, t.employee_id, t.time, t.type, t.description,
                    e.first_name, e.last_name,
                    CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
                    d.name AS department_name,
                    a.mail AS employee_email
             FROM ticket t
             LEFT JOIN employee e    ON t.employee_id = e.emp_id
             LEFT JOIN departement d ON e.departement_id = d.dep_id
             LEFT JOIN account a     ON e.emp_id = a.employee_id
             WHERE t.description NOT LIKE '[PENDING_APPROVAL]%'
               AND t.description NOT LIKE '[CAMPAIGN_REQUEST]%'
               AND t.description NOT LIKE '[PRESS_RELEASE]%'
               AND t.description NOT LIKE '[IT_REPLY%'
               AND t.description NOT LIKE '[PENDING_DELETE]%'
               AND t.type IN ('Technical','Urgent','Inquiry','Billing','Maintenance','Support')
               AND e.departement_id != 6
               AND ${dateFilter}
             ORDER BY t.time DESC`
        );
        await connection.end();
        return rows;
    }

    /**
     * Get pending-approval tickets for a manager.
     * @param {number} managerId
     * @returns {Array}
     */
    async findPendingApprovals(managerId) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT ticket_id, time, description FROM ticket
             WHERE employee_id = ? AND description LIKE '[PENDING_APPROVAL]%'
             ORDER BY time DESC`,
            [managerId]
        );
        await connection.end();
        return rows;
    }

    /**
     * Update ticket description (used for replies and escalations).
     * @param {number} ticketId
     * @param {string} newDescription
     */
    async updateDescription(ticketId, newDescription) {
        const connection = await getConnection();
        await connection.execute(
            `UPDATE ticket SET description = ? WHERE ticket_id = ?`,
            [newDescription, parseInt(ticketId)]
        );
        await connection.end();
    }

    /**
     * Re-assign a ticket to a different employee (owner inbox escalation).
     * @param {number} ticketId
     * @param {number} newEmployeeId
     * @param {string} newDescription
     */
    async reassign(ticketId, newEmployeeId, newDescription) {
        const connection = await getConnection();
        await connection.execute(
            `UPDATE ticket SET employee_id = ?, description = ? WHERE ticket_id = ?`,
            [newEmployeeId, newDescription, parseInt(ticketId)]
        );
        await connection.end();
    }

    /**
     * Hard-delete a ticket.
     * @param {number} ticketId
     */
    async delete(ticketId) {
        const connection = await getConnection();
        await connection.execute(
            `DELETE FROM ticket WHERE ticket_id = ?`,
            [parseInt(ticketId)]
        );
        await connection.end();
    }

    /**
     * Delete a ticket only if it belongs to a specific employee.
     * @param {number} ticketId
     * @param {number} empId
     * @returns {boolean} true if deleted, false if not found/unauthorized
     */
    async deleteOwnedBy(ticketId, empId) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT ticket_id FROM ticket WHERE ticket_id = ? AND employee_id = ?`,
            [ticketId, empId]
        );
        if (rows.length === 0) { await connection.end(); return false; }
        await connection.execute(
            `DELETE FROM ticket WHERE ticket_id = ?`, [ticketId]
        );
        await connection.end();
        return true;
    }

    /**
     * Fetch tickets for a given employee matching a description prefix.
     * @param {number} employeeId
     * @param {string} prefix   e.g. '[EXPENSE_REPORT]%'
     * @returns {Array}
     */
    async findByEmployeeAndPrefix(employeeId, prefix) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT ticket_id, employee_id, time, description
             FROM ticket
             WHERE employee_id = ? AND description LIKE ?
             ORDER BY time DESC`,
            [employeeId, prefix]
        );
        await connection.end();
        return rows;
    }

    /**
     * Fetch all tickets matching a description prefix (used for scanning all records).
     * @param {string} prefix
     * @returns {Array}
     */
    async findAllByPrefix(prefix) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT ticket_id, employee_id, time, description
             FROM ticket WHERE description LIKE ?
             ORDER BY time DESC`,
            [prefix]
        );
        await connection.end();
        return rows;
    }

    /**
     * Log an approved leave to the adherence table and delete the pending ticket.
     * @param {number} ticketId
     * @param {number} empId
     * @param {string} startDate
     * @param {string} endDate
     * @param {string} dbLeaveType
     */
    async approveLeave(ticketId, empId, startDate, endDate, dbLeaveType) {
        const connection = await getConnection();
        await connection.beginTransaction();
        let currentDate = new Date(startDate);
        const end = new Date(endDate);
        while (currentDate <= end) {
            await connection.execute(
                `INSERT INTO adherence_log (emp_id, leave_date, leave_type)
                 VALUES (?, ?, ?)`,
                [empId, currentDate.toISOString().split('T')[0], dbLeaveType]
            );
            currentDate.setDate(currentDate.getDate() + 1);
        }
        await connection.execute(
            `DELETE FROM ticket WHERE ticket_id = ?`, [parseInt(ticketId)]
        );
        await connection.commit();
        await connection.end();
    }
}

module.exports = new TicketRepository();
