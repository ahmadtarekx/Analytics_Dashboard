// src/repositories/AuthRepository.js
// Repository Pattern: encapsulates every SQL query related to authentication.
// Controllers and Services NEVER import `getConnection` directly — they use this.

const { getConnection } = require('../config/database');

class AuthRepository {
    /**
     * Find a user account + employee profile by email address.
     * @param {string} email
     * @returns {object|null} Full user row or null if not found.
     */
    async findUserByEmail(email) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT a.pass, e.*,
                    e.first_name AS fname,
                    e.last_name  AS lname,
                    d.name       AS department_name,
                    b1.location  AS primary_branch_location,
                    b2.location  AS secondary_branch_location
             FROM account a
             JOIN employee e   ON a.employee_id = e.emp_id
             LEFT JOIN departement d  ON e.departement_id = d.dep_id
             LEFT JOIN branch b1 ON e.branch_id = b1.b_id
             LEFT JOIN branch b2 ON e.secondary_branch_id = b2.b_id
             WHERE a.mail = ?`,
            [email]
        );
        await connection.end();
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Find a minimal user record by email (for forgot-password flow).
     * @param {string} email
     * @returns {object|null}
     */
    async findAccountByEmail(email) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT e.emp_id, e.first_name, e.last_name, a.mail
             FROM account a
             JOIN employee e ON a.employee_id = e.emp_id
             WHERE a.mail = ?`,
            [email.trim()]
        );
        await connection.end();
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Update an account's hashed password and insert a reset ticket.
     * @param {string} email
     * @param {string} hashedPassword
     * @param {number} empId
     */
    async resetPasswordAndLogTicket(email, hashedPassword, empId) {
        const connection = await getConnection();
        await connection.execute(
            `UPDATE account SET pass = ? WHERE mail = ?`,
            [hashedPassword, email.trim()]
        );
        await connection.execute(
            `INSERT INTO ticket (employee_id, time, type, description)
             VALUES (?, NOW(), 'Urgent', ?)`,
            [empId, '[Priority: Critical]\nAutomated password reset triggered via Login page.']
        );
        await connection.end();
    }
}

module.exports = new AuthRepository();
