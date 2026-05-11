/**
 * src/features/auth/Login.jsx
 *
 * Phase 3 Migration — Modular Architecture.
 *
 * This file is the VIEW LAYER only. All logic is delegated:
 *   - Lockout state machine  → useLoginLock.js
 *   - Forgot password UI     → ForgotPasswordModal.jsx
 *   - API calls              → authRepository (Repository Pattern)
 *   - Session management     → useAuth() from AuthContext (Observer Pattern)
 *   - Password validation    → validatePassword() from AuthContext
 *
 * UI is bit-for-bit identical to the original src/pages/Login.jsx:
 *   - Every @keyframes, CSS class, and inline style is preserved exactly.
 *   - All 8 SVG icon paths (D object) are the originals — not substituted
 *     from Icon.jsx because Icon.jsx's IC is missing lock / eye / eyeOff.
 */

import { useState }                          from 'react';
import { useNavigate }                       from 'react-router-dom';
import { useAuth, validatePassword }         from '../../context/AuthContext';
import authRepository                        from '../../api/authRepository';
import useLoginLock                          from './useLoginLock';
import ForgotPasswordModal                   from './ForgotPasswordModal';

// ── Lockout policy (exact original values) ────────────────────────────────────
const MAX_ATTEMPTS    = 3;
const LOCKOUT_SECONDS = 60;

