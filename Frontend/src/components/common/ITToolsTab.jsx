/**
 * ITToolsTab.jsx
 *
 * Admin toolkit for the IT department.
 * Four tools: Send Ticket, Edit Employee Info, Change Email, Transfer Branch.
 * All require an employee lookup first.
 *
 * Props
 * ──────────────────────────────────────────────────────────────────────────
 * user              {object}
 * language          {string}
 * tx                {object}
 * branches          {Array}   List of branch objects for branch transfer tool
 * products          {Array}   Product list for IT products tool
 * productsLoading   {boolean}
 * onLoadProducts    {function}
 */

import { useState, useRef, useCallback } from 'react';
import Icon, { IC, FastTextArea } from '../../components/ui/Icon';

// ── constants ──────────────────────────────────────────────────────────────
const TICKET_TYPES = [
  { value: 'Password Reset',  icon: IC.shield },
  { value: 'Hardware Issue',  icon: IC.layers },
  { value: 'Software Issue',  icon: IC.chart  },
  { value: 'Network Access',  icon: IC.graphs },
  { value: 'Account Setup',   icon: IC.user   },
  { value: 'Other',           icon: IC.ticket },
];

const PRIORITIES = [
  { value: 'Low',      color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)'  },
  { value: 'Medium',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)'  },
  { value: 'High',     color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)'  },
  { value: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)'   },
];

const TOOLS = [
  { id: 'ticket',      label: 'Send Ticket',   icon: IC.ticket },
  { id: 'info',        label: 'Edit Info',      icon: IC.user   },
  { id: 'email',       label: 'Change Email',   icon: IC.mail   },
  { id: 'branch',      label: 'Transfer Branch',icon: IC.branch },
];

const SectionHead = ({ title }) => (
  <div style={{ marginBottom: 26 }}>
    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.4px' }}>{title}</h1>
    <div style={{ height: 3, width: 44, background: 'linear-gradient(90deg,var(--accent),var(--accent2))', borderRadius: 2, marginTop: 7 }} />
  </div>
);

const StatusBanner = ({ status }) => status ? (
  <div style={{
    padding: '11px 15px', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 14,
    display: 'flex', alignItems: 'flex-start', gap: 9,
    background: status.type === 'error' ? 'rgba(239,68,68,0.1)'  : 'rgba(16,185,129,0.08)',
    color:      status.type === 'error' ? '#ef4444'               : '#10b981',
    border:    `1px solid ${status.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)'}`,
  }}>
    <Icon d={status.type === 'error' ? IC.warn : IC.check} size={15} style={{ flexShrink: 0, marginTop: 1 }}
      color={status.type === 'error' ? '#ef4444' : '#10b981'} />
    {status.msg}
  </div>
) : null;

