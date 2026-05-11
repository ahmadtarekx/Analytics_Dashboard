/**
 * EmpSearchTab.jsx — Tab Component (Strategy Pattern)
 *
 * Extracted from ManagerDashboardStrategy.jsx / old Dashboard.jsx (~line 2450–2629).
 *
 * Renders the Employee Search view for all Manager and Owner roles:
 *   - ID search input with Enter-key support
 *   - Employee profile card with all key fields
 *   - Department-scoped analytics metric cards (clickable → drill-down modal)
 *   - Department-scoped charts with optional AI panel trigger
 *
 * Props (all injected by ManagerDashboardStrategy — no context reads):
 *   empSearchId        {string}
 *   setEmpSearchId     {Function}
 *   empSearchResult    {object|null}   — employee profile record
 *   empSearchAnalytics {object|null}   — analytics map from manager lens
 *   empSearchCharts    {Array}         — [{key, figure}]
 *   empSearchLoading   {boolean}
 *   empSearchError     {string|null}
 *   onSearch           {Function}      — triggers the search
 *   onClear            {Function}      — clears result + resets inputs
 *   onSelectCard       {Function(card)} — opens drill-down modal
 *   aiEnabled          {boolean}
 *   onAskAI            {Function(title, data)}
 *   language           {string}
 *   departmentName     {string}        — user.department_name for chart labels
 */

import PlotlyChart from '../../components/charts/PlotlyChart';
import Icon, { IC }  from '../../components/ui/Icon';
import { ACCENTS }   from '../../components/charts/chartUtils';

// ── Component ─────────────────────────────────────────────────────────────────

const SectionHead = ({ title }) => (
  <div style={{ marginBottom: 26 }}>
    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.4px' }}>{title}</h1>
    <div style={{ height: 3, width: 44, background: 'linear-gradient(90deg,var(--accent),var(--accent2))', borderRadius: 2, marginTop: 7 }} />
  </div>
);

