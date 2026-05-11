/**
 * ITInboxTab.jsx
 *
 * Ticket inbox for IT department users.
 * Supports period filtering, expand/collapse, unread tracking,
 * reply-by-email, and move-to-history lifecycle.
 *
 * Props
 * ──────────────────────────────────────────────────────────────────────────
 * user              {object}
 * language          {string}
 * tx                {object}
 * inboxTickets      {Array}
 * inboxLoading      {boolean}
 * inboxError        {string|null}
 * inboxPeriod       {string}    'daily'|'weekly'|'monthly'|'yearly'
 * setInboxPeriod    {function}
 * inboxCount        {number|null}
 * readTicketIds     {Set}
 * setReadTicketIds  {function}
 * openedTicketIds   {Set}
 * setOpenedTicketIds {function}
 * inboxView         {string}    'new'|'history'
 * setInboxView      {function}
 * replyState        {object}    keyed by ticket_id: { message, loading, status }
 * setReplyState     {function}
 * expandedTicket    {number|null}
 * setExpandedTicket {function}
 * onReply           {function}  (ticketId, message) → Promise<boolean>
 * onRefresh         {function}  () → void
 * deleteReqState    {object}
 * setDeleteReqState {function}
 */

import Icon, { IC } from '../../components/ui/Icon';

// ── constants ──────────────────────────────────────────────────────────────
const TYPE_COLOR = {
  Urgent:      { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)'   },
  Technical:   { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.3)'   },
  Inquiry:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)'  },
  Billing:     { color: '#ec4899', bg: 'rgba(236,72,153,0.12)',  border: 'rgba(236,72,153,0.3)'  },
  Maintenance: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)'  },
};
const PRI_COLOR = { Critical: '#ef4444', High: '#f97316', Medium: '#f59e0b', Low: '#10b981' };

const PERIOD_OPTIONS = [
  { value: 'daily',   en: 'Today',   ar: 'اليوم',  color: '#4f7cff' },
  { value: 'weekly',  en: 'Weekly',  ar: 'أسبوعي', color: '#10b981' },
  { value: 'monthly', en: 'Monthly', ar: 'شهري',   color: '#8b5cf6' },
  { value: 'yearly',  en: 'Yearly',  ar: 'سنوي',   color: '#f59e0b' },
];

const SectionHead = ({ title }) => (
  <div style={{ marginBottom: 26 }}>
    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.4px' }}>{title}</h1>
    <div style={{ height: 3, width: 44, background: 'linear-gradient(90deg,var(--accent),var(--accent2))', borderRadius: 2, marginTop: 7 }} />
  </div>
);

const fmtTime = (ts, language) => {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return String(ts); }
};

