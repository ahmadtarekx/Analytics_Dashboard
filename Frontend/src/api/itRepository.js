/**
 * itRepository.js — Repository Pattern
 *
 * Abstracts every IT-module API call away from components.
 * No component should ever call fetch() for IT purposes — use this module.
 *
 * BACKEND CONTRACT (src/routes/itRoutes.js  →  router.use('/it', ...)):
 *   POST   /api/it/send-ticket                → sendTicket
 *   GET    /api/it/employee/:id               → getEmployee
 *   PATCH  /api/it/employee/:id/info          → stageInfoUpdate
 *   PATCH  /api/it/employee/:id/email         → stageEmailUpdate
 *   POST   /api/it/employee/:id/reset-password → resetPassword
 *   PATCH  /api/it/employee/:id/branch        → stageBranchUpdate
 *   GET    /api/it/branches                   → getBranches
 *   GET    /api/it/tickets                    → getTicketsInbox
 *   POST   /api/it/reply-ticket               → replyTicket
 *
 * Approval flow for staged changes (info / email / branch):
 *   IT employee submits via stage*() → backend creates a PENDING_APPROVAL ticket
 *   → Manager sees it in Pending Approvals (ManagerDashboardStrategy)
 *   → Manager calls managerRepository.resolveApproval()
 *   → On approval the backend commits the change and emails both parties.
 *
 * Password reset is NOT staged — it takes effect immediately and emails
 * the temporary password to the employee.
 */

import { apiClient, BASE_URL } from './apiClient';

// ── Endpoints ────────────────────────────────────────────────────────────────
const ENDPOINTS = {
  SEND_TICKET:   `${BASE_URL}/it/send-ticket`,
  EMPLOYEE:      (id) => `${BASE_URL}/it/employee/${id}`,
  RESET_PW:      (id) => `${BASE_URL}/it/employee/${id}/reset-password`,
  INFO:          (id) => `${BASE_URL}/it/employee/${id}/info`,
  EMAIL:         (id) => `${BASE_URL}/it/employee/${id}/email`,
  BRANCH:        (id) => `${BASE_URL}/it/employee/${id}/branch`,
  BRANCHES:      `${BASE_URL}/it/branches`,
  TICKETS_INBOX: `${BASE_URL}/it/tickets`,
  REPLY_TICKET:  `${BASE_URL}/it/reply-ticket`,
};

