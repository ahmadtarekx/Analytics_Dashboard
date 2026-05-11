/**
 * SalesToolsTab.jsx
 *
 * Renders the Sales department's tools panel.
 * Employees  → personal performance stats, top products, recent transactions.
 * Managers   → branch summary with period filter and per-rep breakdown.
 *
 * Props
 * ──────────────────────────────────────────────────────────────────────────
 * user              {object}   Current auth user (from AuthContext via parent strategy)
 * language          {string}   'ar' | 'en'
 * tx                {object}   Translation strings from useTranslation
 * salesStats        {object|null}  Personal performance data (employee view)
 * salesStatsLoading {boolean}
 * onLoadSalesStats  {function} Triggers personal stats fetch
 * branchSummary     {object|null}  Branch summary data (manager view)
 * branchSummaryLoading {boolean}
 * onLoadBranchSummary  {function}  Triggers branch summary fetch
 */

import { useState } from 'react';
import Icon, { IC }  from '../../components/ui/Icon';

// ── helpers ────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const v = Number(n);
  return v >= 1_000_000
    ? (v / 1_000_000).toFixed(2) + 'M'
    : v >= 1_000
    ? v.toLocaleString()
    : v.toFixed(2);
};

const SectionHead = ({ title }) => (
  <div style={{ marginBottom: 26 }}>
    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.4px' }}>{title}</h1>
    <div style={{ height: 3, width: 44, background: 'linear-gradient(90deg,var(--accent),var(--accent2))', borderRadius: 2, marginTop: 7 }} />
  </div>
);

// ── Status banner ──────────────────────────────────────────────────────────
const StatusBanner = ({ type, msg }) => (
  <div style={{
    padding: '11px 15px', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 14,
    display: 'flex', alignItems: 'flex-start', gap: 9,
    background: type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.08)',
    color: type === 'error' ? '#ef4444' : '#10b981',
    border: `1px solid ${type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)'}`,
  }}>
    <Icon d={type === 'error' ? IC.warn : IC.check} size={15} color={type === 'error' ? '#ef4444' : '#10b981'} style={{ flexShrink: 0, marginTop: 1 }} />
    {msg}
  </div>
);

