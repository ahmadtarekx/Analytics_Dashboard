/**
 * GraphsTab.jsx — Charts Dashboard Tab (Strategy Pattern)
 *
 * MIGRATION: Extracted from Dashboard.jsx (~line 6560–6660) and fully ported
 * away from the legacy useDashboard / DashboardContext approach.
 *
 * Now accepts clean props injected by each Strategy component, matching the
 * same prop interface established by OverviewTab.jsx.
 *
 * ── Props ────────────────────────────────────────────────────────────────────
 *   dashboardData     {object|null}  — merged analytics payload from Strategy
 *   dashboardLoading  {boolean}
 *
 * Auth context (language, aiEnabled) is read directly from useAuth()
 * so this component stays zero-config for every Strategy that imports it.
 *
 * Used by:
 *   FinanceDashboardStrategy, HRDashboardStrategy, PRDashboardStrategy,
 *   InventoryDashboardStrategy, ManagerDashboardStrategy
 */

import { useState } from 'react';
import { useAuth }        from '../../context/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import PlotlyChart        from '../charts/PlotlyChart';
import Icon, { IC }       from '../ui/Icon';
import { ACCENTS }        from '../charts/chartUtils';

// ── Component ─────────────────────────────────────────────────────────────────

export default function GraphsTab({ dashboardData = null, dashboardLoading = false }) {
  const { language, aiEnabled } = useAuth();
  const tx = useTranslation(language);

  const [selectedChart, setSelectedChart] = useState(null);

  // Derive chart list from dashboardData
  const charts = dashboardData
    ? Object.entries(dashboardData)
        .filter(([, v]) => v?.chart?.data?.length > 0)
        .map(([key, v]) => ({ key, figure: v.chart }))
    : [];

  // ── Chart expand modal ────────────────────────────────────────────────────
  const ChartModal = () => {
    if (!selectedChart) return null;
    const { title, figure, accent, dataEntries = [] } = selectedChart;
    return (
      <div className="chart-modal-overlay" onClick={() => setSelectedChart(null)}>
        <div className="chart-modal" onClick={e => e.stopPropagation()}>
          <div className="chart-modal-head" style={{ borderLeft: `4px solid ${accent}` }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}20`, border: `1px solid ${accent}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon d={IC.graphs} size={16} color={accent} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 2 }}>
                {language === 'ar' ? 'تقرير بياني' : 'Chart Report'}
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                {title}
              </div>
            </div>
            <button className="close-btn" onClick={() => setSelectedChart(null)}>
              <Icon d={IC.close} size={18} />
            </button>
          </div>
          <div className="chart-modal-body scroll-area">
            <div style={{ padding: '8px 16px 0' }}>
              <PlotlyChart figure={figure} height={420} language={language} />
            </div>
            {dataEntries.length > 0 && (
              <div style={{ padding: '0 24px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 12px' }}>
                  <Icon d={IC.table} size={14} color="var(--accent2)" />
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--txt)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    {tx.detailsTable || 'Details'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 600 }}>({dataEntries.length} rows)</span>
                </div>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <table className="data-table">
                    <thead>
                      <tr>{Object.keys(dataEntries[0]).map(k => <th key={k}>{k.replace(/_/g, ' ')}</th>)}</tr>
                    </thead>
                    <tbody>
                      {dataEntries.map((row, ri) => (
                        <tr key={ri}>
                          {Object.entries(row).map(([k, v], ci) => {
                            const isNum = typeof v === 'number';
                            return (
                              <td key={ci} style={{ textAlign: isNum ? 'right' : 'left', fontWeight: isNum ? 700 : 400, color: isNum ? 'var(--accent2)' : 'var(--txt)' }}>
                                {isNum && v % 1 !== 0 ? v.toFixed(2) : String(v ?? '—')}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (dashboardLoading) {
    return (
      <div style={{ animation: 'fadeUp 0.3s ease' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(500px,1fr))', gap: 20 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 320, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <>
      <ChartModal />

      <div style={{ animation: 'fadeUp 0.3s ease' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--txt3)', marginBottom: 6 }}>
              {language === 'ar' ? 'التقارير البيانية' : 'Visual Reports'}
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.5px', margin: 0 }}>
              {tx.graphsTitle || 'Analytics Charts'}
            </h1>
          </div>
          {charts.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 999 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
              {charts.length} {language === 'ar' ? 'رسم بياني' : 'charts'}
            </div>
          )}
        </div>

        {/* Chart grid */}
        {charts.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(500px,1fr))', gap: 20 }}>
            {charts.map(({ key, figure }, i) => {
              const accent   = ACCENTS[i % ACCENTS.length];
              const title    = figure?.layout?.title?.text || key.replace(/get_|branch_|global_|finance_/g, '').replace(/_/g, ' ');
              const dataRows = dashboardData?.[key]?.data || [];

              return (
                <div key={key} className="graph-card" style={{ animationDelay: `${i * 0.06}s`, borderTop: `3px solid ${accent}` }}>

                  {/* Card header */}
                  <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--txt3)', marginBottom: 3 }}>
                        {tx.chart || 'Chart'} {i + 1}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {title}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, marginLeft: 10 }}>

                      <button
                        onClick={() => setSelectedChart({ key, title, figure, accent, dataEntries: dataRows })}
                        className="graph-expand-hint"
                      >
                        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                        </svg>
                        <span>{language === 'ar' ? 'توسيع' : 'Expand'}</span>
                      </button>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}80`, flexShrink: 0 }} />
                    </div>
                  </div>

                  {/* Row count + numeric summary badges */}
                  {dataRows.length > 0 && (
                    <div style={{ padding: '0 20px 6px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px' }}>
                        {dataRows.length} {language === 'ar' ? 'سجل' : 'rows'}
                      </span>
                      {Object.keys(dataRows[0] || {})
                        .filter(k => typeof dataRows[0][k] === 'number' && !['branch_id', 'departement_id', 'emp_id', 'product_id'].includes(k))
                        .slice(0, 2)
                        .map(col => {
                          const total = dataRows.map(r => r[col]).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0);
                          const fmt   = v => v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + 'M' : v >= 1_000 ? v.toLocaleString() : Number.isInteger(v) ? String(v) : v.toFixed(1);
                          return (
                            <span key={col} style={{ fontSize: 10, fontWeight: 700, color: accent, background: `${accent}12`, border: `1px solid ${accent}30`, borderRadius: 6, padding: '2px 8px', textTransform: 'capitalize' }}>
                              {col.replace(/_/g, ' ')}: {fmt(total)}
                            </span>
                          );
                        })}
                    </div>
                  )}

                  {/* Chart */}
                  <PlotlyChart figure={figure} height={280} language={language} />
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {charts.length === 0 && !dashboardLoading && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--txt3)' }}>
            <Icon d={IC.graphs} size={44} color="var(--border2)" style={{ margin: '0 auto 16px', display: 'block' }} />
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              {tx.noGraphs || 'No charts available for your dashboard.'}
            </div>
          </div>
        )}
      </div>
    </>
  );
}