export default function EmpSearchTab({
  empSearchId        = '',
  setEmpSearchId,
  empSearchResult    = null,
  empSearchAnalytics = null,
  empSearchCharts    = [],
  empSearchLoading   = false,
  empSearchError     = null,
  onSearch,
  onClear,
  onSelectCard,
  aiEnabled          = false,
  onAskAI,
  language           = 'en',
  departmentName     = '',
}) {
  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      <SectionHead title={language === 'ar' ? 'بحث الموظفين' : 'Employee Search'} />

      {/* ── Search bar ────────────────────────────────────────────────────── */}
      <div className="ticket-card" style={{ marginBottom: 24 }}>
        <div style={{ height: 4, background: 'linear-gradient(90deg,var(--accent),var(--accent2))' }} />
        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon d={IC.user} size={14} color="var(--accent2)" /> Search Employee by ID
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="number"
              value={empSearchId}
              onChange={e => setEmpSearchId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSearch()}
              className="it-input"
              placeholder="Enter Employee ID..."
              style={{ maxWidth: 260, margin: 0 }}
            />
            <button
              onClick={onSearch}
              disabled={empSearchLoading || !empSearchId}
              className="it-btn"
              style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}
            >
              {empSearchLoading
                ? <><span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,.3)', borderTopColor: '#fff' }} />Searching...</>
                : <><Icon d={IC.user} size={13} />{language === 'ar' ? 'بحث' : 'Search'}</>}
            </button>
            {empSearchResult && (
              <button
                onClick={onClear}
                style={{ padding: '11px 16px', borderRadius: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Clear
              </button>
            )}
          </div>
          {empSearchError && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              <Icon d={IC.warn} size={14} />{empSearchError}
            </div>
          )}
        </div>
      </div>

      {/* ── Employee profile card ────────────────────────────────────────── */}
      {empSearchResult && (() => {
        const e = empSearchResult;
        const roleColor = e.role === 'dep_manager' ? '#fbbf24' : e.role === 'leader' ? '#a78bfa' : '#34d399';
        const roleLabel = e.role === 'dep_manager' ? 'Manager' : e.role === 'leader' ? 'Team Leader' : 'Employee';
        const fields = [
          { icon: IC.user,    label: 'Full Name',       value: e.full_name },
          { icon: IC.mail,    label: 'Email',           value: e.email },
          { icon: IC.phone,   label: 'Phone',           value: e.phone || 'N/A' },
          { icon: IC.address, label: 'Address',         value: e.address || 'N/A' },
          { icon: IC.gender,  label: 'Gender',          value: e.gender === 'M' || e.gender === 'Male' ? 'Male' : e.gender === 'F' || e.gender === 'Female' ? 'Female' : e.gender || 'N/A' },
          { icon: IC.branch,  label: 'Primary Branch',  value: `${e.primary_branch || 'N/A'} (ID: ${e.branch_id || '—'})` },
          { icon: IC.branch,  label: 'Department',      value: e.department_name || 'N/A' },
          { icon: IC.layers,  label: 'Role',            value: roleLabel },
        ];
        return (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(79,124,255,0.15)', border: '1px solid rgba(79,124,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon d={IC.user} size={20} color="var(--accent2)" />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--txt)' }}>{e.full_name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)' }}>ID: {e.id}</span>
                  <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: `${roleColor}18`, color: roleColor, border: `1px solid ${roleColor}30` }}>{roleLabel}</span>
                  <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(79,124,255,0.1)', color: 'var(--accent2)', border: '1px solid rgba(79,124,255,0.2)' }}>{e.department_name}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
              {fields.map(({ icon, label, value }, i) => {
                const c = ACCENTS[i % ACCENTS.length];
                return (
                  <div key={i} className="profile-card" style={{ animationDelay: `${i * 0.03}s`, borderTop: `3px solid ${c}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${c}18`, border: `1px solid ${c}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon d={icon} size={13} color={c} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--txt2)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)', lineHeight: 1.4, wordBreak: 'break-word' }}>{value}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Analytics metric cards ───────────────────────────────────────── */}
      {empSearchAnalytics && (() => {
        const entries = Object.entries(empSearchAnalytics).filter(([, v]) => v && typeof v === 'object' && 'data' in v);
        if (!entries.length) return null;
        return (
          <div style={{ marginBottom: 28 }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', marginBottom: 4 }}>
                Employee Stats — {departmentName} View
              </div>
              <div style={{ height: 2, width: 36, background: 'linear-gradient(90deg,var(--accent),var(--accent2))', borderRadius: 2 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
              {entries.map(([name, data], i) => {
                const hasWarn = data.warnings?.length > 0;
                let displayVal = 'Details', labelName = 'Metric';
                if (data.data?.length > 0) {
                  const row  = data.data[0];
                  const keys = Object.keys(row).filter(k => !['branch_id', 'departement_id', 'emp_id', 'product_id'].includes(k));
                  if (keys.length > 0) {
                    const v = row[keys[0]];
                    displayVal = typeof v === 'number' ? v.toLocaleString() : v;
                    labelName  = keys[0].replace(/_/g, ' ');
                  }
                }
                const cleanName = name.replace(/get_|branch_|global_|finance_/g, '').replace(/_/g, ' ');
                const accent    = hasWarn ? '#ef4444' : ACCENTS[i % ACCENTS.length];
                return (
                  <div
                    key={i}
                    className={`metric-card ${hasWarn ? 'warn' : ''}`}
                    style={{ animationDelay: `${i * 0.04}s`, borderTop: `3px solid ${accent}`, cursor: 'pointer', position: 'relative' }}
                    onClick={() => onSelectCard?.({ name: cleanName, displayVal, labelName, data, hasWarn })}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: hasWarn ? '#f87171' : 'var(--txt2)' }}>{cleanName}</span>
                      {hasWarn && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 800, color: '#fca5a5', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', padding: '3px 9px', borderRadius: 999 }}>
                          <Icon d={IC.warn} size={10} color="#fca5a5" /> {language === 'ar' ? 'تنبيه' : 'ALERT'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: hasWarn ? '#fca5a5' : 'var(--txt)', letterSpacing: '-1px', lineHeight: 1, marginBottom: 5 }}>{displayVal}</div>
                    <div style={{ fontSize: 12, color: hasWarn ? '#f87171' : 'var(--txt2)', fontWeight: 600, textTransform: 'capitalize' }}>{labelName}</div>
                    {!hasWarn && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${accent}45,transparent)`, borderRadius: '0 0 16px 16px' }} />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Analytics charts ─────────────────────────────────────────────── */}
      {empSearchCharts.length > 0 && (
        <div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', marginBottom: 4 }}>
              Employee Charts — {departmentName} View
            </div>
            <div style={{ height: 2, width: 36, background: 'linear-gradient(90deg,var(--accent),var(--accent2))', borderRadius: 2 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(480px,1fr))', gap: 20 }}>
            {empSearchCharts.map(({ key, figure }, i) => {
              const accent = ACCENTS[i % ACCENTS.length];
              const title  = figure?.layout?.title?.text || key.replace(/get_|branch_|global_|finance_/g, '').replace(/_/g, ' ');
              return (
                <div key={key} className="graph-card" style={{ animationDelay: `${i * 0.06}s`, borderTop: `3px solid ${accent}` }}>
                  <div style={{ padding: '18px 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--txt3)', marginBottom: 3 }}>Chart {i + 1}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)', textTransform: 'capitalize' }}>{title}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {aiEnabled && (
                        <div
                          onClick={() => onAskAI?.(title, figure.data)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'rgba(59,91,255,0.1)', border: '1px solid rgba(59,91,255,0.25)', borderRadius: 7, cursor: 'pointer', transition: 'all .18s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,91,255,0.2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(59,91,255,0.1)'}
                        >
                          <div className="ai-dot" style={{ width: 5, height: 5 }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#7ca3ff' }}>{language === 'ar' ? 'اسأل AI' : 'Ask AI'}</span>
                        </div>
                      )}
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}80` }} />
                    </div>
                  </div>
                  <PlotlyChart figure={figure} language={language} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!empSearchResult && !empSearchLoading && !empSearchError && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--txt3)' }}>
          <Icon d={IC.user} size={40} color="var(--border2)" style={{ margin: '0 auto 16px', display: 'block' }} />
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Search for an Employee</div>
          <div style={{ fontSize: 13 }}>Enter an employee ID to view their profile and department analytics.</div>
        </div>
      )}
    </div>
  );
}