export default function ITToolsTab({ user, language, tx, branches = [], products = [], productsLoading = false, onLoadProducts }) {
  const isAr = language === 'ar';

  // ── Employee lookup state ──────────────────────────────────────────────
  const [lookupId,       setLookupId]       = useState('');
  const [lookedUpEmp,    setLookedUpEmp]    = useState(null);
  const [lookupLoading,  setLookupLoading]  = useState(false);
  const [lookupError,    setLookupError]    = useState(null);

  // ── Tool selection ─────────────────────────────────────────────────────
  const [activeTool, setActiveTool] = useState('ticket');

  // ── Send Ticket state ──────────────────────────────────────────────────
  const [itTicketType,      setItTicketType]      = useState('Password Reset');
  const [itPriority,        setItPriority]        = useState('Medium');
  const [itDescription,     setItDescription]     = useState('');
  const [itStatus,          setItStatus]          = useState(null);
  const [isSubmitting,      setIsSubmitting]      = useState(false);
  const [showTicketPreview, setShowTicketPreview] = useState(false);
  const itDescRef = useRef(null);

  // ── Edit Info state ────────────────────────────────────────────────────
  const [editFirst,      setEditFirst]      = useState('');
  const [editLast,       setEditLast]       = useState('');
  const [editPhone,      setEditPhone]      = useState('');
  const [editAddress,    setEditAddress]    = useState('');
  const [editInfoStatus, setEditInfoStatus] = useState(null);
  const [editInfoLoading,setEditInfoLoading]= useState(false);

  // ── Change Email state ─────────────────────────────────────────────────
  const [newEmail,           setNewEmail]           = useState('');
  const [emailChangeStatus,  setEmailChangeStatus]  = useState(null);
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);

  // ── Branch Transfer state ──────────────────────────────────────────────
  const [newBranchId,    setNewBranchId]    = useState('');
  const [newSecBranchId, setNewSecBranchId] = useState('');
  const [branchStatus,   setBranchStatus]   = useState(null);
  const [branchLoading,  setBranchLoading]  = useState(false);

  // ── Product state (IT can also manage products) ────────────────────────
  const [productStatus,    setProductStatus]    = useState(null);
  const [productActLoading,setProductActLoading]= useState(false);
  const [productRemovalModal, setProductRemovalModal] = useState(null);
  const [newProd, setNewProd] = useState({ product_id: '', name: '', type: '', model: '', price_before_profit: '', price_after_profit: '', amount_avail: '', image: '' });

  // ── Lookup ──────────────────────────────────────────────────────────────
  const lookupEmployee = async (id) => {
    const empId = parseInt(id);
    if (!empId || empId <= 0) return;
    setLookupLoading(true); setLookupError(null); setLookedUpEmp(null);
    try {
      const res  = await fetch(`http://localhost:3000/api/it/employee/${empId}`);
      const data = await res.json();
      if (res.ok) {
        setLookedUpEmp(data);
        setEditFirst(data.first_name || ''); setEditLast(data.last_name || '');
        setEditPhone(data.phone || '');      setEditAddress(data.address || '');
        setNewBranchId(data.branch_id || ''); setNewSecBranchId(data.secondary_branch_id || '');
        setNewEmail('');
      } else { setLookupError(data.error); }
    } catch { setLookupError('Network error during lookup.'); }
    setLookupLoading(false);
  };

  // ── Employee card (shared across all tools) ────────────────────────────
  const EmpCard = () => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <input type="number" value={lookupId} onChange={e => setLookupId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && lookupEmployee(lookupId)}
          className="it-input" placeholder={isAr ? 'ادخل رقم الموظف...' : 'Employee ID...'}
          style={{ margin: 0, flex: 1 }} />
        <button onClick={() => lookupEmployee(lookupId)} disabled={lookupLoading || !lookupId} className="it-btn"
          style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          {lookupLoading
            ? <span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
            : <Icon d={IC.user} size={13} />}
          {isAr ? 'بحث' : 'Lookup'}
        </button>
      </div>
      {lookupError && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Icon d={IC.warn} size={11} color="#ef4444" />{lookupError}</div>}
      {lookedUpEmp && (
        <div style={{ padding: '12px 14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon d={IC.user} size={14} color="#10b981" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{lookedUpEmp.full_name}</div>
            <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>{lookedUpEmp.email} · {lookedUpEmp.department_name}</div>
          </div>
        </div>
      )}
    </div>
  );

  // ── System stats ───────────────────────────────────────────────────────
  const SYS_STATS = [
    { icon: IC.ticket,  label: 'Ticket System', value: 'Active',              color: '#4f7cff' },
    { icon: IC.mail,    label: 'Email Alerts',  value: 'it.support@gmail.com', color: '#8b5cf6', small: true },
    { icon: IC.check,   label: 'System Status', value: 'Operational',          color: '#10b981' },
    { icon: IC.shield,  label: 'Auth Mode',     value: 'bcrypt/10',            color: '#f59e0b' },
  ];

  const selectedPri = PRIORITIES.find(p => p.value === itPriority) || PRIORITIES[1];
  const mockTicketId = `TKT-${Math.floor(Date.now() / 1000).toString(36).toUpperCase()}`;

  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      <SectionHead title={tx.itTitle || 'IT Admin Tools'} />

      {/* System Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
        {SYS_STATS.map((s, i) => (
          <div key={i} className="it-stat-card" style={{ animationDelay: `${i * 0.06}s`, borderTop: `3px solid ${s.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon d={s.icon} size={12} color={s.color} />
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--txt3)' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: s.small ? 11 : 18, fontWeight: 800, color: 'var(--txt)', wordBreak: 'break-all' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tool Switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => { setActiveTool(t.id); setItStatus(null); setEditInfoStatus(null); setEmailChangeStatus(null); setBranchStatus(null); }} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .18s', fontFamily: 'inherit',
            background: activeTool === t.id ? 'var(--accent)' : 'var(--surface)',
            color:      activeTool === t.id ? '#fff'          : 'var(--txt2)',
            border:    `1.5px solid ${activeTool === t.id ? 'var(--accent)' : 'var(--border)'}`,
          }}>
            <Icon d={t.icon} size={13} color={activeTool === t.id ? '#fff' : 'var(--txt3)'} />{t.label}
          </button>
        ))}
      </div>

      {/* ── SEND TICKET ── */}
      {activeTool === 'ticket' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          {/* Form */}
          <div className="ticket-card">
            <div style={{ height: 4, background: 'linear-gradient(90deg,var(--accent),var(--accent2))' }} />
            <div style={{ padding: '22px 24px' }}>
              <EmpCard />
              <StatusBanner status={itStatus} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Ticket type */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 8 }}>{tx.ticketType || 'Ticket Type'}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {TICKET_TYPES.map(t => (
                      <span key={t.value} className={`type-chip ${itTicketType === t.value ? 'selected' : ''}`} onClick={() => setItTicketType(t.value)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Icon d={t.icon} size={11} color={itTicketType === t.value ? 'var(--accent2)' : 'var(--txt3)'} />{t.value}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Priority */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 8 }}>{tx.priority || 'Priority'}</label>
                  <div style={{ display: 'flex', gap: 7 }}>
                    {PRIORITIES.map(p => (
                      <span key={p.value} onClick={() => setItPriority(p.value)} style={{
                        flex: 1, textAlign: 'center', padding: '7px 4px', borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .18s',
                        background: itPriority === p.value ? p.bg : 'var(--surface2)',
                        color:      itPriority === p.value ? p.color : 'var(--txt3)',
                        border:    `1.5px solid ${itPriority === p.value ? p.border : 'var(--border)'}`,
                      }}>{p.value}</span>
                    ))}
                  </div>
                </div>
                {/* Description */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{tx.desc || 'Description'}</label>
                  <textarea ref={itDescRef} className="it-input" rows="4"
                    style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
                    placeholder="Describe the issue..."
                    onBlur={e => setItDescription(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { if (itDescRef.current) setItDescription(itDescRef.current.value); setShowTicketPreview(p => !p); }}
                    style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {showTicketPreview ? (tx.hidePreview || 'Hide Preview') : (tx.preview || 'Preview')}
                  </button>
                  <button onClick={async () => {
                    const desc = itDescRef.current?.value?.trim() || itDescription.trim();
                    if (!lookedUpEmp || !desc) return;
                    setIsSubmitting(true); setItStatus(null);
                    try {
                      const res  = await fetch('http://localhost:3000/api/it/send-ticket', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ target_emp_id: lookedUpEmp.id, ticket_type: itTicketType, description: `[Priority: ${itPriority}]\n${desc}` }),
                      });
                      const data = await res.json();
                      if (res.ok) { setItStatus({ type: 'success', msg: data.message }); setItDescription(''); if (itDescRef.current) itDescRef.current.value = ''; setShowTicketPreview(false); }
                      else setItStatus({ type: 'error', msg: data.error });
                    } catch { setItStatus({ type: 'error', msg: 'Network error.' }); }
                    setIsSubmitting(false);
                  }} className="it-btn" disabled={isSubmitting || !lookedUpEmp || !(itDescRef.current?.value?.trim() || itDescription.trim())} style={{ flex: 2, marginTop: 0 }}>
                    {isSubmitting ? <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span className="spinner" style={{ width: 13, height: 13 }} />{isAr ? 'جاري الإرسال...' : 'Sending...'}</span> : (tx.sendTicket || 'Send Ticket')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Ticket preview */}
          <div>
            {showTicketPreview && lookedUpEmp ? (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>📋 {isAr ? 'معاينة التذكرة' : 'Ticket Preview'}</div>
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
                      ].map((r, i) => (
                        <div key={i}>
                          <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>{r.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--txt)', fontWeight: 600, wordBreak: 'break-all' }}>{r.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: 'var(--surface2)', borderRadius: 9, padding: '11px 13px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>Description</div>
                      <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: 36 }}>
                        {itDescription || <span style={{ color: 'var(--txt3)', fontStyle: 'italic' }}>No description yet...</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="ticket-card" style={{ padding: '32px 24px', textAlign: 'center', opacity: 0.45 }}>
                <Icon d={IC.ticket} size={28} color="var(--txt3)" style={{ margin: '0 auto 10px', display: 'block' }} />
                <div style={{ fontSize: 13, color: 'var(--txt3)', fontWeight: 600 }}>{isAr ? 'ابحث عن موظف أولاً،\nثم شاهد معاينة تذكرتك هنا.' : 'Lookup an employee first,\nthen preview your ticket here.'}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EDIT INFO ── */}
      {activeTool === 'info' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          <div className="ticket-card">
            <div style={{ height: 4, background: 'linear-gradient(90deg,#10b981,#06b6d4)' }} />
            <div style={{ padding: '22px 24px' }}>
              <EmpCard />
              <StatusBanner status={editInfoStatus} />
              {lookedUpEmp && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { label: 'First Name', val: editFirst, set: setEditFirst },
                      { label: 'Last Name',  val: editLast,  set: setEditLast  },
                    ].map(f => (
                      <div key={f.label}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{f.label}</label>
                        <input value={f.val} onChange={e => f.set(e.target.value)} className="it-input" style={{ marginTop: 6 }} />
                      </div>
                    ))}
                  </div>
                  {[
                    { label: 'Phone',   val: editPhone,   set: setEditPhone   },
                    { label: 'Address', val: editAddress, set: setEditAddress },
                  ].map(f => (
                    <div key={f.label}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{f.label}</label>
                      <input value={f.val} onChange={e => f.set(e.target.value)} className="it-input" style={{ marginTop: 6 }} />
                    </div>
                  ))}
                  <button onClick={async () => {
                    setEditInfoLoading(true); setEditInfoStatus(null);
                    try {
                      const res  = await fetch(`http://localhost:3000/api/it/employee/${lookedUpEmp.id}`, {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ first_name: editFirst, last_name: editLast, phone: editPhone, address: editAddress, submitted_by_id: user?.id, submitted_by_name: user?.name }),
                      });
                      const data = await res.json();
                      setEditInfoStatus({ type: res.ok ? 'success' : 'error', msg: data.message || data.error });
                    } catch { setEditInfoStatus({ type: 'error', msg: 'Network error.' }); }
                    setEditInfoLoading(false);
                  }} className="it-btn" disabled={editInfoLoading || !lookedUpEmp} style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                    {editInfoLoading ? <><span className="spinner" style={{ width: 13, height: 13 }} />Submitting...</> : <><Icon d={IC.user} size={13} />Request Update</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CHANGE EMAIL ── */}
      {activeTool === 'email' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          <div className="ticket-card">
            <div style={{ height: 4, background: 'linear-gradient(90deg,#8b5cf6,#ec4899)' }} />
            <div style={{ padding: '22px 24px' }}>
              <EmpCard />
              <StatusBanner status={emailChangeStatus} />
              {lookedUpEmp && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Current Email</label>
                    <div style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 9, border: '1px solid var(--border)', fontSize: 13, color: 'var(--txt3)', marginTop: 6 }}>
                      {lookedUpEmp.email}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>New Email</label>
                    <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="it-input"
                      placeholder="new.email@example.com" style={{ marginTop: 6 }} />
                  </div>
                  <button onClick={async () => {
                    setEmailChangeLoading(true); setEmailChangeStatus(null);
                    try {
                      const res  = await fetch(`http://localhost:3000/api/it/employee/${lookedUpEmp.id}/email`, {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ new_email: newEmail, submitted_by_id: user?.id, submitted_by_name: user?.name }),
                      });
                      const data = await res.json();
                      setEmailChangeStatus({ type: res.ok ? 'success' : 'error', msg: data.message || data.error });
                      if (res.ok) setNewEmail('');
                    } catch { setEmailChangeStatus({ type: 'error', msg: 'Network error.' }); }
                    setEmailChangeLoading(false);
                  }} className="it-btn" disabled={emailChangeLoading || !newEmail || !lookedUpEmp} style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                    {emailChangeLoading ? <><span className="spinner" style={{ width: 13, height: 13 }} />Submitting...</> : <><Icon d={IC.mail} size={13} />Request Email Change</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSFER BRANCH ── */}
      {activeTool === 'branch' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          <div className="ticket-card">
            <div style={{ height: 4, background: 'linear-gradient(90deg,#f59e0b,#f97316)' }} />
            <div style={{ padding: '22px 24px' }}>
              <EmpCard />
              <StatusBanner status={branchStatus} />
              {lookedUpEmp && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { label: 'Primary Branch',   val: newBranchId,    set: setNewBranchId    },
                    { label: 'Secondary Branch',  val: newSecBranchId, set: setNewSecBranchId },
                  ].map(f => (
                    <div key={f.label}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{f.label}</label>
                      <select value={f.val} onChange={e => f.set(e.target.value)} className="it-input" style={{ marginTop: 6 }}>
                        <option value="">— {f.label} —</option>
                        {branches.map(b => <option key={b.id || b.branch_id} value={b.id || b.branch_id}>{b.name || b.branch_name || `Branch #${b.id || b.branch_id}`}</option>)}
                      </select>
                    </div>
                  ))}
                  <button onClick={async () => {
                    setBranchLoading(true); setBranchStatus(null);
                    try {
                      const res  = await fetch(`http://localhost:3000/api/it/employee/${lookedUpEmp.id}/branch`, {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ branch_id: newBranchId || undefined, secondary_branch_id: newSecBranchId || undefined, submitted_by_id: user?.id, submitted_by_name: user?.name }),
                      });
                      const data = await res.json();
                      setBranchStatus({ type: res.ok ? 'success' : 'error', msg: data.message || data.error });
                    } catch { setBranchStatus({ type: 'error', msg: 'Network error.' }); }
                    setBranchLoading(false);
                  }} className="it-btn" disabled={branchLoading || !lookedUpEmp} style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                    {branchLoading ? <><span className="spinner" style={{ width: 13, height: 13 }} />Submitting...</> : <><Icon d={IC.branch} size={13} />Request Branch Transfer</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
