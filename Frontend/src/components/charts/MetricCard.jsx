// src/components/charts/MetricCard.jsx
import { useState, useRef } from 'react';
import { getThemeBarPalette } from './chartUtils';
import Icon from '../ui/Icon';

function fmtVal(v) {
  if (v == null) return '—';
  if (typeof v !== 'number') return String(v);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return v.toLocaleString();
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export default function MetricCard({ entry, c, hasSpark, maxSpark, barColors, ci, language, aiEnabled, onOpenDetail, onAskAI }) {
  const [activeBar, setActiveBar]   = useState(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const sparkRef = useRef(null);

  const previewIdx    = hoveredBar !== null ? hoveredBar : activeBar;
  const isPreview     = previewIdx !== null;
  const isBarLocked   = activeBar !== null;
  const safeBarColors = Array.isArray(barColors) && barColors.length ? barColors : getThemeBarPalette();
  const previewColor  = isPreview ? (safeBarColors[previewIdx % safeBarColors.length] || c) : c;
  const displayedVal  = isPreview ? fmtVal(entry.sparkValues[previewIdx]) : entry.primaryVal;
  const displayedLabel = isPreview ? (entry.sparkLabels?.[previewIdx] || `#${previewIdx + 1}`) : entry.primaryLabel;

  const handleBarMouseEnter = (e, si) => {
    e.stopPropagation();
    setHoveredBar(si);
    const rect = e.currentTarget.getBoundingClientRect();
    const par  = sparkRef.current?.getBoundingClientRect();
    if (par) setTooltipPos({ x: rect.left - par.left + rect.width / 2, y: rect.top - par.top });
  };
  const handleBarMouseLeave = (e) => { e.stopPropagation(); setHoveredBar(null); };
  const handleBarClick      = (e, si) => { e.stopPropagation(); setActiveBar(prev => (prev === si ? null : si)); };
  const handleCardClick     = () => { if (isBarLocked) setActiveBar(null); else onOpenDetail(); };

  return (
    <div
      className="metric-card"
      style={{ animationDelay: `${ci * 0.04}s`, borderTop: `2px solid ${c}`, padding: '13px 15px', cursor: 'pointer', transition: 'transform .18s, box-shadow .18s' }}
      onClick={handleCardClick}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 22px ${c}22, 0 0 0 1px ${c}28`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 9 }}>
        <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--txt3)', lineHeight: 1.35, flex: 1, paddingRight: 6 }}>
          {entry.cleanName}
        </span>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: `${c}15`, border: `1px solid ${c}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon d={entry.meta.icon} size={10} color={c} />
        </div>
      </div>

      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1, marginBottom: 2, transition: 'color .1s', color: isPreview ? previewColor : 'var(--txt)' }}>
        {displayedVal}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.9, marginBottom: 8, transition: 'color .1s', color: previewColor, display: 'flex', alignItems: 'center', gap: 4 }}>
        {displayedLabel}
        {isBarLocked && hoveredBar === null && (
          <span style={{ fontSize: 8, fontWeight: 600, color: 'rgba(148,163,184,0.4)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>
            {language === 'ar' ? 'انقر للإعادة' : 'tap to reset'}
          </span>
        )}
      </div>

      {entry.summaryChips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: hasSpark ? 7 : 0, opacity: isPreview ? 0.28 : 1, transition: 'opacity .15s' }}>
          {entry.summaryChips.slice(0, 3).map((chip, xi) => (
            <div key={xi} style={{ display: 'flex', alignItems: 'baseline', gap: 3, padding: '2px 6px', borderRadius: 5, background: chip.hl ? `${c}14` : 'var(--surface2)', border: chip.hl ? `1px solid ${c}28` : '1px solid var(--border)' }}>
              <span style={{ fontSize: 7.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{chip.label}</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: chip.hl ? c : 'var(--txt)' }}>{chip.value}</span>
            </div>
          ))}
        </div>
      )}

      {hasSpark && (
        <div ref={sparkRef} style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 3, height: 30, marginBottom: 3 }}>
          {entry.sparkValues.map((sv, si) => {
            const h       = maxSpark > 0 ? Math.max(3, Math.round((sv / maxSpark) * 26)) : 3;
            const bColor  = safeBarColors[si % safeBarColors.length];
            const isActive = activeBar === si;
            const isHov   = hoveredBar === si;
            const isHl    = isActive || isHov;
            const isDimmed = isPreview && !isHl;
            return (
              <div key={si}
                onClick={e => handleBarClick(e, si)}
                onMouseEnter={e => handleBarMouseEnter(e, si)}
                onMouseLeave={handleBarMouseLeave}
                style={{ flex: 1, height: `${isHl ? Math.min(h + 5, 28) : h}px`, borderRadius: '3px 3px 0 0', background: bColor, opacity: isDimmed ? 0.15 : isHl ? 1 : 0.72, cursor: 'pointer', transition: 'all .12s ease', boxShadow: isHl ? `0 0 8px ${bColor}90` : 'none', outline: isActive ? `1.5px solid ${bColor}` : 'none', outlineOffset: '1px' }} />
            );
          })}
          {hoveredBar !== null && (() => {
            const isLightMode = document.documentElement.classList.contains('light');
            const tipBg = isLightMode ? 'rgba(255,255,255,0.98)' : 'rgba(10,16,32,0.97)';
            const tipTxt = isLightMode ? '#0c1a35' : '#f1f5f9';
            const tipSub = isLightMode ? 'rgba(30,58,96,0.55)' : 'rgba(148,163,184,0.65)';
            const tipShadow = isLightMode ? '0 6px 20px rgba(30,64,175,0.18), 0 1px 4px rgba(30,64,175,0.12)' : '0 6px 20px rgba(0,0,0,.65)';
            return (
              <div style={{ position: 'absolute', left: Math.min(Math.max(tooltipPos.x - 34, 0), 155), top: tooltipPos.y - 54, width: 68, zIndex: 9999, background: tipBg, border: `1px solid ${safeBarColors[hoveredBar % safeBarColors.length]}70`, borderRadius: 8, padding: '5px 7px', pointerEvents: 'none', boxShadow: tipShadow }}>
                <div style={{ height: 2, background: safeBarColors[hoveredBar % safeBarColors.length], borderRadius: 2, marginBottom: 4 }} />
                <div style={{ fontSize: 13, fontWeight: 800, color: tipTxt, textAlign: 'center', lineHeight: 1 }}>{fmtVal(entry.sparkValues[hoveredBar])}</div>
                <div style={{ fontSize: 8, color: tipSub, textAlign: 'center', marginTop: 3, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.sparkLabels?.[hoveredBar] || `#${hoveredBar + 1}`}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 8.5, color: 'var(--txt3)', fontWeight: 600 }}>
          {language === 'ar'
            ? `${entry.rows.length} سجل`
            : `${entry.rows.length} row${entry.rows.length !== 1 ? 's' : ''}`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {aiEnabled && (
            <div className="ai-ask-btn" style={{ padding: '2px 6px' }} onClick={e => { e.stopPropagation(); onAskAI(); }}>
              <div className="ai-dot" style={{ width: 3.5, height: 3.5 }} />
              <span style={{ fontSize: 7.5 }}>AI</span>
            </div>
          )}
          <span style={{ fontSize: 8, color: `${c}70`, fontWeight: 700, letterSpacing: '0.4px' }}>
            {isBarLocked ? (language === 'ar' ? '← إعادة' : '↑ reset') : (language === 'ar' ? '←' : 'details →')}
          </span>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${c}35,transparent)`, borderRadius: '0 0 14px 14px' }} />
    </div>
  );
}
