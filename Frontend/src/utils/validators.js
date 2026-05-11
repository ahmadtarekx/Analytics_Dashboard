/**
 * validators.js — Utility helpers
 *
 * Password rule (strictly as specified in project guidelines):
 *   - Minimum 8 characters
 *   - At least one special symbol
 *
 * Do NOT add extra rules (uppercase, digits, etc.) beyond this spec.
 */

const SPECIAL_SYMBOL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

/**
 * Validate a password against the project's password policy.
 *
 * @param {string} password
 * @returns {{ valid: boolean, message: string }}
 */
export function validatePassword(password) {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters.' };
  }
  if (!SPECIAL_SYMBOL_RE.test(password)) {
    return { valid: false, message: 'Password must contain at least one special symbol.' };
  }
  return { valid: true, message: '' };
}

/**
 * Very light email format check (the real validation happens on the server).
 *
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
