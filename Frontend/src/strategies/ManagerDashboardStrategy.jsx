/**
 * ManagerDashboardStrategy.jsx — Strategy Pattern (Refactored)
 *
 * Owns ALL state and orchestration logic for every Manager / Owner role.
 * Delegates rendering to focused Tab Components:
 *
 *   approvals  → ApprovalsTab    (replaces ManagerApprovalsTab — unified component)
 *   emp_search → EmpSearchTab
 *   overview   → OverviewTab    (shared, props-based)
 *   graphs     → GraphsTab      (shared, props-based)
 *
 * ── EMPSEARCH PERMISSION AUDIT ───────────────────────────────────────────────
 *   isManager (from old Dashboard.jsx line 1336) =
 *     user.role === 'dep_manager'   (covers HR, IT, Finance, Sales, Inventory, PR managers)
 *     || user.role === 'sales_manager'
 *     || isOwner
 *
 *   ALL of these role-types are routed here by DashboardFactory FIRST, before
 *   their department-specific strategies. This strategy is therefore the SOLE
 *   and CORRECT handler of emp_search — no other strategy needs EmpSearchTab.
 *   The original permission model is fully preserved.
 *
 * Repositories:
 *   managerRepository — searchEmployee, getEmployeeStats, getApprovals, resolveApproval
 *   financeRepository — getPendingExpenses, resolveExpense  (Owner + Finance Manager)
 *   prRepository      — getPendingCampaigns, resolveCampaign (Owner)
 *
 * Auth flags from useAuth():
 *   isOwner, isFinanceManager  (role-specific sub-view switches inside ApprovalsTab)
 *
 * Props interface (standard — from DashboardFactory):
 *   dashboardData     {object|null}
 *   dashboardLoading  {boolean}
 *   dashboardError    {string|null}
 *   activeTab         {string}
 *   setActiveTab      {Function}
 *   [strategyProps]   {object}  — forwarded month-picker + refetch helpers
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth }            from '../context/AuthContext';
import { useTranslation }     from '../hooks/useTranslation';
import managerRepository      from '../api/managerRepository';
import financeRepository      from '../api/financeRepository';
import prRepository           from '../api/prRepository';
import Icon, { IC }           from '../components/ui/Icon';
import { ACCENTS }            from '../components/charts/chartUtils';

// ── Tab Components ────────────────────────────────────────────────────────────
import ApprovalsTab  from '../components/common/ApprovalsTab';
import EmpSearchTab  from '../components/common/EmpSearchTab';
import OverviewTab   from '../components/common/OverviewTab';
import GraphsTab     from '../components/common/GraphsTab';

// ── Local helpers ─────────────────────────────────────────────────────────────

const ALLOWED_TABS = new Set(['approvals', 'emp_search', 'overview', 'graphs']);

// ── Component ─────────────────────────────────────────────────────────────────

export default function ManagerDashboardStrategy({
  dashboardData,
  dashboardLoading,
  dashboardError,
  activeTab,
  setActiveTab,
  ...strategyProps
}) {
  const {
    user,
    language,
    isOwner,
    isFinanceManager,
    aiEnabled,
  } = useAuth();
  const tx = useTranslation(language);

  // ── Approvals state ───────────────────────────────────────────────────────
  const [approvals,               setApprovals]               = useState([]);
  const [apprLoading,             setApprLoading]             = useState(false);
  const [approvalSubTab,          setApprovalSubTab]          = useState('approvals');
  const [ownerCampaigns,          setOwnerCampaigns]          = useState([]);
  const [ownerCampaignsLoading,   setOwnerCampaignsLoading]   = useState(false);
  const [approvalExpenses,        setApprovalExpenses]        = useState([]);
  const [approvalExpensesLoading, setApprovalExpensesLoading] = useState(false);

  // ── Employee Search state ─────────────────────────────────────────────────
  const [empSearchId,        setEmpSearchId]        = useState('');
  const [empSearchResult,    setEmpSearchResult]    = useState(null);
  const [empSearchAnalytics, setEmpSearchAnalytics] = useState(null);
  const [empSearchCharts,    setEmpSearchCharts]    = useState([]);
  const [empSearchLoading,   setEmpSearchLoading]   = useState(false);
  const [empSearchError,     setEmpSearchError]     = useState(null);

  // ── Card detail modal (used by EmpSearchTab) ──────────────────────────────
  const [selectedCard,  setSelectedCard]  = useState(null);

  // ── Load approvals ────────────────────────────────────────────────────────

  const loadApprovals = useCallback(async () => {
    if (!user) return;
    setApprLoading(true);
    try {
      const data = await managerRepository.getApprovals(user.id);
      setApprovals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[ManagerStrategy] loadApprovals:', err.message);
    } finally {
      setApprLoading(false);
    }
  }, [user]);

  const loadOwnerCampaigns = useCallback(async () => {
    if (!isOwner) return;
    setOwnerCampaignsLoading(true);
    try {
      const data = await prRepository.getPendingCampaigns(user.id);
      setOwnerCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[ManagerStrategy] loadOwnerCampaigns:', err.message);
    } finally {
      setOwnerCampaignsLoading(false);
    }
  }, [user, isOwner]);

  const loadApprovalExpenses = useCallback(async () => {
    if (!isOwner && !isFinanceManager) return;
    setApprovalExpensesLoading(true);
    try {
      const data = await financeRepository.getPendingExpenses(user.id);
      setApprovalExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[ManagerStrategy] loadApprovalExpenses:', err.message);
    } finally {
      setApprovalExpensesLoading(false);
    }
  }, [user, isOwner, isFinanceManager]);

  useEffect(() => {
    if (activeTab === 'approvals') {
      loadApprovals();
      if (isOwner)                     loadOwnerCampaigns();
      if (isOwner || isFinanceManager) loadApprovalExpenses();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resolve handlers ──────────────────────────────────────────────────────

  const handleResolveApproval = useCallback(async (ticketId, status) => {
    setApprovals(prev => prev.filter(a => a.ticket_id !== ticketId));
    try {
      const res = await managerRepository.resolveApproval({ ticket_id: ticketId, status });
      if (!res?.message) loadApprovals();
    } catch {
      loadApprovals();
      alert('Failed to resolve request. Please try again.');
    }
  }, [loadApprovals]);

  const handleResolveExpense = useCallback(async (ticketId, action) => {
    setApprovalExpenses(prev => prev.filter(e => e.ticket_id !== ticketId));
    try {
      await financeRepository.resolveExpense({ ticket_id: ticketId, action });
    } catch {
      loadApprovalExpenses();
      alert('Failed to process expense. Please try again.');
    }
  }, [loadApprovalExpenses]);

  const handleResolveCampaign = useCallback(async (ticketId, action) => {
    setOwnerCampaigns(prev => prev.filter(c => c.ticket_id !== ticketId));
    try {
      await prRepository.resolveCampaign({ ticket_id: ticketId, action });
    } catch {
      loadOwnerCampaigns();
      alert('Failed to process campaign. Please try again.');
    }
  }, [loadOwnerCampaigns]);

  // ── Employee Search ───────────────────────────────────────────────────────

  const handleEmpSearch = useCallback(async () => {
    const id = parseInt(empSearchId);
    if (!id || id <= 0) return;
    setEmpSearchLoading(true);
    setEmpSearchError(null);
    setEmpSearchResult(null);
    setEmpSearchAnalytics(null);
    setEmpSearchCharts([]);
    try {
      const empData = await managerRepository.searchEmployee({
        manager_id: user.id,
        emp_id: id,
      });
      setEmpSearchResult(empData);

      const analData = await managerRepository.getEmployeeStats({
        manager_id: user.id,
        emp_id: id,
      });
      if (analData && !analData.error && !analData.message) {
        setEmpSearchAnalytics(analData);
        const charts = Object.entries(analData)
          .filter(([, v]) => v?.chart?.data?.length > 0)
          .map(([key, v]) => ({ key, figure: v.chart }));
        setEmpSearchCharts(charts);
      }
    } catch (err) {
      setEmpSearchError(err.message || 'Employee not found.');
    } finally {
      setEmpSearchLoading(false);
    }
  }, [user, empSearchId]);

  const handleEmpSearchClear = useCallback(() => {
    setEmpSearchResult(null);
    setEmpSearchAnalytics(null);
    setEmpSearchCharts([]);
    setEmpSearchError(null);
    setEmpSearchId('');
  }, []);

  // ── Render guard ──────────────────────────────────────────────────────────

  if (!ALLOWED_TABS.has(activeTab)) return null;

  // ── Overview / Graphs — delegate to shared tab components ─────────────────

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

  // ── Card detail modal (used by EmpSearchTab) ──────────────────────────────

  const CardModal = () => {
    if (!selectedCard) return null;
    return (
      <div className="modal-overlay" onClick={() => setSelectedCard(null)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700,
                color: selectedCard.hasWarn ? '#ef4444' : 'var(--txt2)',
                textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4,
              }}>
                {selectedCard.name}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--txt)' }}>
                {selectedCard.displayVal}
              </div>
            </div>
            <button className="close-btn" onClick={() => setSelectedCard(null)}>
              <Icon d={IC.close} size={20} />
            </button>
          </div>
          <div className="modal-body scroll-area">
            {selectedCard.data.warnings?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon d={IC.warn} size={16} /> {tx.alert || 'Alerts'}
                </div>
                {selectedCard.data.warnings.map((w, wi) => (
                  <div key={wi} style={{
                    padding: '12px 16px', background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
                    color: '#fca5a5', fontSize: 13, lineHeight: 1.6, marginBottom: 8,
                  }}>
                    {w}
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon d={IC.table} size={16} color="var(--accent2)" /> {tx.detailsTable || 'Details'}
            </div>
            {selectedCard.data.data?.length > 0 ? (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {Object.keys(selectedCard.data.data[0]).map(k => (
                        <th key={k}>{k.replace(/_/g, ' ')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCard.data.data.map((row, ri) => (
                      <tr key={ri}>
                        {Object.values(row).map((val, ci) => (
                          <td key={ci}>
                            {typeof val === 'number' && val % 1 !== 0 ? val.toFixed(2) : String(val ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--txt3)', background: 'var(--surface2)', borderRadius: 10 }}>
                {tx.noData || 'No data available.'}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Approvals tab ─────────────────────────────────────────────────────────

  if (activeTab === 'approvals') {
    return (
      <>
        <CardModal />
        <ApprovalsTab
          language={language}
          isOwner={isOwner}
          isFinanceManager={isFinanceManager}

          // Manager approvals
          approvals={approvals}
          apprLoading={apprLoading}
          onResolveApproval={handleResolveApproval}

          // PR campaigns (Owner only)
          ownerCampaigns={ownerCampaigns}
          ownerCampaignsLoading={ownerCampaignsLoading}
          onResolveCampaign={handleResolveCampaign}

          // Expense approvals (Owner + Finance Manager)
          approvalExpenses={approvalExpenses}
          approvalExpensesLoading={approvalExpensesLoading}
          onResolveExpense={handleResolveExpense}

          // Sub-tab
          approvalSubTab={approvalSubTab}
          setApprovalSubTab={setApprovalSubTab}

          // Refresh
          onRefresh={() => {
            loadApprovals();
            if (isOwner)                     loadOwnerCampaigns();
            if (isOwner || isFinanceManager) loadApprovalExpenses();
          }}
        />
      </>
    );
  }

  // ── Employee Search tab ───────────────────────────────────────────────────

  if (activeTab === 'emp_search') {
    return (
      <>
        <CardModal />
        <EmpSearchTab
          empSearchId={empSearchId}
          setEmpSearchId={setEmpSearchId}
          empSearchResult={empSearchResult}
          empSearchAnalytics={empSearchAnalytics}
          empSearchCharts={empSearchCharts}
          empSearchLoading={empSearchLoading}
          empSearchError={empSearchError}
          onSearch={handleEmpSearch}
          onClear={handleEmpSearchClear}
          onSelectCard={setSelectedCard}
          aiEnabled={aiEnabled}
          onAskAI={null} // Wire to openAiPanel if AI panel is in scope
          language={language}
          departmentName={user?.department_name || ''}
        />
      </>
    );
  }

  return null;
}
