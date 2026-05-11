// src/hooks/useGoogleTranslate.js
// Provides a translate() function that calls the backend /api/translate endpoint.
// Falls back to the original text if the request fails.
//
// Usage:
//   const { translate, translateBatch } = useGoogleTranslate();
//   const arabic = await translate('Hello', 'ar');
//   const results = await translateBatch(['Hello', 'World'], 'ar');

import { useCallback } from 'react';
import { API } from '../constants/api';

export function useGoogleTranslate() {

    /**
     * Translate a single string.
     * @param {string} text   – source text
     * @param {'ar'|'en'} to  – target language
     * @returns {Promise<string>}
     */
    const translate = useCallback(async (text, to = 'ar') => {
        if (!text || !text.trim()) return text;
        try {
            const res  = await fetch(API.TRANSLATE, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ text, to }),
            });
            if (!res.ok) return text;
            const data = await res.json();
            return data.translated || text;
        } catch {
            return text; // network error → degrade gracefully
        }
    }, []);

    /**
     * Translate an array of strings in parallel.
     * @param {string[]} texts
     * @param {'ar'|'en'} to
     * @returns {Promise<string[]>}
     */
    const translateBatch = useCallback(async (texts, to = 'ar') => {
        if (!texts || texts.length === 0) return texts;
        return Promise.all(texts.map(t => translate(t, to)));
    }, [translate]);

    /**
     * Translate an object's string values in parallel.
     * Non-string values are passed through unchanged.
     * @param {Record<string, any>} obj
     * @param {'ar'|'en'} to
     * @returns {Promise<Record<string, any>>}
     */
    const translateObject = useCallback(async (obj, to = 'ar') => {
        if (!obj || typeof obj !== 'object') return obj;
        const entries  = Object.entries(obj);
        const values   = await Promise.all(
            entries.map(([, v]) => typeof v === 'string' ? translate(v, to) : Promise.resolve(v))
        );
        return Object.fromEntries(entries.map(([k], i) => [k, values[i]]));
    }, [translate]);

    return { translate, translateBatch, translateObject };
}
