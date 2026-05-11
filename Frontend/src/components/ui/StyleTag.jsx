// src/components/ui/StyleTag.jsx
//
// Theme architecture:
//   • All CSS variables are defined on :root (dark mode defaults).
//   • Light mode overrides use the :root.light selector.
//   • AuthContext applies/removes the 'light' class on document.documentElement
//     (i.e. <html>) via a useEffect whenever isDark changes.
//   • This component is intentionally stateless and accepts no props — it does
//     NOT need isDark passed in.  All theme switching is DOM-driven.
//
export default function StyleTag() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
      *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }

      :root {
        --bg:        #131d32;
        --bg2:       #192540;
        --surface:   #1e2d48;
        --surface2:  #243554;
        --border:    rgba(140,165,215,0.16);
        --border2:   rgba(140,165,215,0.26);
        --txt:       #e8f0fc;
        --txt2:      #8aaad8;
        --txt3:      #4d6490;
        --sidebar:   linear-gradient(175deg,#0f2048 0%,#1a3a82 100%);
        --topbar:    rgba(19,29,50,0.9);
        --accent:    #5b8fff;
        --accent2:   #9dbeff;
        --modal-bg:  rgba(15, 23, 42, 0.75);
        --card-shadow: 0 4px 20px rgba(0,0,0,0.35);
      }
        /* ── CORE DASHBOARD LAYOUT ── */
      .app-shell {
        display: flex;
        height: 100vh;
        width: 100vw;
        overflow: hidden;
      }
      
      .main-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        height: 100vh;
      }
      
      .content-area {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 24px;
        display: flex;
        flex-direction: column;
        justify-content: flex-start; /* السر هنا: بيجبر المحتوى يبدأ من فوق */
        align-items: stretch;
      }
      /* ── ENTERPRISE LIGHT MODE — high contrast, professional palette ── */
      :root.light {
        /* ── Page background — warm off-white, easy on the eyes ── */
        --bg:        #f6f8fc;
        --bg2:       #edf1f8;

        /* ── Surfaces — clean white with clear depth layers ── */
        --surface:   #ffffff;
        --surface2:  #f0f4fb;

        /* ── Borders — visible but not harsh ── */
        --border:    rgba(30,64,175,0.12);
        --border2:   rgba(30,64,175,0.22);

        /* ── Typography — deep navy for primary, muted slate for secondary ── */
        --txt:       #0c1a35;
        --txt2:      #334e7a;
        --txt3:      #6b85aa;

        /* ── Sidebar keeps the dark navy gradient for contrast ── */
        --sidebar:   linear-gradient(175deg,#0d1f4e 0%,#1b3fa0 100%);
        --topbar:    rgba(246,248,252,0.97);
          
        /* ── Accent — vivid blue, AA-contrast on white ── */
        --accent:    #1d4ed8;
        --accent2:   #3b82f6;

        /* ── Modals & shadows ── */
        --modal-bg:  rgba(8,16,40,0.42);
        --card-shadow: 0 1px 4px rgba(30,64,175,0.07), 0 4px 16px rgba(30,64,175,0.06);
      }
      body { background:var(--bg); font-family:'Plus Jakarta Sans',sans-serif; transition:background .3s; }

      @keyframes fadeUp    { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
      @keyframes shimmer   { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
      @keyframes spin      { to{transform:rotate(360deg)} }
      @keyframes warnPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.25)} 50%{box-shadow:0 0 0 5px rgba(239,68,68,0)} }
      @keyframes cardIn    { from{opacity:0;transform:translateY(10px) scale(0.99)} to{opacity:1;transform:none} }
      @keyframes dotBlink  { 0%,100%{opacity:1} 50%{opacity:0.25} }
      @keyframes branchIn  { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:none} }
      @keyframes aiPulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
      @keyframes msgSlide  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      @keyframes panelSlide{ from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
      @keyframes ticketSlide{ from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }

      /* ── SIDEBAR NAV — visually isolated hover per item ── */
      .nav-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        color: rgba(255,255,255,0.55);
        transition: background 0.15s, color 0.15s, transform 0.12s;
        /* critical: block display so each item is fully independent */
        display: flex;
        position: relative;
        user-select: none;
        /* prevent hover bleeding between items */
        isolation: isolate;
        margin-bottom: 2px;
      }
      .nav-item:hover {
        background: rgba(255,255,255,0.11);
        color: rgba(255,255,255,0.95);
        transform: translateX(2px);
        /* explicit box so the highlight is visually bounded */
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.07);
      }
      :root[dir="rtl"] .nav-item:hover { transform: translateX(-2px); }
      .nav-item.active {
        background: rgba(255,255,255,0.15);
        color: #fff;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12);
      }
      .nav-item:active { transform: scale(0.98); }

      /* ── SIDEBAR RESPONSIVE ── */
      .sidebar-wrap {
        width: 236px;
        background: var(--sidebar);
        display: flex;
        flex-direction: column;
        padding: 22px 14px;
        flex-shrink: 0;
        position: relative;
        overflow: hidden;
        /* Allow scrolling when viewport is short */
        height: 100vh;
        transition: width 0.25s ease, transform 0.25s ease;
      }
      .sidebar-nav {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        /* custom slim scrollbar */
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,0.15) transparent;
      }
      .sidebar-nav::-webkit-scrollbar { width: 3px; }
      .sidebar-nav::-webkit-scrollbar-track { background: transparent; }
      .sidebar-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }

      /* Hamburger toggle button — hidden on desktop */
      .hamburger-btn {
        display: none;
        position: fixed;
        top: 14px;
        left: 14px;
        z-index: 10001;
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: var(--sidebar);
        border: 1px solid rgba(255,255,255,0.15);
        cursor: pointer;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        transition: background 0.2s;
      }
      :root[dir="rtl"] .hamburger-btn { left: auto; right: 14px; }
      .hamburger-btn:hover { background: rgba(79,124,255,0.35); }

      /* Mobile sidebar overlay */
      .sidebar-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.55);
        z-index: 9998;
        backdrop-filter: blur(2px);
        animation: fadeIn 0.2s ease;
      }

      @media (max-width: 768px) {
        .hamburger-btn {
          display: flex;
        }
        .sidebar-wrap {
          position: fixed;
          top: 0;
          left: 0;
          z-index: 9999;
          height: 100vh;
          transform: translateX(-100%);
          box-shadow: 4px 0 32px rgba(0,0,0,0.4);
        }
        :root[dir="rtl"] .sidebar-wrap {
          left: auto;
          right: 0;
          transform: translateX(100%);
        }
        .sidebar-wrap.open {
          transform: translateX(0);
        }
        .sidebar-overlay.open {
          display: block;
        }
        .main-content-area {
          padding-top: 60px !important;
        }
      }

      .profile-card { background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px 22px;animation:cardIn .35s ease both;transition:transform .2s,box-shadow .2s; }
      .profile-card:hover { transform:translateY(-3px);box-shadow:var(--card-shadow); }

      .metric-card { background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px 24px;animation:cardIn .35s ease both;transition:transform .2s,box-shadow .2s;position:relative;overflow:hidden;cursor:pointer; }
      .metric-card:hover { transform:translateY(-2px);box-shadow:var(--card-shadow); }
      .metric-card.warn { background:rgba(239,68,68,0.06);border-color:rgba(239,68,68,0.3);animation:cardIn .35s ease both,warnPulse 2s ease-in-out infinite; }
      .metric-card.warn:hover { box-shadow:0 12px 28px rgba(239,68,68,.15); }
      /* light mode metric card — crisp border & slight lift */
      :root.light .metric-card { border-color:rgba(59,96,180,0.18);box-shadow:0 1px 6px rgba(59,96,180,0.07); }
      :root.light .metric-card:hover { box-shadow:0 6px 24px rgba(30,69,184,0.13); }
      /* light mode warn card — visible red on white */
      :root.light .metric-card.warn { background:rgba(220,38,38,0.06);border-color:rgba(220,38,38,0.3);box-shadow:0 2px 8px rgba(220,38,38,0.1); }
      :root.light .metric-card.warn:hover { box-shadow:0 8px 24px rgba(220,38,38,0.18); }

      .graph-card { background:var(--surface);border:1px solid var(--border);border-radius:18px;overflow:hidden;animation:cardIn .4s ease both;transition:transform .2s,box-shadow .2s,border-color .2s; }
      .graph-card:hover { transform:translateY(-2px);box-shadow:0 12px 36px rgba(0,0,0,.22); }
      .graph-card.clickable { cursor:pointer; }
      .graph-card.clickable:hover { border-color:var(--border2); }
      /* light mode chart card — clear top separator stripe */
      :root.light .graph-card { border-color:rgba(59,96,180,0.16);box-shadow:0 1px 6px rgba(59,96,180,0.06); }
      :root.light .graph-card:hover { box-shadow:0 8px 28px rgba(30,69,184,0.12); }

      .chart-modal-overlay { position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(8,14,30,0.88);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;z-index:10000;animation:fadeIn .2s ease;padding:24px; }
      .chart-modal { background:var(--surface);border:1px solid var(--border2);border-radius:20px;width:100%;max-width:1100px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,.6);animation:cardIn .25s ease both;overflow:hidden; }
      .chart-modal-head { padding:18px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:14px;flex-shrink:0; }
      .chart-modal-body { flex:1;overflow-y:auto;padding:0; }
      .graph-expand-hint { display:flex;align-items:center;gap:4px;padding:4px 9px;border-radius:7px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);transition:all .2s;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif; }
      .graph-card.clickable:hover .graph-expand-hint { background:rgba(79,124,255,0.12);border-color:rgba(79,124,255,0.3);color:#7ca3ff; }

      .stat-pill { display:inline-flex;flex-direction:column;gap:2px;padding:10px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;min-width:90px; }
      .stat-pill-val { font-size:18px;font-weight:800;color:var(--txt);letter-spacing:-0.5px;line-height:1; }
      .stat-pill-label { font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:0.6px; }

      .branch-banner { display:flex;align-items:center;gap:10px;padding:11px 20px;background:linear-gradient(90deg,rgba(79,124,255,0.1) 0%,rgba(79,124,255,0.04) 100%);border:1px solid rgba(79,124,255,0.2);border-radius:12px;animation:branchIn .4s ease;margin-bottom:24px; }
      :root.light .branch-banner { background:linear-gradient(90deg,rgba(37,99,235,0.07) 0%,rgba(37,99,235,0.02) 100%);border-color:rgba(37,99,235,0.18); }

      .badge { display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:700; }

      .logout-btn { display:flex;align-items:center;gap:8px;width:100%;padding:10px 14px;border-radius:10px;background:transparent;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.45);font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;font-family:'Plus Jakarta Sans',sans-serif; }
      .logout-btn:hover { background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.45);color:#fca5a5; }

      .ctrl-btn { flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 10px;border-radius:9px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.09);color:rgba(255,255,255,0.5);font-size:12px;font-weight:700;cursor:pointer;transition:all .2s;font-family:'Plus Jakarta Sans',sans-serif; }
      .ctrl-btn:hover { background:rgba(255,255,255,0.12);color:#fff; }

      .warn-banner { display:flex;align-items:flex-start;gap:10px;margin-top:12px;padding:10px 13px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px; }
      .warn-dot { width:7px;height:7px;border-radius:50%;background:#ef4444;flex-shrink:0;margin-top:5px;animation:dotBlink 1.6s ease-in-out infinite; }
      .warn-text-truncate { display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis;word-break:break-all; }

      .skeleton { background:linear-gradient(90deg,var(--surface2) 25%,var(--border2) 50%,var(--surface2) 75%);background-size:600px 100%;animation:shimmer 1.4s infinite;border-radius:8px; }
      .spinner  { border:2.5px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:spin .75s linear infinite;display:inline-block; }

      .scroll-area::-webkit-scrollbar { width:4px; }
      .scroll-area::-webkit-scrollbar-track { background:transparent; }
      .scroll-area::-webkit-scrollbar-thumb { background:var(--border2);border-radius:3px; }

      .modal-overlay { position:fixed;top:0;left:0;right:0;bottom:0;background:var(--modal-bg);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;z-index:9999;animation:fadeIn .2s ease;padding:20px; }
      .modal-content { background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:800px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 25px 50px -12px rgba(0,0,0,0.4);animation:cardIn .3s ease both; }
      .modal-header  { padding:20px 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center; }
      .modal-body    { padding:24px;overflow-y:auto;flex:1; }
      .close-btn { background:transparent;border:none;color:var(--txt2);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:8px;border-radius:8px;transition:all .2s; }
      .close-btn:hover { background:var(--surface2);color:var(--txt); }

      .data-table { width:100%;border-collapse:collapse;margin-top:10px;font-size:13px; }
      .data-table th { text-align:left;padding:12px;background:var(--surface2);color:var(--txt2);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid var(--border); }
      .data-table td { padding:12px;border-bottom:1px solid var(--border);color:var(--txt);max-width:300px;word-wrap:break-word; }
      :root[dir="rtl"] .data-table th { text-align:right; }
      .data-table tr:last-child td { border-bottom:none; }
      .data-table tr:hover td { background:rgba(255,255,255,0.02); }
      :root.light .data-table tr:hover td { background:rgba(0,0,0,0.02); }

      .it-input { width:100%;padding:12px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--txt);font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;margin-top:6px;outline:none;transition:border .2s; }
      .it-input:focus { border-color:var(--accent); }
      .it-btn { background:var(--accent);color:#fff;border:none;padding:12px 24px;border-radius:10px;font-weight:700;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:opacity .2s;margin-top:16px; }
      .it-btn:hover { opacity:0.9; }
      .it-btn:disabled { opacity:0.5;cursor:not-allowed; }

      /* ═══════════════════════════════════════════════════════════════
         LIGHT MODE — comprehensive overrides for elements with
         hardcoded dark colors
      ═══════════════════════════════════════════════════════════════ */

      /* Main content scrollable area */
      :root.light .main-content-area { background:var(--bg); }

      /* Topbar */
      :root.light .topbar-area { background:var(--topbar);border-bottom-color:var(--border2);box-shadow:0 1px 8px rgba(30,64,175,0.06); }

      /* Chart expand hint button */
      :root.light .graph-expand-hint { background:rgba(30,64,175,0.06);border-color:rgba(30,64,175,0.14);color:var(--txt3); }
      :root.light .graph-card.clickable:hover .graph-expand-hint { background:rgba(29,78,216,0.1);border-color:rgba(29,78,216,0.25);color:var(--accent); }

      /* Chart modal */
      :root.light .chart-modal { background:var(--surface);border-color:var(--border2);box-shadow:0 24px 60px rgba(30,64,175,0.15); }
      :root.light .chart-modal-overlay { background:rgba(12,26,53,0.6); }

      /* AI ask button */
      :root.light .ai-ask-btn { background:rgba(29,78,216,0.08);border-color:rgba(29,78,216,0.2);color:var(--accent); }
      :root.light .ai-ask-btn:hover { background:rgba(29,78,216,0.14); }

      /* Ticket cards */
      :root.light .ticket-card { background:var(--surface);border-color:var(--border);box-shadow:0 1px 4px rgba(30,64,175,0.06); }
      :root.light .ticket-card:hover { box-shadow:0 6px 20px rgba(30,64,175,0.1); }

      /* Product cards */
      :root.light .prod-card { background:var(--surface);border-color:var(--border); }

      /* Warn banner */
      :root.light .warn-banner { background:rgba(220,38,38,0.06);border-color:rgba(220,38,38,0.2); }

      /* Skeleton & spinner */
      :root.light .skeleton { background:linear-gradient(90deg,#e8eef8 25%,#d4dff0 50%,#e8eef8 75%);background-size:600px 100%; }

      /* Inputs */
      :root.light .it-input { background:var(--surface2);border-color:var(--border);color:var(--txt); }
      :root.light .it-input:focus { border-color:var(--accent); }

      /* Nav section label */
      :root.light .nav-section-label { color:rgba(255,255,255,0.4); }

      /* Profile card */
      :root.light .profile-card { background:var(--surface);border-color:var(--border);box-shadow:0 1px 6px rgba(30,64,175,0.07); }

      /* AI panel */
      :root.light .ai-panel { background:var(--surface);border-color:var(--border2);box-shadow:0 8px 32px rgba(30,64,175,0.12); }

      /* Stat pill */
      :root.light .stat-pill { background:var(--surface2);border-color:var(--border); }
      :root.light .stat-pill-val { color:var(--txt); }
      :root.light .stat-pill-label { color:var(--txt3); }

      /* Ctrl buttons (AR / Light / AI) */
      :root.light .ctrl-btn { background:rgba(255,255,255,0.14);border-color:rgba(255,255,255,0.18);color:rgba(255,255,255,0.7); }
      :root.light .ctrl-btn:hover { background:rgba(255,255,255,0.22);color:#fff; }

      /* Category section headers on analytics tab */
      :root.light .cat-section-head { color:var(--txt2); }

      /* Section title underline accent */
      :root.light .section-head-bar { background:linear-gradient(90deg,var(--accent),var(--accent2)); }

      .ticket-card { background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;animation:ticketSlide .35s ease both;transition:transform .2s,box-shadow .2s; }
      .ticket-card:hover { transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,0,0,.22); }
      .ticket-preview { background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:20px;margin-top:12px;animation:fadeIn .25s ease; }
      .ticket-header-strip { height:4px;width:100%;background:linear-gradient(90deg,var(--accent),var(--accent2)); }
      .priority-dot { width:9px;height:9px;border-radius:50%;flex-shrink:0; }
      .it-stat-card { background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px 20px;animation:cardIn .3s ease both; }
      .type-chip { display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;cursor:pointer;transition:all .18s;border:1.5px solid transparent; }
      .type-chip.selected { border-color:var(--accent);background:rgba(79,124,255,0.15);color:var(--accent2); }
      .type-chip:not(.selected) { background:var(--surface2);color:var(--txt2);border-color:var(--border); }
      .type-chip:hover:not(.selected) { border-color:var(--border2);color:var(--txt); }

      .prod-card { background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;transition:transform .18s,box-shadow .18s;animation:cardIn .3s ease both; }
      .prod-card:hover { transform:translateY(-3px);box-shadow:0 12px 28px rgba(0,0,0,.22); }
      .prod-img { width:100%;height:160px;object-fit:contain;background:var(--surface2);padding:10px;display:block; }
      .prod-ph { width:100%;height:160px;background:var(--surface2);display:flex;align-items:center;justify-content:center; }
      .it-sm { width:100%;padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;color:var(--txt);font-family:inherit;font-size:13px;outline:none;margin-top:5px; }
      .it-sm:focus { border-color:var(--accent); }

      .ai-panel { width:380px;min-width:320px;max-width:420px;background:var(--surface);border-left:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;animation:panelSlide .22s ease both;overflow:hidden; }
      .ai-panel-head { padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-shrink:0;background:linear-gradient(135deg,rgba(59,91,255,0.1),rgba(91,143,255,0.04)); }
      .ai-badge { display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase; }
      .ai-messages { flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:16px; }
      .ai-msg { max-width:90%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.65;animation:msgSlide .2s ease both; }
      .ai-msg.user { align-self:flex-end;background:linear-gradient(135deg,#3b5bff,#5b8fff);color:#fff;border-bottom-right-radius:3px; }
      .ai-msg.ai   { align-self:flex-start;background:var(--surface2);color:var(--txt);border:1px solid var(--border);border-bottom-left-radius:3px; }
      .ai-msg.thinking { align-self:flex-start;background:var(--surface2);border:1px solid var(--border);border-bottom-left-radius:3px;display:flex;align-items:center;gap:5px;color:var(--txt3);font-size:12px;font-style:italic;padding:8px 12px; }
      .ai-input-row { padding:12px 14px;border-top:1px solid var(--border);display:flex;gap:8px;flex-shrink:0;background:var(--surface); }
      .ai-input { flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:9px 12px;color:var(--txt);font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;outline:none;resize:none;transition:border .2s;max-height:80px; }
      .ai-input:focus { border-color:var(--accent); }
      .ai-send-btn { background:linear-gradient(135deg,#3b5bff,#5b8fff);border:none;border-radius:10px;padding:9px 14px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .2s;flex-shrink:0;align-self:flex-end; }
      .ai-send-btn:hover { opacity:0.88; }
      .ai-send-btn:disabled { opacity:0.4;cursor:not-allowed; }
      .ai-toggle { display:flex;align-items:center;gap:7px;padding:7px 13px;border-radius:10px;border:1px solid var(--border);background:var(--surface2);cursor:pointer;font-size:12px;font-weight:700;color:var(--txt2);transition:all .2s;font-family:'Plus Jakarta Sans',sans-serif; }
      .ai-toggle.on  { background:rgba(59,91,255,0.12);border-color:rgba(59,91,255,0.35);color:#7ca3ff; }
      .ai-toggle:hover { border-color:var(--border2); }
      .ai-dot { width:6px;height:6px;border-radius:50%;background:#3b5bff;animation:aiPulse 1.4s ease-in-out infinite;flex-shrink:0; }
      .ai-dot.off { background:var(--txt3);animation:none; }
      .ai-ctx-box { margin:10px 14px 0;background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:9px 12px;font-size:11px;color:var(--txt3);line-height:1.5;border-left:3px solid #3b5bff;flex-shrink:0; }
      .ai-ctx-label { font-weight:800;color:var(--txt2);font-size:10px;text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px; }
      .ai-suggested { display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px 0;flex-shrink:0; }
      .ai-chip { padding:4px 11px;border-radius:999px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid rgba(59,91,255,0.3);background:rgba(59,91,255,0.08);color:#7ca3ff;transition:all .18s;white-space:nowrap; }
      .ai-chip:hover { background:rgba(59,91,255,0.2);border-color:rgba(59,91,255,0.55); }
      .ai-ask-btn { display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:rgba(59,91,255,0.1);border:1px solid rgba(59,91,255,0.25);border-radius:7px;cursor:pointer;transition:all .18s;font-size:10px;font-weight:700;color:#7ca3ff; }
      .ai-ask-btn:hover { background:rgba(59,91,255,0.2);border-color:rgba(59,91,255,0.5); }
      .ai-src-item { display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:11px;border:1px solid var(--border);background:var(--surface2);cursor:pointer;transition:all .18s;margin-bottom:8px; }
      .ai-src-item:hover { border-color:rgba(59,91,255,0.4);background:rgba(59,91,255,0.06); }
      .ai-src-item.loaded { border-color:rgba(59,91,255,0.5);background:rgba(59,91,255,0.1); }
    `}</style>
  );
}