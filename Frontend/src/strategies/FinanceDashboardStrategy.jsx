/**
 * FinanceDashboardStrategy.jsx — Strategy Pattern (Refactored)
 *
 * Owns all state and UI for Finance department (department_id == 2).
 *
 * Tabs:
 *   approvals     → <ManagerDashboardStrategy />  (Finance Manager / Owner only)
 *   emp_search    → <ManagerDashboardStrategy />  (Finance Manager / Owner only)
 *   finance_tools — Submit Expense + My Submissions  (all finance employees)
 *                 — Pending Reports                  (finance manager / owner)
 *   overview      — Analytics MetricCard grid        → OverviewTab
 *   graphs        — Plotly chart grid                → GraphsTab
 *
 * Architecture:
 *   - All fetch() calls replaced with financeRepository.* (Repository Pattern)
 *   - overview/graphs delegate to shared prop-based Tab Components
 *   - finance_tools delegates to FinanceToolsTab (extracted Tab Component)
 *   - approvals/emp_search delegate to ManagerDashboardStrategy
 *
 * FIX (2026-05-11): Finance Manager (and Owner) who clicked "Pending Approvals"
 *   or "Employee Search" saw a blank screen.  Root cause: ALLOWED_TABS only
 *   included finance-specific tabs, so the render guard returned null for manager
 *   tabs.  Fix: intercept those tabs before the guard and delegate to
 *   ManagerDashboardStrategy, which owns all approval/emp-search state and UI.
 *   This restores the original Dashboard.jsx behaviour where isManager (line 1336)
 *   granted access to both views regardless of department.
 *
 * Props (standard DashboardFactory interface):
 *   dashboardData     {object|null}
 *   dashboardLoading  {boolean}
 *   dashboardError    {string|null}
 *   activeTab         {string}
 *   setActiveTab      {Function}
 *   [strategyProps]   {object}
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth }              from '../context/AuthContext';
import { useTranslation }       from '../hooks/useTranslation';
import financeRepository        from '../api/financeRepository';
import OverviewTab              from '../components/common/OverviewTab';
import GraphsTab                from '../components/common/GraphsTab';
import FinanceToolsTab          from '../components/common/FinanceToolsTab';
import ManagerDashboardStrategy from './ManagerDashboardStrategy';

// ── Local helpers ─────────────────────────────────────────────────────────────

// Finance-owned tabs only.  Manager-only tabs are handled before this set is checked.
const ALLOWED_TABS = new Set(['finance_tools', 'overview', 'graphs']);

// Manager-only tabs that must be delegated to ManagerDashboardStrategy.
const MANAGER_TABS = new Set(['approvals', 'emp_search']);

// ── Component ──────────────────────────────────────────────────────────────────

export default function FinanceDashboardStrategy({
  dashboardData,
  dashboardLoading,
  dashboardError,
  activeTab,
  setActiveTab,
  ...strategyProps
}) {
  const { user, language } = useAuth();

  const isFinanceManager =
    user && (user.department_id == 2 || user.departement_id == 2) &&
    user.role === 'dep_manager';
  const isOwner = user?.id === 91949;

  // ── Manager-tab delegation ─────────────────────────────────────────────────
  // Finance Manager and Owner need 'approvals' and 'emp_search'.
  // Delegate to ManagerDashboardStrategy, which owns all that state and UI.
  const isManager =
    user?.role === 'dep_manager' ||
    user?.role === 'sales_manager' ||
    isOwner;

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

  // ── Render guard (finance-owned tabs) ─────────────────────────────────────
  if (!ALLOWED_TABS.has(activeTab)) return null;

  // ── Expense submission state ───────────────────────────────────────────────
  const [expCategory, setExpCategory] = useState('Travel');
  const [expAmount,   setExpAmount]   = useState('');
  const [expDesc,     setExpDesc]     = useState('');
  const [expReceipt,  setExpReceipt]  = useState('');
  const [expStatus,   setExpStatus]   = useState(null);
  const [expLoading,  setExpLoading]  = useState(false);

  // ── My submitted expenses ──────────────────────────────────────────────────
  const [myExpenses,        setMyExpenses]        = useState([]);
  const [myExpensesLoading, setMyExpensesLoading] = useState(false);

  // ── Pending expense approvals (finance manager / owner) ───────────────────
  const [pendingExpenses,        setPendingExpenses]        = useState([]);
  const [pendingExpensesLoading, setPendingExpensesLoading] = useState(false);

  // ── Active sub-tab inside finance_tools ───────────────────────────────────
  const [financeActiveTab, setFinanceActiveTab] = useState('expense');

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadMyExpenses = useCallback(async () => {
    if (!user) return;
    setMyExpensesLoading(true);
    try {
      const data = await financeRepository.getMyExpenses(user.id);
      setMyExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[FinanceStrategy] loadMyExpenses:', err.message);
    } finally {
      setMyExpensesLoading(false);
    }
  }, [user]);

  const loadPendingExpenses = useCallback(async () => {
    if (!isFinanceManager && !isOwner) return;
    setPendingExpensesLoading(true);
    try {
      const data = await financeRepository.getPendingExpenses(user.id);
      setPendingExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[FinanceStrategy] loadPendingExpenses:', err.message);
    } finally {
      setPendingExpensesLoading(false);
    }
  }, [user, isFinanceManager, isOwner]);

  useEffect(() => {
    if (activeTab === 'finance_tools') { loadMyExpenses(); }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSubmitExpense = useCallback(async () => {
    if (!expAmount || !expDesc.trim()) return;
    setExpLoading(true);
    setExpStatus(null);
    try {
      const res = await financeRepository.submitExpense({
        emp_id:       user.id,
        category:     expCategory,
        amount:       parseFloat(expAmount),
        description:  expDesc,
        receipt_note: expReceipt,
      });
      setExpStatus({ type: 'success', msg: res.message || 'Expense submitted successfully.' });
      setExpAmount(''); setExpDesc(''); setExpReceipt('');
      loadMyExpenses();
    } catch (err) {
      setExpStatus({ type: 'error', msg: err.message || 'Network error.' });
    } finally {
      setExpLoading(false);
    }
  }, [user, expCategory, expAmount, expDesc, expReceipt, loadMyExpenses]);

  const handleResolveExpense = useCallback(async (ticketId, action) => {
    setPendingExpenses(prev => prev.filter(e => e.ticket_id !== ticketId));
    try {
      await financeRepository.resolveExpense({ ticket_id: ticketId, action });
    } catch {
      loadPendingExpenses();
      alert('Failed to process expense. Please try again.');
    }
  }, [loadPendingExpenses]);

  // ── Overview / Graphs ─────────────────────────────────────────────────────

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
    return <GraphsTab dashboardData={dashboardData} dashboardLoading={dashboardLoading} />;
  }

  // ── Finance Tools tab ─────────────────────────────────────────────────────

  if (activeTab === 'finance_tools') {
    return (
      <FinanceToolsTab
        // role
        isFinanceManager={isFinanceManager}
        isOwner={isOwner}
        language={language}

        // Expense submission
        expCategory={expCategory}
        setExpCategory={setExpCategory}
        expAmount={expAmount}
        setExpAmount={setExpAmount}
        expDesc={expDesc}
        setExpDesc={setExpDesc}
        expReceipt={expReceipt}
        setExpReceipt={setExpReceipt}
        expStatus={expStatus}
        expLoading={expLoading}
        onSubmitExpense={handleSubmitExpense}

        // My expenses
        myExpenses={myExpenses}
        myExpensesLoading={myExpensesLoading}
        onLoadMyExpenses={loadMyExpenses}

        // Pending expenses
        pendingExpenses={pendingExpenses}
        pendingExpensesLoading={pendingExpensesLoading}
        onLoadPendingExpenses={loadPendingExpenses}
        onResolveExpense={handleResolveExpense}

        // Sub-tab
        financeActiveTab={financeActiveTab}
        setFinanceActiveTab={setFinanceActiveTab}
      />
    );
  }

  return null;
}
