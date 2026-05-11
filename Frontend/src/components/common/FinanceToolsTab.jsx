/**
 * FinanceToolsTab.jsx — Tab Component (Strategy Pattern)
 *
 * Extracted from FinanceDashboardStrategy.jsx / old Dashboard.jsx.
 *
 * Renders the Finance Tools view for Finance department employees:
 *   - Submit Expense sub-tab  — category selector, amount, description, receipt ref
 *   - My Submissions sub-tab  — chronological list of the user's expense reports
 *   - Pending Reports sub-tab — approval queue (Finance Manager / Owner only)
 *
 * Props (all injected by FinanceDashboardStrategy — no context reads):
 *   user                   {object}           — from useAuth()
 *   language               {string}
 *   isFinanceManager       {boolean}
 *   isOwner                {boolean}
 *   // Expense submission
 *   expCategory            {string}
 *   setExpCategory         {Function}
 *   expAmount              {string}
 *   setExpAmount           {Function}
 *   expDesc                {string}
 *   setExpDesc             {Function}
 *   expReceipt             {string}
 *   setExpReceipt          {Function}
 *   expStatus              {object|null}       — { type: 'success'|'error', msg }
 *   expLoading             {boolean}
 *   onSubmitExpense        {Function}
 *   // My expenses
 *   myExpenses             {Array}
 *   myExpensesLoading      {boolean}
 *   onLoadMyExpenses       {Function}
 *   // Pending expenses (manager/owner)
 *   pendingExpenses        {Array}
 *   pendingExpensesLoading {boolean}
 *   onLoadPendingExpenses  {Function}
 *   onResolveExpense       {Function(ticketId, action)}
 *   // Sub-tab
 *   financeActiveTab       {string}            — 'expense' | 'history' | 'pending'
 *   setFinanceActiveTab    {Function}
 */

import Icon, { IC, FastInput, FastTextArea } from '../ui/Icon';

// ── Constants ─────────────────────────────────────────────────────────────────

const EXP_CATEGORIES = [
  'Travel', 'Meals & Entertainment', 'Office Supplies',
  'Equipment', 'Software', 'Training', 'Marketing', 'Other',
];

const CAT_COLOR = {
  'Travel':                '#5b8fff',
  'Meals & Entertainment': '#f59e0b',
  'Office Supplies':       '#10b981',
  'Equipment':             '#8b5cf6',
  'Software':              '#06b6d4',
  'Training':              '#ec4899',
  'Marketing':             '#f97316',
  'Other':                 '#94a3b8',
};

const fmtEGP  = v => Number(v || 0).toLocaleString('en-US') + ' EGP';
const fmtDate = s => {
  try {
    return new Date(s).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return s; }
};

// ── Sub-components ────────────────────────────────────────────────────────────