export default function ITInboxTab({
  user,
  language,
  tx,
  inboxTickets,
  inboxLoading,
  inboxError,
  inboxPeriod,
  setInboxPeriod,
  inboxCount,
  readTicketIds,
  setReadTicketIds,
  openedTicketIds,
  setOpenedTicketIds,
  inboxView,
  setInboxView,
  replyState,
  setReplyState,
  expandedTicket,
  setExpandedTicket,
  onReply,
  onRefresh,
  deleteReqState,
  setDeleteReqState,
}) {
  const isAr = language === 'ar';

  // ── Ticket lifecycle helpers ───────────────────────────────────────────
  const markAsOpened = (ticketId) => {
    if (openedTicketIds.has(ticketId)) return;
    const updated = new Set(openedTicketIds);
    updated.add(ticketId);
    setOpenedTicketIds(updated);
    sessionStorage.setItem('openedTickets', JSON.stringify([...updated]));
  };

  const markAsReplied = (ticketId) => {
    if (readTicketIds.has(ticketId)) return;
    const updated = new Set(readTicketIds);
    updated.add(ticketId);
    setReadTicketIds(updated);
    localStorage.setItem('readTickets', JSON.stringify([...updated]));
  };

  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
  const isOldTicket   = (t) => { try { return new Date(t.time) < todayMidnight; } catch { return false; } };
  const hasAdminReply = (t) => !!(t.description?.includes('[Admin Reply') || t.description?.includes('[IT Reply'));

  const newTickets     = inboxTickets.filter(t => !readTicketIds.has(t.ticket_id) && !isOldTicket(t) && !hasAdminReply(t));
  const historyTickets = inboxTickets.filter(t =>  readTicketIds.has(t.ticket_id) || isOldTicket(t) || hasAdminReply(t));
  const displayTickets = inboxView === 'history' ? historyTickets : newTickets;

  // ── Handle reply ──────────────────────────────────────────────────────
  const handleReply = async (ticketId) => {
    const rs = replyState[ticketId];
    if (!rs?.message?.trim() || rs.loading) return;
    setReplyState(prev => ({ ...prev, [ticketId]: { ...prev[ticketId], loading: true, status: null } }));
    const success = await onReply(ticketId, rs.message.trim());
    if (success) {
      setReplyState(prev => ({ ...prev, [ticketId]: { ...prev[ticketId], loading: false, status: { type: 'success', msg: isAr ? 'تم إرسال الرد بنجاح.' : 'Reply sent successfully.' } } }));
      markAsReplied(ticketId);
    } else {
      setReplyState(prev => ({ ...prev, [ticketId]: { ...prev[ticketId], loading: false, status: { type: 'error', msg: isAr ? 'فشل الإرسال.' : 'Failed to send reply.' } } }));
    }
  };

  // ── Ticket card ───────────────────────────────────────────────────────
  const renderTicketCard = (ticket, i) => {
    const tc        = TYPE_COLOR[ticket.type] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' };
    const priColor  = PRI_COLOR[ticket.priority] || '#94a3b8';
    const isExpanded = expandedTicket === ticket.ticket_id;
    const isOpened   = openedTicketIds.has(ticket.ticket_id);
    const isRead     = readTicketIds.has(ticket.ticket_id);
    const reply      = replyState[ticket.ticket_id] || { message: '', loading: false, status: null };
    const delState   = deleteReqState?.[ticket.ticket_id] || {};

    const handleExpand = () => {
      const opening = !isExpanded;
      setExpandedTicket(opening ? ticket.ticket_id : null);
      if (opening) markAsOpened(ticket.ticket_id);
    };

    return (
      <div key={ticket.ticket_id} className="ticket-card"
        style={{ animationDelay: `${i * 0.03}s`, opacity: isOpened && inboxView === 'new' ? 0.85 : 1 }}>
        <div style={{ height: 3, background: `linear-gradient(90deg,${tc.color},${tc.color}44)` }} />

        {/* ── Header row ── */}
        <div style={{ padding: '14px 20px', cursor: 'pointer' }} onClick={handleExpand}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', letterSpacing: '1px' }}>#{ticket.ticket_id}</span>
            <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
              {ticket.type}
            </span>
            {ticket.priority && (
              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: `${priColor}15`, color: priColor, border: `1px solid ${priColor}40` }}>
                ⚡ {ticket.priority}
              </span>
            )}
            {!isOpened && !isRead && (
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', boxShadow: '0 0 6px rgba(239,68,68,0.6)', flexShrink: 0 }} />
            )}
            {reply.status?.type === 'success' && (
              <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.28)' }}>
                ✓ {isAr ? 'تم الرد' : 'Replied'}
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--txt3)' }}>{fmtTime(ticket.time, language)}</span>
            <Icon d={isExpanded ? IC.close : IC.graphs} size={13} color="var(--txt3)" />
          </div>

          {ticket.emp_name && (
            <div style={{ fontSize: 12, color: 'var(--txt2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon d={IC.user} size={11} color="var(--txt3)" />
              <strong style={{ color: 'var(--txt)' }}>{ticket.emp_name}</strong>
              {ticket.emp_email && <span style={{ color: 'var(--txt3)' }}>· {ticket.emp_email}</span>}
            </div>
          )}
        </div>

        {/* ── Expanded body ── */}
        {isExpanded && (
          <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
            {/* Description */}
            {ticket.description && (
              <div style={{ padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10, marginBottom: 16, marginTop: 14, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
                  {isAr ? 'التفاصيل' : 'Description'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{ticket.description}</div>
              </div>
            )}

            {/* Reply box */}
            {!isRead && !reply.status?.type === 'success' && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
                  {isAr ? 'ردّ بالبريد الإلكتروني' : 'Reply via Email'}
                </div>
                <textarea
                  rows={3}
                  className="it-input"
                  style={{ resize: 'vertical', marginBottom: 10 }}
                  placeholder={isAr ? 'اكتب ردّك...' : 'Write your reply...'}
                  value={reply.message || ''}
                  disabled={reply.loading}
                  onChange={e => setReplyState(prev => ({ ...prev, [ticket.ticket_id]: { ...prev[ticket.ticket_id], message: e.target.value } }))}
                />
                {reply.status && (
                  <div style={{ marginBottom: 10, padding: '9px 13px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                    background: reply.status.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.08)',
                    color: reply.status.type === 'error' ? '#ef4444' : '#10b981',
                    border: `1px solid ${reply.status.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)'}` }}>
                    {reply.status.msg}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => handleReply(ticket.ticket_id)} disabled={reply.loading || !reply.message?.trim()} className="it-btn"
                    style={{ flex: 2, marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                    {reply.loading
                      ? <><span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />{isAr ? 'جاري الإرسال...' : 'Sending...'}</>
                      : <><Icon d={IC.mail} size={13} />{isAr ? 'إرسال الرد' : 'Send Reply'}</>}
                  </button>
                </div>
              </div>
            )}

            {/* Already replied badge */}
            {(isRead || reply.status?.type === 'success') && (
              <div style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', fontSize: 12, fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Icon d={IC.check} size={13} color="#10b981" />{isAr ? 'تمت الإجابة على هذه التذكرة.' : 'This ticket has been replied to.'}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      <SectionHead title={tx.ticketInbox || 'IT Inbox'} />

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PERIOD_OPTIONS.map(p => (
            <button key={p.value} onClick={() => { setInboxPeriod(p.value); onRefresh(p.value); }} style={{
              padding: '9px 16px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12, transition: 'all .18s',
              background: inboxPeriod === p.value ? `${p.color}18` : 'var(--surface)',
              border: `1.5px solid ${inboxPeriod === p.value ? p.color + '55' : 'var(--border)'}`,
              color: inboxPeriod === p.value ? p.color : 'var(--txt2)',
            }}>
              {isAr ? p.ar : p.en}
            </button>
          ))}
        </div>
        <button onClick={() => onRefresh(inboxPeriod)} style={{
          marginLeft: 'auto', padding: '9px 16px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)',
          color: 'var(--txt2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {inboxLoading ? <span className="spinner" style={{ width: 11, height: 11 }} /> : '↻'} {isAr ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* New / History toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { id: 'new',     label: isAr ? `جديد (${newTickets.length})`     : `New (${newTickets.length})`,     color: '#ef4444' },
          { id: 'history', label: isAr ? `السجل (${historyTickets.length})` : `History (${historyTickets.length})`, color: '#94a3b8' },
        ].map(v => (
          <button key={v.id} onClick={() => setInboxView(v.id)} style={{
            padding: '9px 20px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, transition: 'all .18s',
            background: inboxView === v.id ? `${v.color}15` : 'transparent',
            border: `1.5px solid ${inboxView === v.id ? v.color + '50' : 'var(--border)'}`,
            color: inboxView === v.id ? v.color : 'var(--txt3)',
          }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {inboxError && (
        <div style={{ padding: '14px 18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#ef4444', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          <Icon d={IC.warn} size={14} /> {inboxError}
        </div>
      )}

      {inboxLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 0', color: 'var(--txt3)', fontSize: 14 }}>
          <span className="spinner" style={{ width: 18, height: 18 }} />
          {isAr ? 'جاري تحميل التذاكر...' : 'Loading tickets...'}
        </div>
      )}

      {!inboxLoading && !inboxError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {displayTickets.length === 0 ? (
            <div style={{ padding: '52px', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16 }}>
              <Icon d={IC.check} size={32} color="var(--border2)" style={{ margin: '0 auto 14px', display: 'block' }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt3)', marginBottom: 6 }}>
                {inboxView === 'new' ? (isAr ? 'لا توجد تذاكر جديدة' : 'No new tickets') : (isAr ? 'لا يوجد سجل' : 'No history yet')}
              </div>
              <div style={{ fontSize: 13, color: 'var(--txt3)' }}>
                {isAr ? 'جميع التذاكر في الوقت الحالي معالَجة.' : 'All tickets for this period have been handled.'}
              </div>
            </div>
          ) : (
            displayTickets.map((ticket, i) => renderTicketCard(ticket, i))
          )}
        </div>
      )}
    </div>
  );
}
