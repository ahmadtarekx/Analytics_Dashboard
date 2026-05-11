// src/constants/api.js
// Single source of truth for all API endpoint URLs.
// To change the backend host, update BASE_URL only.

export const BASE_URL = 'http://localhost:3000/api';

export const API = {
  // Auth
  LOGIN:           `${BASE_URL}/login`,
  FORGOT_PASSWORD: `${BASE_URL}/forgot-password`,

  // Dashboard analytics
  DASHBOARD:       `${BASE_URL}/dashboard`,

  // IT
  IT_SEND_TICKET:  `${BASE_URL}/it/send-ticket`,
  IT_EMPLOYEE:     (id) => `${BASE_URL}/it/employee/${id}`,
  IT_RESET_PW:     (id) => `${BASE_URL}/it/employee/${id}/reset-password`,
  IT_INFO:         (id) => `${BASE_URL}/it/employee/${id}/info`,
  IT_EMAIL:        (id) => `${BASE_URL}/it/employee/${id}/email`,
  IT_BRANCH:       (id) => `${BASE_URL}/it/employee/${id}/branch`,
  IT_BRANCHES:     `${BASE_URL}/it/branches`,
  IT_TICKETS:      `${BASE_URL}/it/tickets`,
  IT_REPLY:        `${BASE_URL}/it/reply-ticket`,

  // Manager
  MGR_SEARCH:      `${BASE_URL}/manager/employee-search`,
  MGR_STATS:       `${BASE_URL}/manager/employee-stats`,
  MGR_APPROVALS:   (id) => `${BASE_URL}/manager/approvals/${id}`,
  MGR_RESOLVE:     `${BASE_URL}/manager/resolve`,

  // HR
  HR_SALARY_ADJ:   `${BASE_URL}/hr/salary-adjustment`,
  HR_BRANCH_EMPS:  `${BASE_URL}/hr/branch-employees`,

  // Sales
  SALES_FULL:      (id) => `${BASE_URL}/sales/my-full-stats/${id}`,
  SALES_STATS:     (id) => `${BASE_URL}/sales/my-stats/${id}`,
  SALES_LEADERBOARD: `${BASE_URL}/sales/leaderboard`,
  SALES_LEAVE:     `${BASE_URL}/sales/leave-request`,
  SALES_BRANCH:    `${BASE_URL}/sales/branch-summary`,
  SALES_PENDING_LEAVES: (id) => `${BASE_URL}/sales/pending-leaves/${id}`,
  SALES_RESOLVE_LEAVE: `${BASE_URL}/sales/resolve-leave`,

  // Finance
  FINANCE_EXPENSE:      `${BASE_URL}/finance/expense`,
  FINANCE_MY_EXP:       (id) => `${BASE_URL}/finance/my-expenses/${id}`,
  FINANCE_PENDING_EXP:  (id) => `${BASE_URL}/finance/pending-expenses/${id}`,
  FINANCE_RESOLVE_EXP:  `${BASE_URL}/finance/resolve-expense`,

  // PR
  PR_CAMPAIGN:          `${BASE_URL}/pr/campaign`,
  PR_MY_CAMPS:          (id) => `${BASE_URL}/pr/my-campaigns/${id}`,
  PR_PENDING_CAMPS:     (id) => `${BASE_URL}/pr/pending-campaigns/${id}`,
  PR_RESOLVE_CAMP:      `${BASE_URL}/pr/resolve-campaign`,
  PR_PRESS:             `${BASE_URL}/pr/press-release`,
  PR_RELEASES:          (id) => `${BASE_URL}/pr/press-releases/${id}`,

  // Products
  PRODUCTS:             `${BASE_URL}/products`,
  PRODUCT:              (pid) => `${BASE_URL}/products/${pid}`,

  // Tickets
  MY_TICKETS:           (id) => `${BASE_URL}/tickets/my/${id}`,
  DELETE_TICKET:        (tid, eid) => `${BASE_URL}/tickets/${tid}/employee/${eid}`,
  REQUEST_DELETE:       (tid) => `${BASE_URL}/tickets/${tid}/request-delete`,

  // AI
  INSIGHT:              `${BASE_URL}/insight`,
  CHAT:                 `${BASE_URL}/chat`,

  // Translation
  TRANSLATE:            `${BASE_URL}/translate`,
};