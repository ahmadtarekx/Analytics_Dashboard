// src/strategies/ScriptResolutionStrategy.js
// Strategy Pattern: each department/role combination maps to a concrete Python
// analytics script. Adding a new department requires only a new entry in the
// strategy map — no changes to any controller or service.

/**
 * Base abstract strategy interface (documentation only in JS).
 * Each strategy entry implements: resolve(role) → scriptFilename | null
 */

// ── Concrete Strategy Map ─────────────────────────────────────────────────────
const SCRIPT_STRATEGIES = {
    1: {
        // Sales department
        dep_manager:   'sales_manager.py',
        sales_manager: 'sales_manager.py',
        leader:        'sales_leader.py',
        default:       'sales_employee.py',
    },
    2: {
        // Finance department
        dep_manager: 'finance_manager.py',
        default:     'finance_employee.py',
    },
    3: {
        // HR department
        dep_manager: 'hr_manager.py',
        default:     'hr_employee.py',
    },
    4: {
        // PR department
        dep_manager: 'pr_manager.py',
        default:     'pr_employee.py',
    },
    5: {
        // Inventory department
        dep_manager: 'inventory_manager.py',
        default:     'inventory_employee.py',
    },
    6: {
        // IT department — employees have no analytics dashboard
        default: 'it_employee.py',
    },
};

/**
 * Maps a department+role combination to the correct Python script filename.
 * Returns null when no script is configured (renders a "coming soon" message).
 *
 * @param {number|string} departmentId
 * @param {string} role
 * @returns {string|null}
 */
function resolveScript(departmentId, role) {
    const d    = parseInt(departmentId);
    const dept = SCRIPT_STRATEGIES[d];
    if (!dept) return null;
    return dept[role] || dept.default || null;
}

/**
 * Maps a Python script filename to the corresponding output .txt file.
 * Python scripts write JSON to disk to bypass stdout pipe size limits.
 */
const SCRIPT_OUTPUT_FILES = {
    'sales_manager.py':     'sales_manager_output.txt',
    'sales_employee.py':    'sales_employee_output.txt',
    'sales_leader.py':      'sales_leader_output.txt',
    'hr_manager.py':        'hr_manager_output.txt',
    'hr_employee.py':       'hr_employee_output.txt',
    'finance_manager.py':   'finance_manager_output.txt',
    'finance_employee.py':  'finance_employee_output.txt',
    'pr_manager.py':        'pr_manager_output.txt',
    'pr_employee.py':       'pr_employee_output.txt',
    'inventory_manager.py': 'inventory_manager_output.txt',
    'inventory_employee.py':'inventory_employee_output.txt',
};

/**
 * Returns the output file name for a given script.
 * @param {string} scriptName
 * @returns {string|null}
 */
function resolveOutputFile(scriptName) {
    return SCRIPT_OUTPUT_FILES[scriptName] || null;
}

module.exports = { resolveScript, resolveOutputFile };
