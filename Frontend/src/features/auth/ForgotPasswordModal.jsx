/**
 * src/features/auth/ForgotPasswordModal.jsx
 *
 * Extracted from the original Login.jsx forgot-password modal block.
 * UI is bit-for-bit identical to the original — same JSX, same inline styles,
 * same CSS classes (.modal-overlay, .modal-card, .login-input, etc.).
 *
 * Architecture:
 *   - Repository Pattern: uses authRepository.forgotPassword() — zero raw fetch calls.
 *   - Self-contained SVG: defines its own SVG helper + D subset so it has zero
 *     dependency on Icon.jsx's IC object (which is missing the needed paths).
 *
 * Props:
 *   onClose — () => void   called when the modal should be dismissed
 */

import { useState }    from 'react';
import authRepository  from '../../api/authRepository';

// ── Minimal SVG helper (same as original Login.jsx) ───────────────────────────
const SVG = ({ d, size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

// ── Icon paths used by this modal (exact originals from D object) ─────────────
const D = {
  mail:  "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
  warn:  "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  check: "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3",
  close: "M18 6L6 18M6 6l12 12",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ForgotPasswordModal({ onClose }) {
  const [forgotEmail,   setForgotEmail]   = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg,     setForgotMsg]     = useState(null); // { type: 'success'|'error', text: string }

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMsg(null);

    try {
      // Repository Pattern — no fetch() here
      const data = await authRepository.forgotPassword(forgotEmail);
      setForgotMsg({ type: 'success', text: data.message });
      setTimeout(() => {
        onClose();
        setForgotMsg(null);
        setForgotEmail('');
      }, 4000);
    } catch (err) {
      setForgotMsg({
        type: 'error',
        text: err.message || 'Network error. Please try again later.',
      });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    // Exact original modal JSX — structure, classNames, and inline styles unchanged
    <div className="modal-overlay" onClick={() => !forgotLoading && onClose()}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ color:'#fff', fontSize:20, fontWeight:800 }}>Reset Password</h2>
          <button
            onClick={onClose}
            style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer' }}
          >
            <SVG d={D.close} size={20} />
          </button>
        </div>

        {/* Description */}
        <p style={{ color:'rgba(255,255,255,0.6)', fontSize:13, marginBottom:20, lineHeight:1.5 }}>
          Enter your registered email address. We will generate a new secure password and email it directly to you.
        </p>

        {/* Status message */}
        {forgotMsg && (
          <div
            className={forgotMsg.type === 'error' ? 'error-box' : 'success-box'}
            style={{ marginBottom:20 }}
          >
            <SVG d={forgotMsg.type === 'error' ? D.warn : D.check} size={15} />
            {forgotMsg.text}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleForgotPassword}>
          <div style={{ position:'relative', marginBottom:20 }}>
            <span className="input-icon"><SVG d={D.mail} size={15} /></span>
            <input
              className="login-input"
              type="email"
              placeholder="you@company.com"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={forgotLoading || forgotMsg?.type === 'success'}
          >
            {forgotLoading ? (
              <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                <span className="spinner-sm" /> Processing...
              </span>
            ) : 'Send New Password'}
          </button>
        </form>

      </div>
    </div>
  );
}
