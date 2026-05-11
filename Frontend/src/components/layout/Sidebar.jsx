/**
 * Sidebar.jsx — Layout Component (refactored to config-based RBAC nav)
 *
 * CHANGE FROM v1 → v2:
 *   The original sidebar rendered nav items with ~14 separate `{condition && <div>}`
 *   JSX blocks.  Changing access rules meant hunting through JSX.
 *
 *   v2 imports TAB_CONFIG from `../../config/tabsConfig` and iterates it.
 *   Adding a new tab = one object in tabsConfig.js.  Zero JSX changes here.
 *
 * ─── RBAC ─────────────────────────────────────────────────────────────────────
 *
 *   All access rules live exclusively in tabsConfig.js.
 *   This component calls getVisibleTabs(auth) and renders whatever comes back.
 *   The sidebar is 100% RBAC-driven — no hardcoded role checks here.
 *
 * ─── Props ────────────────────────────────────────────────────────────────────
 *
 *   activeTab     {string}   — currently active tab key
 *   setActiveTab  {Function} — setter (already closes sidebar from Dashboard caller)
 *   sidebarOpen   {boolean}
 *   setSidebarOpen{Function}
 *   tx            {object}   — translation strings from useTranslation() in parent
 *   inboxCount    {number}   — unread IT ticket count (badge on it_inbox nav item)
 */

import { useState }      from 'react';
import { useAuth }       from '../../context/AuthContext';
import Icon, { IC }      from '../ui/Icon';
import { TAB_CONFIG, resolveLabel } from '../../config/tabsConfig';

