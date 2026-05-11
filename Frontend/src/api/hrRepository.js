/**
 * hrRepository.js — Repository Pattern
 *
 * Abstracts every HR-module API call away from components.
 * No component should ever call fetch() for HR purposes — use this module.
 *
 * BACKEND CONTRACT (src/routes/hrRoutes.js):
 *   POST /api/hr/salary-adjustment            → stageSalaryAdjustment
 *   GET  /api/hr/branch-employees?branch_id=  → getBranchEmployees
 *   POST /api/hr/leave-request                → submitLeaveRequest
 *   GET  /api/hr/pending-leaves/:hrManagerId  → getPendingLeaves
 *   POST /api/hr/resolve-leave                → resolveLeave
 *
 * Flow for salary adjustments:
 *   HR employee submits via stageSalaryAdjustment()
 *   → Backend stages a SALARY_ADJUSTMENT ticket
 *   → HR Manager sees it in their Pending Approvals (ManagerDashboardStrategy)
 *   → Manager calls managerRepository.resolveApproval()
 *
 * Flow for leave requests:
 *   Any non-IT employee submits via submitLeaveRequest()
 *   → Backend stages a LEAVE_REQUEST ticket routed to the HR manager
 *   → HR Manager loads via getPendingLeaves() and resolves via resolveLeave()
 */

import { apiClient, BASE_URL } from './apiClient';

// ── Endpoints ────────────────────────────────────────────────────────────────
const ENDPOINTS = {
  SALARY_ADJ:     `${BASE_URL}/hr/salary-adjustment`,
  BRANCH_EMPS:    `${BASE_URL}/hr/branch-employees`,
  LEAVE_REQUEST:  `${BASE_URL}/hr/leave-request`,
  PENDING_LEAVES: (hrManagerId) => `${BASE_URL}/hr/pending-leaves/${hrManagerId}`,
  RESOLVE_LEAVE:  `${BASE_URL}/hr/resolve-leave`,
};

const hrRepository = {

  // ──────────────────────────────────────────────────────────────────────────
  // stageSalaryAdjustment
  //
  // Stages a bonus or deduction request for a specific employee.
  // The backend creates a pending SALARY_ADJUSTMENT ticket visible to the
  // HR Manager in their Approvals tab. The salary is NOT updated until approval.
  //
  // @param {object}  payload
  // @param {number}  payload.target_emp_id      — employee to adjust
  // @param {'bonus'|'deduction'} payload.adjustment_type
  // @param {number}  payload.amount             — positive float (EGP)
  // @param {string}  payload.reason             — required explanation
  // @param {number}  payload.submitted_by_id    — HR employee's own ID
  // @param {string}  payload.submitted_by_name  — HR employee's full name
  // @returns {Promise<{ message: string }>}
  // ──────────────────────────────────────────────────────────────────────────
  stageSalaryAdjustment(payload) {
    return apiClient.post(ENDPOINTS.SALARY_ADJ, payload);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // getBranchEmployees
  //
  // Fetches employees belonging to a specific branch.
  // Used by HR employees to populate the employee selector in the
  // salary adjustment form. Each row includes salary so the UI can
  // render a live before/after preview.
  //
  // @param {object}           params
  // @param {number|string}    params.branch_id   — branch to query
  // @returns {Promise<Array<{ emp_id, full_name, department_name, salary }>>}
  // ──────────────────────────────────────────────────────────────────────────
  getBranchEmployees(params = {}) {
    return apiClient.get(ENDPOINTS.BRANCH_EMPS, params);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // submitLeaveRequest
  //
  // Submits a leave request on behalf of the current employee.
  // The backend routes this to the HR Manager as a LEAVE_REQUEST ticket.
  //
  // Business rules (enforced on the frontend before calling this):
  //   Sick        → start_date >= today
  //   Emergency   → start_date today or tomorrow only
  //   Annual/Unpaid → start_date >= tomorrow
  //   Maternity/Paternity → start_date >= 7 days from now
  //
  // @param {object}  payload
  // @param {number}  payload.emp_id       — submitting employee ID
  // @param {string}  payload.emp_name     — submitting employee full name
  // @param {string}  payload.start_date   — ISO date string (YYYY-MM-DD)
  // @param {string}  payload.end_date     — ISO date string (YYYY-MM-DD)
  // @param {string}  payload.reason       — required, at least a few words
  // @param {string}  payload.leave_type   — 'Annual'|'Sick'|'Emergency'|'Unpaid'|'Maternity/Paternity'
  // @returns {Promise<{ message: string }>}
  // ──────────────────────────────────────────────────────────────────────────
  submitLeaveRequest(payload) {
    return apiClient.post(ENDPOINTS.LEAVE_REQUEST, payload);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // getPendingLeaves
  //
  // Loads all pending leave requests for an HR Manager to review.
  // Only accessible by employees with role === 'dep_manager' in dept 3.
  //
  // @param {number} hrManagerId   — the HR Manager's employee ID
  // @returns {Promise<Array>}
  // ──────────────────────────────────────────────────────────────────────────
  getPendingLeaves(hrManagerId) {
    return apiClient.get(ENDPOINTS.PENDING_LEAVES(hrManagerId));
  },

  // ──────────────────────────────────────────────────────────────────────────
  // resolveLeave
  //
  // Approve or reject a pending leave request.
  // On approval the backend records the leave in the database.
  //
  // @param {object}              payload
  // @param {number}              payload.ticket_id
  // @param {'approve'|'reject'}  payload.action
  // @returns {Promise<{ message: string }>}
  // ──────────────────────────────────────────────────────────────────────────
  resolveLeave(payload) {
    return apiClient.post(ENDPOINTS.RESOLVE_LEAVE, payload);
  },
};

export default hrRepository;
