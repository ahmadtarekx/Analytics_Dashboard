/**
 * OverviewTab.jsx — Analytics Dashboard Tab
 *
 * MIGRATION: Fully extracted from Dashboard.jsx (~line 5582–6560).
 * BREAKING CHANGE: Replaced useDashboard (DashboardContext) with:
 *   - Props: dashboardData, dashboardLoading, dashboardError
 *   - useAuth()  for user, language, isDark, aiEnabled
 *   - useTranslation() for i18n helpers
 *   - Self-managed internal state for month/year pickers
 *
 * ── Architecture ───────────────────────────────────────────────────────────
 * This component is PASSIVE — it renders whatever dashboardData it receives.
 * The month-picker dropdowns trigger internal refetch calls that update
 * dashboardData via the parent (Dashboard.jsx owns the canonical data state).
 *
 * For strategies that want parent-controlled month pickers, pass the relevant
 * strategyProps down and override the internal defaults.  For strategies that
 * don't care, the local state below handles refetch independently.
 *
 * ── Props ──────────────────────────────────────────────────────────────────
 *   dashboardData     {object|null}   — merged analytics payload from parent
 *   dashboardLoading  {boolean}
 *   dashboardError    {string|null}
 *
 *   ── Optional strategyProps overrides (forward from DashboardFactory) ────
 *   mRevYear / setMRevYear / mRevMonth / setMRevMonth / mRevLoading
 *   bPerfYear / setBPerfYear / bPerfMonth / setBPerfMonth / bPerfLoading
 *   invFlowYear / setInvFlowYear / invFlowMonth / setInvFlowMonth / invFlowLoading
 *   restockYear / setRestockYear / restockMonth / setRestockMonth / restockLoading
 *   invFlowFMYear / setInvFlowFMYear / invFlowFMMonth / setInvFlowFMMonth / invFlowFMLoading
 *   latenessYear / setLatenessYear / latenessMonth / setLatenessMonth / latenessLoading
 *   latenessData      { key, value }   — dedicated lateness state from Dashboard
 *   restockStorageYear / setRestockStorageYear / restockStorageMonth
 *     / setRestockStorageMonth / restockStorageLoading
 *   refetchMonthlyRevenue   (year, month) => void
 *   refetchBranchPerfByMonth(year, month) => void
 *   refetchInvFlowTrends    (year, month) => void
 *   refetchRestockCosts     (year, month) => void
 *   refetchInvFlowFM        (year, month) => void
 *   refetchLateness         (year, month) => void
 *   refetchRestockStorage   (year, month) => void
 *
 * Used by: FinanceDashboardStrategy, HRDashboardStrategy,
 *          PRDashboardStrategy, InventoryDashboardStrategy,
 *          ManagerDashboardStrategy (via the overview tab)
 */

import { useState } from 'react';
import { useAuth }         from '../../context/AuthContext';
import { useTranslation }  from '../../hooks/useTranslation';
import { BASE_URL }        from '../../api/apiClient';
import MetricCard          from '../charts/MetricCard';
import Icon, { IC }        from '../ui/Icon';
import { ACCENTS, getThemeBarPalette } from '../charts/chartUtils';

// ── Module-level helpers ──────────────────────────────────────────────────────

const CATEGORY_MAP = {
  headcount:   { cat: 'Workforce',   icon: IC.user,    color: '#5b8fff' },
  payroll:     { cat: 'Finance',     icon: IC.money,   color: '#f59e0b' },
  salary:      { cat: 'Finance',     icon: IC.money,   color: '#f59e0b' },
  tenure:      { cat: 'Workforce',   icon: IC.calendar,color: '#5b8fff' },
  gender:      { cat: 'Workforce',   icon: IC.gender,  color: '#a78bfa' },
  attendance:  { cat: 'Attendance',  icon: IC.check,   color: '#10b981' },
  absenteeism: { cat: 'Attendance',  icon: IC.warn,    color: '#f97316' },
  absent:      { cat: 'Attendance',  icon: IC.warn,    color: '#f97316' },
  sick:        { cat: 'Attendance',  icon: IC.warn,    color: '#ef4444' },
  flight:      { cat: 'Risk',        icon: IC.warn,    color: '#ef4444' },
  burnout:     { cat: 'Risk',        icon: IC.warn,    color: '#ef4444' },
  risk:        { cat: 'Risk',        icon: IC.warn,    color: '#ef4444' },
  expense:     { cat: 'Finance',     icon: IC.money,   color: '#f59e0b' },
  claimed:     { cat: 'Finance',     icon: IC.money,   color: '#f59e0b' },
  sales:       { cat: 'Sales',       icon: IC.graphs,  color: '#06b6d4' },
  revenue:     { cat: 'Sales',       icon: IC.graphs,  color: '#06b6d4' },
  performance: { cat: 'Performance', icon: IC.chart,   color: '#34d399' },
  target:      { cat: 'Performance', icon: IC.chart,   color: '#34d399' },
  inventory:   { cat: 'Inventory',   icon: IC.pkg,     color: '#8b5cf6' },
  stock:       { cat: 'Inventory',   icon: IC.pkg,     color: '#8b5cf6' },
  product:     { cat: 'Inventory',   icon: IC.pkg,     color: '#8b5cf6' },
};

const CAT_ORDER = ['Workforce', 'Finance', 'Attendance', 'Risk', 'Sales', 'Performance', 'Inventory'];

const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getMeta(rawName) {
  const lower = rawName.toLowerCase();
  for (const [kw, meta] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(kw)) return meta;
  }
  return { cat: 'Other', icon: IC.chart, color: '#8aaad8' };
}

