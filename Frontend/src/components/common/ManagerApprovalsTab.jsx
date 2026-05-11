/**
 * ManagerApprovalsTab.jsx — Tab Component (Strategy Pattern)
 *
 * Extracted from ManagerDashboardStrategy.jsx / old Dashboard.jsx (~line 1937–2449).
 *
 * Renders the full "Pending Manager Approvals" view including:
 *   - Standard approval cards (UPDATE_INFO, UPDATE_EMAIL, UPDATE_BRANCH,
 *     ADD_PRODUCT, DELETE_PRODUCT, DELETE_TICKET, SALARY_ADJUSTMENT, LEAVE_REQUEST)
 *   - Owner-only sub-tabs: PR Campaigns + Expense Approvals
 *   - Finance Manager-only sub-tab: Pending Reports
 *
 * Props (all from ManagerDashboardStrategy — no context reads):
 *   approvals                {Array}    — standard pending approval tickets
 *   apprLoading              {boolean}
 *   ownerCampaigns           {Array}    — Owner only: pending PR campaigns
 *   ownerCampaignsLoading    {boolean}
 *   approvalExpenses         {Array}    — Owner + Finance Manager: pending expenses
 *   approvalExpensesLoading  {boolean}
 *   approvalSubTab           {string}   — 'approvals' | 'pr_campaigns' | 'expense_approvals'
 *   setApprovalSubTab        {Function}
 *   onResolveApproval        {Function(ticketId, 'approve'|'reject')}
 *   onResolveCampaign        {Function(ticketId, 'approve'|'reject')}
 *   onResolveExpense         {Function(ticketId, 'approve'|'reject')}
 *   onRefresh                {Function} — reload all data
 *   isOwner                  {boolean}
 *   isFinanceManager         {boolean}
 *   language                 {string}
 */

import Icon, { IC } from '../../components/ui/Icon';

// ── Local helpers ─────────────────────────────────────────────────────────────

const fmtDate = (s) => {
  try {
    return new Date(s).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return s; }
};

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

const ACTION_META = {
  UPDATE_INFO:       { label: 'Employee Info Update',          icon: IC.user,     color: '#10b981' },
  UPDATE_EMAIL:      { label: 'Login Email Update',            icon: IC.mail,     color: '#8b5cf6' },
  UPDATE_BRANCH:     { label: 'Branch Reassignment',           icon: IC.branch,   color: '#f59e0b' },
  ADD_PRODUCT:       { label: 'Add New Product',               icon: IC.plus,     color: '#06b6d4' },
  DELETE_PRODUCT:    { label: 'Delete Product',                icon: IC.trash,    color: '#ef4444' },
  DELETE_TICKET:     { label: 'Delete Ticket (Admin Request)', icon: IC.trash,    color: '#ef4444' },
  SALARY_ADJUSTMENT: { label: 'Salary Adjustment',            icon: IC.money,    color: '#f59e0b' },
  LEAVE_REQUEST:     { label: 'Leave Request',                 icon: IC.calendar, color: '#4f7cff' },
};

const FIELD_LABELS = {
  first_name: 'First Name', last_name: 'Last Name', phone: 'Phone',
  address: 'Address', email: 'Email', primary_branch: 'Primary Branch',
  secondary_branch: 'Secondary Branch', salary: 'Salary',
};

const CAMP_COLOR = {
  'Social Media': '#06b6d4', 'Email Campaign': '#8b5cf6', 'Influencer': '#ec4899',
  'Content Marketing': '#10b981', 'Paid Ads': '#f59e0b', 'Event': '#f97316', 'SEO/SEM': '#4f7cff',
};