// ── Employee personal stats sub-panel ──────────────────────────────────────
function EmployeeStatsPanel({ salesStats, salesStatsLoading, onLoadSalesStats, language }) {
  const [activeTab, setActiveTab] = useState('overview');
  const isAr = language === 'ar';

  if (salesStatsLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 0', color: 'var(--txt3)', fontSize: 14 }}>
        <span className="spinner" style={{ width: 18, height: 18 }} />
        {isAr ? 'جاري تحميل إحصائياتك...' : 'Loading your stats...'}
      </div>
    );
  }

  if (!salesStats) {
    return (
      <div style={{ textAlign: 'center', padding: '52px 24px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16 }}>
        <Icon d={IC.graphs} size={32} color="var(--border2)" style={{ margin: '0 auto 14px', display: 'block' }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt3)', marginBottom: 10 }}>
          {isAr ? 'لا توجد إحصائيات بعد' : 'No stats available yet'}
        </div>
        <button onClick={onLoadSalesStats} className="it-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 0 }}>
          <Icon d={IC.graphs} size={13} />{isAr ? 'تحميل الإحصائيات' : 'Load My Stats'}
        </button>
      </div>
    );
  }

  const metrics = [
    { label: isAr ? 'إجمالي المبيعات' : 'Total Revenue', value: `${fmt(salesStats.monthly_sales)} EGP`, color: '#10b981', icon: IC.money },
    { label: isAr ? 'عدد المعاملات' : 'Transactions', value: salesStats.num_transactions ?? '—', color: '#4f7cff', icon: IC.ticket },
    { label: isAr ? 'أكبر صفقة' : 'Biggest Deal', value: `${fmt(salesStats.biggest_sale)} EGP`, color: '#f59e0b', icon: IC.layers },
    { label: isAr ? 'متوسط الصفقة' : 'Avg Deal Size', value: `${fmt(salesStats.avg_sale)} EGP`, color: '#8b5cf6', icon: IC.chart },
  ];

  const TABS = [
    { id: 'overview', label: isAr ? 'نظرة عامة' : 'Overview', icon: IC.chart },
    { id: 'products', label: isAr ? 'أفضل المنتجات' : 'Top Products', icon: IC.pkg },
    { id: 'transactions', label: isAr ? 'المعاملات الأخيرة' : 'Recent Transactions', icon: IC.ticket },
  ];

  return (
    <div>
      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
        {metrics.map((m, i) => (
          <div key={i} className="it-stat-card" style={{ animationDelay: `${i * 0.06}s`, borderTop: `3px solid ${m.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: `${m.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon d={m.icon} size={12} color={m.color} />
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--txt3)' }}>{m.label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.5px' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 15px', borderRadius: 10, cursor: 'pointer',
            fontFamily: 'inherit', fontWeight: 700, fontSize: 13, transition: 'all .2s',
            background: activeTab === t.id ? 'rgba(79,124,255,0.12)' : 'transparent',
            border: `1.5px solid ${activeTab === t.id ? 'rgba(79,124,255,0.4)' : 'transparent'}`,
            color: activeTab === t.id ? 'var(--accent2)' : 'var(--txt3)',
          }}>
            <Icon d={t.icon} size={13} color={activeTab === t.id ? 'var(--accent2)' : 'var(--txt3)'} />{t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div>
          {salesStats.warnings?.length > 0 && (
            <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon d={IC.warn} size={12} color="#f59e0b" />{isAr ? 'تنبيهات' : 'Warnings'}
              </div>
              {salesStats.warnings.map((w, wi) => (
                <div key={wi} style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 4, paddingLeft: 8 }}>{w}</div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 13, color: 'var(--txt3)', padding: '32px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            {isAr ? 'انتقل إلى علامتَي التبويب أعلاه لعرض تفاصيل المنتجات والمعاملات.' : 'Navigate to the tabs above to see product and transaction details.'}
          </div>
        </div>
      )}

      {/* Top Products */}
      {activeTab === 'products' && (
        <div>
          {!salesStats.top_products?.length ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--txt3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              {isAr ? 'لا توجد بيانات منتجات.' : 'No product data available.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {salesStats.top_products.map((p, i) => {
                const rev = parseFloat(p.revenue_generated) || 0;
                const maxRev = Math.max(...salesStats.top_products.map(x => parseFloat(x.revenue_generated) || 0), 1);
                const pct = (rev / maxRev) * 100;
                const COLORS = ['#10b981', '#4f7cff', '#f59e0b', '#8b5cf6', '#ec4899'];
                const c = COLORS[i % COLORS.length];
                return (
                  <div key={i} className="ticket-card">
                    <div style={{ height: 3, background: `linear-gradient(90deg,${c},${c}44)` }} />
                    <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${c}18`, border: `1px solid ${c}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: c }}>{i + 1}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.product_name || p.product_id || `Product #${i + 1}`}
                        </div>
                        <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 3, transition: 'width .5s ease' }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: c }}>{fmt(rev)} EGP</div>
                        {p.units_sold && <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 2 }}>{p.units_sold} units</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Recent Transactions */}
      {activeTab === 'transactions' && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
          {!salesStats.recent_tx?.length ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--txt3)' }}>
              {isAr ? 'لا توجد معاملات حديثة.' : 'No recent transactions.'}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {Object.keys(salesStats.recent_tx[0]).map(k => (
                    <th key={k}>{k.replace(/_/g, ' ')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salesStats.recent_tx.map((row, ri) => (
                  <tr key={ri}>
                    {Object.values(row).map((v, ci) => (
                      <td key={ci} style={{ fontVariantNumeric: 'tabular-nums', textAlign: typeof v === 'number' ? 'right' : 'left' }}>
                        {typeof v === 'number' && v % 1 !== 0 ? v.toFixed(2) : String(v ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── Manager branch summary sub-panel ──────────────────────────────────────
const PERIOD_LABELS = {
  all:     { en: 'All Time',  ar: 'كل الأوقات' },
  monthly: { en: 'This Month', ar: 'هذا الشهر' },
  weekly:  { en: 'This Week',  ar: 'هذا الأسبوع' },
};

function ManagerSummaryPanel({ branchSummary, branchSummaryLoading, onLoadBranchSummary, language }) {
  const [period, setPeriod] = useState('all');
  const isAr = language === 'ar';

  if (branchSummaryLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 0', color: 'var(--txt3)', fontSize: 14 }}>
        <span className="spinner" style={{ width: 18, height: 18 }} />
        {isAr ? 'جاري تحميل ملخص الفرع...' : 'Loading branch summary...'}
      </div>
    );
  }

  if (!branchSummary) {
    return (
      <div style={{ textAlign: 'center', padding: '52px 24px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16 }}>
        <Icon d={IC.branch} size={32} color="var(--border2)" style={{ margin: '0 auto 14px', display: 'block' }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt3)', marginBottom: 10 }}>
          {isAr ? 'لا توجد بيانات ملخص' : 'No summary data available'}
        </div>
        <button onClick={() => onLoadBranchSummary(period)} className="it-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 0 }}>
          <Icon d={IC.branch} size={13} />{isAr ? 'تحميل ملخص الفرع' : 'Load Branch Summary'}
        </button>
      </div>
    );
  }

  const summaryMetrics = [
    { label: isAr ? 'إجمالي الإيرادات' : 'Total Revenue', value: `${fmt(branchSummary.total_revenue || branchSummary.revenue)} EGP`, color: '#10b981' },
    { label: isAr ? 'إجمالي المعاملات' : 'Total Transactions', value: branchSummary.total_transactions || branchSummary.num_transactions || '—', color: '#4f7cff' },
    { label: isAr ? 'متوسط الصفقة' : 'Avg Deal Size', value: `${fmt(branchSummary.avg_deal_size || branchSummary.avg_sale)} EGP`, color: '#f59e0b' },
    { label: isAr ? 'أعضاء الفريق' : 'Team Members', value: branchSummary.team_count || branchSummary.reps?.length || '—', color: '#8b5cf6' },
  ];

  return (
    <div>
      {/* Period switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(PERIOD_LABELS).map(([key, labels]) => (
          <button key={key} onClick={() => { setPeriod(key); onLoadBranchSummary(key); }} style={{
            padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12, transition: 'all .18s',
            background: period === key ? 'rgba(79,124,255,0.12)' : 'var(--surface)',
            border: `1.5px solid ${period === key ? 'rgba(79,124,255,0.4)' : 'var(--border)'}`,
            color: period === key ? 'var(--accent2)' : 'var(--txt2)',
          }}>
            {isAr ? labels.ar : labels.en}
          </button>
        ))}
      </div>

      {/* Metric grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
        {summaryMetrics.map((m, i) => (
          <div key={i} className="it-stat-card" style={{ borderTop: `3px solid ${m.color}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--txt3)', marginBottom: 8 }}>{m.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: m.color, letterSpacing: '-0.5px' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Per-rep breakdown */}
      {branchSummary.reps?.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>
            {isAr ? 'أداء الأعضاء' : 'Team Performance'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {branchSummary.reps.map((rep, i) => {
              const rev = parseFloat(rep.revenue || rep.total_revenue) || 0;
              const maxRev = Math.max(...branchSummary.reps.map(r => parseFloat(r.revenue || r.total_revenue) || 0), 1);
              const pct = (rev / maxRev) * 100;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(79,124,255,0.12)', border: '1px solid rgba(79,124,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent2)' }}>{i + 1}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 5 }}>
                      {rep.name || rep.emp_name || `Rep #${rep.emp_id}`}
                    </div>
                    <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width .5s ease' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>{fmt(rev)} EGP</div>
                    {rep.num_transactions && <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 2 }}>{rep.num_transactions} txns</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────
export default function SalesToolsTab({
  user,
  language,
  tx,
  salesStats,
  salesStatsLoading,
  onLoadSalesStats,
  branchSummary,
  branchSummaryLoading,
  onLoadBranchSummary,
}) {
  const isAr  = language === 'ar';
  const deptId = user?.department_id || user?.departement_id;
  const isManager = user?.role === 'dep_manager' || user?.role === 'sales_manager';
  const isSalesManager = user?.role === 'sales_manager';

  const [salesActiveTab, setSalesActiveTab] = useState(isManager ? 'summary' : 'stats');

  const TABS = isManager
    ? [
        { id: 'summary',  label: isAr ? 'ملخص الفرع'      : 'Branch Summary',  icon: IC.branch },
        { id: 'stats',    label: isAr ? 'إحصائياتي'        : 'My Stats',        icon: IC.graphs },
      ]
    : [
        { id: 'stats',    label: isAr ? 'إحصائياتي'        : 'My Performance',  icon: IC.graphs },
      ];

  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      <SectionHead title={isSalesManager ? (tx.salesCommand || 'Sales Command Center') : (tx.mySales || 'My Sales')} />
      <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: -18, marginBottom: 24 }}>
        {isManager
          ? (isAr ? 'ملخص أداء الفرع وأعضاء الفريق.' : 'Branch performance summary and team member breakdown.')
          : (isAr ? 'تابع أداءك ومبيعاتك الشخصية.' : 'Track your personal performance and sales metrics.')}
      </div>

      {/* Tab switcher (only for managers who also see their own stats) */}
      {isManager && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setSalesActiveTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 700, fontSize: 13, transition: 'all .2s',
              background: salesActiveTab === t.id ? 'rgba(79,124,255,0.12)' : 'transparent',
              border: `1.5px solid ${salesActiveTab === t.id ? 'rgba(79,124,255,0.4)' : 'transparent'}`,
              color: salesActiveTab === t.id ? 'var(--accent2)' : 'var(--txt3)',
            }}>
              <Icon d={t.icon} size={13} color={salesActiveTab === t.id ? 'var(--accent2)' : 'var(--txt3)'} />{t.label}
            </button>
          ))}
        </div>
      )}

      {salesActiveTab === 'summary' && isManager && (
        <ManagerSummaryPanel
          branchSummary={branchSummary}
          branchSummaryLoading={branchSummaryLoading}
          onLoadBranchSummary={onLoadBranchSummary}
          language={language}
        />
      )}

      {salesActiveTab === 'stats' && (
        <EmployeeStatsPanel
          salesStats={salesStats}
          salesStatsLoading={salesStatsLoading}
          onLoadSalesStats={onLoadSalesStats}
          language={language}
        />
      )}
    </div>
  );
}
