/**
 * aiRepository.js — Repository Pattern
 * Talks to: POST /api/insight, POST /api/chat, POST /api/translate
 */

import { apiClient, BASE_URL } from './apiClient';

const ENDPOINTS = {
  INSIGHT:   `${BASE_URL}/insight`,
  CHAT:      `${BASE_URL}/chat`,
  TRANSLATE: `${BASE_URL}/translate`,
};

const aiRepository = {
  generateInsight: (payload)                => apiClient.post(ENDPOINTS.INSIGHT, payload),
  chat:            (payload)                => apiClient.post(ENDPOINTS.CHAT, payload),
  translate:       (text, to)               => apiClient.post(ENDPOINTS.TRANSLATE, { text, to }),
};

export default aiRepository;
