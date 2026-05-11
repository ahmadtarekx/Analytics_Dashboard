/**
 * HRAdjustmentsTab.jsx
 *
 * Salary adjustment tool for HR Managers.
 * Three-step flow: Select Branch → Select Employee → Set Type/Amount/Reason.
 * Sends to a pending-approval queue before taking effect.
 *
 * Props
 * ──────────────────────────────────────────────────────────────────────────
 * user     {object}
 * language {string}
 * tx       {object}
 */

import { useState } from 'react';
import Icon, { IC } from '../../components/ui/Icon';

const SectionHead = ({ title, subtitle }) => (
  <div style={{ marginBottom: 26 }}>
    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.4px' }}>{title}</h1>
    <div style={{ height: 3, width: 44, background: 'linear-gradient(90deg,var(--accent),var(--accent2))', borderRadius: 2, marginTop: 7 }} />
    {subtitle && <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 10 }}>{subtitle}</div>}
  </div>
);

export default function HRAdjustmentsTab({ user, language, tx }) {
  const isAr = language === 'ar';

  const [adjBranch,      setAdjBranch]      = useState('');
  const [adjBranchEmps,  setAdjBranchEmps]  = useState([]);
  const [adjBranchLoading, setAdjBranchLoading] = useState(false);
  const [adjEmpId,       setAdjEmpId]       = useState('');
  const [adjType,        setAdjType]        = useState('bonus');
  const [adjAmount,      setAdjAmount]      = useState('');
  const [adjReason,      setAdjReason]      = useState('');
  const [adjLoading,     setAdjLoading]     = useState(false);
  const [adjStatus,      setAdjStatus]      = useState(null);

  const loadBranchEmps = async (branchId) => {
    if (!branchId) { setAdjBranchEmps([]); return; }
    setAdjBranchLoading(true);
    try {
      const res  = await fetch(`http://localhost:3000/api/hr/branch-employees?branch_id=${branchId}`);
      const data = await res.json();
      setAdjBranchEmps(Array.isArray(data) ? data : []);
    } catch { setAdjBranchEmps([]); }
    setAdjBranchLoading(false);
  };

  const submitAdjustment = async () => {
    if (!adjEmpId || !adjAmount || !adjReason.trim()) return;
    setAdjLoading(true); setAdjStatus(null);
    try {
      const res  = await fetch('http://localhost:3000/api/hr/salary-adjustment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_emp_id:     parseInt(adjEmpId),
          adjustment_type:   adjType,
          amount:            parseFloat(adjAmount),
          reason:            adjReason,
          submitted_by_id:   user?.id,
          submitted_by_name: user?.name,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdjStatus({ type: 'success', msg: data.message });
        setAdjEmpId(''); setAdjAmount(''); setAdjReason(''); setAdjType('bonus');
      } else {
        setAdjStatus({ type: 'error', msg: data.error });
      }
    } catch { setAdjStatus({ type: 'error', msg: 'Network error.' }); }
    setAdjLoading(false);
  };

  const selectedEmp = adjBranchEmps.find(e => String(e.emp_id) === String(adjEmpId));

  const branches = [
    { key: 'primary',   label: user?.primary_branch   || `Branch #${user?.branch_id}`,            id: user?.branch_id            },
    ...(user?.secondary_branch_id
      ? [{ key: 'secondary', label: user?.secondary_branch || `Branch #${user?.secondary_branch_id}`, id: user?.secondary_branch_id }]
      : []),
  ];

  const canSubmit = adjEmpId && adjAmount && adjReason.trim() && !adjLoading;

  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      <SectionHead
        title={isAr ? 'تعديلات الرواتب' : 'Salary Adjustments'}
        subtitle={isAr
          ? 'أرسل طلبات مكافآت أو خصومات للموظفين — تتطلب موافقة المدير.'
          : 'Submit bonus or deduction requests for employees — requires HR Manager approval.'}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

        {/* ── Form ── */}
        <div className="ticket-card">
          <div style={{ height: 4, background: `linear-gradient(90deg,${adjType === 'bonus' ? '#10b981' : '#ef4444'},${adjType === 'bonus' ? '#10b98155' : '#ef444455'})`, transition: 'background .3s' }} />
          <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Status */}
            {adjStatus && (
              <div style={{
                padding: '11px 15px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'flex-start', gap: 9,
                background: adjStatus.type === 'error' ? 'rgba(239,68,68,0.1)'  : 'rgba(16,185,129,0.08)',
                color:      adjStatus.type === 'error' ? '#ef4444'               : '#10b981',
                border:    `1px solid ${adjStatus.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)'}`,
              }}>
                <Icon d={adjStatus.type === 'error' ? IC.warn : IC.check} size={15} color={adjStatus.type === 'error' ? '#ef4444' : '#10b981'} />
                {adjStatus.msg}
              </div>
            )}

            {/* Step 1: Branch */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                {isAr ? 'الخطوة 1 — اختر الفرع' : 'Step 1 — Select Branch'}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {branches.map(b => (
                  <button key={b.key} onClick={() => { setAdjBranch(b.key); setAdjEmpId(''); loadBranchEmps(b.id); }} style={{
                    flex: 1, padding: '11px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, transition: 'all .2s',
                    background: adjBranch === b.key ? 'rgba(79,124,255,0.15)' : 'var(--surface2)',
                    border:    `${adjBranch === b.key ? 1.5 : 1}px solid ${adjBranch === b.key ? 'rgba(79,124,255,0.5)' : 'var(--border)'}`,
                    color:      adjBranch === b.key ? 'var(--accent2)' : 'var(--txt2)',
                  }}>
                    <Icon d={IC.branch} size={13} color={adjBranch === b.key ? 'var(--accent2)' : 'var(--txt3)'} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Employee */}
            {adjBranch && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                  {isAr ? 'الخطوة 2 — اختر الموظف' : 'Step 2 — Select Employee'}
                </div>
                {adjBranchLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--txt3)', fontSize: 13 }}>
                    <span className="spinner" style={{ width: 13, height: 13 }} /> {isAr ? 'جاري التحميل...' : 'Loading employees...'}
                  </div>
                ) : (
                  <select value={adjEmpId} onChange={e => setAdjEmpId(e.target.value)} className="it-input" style={{ marginTop: 0 }}>
                    <option value="">— {isAr ? 'اختر موظفاً' : 'Select an employee'} —</option>
                    {adjBranchEmps.map(e => (
                      <option key={e.emp_id} value={e.emp_id}>
                        {e.full_name} (ID #{e.emp_id}) · {e.department_name} · {Number(e.salary || 0).toLocaleString()} EGP
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Step 3: Type + Amount + Reason */}
            {adjEmpId && (
              <>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                    {isAr ? 'الخطوة 3 — النوع والمبلغ' : 'Step 3 — Type & Amount'}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    {[
                      { val: 'bonus',     label: isAr ? 'مكافأة' : 'Bonus',     color: '#10b981', icon: '🟢' },
                      { val: 'deduction', label: isAr ? 'خصم'    : 'Deduction', color: '#ef4444', icon: '🔴' },
                    ].map(t => (
                      <button key={t.val} onClick={() => setAdjType(t.val)} style={{
                        flex: 1, padding: '11px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 13, transition: 'all .2s',
                        background: adjType === t.val ? `${t.color}18` : 'var(--surface2)',
                        border:    `${adjType === t.val ? 1.5 : 1}px solid ${adjType === t.val ? t.color + '60' : 'var(--border)'}`,
                        color:      adjType === t.val ? t.color : 'var(--txt2)',
                      }}>
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Amount input */}
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <input type="number" min="1" value={adjAmount} onChange={e => setAdjAmount(e.target.value)}
                      className="it-input" style={{ marginTop: 0, paddingRight: 50 }} placeholder={isAr ? 'المبلغ (جنيه)' : 'Amount (EGP)'} />
                    <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 700, color: 'var(--txt3)' }}>EGP</span>
                  </div>

                  {/* Live salary preview */}
                  {selectedEmp && adjAmount && !isNaN(parseFloat(adjAmount)) && (
                    <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 9, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 12, color: 'var(--txt3)' }}>{isAr ? 'الراتب الحالي:' : 'Current salary:'}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', textDecoration: 'line-through', opacity: 0.6 }}>
                        {Number(selectedEmp.salary || 0).toLocaleString()} EGP
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      <div style={{ fontSize: 14, fontWeight: 800, color: adjType === 'bonus' ? '#10b981' : '#ef4444' }}>
                        {(Number(selectedEmp.salary || 0) + (adjType === 'bonus' ? 1 : -1) * parseFloat(adjAmount)).toLocaleString()} EGP
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: adjType === 'bonus' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
                        color: adjType === 'bonus' ? '#10b981' : '#ef4444',
                        border: `1px solid ${adjType === 'bonus' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.28)'}`,
                      }}>
                        {adjType === 'bonus' ? '+' : '−'}{Number(adjAmount).toLocaleString()} EGP
                      </span>
                    </div>
                  )}
                </div>

                {/* Reason */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                    {isAr ? 'الخطوة 4 — السبب' : 'Step 4 — Reason'}
                  </div>
                  <textarea value={adjReason} onChange={e => setAdjReason(e.target.value)} rows={3}
                    className="it-input" style={{ resize: 'vertical', marginTop: 0 }}
                    placeholder={isAr ? 'سبب التعديل (إلزامي)...' : 'Reason for adjustment (required)...'} />
                </div>

                <button onClick={submitAdjustment} disabled={!canSubmit} className="it-btn"
                  style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: canSubmit ? 1 : 0.5 }}>
                  {adjLoading
                    ? <><span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,.3)', borderTopColor: '#fff' }} />{isAr ? 'جاري الإرسال...' : 'Submitting...'}</>
                    : <><Icon d={adjType === 'bonus' ? IC.check : IC.warn} size={14} />{isAr ? 'إرسال طلب التعديل' : 'Submit Adjustment Request'}</>}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Info sidebar ── */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', position: 'sticky', top: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>
            {isAr ? 'كيف يعمل' : 'How it works'}
          </div>
          {[
            { icon: IC.branch, color: '#4f7cff', text: isAr ? 'اختر الفرع ثم الموظف المستهدف.' : 'Select a branch and the target employee.' },
            { icon: IC.money,  color: '#f59e0b', text: isAr ? 'حدد نوع التعديل (مكافأة / خصم) والمبلغ والسبب.' : 'Specify the type (bonus / deduction), amount, and reason.' },
            { icon: IC.shield, color: '#8b5cf6', text: isAr ? 'يُرسَل الطلب لمدير الموارد البشرية للموافقة قبل التطبيق.' : 'The request goes to the HR Manager for approval before taking effect.' },
            { icon: IC.check,  color: '#10b981', text: isAr ? 'عند الموافقة يُعدَّل الراتب في قاعدة البيانات فوراً.' : 'Upon approval the salary is updated in the database immediately.' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < 3 ? 14 : 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: s.color + '18', border: '1px solid ' + s.color + '28', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon d={s.icon} size={13} color={s.color} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.55 }}>{s.text}</div>
            </div>
          ))}

          {selectedEmp && (
            <div style={{ marginTop: 18, padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                {isAr ? 'الموظف المختار' : 'Selected Employee'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)' }}>{selectedEmp.full_name}</div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 3 }}>ID #{selectedEmp.emp_id} · {selectedEmp.department_name}</div>
              <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 3 }}>
                  {isAr ? 'الراتب الحالي' : 'Current Salary'}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{Number(selectedEmp.salary || 0).toLocaleString()} EGP</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
