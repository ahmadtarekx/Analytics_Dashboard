/**
 * dashboardRepository.js — Repository Pattern
 *
 * Handles the shared analytics dashboard endpoint.
 * Used by all role strategies that render Python-powered charts.
 * Talks to: GET /api/dashboard
 */

import { apiClient, BASE_URL } from './apiClient';

const ENDPOINT = `${BASE_URL}/dashboard`;

const dashboardRepository = {
  /**
   * Fetch role-based analytics dashboard data.
   * The backend's ScriptResolutionStrategy picks the right Python script.
   *
   * @param {object} params
   * @param {string|number} params.userId
   * @param {string}        params.role          — 'emp' | 'leader' | 'dep_manager' | 'sales_manager'
   * @param {string|number} params.departmentId
   * @param {object}        [params.filters]     — month/year picker params
   * @returns {Promise<object>}
   */
  getData({ userId, role, departmentId, filters = {} }) {
    return apiClient.get(ENDPOINT, { userId, role, departmentId, ...filters });
  },
};

export default dashboardRepository;
