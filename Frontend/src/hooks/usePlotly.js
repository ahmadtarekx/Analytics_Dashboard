// src/hooks/usePlotly.js
import { useState, useEffect } from 'react';

export function usePlotly() {
  const [ready, setReady] = useState(!!window.Plotly);

  useEffect(() => {
    if (window.Plotly) { setReady(true); return; }
    const s    = document.createElement('script');
    s.src      = 'https://cdn.plot.ly/plotly-2.30.0.min.js';
    s.onload   = () => setReady(true);
    document.head.appendChild(s);
  }, []);

  return ready;
}
