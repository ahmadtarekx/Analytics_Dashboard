// src/components/ui/Icon.jsx
import { useRef, useEffect } from 'react';

export const IC = {
  user:     "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  chart:    "M3 3v18h18M9 17V9m4 8V5m4 12v-4",
  graphs:   "M2 20h20M6 20V10m4 10V4m4 16v-7m4 7v-3",
  logout:   "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  branch:   "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  money:    "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  gender:   "M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zm0 10v10m-4-4l4 4 4-4",
  birthday: "M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 3H8",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  phone:    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.07 3.4 2 2 0 0 1 3.04 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z",
  address:  "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4",
  warn:     "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  globe:    "M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10A15.3 15.3 0 0 1 8 12a15.3 15.3 0 0 1 4-10z",
  sun:      "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
  moon:     "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  pin:      "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4",
  close:    "M18 6L6 18M6 6l12 12",
  table:    "M3 3h18v18H3zM3 9h18M9 21V9",
  terminal: "M4 17l6-6-6-6M12 19h8",
  ticket:   "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 0-2-2H5z",
  mail:     "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
  check:    "M20 6L9 17l-5-5",
  headset:  "M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z",
  shield:   "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  zap:      "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  pkg:      "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12",
  trash:    "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  plus:     "M12 5v14M5 12h14",
  layers:   "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  brain:    "M9.5 2a2.5 2.5 0 0 1 5 0M12 2v20M4.5 6.5A4.5 4.5 0 0 0 9 11h3M19.5 6.5A4.5 4.5 0 0 1 15 11h-3M6 11a4 4 0 0 0 4 4h2M18 11a4 4 0 0 1-4 4h-2M9 15v4M15 15v4",
};

export default function Icon({ d, size = 16, color = 'currentColor', style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={d} />
    </svg>
  );
}

// ── Fast debounced text input ─────────────────────────────────────────────────
export function FastInput({ value, onChange, className, style, placeholder, type = 'text', onKeyDown, disabled }) {
  const localRef = useRef(null);
  const timerRef = useRef(null);
  const prevVal  = useRef(value);

  useEffect(() => {
    if (localRef.current && value !== localRef.current.value && value !== prevVal.current) {
      localRef.current.value = value ?? '';
    }
    prevVal.current = value;
  }, [value]);

  const handleInput = (e) => {
    clearTimeout(timerRef.current);
    const v = e.target.value;
    timerRef.current = setTimeout(() => { onChange(v); }, 60);
  };

  return (
    <input ref={localRef} type={type} defaultValue={value ?? ''} onInput={handleInput}
      onKeyDown={onKeyDown} className={className} style={style} placeholder={placeholder} disabled={disabled} />
  );
}

// ── Fast textarea ─────────────────────────────────────────────────────────────
export function FastTextArea({ value, onChange, className, style, placeholder, rows, disabled }) {
  const localRef  = useRef(null);
  const isMounted = useRef(false);

  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    if (localRef.current && document.activeElement !== localRef.current) {
      localRef.current.value = value ?? '';
    }
  }, [value]);

  return (
    <textarea ref={localRef} defaultValue={value ?? ''} onInput={e => onChange(e.target.value)}
      className={className} style={style} placeholder={placeholder} rows={rows} disabled={disabled} />
  );
}