const SectionHead = ({ title }) => (
  <div style={{ marginBottom: 26 }}>
    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.4px' }}>
      {title}
    </h1>
    <div style={{
      height: 3, width: 44,
      background: 'linear-gradient(90deg,var(--accent),var(--accent2))',
      borderRadius: 2, marginTop: 7,
    }} />
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────

export default function FinanceToolsTab({
  // Auth / role
  isFinanceManager       = false,
  isOwner                = false,
  language               = 'en',

  // Expense submission
  expCategory            = 'Travel',
  setExpCategory,
  expAmount              = '',
  setExpAmount,
  expDesc                = '',
  setExpDesc,
  expReceipt             = '',
  setExpReceipt,
  expStatus              = null,
  expLoading             = false,
  onSubmitExpense,

  // My expenses
  myExpenses             = [],
  myExpensesLoading      = false,
  onLoadMyExpenses,

  // Pending expenses (manager / owner)
  pendingExpenses        = [],
  pendingExpensesLoading = false,
  onLoadPendingExpenses,
  onResolveExpense,

  // Sub-tab
  financeActiveTab       = 'expense',
  setFinanceActiveTab,
}) {
  // Build the sub-tab list dynamically based on role
  const TABS = [
    { id: 'expense',  label: 'Submit Expense',    icon: IC.money  },
    { id: 'history',  label: 'My Submissions',     icon: IC.layers },
    ...(isFinanceManager || isOwner
      ? [{ id: 'pending', label: 'Pending Reports', icon: IC.check }]
      : []),
  ];

  const handleTabClick = (tabId) => {
    setFinanceActiveTab(tabId);
    if (tabId === 'history')  onLoadMyExpenses?.();
    if (tabId === 'pending')  onLoadPendingExpenses?.();
  };

  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <SectionHead title="Finance Tools" />
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: -18 }}>
          Submit and track your expense reports.
        </div>
      </div>

      {/* ── Sub-tab nav ── */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 24,
        borderBottom: '1px solid var(--border)', paddingBottom: 12,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => handleTabClick(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 700, fontSize: 13, transition: 'all .2s',
              background: financeActiveTab === t.id ? 'rgba(79,124,255,0.12)' : 'transparent',
              border: `1.5px solid ${financeActiveTab === t.id ? 'rgba(79,124,255,0.4)' : 'transparent'}`,
              color: financeActiveTab === t.id ? 'var(--accent2)' : 'var(--txt3)',
            }}
          >
            <Icon d={t.icon} size={13} color={financeActiveTab === t.id ? 'var(--accent2)' : 'var(--txt3)'} />
            {t.label}
            {t.id === 'pending' && pendingExpenses.length > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 800,
                background: 'rgba(239,68,68,0.2)', color: '#fca5a5',
                border: '1px solid rgba(239,68,68,0.3)', padding: '1px 7px', borderRadius: 999,
              }}>
                {pendingExpenses.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══ SUBMIT EXPENSE ══ */}
      {financeActiveTab === 'expense' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
          {/* Form card */}
          <div className="ticket-card">
            <div style={{ height: 4, background: 'linear-gradient(90deg,#f59e0b,#f59e0b55)' }} />
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon d={IC.money} size={15} color="#f59e0b" />
                Expense Report
                <span style={{
                  marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#f59e0b',
                  background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                  padding: '3px 10px', borderRadius: 999,
                }}>
                  Manager → Owner Approval
                </span>
              </div>

              {/* Status banner */}
              {expStatus && (
                <div style={{
                  padding: '10px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: expStatus.type === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                  color:      expStatus.type === 'error' ? '#ef4444' : '#10b981',
                  border:    `1px solid ${expStatus.type === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.22)'}`,
                }}>
                  <Icon d={expStatus.type === 'error' ? IC.warn : IC.check} size={13} />
                  {expStatus.msg}
                </div>
              )}

              {/* Category selector */}
              <div>
                <label style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--txt2)',
                  textTransform: 'uppercase', letterSpacing: '0.6px',
                }}>
                  Category
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {EXP_CATEGORIES.map(c => {
                    const col = CAT_COLOR[c] || '#94a3b8';
                    return (
                      <button
                        key={c}
                        onClick={() => setExpCategory?.(c)}
                        style={{
                          padding: '6px 13px', borderRadius: 9, cursor: 'pointer',
                          fontFamily: 'inherit', fontWeight: 700, fontSize: 11, transition: 'all .18s',
                          background: expCategory === c ? `${col}18` : 'var(--surface2)',
                          border:    `1.5px solid ${expCategory === c ? col + '55' : 'var(--border)'}`,
                          color:      expCategory === c ? col : 'var(--txt3)',
                        }}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--txt2)',
                  textTransform: 'uppercase', letterSpacing: '0.6px',
                }}>
                  Amount (EGP)
                </label>
                <div style={{ position: 'relative', marginTop: 6 }}>
                  <input
                    type="number"
                    min="1"
                    value={expAmount}
                    onChange={e => setExpAmount?.(e.target.value)}
                    className="it-input"
                    style={{ marginTop: 0, paddingRight: 50 }}
                    placeholder="0.00"
                  />
                  <span style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 12, fontWeight: 700, color: 'var(--txt3)',
                  }}>
                    EGP
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--txt2)',
                  textTransform: 'uppercase', letterSpacing: '0.6px',
                }}>
                  Description
                </label>
                <FastTextArea
                  value={expDesc}
                  onChange={v => setExpDesc?.(v)}
                  className="it-input"
                  rows="3"
                  style={{ resize: 'vertical', marginTop: 6 }}
                  placeholder="Describe the expense and business purpose..."
                />
              </div>

              {/* Receipt ref */}
              <div>
                <label style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--txt2)',
                  textTransform: 'uppercase', letterSpacing: '0.6px',
                }}>
                  Receipt Reference (optional)
                </label>
                <FastInput
                  value={expReceipt}
                  onChange={v => setExpReceipt?.(v)}
                  className="it-input"
                  style={{ marginTop: 6 }}
                  placeholder="Invoice #, receipt ID, or note..."
                />
              </div>

              <button
                onClick={onSubmitExpense}
                disabled={expLoading || !expAmount || !expDesc.trim()}
                className="it-btn"
                style={{
                  marginTop: 0, background: '#f59e0b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: (expLoading || !expAmount || !expDesc.trim()) ? 0.5 : 1,
                }}
              >
                {expLoading
                  ? <><span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,.3)', borderTopColor: '#fff' }} />Submitting...</>
                  : <><Icon d={IC.money} size={14} />Submit Expense Report</>}
              </button>
            </div>
          </div>

          {/* Category legend */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '18px 20px',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--txt3)',
              textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12,
            }}>
              Categories
            </div>
            {EXP_CATEGORIES.map(c => {
              const col = CAT_COLOR[c] || '#94a3b8';
              return (
                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: col, boxShadow: `0 0 4px ${col}80`, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 12, color: 'var(--txt2)' }}>{c}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ MY SUBMISSIONS ══ */}
      {financeActiveTab === 'history' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              onClick={onLoadMyExpenses}
              style={{
                padding: '7px 16px', borderRadius: 9, background: 'var(--surface)',
                border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 12,
                fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {myExpensesLoading
                ? <span className="spinner" style={{ width: 11, height: 11 }} />
                : '↻'}
              Refresh
            </button>
          </div>

          {myExpensesLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--txt3)', fontSize: 13 }}>
              <span className="spinner" style={{ width: 15, height: 15 }} /> Loading...
            </div>
          )}

          {!myExpensesLoading && myExpenses.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '52px',
              background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16,
              color: 'var(--txt3)',
            }}>
              <Icon d={IC.money} size={32} color="var(--border2)" style={{ margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontSize: 14, fontWeight: 700 }}>No expense reports submitted yet</div>
            </div>
          )}

          {myExpenses.map(exp => {
            const col         = CAT_COLOR[exp.category] || '#94a3b8';
            const isApproved  = exp.stage === 'approved_by_owner';
            const isPendOwner = exp.stage === 'pending_owner';
            const statusColor = isApproved ? '#10b981' : isPendOwner ? '#8b5cf6' : '#f59e0b';
            const statusLabel = exp.status || 'Awaiting Manager Approval';
            const statusIcon  = isApproved ? '✓' : '⏳';

            return (
              <div
                key={exp.ticket_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '13px 18px', borderRadius: 12,
                  background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 10,
                }}
              >
                <div style={{ width: 3, height: 44, borderRadius: 3, background: col, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                      background: `${col}18`, color: col, border: `1px solid ${col}35`,
                    }}>
                      {exp.category}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent2)' }}>
                      {fmtEGP(exp.amount)}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                      background: `${statusColor}15`, color: statusColor,
                      border: `1px solid ${statusColor}35`,
                    }}>
                      {statusIcon} {statusLabel}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--txt3)', marginLeft: 'auto' }}>
                      {fmtDate(exp.time)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 12, color: 'var(--txt3)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {exp.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ PENDING REPORTS (Finance Manager / Owner) ══ */}
      {financeActiveTab === 'pending' && (isFinanceManager || isOwner) && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              onClick={onLoadPendingExpenses}
              style={{
                padding: '7px 16px', borderRadius: 9, background: 'var(--surface)',
                border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 12,
                fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {pendingExpensesLoading
                ? <span className="spinner" style={{ width: 11, height: 11 }} />
                : '↻'}
              Refresh
            </button>
          </div>

          {pendingExpensesLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--txt3)', fontSize: 13 }}>
              <span className="spinner" style={{ width: 15, height: 15 }} /> Loading...
            </div>
          )}

          {!pendingExpensesLoading && pendingExpenses.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '52px', background: 'var(--surface)',
              border: '1px dashed var(--border)', borderRadius: 16,
            }}>
              <Icon d={IC.check} size={32} color="var(--border2)" style={{ margin: '0 auto 14px', display: 'block' }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt3)' }}>No pending expense reports</div>
            </div>
          )}

          {pendingExpenses.map(exp => {
            const col          = CAT_COLOR[exp.category] || '#94a3b8';
            const isOwnerStage = exp.stage === 'pending_owner';
            const approveLabel = isOwnerStage ? 'Final Approve' : 'Approve → Escalate to Owner';

            return (
              <div key={exp.ticket_id} className="ticket-card" style={{ marginBottom: 12 }}>
                <div style={{ height: 3, background: `linear-gradient(90deg,${col},${col}55)` }} />
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                          background: `${col}18`, color: col, border: `1px solid ${col}35`,
                        }}>
                          {exp.category}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)' }}>
                          {fmtEGP(exp.amount)}
                        </span>
                        {isOwnerStage && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: '#8b5cf6',
                            background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)',
                            padding: '2px 8px', borderRadius: 999,
                          }}>
                            Manager Approved ✓
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4 }}>
                        by <strong style={{ color: 'var(--txt2)' }}>{exp.emp_name}</strong>
                        {' · '}{fmtDate(exp.time)}
                      </div>
                    </div>
                  </div>

                  {exp.description && (
                    <div style={{
                      fontSize: 12, color: 'var(--txt2)',
                      padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 12,
                    }}>
                      {exp.description}
                    </div>
                  )}

                  {exp.receipt_note && (
                    <div style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 12 }}>
                      Receipt: {exp.receipt_note}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => onResolveExpense?.(exp.ticket_id, 'approve')}
                      style={{
                        flex: 1, padding: '9px', borderRadius: 9,
                        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                        color: '#10b981', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <Icon d={IC.check} size={12} color="#10b981" /> {approveLabel}
                    </button>
                    <button
                      onClick={() => onResolveExpense?.(exp.ticket_id, 'reject')}
                      style={{
                        flex: 1, padding: '9px', borderRadius: 9,
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                        color: '#ef4444', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <Icon d={IC.warn} size={12} color="#ef4444" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
