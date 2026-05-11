/**
 * InventoryDashboardStrategy.jsx — Strategy Pattern
 *
 * Routing shell for the Inventory department (dept 5).
 * Resolves the active tab and delegates rendering to the correct component:
 *
 *   approvals  → <ManagerDashboardStrategy />  (Inventory Manager only)
 *   emp_search → <ManagerDashboardStrategy />  (Inventory Manager only)
 *   products   → <InventoryProductsTab />       (all Inventory employees)
 *   overview   → <OverviewTab />               (shared analytics tab)
 *   graphs     → <GraphsTab />                 (shared charts tab)
 *
 * ── RBAC ─────────────────────────────────────────────────────────────────────
 *   All Inventory employees see the 'products' tab.
 *   The Inventory Manager (role === 'dep_manager') additionally sees:
 *     • 'approvals'  — Pending Approvals (via ManagerDashboardStrategy)
 *     • 'emp_search' — Employee Search   (via ManagerDashboardStrategy)
 *
 *   FIX (2026-05-11): Previously these two manager-only tabs returned a blank
 *   screen because InventoryDashboardStrategy had no handler for them.
 *   The fix delegates both tabs to ManagerDashboardStrategy, which owns all
 *   approval and employee-search state and UI.  This matches the original
 *   Dashboard.jsx behaviour where isManager guarded both views regardless of
 *   department (lines 1764–1774).
 *
 * ── Design Decisions ─────────────────────────────────────────────────────────
 *   • Manager-tab delegation is an explicit guard at the top of the render —
 *     it short-circuits before any Inventory-specific logic runs, keeping
 *     the responsibility boundary clear (SRP).
 *   • This strategy carries NO local state — all product catalog state,
 *     add-product form state, and removal modal state are owned by
 *     InventoryProductsTab (Single Responsibility Principle).
 *
 * ── Props (from DashboardFactory) ────────────────────────────────────────────
 *   dashboardData     {object|null}   — merged analytics JSON
 *   dashboardLoading  {boolean}
 *   dashboardError    {string|null}
 *   activeTab         {string}        — current sidebar tab key
 *   setActiveTab      {Function}
 *   [strategyProps]   {object}        — month-picker helpers forwarded to tabs
 */

import { useAuth }              from '../context/AuthContext';
import OverviewTab              from '../components/common/OverviewTab';
import GraphsTab                from '../components/common/GraphsTab';
import InventoryProductsTab     from '../components/common/InventoryProductsTab';
import ManagerDashboardStrategy from './ManagerDashboardStrategy';

// Manager-only tabs that must be delegated up to ManagerDashboardStrategy.
const MANAGER_TABS = new Set(['approvals', 'emp_search']);

export default function InventoryDashboardStrategy({
  dashboardData,
  dashboardLoading,
  dashboardError,
  activeTab,
  setActiveTab,
  ...strategyProps
}) {
  const { user } = useAuth();

  // ── Manager-tab delegation ─────────────────────────────────────────────────
  // Inventory Manager (dep_manager) and Owner need access to 'approvals' and
  // 'emp_search'.  ManagerDashboardStrategy owns all that state and UI, so we
  // delegate instead of duplicating logic here.
  const isManager =
    user?.role === 'dep_manager' ||
    user?.role === 'sales_manager' ||
    user?.id  === 91949; // isOwner

  if (isManager && MANAGER_TABS.has(activeTab)) {
    return (
      <ManagerDashboardStrategy
        dashboardData={dashboardData}
        dashboardLoading={dashboardLoading}
        dashboardError={dashboardError}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        {...strategyProps}
      />
    );
  }

  // ── Department-specific and shared analytics tabs ──────────────────────────
  return (
    <>
      {activeTab === 'products' && (
        <InventoryProductsTab />
      )}

      {activeTab === 'overview' && (
        <OverviewTab
          dashboardData={dashboardData}
          dashboardLoading={dashboardLoading}
          dashboardError={dashboardError}
          {...strategyProps}
        />
      )}

      {activeTab === 'graphs' && (
        <GraphsTab
          dashboardData={dashboardData}
          dashboardLoading={dashboardLoading}
        />
      )}
    </>
  );
}
