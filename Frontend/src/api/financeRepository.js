/**
 * financeRepository.js — Repository Pattern
 *
 * Abstracts all Finance-module API calls away from components.
 * Talks to: GET /api/dashboard (analytics) and /api/finance/* (CRUD).
 *
 * BACKEND CONTRACT:
 *   GET /api/dashboard?userId=&role=&departmentId=
 *   The backend's ScriptResolutionStrategy selects either
 *   `finance_manager.py` or `finance_employee.py` based on dept + role.
 *   The response keys are the Python function names, e.g. `get_finance_overview`.
 *   CRITICAL: The analytics call MUST be named `get_finance_overview` to match
 *   the backend contract — do NOT invent a separate /api/finance/overview endpoint.
 */

import { apiClient, BASE_URL } from './apiClient';

// ── Endpoints ──────────────────────────────────────────────────────────────────
const ENDPOINTS = {
  // Shared analytics endpoint (ScriptResolutionStrategy picks the correct .py)
  DASHBOARD:    `${BASE_URL}/dashboard`,

  // Finance CRUD
  EXPENSE:      `${BASE_URL}/finance/expense`,
  MY_EXPENSES:  (empId)     => `${BASE_URL}/finance/my-expenses/${empId}`,
  PENDING_EXP:  (managerId) => `${BASE_URL}/finance/pending-expenses/${managerId}`,
  RESOLVE_EXP:  `${BASE_URL}/finance/resolve-expense`,
};

const financeRepository = {
  // ─────────────────────────────────────────────────────────────────────────────
  // get_finance_overview
  //
  // Fetches the finance analytics dashboard by calling GET /api/dashboard.
  // The backend's DashboardService → ScriptResolutionStrategy resolves to
  // `finance_manager.py` or `finance_employee.py` and returns a payload whose
  // top-level keys are Python function names (e.g. `get_finance_overview`,
  // `get_finance_restock_costs`, `get_finance_product_profitability`, etc.).
  //
  // Optional filter params (month pickers) are forwarded as query-string args.
  //
  // @param {object} params
  // @param {string|number} params.userId
  // @param {string}        params.role          — e.g. 'dep_manager' | 'emp'
  // @param {string|number} params.departmentId  — always 2 for Finance
  // @param {object}        [params.filters]     — e.g. { inv_flow_fm_year, inv_flow_fm_month }
  // @returns {Promise<object>} raw analytics JSON
  // ─────────────────────────────────────────────────────────────────────────────
  get_finance_overview({ userId, role, departmentId, filters = {} }) {
    return apiClient.get(ENDPOINTS.DASHBOARD, {
      userId,
      role,
      departmentId,
      ...filters,
    });
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Expense CRUD
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Submit a new expense report.
   * Two-level approval: emp → finance manager → owner.
   *
   * @param {object} payload
   * @param {number}  payload.emp_id
   * @param {string}  payload.emp_name
   * @param {string}  payload.category      — one of EXP_CATEGORIES
   * @param {number}  payload.amount        — positive float
   * @param {string}  payload.description
   * @param {string}  [payload.receipt_note]
   * @returns {Promise<{ message: string }>}
   */
  submitExpense(payload) {
    return apiClient.post(ENDPOINTS.EXPENSE, payload);
  },

  /**
   * Fetch all expense reports submitted by a specific employee.
   *
   * @param {number} empId
   * @returns {Promise<Array>}
   */
  getMyExpenses(empId) {
    return apiClient.get(ENDPOINTS.MY_EXPENSES(empId));
  },

  /**
   * Fetch expense reports pending approval for a manager or the owner.
   * The backend filters by stage automatically based on requesterId:
   *   - Owner (id 91949) → stage: pending_owner
   *   - Finance Manager  → stage: pending_manager | approved_by_owner
   *
   * @param {number} managerId
   * @returns {Promise<Array>}
   */
  getPendingExpenses(managerId) {
    return apiClient.get(ENDPOINTS.PENDING_EXP(managerId));
  },

  /**
   * Approve or reject an expense report.
   * Approval escalates: manager-approve → moves to pending_owner stage.
   * Owner-approve → final, stage becomes approved_by_owner.
   *
   * @param {object}              payload
   * @param {number}              payload.ticket_id
   * @param {'approve'|'reject'}  payload.action
   * @returns {Promise<{ message: string }>}
   */
  resolveExpense(payload) {
    return apiClient.post(ENDPOINTS.RESOLVE_EXP, payload);
  },
};

export default financeRepository;
