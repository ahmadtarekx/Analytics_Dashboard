/**
 * Topbar.jsx — Layout Component (extracted from Dashboard.jsx)
 *
 * Renders two zones:
 *
 *   1. Sticky header bar (backdrop-blur, department badge, role badge)
 *      — Original location: Dashboard.jsx ~line 1900–1937
 *
 *   2. Branch context banner (below the header, inside the content area)
 *      — Original location: Dashboard.jsx ~line 1938–1972
 *      — Conditionally rendered: hidden on 'profile', 'it_tools', and for managers
 *
 * All user/role/theme data comes from AuthContext (Observer Pattern).
 * The parent (Dashboard.jsx) passes `onMenuClick`, `onLogout`, `tx`, `activeTab`.
 */

import { useAuth }     from '../../context/AuthContext';
import Icon, { IC }    from '../ui/Icon';

// ── Component ────────────────────────────────────────────────────────────────
export default function Topbar({
  onMenuClick,   // () => void — toggles mobile sidebar
  onLogout,      // () => void — called by logout button if rendered here
  tx,            // translation strings from useTranslation()
  activeTab,     // string — currently active tab (used for branch banner logic)
}) {
  const {
    user,
    language,
    isOwner,
    isManager,
  } = useAuth();

  if (!user) return null;

  // ── Role meta (badge colours + label) ────────────────────────────────────
  const roleMeta = (() => {
    if (isOwner)                     return { label: 'Owner',                 bg: 'rgba(239,68,68,0.12)',  color: '#f87171', border: 'rgba(239,68,68,0.3)' };
    if (user.role === 'dep_manager') return { label: tx?.manager ?? 'Manager', bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: 'rgba(251,191,36,0.3)' };
    if (user.role === 'leader')      return { label: tx?.leader  ?? 'Leader',  bg: 'rgba(167,139,250,0.12)',color: '#a78bfa', border: 'rgba(167,139,250,0.3)' };
    return { label: tx?.emp ?? 'Employee', bg: 'rgba(52,211,153,0.12)', color: '#34d399', border: 'rgba(52,211,153,0.3)' };
  })();

  // ── Branch banner visibility ──────────────────────────────────────────────
  // Mirrors original Dashboard.jsx logic:
  //   showBranch = user && user.role !== 'dep_manager'
  //   Hidden on: 'it_tools', 'profile' tabs
  const showBranchBanner =
    user.role !== 'dep_manager' &&
    !isOwner &&
    activeTab !== 'it_tools' &&
    activeTab !== 'profile';

  // ── Resolved user display name ────────────────────────────────────────────
  const displayName = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim();

  return (
    <>
      {/* ── 1. Sticky header bar ──────────────────────────────────────────── */}
      <div style={{
        background: 'var(--topbar)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        flexShrink: 0,
      }}>
        {/* Left: welcome + name */}
        <div>
          <div style={{
            fontSize: 11, color: 'var(--txt3)', fontWeight: 600,
            letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 2,
          }}>
            {tx?.welcome ?? 'Welcome back,'}
          </div>
          <div style={{
            fontSize: 20, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.4px',
          }}>
            {displayName}
          </div>
        </div>

        {/* Right: department + role badges */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          flexWrap: 'wrap', justifyContent: 'flex-end',
        }}>
          <span className="badge" style={{
            background: 'rgba(79,124,255,0.12)',
            color: 'var(--accent2)',
            border: '1px solid rgba(79,124,255,0.22)',
          }}>
            🏢 {(user.department_name || tx?.unspecified || 'Unspecified').toUpperCase()}
          </span>
          <span className="badge" style={{
            background: roleMeta.bg,
            color: roleMeta.color,
            border: `1px solid ${roleMeta.border}`,
          }}>
            {roleMeta.label}
          </span>
        </div>
      </div>

      {/* ── 2. Branch context banner ──────────────────────────────────────── */}
      {showBranchBanner && (
        <div className="branch-banner">
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'rgba(79,124,255,0.15)', border: '1px solid rgba(79,124,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon d={IC.pin} size={15} color="var(--accent2)" />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '1px',
              textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 3,
            }}>
              {tx?.yourBranch ?? 'Your Branch'}
            </div>
            <div style={{
              fontSize: 14, fontWeight: 700, color: 'var(--txt)',
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            }}>
              {/* Primary branch */}
              <span>{user.primary_branch || tx?.unspecified || 'Unspecified'}</span>
              <span style={{
                fontSize: 11, color: 'var(--txt3)',
                background: 'var(--surface2)', padding: '2px 8px',
                borderRadius: 6, border: '1px solid var(--border)',
              }}>
                {tx?.branchNum ?? '#'} {user.branch_id}
              </span>

              {/* Secondary branch — only shown if assigned */}
              {user.secondary_branch_id && (
                <>
                  <span style={{ color: 'var(--txt3)', fontSize: 12 }}>
                    {tx?.and ?? '&'}
                  </span>
                  <span>{user.secondary_branch || tx?.unspecified || 'Unspecified'}</span>
                  <span style={{
                    fontSize: 11, color: 'var(--txt3)',
                    background: 'var(--surface2)', padding: '2px 8px',
                    borderRadius: 6, border: '1px solid var(--border)',
                  }}>
                    {tx?.branchNum ?? '#'} {user.secondary_branch_id}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
