// src/services/SalesService.js
// Service Layer: all business logic for sales analytics and leave management.

const SalesRepository    = require('../repositories/SalesRepository');
const TicketRepository   = require('../repositories/TicketRepository');
const { exec }           = require('child_process');
const path               = require('path');

const DATA_ANALYSIS_PATH = process.env.DATA_ANALYSIS_PATH || 'C:\\ASU\\COMP_Graduation_Project\\Data_Analysis';

// Runs a Python script and resolves/rejects with its parsed JSON output.
function runPythonScript(scriptName, args) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(DATA_ANALYSIS_PATH, scriptName);
        const command    = `python "${scriptPath}" ${args}`;
        exec(command, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
            if (error) return reject(new Error(stderr || error.message));
            try { resolve(JSON.parse(stdout)); }
            catch { reject(new Error('Invalid JSON from analytics script.')); }
        });
    });
}

class SalesService {
    /** Run the full Python analytics script for an employee. */
    async getMyFullStats(empId) {
        return runPythonScript('sales_employee.py', String(empId));
    }

    /** Quick DB-only stats for the current month. */
    async getMyStats(empId) {
        const { monthly, daily } = await SalesRepository.findMonthlyStats(empId);
        const monthlySales = parseFloat(monthly.monthly_sales) || 0;
        return {
            monthly_sales:    monthlySales,
            num_transactions: parseInt(monthly.num_transactions) || 0,
            biggest_sale:     parseFloat(monthly.biggest_sale) || 0,
            avg_sale:         parseFloat(monthly.avg_sale) || 0,
            commission_target: monthlySales * 0.01,
            commission_earned: monthlySales > 0,
            daily_breakdown:  daily,
        };
    }

    /** Get the sales leaderboard for a branch. */
    async getLeaderboard(branch_id, period) {
        if (!branch_id) throw Object.assign(new Error('branch_id is required.'), { status: 400 });
        return SalesRepository.findLeaderboard(branch_id, period);
    }

    /** Get a branch-level sales summary. */
    async getBranchSummary(branch_id, period, role) {
        const isManager = role === 'dep_manager';
        const periodLabels = { year: 'This Year', all: 'All Time', month: 'This Month' };
        const { summary, best_day } = await SalesRepository.findBranchSummary(branch_id, period, isManager);
        return { ...summary, best_day, period_label: periodLabels[period] || 'This Month' };
    }

    /** Get pending leave requests for a sales manager. */
    async getPendingLeaves(managerId) {
        const rows = await TicketRepository.findByEmployeeAndPrefix(
            parseInt(managerId), '[LEAVE_REQUEST]%'
        );
        return rows.map(r => {
            let data = {};
            try { data = JSON.parse(r.description.replace('[LEAVE_REQUEST] ', '')); } catch {}
            return { ticket_id: r.ticket_id, time: r.time, ...data };
        });
    }

    /** Resolve (approve/reject) a leave request in the sales tab. */
    async resolveLeave(ticket_id, action) {
        await TicketRepository.delete(parseInt(ticket_id));
        return { message: `Leave request ${action === 'approve' ? 'approved' : 'rejected'}.` };
    }
}

module.exports = new SalesService();
