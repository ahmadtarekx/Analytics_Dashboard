/**
 * managerRepository.js — Repository Pattern
 *
 * Abstracts every Manager-module API call away from components.
 * No component should ever call fetch() for manager purposes — use this module.
 *
 * BACKEND CONTRACT (src/routes/managerRoutes.js  →  router.use('/manager', ...)):
 *   GET  /api/manager/employee-search    → searchEmployee
 *   GET  /api/manager/employee-stats     → getEmployeeStats
 *   GET  /api/manager/approvals/:id      → getApprovals
 *   POST /api/manager/resolve            → resolveApproval
 *
 * Who uses this repository?
 *   ManagerDashboardStrategy — all tabs: approvals, emp_search.
 *   The Owner (id 91949) also uses prRepository and financeRepository
 *   for the PR Campaigns and Expense Approvals sub-tabs in the same view.
 *
 * Approval types visible in getApprovals():
 *   UPDATE_INFO, UPDATE_EMAIL, UPDATE_BRANCH  — staged by IT
 *   ADD_PRODUCT, DELETE_PRODUCT               — staged by IT
 *   DELETE_TICKET                             — staged by IT after PR Manager approval
 *   SALARY_ADJUSTMENT                         — staged by HR
 *   LEAVE_REQUEST                             — staged by any non-IT employee
 */

import { apiClient, BASE_URL } from './apiClient';

// ── Endpoints ────────────────────────────────────────────────────────────────
const ENDPOINTS = {
  SEARCH:    `${BASE_URL}/manager/employee-search`,
  EMP_STATS: `${BASE_URL}/manager/employee-stats`,
  APPROVALS: (id) => `${BASE_URL}/manager/approvals/${id}`,
  RESOLVE:   `${BASE_URL}/manager/resolve`,
};

const managerRepository = {

  // ──────────────────────────────────────────────────────────────────────────
  // searchEmployee
  //
  // Fetches an employee's public profile as seen through the manager's lens.
  // The backend validates that the requesting manager has cross-dept or
  // owner-level access before returning the record.
  //
  // @param {object} params
  // @param {number} params.manager_id   — the searching manager's own ID
  // @param {number} params.emp_id       — the employee to look up
  // @returns {Promise<object>}  — employee record with full_name, email, role, dept, branches, etc.
  // ──────────────────────────────────────────────────────────────────────────
  searchEmployee(params = {}) {
    return apiClient.get(ENDPOINTS.SEARCH, params);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // getEmployeeStats
  //
  // Fetches analytics data for a specific employee through the manager's
  // department lens. E.g. HR manager → attendance/leave data;
  // Finance manager → payroll / expense data; Owner → all dimensions.
  //
  // The response mirrors the /api/dashboard format: top-level keys are
  // Python function names, each value has { data, chart?, warnings? }.
  //
  // @param {object} params
  // @param {number} params.manager_id
  // @param {number} params.emp_id
  // @returns {Promise<object>}  — analytics map
  // ──────────────────────────────────────────────────────────────────────────
  getEmployeeStats(params = {}) {
    return apiClient.get(ENDPOINTS.EMP_STATS, params);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // getApprovals
  //
  // Returns all pending approval tickets for a given manager.
  // Includes staged updates from IT and HR + leave requests from all depts.
  // Owner also receives escalated items (DELETE_TICKET after PR approval,
  // expense reports already approved by Finance Manager, etc.).
  //
  // @param {number|string} managerId   — the manager's own employee ID
  // @returns {Promise<Array<{
  //   ticket_id: number,
  //   type:      string,
  //   description: string,   — JSON-encoded payload with { action, changes, ... }
  //   time:      string,     — ISO timestamp
  // }>>}
  // ──────────────────────────────────────────────────────────────────────────
  getApprovals(managerId) {
    return apiClient.get(ENDPOINTS.APPROVALS(managerId));
  },

  // ──────────────────────────────────────────────────────────────────────────
  // resolveApproval
  //
  // Approve or reject a pending approval ticket.
  // On approval the backend commits the staged change (DB update + email).
  // On rejection the ticket is closed and the submitter is notified.
  //
  // Note: the old Dashboard used { ticket_id, status } — the backend's
  // resolveApproval controller reads the `status` field ('approve'|'reject').
  // The new architecture normalises to `action` as per the backend contract.
  //
  // @param {object} payload
  // @param {number} payload.ticket_id
  // @param {'approve'|'reject'} payload.status   — backend reads `status`
  // @returns {Promise<{ message: string }>}
  // ──────────────────────────────────────────────────────────────────────────
  resolveApproval(payload) {
    return apiClient.post(ENDPOINTS.RESOLVE, payload);
  },
};

export default managerRepository;
