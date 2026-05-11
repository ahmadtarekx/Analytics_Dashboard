/**
 * src/features/auth/useLoginLock.js
 *
 * Custom Hook — Single Responsibility: lockout state machine only.
 *
 * Extracted 1-for-1 from the original Login.jsx lockout logic.
 * Manages:
 *   - Failed attempt counter
 *   - Lockout timestamp (lockedUntil)
 *   - Live countdown display value (lockCountdown)
 *
 * Constants come from the caller (Login.jsx) so they stay configurable.
 * Original values: maxAttempts = 3, lockoutSeconds = 60.
 */

import { useState, useRef, useEffect } from 'react';

export default function useLoginLock(maxAttempts, lockoutSeconds) {
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil,    setLockedUntil]    = useState(null); // ms timestamp
  const [lockCountdown,  setLockCountdown]  = useState(0);

  // Use a ref for the timer so cleanup never goes stale across renders
  const timerRef = useRef(null);

  // Derived: is the user currently locked out?
  const isLocked = !!lockedUntil && Date.now() < lockedUntil;

  /**
   * startCountdown — recursive setTimeout tick (matches original implementation).
   * Clears itself when the lock expires, and resets failedAttempts so the user
   * can try again with a clean slate — identical to original behaviour.
   */
  const startCountdown = (until) => {
    clearTimeout(timerRef.current);

    const tick = () => {
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining <= 0) {
        // Lock expired — reset everything exactly as the original did
        setLockCountdown(0);
        setLockedUntil(null);
        setFailedAttempts(0);
      } else {
        setLockCountdown(remaining);
        timerRef.current = setTimeout(tick, 1000);
      }
    };

    tick();
  };

  /**
   * recordFailure — call on every credential failure.
   * Returns { locked: boolean, remaining: number } so the caller
   * can compose its own error message without needing internal state.
   */
  const recordFailure = () => {
    const next = failedAttempts + 1;
    setFailedAttempts(next);

    if (next >= maxAttempts) {
      const until = Date.now() + lockoutSeconds * 1000;
      setLockedUntil(until);
      startCountdown(until);
      return { locked: true, remaining: 0 };
    }

    return { locked: false, remaining: maxAttempts - next };
  };

  /**
   * resetFailures — call on successful login to clear all lockout state.
   */
  const resetFailures = () => {
    clearTimeout(timerRef.current);
    setFailedAttempts(0);
    setLockedUntil(null);
    setLockCountdown(0);
  };

  // Cleanup on unmount — prevents setState on an unmounted component
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return {
    failedAttempts,
    isLocked,
    lockCountdown,
    recordFailure,
    resetFailures,
  };
}
