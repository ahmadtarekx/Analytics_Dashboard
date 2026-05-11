/**
 * AuthContext.jsx — Observer Pattern via React Context API
 *
 * Global state manager for: user session, theme (dark/light), language (ar/en),
 * and AI toggle.  Any component that consumes this context automatically
 * re-renders when any of these values change — this IS the Observer Pattern.
 *
 * AnalyticOS auth policy:
 *   Passwords must be at least 8 characters and contain ≥1 special symbol.
 *   Use `validatePassword(pw)` (exported below) before any auth operation
 *   that touches a password field.  The backend enforces the same rule via
 *   bcrypt; this function prevents bad payloads from ever being sent.
 *
 * Usage:
 *   const { user, login, logout, isDark, toggleTheme, language, toggleLanguage } = useAuth();
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

// ── Context ────────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ── Password policy ────────────────────────────────────────────────────────────
// Minimum 8 characters + at least one special symbol.
// Matches the AnalyticOS security requirement for all password-touch operations.
const SPECIAL_SYMBOL_RE = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

/**
 * validatePassword
 *
 * Enforces the AnalyticOS password policy:
 *   - Minimum 8 characters
 *   - At least one special symbol (!@#$%^&*… etc.)
 *
 * @param  {string} password
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validatePassword(password) {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (!SPECIAL_SYMBOL_RE.test(password)) {
    return { valid: false, error: 'Password must contain at least one special symbol (e.g. ! @ # $ %).' };
  }
  return { valid: true, error: null };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function readStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── Provider ───────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {

  // ── User session ──────────────────────────────────────────────────────────
  const [user, setUser] = useState(readStoredUser);

  const login = useCallback((userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  // ── Theme ─────────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(
    () => localStorage.getItem('theme') !== 'light'
  );

  /**
   * Sync the 'light' class to <html> (document.documentElement) whenever
   * isDark changes.  CSS selectors like :root.light refer to the <html>
   * element — NOT to any app div — so this is the only correct target.
   *
   * useEffect fires after React commits the new state, which means:
   *   1. The DOM class is always in sync with the React isDark value.
   *   2. On initial mount it immediately applies the persisted preference,
   *      preventing a flash-of-wrong-theme before the first render.
   */
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
      // DOM class sync is handled by the useEffect above.
    });
  }, []);

  // ── Language ──────────────────────────────────────────────────────────────
  const [language, setLanguage] = useState(
    () => localStorage.getItem('lang') || 'ar'
  );

  const toggleLanguage = useCallback(() => {
    setLanguage(prev => {
      const next = prev === 'ar' ? 'en' : 'ar';
      localStorage.setItem('lang', next);
      return next;
    });
  }, []);

  const setLang = useCallback((lang) => {
    localStorage.setItem('lang', lang);
    setLanguage(lang);
  }, []);

  // ── AI Toggle ─────────────────────────────────────────────────────────────
  const [aiEnabled, setAiEnabled] = useState(
    () => localStorage.getItem('aiEnabled') !== 'false'
  );

  const toggleAi = useCallback(() => {
    setAiEnabled(prev => {
      const next = !prev;
      localStorage.setItem('aiEnabled', String(next));
      return next;
    });
  }, []);

  // ── Role helpers (derived — no extra state) ───────────────────────────────
  // Handle the `departement_id` typo that exists in the DB schema
  const dept = user?.department_id ?? user?.departement_id;

  const isIT             = dept == 6;
  const isInventory      = dept == 5;
  const isPR             = dept == 4;
  const isHR             = dept == 3 && user?.role !== 'dep_manager';
  const isFinance        = dept == 2;
  const isSales          = dept == 1;
  const isSalesLeader    = isSales && user?.role === 'leader';
  const isSalesManager   = isSales && (user?.role === 'dep_manager' || user?.role === 'sales_manager');
  const isFinanceManager = isFinance && user?.role === 'dep_manager';
  const isPRManager      = isPR && user?.role === 'dep_manager';
  const isOwner          = user?.id === 91949;
  const isManager        = user?.role === 'dep_manager' || user?.role === 'sales_manager' || isOwner;

  // hasDash: user should see analytics dashboard (Sales employees have no dash)
  const hasDash = user && !(user.role === 'emp' && dept == 1);

  // ── Context value ─────────────────────────────────────────────────────────
  const value = {
    // Session
    user,
    login,
    logout,
    // Theme
    isDark,
    toggleTheme,
    // Language
    language,
    toggleLanguage,
    setLang,
    // AI
    aiEnabled,
    toggleAi,
    // Role flags (derived — computed fresh on every render)
    dept,
    isIT,
    isInventory,
    isPR,
    isHR,
    isFinance,
    isSales,
    isSalesLeader,
    isSalesManager,
    isFinanceManager,
    isPRManager,
    isOwner,
    isManager,
    hasDash,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export default AuthContext;