function fmtVal(v) {
  if (v == null) return '—';
  if (typeof v !== 'number') return String(v);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return v.toLocaleString();
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

const PERSONAL_KEYWORDS = [
  'personal info', 'my info', 'employee info', 'profile',
  'first name', 'last name', 'full name', 'emp info', 'my personal',
];

const LATENESS_KEYS = new Set(['get_global_lateness_trends', 'get_branch_lateness_trends']);

// ── Inline detail modal ───────────────────────────────────────────────────────

function DetailModal({ card, language, onClose }) {
  if (!card) return null;
  const rows = card.data?.data || [];
  const warnings = card.data?.warnings || [];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 1000, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 20, padding: 28, maxWidth: 640, width: '100%',
          maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        }}
        className="scroll-area"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--txt)', marginBottom: 4 }}>
              {card.name}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent2)', letterSpacing: '-0.8px', lineHeight: 1 }}>
              {card.displayVal}
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4 }}>{card.labelName}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--txt3)', fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >×</button>
        </div>

        {warnings.length > 0 && (
          <div style={{
            padding: '10px 14px', borderRadius: 10, marginBottom: 16,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          }}>
            {warnings.map((w, i) => (
              <div key={i} style={{ fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <Icon d={IC.warn} size={12} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                {w}
              </div>
            ))}
          </div>
        )}

        {rows.length > 0 && (() => {
          const cols = Object.keys(rows[0]).filter(k =>
            !['branch_id','departement_id','emp_id','product_id'].includes(k)
          );
          return (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {cols.map(c => (
                      <th key={c} style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.6px', fontSize: 10 }}>
                        {c.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row, ri) => (
                    <tr key={ri} style={{ borderBottom: '1px solid var(--border)', background: ri % 2 ? 'var(--surface2)' : 'transparent' }}>
                      {cols.map(c => (
                        <td key={c} style={{ padding: '7px 10px', color: 'var(--txt)', fontWeight: typeof row[c] === 'number' ? 700 : 400 }}>
                          {typeof row[c] === 'number'
                            ? row[c].toLocaleString()
                            : row[c] != null ? String(row[c]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && (
                <div style={{ fontSize: 11, color: 'var(--txt3)', textAlign: 'center', marginTop: 10 }}>
                  Showing 50 of {rows.length} records
                </div>
              )}
            </div>
          );
        })()}

        {rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--txt3)', fontSize: 13 }}>
            {language === 'ar' ? 'لا توجد سجلات' : 'No records available'}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Month-picker control shared by all special cards ────────────────────────

function MonthPicker({ year, month, loading, onYearChange, onMonthChange }) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear];
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <select
        value={year}
        onChange={e => onYearChange(+e.target.value)}
        style={{ fontSize: 10, fontWeight: 700, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', color: 'var(--txt)', cursor: 'pointer' }}
      >
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <select
        value={month}
        onChange={e => onMonthChange(+e.target.value)}
        style={{ fontSize: 10, fontWeight: 700, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', color: 'var(--txt)', cursor: 'pointer' }}
      >
        {MONTHS_EN.map((mo, i) => <option key={i} value={i + 1}>{mo}</option>)}
      </select>
      {loading && <span className="spinner" style={{ width: 10, height: 10 }} />}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OverviewTab({
  dashboardData,
  dashboardLoading,
  dashboardError,
  // Optional forwarded strategyProps — safe defaults if not provided
  mRevYear:    mRevYearP,    setMRevYear:    setMRevYearP,
  mRevMonth:   mRevMonthP,   setMRevMonth:   setMRevMonthP,
  mRevLoading: mRevLoadingP,
  bPerfYear:   bPerfYearP,   setBPerfYear:   setBPerfYearP,
  bPerfMonth:  bPerfMonthP,  setBPerfMonth:  setBPerfMonthP,
  bPerfLoading:bPerfLoadingP,
  invFlowYear:  invFlowYearP,  setInvFlowYear:  setInvFlowYearP,
  invFlowMonth: invFlowMonthP, setInvFlowMonth: setInvFlowMonthP,
  invFlowLoading: invFlowLoadingP,
  restockYear:  restockYearP,  setRestockYear:  setRestockYearP,
  restockMonth: restockMonthP, setRestockMonth: setRestockMonthP,
  restockLoading: restockLoadingP,
  invFlowFMYear:  invFlowFMYearP,  setInvFlowFMYear:  setInvFlowFMYearP,
  invFlowFMMonth: invFlowFMMonthP, setInvFlowFMMonth: setInvFlowFMMonthP,
  invFlowFMLoading: invFlowFMLoadingP,
  latenessYear:  latenessYearP,  setLatenessYear:  setLatenessYearP,
  latenessMonth: latenessMonthP, setLatenessMonth: setLatenessMonthP,
  latenessLoading: latenessLoadingP,
  latenessData: latenessDataP,
  restockStorageYear:  restockStorageYearP,  setRestockStorageYear:  setRestockStorageYearP,
  restockStorageMonth: restockStorageMonthP, setRestockStorageMonth: setRestockStorageMonthP,
  restockStorageLoading: restockStorageLoadingP,
  refetchMonthlyRevenue,
  refetchBranchPerfByMonth,
  refetchInvFlowTrends,
  refetchRestockCosts,
  refetchInvFlowFM,
  refetchLateness,
  refetchRestockStorage,
}) {
  const { user, language, isDark, aiEnabled } = useAuth();
  const { tx, cardTitle, metricLabel, chipLabel, locale } = useTranslation(language);

  // ── Local month-picker state (fallbacks when strategyProps not forwarded) ─
  const now = new Date();
  const [mRevYearL,          setMRevYearL]          = useState(now.getFullYear());
  const [mRevMonthL,         setMRevMonthL]          = useState(now.getMonth() + 1);
  const [mRevLoadingL,       setMRevLoadingL]        = useState(false);
  const [bPerfYearL,         setBPerfYearL]          = useState(now.getFullYear());
  const [bPerfMonthL,        setBPerfMonthL]         = useState(now.getMonth() + 1);
  const [bPerfLoadingL,      setBPerfLoadingL]       = useState(false);
  const [invFlowYearL,       setInvFlowYearL]        = useState(now.getFullYear());
  const [invFlowMonthL,      setInvFlowMonthL]       = useState(now.getMonth() + 1);
  const [invFlowLoadingL,    setInvFlowLoadingL]     = useState(false);
  const [restockYearL,       setRestockYearL]        = useState(now.getFullYear());
  const [restockMonthL,      setRestockMonthL]       = useState(now.getMonth() + 1);
  const [restockLoadingL,    setRestockLoadingL]     = useState(false);
  const [invFlowFMYearL,     setInvFlowFMYearL]      = useState(now.getFullYear());
  const [invFlowFMMonthL,    setInvFlowFMMonthL]     = useState(now.getMonth() + 1);
  const [invFlowFMLoadingL,  setInvFlowFMLoadingL]   = useState(false);
  const [latenessYearL,      setLatenessYearL]       = useState(now.getFullYear());
  const [latenessMonthL,     setLatenessMonthL]      = useState(now.getMonth() + 1);
  const [latenessLoadingL,   setLatenessLoadingL]    = useState(false);
  const [restockStorageYearL,  setRestockStorageYearL]  = useState(now.getFullYear());
  const [restockStorageMonthL, setRestockStorageMonthL] = useState(now.getMonth() + 1);
  const [restockStorageLoadingL, setRestockStorageLoadingL] = useState(false);

  // ── Detail card modal ──────────────────────────────────────────────────────
  const [selectedCard, setSelectedCard] = useState(null);

  // ── Resolved values: prefer parent props, fall back to local state ─────────
  const mRevYear         = mRevYearP         ?? mRevYearL;
  const setMRevYear      = setMRevYearP       ?? setMRevYearL;
  const mRevMonth        = mRevMonthP        ?? mRevMonthL;
  const setMRevMonth     = setMRevMonthP     ?? setMRevMonthL;
  const mRevLoading      = mRevLoadingP      ?? mRevLoadingL;

  const bPerfYear        = bPerfYearP        ?? bPerfYearL;
  const setBPerfYear     = setBPerfYearP     ?? setBPerfYearL;
  const bPerfMonth       = bPerfMonthP       ?? bPerfMonthL;
  const setBPerfMonth    = setBPerfMonthP    ?? setBPerfMonthL;
  const bPerfLoading     = bPerfLoadingP     ?? bPerfLoadingL;

  const invFlowYear      = invFlowYearP      ?? invFlowYearL;
  const setInvFlowYear   = setInvFlowYearP   ?? setInvFlowYearL;
  const invFlowMonth     = invFlowMonthP     ?? invFlowMonthL;
  const setInvFlowMonth  = setInvFlowMonthP  ?? setInvFlowMonthL;
  const invFlowLoading   = invFlowLoadingP   ?? invFlowLoadingL;

  const restockYear      = restockYearP      ?? restockYearL;
  const setRestockYear   = setRestockYearP   ?? setRestockYearL;
  const restockMonth     = restockMonthP     ?? restockMonthL;
  const setRestockMonth  = setRestockMonthP  ?? setRestockMonthL;
  const restockLoading   = restockLoadingP   ?? restockLoadingL;

  const invFlowFMYear    = invFlowFMYearP    ?? invFlowFMYearL;
  const setInvFlowFMYear = setInvFlowFMYearP ?? setInvFlowFMYearL;
  const invFlowFMMonth   = invFlowFMMonthP   ?? invFlowFMMonthL;
  const setInvFlowFMMonth= setInvFlowFMMonthP?? setInvFlowFMMonthL;
  const invFlowFMLoading = invFlowFMLoadingP ?? invFlowFMLoadingL;

  const latenessYear     = latenessYearP     ?? latenessYearL;
  const setLatenessYear  = setLatenessYearP  ?? setLatenessYearL;
  const latenessMonth    = latenessMonthP    ?? latenessMonthL;
  const setLatenessMonth = setLatenessMonthP ?? setLatenessMonthL;
  const latenessLoading  = latenessLoadingP  ?? latenessLoadingL;
  const latenessData     = latenessDataP     ?? null;

  const restockStorageYear      = restockStorageYearP      ?? restockStorageYearL;
  const setRestockStorageYear   = setRestockStorageYearP   ?? setRestockStorageYearL;
  const restockStorageMonth     = restockStorageMonthP     ?? restockStorageMonthL;
  const setRestockStorageMonth  = setRestockStorageMonthP  ?? setRestockStorageMonthL;
  const restockStorageLoading   = restockStorageLoadingP   ?? restockStorageLoadingL;

  // ── Local refetch fallbacks (call API directly when parent doesn't provide) ─
  const buildDashUrl = (extra = '') => {
    const deptId = user?.department_id ?? user?.departement_id;
    return `${BASE_URL}/dashboard?userId=${user?.id}&role=${user?.role}&departmentId=${deptId}${extra}`;
  };

  const localRefetchMonthlyRevenue = async (y, m) => {
    if (refetchMonthlyRevenue) { refetchMonthlyRevenue(y, m); return; }
    setMRevLoadingL(true);
    try { await fetch(buildDashUrl(`&monthly_revenue_year=${y}&monthly_revenue_month=${m}`)); } catch {}
    setMRevLoadingL(false);
  };
  const localRefetchBranchPerf = async (y, m) => {
    if (refetchBranchPerfByMonth) { refetchBranchPerfByMonth(y, m); return; }
    setBPerfLoadingL(true);
    try { await fetch(buildDashUrl(`&branch_perf_year=${y}&branch_perf_month=${m}`)); } catch {}
    setBPerfLoadingL(false);
  };
  const localRefetchInvFlow = async (y, m) => {
    if (refetchInvFlowTrends) { refetchInvFlowTrends(y, m); return; }
    setInvFlowLoadingL(true);
    try { await fetch(buildDashUrl(`&inv_flow_year=${y}&inv_flow_month=${m}`)); } catch {}
    setInvFlowLoadingL(false);
  };
  const localRefetchRestock = async (y, m) => {
    if (refetchRestockCosts) { refetchRestockCosts(y, m); return; }
    setRestockLoadingL(true);
    try { await fetch(buildDashUrl(`&restock_year=${y}&restock_month=${m}`)); } catch {}
    setRestockLoadingL(false);
  };
  const localRefetchInvFlowFM = async (y, m) => {
    if (refetchInvFlowFM) { refetchInvFlowFM(y, m); return; }
    setInvFlowFMLoadingL(true);
    try { await fetch(buildDashUrl(`&inv_flow_fm_year=${y}&inv_flow_fm_month=${m}`)); } catch {}
    setInvFlowFMLoadingL(false);
  };
  const localRefetchLateness = async (y, m) => {
    if (refetchLateness) { refetchLateness(y, m); return; }
    setLatenessLoadingL(true);
    try { await fetch(buildDashUrl(`&lateness_year=${y}&lateness_month=${m}`)); } catch {}
    setLatenessLoadingL(false);
  };
  const localRefetchRestockStorage = async (y, m) => {
    if (refetchRestockStorage) { refetchRestockStorage(y, m); return; }
    setRestockStorageLoadingL(true);
    try { await fetch(buildDashUrl(`&restock_storage_year=${y}&restock_storage_month=${m}`)); } catch {}
    setRestockStorageLoadingL(false);
  };

  const isAr = language === 'ar';

  // ── Category localization ─────────────────────────────────────────────────
  const CAT_AR = { Workforce: 'القوى العاملة', Finance: 'المالية', Attendance: 'الحضور', Risk: 'المخاطر', Sales: 'المبيعات', Performance: 'الأداء', Inventory: 'المخزون', Other: 'أخرى' };
  const CAT_DESC = isAr
    ? { Workforce: 'الموارد البشرية والهيكل', Finance: 'التكاليف والرواتب والمصروفات', Attendance: 'الحضور والإجازات', Risk: 'مشاكل تتطلب مراجعة', Sales: 'الإيرادات وخط المبيعات', Performance: 'الأهداف والنتائج', Inventory: 'المخزون والمنتجات' }
    : { Workforce: 'People & structure', Finance: 'Costs, pay & expenses', Attendance: 'Presence & leave', Risk: 'Issues needing action', Sales: 'Revenue & pipeline', Performance: 'Targets & scores', Inventory: 'Stock & products' };
  const CAT_COLOR = { Workforce: '#5b8fff', Finance: '#f59e0b', Attendance: '#10b981', Risk: '#ef4444', Sales: '#06b6d4', Performance: '#34d399', Inventory: '#8b5cf6' };

  if (!user) return null;

  // ── Build allEntries from dashboardData ───────────────────────────────────
  const buildEntries = () => {
    if (!dashboardData || dashboardData.message) return [];

    return Object.entries(dashboardData)
      .filter(([name, v]) => {
        if (!v || typeof v !== 'object' || !('data' in v)) return false;
        const lower = name.replace(/_/g, ' ').toLowerCase();
        if (PERSONAL_KEYWORDS.some(kw => lower.includes(kw))) return false;
        if (LATENESS_KEYS.has(name)) return false; // rendered standalone
        if (v.data?.length > 0) {
          const cols = Object.keys(v.data[0]).filter(k =>
            !['branch_id','departement_id','emp_id','product_id'].includes(k)
          );
          const identityCols = ['first_name','last_name','full_name','name','email','phone','address','gender','role'];
          if (cols.length > 0 && cols.every(c => identityCols.includes(c.toLowerCase()))) return false;
        }
        return true;
      })
      .map(([name, data]) => {
        const cleanName = name.replace(/get_|branch_|global_|finance_/g, '').replace(/_/g, ' ').trim();
        const meta      = getMeta(cleanName);
        const hasWarn   = data.warnings?.length > 0;
        const rows      = data.data || [];
        const cn        = cleanName.toLowerCase();

        const numCols = rows.length > 0
          ? Object.keys(rows[0]).filter(k => typeof rows[0][k] === 'number' && !['branch_id','departement_id','emp_id','product_id'].includes(k))
          : [];
        const textCols = rows.length > 0
          ? Object.keys(rows[0]).filter(k => typeof rows[0][k] === 'string' && !['branch_id','departement_id','emp_id','product_id'].includes(k))
          : [];

        const agg = {};
        numCols.forEach(k => {
          const vals = rows.map(r => r[k]).filter(v => typeof v === 'number');
          agg[k] = {
            sum: vals.reduce((a, b) => a + b, 0),
            avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
            max: vals.length ? Math.max(...vals) : 0,
            min: vals.length ? Math.min(...vals) : 0,
          };
        });

        const translatedName = cardTitle(cleanName);
        let primaryVal = '—', primaryLabel = metricLabel('value');
        let summaryChips = [];

        if (cn.includes('headcount')) {
          const total = numCols.length ? agg[numCols[0]]?.sum : rows.length;
          primaryVal = fmtVal(total || rows.length); primaryLabel = metricLabel('totalEmployees');
          if (rows.length > 1) summaryChips.push({ label: chipLabel('depts'), value: rows.length });
          const maxRow = rows.reduce((a, b) => (b[numCols[0]] || 0) > (a[numCols[0]] || 0) ? b : a, rows[0] || {});
          if (maxRow && textCols[0]) summaryChips.push({ label: chipLabel('largest'), value: String(maxRow[textCols[0]] || '—'), hl: true });
        } else if (name === 'get_branch_avg_salary') {
          const explicitAvg = data.combined_avg_salary;
          const col = numCols[0];
          primaryVal = explicitAvg != null ? fmtVal(explicitAvg) : (col ? fmtVal(agg[col]?.avg || agg[col]?.sum) : '—');
          primaryLabel = isAr ? 'متوسط الراتب (الفرعين)' : 'Combined Avg Salary';
          summaryChips.push({ label: chipLabel('recCount'), value: rows.length });
        } else if (name === 'get_global_avg_salary') {
          const overallAvg = data.overall_avg_salary;
          const col = numCols[0];
          primaryVal = overallAvg != null ? fmtVal(overallAvg) : (col ? fmtVal(agg[col]?.avg) : '—');
          primaryLabel = isAr ? 'متوسط الراتب الكلي' : 'Company Avg Salary';
          summaryChips.push({ label: chipLabel('recCount'), value: rows.length });
        } else if (cn.includes('tenure')) {
          const avg = numCols.length ? agg[numCols[0]]?.avg : 0;
          primaryVal = fmtVal(avg) + chipLabel('yrs'); primaryLabel = metricLabel('avgTenure');
          if (numCols[0]) summaryChips.push({ label: chipLabel('max'), value: fmtVal(agg[numCols[0]]?.max) + chipLabel('yrs') });
          if (numCols[0]) summaryChips.push({ label: chipLabel('min'), value: fmtVal(agg[numCols[0]]?.min) + chipLabel('yrs') });
        } else if (cn.includes('gender') && !cn.includes('pay')) {
          const counts = {};
          rows.forEach(r => { const g = r[textCols[0]] || r['gender'] || '?'; counts[g] = (counts[g] || 0) + 1; });
          const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
          primaryVal = dominant ? dominant[0] : '—'; primaryLabel = metricLabel('dominantGender');
          Object.entries(counts).forEach(([g, n]) => summaryChips.push({ label: g, value: n }));
        } else if (cn.includes('pay gap') || cn.includes('pay breakdown')) {
          const col = numCols[0];
          primaryVal = col ? fmtVal(agg[col].avg) : '—'; primaryLabel = metricLabel('avgPayGap');
          if (col) summaryChips.push({ label: chipLabel('max'), value: fmtVal(agg[col].max), hl: true });
        } else if (cn.includes('payroll') || cn.includes('salary')) {
          const col = numCols[0];
          primaryVal = col ? fmtVal(agg[col].sum) : '—';
          primaryLabel = cn.includes('payroll') ? metricLabel('totalPayroll') : metricLabel('totalSalary');
          if (col) summaryChips.push({ label: chipLabel('avgPerPerson'), value: fmtVal(agg[col].avg), hl: true });
          summaryChips.push({ label: chipLabel('recCount'), value: rows.length });
        } else if (cn.includes('attendance')) {
          const col = numCols[0];
          primaryVal = col ? fmtVal(agg[col].avg) + '%' : rows.length + (isAr ? ' سجل' : ' rec');
          primaryLabel = metricLabel('avgAttendance');
          if (col) summaryChips.push({ label: chipLabel('highest'), value: fmtVal(agg[col].max) + '%', hl: true });
          if (col) summaryChips.push({ label: chipLabel('lowest'), value: fmtVal(agg[col].min) + '%' });
        } else if (cn.includes('absent') || cn.includes('sick')) {
          const col = numCols[0];
          primaryVal = col ? fmtVal(agg[col].sum) : String(rows.length);
          primaryLabel = cn.includes('sick') ? metricLabel('totalSickDays') : metricLabel('totalAbsentDays');
          if (col) summaryChips.push({ label: chipLabel('avgPerPerson'), value: fmtVal(agg[col].avg), hl: true });
          summaryChips.push({ label: chipLabel('affected'), value: rows.length + chipLabel('emp') });
        } else if (cn.includes('flight') || cn.includes('burnout') || cn.includes('risk')) {
          primaryVal = String(rows.length);
          primaryLabel = cn.includes('flight') ? metricLabel('atRiskEmployees') : cn.includes('burnout') ? metricLabel('burnoutCases') : metricLabel('riskCases');
          if (rows.length > 0 && textCols[0]) summaryChips.push({ label: chipLabel('topRisk'), value: String(rows[0][textCols[0]] || '—'), hl: true });
          if (numCols[0]) summaryChips.push({ label: chipLabel('avg'), value: fmtVal(agg[numCols[0]]?.avg) });
        } else if (name === 'get_regional_profitability_overview' || name === 'get_ceo_company_net_profit_estimate') {
          const netRow = rows.find(r => String(r.metric || r.Metric || '').toLowerCase().includes('net profit'));
          const col = numCols[0];
          primaryVal = netRow && col ? fmtVal(netRow[col]) : (col ? fmtVal(agg[col].sum) : '—');
          primaryLabel = 'Net Profit';
          summaryChips.push({ label: chipLabel('recCount'), value: rows.length });
        } else if (name === 'get_ceo_department_cost_analysis') {
          const payrollCol = numCols.find(k => k.toLowerCase().includes('payroll') || k.toLowerCase().includes('salary'));
          const col = payrollCol || numCols[0];
          primaryVal = col ? fmtVal(agg[col].sum) : '—';
          primaryLabel = 'Total Payroll';
          summaryChips.push({ label: chipLabel('recCount'), value: rows.length });
          if (col) summaryChips.push({ label: chipLabel('avg'), value: fmtVal(agg[col].avg), hl: true });
        } else if (cn.includes('revenue') || cn.includes('sales')) {
          const col = numCols[0];
          primaryVal = col ? fmtVal(agg[col].sum) : '—';
          primaryLabel = cn.includes('revenue') ? metricLabel('totalRevenue') : metricLabel('totalSales');
          if (col) summaryChips.push({ label: chipLabel('avg'), value: fmtVal(agg[col].avg), hl: true });
          summaryChips.push({ label: chipLabel('recCount'), value: rows.length });
        } else if (cn.includes('expense') || cn.includes('claimed')) {
          const col = numCols[0];
          primaryVal = col ? fmtVal(agg[col].sum) : '—'; primaryLabel = metricLabel('totalExpenses');
          if (col) summaryChips.push({ label: chipLabel('avg'), value: fmtVal(agg[col].avg), hl: true });
          if (col) summaryChips.push({ label: chipLabel('max'), value: fmtVal(agg[col].max) });
        } else if (cn.includes('performance') || cn.includes('target')) {
          const col = numCols[0];
          primaryVal = col ? fmtVal(agg[col].avg) : '—'; primaryLabel = metricLabel('avgScore');
          if (col) summaryChips.push({ label: chipLabel('top'), value: fmtVal(agg[col].max), hl: true });
          if (col) summaryChips.push({ label: chipLabel('low'), value: fmtVal(agg[col].min) });
        } else if (cn.includes('inventory') || cn.includes('stock') || cn.includes('product')) {
          const col = numCols[0];
          primaryVal = col ? fmtVal(agg[col].sum) : String(rows.length); primaryLabel = metricLabel('totalStock');
          summaryChips.push({ label: chipLabel('skus'), value: rows.length });
          if (col) summaryChips.push({ label: chipLabel('avg'), value: fmtVal(agg[col].avg), hl: true });
        } else if (cn.includes('compliance')) {
          primaryVal = String(rows.length); primaryLabel = metricLabel('complianceRecs');
          summaryChips.push({ label: chipLabel('issues'), value: rows.length, hl: rows.length > 0 });
        } else if (cn.includes('ticket') || cn.includes('unresolved')) {
          const explicitCount = data.total_count;
          primaryVal = explicitCount != null ? String(explicitCount) : String(rows.length);
          primaryLabel = cn.includes('unresolved')
            ? (isAr ? 'تذاكر معلقة' : 'Unresolved Tickets')
            : (isAr ? 'إجمالي التذاكر' : 'Total Tickets');
          summaryChips.push({ label: chipLabel('recCount'), value: rows.length });
        } else {
          const col = numCols[0];
          if (col) {
            primaryVal = fmtVal(agg[col].sum > 0 ? agg[col].sum : agg[col].avg);
            const COL_LABEL_AR = (isAr && locale?._columnLabels) ? locale._columnLabels : {};
            const rawLabel = col.replace(/_/g, ' ');
            primaryLabel = isAr ? (COL_LABEL_AR[rawLabel] || rawLabel) : rawLabel;
            summaryChips.push({ label: chipLabel('avg'), value: fmtVal(agg[col].avg) });
            summaryChips.push({ label: chipLabel('recCount'), value: rows.length });
          } else {
            primaryVal = String(rows.length); primaryLabel = metricLabel('records');
            if (textCols[0]) summaryChips.push({ label: chipLabel('sample'), value: String(rows[0]?.[textCols[0]] || '—') });
          }
        }

        const sparkCol    = numCols[0];
        const sparkValues = sparkCol ? rows.slice(0, 8).map(r => r[sparkCol]).filter(v => typeof v === 'number') : [];
        const sparkLabelCol = textCols[0] || null;
        const sparkLabels   = rows.slice(0, 8).map((r, ri) =>
          sparkLabelCol ? String(r[sparkLabelCol] || ri + 1) : String(ri + 1)
        );
        const period = data.period || null;

        const isLeaderboard     = [
          'get_global_top_sales_reps','get_global_top_sales_reps_this_month',
          'get_team_sales_leaderboard','get_team_monthly_leaderboard',
          'get_global_low_sales_rep_alert','get_global_most_valuable_items',
          'get_ceo_branch_leaderboard','get_ceo_top_company_assets',
          'get_regional_top_sales_performers','get_regional_top_selling_assets',
          'get_global_top_products_by_revenue','get_global_top_expense_claimers',
          'get_branch_top_expense_claimers','get_finance_product_profitability',
        ].includes(name);

        const isRecentTx      = ['get_global_recent_transactions','get_team_recent_transactions'].includes(name);
        const isMonthlyRev    = name === 'get_global_monthly_revenue';
        const isInvFlowTrends = name === 'get_global_inventory_flow_trends';
        const isBranchPerfByMonth = name === 'get_global_branch_performance_by_month';
        const isRestockCosts  = name === 'get_global_restock_costs' || name === 'get_finance_restock_costs';
        const isInvFlowFM     = name === 'get_global_inventory_flow';
        const isAvgTxValue    = name === 'get_global_avg_transaction_value';
        const isLatenessTrends= LATENESS_KEYS.has(name);
        const isRestockStorages = name === 'get_finance_restock_storages';

        return {
          name, cleanName: translatedName, data, meta, hasWarn,
          primaryVal, primaryLabel, summaryChips, sparkValues, sparkLabels, sparkCol,
          rows, period, isLeaderboard, isRecentTx, isMonthlyRev, isBranchPerfByMonth,
          isInvFlowTrends, isRestockCosts, isInvFlowFM, isAvgTxValue, isLatenessTrends,
          isRestockStorages,
        };
      });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const activeMetrics = dashboardData && !dashboardData.message
    ? Object.entries(dashboardData).filter(([, v]) => v && 'data' in v).length
    : 0;

  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>

      {/* Detail modal */}
      {selectedCard && (
        <DetailModal
          card={selectedCard}
          language={language}
          onClose={() => setSelectedCard(null)}
        />
      )}

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 6 }}>
            {isAr ? 'لوحة التحليلات' : 'Analytics Dashboard'}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.5px', margin: 0 }}>
            {tx.aiAnalytics ?? (isAr ? 'التحليلات الذكية' : 'Analytics Overview')}
          </h1>
        </div>
        {activeMetrics > 0 && (
          <div style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
            {activeMetrics} {isAr ? 'مؤشر نشط' : 'active metrics'}
          </div>
        )}
      </div>

      {/* ── Error state ─────────────────────────────────────────────────── */}
      {(dashboardError) && (
        <div style={{ display: 'flex', gap: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 14, padding: '18px 22px', color: '#fca5a5', marginBottom: 24 }}>
          <Icon d={IC.warn} size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3, color: '#ef4444' }}>Error</div>
            <div style={{ fontSize: 13 }}>{dashboardError}</div>
          </div>
        </div>
      )}

      {/* ── Skeleton loading ────────────────────────────────────────────── */}
      {dashboardLoading && !dashboardData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div className="skeleton" style={{ height: 10, width: '40%' }} />
                <div className="skeleton" style={{ height: 20, width: 20, borderRadius: '50%' }} />
              </div>
              <div className="skeleton" style={{ height: 36, width: '55%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 9, width: '70%', marginBottom: 18 }} />
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                {[28, 18, 22, 14, 30, 16, 24].map((h, j) => (
                  <div key={j} className="skeleton" style={{ width: 14, height: h, borderRadius: 3 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {dashboardData?.message && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--txt3)' }}>
          <Icon d={IC.chart} size={40} color="var(--border2)" style={{ margin: '0 auto 16px', display: 'block' }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>{dashboardData.message}</div>
        </div>
      )}

      {/* ── Data loaded ─────────────────────────────────────────────────── */}
      {dashboardData && !dashboardData.message && (() => {
        const allEntries = buildEntries();
        const alertEntries = allEntries.filter(e => e.hasWarn);
        const grouped = {};
        allEntries.forEach(e => {
          const cat = e.hasWarn ? 'Risk' : e.meta.cat;
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(e);
        });
        const sortedCats = [...new Set([...CAT_ORDER, ...Object.keys(grouped)])].filter(c => grouped[c]);

        return (
          <>
            {/* ── ALERTS STRIP ─────────────────────────────────────────── */}
            {alertEntries.length > 0 && (
              <div style={{
                marginBottom: 20, padding: '12px 16px',
                background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(220,38,38,0.06)',
                border: `1px solid ${isDark ? 'rgba(239,68,68,0.22)' : 'rgba(220,38,38,0.25)'}`,
                borderRadius: 12, animation: 'cardIn .3s ease both',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 7, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon d={IC.warn} size={11} color="#ef4444" />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '1.2px' }}>
                    {isAr
                      ? `${alertEntries.length} تنبيه نشط — يتطلب مراجعة`
                      : `${alertEntries.length} Active Alert${alertEntries.length > 1 ? 's' : ''} — Requires Attention`}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
                  {alertEntries.map((entry, ai) => (
                    <div
                      key={ai}
                      onClick={() => setSelectedCard({ name: entry.cleanName, displayVal: entry.primaryVal, labelName: entry.primaryLabel, data: entry.data, hasWarn: true })}
                      style={{
                        cursor: 'pointer',
                        background: isDark ? 'rgba(239,68,68,0.07)' : 'rgba(220,38,38,0.06)',
                        border: `1px solid ${isDark ? 'rgba(239,68,68,0.25)' : 'rgba(220,38,38,0.22)'}`,
                        borderRadius: 10, padding: '10px 12px', transition: 'all .18s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.13)' : 'rgba(220,38,38,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.07)' : 'rgba(220,38,38,0.06)'; e.currentTarget.style.transform = 'none'; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: isDark ? '#f87171' : '#dc2626', textTransform: 'uppercase', letterSpacing: '1px' }}>{entry.cleanName}</span>
                        <span style={{ fontSize: 8, fontWeight: 800, color: isDark ? '#fca5a5' : '#b91c1c', background: isDark ? 'rgba(239,68,68,0.18)' : 'rgba(220,38,38,0.12)', border: `1px solid ${isDark ? 'rgba(239,68,68,0.3)' : 'rgba(220,38,38,0.25)'}`, padding: '1px 6px', borderRadius: 999 }}>⚠ {isAr ? 'تنبيه' : 'ALERT'}</span>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: isDark ? '#fca5a5' : '#dc2626', letterSpacing: '-0.5px', lineHeight: 1, marginBottom: 2 }}>{entry.primaryVal}</div>
                      <div style={{ fontSize: 10, color: isDark ? '#f87171' : '#b91c1c', fontWeight: 600, marginBottom: entry.data.warnings?.length ? 5 : 0 }}>{entry.primaryLabel}</div>
                      {entry.data.warnings?.slice(0, 1).map((w, wi) => (
                        <div key={wi} style={{ fontSize: 10, color: isDark ? '#fca5a5' : '#b91c1c', background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(220,38,38,0.07)', borderRadius: 6, padding: '3px 7px', lineHeight: 1.4, marginBottom: 5 }}>⚠ {w}</div>
                      ))}
                      {/* Ask AI button — stops propagation so it doesn't open the detail modal */}
                      {aiEnabled && (
                        <div
                          className="ai-ask-btn"
                          onClick={e => {
                            e.stopPropagation();
                            const aiLabel = entry.cleanName || 'alert';
                            const aiData  = { data: entry.data, warnings: entry.data.warnings || [] };
                            sessionStorage.setItem('aiPendingSource', JSON.stringify({ label: aiLabel, data: aiData }));
                            window.dispatchEvent(new CustomEvent('askAI'));
                          }}
                          style={{ marginTop: 6, width: '100%', justifyContent: 'center' }}
                        >
                          <div className="ai-dot" style={{ width: 5, height: 5 }} />
                          <span style={{ fontSize: 10 }}>{isAr ? 'اسأل AI' : 'Ask AI'}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── CATEGORY SECTIONS ────────────────────────────────────── */}
            {sortedCats.filter(c => c !== 'Risk').map(cat => {
              const entries = (grouped[cat] || []).filter(e => !e.hasWarn);
              if (!entries.length) return null;
              const catColor = CAT_COLOR[cat] || '#8aaad8';
              const catDesc  = CAT_DESC[cat] || '';

              return (
                <div key={cat} style={{ marginBottom: 20 }}>
                  {/* Category header pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px 3px 7px', background: `${catColor}12`, border: `1px solid ${catColor}28`, borderRadius: 999 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: catColor, boxShadow: `0 0 5px ${catColor}` }} />
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.4px', color: catColor }}>
                        {isAr ? (CAT_AR[cat] || cat) : cat}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 500 }}>{catDesc}</span>
                    <div style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--txt3)', fontWeight: 600, background: 'var(--surface2)', padding: '2px 8px', borderRadius: 999, border: '1px solid var(--border)' }}>
                      {entries.length} {isAr ? 'مؤشر' : (entries.length > 1 ? 'metrics' : 'metric')}
                    </div>
                  </div>

                  {/* Card grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(185px,1fr))', gap: 9 }}>
                    {entries.map((entry, ci) => {
                      const c       = entry.meta.color;
                      const hasSpark = entry.sparkValues.length > 1;
                      const maxSpark = hasSpark ? Math.max(...entry.sparkValues) : 1;
                      const barColors = entry.sparkValues.map((_, bi) => getThemeBarPalette()[bi % getThemeBarPalette().length]);

                      // ── LEADERBOARD ──────────────────────────────────────
                      if (entry.isLeaderboard) {
                        const reps   = entry.rows.slice(0, 10);
                        const getRev = r => parseFloat(
                          r.total_profit ?? r.claimed ?? r.total_claimed ?? r.product_revenue ??
                          r.unit_cost ?? r.total_sales_revenue ?? r.total_sales ?? r.monthly_sales ??
                          r.revenue_generated ?? r.gross_revenue ?? r.total_revenue ?? r.deals_closed ?? 0
                        ) || 0;
                        const maxRev = reps.length ? Math.max(...reps.map(getRev)) : 1;
                        const medals = ['🥇','🥈','🥉'];
                        return (
                          <div key={ci} style={{ gridColumn: '1 / -1', background: 'var(--surface)', border: `1px solid ${c}28`, borderRadius: 14, padding: '14px 16px', animation: 'cardIn .3s ease both' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 9, background: `${c}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Icon d={IC.graphs} size={14} color={c} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.2px' }}>{entry.cleanName}</div>
                                  {entry.period && <div style={{ fontSize: 9, color: c, fontWeight: 700, marginTop: 1 }}>📅 {entry.period}</div>}
                                </div>
                              </div>
                              <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 600, background: 'var(--surface2)', padding: '2px 8px', borderRadius: 999, border: '1px solid var(--border)' }}>
                                {reps.length} {entry.name?.includes('most_valuable') || entry.name?.includes('top_company') ? 'items' : 'reps'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {reps.map((rep, ri) => {
                                const rev = getRev(rep);
                                const pct = maxRev > 0 ? (rev / maxRev) * 100 : 0;
                                const repName = rep.employee_name || rep.name ||
                                  `${rep.First_Name || rep.first_name || ''} ${rep.Last_Name || rep.last_name || ''}`.trim() ||
                                  `Rep #${rep.emp_id}`;
                                return (
                                  <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 22, textAlign: 'center', fontSize: ri < 3 ? 14 : 11, fontWeight: 800, color: ri < 3 ? undefined : 'var(--txt3)', flexShrink: 0 }}>
                                      {ri < 3 ? medals[ri] : `#${ri + 1}`}
                                    </div>
                                    <div style={{ width: 120, flexShrink: 0 }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{repName}</div>
                                      {rep.branch_id && !rep.model && <div style={{ fontSize: 9, color: 'var(--txt3)' }}>{rep.branch_name || `Branch ${rep.branch_id}`}</div>}
                                      {rep.model && <div style={{ fontSize: 9, color: 'var(--txt3)' }}>{rep.model}</div>}
                                    </div>
                                    <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, background: ri === 0 ? '#f59e0b' : ri === 1 ? '#94a3b8' : ri === 2 ? '#cd7c3f' : c, borderRadius: 3, transition: 'width .5s ease' }} />
                                    </div>
                                    <div style={{ width: 72, textAlign: 'right', fontSize: 10, fontWeight: 800, color: ri === 0 ? '#f59e0b' : 'var(--txt)', flexShrink: 0 }}>
                                      {rev >= 1_000_000 ? (rev / 1_000_000).toFixed(1) + 'M' : rev >= 1_000 ? rev.toLocaleString() : rev.toFixed(0)} EGP
                                    </div>
                                    <div style={{ width: 32, textAlign: 'right', fontSize: 9, color: 'var(--txt3)', flexShrink: 0 }}>
                                      {rep.units_sold != null ? `${Number(rep.units_sold).toLocaleString()} u` : (rep.deals_closed ?? rep.model ?? '')}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      // ── RECENT TRANSACTIONS ──────────────────────────────
                      if (entry.isRecentTx) {
                        const txRows = entry.rows.slice(0, 15);
                        return (
                          <div key={ci} style={{ gridColumn: '1 / -1', background: 'var(--surface)', border: `1px solid ${c}28`, borderRadius: 14, padding: '14px 16px', animation: 'cardIn .3s ease both' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 9, background: `${c}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Icon d={IC.layers} size={14} color={c} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt)' }}>{entry.cleanName}</div>
                                  {entry.period && <div style={{ fontSize: 9, color: c, fontWeight: 700, marginTop: 1 }}>📅 {entry.period}</div>}
                                </div>
                              </div>
                              <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 600, background: 'var(--surface2)', padding: '2px 8px', borderRadius: 999, border: '1px solid var(--border)' }}>
                                {txRows.length} records
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '28px 110px 1fr 80px 90px 90px', gap: 8, padding: '6px 10px', borderRadius: 7, background: 'var(--surface2)', marginBottom: 4 }}>
                              {['#', 'Date', 'Product', 'Qty', 'Revenue', txRows[0]?.First_Name ? 'Employee' : 'Branch'].map((h, i) => (
                                <div key={i} style={{ fontSize: 9, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: i >= 3 ? 'right' : 'left' }}>{h}</div>
                              ))}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {txRows.map((txRow, ti) => {
                                const rev = parseFloat(txRow.price) || 0;
                                const maxR = Math.max(...txRows.map(r => parseFloat(r.price) || 0), 1);
                                const pct = (rev / maxR) * 100;
                                const dateStr = txRow.transaction_date
                                  ? new Date(txRow.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                  : '—';
                                return (
                                  <div key={ti} style={{ display: 'grid', gridTemplateColumns: '28px 110px 1fr 80px 90px 90px', gap: 8, padding: '7px 10px', borderRadius: 7, background: ti % 2 === 0 ? 'transparent' : 'var(--surface2)', alignItems: 'center' }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)' }}>{ti + 1}</div>
                                    <div style={{ fontSize: 10, color: 'var(--txt3)' }}>{dateStr}</div>
                                    <div style={{ position: 'relative', minWidth: 0 }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>{txRow.product_name || '—'}</div>
                                      <div style={{ height: 3, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 2, transition: 'width .5s ease' }} />
                                      </div>
                                    </div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#10b981', textAlign: 'right' }}>×{txRow.amount || 0}</div>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: ti === 0 ? '#f59e0b' : 'var(--txt)', textAlign: 'right' }}>
                                      {rev >= 1_000_000 ? (rev / 1_000_000).toFixed(1) + 'M' : rev.toLocaleString()} EGP
                                    </div>
                                    <div style={{ fontSize: 9, color: 'var(--txt3)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {txRow.First_Name ? `${txRow.First_Name} ${txRow.Last_Name || ''}`.trim() : `B${txRow.branch_id || '—'}`}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      // ── MONTHLY REVENUE (with month/year picker) ─────────
                      if (entry.isMonthlyRev) {
                        return (
                          <div key={ci} style={{ gridColumn: 'span 2', background: 'var(--surface)', border: `1px solid ${c}28`, borderRadius: 14, padding: '14px 16px', animation: 'cardIn .3s ease both' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt)' }}>{entry.cleanName}</div>
                                {entry.period && <div style={{ fontSize: 9, color: c, fontWeight: 700, marginTop: 2 }}>📅 {entry.period}</div>}
                              </div>
                              <MonthPicker year={mRevYear} month={mRevMonth} loading={mRevLoading}
                                onYearChange={y  => { setMRevYear(y);  localRefetchMonthlyRevenue(y, mRevMonth); }}
                                onMonthChange={m => { setMRevMonth(m); localRefetchMonthlyRevenue(mRevYear, m); }} />
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: c, letterSpacing: '-1px', lineHeight: 1 }}>{entry.primaryVal}</div>
                            <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 4, fontWeight: 600 }}>{entry.primaryLabel}</div>
                            {entry.summaryChips.length > 0 && (
                              <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                                {entry.summaryChips.map((chip, si) => (
                                  <span key={si} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', background: chip.hl ? `${c}18` : 'var(--surface2)', color: chip.hl ? c : 'var(--txt3)', border: `1px solid ${chip.hl ? c + '30' : 'var(--border)'}`, borderRadius: 999 }}>
                                    {chip.label}: {chip.value}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }

                      // ── BRANCH PERFORMANCE BY MONTH ──────────────────────
                      if (entry.isBranchPerfByMonth) {
                        return (
                          <div key={ci} style={{ gridColumn: 'span 2', background: 'var(--surface)', border: `1px solid ${c}28`, borderRadius: 14, padding: '14px 16px', animation: 'cardIn .3s ease both' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt)' }}>{entry.cleanName}</div>
                                {entry.period && <div style={{ fontSize: 9, color: c, fontWeight: 700, marginTop: 2 }}>📅 {entry.period}</div>}
                              </div>
                              <MonthPicker year={bPerfYear} month={bPerfMonth} loading={bPerfLoading}
                                onYearChange={y  => { setBPerfYear(y);  localRefetchBranchPerf(y, bPerfMonth); }}
                                onMonthChange={m => { setBPerfMonth(m); localRefetchBranchPerf(bPerfYear, m); }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {entry.rows.map((row, ri) => {
                                const rev    = parseFloat(row.branch_revenue) || 0;
                                const maxRev = Math.max(...entry.rows.map(r => parseFloat(r.branch_revenue) || 0), 1);
                                const pct    = (rev / maxRev) * 100;
                                return (
                                  <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 60, fontSize: 10, fontWeight: 700, color: 'var(--txt)', flexShrink: 0 }}>Branch {row.branch_id}</div>
                                    <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 3, transition: 'width .5s ease' }} />
                                    </div>
                                    <div style={{ width: 80, textAlign: 'right', fontSize: 10, fontWeight: 800, color: 'var(--txt)', flexShrink: 0 }}>
                                      {rev >= 1_000_000 ? (rev / 1_000_000).toFixed(1) + 'M' : rev.toLocaleString()} EGP
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      // ── INVENTORY FLOW TRENDS ────────────────────────────
                      if (entry.isInvFlowTrends) {
                        return (
                          <div key={ci} style={{ gridColumn: 'span 2', background: 'var(--surface)', border: `1px solid ${c}28`, borderRadius: 14, padding: '14px 16px', animation: 'cardIn .3s ease both' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt)' }}>{entry.cleanName}</div>
                                {entry.period && <div style={{ fontSize: 9, color: c, fontWeight: 700, marginTop: 2 }}>📅 {entry.period}</div>}
                              </div>
                              <MonthPicker year={invFlowYear} month={invFlowMonth} loading={invFlowLoading}
                                onYearChange={y  => { setInvFlowYear(y);  localRefetchInvFlow(y, invFlowMonth); }}
                                onMonthChange={m => { setInvFlowMonth(m); localRefetchInvFlow(invFlowYear, m); }} />
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: c, letterSpacing: '-1px', lineHeight: 1 }}>{entry.primaryVal}</div>
                            <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 4, fontWeight: 600 }}>{entry.primaryLabel}</div>
                          </div>
                        );
                      }

                      // ── RESTOCK COSTS ────────────────────────────────────
                      if (entry.isRestockCosts) {
                        const primaryCost   = entry.data.primary_branch_cost;
                        const secondaryCost = entry.data.secondary_branch_cost;
                        const costRows      = entry.data.data || [];
                        const labelFor = (idx) => costRows[idx]?.Name || (costRows[idx]?.branch_id ? `Branch ${costRows[idx].branch_id}` : isAr ? `الفرع ${idx + 1}` : `Branch ${idx + 1}`);
                        const fmtCost = v => v != null ? ((v >= 1_000_000 ? (v / 1_000_000).toFixed(2) + 'M' : v >= 1_000 ? Number(v).toLocaleString() : String(v)) + ' EGP') : '—';
                        return (
                          <div key={ci} style={{ gridColumn: 'span 2', background: 'var(--surface)', border: `1px solid ${c}28`, borderRadius: 14, padding: '14px 16px', animation: 'cardIn .3s ease both' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt)' }}>{entry.cleanName}</div>
                                {entry.data.period && <div style={{ fontSize: 9, color: c, fontWeight: 700, marginTop: 2 }}>📅 {entry.data.period}</div>}
                              </div>
                              <MonthPicker year={restockYear} month={restockMonth} loading={restockLoading}
                                onYearChange={y  => { setRestockYear(y);  localRefetchRestock(y, restockMonth); }}
                                onMonthChange={m => { setRestockMonth(m); localRefetchRestock(restockYear, m); }} />
                            </div>
                            {(primaryCost != null || secondaryCost != null) ? (
                              <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                                <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px', border: `1px solid ${c}20` }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--txt3)', marginBottom: 4 }}>{labelFor(0)}</div>
                                  <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{fmtCost(primaryCost)}</div>
                                </div>
                                {secondaryCost != null && (
                                  <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px', border: `1px solid ${c}20` }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--txt3)', marginBottom: 4 }}>{labelFor(1)}</div>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{fmtCost(secondaryCost)}</div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ fontSize: 28, fontWeight: 800, color: c, letterSpacing: '-1px', lineHeight: 1 }}>{entry.primaryVal}</div>
                            )}
                            <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 4, fontWeight: 600 }}>{entry.primaryLabel}</div>
                          </div>
                        );
                      }

                      // ── INVENTORY FLOW (Finance Manager) ─────────────────
                      if (entry.isInvFlowFM) {
                        return (
                          <div key={ci} style={{ gridColumn: 'span 2', background: 'var(--surface)', border: `1px solid ${c}28`, borderRadius: 14, padding: '14px 16px', animation: 'cardIn .3s ease both' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt)' }}>{entry.cleanName}</div>
                                {entry.period && <div style={{ fontSize: 9, color: c, fontWeight: 700, marginTop: 2 }}>📅 {entry.period}</div>}
                              </div>
                              <MonthPicker year={invFlowFMYear} month={invFlowFMMonth} loading={invFlowFMLoading}
                                onYearChange={y  => { setInvFlowFMYear(y);  localRefetchInvFlowFM(y, invFlowFMMonth); }}
                                onMonthChange={m => { setInvFlowFMMonth(m); localRefetchInvFlowFM(invFlowFMYear, m); }} />
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: c, letterSpacing: '-1px', lineHeight: 1 }}>{entry.primaryVal}</div>
                            <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 4, fontWeight: 600 }}>{entry.primaryLabel}</div>
                          </div>
                        );
                      }

                      // ── LATENESS TRENDS (in-list version) ────────────────
                      if (entry.isLatenessTrends) {
                        return (
                          <div key={ci} style={{ gridColumn: 'span 2', background: 'var(--surface)', border: `1px solid ${c}28`, borderRadius: 14, padding: '14px 16px', animation: 'cardIn .3s ease both' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt)' }}>{entry.cleanName}</div>
                                {entry.period && <div style={{ fontSize: 9, color: c, fontWeight: 700, marginTop: 2 }}>📅 {entry.period}</div>}
                              </div>
                              <MonthPicker year={latenessYear} month={latenessMonth} loading={latenessLoading}
                                onYearChange={y  => { setLatenessYear(y);  localRefetchLateness(y, latenessMonth); }}
                                onMonthChange={m => { setLatenessMonth(m); localRefetchLateness(latenessYear, m); }} />
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: c, letterSpacing: '-1px', lineHeight: 1 }}>{entry.primaryVal}</div>
                            <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 4, fontWeight: 600 }}>{entry.primaryLabel}</div>
                          </div>
                        );
                      }

                      // ── RESTOCK STORAGES ─────────────────────────────────
                      if (entry.isRestockStorages) {
                        const storageCost = entry.data.storage_restock_cost;
                        const fmtStorage  = v => v != null ? ((v >= 1_000_000 ? (v / 1_000_000).toFixed(2) + 'M' : v >= 1_000 ? v.toLocaleString() : String(v)) + ' EGP') : '—';
                        return (
                          <div key={ci} style={{ gridColumn: 'span 2', background: 'var(--surface)', border: `1px solid ${c}28`, borderRadius: 14, padding: '14px 16px', animation: 'cardIn .3s ease both' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt)' }}>{entry.cleanName}</div>
                                {entry.data.period && <div style={{ fontSize: 9, color: c, fontWeight: 700, marginTop: 2 }}>📅 {entry.data.period}</div>}
                              </div>
                              <MonthPicker year={restockStorageYear} month={restockStorageMonth} loading={restockStorageLoading}
                                onYearChange={y  => { setRestockStorageYear(y);  localRefetchRestockStorage(y, restockStorageMonth); }}
                                onMonthChange={m => { setRestockStorageMonth(m); localRefetchRestockStorage(restockStorageYear, m); }} />
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: c, letterSpacing: '-1px', lineHeight: 1 }}>{fmtStorage(storageCost)}</div>
                            <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 4, fontWeight: 600 }}>
                              {isAr ? 'تكلفة إعادة تخزين المستودع' : 'Storage Restock Cost'}
                            </div>
                          </div>
                        );
                      }

                      // ── AVERAGE TRANSACTION VALUE ────────────────────────
                      if (entry.isAvgTxValue) {
                        const overallAvg = entry.data.overall_average ?? 0;
                        const branchRows = entry.rows.filter(r => r.branch_id !== undefined && r.location !== undefined);
                        const maxAvg     = branchRows.length ? Math.max(...branchRows.map(r => parseFloat(r.avg_order_value) || 0)) : 1;
                        return (
                          <div key={ci} style={{ gridColumn: '1 / -1', background: 'var(--surface)', border: `1px solid ${c}28`, borderRadius: 14, padding: '14px 16px', animation: 'cardIn .3s ease both' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 9, background: `${c}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Icon d={IC.money} size={14} color={c} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt)' }}>{entry.cleanName}</div>
                                  <div style={{ fontSize: 9, color: 'var(--txt3)', marginTop: 1 }}>{isAr ? 'متوسط حقيقي عبر جميع الفروع' : 'True average across all branches'}</div>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 26, fontWeight: 800, color: c, letterSpacing: '-1px', lineHeight: 1 }}>
                                  {overallAvg >= 1_000_000 ? (overallAvg / 1_000_000).toFixed(2) + 'M' : overallAvg.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                </div>
                                <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 600 }}>{isAr ? 'جنيه · متوسط قيمة المعاملة' : 'EGP · Global Avg Transaction'}</div>
                              </div>
                            </div>
                            {branchRows.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
                                  {isAr ? 'تفصيل حسب الفرع' : 'Branch Breakdown'}
                                </div>
                                {branchRows.map((row, ri) => {
                                  const avg           = parseFloat(row.avg_order_value) || 0;
                                  const pct           = maxAvg > 0 ? (avg / maxAvg) * 100 : 0;
                                  const isAboveGlobal = avg >= overallAvg;
                                  return (
                                    <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <div style={{ width: 110, fontSize: 10, fontWeight: 600, color: 'var(--txt)', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {row.location || `Branch ${row.branch_id}`}
                                      </div>
                                      <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${pct}%`, background: isAboveGlobal ? c : 'var(--txt3)', borderRadius: 3, transition: 'width .5s ease', opacity: isAboveGlobal ? 1 : 0.5 }} />
                                      </div>
                                      <div style={{ width: 80, textAlign: 'right', fontSize: 10, fontWeight: 800, color: isAboveGlobal ? c : 'var(--txt2)', flexShrink: 0 }}>
                                        {avg.toLocaleString('en-US', { maximumFractionDigits: 0 })} EGP
                                      </div>
                                      <div style={{ width: 14, flexShrink: 0, fontSize: 9 }}>{isAboveGlobal ? '▲' : '▼'}</div>
                                    </div>
                                  );
                                })}
                                <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: `${c}10`, border: `1px solid ${c}22`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: c }}>{isAr ? '◆ المتوسط العالمي الحقيقي' : '◆ True Global Average'}</span>
                                  <span style={{ fontSize: 12, fontWeight: 800, color: c }}>{overallAvg.toLocaleString('en-US', { maximumFractionDigits: 0 })} EGP</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // ── DEFAULT MetricCard ───────────────────────────────
                      return (
                        <div key={ci} style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                          {entry.period && (
                            <div style={{ display: 'inline-flex', marginBottom: 4, fontSize: 8, fontWeight: 700, color: c, background: `${c}14`, border: `1px solid ${c}28`, borderRadius: 999, padding: '1px 6px', letterSpacing: '0.3px', alignSelf: 'flex-start' }}>
                              📅 {entry.period}
                            </div>
                          )}
                          <MetricCard
                            entry={entry}
                            c={c}
                            hasSpark={hasSpark}
                            maxSpark={maxSpark}
                            barColors={barColors}
                            ci={ci}
                            language={language}
                            aiEnabled={aiEnabled}
                            onOpenDetail={() => setSelectedCard({
                              name: entry.cleanName,
                              displayVal: entry.primaryVal,
                              labelName:  entry.primaryLabel,
                              data: entry.data,
                              hasWarn: false,
                            })}
                            onAskAI={() => {
                              // Write this metric's data to sessionStorage so AITab
                              // picks it up on mount and auto-loads it into context.
                              const aiLabel = entry.cleanName || entry.name || 'metric';
                              const aiData  = { data: entry.data, warnings: entry.warnings };
                              sessionStorage.setItem('aiPendingSource', JSON.stringify({ label: aiLabel, data: aiData }));
                              window.dispatchEvent(new CustomEvent('askAI'));
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* ── STANDALONE LATENESS TRENDS (rendered from latenessData state) ── */}
            {latenessData && (() => {
              const lRows  = latenessData.value?.data || [];
              const lCount = lRows.length;
              return (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px 3px 7px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 999 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 5px #10b981' }} />
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.4px', color: '#10b981' }}>
                        {isAr ? 'الحضور' : 'Attendance'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(185px,1fr))', gap: 9 }}>
                    <div style={{ gridColumn: 'span 2', background: 'var(--surface)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: 14, padding: '14px 16px', animation: 'cardIn .3s ease both' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt)' }}>
                          {isAr ? 'اتجاهات التأخير' : 'Lateness Trends'}
                        </div>
                        <MonthPicker year={latenessYear} month={latenessMonth} loading={latenessLoading}
                          onYearChange={y  => { setLatenessYear(y);  localRefetchLateness(y, latenessMonth); }}
                          onMonthChange={m => { setLatenessMonth(m); localRefetchLateness(latenessYear, m); }} />
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981', letterSpacing: '-1px', lineHeight: 1 }}>{lCount}</div>
                      <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 4, fontWeight: 600 }}>
                        {isAr ? 'سجل' : 'Records'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        );
      })()}
    </div>
  );
}