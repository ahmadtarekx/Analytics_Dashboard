/**
 * DashboardFactory.jsx — Factory Pattern
 *
 * Takes the current user (from AuthContext) and returns the correct
 * Strategy component for that user's department + role combination.
 *
 * Adding a new department requires only a new Strategy component and
 * one new case here — existing code is never modified (Open/Closed Principle).
 *
 * Department IDs (from the DB):
 *   1 = Sales     2 = Finance     3 = HR
 *   4 = PR        5 = Inventory   6 = IT
 *
 * Resolution order (top = highest priority):
 *   isIT        → ITDashboardStrategy
 *   isSales     → SalesDashboardStrategy   (emp, leader, sales_manager all use this)
 *   isFinance   → FinanceDashboardStrategy
 *   isHR        → HRDashboardStrategy
 *   isPR        → PRDashboardStrategy
 *   isInventory → InventoryDashboardStrategy
 *   isOwner /
 *   isManager   → ManagerDashboardStrategy  (Owner must come before generic manager)
 *
 * All strategies receive the same prop interface (Open/Closed):
 *   dashboardData     — merged analytics JSON (overlay applied by Dashboard.jsx)
 *   dashboardLoading  — boolean
 *   dashboardError    — string | null
 *   activeTab         — currently active sidebar tab key
 *   setActiveTab      — setter
 *   strategyProps     — additional forwarded props (month pickers, refetch fns, etc.)
 */

import { lazy, Suspense } from 'react';
import { useAuth } from '../context/AuthContext';

// Lazy-load strategies so each bundle is only fetched when needed.
const ITDashboardStrategy        = lazy(() => import('../strategies/ITDashboardStrategy'));
const SalesDashboardStrategy     = lazy(() => import('../strategies/SalesDashboardStrategy'));
const FinanceDashboardStrategy   = lazy(() => import('../strategies/FinanceDashboardStrategy'));
const HRDashboardStrategy        = lazy(() => import('../strategies/HRDashboardStrategy'));
const PRDashboardStrategy        = lazy(() => import('../strategies/PRDashboardStrategy'));
const InventoryDashboardStrategy = lazy(() => import('../strategies/InventoryDashboardStrategy'));
const ManagerDashboardStrategy   = lazy(() => import('../strategies/ManagerDashboardStrategy'));

// ── Loading fallback ───────────────────────────────────────────────────────────
function LoadingFallback({ isDark }) {
  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      height:         '60vh',
      color:          isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
      fontSize:       14,
    }}>
      Loading...
    </div>
  );
}

/**
 * DashboardFactory
 *
 * Reads the current user from AuthContext, selects the correct Strategy,
 * and mounts it inside a Suspense boundary.
 *
 * All strategies receive the same prop interface so the factory
 * never needs to know each strategy's internals (Open/Closed).
 *
 * @param {object}        props.dashboardData     — merged analytics JSON from Dashboard
 * @param {boolean}       props.dashboardLoading
 * @param {string|null}   props.dashboardError
 * @param {string}        props.activeTab         — currently active sidebar tab key
 * @param {Function}      props.setActiveTab
 * @param {object}        [props.strategyProps]   — additional forwarded props
 */
export default function DashboardFactory({
  dashboardData,
  dashboardLoading,
  dashboardError,
  activeTab,
  setActiveTab,
  strategyProps = {},
}) {
  const {
    user,
    isDark,
    isIT,
    isSales,
    isFinance,
    isHR,
    isPR,
    isInventory,
    isOwner,
    isManager,
  } = useAuth();

  if (!user) return null;

  const sharedProps = {
    dashboardData,
    dashboardLoading,
    dashboardError,
    activeTab,
    setActiveTab,
    ...strategyProps,
  };

  // ── Strategy resolution ────────────────────────────────────────────────────
  let StrategyComponent;

  if (isIT) {
    // IT users have no analytics dashboard — only it_tools and it_inbox tabs.
    StrategyComponent = ITDashboardStrategy;
  } else if (isSales) {
    // Sales emp, leader, and manager all use SalesDashboardStrategy;
    // the strategy itself renders different sub-views based on role.
    StrategyComponent = SalesDashboardStrategy;
  } else if (isFinance) {
    StrategyComponent = FinanceDashboardStrategy;
  } else if (isHR) {
    StrategyComponent = HRDashboardStrategy;
  } else if (isPR) {
    StrategyComponent = PRDashboardStrategy;
  } else if (isInventory) {
    StrategyComponent = InventoryDashboardStrategy;
  } else if (isOwner || isManager) {
    // Non-dept managers (HR Manager, Finance Manager not already caught above,
    // PR Manager) and the Owner all land here for cross-dept approvals + search.
    StrategyComponent = ManagerDashboardStrategy;
  } else {
    // Unknown / unhandled department — render nothing gracefully.
    return null;
  }

  return (
    <Suspense fallback={<LoadingFallback isDark={isDark} />}>
      <StrategyComponent {...sharedProps} />
    </Suspense>
  );
}
