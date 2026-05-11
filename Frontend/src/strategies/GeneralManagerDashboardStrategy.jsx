/**
 * GeneralManagerDashboardStrategy.jsx — Strategy Pattern (New)
 *
 * Handles the Owner / General Manager role — a user who belongs to no specific
 * operational department but has cross-department visibility and authority.
 *
 * This role is identified by:
 *   • user.id === 91949  (isOwner — the fixed owner account)
 *   • user.role === 'dep_manager' with no domain-specific department, OR
 *     any department whose DashboardFactory entry resolves to this strategy.
 *
 * Tabs handled:
 *   approvals  → <ManagerDashboardStrategy />   (all pending requests + expenses
 *                                                 + PR campaigns for owner)
 *   emp_search → <ManagerDashboardStrategy />   (cross-department employee search)
 *   overview   → <OverviewTab />               (global analytics)
 *   graphs     → <GraphsTab />                 (global chart grid)
 *
 * ── Why a separate strategy? ─────────────────────────────────────────────────
 *   The DashboardFactory resolves a strategy per (department_id, role) pair.
 *   General Managers and the Owner may have a department_id that doesn't match
 *   any of the operational strategies (Sales=1, Finance=2, HR=3, PR=4,
 *   Inventory=5, IT=6).  Without this strategy the factory would fall through to
 *   a default that renders nothing, producing the same blank-screen bug.
 *
 * ── Design ───────────────────────────────────────────────────────────────────
 *   All manager-tab state and UI live in ManagerDashboardStrategy (SRP).
 *   This file is a pure routing shell — it carries zero local state.
 *
 * Props (standard DashboardFactory interface):
 *   dashboardData     {object|null}
 *   dashboardLoading  {boolean}
 *   dashboardError    {string|null}
 *   activeTab         {string}
 *   setActiveTab      {Function}
 *   [strategyProps]   {object}  — month-picker + refetch helpers forwarded down
 */

import OverviewTab              from '../components/common/OverviewTab';
import GraphsTab                from '../components/common/GraphsTab';
import ManagerDashboardStrategy from './ManagerDashboardStrategy';

// Every tab the General Manager / Owner can reach.
const ALLOWED_TABS = new Set(['approvals', 'emp_search', 'overview', 'graphs']);

export default function GeneralManagerDashboardStrategy({
  dashboardData,
  dashboardLoading,
  dashboardError,
  activeTab,
  setActiveTab,
  ...strategyProps
}) {
  // Unknown tab — nothing to render.
  if (!ALLOWED_TABS.has(activeTab)) return null;

  // ── Shared analytics tabs ─────────────────────────────────────────────────
  if (activeTab === 'overview') {
    return (
      <OverviewTab
        dashboardData={dashboardData}
        dashboardLoading={dashboardLoading}
        dashboardError={dashboardError}
        {...strategyProps}
      />
    );
  }

  if (activeTab === 'graphs') {
    return (
      <GraphsTab
        dashboardData={dashboardData}
        dashboardLoading={dashboardLoading}
      />
    );
  }

  // ── Manager-owned tabs: delegate entirely to ManagerDashboardStrategy ──────
  // approvals  → cross-department pending requests, expense approvals, PR campaigns
  // emp_search → search any employee across all departments
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
