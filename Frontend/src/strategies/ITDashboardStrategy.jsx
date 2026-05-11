/**
 * ITDashboardStrategy.jsx — Strategy Pattern
 *
 * Owns ALL state and UI for the IT department.
 * The backend returns {} for dept 6 on /api/dashboard, so IT users have
 * NO analytics dashboard — only two operational tabs:
 *
 *   it_tools  — ticket dispatch, employee lookup / edit-info / email change /
 *               branch reassignment, and product staging (it_products)
 *   it_inbox  — read and reply to incoming support tickets from all departments
 *
 * Repositories used:
 *   itRepository      — all IT-specific PATCH / GET / POST calls
 *   ticketRepository  — ticket deletion requests (requires PR Manager approval)
 *   productRepository — product staging (add / delete; requires Inventory approval)
 *
 * All raw fetch() calls from the original Dashboard.jsx have been replaced
 * with the appropriate repository methods.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth }          from '../context/AuthContext';
import { useTranslation }   from '../hooks/useTranslation';
import itRepository         from '../api/itRepository';
import ticketRepository     from '../api/ticketRepository';
import productRepository    from '../api/productRepository';
import Icon, { IC, FastInput, FastTextArea } from '../components/ui/Icon';

// ── Shared section header ─────────────────────────────────────────────────────
const SectionHead = ({ title }) => (
  <div style={{ marginBottom: 26 }}>
    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.4px' }}>{title}</h1>
    <div style={{ height: 3, width: 44, background: 'linear-gradient(90deg,var(--accent),var(--accent2))', borderRadius: 2, marginTop: 7 }} />
  </div>
);

export default function ITDashboardStrategy({ activeTab }) {
  const { user, isDark, language } = useAuth();
  const tx = useTranslation(language);

  // ── IT Tools state ────────────────────────────────────────────────────────
  const [activeTool,         setActiveTool]         = useState('ticket');
  const [itTicketType,       setItTicketType]       = useState('Password Reset');
  const [itDescription,      setItDescription]      = useState('');
  const itDescRef                                   = useRef(null);
  const [itStatus,           setItStatus]           = useState(null);
  const [isSubmitting,       setIsSubmitting]       = useState(false);
  const [itPriority,         setItPriority]         = useState('Medium');
  const [showTicketPreview,  setShowTicketPreview]  = useState(false);

  // Employee lookup (shared across all IT tool panels)
  const [lookupId,           setLookupId]           = useState('');
  const [lookedUpEmp,        setLookedUpEmp]        = useState(null);
  const [lookupLoading,      setLookupLoading]      = useState(false);
  const [lookupError,        setLookupError]        = useState(null);

  // Edit Info
  const [editFirst,          setEditFirst]          = useState('');
  const [editLast,           setEditLast]           = useState('');
  const [editPhone,          setEditPhone]          = useState('');
  const [editAddress,        setEditAddress]        = useState('');
  const [editInfoStatus,     setEditInfoStatus]     = useState(null);
  const [editInfoLoading,    setEditInfoLoading]    = useState(false);

  // Change Email
  const [newEmail,           setNewEmail]           = useState('');
  const [emailChangeStatus,  setEmailChangeStatus]  = useState(null);
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);

  // Branch Reassignment
  const [branches,           setBranches]           = useState([]);
  const [newBranchId,        setNewBranchId]        = useState('');
  const [newSecBranchId,     setNewSecBranchId]     = useState('');
  const [branchStatus,       setBranchStatus]       = useState(null);
  const [branchLoading,      setBranchLoading]      = useState(false);

  // IT Inbox state
  const [inboxTickets,       setInboxTickets]       = useState([]);
  const [inboxLoading,       setInboxLoading]       = useState(false);
  const [inboxError,         setInboxError]         = useState(null);
  const [inboxPeriod,        setInboxPeriod]        = useState('daily');
  const [inboxCount,         setInboxCount]         = useState(null);
  const [inboxView,          setInboxView]          = useState('new');
  const [expandedTicket,     setExpandedTicket]     = useState(null);
  const [replyState,         setReplyState]         = useState({});
  const [deleteReqState,     setDeleteReqState]     = useState({});

  // readTicketIds   = replied tickets → move to History
  // openedTicketIds = viewed but not replied → stay in New (dot removed)
  const [readTicketIds, setReadTicketIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('readTickets') || '[]')); }
    catch { return new Set(); }
  });
  const [openedTicketIds, setOpenedTicketIds] = useState(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem('openedTickets') || '[]')); }
    catch { return new Set(); }
  });

  // Products (IT product staging)
  const [products,           setProducts]           = useState([]);
  const [productsLoading,    setProductsLoading]    = useState(false);
  const [productStatus,      setProductStatus]      = useState(null);
  const [productActLoading,  setProductActLoading]  = useState(false);
  const [newProd,            setNewProd]            = useState({
    product_id: '', name: '', type: '', model: '',
    price_before_profit: '', price_after_profit: '', amount_avail: '', image: '',
  });

  // ── Data loaders ──────────────────────────────────────────────────────────
  const loadBranches = useCallback(async () => {
    try {
      const data = await itRepository.getBranches();
      setBranches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[ITStrategy] loadBranches:', err.message);
    }
  }, []);

  const loadInboxTickets = useCallback(async (period) => {
    setInboxLoading(true); setInboxError(null);
    try {
      const data = await itRepository.getTicketsInbox({ period });
      setInboxTickets(data.tickets || []);
      setInboxCount(data.count ?? null);
    } catch (err) {
      setInboxError(err.message || 'Failed to load tickets.');
    } finally {
      setInboxLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const data = await productRepository.getProducts();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[ITStrategy] loadProducts:', err.message);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'it_tools') loadBranches();
    if (activeTab === 'it_inbox') loadInboxTickets(inboxPeriod);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'it_inbox') loadInboxTickets(inboxPeriod);
  }, [inboxPeriod]);

  useEffect(() => {
    if (activeTab === 'it_tools' && activeTool === 'it_products') loadProducts();
  }, [activeTool]);

  // ── Employee lookup ───────────────────────────────────────────────────────
  const lookupEmployee = async (id) => {
    const empId = parseInt(id);
    if (!empId || empId <= 0) return;
    setLookupLoading(true); setLookupError(null); setLookedUpEmp(null);
    try {
      const data = await itRepository.getEmployee(empId);
      setLookedUpEmp(data);
      setEditFirst(data.first_name || '');
      setEditLast(data.last_name || '');
      setEditPhone(data.phone || '');
      setEditAddress(data.address || '');
      setNewBranchId(data.branch_id ? String(data.branch_id) : '');
      setNewSecBranchId(data.secondary_branch_id ? String(data.secondary_branch_id) : '');
      setNewEmail('');
    } catch (err) {
      setLookupError(err.message);
    } finally {
      setLookupLoading(false);
    }
  };

  // ── Generic staged PATCH helper (info / email / branch) ──────────────────
  const itPatch = async (repoCall, setStatus, setLoading) => {
    setLoading(true); setStatus(null);
    try {
      const data = await repoCall();
      setStatus({ type: 'success', msg: data.message });
      if (lookedUpEmp?.id) await lookupEmployee(lookedUpEmp.id); // refresh card
    } catch (err) {
      setStatus({ type: 'error', msg: err.message || 'Network error.' });
    } finally {
      setLoading(false);
    }
  };

  // ── Force password reset ──────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!lookedUpEmp) return;
    setEditInfoStatus(null);
    try {
      const data = await itRepository.resetPassword(lookedUpEmp.id);
      setEditInfoStatus({
        type: 'success',
        msg: `${data.message}  Temp password: ${data.temp_password}`,
      });
    } catch (err) {
      setEditInfoStatus({ type: 'error', msg: err.message });
    }
  };

  // ── Ticket reply ──────────────────────────────────────────────────────────
  // Returns true on success (caller will call markAsReplied).
  const sendTicketReply = async (ticketId) => {
    const msg = replyState[ticketId]?.message?.trim();
    if (!msg) return false;
    setReplyState(prev => ({ ...prev, [ticketId]: { ...prev[ticketId], loading: true, status: null } }));
    try {
      const data = await itRepository.replyTicket({
        ticket_id:     ticketId,
        reply_message: msg,
        it_emp_id:     user?.id,
      });
      setReplyState(prev => ({
        ...prev,
        [ticketId]: { message: '', loading: false, status: { type: 'success', msg: data.message } },
      }));
      return true;
    } catch (err) {
      setReplyState(prev => ({
        ...prev,
        [ticketId]: { ...prev[ticketId], loading: false, status: { type: 'error', msg: err.message } },
      }));
      return false;
    }
  };

  // ── Ticket deletion request (requires PR Manager approval) ────────────────
  const requestITDelete = async (ticketId) => {
    const reason = deleteReqState[ticketId]?.reason?.trim();
    if (!reason) return;
    setDeleteReqState(prev => ({ ...prev, [ticketId]: { ...prev[ticketId], loading: true, status: null } }));
    try {
      const data = await ticketRepository.requestTicketDeletion(ticketId, {
        it_emp_id: user?.id,
        reason,
      });
      setDeleteReqState(prev => ({
        ...prev,
        [ticketId]: { open: false, reason: '', loading: false, status: { type: 'success', msg: data.message } },
      }));
    } catch (err) {
      setDeleteReqState(prev => ({
        ...prev,
        [ticketId]: { ...prev[ticketId], loading: false, status: { type: 'error', msg: err.message } },
      }));
    }
  };

  // ── Inbox lifecycle helpers ───────────────────────────────────────────────
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
    setInboxCount(prev => (prev !== null && prev > 0) ? prev - 1 : 0);
  };

  // ── Derived ticket buckets ────────────────────────────────────────────────
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
  const isOldTicket   = (t) => { try { return new Date(t.time) < todayMidnight; } catch { return false; } };
  const hasAdminReply = (t) => !!(t.description?.includes('[Admin Reply') || t.description?.includes('[IT Reply'));

  const newTickets     = inboxTickets.filter(t => !readTicketIds.has(t.ticket_id) && !isOldTicket(t) && !hasAdminReply(t));
  const historyTickets = inboxTickets.filter(t =>  readTicketIds.has(t.ticket_id) || isOldTicket(t) || hasAdminReply(t));
  const displayTickets = inboxView === 'history' ? historyTickets : newTickets;

  // ── Shared Status Banner ──────────────────────────────────────────────────
  const StatusBanner = ({ status }) => !status ? null : (
    <div style={{
      padding: '11px 15px', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 14,
      display: 'flex', alignItems: 'flex-start', gap: 9,
      background: status.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.08)',
      color: status.type === 'error' ? '#ef4444' : '#10b981',
      border: `1px solid ${status.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)'}`,
    }}>
      <Icon d={status.type === 'error' ? IC.warn : IC.check} size={15}
        color={status.type === 'error' ? '#ef4444' : '#10b981'}
        style={{ flexShrink: 0, marginTop: 1 }} />
      {status.msg}
    </div>
  );

  // ── Shared Employee Lookup Card ───────────────────────────────────────────
  const EmpCard = () => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Employee ID
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input type="number" defaultValue={lookupId}
              id="it-lookup-input"
              onKeyDown={e => { if (e.key === 'Enter') { const v = e.target.value; setLookupId(v); lookupEmployee(v); } }}
              className="it-input" style={{ marginTop: 0, flex: 1 }} placeholder="e.g. 1042" />
            <button
              onClick={() => { const el = document.getElementById('it-lookup-input'); const v = el ? el.value : lookupId; setLookupId(v); lookupEmployee(v); }}
              className="it-btn"
              style={{ marginTop: 0, padding: '0 18px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
              disabled={lookupLoading}>
              {lookupLoading
                ? <span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                : <><Icon d={IC.user} size={13} />Lookup</>}
            </button>
          </div>
        </div>
      </div>
      {lookupError && (
        <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 9, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 13 }}>
          {lookupError}
        </div>
      )}
      {lookedUpEmp && (
        <div style={{ marginTop: 12, padding: '16px 18px', background: 'rgba(79,124,255,0.07)', border: '1px solid rgba(79,124,255,0.2)', borderRadius: 12, animation: 'fadeIn .2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(79,124,255,0.15)', border: '1px solid rgba(79,124,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon d={IC.user} size={18} color="var(--accent2)" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)' }}>{lookedUpEmp.full_name}</div>
              <div style={{ fontSize: 12, color: 'var(--accent2)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon d={IC.mail} size={11} />{lookedUpEmp.email}
              </div>
            </div>
            <span style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(79,124,255,0.12)', color: 'var(--accent2)', border: '1px solid rgba(79,124,255,0.25)' }}>
              #{lookedUpEmp.id}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[
              { label: 'Department',        value: lookedUpEmp.department_name || 'N/A' },
              { label: 'Role',              value: lookedUpEmp.role || 'N/A' },
              { label: 'Primary Branch',    value: lookedUpEmp.primary_branch || 'N/A' },
              { label: 'Phone',             value: lookedUpEmp.phone || '—' },
              { label: 'Gender',            value: lookedUpEmp.gender || '—' },
              { label: 'Secondary Branch',  value: lookedUpEmp.secondary_branch || '—' },
            ].map((f, i) => (
              <div key={i} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 3 }}>{f.label}</div>
                <div style={{ fontSize: 12, color: 'var(--txt)', fontWeight: 600 }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Constants ─────────────────────────────────────────────────────────────
  const TICKET_TYPES = [
    { value: 'Password Reset', icon: IC.shield,   color: '#8b5cf6', dbType: 'Urgent' },
    { value: 'Hardware Issue', icon: IC.zap,      color: '#f97316', dbType: 'Technical' },
    { value: 'Software Issue', icon: IC.terminal, color: '#06b6d4', dbType: 'Technical' },
    { value: 'Network Access', icon: IC.globe,    color: '#10b981', dbType: 'Technical' },
    { value: 'Account Setup',  icon: IC.user,     color: '#4f7cff', dbType: 'Inquiry' },
    { value: 'Other',          icon: IC.ticket,   color: '#f59e0b', dbType: 'Inquiry' },
  ];
  const PRIORITIES = [
    { value: 'Low',      color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)'  },
    { value: 'Medium',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)'  },
    { value: 'High',     color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)'  },
    { value: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)'   },
  ];
  const TOOLS = [
    { id: 'ticket', label: 'Send Ticket',     icon: IC.ticket },
    { id: 'info',   label: 'Edit Info',        icon: IC.user   },
    { id: 'email',  label: 'Change Email',     icon: IC.mail   },
    { id: 'branch', label: 'Reassign Branch',  icon: IC.branch },
  ];
  const TYPE_COLOR = {
    Urgent:      { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)'   },
    Technical:   { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.3)'   },
    Inquiry:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)'  },
    Billing:     { color: '#ec4899', bg: 'rgba(236,72,153,0.12)',  border: 'rgba(236,72,153,0.3)'  },
    Maintenance: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)'  },
  };
  const PRI_COLOR = { Critical: '#ef4444', High: '#f97316', Medium: '#f59e0b', Low: '#10b981' };

  const selectedPri      = PRIORITIES.find(p => p.value === itPriority) || PRIORITIES[1];
  const mockTicketId     = `TKT-${String(user?.id || 0).padStart(3, '0')}-${Date.now().toString().slice(-4)}`;
  const formatTime       = (ts) => {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return String(ts); }
  };

  // ── Ticket card renderer (inbox) ──────────────────────────────────────────
  const renderTicketCard = (ticket, i) => {
    const tc       = TYPE_COLOR[ticket.type] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' };
    const priColor = PRI_COLOR[ticket.priority] || '#94a3b8';
    const isExpanded = expandedTicket === ticket.ticket_id;
    const isOpened   = openedTicketIds.has(ticket.ticket_id);
    const isRead     = readTicketIds.has(ticket.ticket_id);
    const reply      = replyState[ticket.ticket_id] || { message: '', loading: false, status: null };

    return (
      <div key={ticket.ticket_id} className="ticket-card"
        style={{ animationDelay: `${i * 0.03}s`, cursor: 'default', opacity: isOpened && inboxView === 'new' ? 0.85 : 1 }}>
        <div style={{ height: 3, background: `linear-gradient(90deg,${tc.color},${tc.color}44)` }} />

        {/* Header row */}
        <div style={{ padding: '14px 20px', cursor: 'pointer' }}
          onClick={() => { const opening = !isExpanded; setExpandedTicket(opening ? ticket.ticket_id : null); if (opening) markAsOpened(ticket.ticket_id); }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', letterSpacing: '1px' }}>#{ticket.ticket_id}</span>
            <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>{ticket.type}</span>
            {ticket.priority && (
              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: `${priColor}15`, color: priColor, border: `1px solid ${priColor}40` }}>⚡ {ticket.priority}</span>
            )}
            {!isOpened && !isRead && (
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block', boxShadow: '0 0 6px rgba(239,68,68,0.6)', flexShrink: 0 }} title="Unread" />
            )}
            {reply.status?.type === 'success' && (
              <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.28)' }}>
                ✓ {language === 'ar' ? 'تم الرد' : 'Replied'}
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--txt3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon d={IC.calendar} size={11} />{formatTime(ticket.time)}
            </span>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5" strokeLinecap="round"
              style={{ transition: 'transform .2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(79,124,255,0.12)', border: '1px solid rgba(79,124,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon d={IC.user} size={13} color="var(--accent2)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{ticket.employee_name || `Employee #${ticket.employee_id}`}</span>
              <span style={{ fontSize: 11, color: 'var(--txt3)', marginLeft: 8 }}>{ticket.department_name || 'Unknown Dept'} · ID #{ticket.employee_id}</span>
            </div>
            {ticket.employee_email && (
              <span style={{ fontSize: 11, color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <Icon d={IC.mail} size={11} />{ticket.employee_email}
              </span>
            )}
          </div>
        </div>

        {/* Expanded detail + reply */}
        {isExpanded && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', animation: 'fadeIn .18s ease' }}>
            {ticket.cleanDescription && (
              <div style={{ background: 'var(--surface2)', borderRadius: 9, padding: '11px 14px', border: '1px solid var(--border)', fontSize: 13, color: 'var(--txt2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
                  {language === 'ar' ? 'التفاصيل' : 'Description'}
                </div>
                {ticket.cleanDescription}
              </div>
            )}

            {/* Reply area */}
            <div style={{ background: 'rgba(79,124,255,0.04)', border: '1px solid rgba(79,124,255,0.18)', borderRadius: 11, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent2)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon d={IC.mail} size={12} color="var(--accent2)" />
                {language === 'ar' ? `رد على ${ticket.employee_name || 'الموظف'}` : `Reply to ${ticket.employee_name || 'Employee'}`}
                {ticket.employee_email && <span style={{ color: 'var(--txt3)', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>→ {ticket.employee_email}</span>}
              </div>
              {reply.status && (
                <div style={{
                  padding: '9px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: reply.status.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.08)',
                  color: reply.status.type === 'error' ? '#ef4444' : '#10b981',
                  border: `1px solid ${reply.status.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)'}`,
                }}>
                  <Icon d={reply.status.type === 'error' ? IC.warn : IC.check} size={13} />{reply.status.msg}
                </div>
              )}
              <FastTextArea
                value={reply.message}
                onChange={v => setReplyState(prev => ({ ...prev, [ticket.ticket_id]: { ...prev[ticket.ticket_id], message: v, status: null } }))}
                className="it-input" rows="3"
                style={{ resize: 'vertical', marginBottom: 10, fontSize: 13 }}
                placeholder={language === 'ar' ? `اكتب ردك على ${ticket.employee_name || 'الموظف'}...` : `Type your reply to ${ticket.employee_name || 'the employee'}...`}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setExpandedTicket(null)}
                  style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={() => sendTicketReply(ticket.ticket_id).then(ok => { if (ok) markAsReplied(ticket.ticket_id); })}
                  disabled={reply.loading || !reply.message?.trim()}
                  style={{ padding: '8px 18px', borderRadius: 8, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7, opacity: (reply.loading || !reply.message?.trim()) ? 0.5 : 1, transition: 'opacity .18s' }}>
                  {reply.loading
                    ? <><span className="spinner" style={{ width: 11, height: 11, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />{language === 'ar' ? 'جاري الإرسال...' : 'Sending...'}</>
                    : <><Icon d={IC.mail} size={12} />{language === 'ar' ? 'إرسال الرد' : 'Send Reply'}</>}
                </button>
              </div>
            </div>

            {/* Request Deletion panel */}
            {(() => {
              const dr = deleteReqState[ticket.ticket_id] || {};
              return (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  {!dr.open && !dr.status && (
                    <button onClick={() => setDeleteReqState(prev => ({ ...prev, [ticket.ticket_id]: { open: true, reason: '', loading: false, status: null } }))}
                      style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon d={IC.trash} size={12} color="#ef4444" />
                      {language === 'ar' ? 'طلب حذف' : 'Request Deletion'}
                    </button>
                  )}
                  {dr.status && (
                    <div style={{ padding: '9px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, background: dr.status.type === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.07)', color: dr.status.type === 'error' ? '#ef4444' : '#10b981', border: `1px solid ${dr.status.type === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.22)'}` }}>
                      <Icon d={dr.status.type === 'error' ? IC.warn : IC.check} size={12} />{dr.status.msg}
                    </div>
                  )}
                  {dr.open && (
                    <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, padding: '13px 15px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 9 }}>
                        {language === 'ar' ? 'طلب الحذف — يتطلب موافقة مدير العلاقات العامة' : 'Request Deletion — Requires PR Manager Approval'}
                      </div>
                      <FastTextArea value={dr.reason || ''}
                        onChange={v => setDeleteReqState(prev => ({ ...prev, [ticket.ticket_id]: { ...prev[ticket.ticket_id], reason: v } }))}
                        className="it-input" rows="2"
                        style={{ resize: 'vertical', marginBottom: 10, fontSize: 12, borderColor: 'rgba(239,68,68,0.25)' }}
                        placeholder={language === 'ar' ? 'سبب الحذف (مطلوب)...' : 'Reason for deletion (required)...'} />
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => setDeleteReqState(prev => ({ ...prev, [ticket.ticket_id]: { open: false, reason: '', loading: false, status: null } }))}
                          style={{ padding: '7px 14px', borderRadius: 7, background: 'transparent', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {language === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button onClick={() => requestITDelete(ticket.ticket_id)}
                          disabled={dr.loading || !dr.reason?.trim()}
                          style={{ padding: '7px 16px', borderRadius: 7, background: '#ef4444', border: 'none', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, opacity: (dr.loading || !dr.reason?.trim()) ? 0.5 : 1, transition: 'opacity .15s' }}>
                          {dr.loading
                            ? <><span className="spinner" style={{ width: 10, height: 10, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />{language === 'ar' ? 'جاري الإرسال...' : 'Sending...'}</>
                            : <>{language === 'ar' ? 'إرسال لمدير العلاقات العامة' : 'Send to PR Manager'}</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  };

  // ── PERIOD OPTIONS (Inbox) ────────────────────────────────────────────────
  const PERIOD_OPTIONS = [
    { value: 'daily',   label: language === 'ar' ? 'اليوم'  : 'Today',   sub: new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }), color: '#4f7cff' },
    { value: 'weekly',  label: language === 'ar' ? 'أسبوعي' : 'Weekly',  sub: language === 'ar' ? 'آخر 7 أيام'  : 'Last 7 days',   color: '#10b981' },
    { value: 'monthly', label: language === 'ar' ? 'شهري'   : 'Monthly', sub: language === 'ar' ? 'آخر 30 يوم'  : 'Last 30 days',  color: '#8b5cf6' },
    { value: 'yearly',  label: language === 'ar' ? 'سنوي'   : 'Yearly',  sub: language === 'ar' ? 'آخر 12 شهر'  : 'Last 12 months', color: '#f59e0b' },
  ];
  const selPeriod = PERIOD_OPTIONS.find(p => p.value === inboxPeriod) || PERIOD_OPTIONS[0];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="strategy-content">

      {/* ═══════════════════════════════════════════════════════════════════
          IT TOOLS TAB
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'it_tools' && (
        <div style={{ animation: 'fadeUp 0.3s ease' }}>
          <SectionHead title={tx.itTitle || 'IT Administration'} />

          {/* Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { icon: IC.ticket,  label: 'Ticket System',  value: 'Active',                        color: '#4f7cff' },
              { icon: IC.mail,    label: 'Email Alerts',   value: 'it.entreprisex@gmail.com',       color: '#8b5cf6', small: true },
              { icon: IC.check,   label: 'System Status',  value: 'Operational',                   color: '#10b981' },
              { icon: IC.shield,  label: 'Auth Mode',      value: 'bcrypt/10',                     color: '#f59e0b' },
            ].map((s, i) => (
              <div key={i} className="it-stat-card" style={{ animationDelay: `${i * 0.06}s`, borderTop: `3px solid ${s.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon d={s.icon} size={12} color={s.color} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--txt3)' }}>{s.label}</span>
                </div>
                <div style={{ fontSize: s.small ? 11 : 18, fontWeight: 800, color: 'var(--txt)', letterSpacing: s.small ? 0 : '-0.5px', wordBreak: 'break-all' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Tool Switcher */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {TOOLS.map(t => (
              <button key={t.id}
                onClick={() => { setActiveTool(t.id); setItStatus(null); setEditInfoStatus(null); setEmailChangeStatus(null); setBranchStatus(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .18s', fontFamily: 'inherit',
                  background: activeTool === t.id ? 'var(--accent)' : 'var(--surface)',
                  color:      activeTool === t.id ? '#fff'          : 'var(--txt2)',
                  border: `1.5px solid ${activeTool === t.id ? 'var(--accent)' : 'var(--border)'}`,
                }}>
                <Icon d={t.icon} size={13} color={activeTool === t.id ? '#fff' : 'var(--txt3)'} />{t.label}
              </button>
            ))}
          </div>

          {/* ── SEND TICKET ── */}
          {activeTool === 'ticket' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
              <div className="ticket-card">
                <div className="ticket-header-strip" />
                <div style={{ padding: '22px 24px' }}>
                  <EmpCard />
                  <StatusBanner status={itStatus} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 8 }}>{tx.ticketType || 'Ticket Type'}</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                        {TICKET_TYPES.map(t => (
                          <span key={t.value} className={`type-chip ${itTicketType === t.value ? 'selected' : ''}`} onClick={() => setItTicketType(t.value)}>
                            <Icon d={t.icon} size={11} color={itTicketType === t.value ? 'var(--accent2)' : 'var(--txt3)'} />{t.value}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 8 }}>{tx.priority || 'Priority'}</label>
                      <div style={{ display: 'flex', gap: 7 }}>
                        {PRIORITIES.map(p => (
                          <span key={p.value} onClick={() => setItPriority(p.value)} style={{
                            flex: 1, textAlign: 'center', padding: '7px 4px', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .18s',
                            background: itPriority === p.value ? p.bg         : 'var(--surface2)',
                            color:      itPriority === p.value ? p.color      : 'var(--txt3)',
                            border: `1.5px solid ${itPriority === p.value ? p.border : 'var(--border)'}`,
                          }}>{p.value}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{tx.desc || 'Description'}</label>
                      <textarea ref={itDescRef} className="it-input" rows="4"
                        style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
                        placeholder="Describe the issue..."
                        defaultValue=""
                        onBlur={e => setItDescription(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => { if (itDescRef.current) setItDescription(itDescRef.current.value); setShowTicketPreview(p => !p); }}
                        style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .2s', fontFamily: 'inherit' }}>
                        {showTicketPreview ? (tx.hidePreview || 'Hide Preview') : (tx.preview || 'Preview')}
                      </button>
                      <button
                        onClick={async () => {
                          const desc = (itDescRef.current?.value?.trim() || itDescription.trim());
                          if (!lookedUpEmp || !desc) return;
                          setIsSubmitting(true); setItStatus(null);
                          try {
                            const data = await itRepository.sendTicket({
                              target_emp_id: lookedUpEmp.id,
                              ticket_type:   itTicketType,
                              description:   `[Priority: ${itPriority}]\n${desc}`,
                            });
                            setItStatus({ type: 'success', msg: data.message });
                            setItDescription('');
                            if (itDescRef.current) itDescRef.current.value = '';
                            setShowTicketPreview(false);
                          } catch (err) {
                            setItStatus({ type: 'error', msg: err.message });
                          }
                          setIsSubmitting(false);
                        }}
                        className="it-btn"
                        disabled={isSubmitting || !lookedUpEmp || !(itDescRef.current?.value?.trim() || itDescription.trim())}
                        style={{ flex: 2, marginTop: 0 }}>
                        {isSubmitting
                          ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />Sending...</span>
                          : (tx.sendTicket || 'Send Ticket')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview panel */}
              <div>
                {showTicketPreview && lookedUpEmp ? (
                  <div style={{ animation: 'ticketSlide .3s ease' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>📋 Ticket Preview</div>
                    <div className="ticket-card">
                      <div style={{ height: 5, background: `linear-gradient(90deg,${selectedPri.color},${selectedPri.color}55)` }} />
                      <div style={{ padding: '20px 22px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>{mockTicketId}</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>{itTicketType}</div>
                          </div>
                          <span style={{ padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: selectedPri.bg, color: selectedPri.color, border: `1px solid ${selectedPri.border}` }}>{itPriority}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                          {[
                            { label: 'To Employee', value: lookedUpEmp.full_name },
                            { label: 'Email',       value: lookedUpEmp.email },
                            { label: 'Department',  value: lookedUpEmp.department_name || 'N/A' },
                            { label: 'Status',      value: '⏳ Pending' },
                          ].map((row, i) => (
                            <div key={i}>
                              <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>{row.label}</div>
                              <div style={{ fontSize: 12, color: 'var(--txt)', fontWeight: 600, wordBreak: 'break-all' }}>{row.value}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ background: 'var(--surface2)', borderRadius: 9, padding: '11px 13px', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>Description</div>
                          <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: 36 }}>
                            {itDescription || <span style={{ color: 'var(--txt3)', fontStyle: 'italic' }}>No description yet...</span>}
                          </div>
                        </div>
                        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 5, color: 'var(--txt3)', fontSize: 11 }}>
                          <Icon d={IC.mail} size={11} /> Email will be sent to {lookedUpEmp.email}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="ticket-card" style={{ padding: '32px 24px', textAlign: 'center', opacity: 0.45 }}>
                    <Icon d={IC.ticket} size={28} color="var(--txt3)" style={{ margin: '0 auto 10px', display: 'block' }} />
                    <div style={{ fontSize: 13, color: 'var(--txt3)', fontWeight: 600 }}>Lookup an employee first,<br />then preview your ticket here</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── EDIT INFO ── */}
          {activeTool === 'info' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
              <div className="ticket-card">
                <div className="ticket-header-strip" style={{ background: 'linear-gradient(90deg,#10b981,#06b6d4)' }} />
                <div style={{ padding: '22px 24px' }}>
                  <EmpCard />
                  <StatusBanner status={editInfoStatus} />
                  {lookedUpEmp && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>First Name</label>
                          <FastInput value={editFirst} onChange={v => setEditFirst(v)} className="it-input" placeholder={lookedUpEmp.first_name} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Last Name</label>
                          <FastInput value={editLast} onChange={v => setEditLast(v)} className="it-input" placeholder={lookedUpEmp.last_name} />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Phone</label>
                        <FastInput value={editPhone} onChange={v => setEditPhone(v)} className="it-input" placeholder={lookedUpEmp.phone || 'No phone on record'} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Address</label>
                        <FastTextArea value={editAddress} onChange={v => setEditAddress(v)} className="it-input" rows="2" placeholder={lookedUpEmp.address || 'e.g. 21, El-Furat St, Mohandeseen, Giza'} style={{ resize: 'none' }} />
                        {editAddress.trim() && (() => {
                          const parts = editAddress.trim().split(',').map(p => p.trim()).filter(Boolean);
                          const valid = parts.length >= 4 && /^\d+$/.test(parts[0]);
                          return valid
                            ? <div style={{ fontSize: 10, color: '#10b981', marginTop: 3 }}>✓ Valid format: Building No, Street, Area, City</div>
                            : <div style={{ fontSize: 10, color: '#f87171', marginTop: 3 }}>Format: BuildingNo, Street Name, Area, City — e.g. 21, El-Furat St, Mohandeseen, Giza</div>;
                        })()}
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => { setEditFirst(lookedUpEmp.first_name || ''); setEditLast(lookedUpEmp.last_name || ''); setEditPhone(lookedUpEmp.phone || ''); setEditAddress(lookedUpEmp.address || ''); setEditInfoStatus(null); }}
                          style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Reset
                        </button>
                        <button
                          onClick={() => {
                            const phone = editPhone.trim();
                            if (phone && !/^01[0125][0-9]{8}$/.test(phone)) {
                              setEditInfoStatus({ type: 'error', msg: 'Invalid Egyptian phone number. Must be 11 digits starting with 010, 011, 012, or 015.' });
                              return;
                            }
                            if (editFirst.trim() && editFirst.trim().length < 2) {
                              setEditInfoStatus({ type: 'error', msg: 'First name must be at least 2 characters.' });
                              return;
                            }
                            const addr = editAddress.trim();
                            if (addr) {
                              const addrParts = addr.split(',').map(p => p.trim()).filter(Boolean);
                              if (addrParts.length < 4 || !/^\d+$/.test(addrParts[0])) {
                                setEditInfoStatus({ type: 'error', msg: 'Address must follow the format: BuildingNumber, Street Name, Area, City  (e.g. 21, El-Furat St, Mohandeseen, Giza)' });
                                return;
                              }
                            }
                            itPatch(
                              () => itRepository.stageInfoUpdate(lookedUpEmp.id, { first_name: editFirst, last_name: editLast, phone: editPhone, address: editAddress, submitted_by_id: user?.id, submitted_by_name: user?.name }),
                              setEditInfoStatus, setEditInfoLoading
                            );
                          }}
                          className="it-btn" disabled={editInfoLoading}
                          style={{ flex: 2, marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                          {editInfoLoading ? <><span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />Saving...</> : <><Icon d={IC.check} size={13} />Submit for HR Approval</>}
                        </button>
                      </div>
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>⚡ Quick Actions</div>
                        <button onClick={handleResetPassword}
                          style={{ width: '100%', padding: '11px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                          <Icon d={IC.shield} size={13} color="#f87171" />Force Password Reset (sends email)
                        </button>
                      </div>
                    </div>
                  )}
                  {!lookedUpEmp && <div style={{ fontSize: 13, color: 'var(--txt3)', textAlign: 'center', padding: '20px 0' }}>Look up an employee above to edit their info</div>}
                </div>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>What this does</div>
                {[
                  { icon: IC.user,    color: '#10b981', text: 'Updates first/last name in the employee table (Requires HR Approval)' },
                  { icon: IC.phone,   color: '#4f7cff', text: 'Updates phone number (Requires HR Approval)' },
                  { icon: IC.address, color: '#8b5cf6', text: 'Updates address field (Requires HR Approval)' },
                  { icon: IC.mail,    color: '#f59e0b', text: 'Employee receives an email notification on any change' },
                  { icon: IC.shield,  color: '#ef4444', text: 'Force Reset generates a temp password, updates DB instantly, and emails it' },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: i < 4 ? 10 : 0 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, background: `${r.color}15`, border: `1px solid ${r.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <Icon d={r.icon} size={11} color={r.color} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.5 }}>{r.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CHANGE EMAIL ── */}
          {activeTool === 'email' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
              <div className="ticket-card">
                <div className="ticket-header-strip" style={{ background: 'linear-gradient(90deg,#8b5cf6,#ec4899)' }} />
                <div style={{ padding: '22px 24px' }}>
                  <EmpCard />
                  <StatusBanner status={emailChangeStatus} />
                  {lookedUpEmp && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 12, color: '#fca5a5', display: 'flex', gap: 8 }}>
                        <Icon d={IC.warn} size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                        Changing email changes the login credential. Employee will be notified at both addresses.
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Current Email</label>
                        <div style={{ marginTop: 6, padding: '11px 14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, color: 'var(--txt3)', fontWeight: 600 }}>{lookedUpEmp.email}</div>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>New Email</label>
                        <FastInput type="email" value={newEmail} onChange={v => setNewEmail(v)} className="it-input" placeholder="new.email@gmail.com" />
                        {newEmail && !/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(newEmail) && (
                          <div style={{ fontSize: 10, color: '#f87171', marginTop: 4 }}>Only Gmail addresses are accepted (@gmail.com)</div>
                        )}
                      </div>
                      <button
                        onClick={() => itPatch(
                          () => itRepository.stageEmailUpdate(lookedUpEmp.id, { new_email: newEmail, submitted_by_id: user?.id, submitted_by_name: user?.name }),
                          setEmailChangeStatus, setEmailChangeLoading
                        )}
                        className="it-btn"
                        disabled={emailChangeLoading || !/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(newEmail) || newEmail === lookedUpEmp.email}
                        style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                        {emailChangeLoading ? <><span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />Staging...</> : <><Icon d={IC.mail} size={13} />Submit for HR Approval</>}
                      </button>
                    </div>
                  )}
                  {!lookedUpEmp && <div style={{ fontSize: 13, color: 'var(--txt3)', textAlign: 'center', padding: '20px 0' }}>Look up an employee above to change their email</div>}
                </div>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>Email Change Flow</div>
                {['Validates new email format and checks for conflicts', 'Stages ticket for HR Manager Approval', 'Updates the mail field in the account table upon approval', 'Sends a notification to both the old and new email addresses', 'Employee must use the new email to log in going forward'].map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: i < 4 ? 12 : 0 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, fontWeight: 800, color: '#a78bfa' }}>{i + 1}</div>
                    <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.5, marginTop: 2 }}>{s}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── BRANCH REASSIGNMENT ── */}
          {activeTool === 'branch' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
              <div className="ticket-card">
                <div className="ticket-header-strip" style={{ background: 'linear-gradient(90deg,#f97316,#f59e0b)' }} />
                <div style={{ padding: '22px 24px' }}>
                  <EmpCard />
                  <StatusBanner status={branchStatus} />
                  {lookedUpEmp && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Primary Branch</label>
                        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 3, marginBottom: 6 }}>Current: <b style={{ color: 'var(--txt2)' }}>{lookedUpEmp.primary_branch || 'None'} (ID: {lookedUpEmp.branch_id || '—'})</b></div>
                        <select value={newBranchId || (lookedUpEmp.branch_id ? String(lookedUpEmp.branch_id) : '')} onChange={e => { setNewBranchId(e.target.value); if (newSecBranchId === e.target.value) setNewSecBranchId(''); }} className="it-input">
                          {lookedUpEmp.branch_id
                            ? <option value={String(lookedUpEmp.branch_id)}>{lookedUpEmp.primary_branch || `Branch #${lookedUpEmp.branch_id}`} (current)</option>
                            : <option value="">— Select a branch —</option>}
                          <option value="NULL">NULL (clear assignment)</option>
                          {branches.filter(b => String(b.b_id) !== String(lookedUpEmp.branch_id)).map(b => <option key={b.b_id} value={b.b_id}>{b.location} (ID: {b.b_id})</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Secondary Branch</label>
                        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 3, marginBottom: 6 }}>Current: <b style={{ color: 'var(--txt2)' }}>{lookedUpEmp.secondary_branch || 'None'} {lookedUpEmp.secondary_branch_id ? `(ID: ${lookedUpEmp.secondary_branch_id})` : ''}</b></div>
                        <select value={newSecBranchId} onChange={e => setNewSecBranchId(e.target.value)} className="it-input">
                          <option value="">— No change —</option>
                          <option value="NULL">NULL (clear assignment)</option>
                          {branches
                            .filter(b => { const activePrimary = newBranchId && newBranchId !== 'NULL' ? String(newBranchId) : String(lookedUpEmp.branch_id || ''); return String(b.b_id) !== activePrimary; })
                            .map(b => <option key={b.b_id} value={b.b_id}>{b.location} (ID: {b.b_id})</option>)}
                        </select>
                      </div>
                      <button
                        onClick={() => {
                          const body = { submitted_by_id: user?.id, submitted_by_name: user?.name };
                          if (newBranchId === 'NULL') body.branch_id = null;
                          else if (newBranchId) body.branch_id = parseInt(newBranchId);
                          if (newSecBranchId === 'NULL') body.secondary_branch_id = null;
                          else if (newSecBranchId) body.secondary_branch_id = parseInt(newSecBranchId);
                          itPatch(() => itRepository.stageBranchUpdate(lookedUpEmp.id, body), setBranchStatus, setBranchLoading);
                        }}
                        className="it-btn" disabled={branchLoading || (!newBranchId && !newSecBranchId)}
                        style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                        {branchLoading ? <><span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />Staging...</> : <><Icon d={IC.branch} size={13} />Submit for HR Approval</>}
                      </button>
                    </div>
                  )}
                  {!lookedUpEmp && <div style={{ fontSize: 13, color: 'var(--txt3)', textAlign: 'center', padding: '20px 0' }}>Look up an employee above to reassign their branch</div>}
                </div>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>Available Branches</div>
                {branches.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {branches.map(b => (
                      <div key={b.b_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 800, color: '#fb923c' }}>{b.b_id}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{b.location}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--txt3)', fontStyle: 'italic' }}>Loading branches...</div>
                )}
              </div>
            </div>
          )}

          {/* ── IT PRODUCTS ── */}
          {activeTool === 'it_products' && (
            <div style={{ animation: 'fadeUp .3s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px' }}>⚗️ Requires Inventory Approval</span>
                <button onClick={loadProducts} style={{ padding: '6px 13px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>↻ Refresh</button>
              </div>
              {productStatus && (
                <div style={{ padding: '10px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, background: productStatus.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.08)', color: productStatus.type === 'error' ? '#ef4444' : '#10b981', border: `1px solid ${productStatus.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)'}` }}>
                  <Icon d={productStatus.type === 'error' ? IC.warn : IC.check} size={14} />{productStatus.msg}
                </div>
              )}
              <div className="ticket-card" style={{ marginBottom: 18 }}>
                <div style={{ height: 4, background: 'linear-gradient(90deg,#10b981,#06b6d4)' }} />
                <div style={{ padding: '18px 22px' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Icon d={IC.plus} size={14} color="#10b981" />Add New Product
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))', gap: 9, marginBottom: 10 }}>
                    {[['product_id','Product ID','P-001'],['name','Name','Product name'],['type','Type','Laptop'],['model','Model','Dell XPS'],['price_before_profit','Cost','0.00'],['price_after_profit','Sell Price','0.00'],['amount_avail','Stock','0']].map(([k,lbl,ph]) => (
                      <div key={k}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.6px' }}>{lbl}</label>
                        <input value={newProd[k]} onChange={e => setNewProd(p => ({ ...p, [k]: e.target.value }))} className="it-sm" placeholder={ph} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Image URL</label>
                    <input value={newProd.image} onChange={e => setNewProd(p => ({ ...p, image: e.target.value }))} className="it-sm" placeholder="https://... or local path" />
                  </div>
                  {newProd.image && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                      <img src={newProd.image} alt="preview" style={{ width: 50, height: 50, objectFit: 'contain', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', padding: 3 }} onError={e => { e.target.style.opacity = '.3'; }} />
                      <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Preview</span>
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      setProductActLoading(true); setProductStatus(null);
                      try {
                        const data = await productRepository.stageAddProduct(newProd);
                        setProductStatus({ type: 'success', msg: data.message });
                        setNewProd({ product_id: '', name: '', type: '', model: '', price_before_profit: '', price_after_profit: '', amount_avail: '', image: '' });
                      } catch (err) {
                        setProductStatus({ type: 'error', msg: err.message });
                      }
                      setProductActLoading(false);
                    }}
                    className="it-btn" disabled={productActLoading || !newProd.product_id || !newProd.name}
                    style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                    {productActLoading ? <><span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,.3)', borderTopColor: '#fff' }} />Staging...</> : <><Icon d={IC.plus} size={13} />Request Addition</>}
                  </button>
                </div>
              </div>
              {productsLoading
                ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--txt2)', fontSize: 13 }}><span className="spinner" style={{ width: 15, height: 15 }} />Loading...</div>
                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
                  {products.map((p, i) => (
                    <div key={p.product_id} className="prod-card" style={{ animationDelay: `${i * .04}s` }}>
                      {p.image ? <img src={p.image} alt={p.name} className="prod-img" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} /> : null}
                      <div className="prod-ph" style={{ display: p.image ? 'none' : 'flex' }}><Icon d={IC.pkg} size={28} color="var(--txt3)" /></div>
                      <div style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>{[p.type, p.model].filter(Boolean).join(' · ')}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)', marginBottom: 8 }}>{p.name}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 9 }}>
                          <div style={{ background: 'var(--surface2)', borderRadius: 7, padding: '6px 8px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Sell</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>{Number(p.price_after_profit || 0).toLocaleString()} EGP</div>
                          </div>
                          <div style={{ background: 'var(--surface2)', borderRadius: 7, padding: '6px 8px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Stock</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: p.amount_avail > 0 ? 'var(--txt)' : '#ef4444' }}>{p.amount_avail}</div>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (!window.confirm(`Request to remove "${p.name}"?`)) return;
                            setProductStatus(null);
                            try {
                              const data = await productRepository.stageDeleteProduct(p.product_id);
                              setProductStatus({ type: 'success', msg: data.message });
                            } catch (err) {
                              setProductStatus({ type: 'error', msg: err.message });
                            }
                          }}
                          style={{ width: '100%', padding: '7px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.22)', color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all .18s' }}>
                          <Icon d={IC.trash} size={11} color="#f87171" />Request Deletion
                        </button>
                      </div>
                    </div>
                  ))}
                  {products.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '30px 0', color: 'var(--txt3)', fontSize: 13 }}>No products. Add one above.</div>}
                </div>
              }
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          IT INBOX TAB
      ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'it_inbox' && (
        <div style={{ animation: 'fadeUp 0.3s ease' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <SectionHead title={language === 'ar' ? 'صندوق التذاكر' : (tx.ticketInbox || 'Ticket Inbox')} />
              <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: -18 }}>
                {language === 'ar' ? 'التذاكر المقدمة لفريق الإدارة — لا تشمل طلبات الإجازات' : 'Tickets submitted to Admin — leave requests excluded'}
              </div>
            </div>
            <button onClick={() => loadInboxTickets(inboxPeriod)}
              style={{ padding: '8px 16px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .2s' }}>
              ↻ {language === 'ar' ? 'تحديث' : 'Refresh'}
            </button>
          </div>

          {/* New / History toggle */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 22, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
            {[
              { key: 'new',     label: language === 'ar' ? 'الجديدة' : 'New',     badge: newTickets.length     },
              { key: 'history', label: language === 'ar' ? 'السجل'   : 'History', badge: historyTickets.length },
            ].map(tab => (
              <button key={tab.key} onClick={() => setInboxView(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 9, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 700, border: 'none', transition: 'all .18s',
                  background: inboxView === tab.key ? 'var(--accent)' : 'transparent',
                  color:      inboxView === tab.key ? '#fff'          : 'var(--txt2)',
                }}>
                {tab.label}
                {tab.badge > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '1px 6px',
                    background: inboxView === tab.key ? 'rgba(255,255,255,0.25)' : (tab.key === 'new' ? 'rgba(239,68,68,0.18)' : 'rgba(140,165,215,0.15)'),
                    color:      inboxView === tab.key ? '#fff'                   : (tab.key === 'new' ? '#fca5a5'              : 'var(--txt3)'),
                  }}>{tab.badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* Period selector */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
            {PERIOD_OPTIONS.map(p => (
              <button key={p.value} onClick={() => setInboxPeriod(p.value)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 18px', borderRadius: 12, cursor: 'pointer', transition: 'all .18s', fontFamily: 'inherit', minWidth: 100,
                  background: inboxPeriod === p.value ? `${p.color}18` : 'var(--surface)',
                  border:     `1.5px solid ${inboxPeriod === p.value ? p.color + '55' : 'var(--border)'}`,
                  color:      inboxPeriod === p.value ? p.color : 'var(--txt2)',
                }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{p.label}</span>
                <span style={{ fontSize: 10, opacity: 0.7, marginTop: 2, fontWeight: 600 }}>{p.sub}</span>
              </button>
            ))}
          </div>

          {/* Count badge */}
          {!inboxLoading && inboxCount !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: selPeriod.color, boxShadow: `0 0 6px ${selPeriod.color}` }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt2)' }}>
                <span style={{ color: selPeriod.color, fontWeight: 800 }}>{inboxCount}</span>
                {' '}{language === 'ar' ? 'تذكرة لـ' : `ticket${inboxCount !== 1 ? 's' : ''} for`}{' '}
                <span style={{ color: 'var(--txt)' }}>{selPeriod.label}</span>
              </span>
            </div>
          )}

          {/* Error */}
          {inboxError && (
            <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', fontSize: 13, fontWeight: 600, display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18 }}>
              <Icon d={IC.warn} size={15} color="#ef4444" />{inboxError}
            </div>
          )}

          {/* Loading skeletons */}
          {inboxLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 999 }} />
                    <div className="skeleton" style={{ width: 80, height: 22, borderRadius: 999 }} />
                    <div className="skeleton" style={{ flex: 1, height: 16, borderRadius: 6 }} />
                  </div>
                  <div className="skeleton" style={{ height: 13, width: '60%', marginTop: 10, borderRadius: 6 }} />
                </div>
              ))}
            </div>
          )}

          {/* Ticket list */}
          {!inboxLoading && !inboxError && (
            displayTickets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--txt3)' }}>
                <Icon d={IC.ticket} size={40} color="var(--border2)" style={{ margin: '0 auto 16px', display: 'block' }} />
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                  {inboxView === 'history'
                    ? (language === 'ar' ? 'لا يوجد سجل تذاكر بعد' : 'No ticket history yet')
                    : (language === 'ar' ? 'لا توجد تذاكر جديدة' : 'No new tickets')}
                </div>
                <div style={{ fontSize: 13 }}>
                  {inboxView === 'history'
                    ? (language === 'ar' ? 'التذاكر التي تمت قراءتها أو الرد عليها ستظهر هنا.' : 'Tickets you open or reply to will appear here.')
                    : (language === 'ar' ? 'لا توجد تذاكر إدارة جديدة لهذه الفترة.' : 'No new Admin tickets for this period.')}
                </div>
                {inboxView === 'new' && historyTickets.length > 0 && (
                  <button onClick={() => setInboxView('history')}
                    style={{ marginTop: 16, padding: '8px 20px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {language === 'ar' ? 'عرض السجل' : 'View History'} ({historyTickets.length})
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {inboxView === 'history' && (
                  <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', fontSize: 12, color: 'var(--txt3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    {language === 'ar' ? 'هذه التذاكر تمت قراءتها أو الرد عليها.' : 'These tickets have been read or replied to.'}
                  </div>
                )}
                {displayTickets.map((ticket, i) => renderTicketCard(ticket, i))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
