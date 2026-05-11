// src/components/charts/PlotlyChart.jsx
import { useEffect, useRef, useState } from 'react';
import { usePlotly } from '../../hooks/usePlotly';
import { CHART_COLORS_DARK, CHART_COLORS_LIGHT, BAR_PALETTE_DARK, BAR_PALETTE_LIGHT, ACCENTS, colorizeTraces } from './chartUtils';

export default function PlotlyChart({ figure, height, language = 'en' }) {
  const ref        = useRef(null);
  const plotlyReady = usePlotly();
  const [ptInfo, setPtInfo]   = useState(null);
  const [selected, setSelected] = useState(null);

  // Detect light mode
  const isLight = () => document.documentElement.classList.contains('light');

  const getThemeColors = () => isLight()
    ? { palette: CHART_COLORS_LIGHT, barPalette: BAR_PALETTE_LIGHT }
    : { palette: CHART_COLORS_DARK,  barPalette: BAR_PALETTE_DARK  };

  const baseLayout = () => {
    const light = isLight();
    const fontColor   = light ? '#1e3a5f'  : '#94a3b8';
    const tickColor   = light ? '#2d5a8e'  : '#64748b';
    const gridColor   = light ? 'rgba(30,64,175,0.08)'  : 'rgba(148,163,184,0.08)';
    const zeroColor   = light ? 'rgba(30,64,175,0.15)'  : 'rgba(148,163,184,0.12)';
    const titleColor  = light ? '#0c1a35'  : '#e2e8f0';
    const plotBg      = light ? 'rgba(255,255,255,0.5)'   : 'rgba(255,255,255,0.02)';
    const { palette } = getThemeColors();
    return {
      ...figure.layout,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor:  plotBg,
      font:    { color: fontColor, family: "'Plus Jakarta Sans',sans-serif", size: 12 },
      margin:  { t: 44, r: 16, b: 48, l: 52 },
      xaxis:   { ...(figure.layout?.xaxis || {}), gridcolor: gridColor, zerolinecolor: zeroColor, tickfont: { color: tickColor }, linecolor: light ? 'rgba(30,64,175,0.15)' : 'rgba(148,163,184,0.1)' },
      yaxis:   { ...(figure.layout?.yaxis || {}), gridcolor: gridColor, zerolinecolor: zeroColor, tickfont: { color: tickColor }, linecolor: light ? 'rgba(30,64,175,0.15)' : 'rgba(148,163,184,0.1)' },
      legend:  { ...(figure.layout?.legend || {}), bgcolor: light ? 'rgba(246,248,252,0.9)' : 'rgba(0,0,0,0)', font: { color: fontColor }, bordercolor: light ? 'rgba(30,64,175,0.15)' : 'transparent', borderwidth: light ? 1 : 0 },
      colorway: palette,
      title: {
        ...(typeof figure.layout?.title === 'string' ? { text: figure.layout.title } : (figure.layout?.title || {})),
        font: { color: titleColor, size: 14, family: "'Plus Jakarta Sans',sans-serif" },
      },
    };
  };

  const isLineOrScatter = (data) =>
    data.some(t => ['scatter', 'scattergl', 'line'].includes((t.type || 'scatter').toLowerCase()) && t.mode !== 'markers');

  const resetChart = () => {
    if (!ref.current || !window.Plotly) return;
    const colored = colorizeTraces(figure.data);
    colored.forEach((t, ti) => {
      try {
        window.Plotly.restyle(ref.current, {
          'marker.opacity': [1], opacity: [1],
          'marker.size': [t.type === 'scatter' || !t.type ? 7 : (t.marker?.size ?? 6)],
        }, [ti]);
      } catch (e) {}
    });
    try {
      window.Plotly.relayout(ref.current, { shapes: [], 'xaxis.autorange': true, 'yaxis.autorange': true });
    } catch (e) {}
    setPtInfo(null);
    setSelected(null);
  };

  // Re-render chart when theme class changes (dark ↔ light)
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      if (ref.current && window.Plotly) {
        const colored = colorizeTraces(figure.data);
        window.Plotly.react(ref.current, colored, baseLayout(), {
          responsive: true, displayModeBar: true,
          modeBarButtonsToRemove: ['sendDataToCloud', 'lasso2d', 'select2d', 'autoScale2d'],
          displaylogo: false,
        });
      }
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [figure]);

  useEffect(() => {
    if (!plotlyReady || !ref.current || !figure) return;
    const coloredData = colorizeTraces(figure.data);
    window.Plotly.react(ref.current, coloredData, baseLayout(), {
      responsive: true, displayModeBar: true,
      modeBarButtonsToRemove: ['sendDataToCloud', 'lasso2d', 'select2d', 'autoScale2d'],
      displaylogo: false,
    });

    const el = ref.current;
    const { palette: CHART_COLORS } = getThemeColors();

    const handleClick = (ev) => {
      if (!ev?.points?.length) return;
      const pt           = ev.points[0];
      const traceIdx     = pt.curveNumber ?? 0;
      const ptIdx        = pt.pointIndex  ?? pt.pointNumber ?? 0;
      const accentColor  = CHART_COLORS[traceIdx % CHART_COLORS.length];
      const colored      = colorizeTraces(figure.data);
      const isLine       = isLineOrScatter(figure.data);

      const info  = {};
      const xVal  = pt.x ?? pt.label ?? null;
      if (xVal != null) info.label = String(xVal);
      if (pt.y    != null) info.y     = typeof pt.y    === 'number' ? pt.y.toLocaleString()    : String(pt.y);
      if (pt.value!= null) info.value = typeof pt.value=== 'number' ? pt.value.toLocaleString(): String(pt.value);
      if (pt.percent != null) info.share = (pt.percent * 100).toFixed(1) + '%';
      if (pt.data?.name) info.series = pt.data.name;

      setPtInfo({ info, accentColor });
      setSelected({ traceIdx, ptIdx, filterKey: info.label, isLine });

      if (isLine) {
        const allX    = colored[traceIdx]?.x || [];
        const allY    = colored[traceIdx]?.y || [];
        const xClick  = allX[ptIdx];
        const winHalf = 3;
        const lo      = Math.max(0, ptIdx - winHalf);
        const hi      = Math.min(allX.length - 1, ptIdx + winHalf);
        const slice   = allY.slice(lo, hi + 1).filter(v => typeof v === 'number');
        const yMin    = slice.length ? Math.min(...slice) * 0.97 : undefined;
        const yMax    = slice.length ? Math.max(...slice) * 1.03 : undefined;

        colored.forEach((t, ti) => {
          if ((t.type || 'scatter') !== 'pie') {
            const xs    = Array.isArray(t.x) ? t.x : [];
            const sizes = xs.map((_, xi) => (ti === traceIdx && xi === ptIdx) ? 14 : 6);
            const opacs = xs.map((_, xi) => (ti === traceIdx && xi === ptIdx) ? 1 : 0.4);
            try { window.Plotly.restyle(ref.current, { 'marker.size': [sizes.length ? sizes : 6], 'marker.opacity': [opacs.length ? opacs : 0.4] }, [ti]); } catch (e) {}
          }
        });
        try {
          window.Plotly.relayout(ref.current, {
            shapes: [{ type: 'line', xref: 'x', yref: 'paper', x0: xClick, x1: xClick, y0: 0, y1: 1, line: { color: accentColor, width: 1.5, dash: 'dot' } }],
            'xaxis.range': [allX[lo], allX[hi]],
            ...(yMin !== undefined ? { 'yaxis.range': [yMin, yMax] } : {}),
          });
        } catch (e) {}
      } else {
        colored.forEach((t, ti) => {
          const isPie = (t.type || '').toLowerCase() === 'pie';
          try {
            if (isPie) {
              const n    = (t.labels || t.x || []).length;
              const pull = Array(n).fill(0); if (pull[ptIdx] !== undefined) pull[ptIdx] = 0.08;
              window.Plotly.restyle(ref.current, { pull: [pull], 'marker.opacity': [Array(n).fill(0).map((_, i) => i === ptIdx ? 1 : 0.35)] }, [ti]);
            } else {
              const xs   = Array.isArray(t.x) ? t.x : [];
              const opac = xs.map((_, xi) => (ti === traceIdx && xi === ptIdx) ? 1 : 0.25);
              window.Plotly.restyle(ref.current, { 'marker.opacity': [opac.length ? opac : (ti === traceIdx ? 1 : 0.25)] }, [ti]);
            }
          } catch (e) {}
        });
      }
    };

    el.on('plotly_click', handleClick);
    return () => { try { el.removeAllListeners?.('plotly_click'); } catch (e) {} }
  }, [plotlyReady, figure]);

  if (!plotlyReady) return (
    <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13, gap: 8 }}>
      <span className="spinner" style={{ width: 16, height: 16 }} /> Loading chart engine...
    </div>
  );

  const accent = ptInfo?.accentColor || '#5b8fff';
  const light  = isLight();

  return (
    <div style={{ width: '100%' }}>
      {ptInfo && (
        <div style={{ margin: '4px 16px 2px', padding: '9px 14px', background: `${accent}12`, border: `1px solid ${accent}40`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', animation: 'branchIn .2s ease' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, boxShadow: `0 0 7px ${accent}`, flexShrink: 0 }} />
          {Object.entries(ptInfo.info).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: light ? 'rgba(30,58,96,0.5)' : 'rgba(148,163,184,0.55)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: (k === 'y' || k === 'value' || k === 'share') ? accent : (light ? '#0c1a35' : '#e2e8f0') }}>{v}</span>
            </div>
          ))}
          {selected?.isLine && (
            <span style={{ fontSize: 10, color: light ? 'rgba(30,58,96,0.4)' : 'rgba(148,163,184,0.4)', fontWeight: 600, marginLeft: 4 }}>
              {language === 'ar' ? '← تكبير مؤقت' : '← zoomed in'}
            </span>
          )}
          <button onClick={resetChart}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 7, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: light ? '#dc2626' : '#f87171', fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", transition: 'all .18s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.22)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}>
            <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            Reset
          </button>
        </div>
      )}
      <div ref={ref} style={{ width: '100%', height: height || 320 }} />
    </div>
  );
}