const itRepository = {

  // ──────────────────────────────────────────────────────────────────────────
  // sendTicket
  //
  // Sends a support ticket to a target employee via email.
  // The backend creates the ticket record and dispatches an email notification.
  //
  // @param {object} payload
  // @param {number} payload.target_emp_id   — ID of the employee receiving the ticket
  // @param {string} payload.ticket_type     — e.g. 'Password Reset' | 'Hardware Issue'
  // @param {string} payload.description     — ticket body (may include [Priority: X] prefix)
  // @returns {Promise<{ message: string }>}
  // ──────────────────────────────────────────────────────────────────────────
  sendTicket(payload) {
    return apiClient.post(ENDPOINTS.SEND_TICKET, payload);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // getEmployee
  //
  // Looks up a single employee by their ID.
  // Used by IT to pre-fill the employee card before any action.
  // Returns full profile: name, email, role, dept, branches, phone, etc.
  //
  // @param {number|string} id   — employee ID
  // @returns {Promise<object>}  — employee record
  // ──────────────────────────────────────────────────────────────────────────
  getEmployee(id) {
    return apiClient.get(ENDPOINTS.EMPLOYEE(id));
  },

  // ──────────────────────────────────────────────────────────────────────────
  // stageInfoUpdate
  //
  // Stages a name/phone/address update for an employee.
  // Creates a PENDING_APPROVAL ticket; the change is NOT applied until
  // the manager approves it in their Approvals tab.
  //
  // @param {number|string} id
  // @param {object} payload
  // @param {string} [payload.first_name]
  // @param {string} [payload.last_name]
  // @param {string} [payload.phone]          — must pass Egyptian phone validation
  // @param {string} [payload.address]        — format: BuildingNo, Street, Area, City
  // @param {number} payload.submitted_by_id
  // @param {string} payload.submitted_by_name
  // @returns {Promise<{ message: string }>}
  // ──────────────────────────────────────────────────────────────────────────
  stageInfoUpdate(id, payload) {
    return apiClient.patch(ENDPOINTS.INFO(id), payload);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // stageEmailUpdate
  //
  // Stages a login-email change for an employee.
  // Also staged/approval-gated. Only @gmail.com addresses are accepted.
  // On approval the employee must use the new email to log in.
  //
  // @param {number|string} id
  // @param {object} payload
  // @param {string} payload.new_email
  // @param {number} payload.submitted_by_id
  // @param {string} payload.submitted_by_name
  // @returns {Promise<{ message: string }>}
  // ──────────────────────────────────────────────────────────────────────────
  stageEmailUpdate(id, payload) {
    return apiClient.patch(ENDPOINTS.EMAIL(id), payload);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // resetPassword
  //
  // Forces an immediate password reset for an employee.
  // NOT staged — the backend generates a temp password, updates the DB,
  // and emails the temp password to the employee on the spot.
  //
  // AnalyticOS password policy: min 8 characters, ≥1 special symbol.
  // The generated temp password from the backend always satisfies this rule.
  //
  // @param {number|string} id   — employee ID
  // @param {object}        [payload={}]   — reserved for future fields
  // @returns {Promise<{ message: string, temp_password: string }>}
  // ──────────────────────────────────────────────────────────────────────────
  resetPassword(id, payload = {}) {
    return apiClient.post(ENDPOINTS.RESET_PW(id), payload);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // stageBranchUpdate
  //
  // Stages a primary and/or secondary branch reassignment.
  // Approval-gated. Pass null for branch_id / secondary_branch_id to clear.
  //
  // @param {number|string} id
  // @param {object} payload
  // @param {number|null} [payload.branch_id]
  // @param {number|null} [payload.secondary_branch_id]
  // @param {number} payload.submitted_by_id
  // @param {string} payload.submitted_by_name
  // @returns {Promise<{ message: string }>}
  // ──────────────────────────────────────────────────────────────────────────
  stageBranchUpdate(id, payload) {
    return apiClient.patch(ENDPOINTS.BRANCH(id), payload);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // getBranches
  //
  // Returns the full list of company branches.
  // Used to populate the branch selector in the Branch Reassignment tool.
  //
  // @returns {Promise<Array<{ b_id: number, location: string }>>}
  // ──────────────────────────────────────────────────────────────────────────
  getBranches() {
    return apiClient.get(ENDPOINTS.BRANCHES);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // getTicketsInbox
  //
  // Fetches all support tickets submitted to the IT Admin inbox,
  // scoped by time period. Leave requests are excluded by the backend.
  //
  // @param {object} params
  // @param {'daily'|'weekly'|'monthly'|'yearly'} params.period
  // @returns {Promise<{ tickets: Array, count: number }>}
  // ──────────────────────────────────────────────────────────────────────────
  getTicketsInbox(params = {}) {
    return apiClient.get(ENDPOINTS.TICKETS_INBOX, params);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // replyTicket
  //
  // Sends an email reply from the IT Admin to the ticket's submitter.
  // The backend appends an [IT Reply ...] block to the ticket description.
  //
  // @param {object} payload
  // @param {number} payload.ticket_id
  // @param {string} payload.reply_message
  // @param {number} payload.it_emp_id    — the responding IT employee's ID
  // @returns {Promise<{ message: string }>}
  // ──────────────────────────────────────────────────────────────────────────
  replyTicket(payload) {
    return apiClient.post(ENDPOINTS.REPLY_TICKET, payload);
  },
};

export default itRepository;
