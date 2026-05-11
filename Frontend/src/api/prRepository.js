/**
 * prRepository.js — Repository Pattern
 * Talks to: /api/pr/*
 */

import { apiClient, BASE_URL } from './apiClient';

const ENDPOINTS = {
  CAMPAIGN:         `${BASE_URL}/pr/campaign`,
  MY_CAMPAIGNS:     (empId)     => `${BASE_URL}/pr/my-campaigns/${empId}`,
  PENDING_CAMPS:    (managerId) => `${BASE_URL}/pr/pending-campaigns/${managerId}`,
  RESOLVE_CAMP:     `${BASE_URL}/pr/resolve-campaign`,
  PRESS_RELEASE:    `${BASE_URL}/pr/press-release`,
  PRESS_RELEASES:   (managerId) => `${BASE_URL}/pr/press-releases/${managerId}`,
};

const prRepository = {
  submitCampaign:     (payload)   => apiClient.post(ENDPOINTS.CAMPAIGN, payload),
  getMyCampaigns:     (empId)     => apiClient.get(ENDPOINTS.MY_CAMPAIGNS(empId)),
  getPendingCampaigns:(managerId) => apiClient.get(ENDPOINTS.PENDING_CAMPS(managerId)),
  resolveCampaign:    (payload)   => apiClient.post(ENDPOINTS.RESOLVE_CAMP, payload),
  submitPressRelease: (payload)   => apiClient.post(ENDPOINTS.PRESS_RELEASE, payload),
  getPressReleases:   (managerId) => apiClient.get(ENDPOINTS.PRESS_RELEASES(managerId)),
};

export default prRepository;
