/**
 * Dashboard.jsx — Integration Reference
 *
 * This file is the exact, production-ready refactored Dashboard.jsx.
 * It shows precisely how AITab, ProfileTab, and ContactAdminTab are:
 *
 *   1. Imported alongside DashboardFactory
 *   2. Gated via SHARED_TABS (bypassing the Factory entirely)
 *   3. Conditionally rendered with their RBAC guards
 *   4. Passed their required props
 *
 * The Strategy Pattern lives inside DashboardFactory — all role-specific
 * tabs (overview, it_tools, it_inbox, sales, finance, hr…) are handled
 * there.  The three shared tabs below are role-agnostic and always render
 * the same component regardless of department.
 *
 * ─── RBAC Summary for shared tabs ────────────────────────────────────────────
 *
 *   ProfileTab       → ALL roles (no guard)
 *   AITab            → ALL non-IT roles AND aiEnabled toggle must be ON
 *   ContactAdminTab  → ALL non-IT roles (IT employees manage tickets, not submit them)
 *
 * ─── How the Strategy Pattern still applies ──────────────────────────────────
 *
 * Inside each Strategy component (SalesDashboardStrategy, HRDashboardStrategy,
 * etc.) the Sidebar renders role-specific nav items.  The 'profile', 'ai', and
 * 'contact_admin' tab keys appear in every strategy's nav config so every role
 * sees those menu entries.  However the actual rendering of those tabs is
 * OWNED by Dashboard.jsx (via SHARED_TABS) — not the strategy — preventing
 * any per-role duplication.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Imports ───────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { useNavigate }                       from 'react-router-dom';
import { useAuth }                           from '../context/AuthContext';
import { useTranslation }                    from '../hooks/useTranslation';
import { usePlotly }                         from '../hooks/usePlotly';
import dashboardRepository                   from '../api/dashboardRepository';
import DashboardFactory                      from '../factories/DashboardFactory';

// Layout shell
import StyleTag from '../components/ui/StyleTag';
import Sidebar  from '../components/layout/Sidebar';
import Topbar   from '../components/layout/Topbar';

// ── Shared tabs — role-agnostic, bypass DashboardFactory entirely ─────────────
import ProfileTab      from '../components/common/ProfileTab';
import AITab           from '../components/common/AITab';
import ContactAdminTab from '../components/common/ContactAdminTab';

// Tab keys that must NOT be delegated to DashboardFactory.
// Keeping this as a Set makes the SHARED_TABS.has(activeTab) guard O(1).
const SHARED_TABS = new Set(['profile', 'ai', 'contact_admin']);

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    user,
    logout,
    isDark,
    toggleTheme,
    language,
    toggleLanguage,
    aiEnabled,
    toggleAi,
    isIT,
    hasDash,
  } = useAuth();

  const tx = useTranslation(language);
  usePlotly(); // Ensures Plotly CDN is loaded before any chart renders

  // ── Active tab + sidebar open ─────────────────────────────────────────────
  const [activeTab,   setActiveTab]   = useState('profile');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Dashboard analytics (Python scripts via /api/dashboard) ──────────────
  const [dashboardData,    setDashboardData]    = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError,   setDashboardError]   = useState(null);

  // Analytics overlay: month-picker refetch results merged on top of dashboardData.
  // Keeps base dashboardData intact while allowing per-card date filtering.
  const [analyticsOverlay, setAnalyticsOverlay] = useState({});

  // Dedicated lateness state — never wiped by overlay logic.
  const [latenessData, setLatenessData] = useState(null);

  // ── Month/year picker states forwarded to strategies via strategyProps ────
  const [mRevYear,   setMRevYear]   = useState(() => new Date().getFullYear());
  const [mRevMonth,  setMRevMonth]  = useState(() => new Date().getMonth() + 1);
  const [mRevLoading, setMRevLoading] = useState(false);
  const [bPerfYear,  setBPerfYear]  = useState(() => new Date().getFullYear());
  const [bPerfMonth, setBPerfMonth] = useState(() => new Date().getMonth() + 1);
  const [bPerfLoading, setBPerfLoading] = useState(false);
  const [invFlowYear,  setInvFlowYear]  = useState(() => new Date().getFullYear());
  const [invFlowMonth, setInvFlowMonth] = useState(() => new Date().getMonth() + 1);
  const [invFlowLoading, setInvFlowLoading] = useState(false);
  const [restockYear,  setRestockYear]  = useState(() => new Date().getFullYear());
  const [restockMonth, setRestockMonth] = useState(() => new Date().getMonth() + 1);
  const [restockLoading, setRestockLoading] = useState(false);
  const [invFlowFMYear,  setInvFlowFMYear]  = useState(() => new Date().getFullYear());
  const [invFlowFMMonth, setInvFlowFMMonth] = useState(() => new Date().getMonth() + 1);
  const [invFlowFMLoading, setInvFlowFMLoading] = useState(false);
  const [latenessYear,  setLatenessYear]  = useState(() => new Date().getFullYear());
  const [latenessMonth, setLatenessMonth] = useState(() => new Date().getMonth() + 1);
  const [latenessLoading, setLatenessLoading] = useState(false);
  const [restockStorageYear,  setRestockStorageYear]  = useState(() => new Date().getFullYear());
  const [restockStorageMonth, setRestockStorageMonth] = useState(() => new Date().getMonth() + 1);
  const [restockStorageLoading, setRestockStorageLoading] = useState(false);

  // ── Load analytics ────────────────────────────────────────────────────────
  const loadDashboard = useCallback(async (filters = {}) => {
    if (!user || isIT) return; // IT dept returns {} — no analytics dashboard
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const data = await dashboardRepository.getData({
        userId:       user.id,
        role:         user.role,
        departmentId: user.department_id ?? user.departement_id,
        filters,
      });
      setDashboardData(data);
      // Seed overlay with lateness keys so the lateness card always renders
      const seed = {};
      if ('get_global_lateness_trends' in data) {
        seed.get_global_lateness_trends = data.get_global_lateness_trends || { data: [], warnings: [], chart: null };
        setLatenessData({ key: 'get_global_lateness_trends', value: seed.get_global_lateness_trends });
      }
      if ('get_branch_lateness_trends' in data) {
        seed.get_branch_lateness_trends = data.get_branch_lateness_trends || { data: [], warnings: [], chart: null };
        if (!seed.get_global_lateness_trends) {
          setLatenessData({ key: 'get_branch_lateness_trends', value: seed.get_branch_lateness_trends });
        }
      }
      if (Object.keys(seed).length) setAnalyticsOverlay(seed);
    } catch (err) {
      setDashboardError(err.message);
    } finally {
      setDashboardLoading(false);
    }
  }, [user, isIT]);

  useEffect(() => { loadDashboard(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── "Ask AI" event bus ────────────────────────────────────────────────────
  // GraphsTab and OverviewTab dispatch a custom 'askAI' DOM event when the
  // user clicks an "Ask AI" button on a chart/metric card.  They also write
  // the source label + data to sessionStorage so AITab can pick it up on mount.
  // This approach requires zero changes to the 6 Strategy files.
  useEffect(() => {
    const handler = () => setActiveTab('ai');
    window.addEventListener('askAI', handler);
    return () => window.removeEventListener('askAI', handler);
  }, []);

  // ── Month-picker refetch helpers (forwarded to strategies) ───────────────
  const refetchMonthlyRevenue = useCallback(async (year, month) => {
    if (!user) return;
    setMRevLoading(true);
    const deptId = user.department_id || user.departement_id;
    try {
      const r = await fetch(`http://localhost:3000/api/dashboard?userId=${user.id}&role=${user.role}&departmentId=${deptId}&monthly_revenue_year=${year}&monthly_revenue_month=${month}`);
      const d = await r.json();
      if (d.get_global_monthly_revenue) setDashboardData(prev => ({ ...prev, get_global_monthly_revenue: d.get_global_monthly_revenue }));
    } catch { /* silent */ }
    setMRevLoading(false);
  }, [user]);

  const refetchBranchPerfByMonth = useCallback(async (year, month) => {
    if (!user) return;
    setBPerfLoading(true);
    const deptId = user.department_id || user.departement_id;
    try {
      const r = await fetch(`http://localhost:3000/api/dashboard?userId=${user.id}&role=${user.role}&departmentId=${deptId}&branch_perf_year=${year}&branch_perf_month=${month}`);
      const d = await r.json();
      if (d.get_global_branch_performance_by_month) setDashboardData(prev => ({ ...prev, get_global_branch_performance_by_month: d.get_global_branch_performance_by_month }));
    } catch { /* silent */ }
    setBPerfLoading(false);
  }, [user]);

  const refetchInvFlowTrends = useCallback(async (year, month) => {
    if (!user) return;
    setInvFlowLoading(true);
    const deptId = user.department_id || user.departement_id;
    try {
      const r = await fetch(`http://localhost:3000/api/dashboard?userId=${user.id}&role=${user.role}&departmentId=${deptId}&inv_flow_year=${year}&inv_flow_month=${month}`);
      const d = await r.json();
      if (d.get_global_inventory_flow_trends) setAnalyticsOverlay(prev => ({ ...prev, get_global_inventory_flow_trends: d.get_global_inventory_flow_trends }));
    } catch { /* silent */ }
    setInvFlowLoading(false);
  }, [user]);

  const refetchRestockCosts = useCallback(async (year, month) => {
    if (!user) return;
    setRestockLoading(true);
    const deptId = user.department_id || user.departement_id;
    try {
      const r = await fetch(`http://localhost:3000/api/dashboard?userId=${user.id}&role=${user.role}&departmentId=${deptId}&restock_year=${year}&restock_month=${month}`);
      const d = await r.json();
      if (d.get_global_restock_costs)  setAnalyticsOverlay(prev => ({ ...prev, get_global_restock_costs:  d.get_global_restock_costs  }));
      if (d.get_finance_restock_costs) setAnalyticsOverlay(prev => ({ ...prev, get_finance_restock_costs: d.get_finance_restock_costs }));
    } catch { /* silent */ }
    setRestockLoading(false);
  }, [user]);

  const refetchInvFlowFM = useCallback(async (year, month) => {
    if (!user) return;
    setInvFlowFMLoading(true);
    const deptId = user.department_id || user.departement_id;
    try {
      const r = await fetch(`http://localhost:3000/api/dashboard?userId=${user.id}&role=${user.role}&departmentId=${deptId}&inv_flow_fm_year=${year}&inv_flow_fm_month=${month}`);
      const d = await r.json();
      if (d.get_global_inventory_flow) setAnalyticsOverlay(prev => ({ ...prev, get_global_inventory_flow: d.get_global_inventory_flow }));
    } catch { /* silent */ }
    setInvFlowFMLoading(false);
  }, [user]);

  const refetchLateness = useCallback(async (year, month) => {
    if (!user) return;
    setLatenessLoading(true);
    const deptId = user.department_id || user.departement_id;
    try {
      const r = await fetch(`http://localhost:3000/api/dashboard?userId=${user.id}&role=${user.role}&departmentId=${deptId}&lateness_year=${year}&lateness_month=${month}`);
      const d = await r.json();
      if ('get_global_lateness_trends' in d) {
        const val = d.get_global_lateness_trends || { data: [], warnings: [], chart: null };
        setAnalyticsOverlay(prev => ({ ...prev, get_global_lateness_trends: val }));
        setLatenessData({ key: 'get_global_lateness_trends', value: val });
      }
      if ('get_branch_lateness_trends' in d) {
        const val = d.get_branch_lateness_trends || { data: [], warnings: [], chart: null };
        setAnalyticsOverlay(prev => ({ ...prev, get_branch_lateness_trends: val }));
        setLatenessData({ key: 'get_branch_lateness_trends', value: val });
      }
    } catch { /* silent */ }
    setLatenessLoading(false);
  }, [user]);

  const refetchRestockStorage = useCallback(async (year, month) => {
    if (!user) return;
    setRestockStorageLoading(true);
    const deptId = user.department_id || user.departement_id;
    try {
      const r = await fetch(`http://localhost:3000/api/dashboard?userId=${user.id}&role=${user.role}&departmentId=${deptId}&restock_storage_year=${year}&restock_storage_month=${month}`);
      const d = await r.json();
      if (d.get_finance_restock_storages) setAnalyticsOverlay(prev => ({ ...prev, get_finance_restock_storages: d.get_finance_restock_storages }));
    } catch { /* silent */ }
    setRestockStorageLoading(false);
  }, [user]);

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    logout();
    navigate('/');
  }, [logout, navigate]);

  if (!user) return null;

  // Merge overlay on top of dashboardData for strategies that need filtered data
  const analyticsSource = Object.keys(analyticsOverlay).length > 0
    ? { ...dashboardData, ...analyticsOverlay }
    : dashboardData;

  // Props forwarded through DashboardFactory to every Strategy component
  const strategyProps = {
    mRevYear,   setMRevYear,   mRevMonth,  setMRevMonth,  mRevLoading,
    bPerfYear,  setBPerfYear,  bPerfMonth, setBPerfMonth, bPerfLoading,
    invFlowYear, setInvFlowYear, invFlowMonth, setInvFlowMonth, invFlowLoading,
    restockYear, setRestockYear, restockMonth, setRestockMonth, restockLoading,
    invFlowFMYear, setInvFlowFMYear, invFlowFMMonth, setInvFlowFMMonth, invFlowFMLoading,
    latenessYear, setLatenessYear, latenessMonth, setLatenessMonth, latenessLoading,
    latenessData,
    restockStorageYear, setRestockStorageYear, restockStorageMonth, setRestockStorageMonth, restockStorageLoading,
    refetchMonthlyRevenue,
    refetchBranchPerfByMonth,
    refetchInvFlowTrends,
    refetchRestockCosts,
    refetchInvFlowFM,
    refetchLateness,
    refetchRestockStorage,
    analyticsSource,
    reloadDashboard: loadDashboard,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <StyleTag />

      <div
        className={`app-shell ${isDark ? 'dark' : 'light'}`}
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => { setActiveTab(tab); setSidebarOpen(false); }}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          tx={tx}
        />

        <div className="main-area">

          {/* ── Topbar ──────────────────────────────────────────────────── */}
          <Topbar
            onMenuClick={() => setSidebarOpen(o => !o)}
            onLogout={handleLogout}
            tx={tx}
            activeTab={activeTab}
          />

          {/* ── Content area ─────────────────────────────────────────────
           *
           * RENDERING ORDER:
           *   1. Shared tabs  — rendered directly here, bypassing the Factory.
           *      These are role-agnostic; every department sees the same component.
           *
           *   2. Role-specific tabs — delegated to DashboardFactory, which uses
           *      the Strategy Pattern to mount the correct department strategy.
           *      The Factory itself only renders when activeTab is NOT a shared key
           *      (guarded by SHARED_TABS.has(activeTab)).
           *
           * ─── Why the Factory is excluded for shared tabs ──────────────
           *
           * DashboardFactory mounts a Strategy (e.g. SalesDashboardStrategy) that
           * internally checks activeTab to decide which sub-view to render.  If we
           * let the Factory run while activeTab === 'profile', the strategy would
           * render nothing (or fall through to a default), creating a blank area
           * alongside the shared component.  The SHARED_TABS guard prevents this.
           *
           * ─────────────────────────────────────────────────────────────── */}
          <div className="content-area">

            {/*
             * ProfileTab
             * ──────────
             * Guard   : activeTab === 'profile'
             * Roles   : ALL (no role restriction — every employee has a profile)
             * Props   : none — reads user from AuthContext directly
             */}
            {activeTab === 'profile' && (
              <ProfileTab />
            )}

            {/*
             * AITab
             * ─────
             * Guard   : activeTab === 'ai'  &&  aiEnabled  &&  !isIT
             * Roles   : All non-IT employees when the AI toggle is ON
             * Props   : dashboardData — the raw (pre-overlay) analytics payload.
             *           AITab uses this to populate the left-panel source list.
             *           We pass dashboardData (not analyticsSource) deliberately:
             *           the overlay contains per-filter slices, not full metric sets.
             */}
            {activeTab === 'ai' && aiEnabled && !isIT && (
              <AITab dashboardData={dashboardData} />
            )}

            {/*
             * ContactAdminTab
             * ───────────────
             * Guard   : activeTab === 'contact_admin'  &&  !isIT
             * Roles   : All non-IT employees
             *           (IT users manage the inbox via ITDashboardStrategy,
             *            not this component)
             * Props   : tx — translation strings from useTranslation().
             *           ContactAdminTab uses these for labels that must match
             *           Dashboard-level translation (contactType, contactDesc,
             *           sendRequest, preview, etc.).
             */}
            {activeTab === 'contact_admin' && !isIT && (
              <ContactAdminTab tx={tx} />
            )}

            {/*
             * DashboardFactory (Strategy Pattern entry point)
             * ───────────────────────────────────────────────
             * Rendered only when activeTab is NOT a shared tab key.
             * The Factory resolves the correct Strategy component based on
             * the current user's department/role from AuthContext:
             *
             *   isIT        → ITDashboardStrategy
             *   isSales     → SalesDashboardStrategy
             *   isFinance   → FinanceDashboardStrategy
             *   isHR        → HRDashboardStrategy
             *   isPR        → PRDashboardStrategy
             *   isInventory → InventoryDashboardStrategy
             *   isOwner /
             *   isManager   → ManagerDashboardStrategy
             *
             * All strategies receive the same prop interface (Open/Closed Principle)
             * so adding a new department requires only a new Strategy + one new
             * case in DashboardFactory — existing code is never modified.
             */}
            {!SHARED_TABS.has(activeTab) && (
              <DashboardFactory
                dashboardData={analyticsSource}
                dashboardLoading={dashboardLoading}
                dashboardError={dashboardError}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                strategyProps={strategyProps}
              />
            )}

          </div>
        </div>
      </div>
    </>
  );
}