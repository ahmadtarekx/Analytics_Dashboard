// src/repositories/EmployeeRepository.js
// Repository Pattern: all SQL queries for the employee and branch tables.

const { getConnection } = require('../config/database');

class EmployeeRepository {
    /**
     * Fetch a full employee profile by ID.
     * @param {number} empId
     * @returns {object|null}
     */
    async findById(empId) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT e.emp_id, e.first_name, e.last_name, e.phone, e.address,
                    e.gender, e.role, e.branch_id, e.secondary_branch_id,
                    e.departement_id, e.salary, e.hired, e.birth,
                    a.mail,
                    d.name  AS department_name,
                    b1.location AS primary_branch,
                    b2.location AS secondary_branch
             FROM employee e
             JOIN account  a  ON e.emp_id = a.employee_id
             LEFT JOIN departement d  ON e.departement_id = d.dep_id
             LEFT JOIN branch b1 ON e.branch_id = b1.b_id
             LEFT JOIN branch b2 ON e.secondary_branch_id = b2.b_id
             WHERE e.emp_id = ?`,
            [empId]
        );
        await connection.end();
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Fetch an employee's basic info + email.
     * @param {number} empId
     * @returns {object|null}
     */
    async findBasicById(empId) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT e.first_name, e.last_name, a.mail
             FROM employee e
             JOIN account a ON e.emp_id = a.employee_id
             WHERE e.emp_id = ?`,
            [empId]
        );
        await connection.end();
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Fetch employee's role, dept, and full name.
     * @param {number} empId
     * @returns {object|null}
     */
    async findRoleAndDept(empId) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT CONCAT(first_name,' ',last_name) AS full_name,
                    role, departement_id
             FROM employee WHERE emp_id = ?`,
            [parseInt(empId)]
        );
        await connection.end();
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Verify a manager's role.
     * @param {number} managerId
     * @returns {object|null}
     */
    async findManagerById(managerId) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT emp_id, departement_id, role
             FROM employee
             WHERE emp_id = ? AND role IN ('dep_manager','sales_manager')`,
            [parseInt(managerId)]
        );
        await connection.end();
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Fetch all employees in a branch.
     * @param {number} branchId
     * @returns {Array}
     */
    async findByBranch(branchId) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT e.emp_id, CONCAT(e.first_name,' ',e.last_name) AS full_name,
                    e.salary, d.name AS department_name
             FROM employee e
             LEFT JOIN departement d ON e.departement_id = d.dep_id
             WHERE e.branch_id = ? OR e.secondary_branch_id = ?
             ORDER BY e.first_name`,
            [parseInt(branchId), parseInt(branchId)]
        );
        await connection.end();
        return rows;
    }

    /**
     * Fetch all branches.
     * @returns {Array}
     */
    async findAllBranches() {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT b_id, location FROM branch ORDER BY b_id`
        );
        await connection.end();
        return rows;
    }

    /**
     * Get branch name by ID.
     * @param {number} branchId
     * @returns {string|null}
     */
    async findBranchNameById(branchId) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT location FROM branch WHERE b_id = ?`,
            [branchId]
        );
        await connection.end();
        return rows.length > 0 ? rows[0].location : null;
    }

    /**
     * Get the dep_manager's emp_id for a given department.
     * @param {number} deptId
     * @returns {number|null}
     */
    async findManagerIdByDept(deptId) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT emp_id FROM employee
             WHERE departement_id = ? AND role = 'dep_manager' LIMIT 1`,
            [deptId]
        );
        await connection.end();
        return rows.length > 0 ? rows[0].emp_id : null;
    }

    /**
     * Find owner/global_manager emp_id (fallback: emp_id 91949).
     * @returns {number|null}
     */
    async findOwnerId() {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT emp_id FROM employee
             WHERE LOWER(TRIM(role)) IN ('owner','global_manager','admin')
                OR emp_id = 91949
             ORDER BY emp_id ASC LIMIT 1`
        );
        if (rows.length > 0) { await connection.end(); return rows[0].emp_id; }
        const [fallback] = await connection.execute(
            `SELECT emp_id FROM employee WHERE emp_id = 91949 LIMIT 1`
        );
        await connection.end();
        return fallback.length > 0 ? fallback[0].emp_id : null;
    }

    /**
     * Update employee basic info fields (first_name, last_name, phone, address).
     * @param {number} empId
     * @param {object} fields - key/value pairs to update
     */
    async updateInfo(empId, fields) {
        const connection = await getConnection();
        const cols   = Object.keys(fields).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(fields), empId];
        await connection.execute(
            `UPDATE employee SET ${cols} WHERE emp_id = ?`, values
        );
        await connection.end();
    }

    /**
     * Update account email.
     * @param {number} empId
     * @param {string} newEmail
     */
    async updateEmail(empId, newEmail) {
        const connection = await getConnection();
        await connection.execute(
            `UPDATE account SET mail = ? WHERE employee_id = ?`,
            [newEmail, empId]
        );
        await connection.end();
    }

    /**
     * Update account password.
     * @param {number} empId
     * @param {string} hashedPassword
     */
    async updatePassword(empId, hashedPassword) {
        const connection = await getConnection();
        await connection.execute(
            `UPDATE account SET pass = ? WHERE employee_id = ?`,
            [hashedPassword, empId]
        );
        await connection.end();
    }

    /**
     * Update branch assignment.
     * @param {number} empId
     * @param {object} branchFields
     */
    async updateBranch(empId, branchFields) {
        const connection = await getConnection();
        const cols   = Object.keys(branchFields).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(branchFields), empId];
        await connection.execute(
            `UPDATE employee SET ${cols} WHERE emp_id = ?`, values
        );
        await connection.end();
    }

    /**
     * Update salary.
     * @param {number} empId
     * @param {number} newSalary
     */
    async updateSalary(empId, newSalary) {
        const connection = await getConnection();
        await connection.execute(
            `UPDATE employee SET salary = ? WHERE emp_id = ?`,
            [parseFloat(newSalary), empId]
        );
        await connection.end();
    }

    /**
     * Get current salary for an employee.
     * @param {number} empId
     * @returns {object|null}
     */
    async findSalaryById(empId) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT CONCAT(first_name,' ',last_name) AS full_name, salary
             FROM employee WHERE emp_id = ?`,
            [parseInt(empId)]
        );
        await connection.end();
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Get current email address for an employee.
     * @param {number} empId
     * @returns {string|null}
     */
    async findEmailById(empId) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT mail FROM account WHERE employee_id = ?`, [empId]
        );
        await connection.end();
        return rows.length > 0 ? rows[0].mail : null;
    }

    /**
     * Get current branch assignment for an employee.
     * @param {number} empId
     * @returns {object|null}
     */
    async findBranchAssignmentById(empId) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT e.branch_id, b1.location AS branch_name,
                    e.secondary_branch_id, b2.location AS sec_branch_name
             FROM employee e
             LEFT JOIN branch b1 ON e.branch_id = b1.b_id
             LEFT JOIN branch b2 ON e.secondary_branch_id = b2.b_id
             WHERE e.emp_id = ?`,
            [empId]
        );
        await connection.end();
        return rows.length > 0 ? rows[0] : null;
    }
}

module.exports = new EmployeeRepository();
