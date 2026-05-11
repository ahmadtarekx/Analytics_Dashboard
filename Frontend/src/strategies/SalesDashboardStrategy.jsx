/**
 * SalesDashboardStrategy.jsx — Strategy Pattern
 *
 * Migrated from Dashboard.jsx ~line 4407–4897.
 * Renders: Sales Tools tab (My Stats / Leaderboard / Branch Overview)
 *
 * Role matrix (derived from user.role):
 *   dep_manager / sales_manager → branch summary + leaderboard  (+ manager tabs)
 *   leader                      → my stats + team leaderboard
 *   emp                         → my stats only
 *
 * Tabs:
 *   approvals  → <ManagerDashboardStrategy />  (Sales Manager — sidebar hides
 *                this for isSalesManager per Dashboard.jsx line 1764, but
 *                we guard defensively in case that changes)
 *   emp_search → <ManagerDashboardStrategy />  (Sales Manager)
 *   sales_tools → branch / personal stats (this strategy)
 *   overview    → shared OverviewTab
 *   graphs      → shared GraphsTab
 *
 * FIX 1 (2026-05-11 first pass): Added delegation guard for manager tabs.
 * FIX 2 (2026-05-11 second pass): Moved ALL hooks to the top of the component
 *   BEFORE any conditional returns, satisfying the Rules of Hooks. Previously
 *   the useState/useEffect/useCallback calls were placed after early-return
 *   guards, which caused React to crash with a white screen whenever activeTab
 *   changed between 'emp_search' and 'sales_tools' (different hook call order
 *   per render).
 *
 * All fetch calls replaced with salesRepository.* (Repository Pattern).
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth }              from '../context/AuthContext';
import { useTranslation }       from '../hooks/useTranslation';
import salesRepository          from '../api/salesRepository';
import Icon, { IC }             from '../components/ui/Icon';
import OverviewTab              from '../components/common/OverviewTab';
import GraphsTab                from '../components/common/GraphsTab';
import ManagerDashboardStrategy from './ManagerDashboardStrategy';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtEGP  = v => Number(v || 0).toLocaleString('en-US') + ' EGP';
const fmtDate = s => {
  try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return s; }
};

const SectionHead = ({ title }) => (
  <div style={{ marginBottom: 26 }}>
    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.4px' }}>{title}</h1>
    <div style={{ height: 3, width: 44, background: 'linear-gradient(90deg,var(--accent),var(--accent2))', borderRadius: 2, marginTop: 7 }} />
  </div>
);

// Manager-only tabs to delegate upward.
const MANAGER_TABS = new Set(['approvals', 'emp_search']);

const medals = ['🥇', '🥈', '🥉'];

export default function SalesDashboardStrategy({
  activeTab,
  dashboardData = null,
  dashboardLoading = false,
  dashboardError,
  setActiveTab,
  ...strategyProps
}) {
  const { user, language } = useAuth();
  const tx = useTranslation(language);

  const isSalesManager = user?.role === 'dep_manager' || user?.role === 'sales_manager';
  const isSalesLeader  = user?.role === 'leader';
  const isOwner        = user?.id === 91949;
  const isManager      = isSalesManager || isOwner;

  // ── ALL HOOKS MUST BE AT THE TOP — before any conditional return ──────────
  // Violating this rule causes React to crash when activeTab changes and the
  // component exits early on some renders but not others (white screen of death).

  const [salesActiveTab,       setSalesActiveTab]       = useState(isSalesManager ? 'summary' : 'stats');
  const [salesStats,           setSalesStats]           = useState(null);
  const [salesStatsLoading,    setSalesStatsLoading]    = useState(false);
  const [leaderboard,          setLeaderboard]          = useState([]);
  const [leaderboardLoading,   setLeaderboardLoading]   = useState(false);
  const [leaderboardPeriod,    setLeaderboardPeriod]    = useState('month');
  const [branchSummary,        setBranchSummary]        = useState(null);
  const [branchSummaryLoading, setBranchSummaryLoading] = useState(false);
  const [branchSummaryPeriod,  setBranchSummaryPeriod]  = useState('month');

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadSalesStats = useCallback(async () => {
    if (!user) return;
    setSalesStatsLoading(true);
    try {
      const d = await salesRepository.getMyFullStats(user.id);
      const revenue  = d.get_my_total_sales_revenue?.data?.[0] || {};
      const monthly  = d.get_my_monthly_revenue?.data?.[0]     || {};
      const units    = d.get_my_total_units_sold?.data?.[0]    || {};
      const avgDeal  = d.get_my_average_deal_size?.data?.[0]   || {};
      const topProds = d.get_my_top_products?.data             || [];
      const recentTx = d.get_my_recent_transactions?.data      || [];
      const warnings = [
        ...(d.get_my_total_sales_revenue?.warnings || []),
        ...(d.get_my_top_products?.warnings        || []),
      ];
      setSalesStats({
        monthly_sales:     parseFloat(revenue.my_total_revenue)  || 0,
        monthly_revenue:   parseFloat(monthly.my_monthly_revenue) || 0,
        monthly_txns:      parseInt(monthly.monthly_transactions)  || 0,
        num_transactions:  parseInt(units.my_total_units)          || 0,
        avg_sale:          parseFloat(avgDeal.my_avg_deal_size)    || 0,
        commission_target: (parseFloat(revenue.my_total_revenue) || 0) * 0.01,
        commission_earned: (parseFloat(revenue.my_total_revenue) || 0) > 0,
        top_products: topProds, recent_tx: recentTx, warnings, is_full: true,
      });
    } catch {
      try {
        const d2 = await salesRepository.getMyStats(user.id);
        setSalesStats({ ...d2, is_full: false });
      } catch { setSalesStats(null); }
    } finally { setSalesStatsLoading(false); }
  }, [user]);

  const loadLeaderboard = useCallback(async (period = leaderboardPeriod) => {
    if (!user) return;
    setLeaderboardLoading(true);
    try {
      const d = await salesRepository.getLeaderboard({
        branch_id: user.branch_id, leader_id: user.id, period,
      });
      const filtered = Array.isArray(d)
        ? d.filter(e => !(e.emp_id === user.id && isSalesManager))
        : [];
      setLeaderboard(filtered);
    } catch { /* silent */ } finally { setLeaderboardLoading(false); }
  }, [user, leaderboardPeriod, isSalesManager]);

  const loadBranchSummary = useCallback(async (period = 'month') => {
    if (!user) return;
    setBranchSummaryLoading(true);
    try {
      const d = await salesRepository.getBranchSummary({ branch_id: user.branch_id, period });
      setBranchSummary(d && !d.error ? d : null);
    } catch { setBranchSummary(null); }
    finally { setBranchSummaryLoading(false); }
  }, [user]);

  // This effect must also be unconditional — it guards itself with an activeTab check.
  useEffect(() => {
    if (activeTab !== 'sales_tools') return;
    if (isSalesManager) { loadBranchSummary(branchSummaryPeriod); }
    else                { loadSalesStats();    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CONDITIONAL RETURNS — only after all hooks have been declared ──────────

  // Manager-tab delegation: Sales Manager / Owner → ManagerDashboardStrategy.
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

  // Shared analytics tabs.
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

  // Unknown tab — nothing to render.
  if (activeTab !== 'sales_tools') return null;

  // ── Sales Tools tab UI ────────────────────────────────────────────────────

  const TABS = isSalesManager
    ? [{ id: 'summary',     label: 'Branch Overview', icon: IC.chart  },
       { id: 'leaderboard', label: 'Leaderboard',     icon: IC.graphs }]
    : isSalesLeader
      ? [{ id: 'stats',       label: 'My Stats',    icon: IC.chart  },
         { id: 'leaderboard', label: 'Team Board',  icon: IC.graphs }]
      : [{ id: 'stats', label: 'My Stats', icon: IC.chart }];

  return (
    <div style={{ animation: 'fadeUp 0.3s ease', paddingBottom: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <SectionHead
          title={isSalesManager ? tx.salesCommandCenter : isSalesLeader ? tx.mySalesPerf : tx.mySales}
        />
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: -18 }}>
          {isSalesManager
            ? 'Branch sales overview and leaderboard.'
            : 'Track your personal sales performance.'}
        </div>
      </div>

      {/* Sub-tab nav */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => {
              setSalesActiveTab(t.id);
              if (t.id === 'stats'       && !salesStats)        loadSalesStats();
              if (t.id === 'leaderboard' && !leaderboard.length) loadLeaderboard();
              if (t.id === 'summary')                            loadBranchSummary(branchSummaryPeriod);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10,
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, transition: 'all .2s',
              background: salesActiveTab === t.id ? 'rgba(79,124,255,0.12)' : 'transparent',
              border:     `1.5px solid ${salesActiveTab === t.id ? 'rgba(79,124,255,0.4)' : 'transparent'}`,
              color:      salesActiveTab === t.id ? 'var(--accent2)' : 'var(--txt3)',
            }}>
            <Icon d={t.icon} size={13} color={salesActiveTab === t.id ? 'var(--accent2)' : 'var(--txt3)'} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MY STATS ── */}
      {salesActiveTab === 'stats' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--txt3)' }}>
              {salesStats?.is_full ? 'All-time performance · Python analytics' : 'Monthly snapshot'}
            </div>
            <button onClick={loadSalesStats}
              style={{ padding: '7px 16px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
              {salesStatsLoading ? <span className="spinner" style={{ width: 11, height: 11 }} /> : '↻'} Refresh
            </button>
          </div>

          {salesStatsLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 14 }} />)}
            </div>
          )}

          {!salesStatsLoading && !salesStats && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--txt3)' }}>
              <Icon d={IC.chart} size={38} color="var(--border2)" style={{ margin: '0 auto 14px', display: 'block' }} />
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>No sales data found.</div>
              <button onClick={loadSalesStats} className="it-btn" style={{ marginTop: 8 }}>Retry</button>
            </div>
          )}

          {!salesStatsLoading && salesStats && (() => {
            const totalRev = salesStats.monthly_sales || 0;
            const commPct  = totalRev > 0 ? Math.min((totalRev / 50000) * 100, 100) : 0;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {salesStats.warnings?.length > 0 && (
                  <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {salesStats.warnings.map((w, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#f87171', display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Icon d={IC.warn} size={12} color="#f87171" />{w.replace('WARNING: ', '')}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ padding: '22px 24px', borderRadius: 16, background: 'linear-gradient(135deg,rgba(79,124,255,0.12),rgba(124,163,255,0.06))', border: '1px solid rgba(79,124,255,0.3)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(79,124,255,0.07)' }} />
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#7ca3ff', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                      {salesStats.is_full ? '💰 All-Time Revenue' : '📅 Monthly Revenue'}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--txt)', letterSpacing: '-1px', marginBottom: 6 }}>{fmtEGP(totalRev)}</div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{salesStats.num_transactions?.toLocaleString() || 0} units sold total</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'This Month', value: fmtEGP(salesStats.monthly_revenue || 0), sub: `${salesStats.monthly_txns || 0} transactions`, color: '#10b981', icon: IC.calendar },
                      { label: 'Avg Deal',   value: fmtEGP(salesStats.avg_sale),              sub: 'per transaction',                                color: '#f59e0b', icon: IC.graphs  },
                    ].map((m, i) => (
                      <div key={i} style={{ flex: 1, padding: '14px 18px', borderRadius: 13, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${m.color}12`, border: `1px solid ${m.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon d={m.icon} size={16} color={m.color} />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>{m.label}</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{m.value}</div>
                          <div style={{ fontSize: 10, color: 'var(--txt3)' }}>{m.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '18px 22px', borderRadius: 14, background: salesStats.commission_earned ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.05)', border: `1px solid ${salesStats.commission_earned ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.18)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: salesStats.commission_earned ? '#10b981' : '#ef4444' }}>
                        {salesStats.commission_earned ? '✅ Commission Eligible' : '❌ No Sales Recorded'}
                      </div>
                      {salesStats.commission_earned && (
                        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 3 }}>
                          Estimated <strong style={{ color: '#10b981' }}>{fmtEGP(salesStats.commission_target)}</strong> (1% of all-time revenue) · subject to HR approval
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: salesStats.commission_earned ? '#10b981' : 'var(--txt3)' }}>{Math.round(commPct)}%</div>
                  </div>
                  <div style={{ height: 8, borderRadius: 6, background: 'var(--surface2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${commPct}%`, borderRadius: 6, background: salesStats.commission_earned ? 'linear-gradient(90deg,#10b981,#34d399)' : '#ef4444', transition: 'width 0.8s ease' }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 5 }}>Progress toward 50,000 EGP milestone</div>
                </div>

                {salesStats.is_full && salesStats.top_products?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.8px' }}>⭐ My Top Products</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {salesStats.top_products.map((p, i) => {
                        const maxRev = parseFloat(salesStats.top_products[0]?.revenue_generated) || 1;
                        const pct    = Math.round((parseFloat(p.revenue_generated) / maxRev) * 100);
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: i < 3 ? 18 : 13, fontWeight: 800, color: '#f59e0b', width: 28, textAlign: 'center', flexShrink: 0 }}>{i < 3 ? medals[i] : `#${i + 1}`}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                <div>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{p.name}</span>
                                  {p.model && <span style={{ fontSize: 11, color: 'var(--txt3)', marginLeft: 6 }}>{p.model}</span>}
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent2)' }}>{Number(p.revenue_generated || 0).toLocaleString()} EGP</div>
                                  <div style={{ fontSize: 10, color: '#10b981' }}>{Number(p.units_sold || 0).toLocaleString()} units</div>
                                </div>
                              </div>
                              <div style={{ height: 4, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: 'linear-gradient(90deg,var(--accent),var(--accent2))', transition: 'width 0.7s ease' }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {salesStats.is_full && salesStats.recent_tx?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.8px' }}>🕒 Recent Transactions</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--border)', borderRadius: 13, overflow: 'hidden' }}>
                      {salesStats.recent_tx.map((t, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', borderBottom: i < salesStats.recent_tx.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4f7cff', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.product_name || '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{fmtDate(t.transaction_date)}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent2)' }}>{Number(t.price || 0).toLocaleString()} EGP</div>
                            <div style={{ fontSize: 10, color: '#10b981' }}>×{t.amount || 0}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── BRANCH SUMMARY (Manager) ── */}
      {salesActiveTab === 'summary' && isSalesManager && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ id: 'month', label: 'This Month' }, { id: 'year', label: 'This Year' }, { id: 'all', label: 'All Time' }].map(p => (
                <button key={p.id}
                  onClick={() => { setBranchSummaryPeriod(p.id); setBranchSummary(null); loadBranchSummary(p.id); }}
                  style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12, transition: 'all .18s', background: branchSummaryPeriod === p.id ? 'rgba(79,124,255,0.15)' : 'var(--surface2)', border: `1.5px solid ${branchSummaryPeriod === p.id ? 'rgba(79,124,255,0.5)' : 'var(--border)'}`, color: branchSummaryPeriod === p.id ? 'var(--accent2)' : 'var(--txt3)' }}>
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={() => loadBranchSummary(branchSummaryPeriod)}
              style={{ padding: '7px 16px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
              {branchSummaryLoading ? <span className="spinner" style={{ width: 11, height: 11 }} /> : '↻'} Refresh
            </button>
          </div>

          {branchSummaryLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--txt3)', fontSize: 13 }}>
              <span className="spinner" style={{ width: 15, height: 15 }} /> Loading...
            </div>
          )}

          {branchSummary && (
            <div>
              {branchSummary.period_label && (
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>
                  Showing data for: <span style={{ color: 'var(--accent2)' }}>{branchSummary.period_label}</span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, marginBottom: 20 }}>
                {[
                  { label: 'Total Branch Sales', value: fmtEGP(branchSummary.total_sales),     accent: '#5b8fff', icon: IC.money  },
                  { label: 'Active Sellers',      value: branchSummary.active_sellers,          accent: '#10b981', icon: IC.user   },
                  { label: 'Total Transactions',  value: branchSummary.total_transactions,      accent: '#8b5cf6', icon: IC.check  },
                  { label: 'Avg Transaction',     value: fmtEGP(branchSummary.avg_transaction), accent: '#f59e0b', icon: IC.chart  },
                ].map((m, i) => (
                  <div key={i} className="metric-card" style={{ borderTop: `3px solid ${m.accent}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${m.accent}18`, border: `1px solid ${m.accent}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon d={m.icon} size={13} color={m.accent} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{m.label}</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.5px' }}>{m.value}</div>
                  </div>
                ))}
              </div>
              {branchSummary.best_day && (
                <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 13, color: 'var(--txt2)' }}>
                  🏆 Best sales day: <strong style={{ color: '#10b981' }}>{branchSummary.best_day.date}</strong> — {fmtEGP(branchSummary.best_day.daily_total)}
                </div>
              )}
            </div>
          )}

          {!branchSummaryLoading && !branchSummary && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--txt3)' }}>
              <Icon d={IC.chart} size={38} color="var(--border2)" style={{ margin: '0 auto 14px', display: 'block' }} />
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>No branch data found.</div>
              <button onClick={() => loadBranchSummary(branchSummaryPeriod)} className="it-btn" style={{ marginTop: 8 }}>Retry</button>
            </div>
          )}
        </div>
      )}

      {/* ── LEADERBOARD ── */}
      {salesActiveTab === 'leaderboard' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ id: 'month', label: 'This Month' }, { id: 'year', label: 'This Year' }, { id: 'all', label: 'All Time' }].map(p => (
                <button key={p.id}
                  onClick={() => { setLeaderboardPeriod(p.id); setLeaderboard([]); loadLeaderboard(p.id); }}
                  style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12, transition: 'all .18s', background: leaderboardPeriod === p.id ? 'rgba(79,124,255,0.15)' : 'var(--surface2)', border: `1.5px solid ${leaderboardPeriod === p.id ? 'rgba(79,124,255,0.5)' : 'var(--border)'}`, color: leaderboardPeriod === p.id ? 'var(--accent2)' : 'var(--txt3)' }}>
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={() => loadLeaderboard()}
              style={{ padding: '7px 16px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
              {leaderboardLoading ? <span className="spinner" style={{ width: 11, height: 11 }} /> : '↻'} Refresh
            </button>
          </div>

          {leaderboardLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--txt3)', fontSize: 13 }}>
              <span className="spinner" style={{ width: 15, height: 15 }} /> Loading leaderboard...
            </div>
          )}

          {!leaderboardLoading && leaderboard.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--txt3)' }}>
              <Icon d={IC.graphs} size={38} color="var(--border2)" style={{ margin: '0 auto 14px', display: 'block' }} />
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>No sales data for this period.</div>
              <button onClick={() => loadLeaderboard()} className="it-btn" style={{ marginTop: 8 }}>Retry</button>
            </div>
          )}

          {leaderboard.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {leaderboard.map((emp, rank) => {
                const isMe      = emp.emp_id === user.id;
                const salesVal  = emp.monthly_sales ?? emp.total_sales ?? 0;
                const txns      = emp.num_transactions ?? emp.deals_closed ?? 0;
                const maxSales  = leaderboard[0] ? (leaderboard[0].monthly_sales ?? leaderboard[0].total_sales ?? 1) : 1;
                const pct       = maxSales > 0 ? Math.round((salesVal / maxSales) * 100) : 0;
                const rankColor = rank === 0 ? '#f59e0b' : rank === 1 ? '#94a3b8' : rank === 2 ? '#b45309' : 'var(--txt3)';
                return (
                  <div key={emp.emp_id}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 13, background: isMe ? 'rgba(79,124,255,0.07)' : 'var(--surface)', border: `1px solid ${isMe ? 'rgba(79,124,255,0.3)' : 'var(--border)'}`, transition: 'all .2s' }}>
                    <div style={{ width: 32, textAlign: 'center', fontSize: rank < 3 ? 20 : 14, fontWeight: 800, color: rankColor, flexShrink: 0 }}>
                      {rank < 3 ? medals[rank] : `#${rank + 1}`}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)' }}>{emp.full_name}</span>
                        {isMe && <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(79,124,255,0.15)', color: 'var(--accent2)', border: '1px solid rgba(79,124,255,0.3)', padding: '1px 8px', borderRadius: 999 }}>YOU</span>}
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: 'linear-gradient(90deg,var(--accent),var(--accent2))', transition: 'width .6s ease' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent2)' }}>{fmtEGP(salesVal)}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{txns} txns</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}