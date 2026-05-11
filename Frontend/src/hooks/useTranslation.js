// src/hooks/useTranslation.js
// Loads the correct JSON translation file based on the active language.
// Usage:
//   const { tx, t, cardTitle, chipLabel, metricLabel, catName } = useTranslation(language);
//
//   tx.profile          → full key lookup  (replaces the old T[language].profile)
//   t('profile')        → same as tx.profile but via function
//   cardTitle('burnout risk')     → translated metric card title
//   metricLabel('totalEmployees') → translated primary label
//   chipLabel('avg')              → translated chip label
//   catName('Workforce')          → translated category heading

import { useMemo } from 'react';
import en from '../i18n/en.json';
import ar from '../i18n/ar.json';

const LOCALES = { en, ar };

export function useTranslation(language = 'en') {
  return useMemo(() => {
    const locale = LOCALES[language] || LOCALES.en;

    // Flat tx object — direct key access (e.g. tx.profile, tx.logout)
    const tx = locale;

    // Function form — t('profile') → locale.profile
    const t = (key) => locale[key] ?? key;

    // Metric card title (keyed by lowercase cleanName)
    const cardTitle = (rawName) => {
      const key = rawName.toLowerCase();
      return locale._cardTitles?.[key] ?? rawName;
    };

    // Primary label under the big number on metric cards
    const metricLabel = (key) => {
      return locale._metricLabels?.[key] ?? key;
    };

    // Chip label (Max, Min, Avg, Records, etc.)
    const chipLabel = (key) => {
      return locale._chipLabels?.[key] ?? key;
    };

    // Category heading (Workforce, Finance, etc.)
    const catName = (key) => {
      return locale._categoryNames?.[key] ?? key;
    };

    return { tx, t, cardTitle, metricLabel, chipLabel, catName, locale };
  }, [language]);
}