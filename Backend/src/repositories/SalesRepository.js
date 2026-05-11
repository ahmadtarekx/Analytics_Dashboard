// src/repositories/SalesRepository.js
// Repository Pattern: encapsulates all SQL for sales analytics.

const { getConnection } = require('../config/database');

class SalesRepository {
    /**
     * Monthly totals for an employee in the current month.
     * @param {number} empId
     * @returns {object}
     */
    async findMonthlyStats(empId) {
        const connection = await getConnection();
        const [salesRows] = await connection.execute(
            `SELECT COALESCE(SUM(price),0)   AS monthly_sales,
                    COUNT(*)                  AS num_transactions,
                    COALESCE(MAX(price),0)    AS biggest_sale,
                    COALESCE(AVG(price),0)    AS avg_sale
             FROM employee_sales_log
             WHERE employee_id = ?
               AND YEAR(transaction_date)  = YEAR(CURDATE())
               AND MONTH(transaction_date) = MONTH(CURDATE())`,
            [empId]
        );
        const [dailyRows] = await connection.execute(
            `SELECT DATE_FORMAT(transaction_date,'%Y-%m-%d') AS date,
                    SUM(price)  AS daily_total,
                    COUNT(*)    AS transactions
             FROM employee_sales_log
             WHERE employee_id = ?
               AND YEAR(transaction_date)  = YEAR(CURDATE())
               AND MONTH(transaction_date) = MONTH(CURDATE())
             GROUP BY DATE_FORMAT(transaction_date,'%Y-%m-%d')
             ORDER BY date ASC`,
            [empId]
        );
        await connection.end();
        return { monthly: salesRows[0], daily: dailyRows };
    }

    /**
     * Leaderboard for a branch (optionally filtered by period).
     * @param {number} branchId
     * @param {string} period  'month' | 'year' | ''
     * @returns {Array}
     */
    async findLeaderboard(branchId, period) {
        const dateFilters = {
            month: `AND YEAR(sl.transaction_date)  = YEAR(CURDATE())
                    AND MONTH(sl.transaction_date) = MONTH(CURDATE())`,
            year:  `AND YEAR(sl.transaction_date)  = YEAR(CURDATE())`,
        };
        const dateFilter = dateFilters[period] || '';
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT e.emp_id,
                    CONCAT(e.first_name,' ',e.last_name) AS full_name,
                    COALESCE(SUM(sl.price),0)            AS monthly_sales,
                    COUNT(sl.record_id)                  AS num_transactions,
                    e.salary
             FROM employee e
             LEFT JOIN employee_sales_log sl
                    ON e.emp_id = sl.employee_id ${dateFilter}
             WHERE (e.branch_id = ? OR e.secondary_branch_id = ?)
               AND e.departement_id = 1
               AND e.role != 'dep_manager'
             GROUP BY e.emp_id
             ORDER BY monthly_sales DESC`,
            [parseInt(branchId), parseInt(branchId)]
        );
        await connection.end();
        return rows;
    }

    /**
     * Branch-level sales summary.
     * @param {number|null} branchId
     * @param {string} period
     * @param {boolean} isManager
     * @returns {object}
     */
    async findBranchSummary(branchId, period, isManager) {
        const dateFilters = {
            year:  `AND YEAR(sl.transaction_date)  = YEAR(CURDATE())`,
            all:   ``,
            month: `AND YEAR(sl.transaction_date)  = YEAR(CURDATE())
                    AND MONTH(sl.transaction_date) = MONTH(CURDATE())`,
        };
        const dateFilter   = dateFilters[period] ?? dateFilters.month;
        const branchFilter = (!isManager && branchId)
            ? `AND (e.branch_id = ${parseInt(branchId)} OR e.secondary_branch_id = ${parseInt(branchId)})`
            : '';

        const connection = await getConnection();
        const [summary] = await connection.execute(
            `SELECT COALESCE(SUM(sl.price),0)              AS total_sales,
                    COUNT(DISTINCT sl.employee_id)          AS active_sellers,
                    COUNT(sl.record_id)                     AS total_transactions,
                    COALESCE(AVG(sl.price),0)               AS avg_transaction
             FROM employee_sales_log sl
             JOIN employee e ON sl.employee_id = e.emp_id
             WHERE 1=1 ${branchFilter} ${dateFilter}`
        );
        const [topDay] = await connection.execute(
            `SELECT DATE_FORMAT(sl.transaction_date,'%Y-%m-%d') AS date,
                    SUM(sl.price)                               AS daily_total
             FROM employee_sales_log sl
             JOIN employee e ON sl.employee_id = e.emp_id
             WHERE 1=1 ${branchFilter} ${dateFilter}
             GROUP BY DATE_FORMAT(sl.transaction_date,'%Y-%m-%d')
             ORDER BY daily_total DESC LIMIT 1`
        );
        await connection.end();
        return { summary: summary[0], best_day: topDay[0] || null };
    }
}

module.exports = new SalesRepository();
