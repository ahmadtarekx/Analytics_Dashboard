/**
 * PRDashboardStrategy.jsx — Strategy Pattern
 *
 * Routing shell for the Public Relations department (dept 4).
 * Resolves the active tab and delegates rendering to the correct component:
 *
 *   pr_tools      → <PRToolsTab />       (self-contained; owns all PR state)
 *   overview      → <OverviewTab />      (shared analytics tab)
 *   graphs        → <GraphsTab />        (shared charts tab)
 *
 * ── OWNER TABS (handled here because DashboardFactory routes Owner through this strategy) ──
 *   approvals     → <ApprovalsTab />     (owner sees 3 sub-tabs: Manager Approvals | PR Campaigns | Expense Approvals)
 *   emp_search    → <EmpSearchTab />     (owner can search any employee)
 *
 * Logic source: Dashboard.jsx lines 108–130 (state), 1140–1170 (loaders),
 *               1937–2449 (approvals render), 2450–2629 (emp_search render).
 *               Ported to Repository Pattern exactly as in ManagerDashboardStrategy.
 *
 * ── RBAC ─────────────────────────────────────────────────────────────────────
 *   PR Employee  (role='emp'):          pr_tools | overview | graphs
 *   PR Manager   (role='dep_manager'):  pr_tools | overview | graphs  (+ ManagerDashboardStrategy for approvals/emp_search)
 *   Owner                              approvals | emp_search | overview | graphs
 *
 * ── Props (from DashboardFactory) ─────────────────────────────────────────────
 *   dashboardData     {object|null}
 *   dashboardLoading  {boolean}
 *   dashboardError    {string|null}
 *   activeTab         {string}
 *   setActiveTab      {Function}
 *   [strategyProps]   forwarded to OverviewTab
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth }           from '../context/AuthContext';
import { useTranslation }    from '../hooks/useTranslation';
import managerRepository     from '../api/managerRepository';
import financeRepository     from '../api/financeRepository';
import prRepository          from '../api/prRepository';
import Icon, { IC }          from '../components/ui/Icon';
import OverviewTab           from '../components/common/OverviewTab';
import GraphsTab             from '../components/common/GraphsTab';
import PRToolsTab            from '../components/common/PRToolsTab';
import ApprovalsTab          from '../components/common/ApprovalsTab';
import EmpSearchTab          from '../components/common/EmpSearchTab';

export default function PRDashboardStrategy({
  dashboardData,
  dashboardLoading,
  dashboardError,
  activeTab,
  setActiveTab,
  ...strategyProps
}) {
  const { user, language, isOwner, isFinanceManager, aiEnabled } = useAuth();
  const tx = useTranslation(language);

  // ── Owner: Approvals state ─────────────────────────────────────────────────
  // Matches Dashboard.jsx lines 110–118 and ManagerDashboardStrategy.
  const [approvals,               setApprovals]               = useState([]);
  const [apprLoading,             setApprLoading]             = useState(false);
  const [approvalSubTab,          setApprovalSubTab]          = useState('approvals');
  const [ownerCampaigns,          setOwnerCampaigns]          = useState([]);
  const [ownerCampaignsLoading,   setOwnerCampaignsLoading]   = useState(false);
  const [approvalExpenses,        setApprovalExpenses]        = useState([]);
  const [approvalExpensesLoading, setApprovalExpensesLoading] = useState(false);

  // ── Owner: Employee Search state ───────────────────────────────────────────
  // Matches Dashboard.jsx lines 122–129 and ManagerDashboardStrategy.
  const [empSearchId,        setEmpSearchId]        = useState('');
  const [empSearchResult,    setEmpSearchResult]    = useState(null);
  const [empSearchAnalytics, setEmpSearchAnalytics] = useState(null);
  const [empSearchCharts,    setEmpSearchCharts]    = useState([]);
  const [empSearchLoading,   setEmpSearchLoading]   = useState(false);
  const [empSearchError,     setEmpSearchError]     = useState(null);

  // ── Card detail modal (emp_search drill-down) ──────────────────────────────
  const [selectedCard, setSelectedCard] = useState(null);

  // ── Owner: Loaders (Repository Pattern — same as ManagerDashboardStrategy) ─

  const loadApprovals = useCallback(async () => {
    if (!user || !isOwner) return;
    setApprLoading(true);
    try {
      const data = await managerRepository.getApprovals(user.id);
      setApprovals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[PRStrategy/Owner] loadApprovals:', err.message);
    } finally {
      setApprLoading(false);
    }
  }, [user, isOwner]);

  const loadOwnerCampaigns = useCallback(async () => {
    if (!isOwner) return;
    setOwnerCampaignsLoading(true);
    try {
      const data = await prRepository.getPendingCampaigns(user.id);
      setOwnerCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[PRStrategy/Owner] loadOwnerCampaigns:', err.message);
    } finally {
      setOwnerCampaignsLoading(false);
    }
  }, [user, isOwner]);

  const loadApprovalExpenses = useCallback(async () => {
    if (!isOwner) return;
    setApprovalExpensesLoading(true);
    try {
      const data = await financeRepository.getPendingExpenses(user.id);
      setApprovalExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[PRStrategy/Owner] loadApprovalExpenses:', err.message);
    } finally {
      setApprovalExpensesLoading(false);
    }
  }, [user, isOwner]);

  // Matches Dashboard.jsx useEffect at line 1163: load approvals when tab opens
  useEffect(() => {
    if (!isOwner) return;
    if (activeTab === 'approvals') {
      loadApprovals();
      loadOwnerCampaigns();
      loadApprovalExpenses();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Owner: Resolve handlers ────────────────────────────────────────────────

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

  // ── Owner: Employee Search ─────────────────────────────────────────────────

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

  // ── Card detail modal (same pattern as ManagerDashboardStrategy) ──────────

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

  // ── Owner: approvals tab ───────────────────────────────────────────────────
  // Matches Dashboard.jsx line 1937: {activeTab === 'approvals' && isManager && (...)}
  // isManager includes isOwner (Dashboard.jsx line 1336)
  if (isOwner && activeTab === 'approvals') {
    return (
      <>
        <CardModal />
        <ApprovalsTab
          language={language}
          isOwner={isOwner}
          isFinanceManager={isFinanceManager}

          approvals={approvals}
          apprLoading={apprLoading}
          onResolveApproval={handleResolveApproval}

          ownerCampaigns={ownerCampaigns}
          ownerCampaignsLoading={ownerCampaignsLoading}
          onResolveCampaign={handleResolveCampaign}

          approvalExpenses={approvalExpenses}
          approvalExpensesLoading={approvalExpensesLoading}
          onResolveExpense={handleResolveExpense}

          approvalSubTab={approvalSubTab}
          setApprovalSubTab={setApprovalSubTab}

          onRefresh={() => {
            loadApprovals();
            loadOwnerCampaigns();
            loadApprovalExpenses();
          }}
        />
      </>
    );
  }

  // ── Owner: emp_search tab ──────────────────────────────────────────────────
  // Matches Dashboard.jsx line 2450: {activeTab === 'emp_search' && isManager && (...)}
  if (isOwner && activeTab === 'emp_search') {
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
          onAskAI={null}
          language={language}
          departmentName={user?.department_name || ''}
        />
      </>
    );
  }

  // ── Shared analytics + PR-specific tabs ───────────────────────────────────

  return (
    <div>
      {/* ── Department-specific tab — hidden from Owner per Dashboard.jsx nav guard ── */}
      {activeTab === 'pr_tools' && (
        <PRToolsTab />
      )}

      {/* ── Shared analytics tabs ── */}
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
    </div>
  );
}
