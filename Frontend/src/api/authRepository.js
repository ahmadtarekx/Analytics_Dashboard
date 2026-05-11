/**
 * authRepository.js — Repository Pattern
 *
 * Abstracts all authentication API calls away from components.
 * Talks to: POST /api/login, POST /api/forgot-password
 *
 * No component should ever call fetch() for auth purposes.
 * Login.jsx calls authRepository.login() → AuthContext.login() → stored session.
 */

import { apiClient, BASE_URL } from './apiClient';

// ── Endpoints ──────────────────────────────────────────────────────────────────
const ENDPOINTS = {
  LOGIN:           `${BASE_URL}/login`,
  FORGOT_PASSWORD: `${BASE_URL}/forgot-password`,
};

const authRepository = {
  /**
   * Authenticate a user with email + password.
   *
   * On success the backend returns:
   *   { user: { id, first_name, last_name, email, role, department_id, ... } }
   *
   * On failure apiClient throws an Error with:
   *   err.message — the backend's Arabic or English error string
   *   err.status  — HTTP status code (400 / 401 / 403 / 500)
   *
   * The Login component maps these backend strings to user-friendly messages;
   * it does NOT expose raw server errors to the UI.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ user: object }>}
   */
  login(email, password) {
    return apiClient.post(ENDPOINTS.LOGIN, { email, password });
  },

  /**
   * Trigger a password-reset email.
   * The backend generates a new secure password and emails it to the address.
   *
   * On success:  { message: string }
   * On failure:  throws Error with .message from backend
   *
   * @param {string} email
   * @returns {Promise<{ message: string }>}
   */
  forgotPassword(email) {
    return apiClient.post(ENDPOINTS.FORGOT_PASSWORD, { email });
  },
};

export default authRepository;
