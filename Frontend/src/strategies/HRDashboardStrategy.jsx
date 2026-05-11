/**
 * HRDashboardStrategy.jsx — Strategy Pattern
 *
 * Extracted from Dashboard.jsx — owns ALL state and UI for HR employees
 * (department_id == 3, role !== 'dep_manager').
 *
 * HR Managers are handled by ManagerDashboardStrategy for approvals + employee
 * search. The dept-specific HR tools (salary adjustments) belong here only.
 *
 * Tabs rendered here:
 *   hr_adjustments — Branch selector → Employee selector → Bonus/Deduction form
 *   overview       — Analytics MetricCard grid (shared OverviewTab)
 *   graphs         — Plotly chart grid         (shared GraphsTab)
 *
 * API:  all fetch calls replaced with hrRepository.* (Repository Pattern)
 * Auth: all user/role reads from useAuth()             (Observer Pattern)
 * State: all adjustment state moved here from monolithic Dashboard.jsx
 *
 * ORIGINAL LOCATION in Dashboard.jsx:
 *   HR Adjustments tab — search "hr_adjustments && isHR" (~line 4198–4406)
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth }              from '../context/AuthContext';
import { useTranslation }       from '../hooks/useTranslation';
import hrRepository             from '../api/hrRepository';
import Icon, { IC, FastTextArea } from '../components/ui/Icon';
import OverviewTab              from '../components/common/OverviewTab';
import GraphsTab                from '../components/common/GraphsTab';
import ManagerDashboardStrategy from './ManagerDashboardStrategy';

// Manager-only tabs — HR Manager (dep_manager) needs these via ManagerDashboardStrategy.
const MANAGER_TABS = new Set(['approvals', 'emp_search']);

// ── Shared local helpers ─────────────────────────────────────────────────────
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

// ── Component ────────────────────────────────────────────────────────────────
export default function HRDashboardStrategy({
  dashboardData,
  dashboardLoading,
  activeTab,
  setActiveTab,
}) {
  const { user, language } = useAuth();
  const { tx }             = useTranslation(language);

  // ── Branch selection ──────────────────────────────────────────────────────
  // 'primary' | 'secondary' | ''
  const [adjBranch,        setAdjBranch]        = useState('');

  // ── Employees in the selected branch ─────────────────────────────────────
  const [adjBranchEmps,    setAdjBranchEmps]    = useState([]);
  const [adjBranchLoading, setAdjBranchLoading] = useState(false);

  // ── Selected employee + adjustment fields ─────────────────────────────────
  const [adjEmpId,  setAdjEmpId]  = useState('');
  const [adjType,   setAdjType]   = useState('bonus');   // 'bonus' | 'deduction'
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');

  // ── Submission state ──────────────────────────────────────────────────────
  const [adjLoading, setAdjLoading] = useState(false);
  const [adjStatus,  setAdjStatus]  = useState(null); // { type: 'success'|'error', msg }

  // ── Reset employee selection when branch changes ──────────────────────────
  useEffect(() => { setAdjEmpId(''); }, [adjBranch]);

  // ── Load employees for the HR employee's selected branch ──────────────────
  const loadAdjBranchEmps = useCallback(async (branchId) => {
    if (!branchId) { setAdjBranchEmps([]); return; }
    setAdjBranchLoading(true);
    try {
      const data = await hrRepository.getBranchEmployees({ branch_id: branchId });
      setAdjBranchEmps(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[HRStrategy] loadAdjBranchEmps:', err.message);
      setAdjBranchEmps([]);
    } finally {
      setAdjBranchLoading(false);
    }
  }, []);

  // ── Submit salary adjustment ───────────────────────────────────────────────
  const submitAdjustment = async () => {
    if (!adjEmpId || !adjAmount || !adjReason.trim()) return;
    setAdjLoading(true);
    setAdjStatus(null);
    try {
      const res = await hrRepository.stageSalaryAdjustment({
        target_emp_id:    parseInt(adjEmpId),
        adjustment_type:  adjType,
        amount:           parseFloat(adjAmount),
        reason:           adjReason,
        submitted_by_id:  user?.id,
        submitted_by_name: user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
      });
      setAdjStatus({ type: 'success', msg: res.message });
      // Reset form on success
      setAdjEmpId('');
      setAdjAmount('');
      setAdjReason('');
      setAdjType('bonus');
    } catch (err) {
      setAdjStatus({ type: 'error', msg: err.message || 'Network error.' });
    } finally {
      setAdjLoading(false);
    }
  };

  // ── Manager-tab delegation ─────────────────────────────────────────────────
  // HR Manager (dep_manager) needs 'approvals' and 'emp_search'.
  // isHR in the old Dashboard.jsx explicitly excludes dep_manager (line 1334),
  // so the DashboardFactory should route HR managers here first, then this block
  // delegates to ManagerDashboardStrategy for those tabs.
  // This guard makes the delegation explicit and resilient to factory ordering changes.
  const isHRManager = user?.role === 'dep_manager' || user?.id === 91949;

  if (isHRManager && MANAGER_TABS.has(activeTab)) {
    return (
      <ManagerDashboardStrategy
        dashboardData={dashboardData}
        dashboardLoading={dashboardLoading}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    );
  }

  // ── Render guard — return null for tabs this strategy doesn't own ───────────
  // overview and graphs are handled below via shared components.
  if (activeTab !== 'hr_adjustments' && activeTab !== 'overview' && activeTab !== 'graphs') return null;

  // ── Shared analytics tabs ──────────────────────────────────────────────────
  if (activeTab === 'overview') {
    return <OverviewTab dashboardData={dashboardData} dashboardLoading={dashboardLoading} />;
  }
  if (activeTab === 'graphs') {
    return <GraphsTab dashboardData={dashboardData} dashboardLoading={dashboardLoading} />;
  }

  // ── HR Adjustments tab ────────────────────────────────────────────────────
  const selectedEmp = adjBranchEmps.find(e => String(e.emp_id) === String(adjEmpId));

  // Build the branch button list from the logged-in user's assigned branches
  const branchButtons = [
    { key: 'primary',   label: user?.primary_branch   || `Branch #${user?.branch_id}`,           id: user?.branch_id           },
    ...(user?.secondary_branch_id
      ? [{ key: 'secondary', label: user?.secondary_branch || `Branch #${user?.secondary_branch_id}`, id: user?.secondary_branch_id }]
      : []),
  ];

  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <SectionHead title={language === 'ar' ? 'تعديلات الرواتب' : 'Salary Adjustments'} />
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: -18 }}>
          {language === 'ar'
            ? 'قدّم طلبات المكافآت أو الخصومات للموظفين في فروعك — يتطلب موافقة مدير الموارد البشرية.'
            : 'Submit bonus or deduction requests for employees in your branches — requires HR Manager approval.'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

        {/* ── LEFT: Form card ──────────────────────────────────────────────── */}
        <div className="ticket-card">
          {/* Animated top stripe — green for bonus, red for deduction */}
          <div style={{
            height: 4,
            background: `linear-gradient(90deg,${adjType === 'bonus' ? '#10b981' : '#ef4444'},${adjType === 'bonus' ? '#10b98155' : '#ef444455'})`,
            transition: 'background .3s',
          }} />

          <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* ── STEP 1: Select branch ──────────────────────────────────── */}
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--txt3)',
                textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10,
              }}>
                {language === 'ar' ? 'الخطوة 1 — اختر الفرع' : 'Step 1 — Select Branch'}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {branchButtons.map(b => (
                  <button
                    key={b.key}
                    onClick={() => {
                      setAdjBranch(b.key);
                      loadAdjBranchEmps(b.id);
                    }}
                    style={{
                      flex: 1, padding: '11px 14px', borderRadius: 10,
                      cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, transition: 'all .2s',
                      background: adjBranch === b.key ? 'rgba(79,124,255,0.15)' : 'var(--surface2)',
                      border:     adjBranch === b.key ? '1.5px solid rgba(79,124,255,0.5)' : '1px solid var(--border)',
                      color:      adjBranch === b.key ? 'var(--accent2)' : 'var(--txt2)',
                    }}
                  >
                    <Icon
                      d={IC.branch} size={13}
                      color={adjBranch === b.key ? 'var(--accent2)' : 'var(--txt3)'}
                      style={{ marginRight: 6, verticalAlign: 'middle' }}
                    />
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── STEP 2: Select employee ────────────────────────────────── */}
            {adjBranch && (
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--txt3)',
                  textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10,
                }}>
                  {language === 'ar' ? 'الخطوة 2 — اختر الموظف' : 'Step 2 — Select Employee'}
                </div>
                {adjBranchLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--txt3)', fontSize: 13 }}>
                    <span className="spinner" style={{ width: 13, height: 13 }} />
                    {language === 'ar' ? 'جاري التحميل...' : 'Loading employees...'}
                  </div>
                ) : (
                  <select
                    value={adjEmpId}
                    onChange={e => setAdjEmpId(e.target.value)}
                    className="it-input"
                    style={{ marginTop: 0 }}
                  >
                    <option value="">{language === 'ar' ? '— اختر موظفاً —' : '— Select an employee —'}</option>
                    {adjBranchEmps.map(e => (
                      <option key={e.emp_id} value={e.emp_id}>
                        {e.full_name} (ID #{e.emp_id}) · {e.department_name} · {Number(e.salary || 0).toLocaleString()} EGP
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* ── STEP 3: Type + Amount ──────────────────────────────────── */}
            {adjEmpId && (
              <>
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--txt3)',
                    textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10,
                  }}>
                    {language === 'ar' ? 'الخطوة 3 — النوع والمبلغ' : 'Step 3 — Type & Amount'}
                  </div>

                  {/* Bonus / Deduction toggle */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    {[
                      { val: 'bonus',     label: language === 'ar' ? 'مكافأة'  : 'Bonus',     color: '#10b981', icon: '🟢' },
                      { val: 'deduction', label: language === 'ar' ? 'خصم'     : 'Deduction', color: '#ef4444', icon: '🔴' },
                    ].map(t => (
                      <button
                        key={t.val}
                        onClick={() => setAdjType(t.val)}
                        style={{
                          flex: 1, padding: '11px', borderRadius: 10,
                          cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 13, transition: 'all .2s',
                          background: adjType === t.val ? `${t.color}18` : 'var(--surface2)',
                          border:     adjType === t.val ? `1.5px solid ${t.color}60` : '1px solid var(--border)',
                          color:      adjType === t.val ? t.color : 'var(--txt2)',
                        }}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Amount input */}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      min="1"
                      value={adjAmount}
                      onChange={e => setAdjAmount(e.target.value)}
                      className="it-input"
                      style={{ marginTop: 0, paddingRight: 50 }}
                      placeholder={language === 'ar' ? 'المبلغ (جنيه)' : 'Amount (EGP)'}
                    />
                    <span style={{
                      position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 12, fontWeight: 700, color: 'var(--txt3)',
                    }}>
                      EGP
                    </span>
                  </div>

                  {/* Live salary preview */}
                  {selectedEmp && adjAmount && !isNaN(parseFloat(adjAmount)) && (
                    <div style={{
                      marginTop: 10, padding: '10px 14px', borderRadius: 9,
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                        {language === 'ar' ? 'الراتب الحالي:' : 'Current salary:'}
                      </div>
                      <div style={{
                        fontSize: 13, fontWeight: 700, color: 'var(--txt)',
                        textDecoration: 'line-through', opacity: 0.6,
                      }}>
                        {Number(selectedEmp.salary || 0).toLocaleString()} EGP
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                      <div style={{
                        fontSize: 14, fontWeight: 800,
                        color: adjType === 'bonus' ? '#10b981' : '#ef4444',
                      }}>
                        {(adjType === 'bonus'
                          ? Number(selectedEmp.salary || 0) + parseFloat(adjAmount)
                          : Math.max(0, Number(selectedEmp.salary || 0) - parseFloat(adjAmount))
                        ).toLocaleString()} EGP
                      </div>
                    </div>
                  )}
                </div>

                {/* ── STEP 4: Reason ──────────────────────────────────────── */}
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--txt3)',
                    textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10,
                  }}>
                    {language === 'ar' ? 'الخطوة 4 — السبب' : 'Step 4 — Reason'}
                  </div>
                  <FastTextArea
                    value={adjReason}
                    onChange={v => setAdjReason(v)}
                    className="it-input"
                    rows="3"
                    style={{ resize: 'vertical', marginTop: 0 }}
                    placeholder={
                      adjType === 'bonus'
                        ? (language === 'ar' ? 'سبب المكافأة (مطلوب)...' : 'Reason for bonus (required)...')
                        : (language === 'ar' ? 'سبب الخصم (مطلوب)...'   : 'Reason for deduction (required)...')
                    }
                  />
                </div>

                {/* Status banner */}
                {adjStatus && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: adjStatus.type === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                    color:      adjStatus.type === 'error' ? '#ef4444' : '#10b981',
                    border:     `1px solid ${adjStatus.type === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.22)'}`,
                  }}>
                    <Icon
                      d={adjStatus.type === 'error' ? IC.warn : IC.check}
                      size={13}
                      color={adjStatus.type === 'error' ? '#ef4444' : '#10b981'}
                    />
                    {adjStatus.msg}
                  </div>
                )}

                {/* Submit button */}
                <button
                  onClick={submitAdjustment}
                  disabled={adjLoading || !adjEmpId || !adjAmount || !adjReason.trim()}
                  className="it-btn"
                  style={{
                    marginTop: 0, padding: '13px', fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: adjType === 'bonus' ? '#10b981' : '#ef4444',
                    opacity: (adjLoading || !adjEmpId || !adjAmount || !adjReason.trim()) ? 0.5 : 1,
                  }}
                >
                  {adjLoading ? (
                    <>
                      <span className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                      {language === 'ar' ? 'جاري الإرسال...' : 'Submitting...'}
                    </>
                  ) : (
                    <>
                      <Icon d={adjType === 'bonus' ? IC.check : IC.warn} size={14} />
                      {adjType === 'bonus'
                        ? (language === 'ar' ? 'إرسال طلب مكافأة'  : 'Submit Bonus Request')
                        : (language === 'ar' ? 'إرسال طلب خصم'    : 'Submit Deduction Request')}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT: Info panel + selected employee card ───────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* How it works */}
          <div className="ticket-card" style={{ overflow: 'hidden' }}>
            <div style={{ height: 4, background: 'linear-gradient(90deg,var(--accent),var(--accent2))' }} />
            <div style={{ padding: '18px 20px' }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--txt3)',
                textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12,
              }}>
                {language === 'ar' ? 'كيف تعمل العملية' : 'How it works'}
              </div>
              {[
                { icon: IC.user,   color: '#10b981', text: language === 'ar' ? 'اختر أحد فرعيك، ثم حدد موظفاً من ذلك الفرع.'       : 'Select one of your two assigned branches, then pick an employee from that branch.' },
                { icon: IC.money,  color: '#f59e0b', text: language === 'ar' ? 'اختر مكافأة (يُضاف للراتب) أو خصم (يُطرح منه).'   : 'Choose bonus (adds to salary) or deduction (subtracts from salary) and enter the amount.' },
                { icon: IC.ticket, color: '#8b5cf6', text: language === 'ar' ? 'يُرسل طلبك لمدير الموارد البشرية — لا يتغير الراتب حتى الموافقة.' : 'Your request is staged and sent to the HR Manager — nothing changes until approved.' },
                { icon: IC.check,  color: '#06b6d4', text: language === 'ar' ? 'يرى مدير الموارد البشرية مقارنة الراتب قبل/بعد في تبويب الموافقات.' : 'The HR Manager sees a before/after salary comparison in their Approvals tab.' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < 3 ? 12 : 0 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: `${s.color}18`, border: `1px solid ${s.color}28`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 1,
                  }}>
                    <Icon d={s.icon} size={13} color={s.color} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.6 }}>{s.text}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected employee card — shown once an employee is chosen */}
          {selectedEmp && (
            <div className="ticket-card" style={{ overflow: 'hidden' }}>
              <div style={{ height: 4, background: 'linear-gradient(90deg,#8b5cf6,#8b5cf655)' }} />
              <div style={{ padding: '18px 20px' }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--txt3)',
                  textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12,
                }}>
                  {language === 'ar' ? 'الموظف المحدد' : 'Selected Employee'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon d={IC.user} size={18} color="#8b5cf6" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)' }}>
                      {selectedEmp.full_name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>
                      {selectedEmp.department_name} · ID #{selectedEmp.emp_id}
                    </div>
                  </div>
                </div>
                <div style={{
                  padding: '10px 14px', borderRadius: 9,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600 }}>
                    {language === 'ar' ? 'الراتب الحالي' : 'Current Salary'}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)' }}>
                    {Number(selectedEmp.salary || 0).toLocaleString()} EGP
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
