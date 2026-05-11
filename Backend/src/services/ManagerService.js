// src/services/ManagerService.js
// Service Layer: business logic for manager-gated employee lookups and analytics.
// A manager must be verified before any employee data or analytics are exposed.
// Delegates analytics execution to the Strategy Pattern (ScriptResolutionStrategy).

const { exec }           = require('child_process');
const path               = require('path');
const EmployeeRepository = require('../repositories/EmployeeRepository');
const { resolveScript }  = require('../strategies/ScriptResolutionStrategy');

const DATA_ANALYSIS_PATH = process.env.DATA_ANALYSIS_PATH || 'C:\\ASU\\COMP_Graduation_Project\\Data_Analysis';

class ManagerService {
    /**
     * Search for a full employee profile.
     * Requires the requester to be a verified dep_manager or sales_manager.
     *
     * @param {number} managerId   - emp_id of the requesting manager.
     * @param {number} empId       - emp_id of the employee to look up.
     * @returns {object}           - Formatted employee payload for the frontend.
     */
    async searchEmployee(managerId, empId) {
        if (!managerId || !empId)
            throw Object.assign(new Error('manager_id and emp_id are required.'), { status: 400 });

        const manager = await EmployeeRepository.findManagerById(managerId);
        if (!manager)
            throw Object.assign(new Error('Requester is not a department manager.'), { status: 403 });

        const e = await EmployeeRepository.findById(empId);
        if (!e)
            throw Object.assign(new Error(`No employee found with ID ${empId}.`), { status: 404 });

        return {
            id:                   e.emp_id,
            first_name:           e.first_name,
            last_name:            e.last_name,
            full_name:            `${e.first_name} ${e.last_name}`,
            email:                e.mail,
            phone:                e.phone,
            address:              e.address,
            gender:               e.gender,
            role:                 e.role,
            salary:               e.salary,
            hired:                e.hired,
            birth:                e.birth,
            department_id:        e.departement_id,
            department_name:      e.department_name,
            branch_id:            e.branch_id,
            primary_branch:       e.primary_branch,
            secondary_branch_id:  e.secondary_branch_id,
            secondary_branch:     e.secondary_branch,
        };
    }

    /**
     * Run the department-appropriate Python analytics script for one employee.
     * Requires the requester to be a verified manager; routes to the correct
     * script via the Strategy Pattern.
     *
     * @param {number} managerId   - emp_id of the requesting manager.
     * @param {number} empId       - emp_id of the employee to analyse.
     * @returns {Promise<object>}  - Parsed JSON payload from the Python script.
     */
    async getEmployeeStats(managerId, empId) {
        if (!managerId || !empId)
            throw Object.assign(new Error('manager_id and emp_id are required.'), { status: 400 });

        const manager = await EmployeeRepository.findManagerById(managerId);
        if (!manager)
            throw Object.assign(new Error('Requester is not a department manager.'), { status: 403 });

        // IT department has no analytics dashboard
        if (manager.departement_id == 6) return {};

        const scriptName = resolveScript(manager.departement_id, 'emp');
        if (!scriptName)
            return { message: 'No analytics script configured for this department.' };

        return new Promise((resolve, reject) => {
            const command = `python "${path.join(DATA_ANALYSIS_PATH, scriptName)}" ${parseInt(empId)} employee`;
            exec(command, { maxBuffer: 1024 * 1024 * 100 }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[ManagerService] Python Error [${scriptName}]:`, stderr || error.message);
                    return reject(Object.assign(
                        new Error('Analytics script failed. Check the Node.js terminal.'),
                        { status: 500 }
                    ));
                }
                try { resolve(JSON.parse(stdout)); }
                catch {
                    reject(Object.assign(
                        new Error('Invalid data returned from analytics script.'),
                        { status: 500 }
                    ));
                }
            });
        });
    }
}

module.exports = new ManagerService();