const EXP_CAT_COLOR = {
  Travel: '#f59e0b', Equipment: '#06b6d4', Software: '#8b5cf6',
  Training: '#10b981', 'Office Supplies': '#f97316', 'Meals & Entertainment': '#f59e0b',
  Marketing: '#ec4899', Other: '#94a3b8',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ApprovalCard({ appr, onResolve }) {
  let data = {};
  try { data = JSON.parse(appr.description.replace('[PENDING_APPROVAL] ', '')); } catch {}

  const meta = ACTION_META[data.action] || { label: data.action || 'Request', icon: IC.layers, color: '#4f7cff' };
  const changes = data.changes || {};
  const hasChanges = Object.keys(changes).length > 0;
  const isDeleteTicket = data.action === 'DELETE_TICKET';
  const isAddProduct   = data.action === 'ADD_PRODUCT';
  const isSalary       = data.action === 'SALARY_ADJUSTMENT';
  const isLeave        = data.action === 'LEAVE_REQUEST';
  const isDeleteProd   = data.action === 'DELETE_PRODUCT';

  return (
    <div className="ticket-card" style={{ display: 'flex', alignItems: 'stretch' }}>
      <div style={{
        width: 6, flexShrink: 0,
        background: `linear-gradient(180deg,${meta.color},${meta.color}44)`,
        borderRadius: '12px 0 0 12px',
      }} />
      <div style={{ padding: '22px 26px', flex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 5 }}>
              Request #{appr.ticket_id}
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: `${meta.color}18`, border: `1px solid ${meta.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon d={meta.icon} size={16} color={meta.color} />
              </div>
              {meta.label}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 600 }}>
            {fmtDate(appr.time)}
          </div>
        </div>

        {/* Submitter + Target row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {data.submitted_by && (
            <div style={{ flex: 1, minWidth: 160, padding: '11px 14px', borderRadius: 10, background: 'rgba(79,124,255,0.06)', border: '1px solid rgba(79,124,255,0.18)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent2)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>Submitted By</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{data.submitted_by.name}</div>
              {data.submitted_by.id && <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>ID #{data.submitted_by.id}</div>}
            </div>
          )}
          {data.target_emp_id && (
            <div style={{ flex: 1, minWidth: 160, padding: '11px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>Target Employee</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>ID #{data.target_emp_id}</div>
              {isSalary && data.adjustment && (
                <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>
                  {data.adjustment.type === 'bonus' ? '🟢 Bonus' : '🔴 Deduction'} · {data.adjustment.amount?.toLocaleString()} EGP
                </div>
              )}
            </div>
          )}
        </div>

        {/* Before / After diff */}
        {hasChanges && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Proposed Changes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(changes).map(([field, val]) => (
                <div key={field} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 20px 1fr', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'capitalize' }}>
                    {FIELD_LABELS[field] || field.replace(/_/g, ' ')}
                  </div>
                  <div style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12, color: '#f87171', fontWeight: 600, wordBreak: 'break-all' }}>
                    {val.before}
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  <div style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.22)', fontSize: 12, color: '#34d399', fontWeight: 600, wordBreak: 'break-all' }}>
                    {val.after}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Salary reason */}
        {isSalary && data.adjustment?.reason && (
          <div style={{ marginBottom: 16, padding: '11px 14px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>Reason</div>
            <div style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.6 }}>{data.adjustment.reason}</div>
          </div>
        )}

        {/* Add Product details */}
        {isAddProduct && data.payload && (
          <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>New Product Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {Object.entries(data.payload).filter(([k, v]) => v && k !== 'image').map(([k, v]) => (
                <div key={k}>
                  <span style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 700, textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}: </span>
                  <span style={{ fontSize: 12, color: 'var(--txt)', fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete Product details */}
        {isDeleteProd && data.payload && (
          <div style={{ marginBottom: 16, padding: '16px 18px', borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.22)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon d={IC.trash} size={13} color="#ef4444" />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Product Marked for Deletion</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', marginTop: 2 }}>{data.payload.name || '(Unknown Product)'}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
              {[
                { label: 'Product ID',      value: data.payload.product_id,                                                                    color: '#94a3b8' },
                { label: 'Type',            value: data.payload.type || '—',                                                                    color: '#06b6d4' },
                { label: 'Model',           value: data.payload.model || '—',                                                                   color: '#8b5cf6' },
                { label: 'Sale Price',      value: data.payload.price_after_profit ? `${Number(data.payload.price_after_profit).toLocaleString()} EGP` : '—', color: '#f59e0b' },
                { label: 'Stock Remaining', value: data.payload.amount_avail != null ? `${Number(data.payload.amount_avail).toLocaleString()} units` : '—', color: data.payload.amount_avail > 0 ? '#ef4444' : '#10b981' },
              ].map((f, i) => (
                <div key={i} style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{f.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: f.color }}>{f.value}</div>
                </div>
              ))}
            </div>
            {data.payload.amount_avail > 0 && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon d={IC.warn} size={11} color="#f87171" />
                <strong>Warning:</strong>&nbsp;This product still has {Number(data.payload.amount_avail).toLocaleString()} units in stock. Deleting will remove it permanently.
              </div>
            )}
            {data.payload.removal_reason && (
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Reason for Removal</div>
                <div style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.6 }}>{data.payload.removal_reason}</div>
              </div>
            )}
          </div>
        )}

        {/* Delete Ticket details */}
        {isDeleteTicket && (
          <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>
              Ticket to delete: {data.ticket_summary || `#${data.ticket_id}`}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Reason from Admin</div>
            <div style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.6 }}>{data.reason || '—'}</div>
          </div>
        )}

        {/* Leave Request details */}
        {isLeave && (
          <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 10, background: 'rgba(79,124,255,0.05)', border: '1px solid rgba(79,124,255,0.2)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4f7cff', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>Leave Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[
                { label: 'Employee',  value: data.emp_name   || `ID #${data.target_emp_id}`, sub: data.emp_name ? `ID #${data.target_emp_id}` : null },
                { label: 'Leave Type', value: data.leave_type || '—', sub: null },
                { label: 'Start Date', value: data.start_date || '—', sub: null },
                { label: 'End Date',   value: data.end_date   || '—', sub: null },
              ].map((f, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>{f.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: f.label === 'Leave Type' ? '#4f7cff' : 'var(--txt)' }}>{f.value}</div>
                  {f.sub && <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>{f.sub}</div>}
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Reason</div>
              <div style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.6 }}>{data.reason || '—'}</div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => onResolve(appr.ticket_id, 'approve')}
            style={{ padding: '11px 20px', borderRadius: 9, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flex: 1, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
          >
            <Icon d={IC.check} size={13} color="#10b981" />
            {isDeleteTicket ? 'Approve Deletion' : isSalary ? `Approve ${data.adjustment?.type === 'bonus' ? 'Bonus' : 'Deduction'}` : isLeave ? 'Approve & Apply Leave' : 'Approve & Apply'}
          </button>
          <button
            onClick={() => onResolve(appr.ticket_id, 'reject')}
            style={{ padding: '11px 20px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flex: 1, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
          >
            <Icon d={IC.warn} size={13} color="#ef4444" />
            {isDeleteTicket ? 'Reject Request' : 'Reject & Discard'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PRCampaignsPane({ ownerCampaigns, ownerCampaignsLoading, onResolveCampaign }) {
  if (ownerCampaignsLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--txt3)', fontSize: 13 }}><span className="spinner" style={{ width: 15, height: 15 }} /> Loading campaigns...</div>;
  }
  if (!ownerCampaigns.length) {
    return (
      <div style={{ padding: '52px', textAlign: 'center', color: 'var(--txt3)', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16 }}>
        <Icon d={IC.check} size={32} color="var(--border2)" style={{ margin: '0 auto 14px', display: 'block' }} />
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>No pending campaigns</div>
        <div style={{ fontSize: 13 }}>All campaign requests have been reviewed.</div>
      </div>
    );
  }
  return (
    <div>
      {ownerCampaigns.map((c) => {
        const isPR   = c._type === 'press_release';
        const col    = isPR ? '#8b5cf6' : (CAMP_COLOR[c.campaign_type] || '#94a3b8');
        const label  = isPR ? 'Press Release' : (c.campaign_type || 'Campaign');
        const title  = isPR ? c.title : c.campaign_name;
        return (
          <div key={c.ticket_id} className="ticket-card" style={{ marginBottom: 14 }}>
            <div style={{ height: 3, background: `linear-gradient(90deg,${col},${col}55)` }} />
            <div style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: `${col}18`, color: col, border: `1px solid ${col}35`, whiteSpace: 'nowrap' }}>{label}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)' }}>{title || '—'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                    By <strong style={{ color: 'var(--txt2)' }}>{c.emp_name}</strong> &middot; {fmtDate(c.submitted_at || c.time)}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--txt3)', marginLeft: 12 }}>#{c.ticket_id}</div>
              </div>

              {isPR ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8, marginBottom: 12 }}>
                    {c.target_date && <div style={{ fontSize: 11, color: 'var(--txt3)', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 8 }}><strong style={{ color: 'var(--txt2)' }}>📅 Release Date:</strong> {c.target_date}</div>}
                    {c.media_outlets && <div style={{ fontSize: 11, color: 'var(--txt3)', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 8 }}><strong style={{ color: 'var(--txt2)' }}>📡 Media Outlets:</strong> {c.media_outlets}</div>}
                  </div>
                  {c.content && <div style={{ fontSize: 13, color: 'var(--txt2)', padding: '12px 14px', background: 'var(--surface2)', borderRadius: 10, marginBottom: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', maxHeight: 220, overflowY: 'auto', borderLeft: `3px solid ${col}` }}>{c.content}</div>}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8, marginBottom: 12 }}>
                    {c.platform     && <div style={{ fontSize: 11, color: 'var(--txt3)', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 8 }}><strong style={{ color: 'var(--txt2)' }}>🌐 Platform:</strong> {c.platform}</div>}
                    {c.budget > 0   && <div style={{ fontSize: 11, color: 'var(--txt3)', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 8 }}><strong style={{ color: 'var(--txt2)' }}>💰 Budget:</strong> {Number(c.budget).toLocaleString()} EGP</div>}
                    {(c.campaign_start_date || c.campaign_end_date) && <div style={{ fontSize: 11, color: 'var(--txt3)', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 8 }}><strong style={{ color: 'var(--txt2)' }}>📅 Duration:</strong> {c.campaign_start_date || '?'} → {c.campaign_end_date || '?'}</div>}
                    {c.target_audience && <div style={{ fontSize: 11, color: 'var(--txt3)', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 8 }}><strong style={{ color: 'var(--txt2)' }}>🎯 Audience:</strong> {c.target_audience}</div>}
                  </div>
                  {c.notes && <div style={{ fontSize: 12, color: 'var(--txt2)', padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 12, lineHeight: 1.6, borderLeft: `3px solid ${col}` }}><strong>Notes:</strong> {c.notes}</div>}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => onResolveCampaign(c.ticket_id, 'approve')} style={{ flex: 1, padding: '10px', borderRadius: 9, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icon d={IC.check} size={13} color="#10b981" /> {isPR ? 'Approve Release' : 'Approve Campaign'}
                </button>
                <button onClick={() => onResolveCampaign(c.ticket_id, 'reject')} style={{ flex: 1, padding: '10px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icon d={IC.warn} size={13} color="#ef4444" /> Reject
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExpenseApprovalsPane({ approvalExpenses, approvalExpensesLoading, isOwner, onResolveExpense }) {
  const pendingItems  = approvalExpenses.filter(e => e.stage !== 'approved_by_owner');
  const approvedItems = approvalExpenses.filter(e => e.stage === 'approved_by_owner');

  if (approvalExpensesLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--txt3)', fontSize: 13 }}><span className="spinner" style={{ width: 15, height: 15 }} /> Loading expense reports...</div>;
  }
  if (!pendingItems.length) {
    return (
      <div style={{ padding: '52px', textAlign: 'center', color: 'var(--txt3)', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16 }}>
        <Icon d={IC.check} size={32} color="var(--border2)" style={{ margin: '0 auto 14px', display: 'block' }} />
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>No pending expense reports</div>
      </div>
    );
  }

  return (
    <div>
      {pendingItems.map((exp) => {
        const col          = EXP_CAT_COLOR[exp.category] || '#94a3b8';
        const isOwnerStage = exp.stage === 'pending_owner';
        const approveLabel = isOwnerStage ? 'Final Approve' : 'Approve → Escalate to Owner';
        return (
          <div key={exp.ticket_id} className="ticket-card" style={{ marginBottom: 14 }}>
            <div style={{ height: 3, background: `linear-gradient(90deg,${col},${col}55)` }} />
            <div style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: `${col}18`, color: col, border: `1px solid ${col}35` }}>{exp.category}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>{Number(exp.amount || 0).toLocaleString()} EGP</span>
                    {isOwnerStage && <span style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', padding: '2px 8px', borderRadius: 999 }}>Manager Approved ✓</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                    by <strong style={{ color: 'var(--txt2)' }}>{exp.emp_name}</strong> · {fmtDate(exp.submitted_at || exp.time)}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--txt3)' }}>#{exp.ticket_id}</div>
              </div>
              {exp.description && (
                <div style={{ fontSize: 13, color: 'var(--txt2)', padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 12, lineHeight: 1.6, borderLeft: `3px solid ${col}` }}>
                  {exp.description}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => onResolveExpense(exp.ticket_id, 'approve')} style={{ flex: 1, padding: '10px', borderRadius: 9, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icon d={IC.check} size={13} color="#10b981" /> {approveLabel}
                </button>
                <button onClick={() => onResolveExpense(exp.ticket_id, 'reject')} style={{ flex: 1, padding: '10px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Icon d={IC.warn} size={13} color="#ef4444" /> Reject
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Finance Manager: owner-approved items shown as read-only notifications */}
      {!isOwner && approvedItems.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>✓ Approved by Owner</div>
          {approvedItems.map((exp, i) => {
            const col = EXP_CAT_COLOR[exp.category] || '#94a3b8';
            return (
              <div key={exp.ticket_id || i} className="ticket-card" style={{ marginBottom: 10, opacity: 0.85 }}>
                <div style={{ height: 3, background: 'linear-gradient(90deg,#10b981,#10b98155)' }} />
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: `${col}18`, color: col, border: `1px solid ${col}35` }}>{exp.category}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)' }}>{Number(exp.amount || 0).toLocaleString()} EGP</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 10px', borderRadius: 999 }}>✓ Owner Approved</span>
                  <span style={{ fontSize: 11, color: 'var(--txt3)' }}>by <strong style={{ color: 'var(--txt2)' }}>{exp.emp_name}</strong> · {fmtDate(exp.approved_at || exp.submitted_at)}</span>
                  {exp.description && <span style={{ fontSize: 12, color: 'var(--txt3)', marginLeft: 'auto' }}>{exp.description}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ManagerApprovalsTab({
  approvals              = [],
  apprLoading            = false,
  ownerCampaigns         = [],
  ownerCampaignsLoading  = false,
  approvalExpenses       = [],
  approvalExpensesLoading = false,
  approvalSubTab         = 'approvals',
  setApprovalSubTab,
  onResolveApproval,
  onResolveCampaign,
  onResolveExpense,
  onRefresh,
  isOwner        = false,
  isFinanceManager = false,
  language       = 'en',
}) {
  const isAnyLoading = apprLoading || ownerCampaignsLoading || approvalExpensesLoading;

  // Owner sub-tab nav items
  const ownerTabs = [
    { id: 'approvals',         label: 'Manager Approvals', icon: IC.check  },
    { id: 'pr_campaigns',      label: 'PR Campaigns',      icon: IC.layers },
    { id: 'expense_approvals', label: 'Expense Approvals', icon: IC.money  },
  ];

  // Finance Manager sub-tab nav items
  const fmTabs = [
    { id: 'approvals',         label: 'Manager Approvals', icon: IC.check },
    { id: 'expense_approvals', label: 'Pending Reports',   icon: IC.money },
  ];

  const tabBtnStyle = (id) => ({
    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10,
    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, transition: 'all .2s',
    background: approvalSubTab === id ? 'rgba(79,124,255,0.12)' : 'transparent',
    border: '1.5px solid ' + (approvalSubTab === id ? 'rgba(79,124,255,0.4)' : 'transparent'),
    color: approvalSubTab === id ? 'var(--accent2)' : 'var(--txt3)',
  });

  const BadgePill = ({ count }) => count > 0 ? (
    <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)', padding: '1px 7px', borderRadius: 999, marginLeft: 4 }}>
      {count}
    </span>
  ) : null;

  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      <SectionHead title={language === 'ar' ? 'الموافقات المعلقة' : 'Pending Manager Approvals'} />

      {/* ── Owner sub-tab bar ───────────────────────────────────────────────── */}
      {isOwner && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          {ownerTabs.map(t => (
            <button key={t.id} onClick={() => setApprovalSubTab(t.id)} style={tabBtnStyle(t.id)}>
              <Icon d={t.icon} size={14} color={approvalSubTab === t.id ? 'var(--accent2)' : 'var(--txt3)'} />
              {t.label}
              {t.id === 'pr_campaigns'      && <BadgePill count={ownerCampaigns.length} />}
              {t.id === 'expense_approvals' && <BadgePill count={approvalExpenses.length} />}
            </button>
          ))}
          <button onClick={onRefresh} style={{ marginLeft: 'auto', padding: '7px 16px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            {isAnyLoading ? <span className="spinner" style={{ width: 11, height: 11 }} /> : '↻'} Refresh
          </button>
        </div>
      )}

      {/* ── Finance Manager sub-tab bar ─────────────────────────────────────── */}
      {isFinanceManager && !isOwner && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          {fmTabs.map(t => {
            const ownerApprovedCount = approvalExpenses.filter(e => e.stage === 'approved_by_owner').length;
            const pendingCount       = approvalExpenses.filter(e => e.stage !== 'approved_by_owner').length;
            return (
              <button key={t.id} onClick={() => setApprovalSubTab(t.id)} style={tabBtnStyle(t.id)}>
                <Icon d={t.icon} size={14} color={approvalSubTab === t.id ? 'var(--accent2)' : 'var(--txt3)'} />
                {t.label}
                {t.id === 'approvals' && ownerApprovedCount > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '1px 7px', borderRadius: 999, marginLeft: 4 }}>
                    {ownerApprovedCount}
                  </span>
                )}
                {t.id === 'expense_approvals' && pendingCount > 0 && <BadgePill count={pendingCount} />}
              </button>
            );
          })}
          <button onClick={onRefresh} style={{ marginLeft: 'auto', padding: '7px 16px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            {isAnyLoading ? <span className="spinner" style={{ width: 11, height: 11 }} /> : '↻'} Refresh
          </button>
        </div>
      )}

      {/* ── PR Campaigns pane (Owner only) ─────────────────────────────────── */}
      {isOwner && approvalSubTab === 'pr_campaigns' && (
        <PRCampaignsPane
          ownerCampaigns={ownerCampaigns}
          ownerCampaignsLoading={ownerCampaignsLoading}
          onResolveCampaign={onResolveCampaign}
        />
      )}

      {/* ── Expense Approvals pane ─────────────────────────────────────────── */}
      {((isOwner && approvalSubTab === 'expense_approvals') ||
        (isFinanceManager && !isOwner && approvalSubTab === 'expense_approvals')) && (
        <ExpenseApprovalsPane
          approvalExpenses={approvalExpenses}
          approvalExpensesLoading={approvalExpensesLoading}
          isOwner={isOwner}
          onResolveExpense={onResolveExpense}
        />
      )}

      {/* ── Standard Approvals list ────────────────────────────────────────── */}
      {((!isOwner && !isFinanceManager) || approvalSubTab === 'approvals') && (
        <div>
          {apprLoading ? (
            <div style={{ color: 'var(--txt2)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="spinner" style={{ width: 16, height: 16 }} /> Loading requests...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {approvals.map((appr, i) => (
                <ApprovalCard
                  key={appr.ticket_id}
                  appr={appr}
                  onResolve={onResolveApproval}
                />
              ))}

              {/* Finance Manager: owner-approved items inline with standard approvals */}
              {isFinanceManager && !isOwner && approvalExpenses.filter(e => e.stage === 'approved_by_owner').length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>✓ Approved by Owner</div>
                  {approvalExpenses.filter(e => e.stage === 'approved_by_owner').map((exp, i) => {
                    const col = EXP_CAT_COLOR[exp.category] || '#94a3b8';
                    return (
                      <div key={exp.ticket_id || i} className="ticket-card" style={{ marginBottom: 10, opacity: 0.85 }}>
                        <div style={{ height: 3, background: 'linear-gradient(90deg,#10b981,#10b98155)' }} />
                        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: `${col}18`, color: col, border: `1px solid ${col}35` }}>{exp.category}</span>
                          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)' }}>{Number(exp.amount || 0).toLocaleString()} EGP</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 10px', borderRadius: 999 }}>✓ Owner Approved</span>
                          <span style={{ fontSize: 11, color: 'var(--txt3)' }}>by <strong style={{ color: 'var(--txt2)' }}>{exp.emp_name}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {approvals.length === 0 && approvalExpenses.filter(e => e.stage === 'approved_by_owner').length === 0 && (
                <div style={{ padding: '52px', textAlign: 'center', color: 'var(--txt3)', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16 }}>
                  <Icon d={IC.check} size={32} color="var(--border2)" style={{ margin: '0 auto 14px', display: 'block' }} />
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>All clear!</div>
                  <div style={{ fontSize: 13 }}>No pending requests requiring your approval.</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