// ── Component ────────────────────────────────────────────────────────────────
export default function Sidebar({
  activeTab,
  setActiveTab,
  sidebarOpen,
  setSidebarOpen,
  tx,
  inboxCount = 0,             // surfaced from ITDashboardStrategy via Dashboard
}) {
  const auth = useAuth();
  const {
    user,
    logout,
    isDark,    toggleTheme,
    language,  toggleLanguage,
    aiEnabled, toggleAi,
    isIT,
    isSalesManager,
    isPRManager,
  } = auth;

  // ── AI-disabled toast ─────────────────────────────────────────────────────
  const [aiDisabledNotif, setAiDisabledNotif] = useState(false);

  // ── Role meta — badge colours + label in the user card ───────────────────
  const isOwner = user?.id === 91949;
  const roleMeta = (() => {
    if (!user) return {};
    if (isOwner)                     return { label: 'Owner',                     bg: 'rgba(239,68,68,0.12)',  color: '#f87171', border: 'rgba(239,68,68,0.3)'  };
    if (user.role === 'dep_manager') return { label: tx?.manager  ?? 'Manager',   bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: 'rgba(251,191,36,0.3)' };
    if (user.role === 'leader')      return { label: tx?.leader   ?? 'Leader',    bg: 'rgba(167,139,250,0.12)',color: '#a78bfa', border: 'rgba(167,139,250,0.3)' };
    return                                  { label: tx?.emp      ?? 'Employee',  bg: 'rgba(52,211,153,0.12)',  color: '#34d399', border: 'rgba(52,211,153,0.3)'  };
  })();

  // ── Helpers ───────────────────────────────────────────────────────────────
  const nav = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem('aiChatSessions');
    window.location.replace('/');
  };

  const handleToggleAI = () => {
    const next = !aiEnabled;
    toggleAi();
    if (!next && activeTab === 'ai') {
      setActiveTab('profile');
      setAiDisabledNotif(true);
      setTimeout(() => setAiDisabledNotif(false), 3500);
    }
  };

  // ── RBAC: resolve which tabs this user can see ────────────────────────────
  // getVisibleTabs is called inline so it always reflects fresh auth state.
  const visibleTabs = TAB_CONFIG.filter(t => t.condition(auth));

  if (!user) return null;

  return (
    <>
      {/* ── Hamburger (mobile only) ─────────────────────────────────────── */}
      <button
        className="hamburger-btn"
        onClick={() => setSidebarOpen(o => !o)}
        aria-label="Toggle navigation menu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          {sidebarOpen
            ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
            : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
          }
        </svg>
      </button>

      {/* ── Mobile overlay backdrop ─────────────────────────────────────── */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`sidebar-wrap ${sidebarOpen ? 'open' : ''}`}>

        {/* Decorative circles */}
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', top: -50, right: -50, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.025)', bottom: 60, left: -40, pointerEvents: 'none' }} />

        {/* ── Brand ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 18 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.25)' }}>
            <Icon d={IC.chart} size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>AnalyticOS</div>
          </div>
        </div>

        {/* ── User info card ───────────────────────────────────────────────── */}
        <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 13, padding: '13px 14px', marginBottom: 18 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <Icon d={IC.user} size={18} color="rgba(255,255,255,0.85)" />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
            {user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim()}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </div>
          <div style={{
            marginTop: 9, display: 'inline-flex', padding: '3px 10px', borderRadius: 999,
            fontSize: 11, fontWeight: 700,
            background: roleMeta.bg, color: roleMeta.color, border: `1px solid ${roleMeta.border}`,
          }}>
            {roleMeta.label}
          </div>
        </div>

        {/* ── Section label ────────────────────────────────────────────────── */}
        <div style={{ fontSize: 9, letterSpacing: '1.8px', color: 'rgba(255,255,255,0.25)', fontWeight: 700, textTransform: 'uppercase', padding: '0 6px', marginBottom: 8 }}>
          Menu
        </div>

        {/* ════════════════════════════════════════════════════════════════════
         * CONFIG-DRIVEN NAV — iterates TAB_CONFIG, no hardcoded role checks.
         *
         * Each tab descriptor provides:
         *   key       → activeTab string + nav() call
         *   icon      → left-side icon (uses IC path constants)
         *   label     → resolved via resolveLabel(tab, auth, language)
         *   labelAlt  → optional managerial override (resolved in resolveLabel)
         *   condition → evaluated in .filter() above; never re-evaluated here
         *   badge     → 'it_inbox' badge count wired to inboxCount prop
         *
         * ════════════════════════════════════════════════════════════════════ */}
        <nav className="sidebar-nav">
          {visibleTabs.map(tab => {
            const isActive = activeTab === tab.key;
            const label    = resolveLabel(tab, auth, language);

            // Determine badge value — only it_inbox has a live count for now
            const badgeVal = tab.key === 'it_inbox' && inboxCount > 0 ? inboxCount : null;

            // Accent icon colour for the AI tab
            const iconColor = tab.key === 'ai' && isActive ? '#7ca3ff' : 'currentColor';

            return (
              <div
                key={tab.key}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => nav(tab.key)}
                style={{ position: 'relative' }}
              >
                <Icon d={tab.icon} size={15} color={iconColor} />
                <span style={{ flex: 1 }}>{label}</span>

                {/* Badge (e.g. unread ticket count) */}
                {badgeVal !== null && (
                  <span style={{
                    fontSize: 10, fontWeight: 800,
                    background: 'rgba(239,68,68,0.2)', color: '#fca5a5',
                    border: '1px solid rgba(239,68,68,0.3)',
                    padding: '1px 7px', borderRadius: 999, marginLeft: 'auto',
                  }}>
                    {badgeVal}
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── Bottom controls ──────────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Language toggle */}
            <button className="ctrl-btn" onClick={toggleLanguage}>
              <Icon d={IC.globe} size={12} />
              {language === 'ar' ? 'EN' : 'AR'}
            </button>

            {/* Theme toggle */}
            <button className="ctrl-btn" onClick={toggleTheme}>
              <Icon d={isDark ? IC.sun : IC.moon} size={12} />
              {isDark ? (tx?.lightMode ?? 'Light') : (tx?.darkMode ?? 'Dark')}
            </button>

            {/* AI toggle — non-IT users only */}
            {!isIT && (
              <button className="ctrl-btn" onClick={handleToggleAI}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: aiEnabled ? '#22c55e' : '#ef4444',
                  display: 'inline-block', flexShrink: 0,
                  boxShadow: aiEnabled ? '0 0 5px #22c55e' : '0 0 5px #ef4444',
                }} />
                AI
              </button>
            )}
          </div>

          {/* Logout */}
          <button className="logout-btn" onClick={handleLogout}>
            <Icon d={IC.logout} size={14} />
            {tx?.logout ?? 'Log Out'}
          </button>
        </div>

        {/* ── AI disabled toast ────────────────────────────────────────────── */}
        {aiDisabledNotif && (
          <div style={{
            position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(30,30,50,0.97)', border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 12, padding: '12px 22px',
            display: 'flex', alignItems: 'center', gap: 10,
            zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'fadeUp 0.3s ease',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', boxShadow: '0 0 6px #ef4444' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
              {language === 'ar' ? 'المساعد الذكي غير متاح حالياً' : 'AI Assistant is currently disabled'}
            </span>
          </div>
        )}
      </aside>
    </>
  );
}
