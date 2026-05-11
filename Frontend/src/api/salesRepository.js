/**
 * salesRepository.js — Repository Pattern
 * Talks to: /api/sales/*
 */

import { apiClient, BASE_URL } from './apiClient';

const ENDPOINTS = {
  MY_FULL_STATS:    (empId)     => `${BASE_URL}/sales/my-full-stats/${empId}`,
  MY_STATS:         (empId)     => `${BASE_URL}/sales/my-stats/${empId}`,
  LEADERBOARD:      `${BASE_URL}/sales/leaderboard`,
  BRANCH_SUMMARY:   `${BASE_URL}/sales/branch-summary`,
  PENDING_LEAVES:   (managerId) => `${BASE_URL}/sales/pending-leaves/${managerId}`,
  RESOLVE_LEAVE:    `${BASE_URL}/sales/resolve-leave`,
};

const salesRepository = {
  getMyFullStats:   (empId)            => apiClient.get(ENDPOINTS.MY_FULL_STATS(empId)),
  getMyStats:       (empId)            => apiClient.get(ENDPOINTS.MY_STATS(empId)),
  // params: { branch_id, leader_id, period }
  getLeaderboard:   (params = {})      => apiClient.get(ENDPOINTS.LEADERBOARD, params),
  // params: { branch_id, period }  — period: 'month' | 'year' | 'all'
  getBranchSummary: (params = {})      => apiClient.get(ENDPOINTS.BRANCH_SUMMARY, params),
  getPendingLeaves: (managerId)        => apiClient.get(ENDPOINTS.PENDING_LEAVES(managerId)),
  resolveLeave:     (payload)          => apiClient.post(ENDPOINTS.RESOLVE_LEAVE, payload),
};

export default salesRepository;