// ── Inline StyleTag (login-specific CSS — kept here because it is NOT part of
//    the shared StyleTag used by the dashboard; merging them would break both) ─
const StyleTag = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #0d1b3e;
    }

    @keyframes floatA {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      50%       { transform: translateY(-22px) rotate(4deg); }
    }
    @keyframes floatB {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      50%       { transform: translateY(18px) rotate(-5deg); }
    }
    @keyframes floatC {
      0%, 100% { transform: translateY(0px) scale(1); }
      50%       { transform: translateY(-14px) scale(1.04); }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(28px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; } to { opacity: 1; }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes gradShift {
      0%   { background-position: 0% 50%; }
      50%  { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes inputFocus {
      from { box-shadow: 0 0 0 0 rgba(99,130,255,0); }
      to   { box-shadow: 0 0 0 4px rgba(99,130,255,0.18); }
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%       { transform: translateX(-6px); }
      40%       { transform: translateX(6px); }
      60%       { transform: translateX(-4px); }
      80%       { transform: translateX(4px); }
    }
    @keyframes successPop {
      0%   { transform: scale(0.8); opacity: 0; }
      60%  { transform: scale(1.08); opacity: 1; }
      100% { transform: scale(1); }
    }

    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      padding: 20px;
    }

    .bg-mesh {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 80% 60% at 20% 20%, rgba(79,101,255,0.25) 0%, transparent 60%),
        radial-gradient(ellipse 60% 50% at 80% 80%, rgba(139,92,246,0.2) 0%, transparent 55%),
        radial-gradient(ellipse 50% 40% at 60% 10%, rgba(6,182,212,0.12) 0%, transparent 50%),
        #0d1b3e;
    }

    .blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(70px);
      opacity: 0.35;
      pointer-events: none;
    }

    .grid-overlay {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(79,101,255,0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(79,101,255,0.05) 1px, transparent 1px);
      background-size: 48px 48px;
      pointer-events: none;
    }

    .login-card {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 420px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 24px;
      padding: 40px 36px 36px;
      backdrop-filter: blur(24px);
      animation: slideUp 0.55s cubic-bezier(0.22,1,0.36,1) both;
      box-shadow:
        0 40px 80px rgba(0,0,0,0.4),
        inset 0 1px 0 rgba(255,255,255,0.08);
    }

    .login-input {
      width: 100%;
      padding: 13px 16px 13px 44px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      color: #ffffff;
      font-size: 14px;
      font-weight: 500;
      outline: none;
      transition: border-color 0.2s, background 0.2s;
      font-family: 'Plus Jakarta Sans', sans-serif;
      user-select: text;
      -webkit-user-select: text;
      cursor: text;
    }
    .login-input::placeholder { color: rgba(255,255,255,0.28); }
    .login-input:focus {
      border-color: rgba(99,130,255,0.7);
      background: rgba(99,130,255,0.08);
      animation: inputFocus 0.25s ease forwards;
    }

    .login-btn {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 12px;
      background: linear-gradient(135deg, #4f65ff 0%, #7c3aed 100%);
      background-size: 200% 200%;
      color: #fff;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.15s;
      font-family: 'Plus Jakarta Sans', sans-serif;
      position: relative;
      overflow: hidden;
      letter-spacing: 0.2px;
    }
    .login-btn::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
      pointer-events: none;
    }
    .login-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
    .login-btn:active:not(:disabled) { transform: translateY(0); }
    .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .shake { animation: shake 0.4s ease; }

    .error-box {
      display: flex; align-items: center; gap: 10px;
      padding: 11px 14px;
      background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.3);
      border-radius: 10px;
      color: #fca5a5;
      font-size: 13px;
      font-weight: 500;
      animation: slideUp 0.25s ease;
    }

    .success-box {
      display: flex; align-items: center; gap: 10px;
      padding: 11px 14px;
      background: rgba(16,185,129,0.1);
      border: 1px solid rgba(16,185,129,0.3);
      border-radius: 10px;
      color: #6ee7b7;
      font-size: 13px;
      font-weight: 500;
      animation: successPop 0.4s ease;
    }

    .spinner-sm {
      width: 18px; height: 18px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      display: inline-block;
    }

    .input-icon {
      position: absolute;
      top: 50%; left: 14px;
      transform: translateY(-50%);
      pointer-events: none;
      color: rgba(255,255,255,0.45);
    }

    .eye-toggle {
      position: absolute;
      top: 50%; right: 14px;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      color: rgba(255,255,255,0.65);
      transition: color 0.18s, background 0.18s;
    }
    .eye-toggle:hover {
      color: #ffffff;
      background: rgba(255,255,255,0.1);
    }

    .login-input::-ms-reveal,
    .login-input::-ms-clear { display: none; }

    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
      margin: 24px 0;
    }

    /* Forgot Password Modal — defined here because ForgotPasswordModal.jsx
       mounts inside this page's DOM and inherits this stylesheet */
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(13,27,62,0.85);
      backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999;
      animation: fadeIn 0.2s ease;
      padding: 20px;
    }
    .modal-card {
      width: 100%; max-width: 400px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 20px;
      padding: 30px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
      animation: slideUp 0.3s cubic-bezier(0.22,1,0.36,1) both;
    }
    .link-btn {
      background: none; border: none;
      color: #9dbeff;
      font-size: 12px; font-weight: 600;
      cursor: pointer; text-decoration: underline;
      font-family: inherit;
      transition: color 0.2s;
    }
    .link-btn:hover { color: #ffffff; }
  `}</style>
);

// ── SVG helper (exact original — NOT imported from Icon.jsx because IC is
//    missing lock / eye / eyeOff paths that the login form requires) ────────────
const SVG = ({ d, size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

// ── D — icon path dictionary (ALL 8 original paths, bit-for-bit) ──────────────
const D = {
  mail:   "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
  lock:   "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
  eye:    "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  eyeOff: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22",
  warn:   "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  check:  "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3",
  chart:  "M3 3v18h18M9 17V9m4 8V5m4 12v-4",
  close:  "M18 6L6 18M6 6l12 12",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function Login() {
  const navigate      = useNavigate();
  const { login }     = useAuth();                     // Observer Pattern

  // Form state
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [errorMsg,   setErrorMsg]   = useState('');
  const [shake,      setShake]      = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  // Lockout — all state and timer logic lives in the hook
  const { isLocked, lockCountdown, recordFailure, resetFailures } =
    useLoginLock(MAX_ATTEMPTS, LOCKOUT_SECONDS);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  // ── Login handler ──────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLocked || loading) return;

    // ── AnalyticOS password policy: min 8 chars + at least one special symbol
    const { valid, error: pwError } = validatePassword(password);
    if (!valid) {
      setErrorMsg(pwError);
      triggerShake();
      return;
    }

    setErrorMsg('');
    setLoading(true);

    // Security delay — prevents brute-force timing attacks (original comment preserved)
    const securityDelay = new Promise(r => setTimeout(r, 1200));

    try {
      const [data] = await Promise.all([
        authRepository.login(email, password),   // Repository Pattern — no fetch here
        securityDelay,
      ]);

      // ── Success ───────────────────────────────────────────────────────────
      resetFailures();
      setSuccess(true);
      login(data.user);                          // AuthContext owns localStorage write
      setTimeout(() => navigate('/dashboard', { replace: true }), 900);

    } catch (err) {
      // ── Map backend Arabic/English error strings → user-friendly messages ─
      // (exact original mapping — all keyword checks preserved)
      const rawErr = (err.message || '').toLowerCase();
      let friendlyMsg = 'An unexpected error occurred. Please try again.';

      const isWrongPassword =
        rawErr.includes('باسورد') || rawErr.includes('password') ||
        rawErr.includes('غلط')    || rawErr.includes('wrong')    ||
        rawErr.includes('incorrect');

      if (
        rawErr.includes('إيميل') || rawErr.includes('mail') ||
        rawErr.includes('email') || rawErr.includes('not found') ||
        rawErr.includes('مسجل')
      ) {
        friendlyMsg = 'No account found with this email address. Please check and try again.';
      } else if (isWrongPassword) {
        friendlyMsg = 'Incorrect password. Please try again or use "Forgot password".';
      } else if (
        rawErr.includes('disabled') || rawErr.includes('suspended') ||
        rawErr.includes('inactive')
      ) {
        friendlyMsg = 'Your account has been suspended. Please contact IT support.';
      } else if (
        rawErr.includes('server') || rawErr.includes('database') ||
        rawErr.includes('داتا')
      ) {
        friendlyMsg = 'A server error occurred. Please try again in a moment.';
      } else if (rawErr.includes('network') || rawErr.includes('fetch')) {
        friendlyMsg = 'Unable to connect to the server. Please check your network connection and try again.';
      }

      // Only count credential failures toward the lockout — not server errors
      const countsAsFailure =
        isWrongPassword ||
        rawErr.includes('إيميل') || rawErr.includes('mail') ||
        rawErr.includes('not found') || rawErr.includes('مسجل');

      if (countsAsFailure) {
        const { locked, remaining } = recordFailure();
        if (locked) {
          setErrorMsg(`Too many failed attempts. Account locked for ${LOCKOUT_SECONDS} seconds.`);
        } else {
          setErrorMsg(`${friendlyMsg} (${remaining} attempt${remaining > 1 ? 's' : ''} remaining)`);
        }
      } else {
        setErrorMsg(friendlyMsg);
      }

      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <StyleTag />

      {/* Forgot Password Modal — extracted component, same UI as original */}
      {showForgot && (
        <ForgotPasswordModal onClose={() => setShowForgot(false)} />
      )}

      <div className="login-page">

        {/* Background layers */}
        <div className="bg-mesh" />
        <div className="grid-overlay" />

        {/* Floating blobs (exact original props) */}
        <div className="blob" style={{ width:420, height:420, background:'#4f65ff', top:-100,   left:-120,   animation:'floatA 9s ease-in-out infinite'  }} />
        <div className="blob" style={{ width:300, height:300, background:'#7c3aed', bottom:-80,  right:-80,   animation:'floatB 11s ease-in-out infinite' }} />
        <div className="blob" style={{ width:200, height:200, background:'#06b6d4', top:'40%',  right:'15%', animation:'floatC 13s ease-in-out infinite' }} />

        {/* Card */}
        <div className={`login-card ${shake ? 'shake' : ''}`}>

          {/* Logo / Header */}
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <div style={{ width:52, height:52, borderRadius:16, background:'linear-gradient(135deg,#4f65ff,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:'0 8px 24px rgba(79,101,255,0.45)' }}>
              <SVG d={D.chart} size={24} color="white" />
            </div>
            <h1 style={{ fontSize:24, fontWeight:800, color:'#ffffff', letterSpacing:'-0.5px', marginBottom:6 }}>
              Welcome
            </h1>
            <p style={{ fontSize:14, color:'rgba(255,255,255,0.4)', fontWeight:500 }}>
              To Our Dashboard
            </p>
          </div>

          {/* Status messages */}
          {errorMsg && (
            <div className="error-box" style={{ marginBottom:18 }}>
              <SVG d={D.warn} size={15} color="#f87171" />
              {isLocked
                ? `Account locked. Try again in ${lockCountdown}s.`
                : errorMsg}
            </div>
          )}
          {success && (
            <div className="success-box" style={{ marginBottom:18 }}>
              <SVG d={D.check} size={15} color="#34d399" />
              Login successful! Redirecting...
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Email field */}
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.5)', letterSpacing:'0.8px', textTransform:'uppercase', marginBottom:8 }}>
                Email Address
              </label>
              <div style={{ position:'relative' }}>
                <span className="input-icon"><SVG d={D.mail} size={15} /></span>
                <input
                  className="login-input"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="off"
                  disabled={!!isLocked}
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <label style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.5)', letterSpacing:'0.8px', textTransform:'uppercase' }}>
                  Password
                </label>
                <button type="button" className="link-btn" onClick={() => setShowForgot(true)}>
                  Forgot password?
                </button>
              </div>
              <div style={{ position:'relative' }}>
                <span className="input-icon"><SVG d={D.lock} size={15} /></span>
                <input
                  className="login-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  maxLength={64}
                  disabled={!!isLocked}
                  style={{ paddingRight:44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="eye-toggle"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  title={showPass ? 'Hide password' : 'Show password'}
                >
                  <SVG d={showPass ? D.eyeOff : D.eye} size={16} />
                </button>
              </div>
            </div>

            <div className="divider" />

            {/* Submit button */}
            <button
              type="submit"
              className="login-btn"
              disabled={loading || success || !!isLocked}
            >
              {isLocked ? (
                <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                  🔒 Locked — try again in {lockCountdown}s
                </span>
              ) : loading ? (
                <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                  <span className="spinner-sm" /> Signing in...
                </span>
              ) : success ? (
                <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  <SVG d={D.check} size={16} /> Authenticated
                </span>
              ) : 'Sign In →'}
            </button>

          </form>

          {/* Footer */}
          <p style={{ textAlign:'center', fontSize:12, color:'rgba(255,255,255,0.2)', marginTop:24, fontWeight:500 }}>
            Protected by enterprise-grade security
          </p>

        </div>
      </div>
    </>
  );
}
