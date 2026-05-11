// src/hooks/useDebouncedInput.js
import { useState, useRef, useCallback } from 'react';

export function useDebouncedInput(initialValue = '', delay = 80) {
  const [value,   setValue]   = useState(initialValue);
  const [display, setDisplay] = useState(initialValue);
  const timer = useRef(null);

  const set = useCallback((v) => {
    setDisplay(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setValue(v), delay);
  }, [delay]);

  const setImmediate = useCallback((v) => { setDisplay(v); setValue(v); }, []);

  return [display, value, set, setImmediate];
}
