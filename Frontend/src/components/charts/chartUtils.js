// src/components/charts/chartUtils.js

// Dark mode palette (rich, saturated for dark backgrounds)
export const CHART_COLORS_DARK = [
  '#6ea8fe', '#56cfb2', '#9b8afb', '#f6a860', '#67d4f8',
  '#f78c98', '#52d68a', '#d6c06a', '#89a4f7', '#e8a0d4',
  '#63d4d4', '#f4a56a', '#a0d488', '#c7a0f7', '#7ac2e8',
];

// Light mode palette (higher contrast, vivid for white backgrounds)
export const CHART_COLORS_LIGHT = [
  '#2563eb', '#059669', '#7c3aed', '#d97706', '#0891b2',
  '#e11d48', '#16a34a', '#b45309', '#4f46e5', '#db2777',
  '#0e7490', '#ea580c', '#15803d', '#9333ea', '#1d4ed8',
];

export const CHART_COLORS = CHART_COLORS_DARK; // default export for compat

export const BAR_PALETTE_DARK = [
  '#6ea8fe', '#56cfb2', '#9b8afb', '#f6a860', '#67d4f8',
  '#f78c98', '#52d68a', '#d6c06a', '#89a4f7', '#e8a0d4',
  '#63d4d4', '#f4a56a', '#a0d488', '#c7a0f7', '#7ac2e8',
];

export const BAR_PALETTE_LIGHT = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4',
  '#f43f5e', '#22c55e', '#d97706', '#6366f1', '#ec4899',
  '#0ea5e9', '#fb923c', '#4ade80', '#a855f7', '#38bdf8',
];

export const BAR_PALETTE = BAR_PALETTE_DARK; // compat
export const ACCENTS = ['#4f7cff','#f59e0b','#10b981','#8b5cf6','#ec4899','#f97316','#06b6d4','#ef4444'];

// Returns correct palette based on current theme
export const getThemePalette = () => {
  const isLight = document.documentElement.classList.contains('light');
  return isLight ? CHART_COLORS_LIGHT : CHART_COLORS_DARK;
};

export const getThemeBarPalette = () => {
  const isLight = document.documentElement.classList.contains('light');
  return isLight ? BAR_PALETTE_LIGHT : BAR_PALETTE_DARK;
};

export function colorizeTraces(rawData) {
  if (!rawData) return [];
  const palette    = getThemePalette();
  const barPalette = getThemeBarPalette();

  return rawData.map((trace, i) => {
    const c    = palette[i % palette.length];
    const base = { ...trace };
    const t    = (base.type || '').toLowerCase();

    if (t === 'pie' || t === 'donut') {
      base.marker = { ...(base.marker || {}), colors: barPalette };
    } else if (t === 'scatter' || t === 'scattergl') {
      base.line   = { ...(base.line   || {}), color: c, width: 2.5 };
      base.marker = { ...(base.marker || {}), color: c, size: 7 };
    } else if (t === 'bar' || !t) {
      const xs        = Array.isArray(base.x) ? base.x : [];
      const barColors = xs.length
        ? xs.map((_, bi) => barPalette[(i * xs.length + bi) % barPalette.length])
        : [c];
      base.marker = {
        ...(base.marker || {}),
        color:   xs.length > 1 ? barColors : c,
        opacity: 0.92,
        line:    { width: 0 },
      };
    } else {
      base.marker = { ...(base.marker || {}), color: c };
    }
    return base;
  });
}
