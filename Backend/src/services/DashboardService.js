// src/services/DashboardService.js
// Service Layer: orchestrates Python script execution for analytics dashboards.
// Uses the ScriptResolutionStrategy to select the correct script.

const { exec } = require('child_process');
const path     = require('path');
const fs       = require('fs');
const { resolveScript, resolveOutputFile } = require('../strategies/ScriptResolutionStrategy');

const DATA_ANALYSIS_PATH = process.env.DATA_ANALYSIS_PATH || 'C:\\ASU\\COMP_Graduation_Project\\Data_Analysis';

/**
 * Builds the extra CLI arguments string from filter query params.
 * @param {object} query - Express req.query
 * @returns {string}
 */
function buildExtraArgs(query) {
    const keys = [
        'monthly_revenue_year', 'monthly_revenue_month',
        'branch_perf_year', 'branch_perf_month',
        'inv_flow_year', 'inv_flow_month',
        'restock_year', 'restock_month',
        'inv_flow_fm_year', 'inv_flow_fm_month',
        'lateness_year', 'lateness_month',
        'restock_storage_year', 'restock_storage_month',
    ];
    return keys
        .filter(k => query[k])
        .map(k => `${k}=${query[k]}`)
        .join(' ');
}

class DashboardService {
    /**
     * Resolve which script to run and execute it, returning parsed JSON.
     * @param {object} params
     * @param {string} params.userId
     * @param {string} params.role
     * @param {string} params.departmentId
     * @param {object} params.filters  — extra query params for month/year pickers
     * @returns {Promise<object>}
     */
    async getData({ userId, role, departmentId, filters }) {
        // Access control: IT sales employees are blocked
        if (role === 'emp' && departmentId == 1)
            throw Object.assign(new Error('غير مصرح لك بمشاهدة لوحة التحكم.'), { status: 403 });

        // IT dept has no dashboard
        if (departmentId == 6) return {};

        const scriptName = resolveScript(departmentId, role);
        if (!scriptName)
            return { message: 'جاري برمجة ملفات البايثون الخاصة بقسمك...' };

        const execType  = (role === 'dep_manager' || role === 'sales_manager') ? 'manager' : 'branch';
        const extraArgs = buildExtraArgs(filters);
        const command   = `python "${path.join(DATA_ANALYSIS_PATH, scriptName)}" ${userId} ${execType}${extraArgs ? ' ' + extraArgs : ''}`;

        return new Promise((resolve, reject) => {
            exec(command, { maxBuffer: 1024 * 1024 * 500 }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Python Error [${scriptName}]:`, stderr || error.message);
                    return reject(Object.assign(new Error('البايثون ضرب إيرور! بص على تيرمنال النود جي إس.'), { status: 500 }));
                }

                // Primary: read from output file (bypasses stdout pipe limits)
                const outputFile = resolveOutputFile(scriptName);
                if (outputFile) {
                    try {
                        const raw    = fs.readFileSync(path.join(DATA_ANALYSIS_PATH, outputFile), 'utf8');
                        return resolve(JSON.parse(raw));
                    } catch { /* fall through to stdout */ }
                }

                // Fallback: parse stdout
                try {
                    const lastBrace = stdout.lastIndexOf('\n{');
                    let parsed = null;
                    if (lastBrace !== -1) {
                        try { parsed = JSON.parse(stdout.slice(lastBrace + 1)); } catch { parsed = null; }
                    }
                    if (!parsed) {
                        const start = Math.min(
                            stdout.indexOf('{')  === -1 ? Infinity : stdout.indexOf('{'),
                            stdout.indexOf('[')  === -1 ? Infinity : stdout.indexOf('[')
                        );
                        if (start < Infinity) parsed = JSON.parse(stdout.slice(start));
                    }
                    if (!parsed) throw new Error('No JSON found');
                    return resolve(parsed);
                } catch {
                    console.error('Parse Error. Raw (first 500):', stdout.slice(0, 500));
                    return reject(Object.assign(new Error('البيانات الراجعة من البايثون غير صالحة.'), { status: 500 }));
                }
            });
        });
    }
}

module.exports = new DashboardService();
