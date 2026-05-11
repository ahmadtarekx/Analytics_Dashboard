/**
 * AITab.jsx — Shared Tab Component   [FINAL REFACTORED v3]
 *
 * Full AI free-chat assistant with data-source selector.
 * Extracted from old Dashboard.jsx ~line 6663–6980 and fully refactored to:
 *   • Use aiRepository.chat()        instead of raw fetch('/api/chat')
 *   • Use salesRepository.*          instead of raw fetch('/api/sales/*')
 *   • Use financeRepository.*        instead of raw fetch('/api/finance/*')
 *   • Use prRepository.*             instead of raw fetch('/api/pr/*')
 *   • Use renderBold()               for rich AI reply formatting (bold, headers)
 *
 * ── Changes from v2 → v3 ────────────────────────────────────────────────────
 *   [FIX] Added isPR personal data loader ("My Campaigns") — was missing in v2.
 *   [FIX] Added renderBold() to message rendering — old Dashboard used it, v2 didn't.
 *   [FIX] Added `sales_trend` field to handleLoadSalesPersonal aiData mapping.
 *   [FIX] Added `dir` + `textAlign` attributes on message bubbles for proper RTL.
 *   [CLEAN] Removed inline raw fetch() calls; everything goes through repositories.
 *
 * ── Features ──────────────────────────────────────────────────────────────
 *   Left panel  : click any dashboardData metric to load into AI context
 *   Right panel : chat interface with full message history + renderBold formatting
 *   Sessions    : saved in localStorage (aiChatSessions, max 10)
 *   Auto-explain: on first load of a source the AI summarizes it
 *   Compare mode: add multiple sources without clearing the chat
 *   Personal data: Sales / Finance / PR users see their own stats in left panel
 *
 * ── Props ──────────────────────────────────────────────────────────────────
 *   dashboardData  {object|null}  — raw (pre-overlay) analytics payload from
 *                                   Dashboard.jsx.  AITab uses this to build
 *                                   the left-panel source list.  The parent
 *                                   intentionally passes dashboardData (not
 *                                   analyticsSource) because overlay slices
 *                                   are partial and shouldn't appear here.
 *
 * ── Context (via useAuth) ──────────────────────────────────────────────────
 *   user, language, isIT, isSales, isFinance, isPR
 *
 * ── RBAC guard ─────────────────────────────────────────────────────────────
 *   Rendered by Dashboard.jsx only when:  activeTab === 'ai' && aiEnabled && !isIT
 *   No internal guard needed beyond the safety net below.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth }          from '../../context/AuthContext';
import { useTranslation }   from '../../hooks/useTranslation';
import { renderBold }       from '../../utils/renderBold';
import aiRepository         from '../../api/aiRepository';
import salesRepository      from '../../api/salesRepository';
import financeRepository    from '../../api/financeRepository';
import prRepository         from '../../api/prRepository';
import Icon, { IC }         from '../ui/Icon';

// ── Module-level helpers (no hooks) ──────────────────────────────────────────

/**
 * buildSystemPrompt
 *
 * Converts raw dashboard data into a compact system prompt for the AI backend.
 * `chart` keys are stripped because they contain large Plotly config objects
 * that add no analytical value and would consume the token budget.
 *
 * smartTrim: for large datasets (>6 000 chars) it keeps only the top 15 and
 * bottom 5 records sorted by the first numeric column, and adds a total_records
 * count so the AI can contextualise the sample.
 */
const buildSystemPrompt = (contextLabel, contextData) => {
  const strip = (obj) =>
    JSON.parse(JSON.stringify(obj, (key, val) => (key === 'chart' ? undefined : val)));

  const smartTrim = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val && Array.isArray(val.data)) {
        const dataSize = JSON.stringify(val.data).length;
        if (dataSize > 6000) {
          const numericKey = Object.keys(val.data[0] || {}).find(
            (k) => typeof val.data[0][k] === 'number' && k !== 'branch_id' && k !== 'emp_id'
          );
          const sorted = numericKey
            ? [...val.data].sort((a, b) => b[numericKey] - a[numericKey])
            : val.data;
          result[key] = {
            total_records: val.data.length,
            top_15:        sorted.slice(0, 15),
            bottom_5:      sorted.slice(-5),
            warnings:      val.warnings || [],
            period:        val.period   || null,
          };
        } else {
          result[key] = val;
        }
      } else {
        result[key] = val;
      }
    }
    return result;
  };

  const cleaned = smartTrim(strip(contextData));
  const dataStr = JSON.stringify(cleaned).substring(0, 13000);
  return `RAW DATA:\n${dataStr}`;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AITab({ dashboardData }) {
  const {
    user,
    language,
    isIT,
    isSales,
    isFinance,
    isPR,
  } = useAuth();

  // Guard: IT users should never reach this component (Dashboard.jsx blocks it),
  // but we add a safety net in case this component is ever mounted in isolation.
  if (isIT) return null;

  const tx           = useTranslation(language);
  const chatInputRef = useRef(null);
  const isAr         = language === 'ar';

  // ── Chat state ─────────────────────────────────────────────────────────────
  const [freeChat, setFreeChat] = useState({
    messages:      [],
    input:         '',
    loading:       false,
    loadedSources: [],
    systemPrompt:  null,
  });

  const [chatSessions, setChatSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('aiChatSessions') || '[]'); }
    catch { return []; }
  });

  // Auto-scroll messages area whenever messages or loading state changes
  useEffect(() => {
    const el = document.getElementById('ai-free-msgs');
    if (el) el.scrollTop = el.scrollHeight;
  }, [freeChat.messages, freeChat.loading]);

  // Refocus the textarea whenever the AI finishes responding.
  // This covers ALL cases: manual send, auto-explain on source load, compare mode.
  // Without this, the user has to click the box again after every reply.
  useEffect(() => {
    if (!freeChat.loading && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [freeChat.loading]);

  // ── "Ask AI" cross-tab bridge ──────────────────────────────────────────────
  // When the user clicks "Ask AI" on a chart card or metric card in GraphsTab /
  // OverviewTab, those components write the source to sessionStorage and dispatch
  // a custom 'askAI' event.  Dashboard.jsx switches the active tab to 'ai',
  // which UNMOUNTS and RE-MOUNTS this component.  This effect runs on every
  // mount, reads the pending source, and loads it into the AI chat automatically.
  useEffect(() => {
    const raw = sessionStorage.getItem('aiPendingSource');
    if (!raw) return;
    sessionStorage.removeItem('aiPendingSource');
    try {
      const { label, data } = JSON.parse(raw);
      if (label && data) loadAiSource(label, data);
    } catch { /* malformed payload — ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally [] — runs once on mount (= once per tab activation)

  // ── callAI ──────────────────────────────────────────────────────────────────
  /**
   * Calls the AI backend via aiRepository.chat() with one automatic retry
   * on transient network failures.  Error messages are categorised into
   * user-friendly Arabic / English strings.
   *
   * @param {string}   systemPrompt   — RAW DATA: ... prompt or conversational prompt
   * @param {Array}    messages        — full message history ending with the user turn
   * @param {Function} onSuccess       — (reply: string) => void
   * @param {Function} onError         — (errorText: string) => void
   * @param {Function} setLoading      — (v: boolean) => void
   */
  const callAI = useCallback(
    async (systemPrompt, messages, onSuccess, onError, setLoading) => {
      setLoading(true);

      const latestMessage = messages[messages.length - 1].content;
      const history       = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
      const msgIsArabic   = /[\u0600-\u06FF]/.test(latestMessage);
      const replyLang     = msgIsArabic ? 'ar' : isAr ? 'ar' : 'en';
      const insight       = systemPrompt?.startsWith('RAW DATA:\n')
        ? systemPrompt.replace('RAW DATA:\n', '')
        : null;

      const payload = {
        message:    latestMessage,
        history,
        insight,
        role:       user?.role            || 'emp',
        department: user?.department_name || 'Unknown',
        replyLang,
      };

      const attemptFetch = () => aiRepository.chat(payload);

      try {
        let data;
        try {
          data = await attemptFetch();
        } catch (firstErr) {
          // Retry once on transient network errors only
          const msg       = (firstErr?.message || '').toLowerCase();
          const isNetwork =
            msg.includes('failed to fetch') ||
            msg.includes('networkerror')    ||
            msg.includes('econnrefused')    ||
            msg.includes('load failed');
          if (isNetwork) {
            await new Promise((r) => setTimeout(r, 2000));
            data = await attemptFetch();
          } else {
            throw firstErr;
          }
        }
        onSuccess(data?.reply || (isAr ? 'لم يصل رد.' : 'No response.'));
      } catch (err) {
        const msg = (err?.message || '').toLowerCase();
        let errorText;
        if (msg.includes('tokens per day') || msg.includes('tpd') || msg.includes('daily') || msg === 'daily_quota') {
          errorText = isAr
            ? '⚠️ المساعد الذكي وصل للحد اليومي من الاستخدام. يتجدد عند منتصف الليل (UTC). حاول مجدداً لاحقاً.'
            : '⚠️ The AI assistant has reached its daily usage limit. It resets at midnight UTC. Please try again later.';
        } else if (msg.includes('rate') || msg.includes('capacity') || msg.includes('429') || msg.includes('busy') || msg === 'rate_limit') {
          errorText = isAr
            ? '⚠️ المساعد الذكي مشغول حالياً. انتظر لحظة ثم أعد المحاولة.'
            : '⚠️ The AI advisor is busy right now. Please wait a moment and retry.';
        } else if (msg.includes('401') || msg.includes('api key') || msg.includes('credential') || msg.includes('unauthorized')) {
          errorText = isAr
            ? '⚠️ مفتاح الـ API غير صحيح. تواصل مع مسؤول النظام.'
            : '⚠️ Invalid API credentials. Contact your system administrator.';
        } else if (
          msg.includes('failed to fetch') || msg.includes('networkerror') ||
          msg.includes('econnrefused')    || msg.includes('load failed')  ||
          msg.includes('port 3000')
        ) {
          errorText = isAr
            ? '⚠️ تعذّر الاتصال بالسيرفر بعد محاولتين. تأكد أن السيرفر يعمل على منفذ 3000 ثم أعد المحاولة.'
            : '⚠️ Could not reach the backend server after 2 attempts. Make sure it is running on port 3000, then retry.';
        } else {
          errorText = isAr
            ? '⚠️ حدث خطأ غير متوقع. حاول مرة أخرى.'
            : '⚠️ An unexpected error occurred. Please try again.';
        }
        onError(errorText);
      }
      setLoading(false);
    },
    [user, language, isAr]
  );

  // ── loadAiSource — Focus mode: load a single source and clear chat ──────────
  /**
   * Saves the current chat session to localStorage, then starts a fresh
   * conversation focused on a single data source.  If a previous session
   * for this source already exists, it is restored instead of starting fresh.
   *
   * @param {string}  label             — human-readable source name (used as session key)
   * @param {*}       data              — the raw analytics payload for this source
   * @param {boolean} [autoExplain=true] — auto-send an explanation request on first load
   */
  const loadAiSource = useCallback(
    (label, data, autoExplain = true) => {
      // Persist the current chat before switching
      setFreeChat((prev) => {
        if (prev.messages.length > 0) {
          const existingIndex = chatSessions.findIndex(
            (s) => s.sources?.join(',') === prev.loadedSources.map((s) => s.label).join(',')
          );
          const session = {
            id:            existingIndex >= 0 ? chatSessions[existingIndex].id : Date.now(),
            date:          new Date().toLocaleString(),
            sources:       prev.loadedSources.map((s) => s.label),
            messages:      prev.messages,
            loadedSources: prev.loadedSources,
            systemPrompt:  prev.systemPrompt,
          };
          const updated =
            existingIndex >= 0
              ? chatSessions.map((x, i) => (i === existingIndex ? session : x))
              : [session, ...chatSessions].slice(0, 10);
          setChatSessions(updated);
          localStorage.setItem('aiChatSessions', JSON.stringify(updated));
        }
        return prev;
      });

      // Restore a saved session for this exact source if one exists
      const savedSession = chatSessions.find(
        (s) => s.sources?.length === 1 && s.sources[0] === label
      );
      if (savedSession) {
        setFreeChat({
          messages:      savedSession.messages,
          input:         '',
          loading:       false,
          loadedSources: savedSession.loadedSources,
          systemPrompt:  savedSession.systemPrompt,
        });
        return;
      }

      const singleSource   = [{ label, data }];
      const combinedPrompt = buildSystemPrompt(label, data);

      if (autoExplain) {
        const autoMsg = isAr
          ? `اشرح لي بيانات "${label}" بشكل مفصل وأبرز الأرقام المهمة والتحذيرات إن وجدت.`
          : `Explain the loaded data for "${label}" — highlight key numbers, trends, and any warnings.`;

        setTimeout(() => {
          setFreeChat((p) => {
            if (p.loading) return p;
            const updated = [{ role: 'user', content: autoMsg }];
            callAI(
              combinedPrompt,
              updated,
              (reply) =>
                setFreeChat((q) => ({
                  ...q,
                  messages: [...updated, { role: 'assistant', content: reply }],
                  loading: false,
                })),
              (err) =>
                setFreeChat((q) => ({
                  ...q,
                  messages: [...updated, { role: 'assistant', content: err }],
                  loading: false,
                })),
              (v) => setFreeChat((q) => ({ ...q, loading: v }))
            );
            return { ...p, messages: updated, loading: true };
          });
        }, 250);
      }

      setFreeChat({
        messages:      [],
        input:         '',
        loading:       false,
        loadedSources: singleSource,
        systemPrompt:  combinedPrompt,
      });
    },
    [chatSessions, callAI, isAr]
  );

  // ── compareAiSource — Compare mode: add a source without clearing chat ──────
  const compareAiSource = useCallback(
    (label, data) => {
      setFreeChat((prev) => {
        if (prev.loadedSources.find((s) => s.label === label)) return prev; // already loaded

        const newSources     = [...prev.loadedSources, { label, data }];
        const combinedPrompt = buildSystemPrompt(
          newSources.map((s) => s.label).join(' + '),
          Object.fromEntries(newSources.map((s) => [s.label, s.data]))
        );
        const compareMsg = isAr ? `تمت إضافة مصدر "${label}".` : `Source "${label}" added.`;
        const updated    = [...prev.messages, { role: 'user', content: compareMsg }];

        setTimeout(() => {
          setFreeChat((p) => {
            if (p.loading) return p;
            callAI(
              combinedPrompt,
              updated,
              (reply) =>
                setFreeChat((q) => ({
                  ...q,
                  messages: [...updated, { role: 'assistant', content: reply }],
                  loading: false,
                })),
              (err) =>
                setFreeChat((q) => ({
                  ...q,
                  messages: [...updated, { role: 'assistant', content: err }],
                  loading: false,
                })),
              (v) => setFreeChat((q) => ({ ...q, loading: v }))
            );
            return { ...p, loading: true };
          });
        }, 250);

        return { ...prev, loadedSources: newSources, systemPrompt: combinedPrompt, messages: updated };
      });
    },
    [callAI, isAr]
  );

  // ── unloadAiSource — remove one source from the active context ──────────────
  const unloadAiSource = useCallback((label) => {
    setFreeChat((prev) => {
      const newSources     = prev.loadedSources.filter((s) => s.label !== label);
      const combinedPrompt =
        newSources.length > 0
          ? buildSystemPrompt(
              newSources.map((s) => s.label).join(' + '),
              Object.fromEntries(newSources.map((s) => [s.label, s.data]))
            )
          : null;
      return { ...prev, loadedSources: newSources, systemPrompt: combinedPrompt };
    });
  }, []);

  // ── sendMessage — send the current input to the AI ──────────────────────────
  const sendMessage = async () => {
    const inputEl      = chatInputRef.current;
    const currentInput = (inputEl ? inputEl.value : freeChat.input).trim();
    if (!currentInput || freeChat.loading) return;

    const updated = [...freeChat.messages, { role: 'user', content: currentInput }];
    if (inputEl) { inputEl.value = ''; inputEl.focus(); }

    // Build a conversational system prompt when no source is loaded
    let sysPrompt = freeChat.loadedSources?.length > 0 ? freeChat.systemPrompt : null;
    if (!sysPrompt) {
      const availableNames =
        dashboardData && !dashboardData.message
          ? Object.keys(dashboardData)
              .filter((k) => dashboardData[k] && 'data' in dashboardData[k])
              .map((k) => k.replace(/get_|branch_|global_|finance_/g, '').replace(/_/g, ' '))
          : [];
      const sourceList =
        availableNames.length > 0
          ? `Available sources on the left panel: ${availableNames.join(', ')}.`
          : 'No data sources are available yet.';

      sysPrompt = [
        `You are a direct, conversational AI Data Analyst in an enterprise ERP system.`,
        `Assisting: ${user?.name || 'Unknown'} | Role: ${user?.role || 'emp'} | Department: ${user?.department_name || 'Unknown'} | Branch: ${user?.primary_branch || 'N/A'}`,
        ``,
        `No data source is currently loaded. ${sourceList}`,
        ``,
        `BEHAVIORAL RULES (follow strictly):`,
        `1. Greetings: reply with ONE short warm sentence and offer to help them load data.`,
        `2. Vague open requests with no specific topic AND no data loaded: ask ONE short clarifying question.`,
        `3. If the user mentions a topic: identify the closest matching source and tell them exactly which one to click.`,
        `4. Always be conversational and natural. Never re-introduce yourself.`,
        `5. Reply in the EXACT SAME language the user writes in. No markdown (* or #).`,
      ].join('\n');
    }

    setFreeChat((p) => ({ ...p, messages: updated, input: '', loading: true }));
    await callAI(
      sysPrompt,
      updated,
      (reply) => {
        setFreeChat((p) => ({
          ...p,
          messages: [...updated, { role: 'assistant', content: reply }],
          loading: false,
        }));
        if (inputEl) setTimeout(() => inputEl.focus(), 50);
      },
      (err) => {
        setFreeChat((p) => ({
          ...p,
          messages: [...updated, { role: 'assistant', content: err }],
          loading: false,
        }));
        if (inputEl) setTimeout(() => inputEl.focus(), 50);
      },
      (v) => setFreeChat((p) => ({ ...p, loading: v }))
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Source list from dashboardData ─────────────────────────────────────────
  const metricsEntries =
    dashboardData && !dashboardData.message
      ? Object.entries(dashboardData).filter(([, d]) => d && 'data' in d)
      : [];

  // ── Personal data loader: Sales ────────────────────────────────────────────
  /**
   * Attempts the full Python stats endpoint first (richer data), falls back
   * to the basic stats endpoint on failure.  Includes `sales_trend` which
   * was present in the old Dashboard but missing from v2 of this component.
   */
  const handleLoadSalesPersonal = useCallback(
    async (label) => {
      if (freeChat.loadedSources.some((s) => s.label === label)) {
        unloadAiSource(label);
        return;
      }
      try {
        const raw = await salesRepository.getMyFullStats(user.id);
        const aiData = {
          total_revenue:       raw.get_my_total_sales_revenue?.data?.[0]?.my_total_revenue,
          total_units_sold:    raw.get_my_total_units_sold?.data?.[0]?.my_total_units,
          avg_deal_size:       raw.get_my_average_deal_size?.data?.[0]?.my_avg_deal_size,
          monthly_revenue:     raw.get_my_monthly_revenue?.data?.[0],
          top_products:        raw.get_my_top_products?.data,
          recent_transactions: raw.get_my_recent_transactions?.data,
          // FIX v3: added sales_trend — was present in old Dashboard, missing in v2
          sales_trend:         raw.get_my_sales_trend?.data,
          personal_info:       raw.get_my_personal_info?.data?.[0],
          warnings:            raw.get_my_total_sales_revenue?.warnings || [],
        };
        loadAiSource(label, aiData);
      } catch {
        // Fallback to basic stats endpoint
        try {
          const d2 = await salesRepository.getMyStats(user.id);
          loadAiSource(label, d2);
        } catch { /* silently ignore */ }
      }
    },
    [user, freeChat.loadedSources, loadAiSource, unloadAiSource]
  );

  // ── Personal data loader: Finance ──────────────────────────────────────────
  const handleLoadFinancePersonal = useCallback(
    async (label) => {
      if (freeChat.loadedSources.some((s) => s.label === label)) {
        unloadAiSource(label);
        return;
      }
      try {
        const d = await financeRepository.getMyExpenses(user.id);
        loadAiSource(label, d);
      } catch { /* silently ignore */ }
    },
    [user, freeChat.loadedSources, loadAiSource, unloadAiSource]
  );

  // ── Personal data loader: PR Campaigns ────────────────────────────────────
  // FIX v3: This entire loader was missing from v2. The old Dashboard had it.
  const handleLoadPRPersonal = useCallback(
    async (label) => {
      if (freeChat.loadedSources.some((s) => s.label === label)) {
        unloadAiSource(label);
        return;
      }
      try {
        const d = await prRepository.getMyCampaigns(user.id);
        loadAiSource(label, d);
      } catch { /* silently ignore */ }
    },
    [user, freeChat.loadedSources, loadAiSource, unloadAiSource]
  );

  if (!user) return null;

  // ── Derived label constants for personal data sources ─────────────────────
  const salesLabel    = isAr ? 'أداء مبيعاتي'  : 'My Sales Performance';
  const financeLabel  = isAr ? 'مصروفاتي'       : 'My Expenses';
  const prLabel       = isAr ? 'حملاتي'          : 'My Campaigns';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display:   'flex',
        gap:       20,
        height:    'calc(100vh - 160px)',
        animation: 'fadeUp 0.3s ease',
      }}
    >

      {/* ── LEFT: Data source selector ────────────────────────────────────── */}
      <div
        className="scroll-area"
        style={{
          width:         210,
          flexShrink:    0,
          display:       'flex',
          flexDirection: 'column',
          gap:           10,
          overflowY:     'auto',
        }}
      >
        {/* Section label */}
        <div
          style={{
            fontSize:      9,
            fontWeight:    800,
            color:         'var(--txt3)',
            textTransform: 'uppercase',
            letterSpacing: '1.4px',
            display:       'flex',
            alignItems:    'center',
            gap:           5,
            paddingBottom: 6,
            borderBottom:  '1px solid var(--border)',
            flexShrink:    0,
          }}
        >
          <Icon d={IC.layers} size={10} color="var(--txt3)" />
          {isAr ? 'البيانات' : 'Sources'}
        </div>

        {/* ── Loaded source chips ─────────────────────────────────────────── */}
        {freeChat.loadedSources.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {freeChat.loadedSources.map((src) => (
              <div
                key={src.label}
                style={{
                  display:    'inline-flex',
                  alignItems: 'center',
                  gap:        4,
                  padding:    '3px 8px 3px 7px',
                  background: 'rgba(59,91,255,0.15)',
                  border:     '1px solid rgba(59,91,255,0.35)',
                  borderRadius: 999,
                  maxWidth:   '100%',
                }}
              >
                <div
                  style={{
                    width:        4,
                    height:       4,
                    borderRadius: '50%',
                    background:   '#7ca3ff',
                    flexShrink:   0,
                  }}
                />
                <span
                  style={{
                    fontSize:      10,
                    fontWeight:    700,
                    color:         '#7ca3ff',
                    overflow:      'hidden',
                    textOverflow:  'ellipsis',
                    whiteSpace:    'nowrap',
                    maxWidth:      120,
                    textTransform: 'capitalize',
                  }}
                >
                  {src.label}
                </span>
                <button
                  onClick={() => unloadAiSource(src.label)}
                  style={{
                    background: 'none',
                    border:     'none',
                    cursor:     'pointer',
                    padding:    0,
                    display:    'flex',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  <Icon d={IC.close} size={9} color="rgba(124,163,255,0.7)" />
                </button>
              </div>
            ))}
            <div
              style={{
                width:      '100%',
                height:     1,
                background: 'var(--border)',
                margin:     '4px 0',
              }}
            />
          </div>
        )}

        {/* ── Analytics metrics from dashboardData ───────────────────────── */}
        {metricsEntries.length > 0 && (
          <div>
            <div
              style={{
                fontSize:      9,
                fontWeight:    700,
                color:         'var(--txt3)',
                textTransform: 'uppercase',
                letterSpacing: '.8px',
                marginBottom:  5,
              }}
            >
              {isAr ? 'المؤشرات' : 'Metrics'}
            </div>
            {metricsEntries.map(([name, data]) => {
              const label    = name.replace(/get_|branch_|global_|finance_/g, '').replace(/_/g, ' ');
              const isLoaded = freeChat.loadedSources.some((s) => s.label === label);
              return (
                <div
                  key={name}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}
                >
                  <div
                    onClick={() => (isLoaded ? unloadAiSource(label) : loadAiSource(label, data))}
                    onMouseEnter={(e) => {
                      if (!isLoaded) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isLoaded
                        ? 'rgba(59,91,255,0.08)'
                        : 'transparent';
                    }}
                    style={{
                      display:    'flex',
                      alignItems: 'center',
                      gap:        7,
                      padding:    '5px 8px',
                      borderRadius: 7,
                      cursor:     'pointer',
                      flex:       1,
                      background: isLoaded ? 'rgba(59,91,255,0.08)' : 'transparent',
                      border:     `1px solid ${isLoaded ? 'rgba(59,91,255,0.25)' : 'transparent'}`,
                      transition: 'all .15s',
                    }}
                  >
                    <Icon
                      d={isLoaded ? IC.check : IC.chart}
                      size={11}
                      color={isLoaded ? '#7ca3ff' : 'var(--txt3)'}
                    />
                    <span
                      style={{
                        fontSize:      11,
                        fontWeight:    isLoaded ? 700 : 500,
                        color:         isLoaded ? '#7ca3ff' : 'var(--txt2)',
                        overflow:      'hidden',
                        textOverflow:  'ellipsis',
                        whiteSpace:    'nowrap',
                        flex:          1,
                        textTransform: 'capitalize',
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  {!isLoaded && (
                    <button
                      onClick={(e) => { e.stopPropagation(); compareAiSource(label, data); }}
                      title={isAr ? 'أضف للمقارنة' : 'Add to compare'}
                      style={{
                        width:          22,
                        height:         22,
                        borderRadius:   6,
                        border:         '1px solid rgba(124,163,255,0.25)',
                        background:     'rgba(59,91,255,0.08)',
                        color:          '#7ca3ff',
                        fontSize:       15,
                        fontWeight:     700,
                        cursor:         'pointer',
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'center',
                        flexShrink:     0,
                        lineHeight:     1,
                        padding:        0,
                      }}
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Personal data: Sales / Finance / PR ────────────────────────── */}
        {(isSales || isFinance || isPR) && (
          <div
            style={{
              marginTop:  10,
              borderTop:  '1px solid var(--border)',
              paddingTop: 10,
            }}
          >
            <div
              style={{
                fontSize:      9,
                fontWeight:    700,
                color:         'var(--txt3)',
                textTransform: 'uppercase',
                letterSpacing: '.8px',
                marginBottom:  5,
              }}
            >
              {isAr ? 'بياناتي الشخصية' : 'My Personal Data'}
            </div>

            {/* Sales */}
            {isSales && (() => {
              const isLoaded = freeChat.loadedSources.some((s) => s.label === salesLabel);
              return (
                <div
                  onClick={() => handleLoadSalesPersonal(salesLabel)}
                  style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        7,
                    padding:    '5px 8px',
                    borderRadius: 7,
                    cursor:     'pointer',
                    marginBottom: 2,
                    background: isLoaded ? 'rgba(59,91,255,0.08)' : 'transparent',
                    border:     `1px solid ${isLoaded ? 'rgba(59,91,255,0.25)' : 'transparent'}`,
                    transition: 'all .15s',
                  }}
                >
                  <Icon
                    d={isLoaded ? IC.check : IC.money}
                    size={11}
                    color={isLoaded ? '#7ca3ff' : 'var(--txt3)'}
                  />
                  <span
                    style={{
                      fontSize:   11,
                      fontWeight: 500,
                      color:      isLoaded ? '#7ca3ff' : 'var(--txt2)',
                      flex:       1,
                    }}
                  >
                    {isAr ? 'تحميل مبيعاتي' : 'Load My Sales'}
                  </span>
                </div>
              );
            })()}

            {/* Finance */}
            {isFinance && (() => {
              const isLoaded = freeChat.loadedSources.some((s) => s.label === financeLabel);
              return (
                <div
                  onClick={() => handleLoadFinancePersonal(financeLabel)}
                  style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        7,
                    padding:    '5px 8px',
                    borderRadius: 7,
                    cursor:     'pointer',
                    marginBottom: 2,
                    background: isLoaded ? 'rgba(59,91,255,0.08)' : 'transparent',
                    border:     `1px solid ${isLoaded ? 'rgba(59,91,255,0.25)' : 'transparent'}`,
                    transition: 'all .15s',
                  }}
                >
                  <Icon
                    d={isLoaded ? IC.check : IC.money}
                    size={11}
                    color={isLoaded ? '#7ca3ff' : 'var(--txt3)'}
                  />
                  <span
                    style={{
                      fontSize:   11,
                      fontWeight: 500,
                      color:      isLoaded ? '#7ca3ff' : 'var(--txt2)',
                      flex:       1,
                    }}
                  >
                    {isAr ? 'تحميل مصروفاتي' : 'Load My Expenses'}
                  </span>
                </div>
              );
            })()}

            {/* PR Campaigns — FIX v3: this block was entirely missing from v2 */}
            {isPR && (() => {
              const isLoaded = freeChat.loadedSources.some((s) => s.label === prLabel);
              return (
                <div
                  onClick={() => handleLoadPRPersonal(prLabel)}
                  style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        7,
                    padding:    '5px 8px',
                    borderRadius: 7,
                    cursor:     'pointer',
                    marginBottom: 2,
                    background: isLoaded ? 'rgba(59,91,255,0.08)' : 'transparent',
                    border:     `1px solid ${isLoaded ? 'rgba(59,91,255,0.25)' : 'transparent'}`,
                    transition: 'all .15s',
                  }}
                >
                  <Icon
                    d={isLoaded ? IC.check : IC.layers}
                    size={11}
                    color={isLoaded ? '#7ca3ff' : 'var(--txt3)'}
                  />
                  <span
                    style={{
                      fontSize:   11,
                      fontWeight: 500,
                      color:      isLoaded ? '#7ca3ff' : 'var(--txt2)',
                      flex:       1,
                    }}
                  >
                    {isAr ? 'تحميل حملاتي' : 'Load My Campaigns'}
                  </span>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Previous chat sessions ──────────────────────────────────────── */}
        {chatSessions.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                fontSize:      9,
                fontWeight:    700,
                color:         'var(--txt3)',
                textTransform: 'uppercase',
                letterSpacing: '.8px',
                marginBottom:  5,
              }}
            >
              {isAr ? 'المحادثات السابقة' : 'Previous Chats'}
            </div>
            {chatSessions.map((s) => (
              <div
                key={s.id}
                onClick={() =>
                  setFreeChat({
                    messages:      s.messages,
                    input:         '',
                    loading:       false,
                    loadedSources: s.loadedSources || [],
                    systemPrompt:  s.systemPrompt  || null,
                  })
                }
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  padding:        '5px 8px',
                  borderRadius:   7,
                  cursor:         'pointer',
                  marginBottom:   2,
                  border:         '1px solid transparent',
                  transition:     'all .15s',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize:     10,
                      fontWeight:   600,
                      color:        'var(--txt2)',
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                      maxWidth:     140,
                    }}
                  >
                    {s.sources?.join(', ') || (isAr ? 'بدون مصدر' : 'No source')}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--txt3)' }}>{s.date}</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const updated = chatSessions.filter((x) => x.id !== s.id);
                    setChatSessions(updated);
                    localStorage.setItem('aiChatSessions', JSON.stringify(updated));
                  }}
                  style={{
                    background: 'none',
                    border:     'none',
                    cursor:     'pointer',
                    color:      'var(--txt3)',
                    fontSize:   16,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {metricsEntries.length === 0 &&
          chatSessions.length  === 0 &&
          !isSales && !isFinance && !isPR && (
            <div
              style={{
                textAlign: 'center',
                padding:   '24px 8px',
                color:     'var(--txt3)',
                fontSize:  12,
              }}
            >
              {isAr ? 'لا توجد بيانات' : 'No data yet'}
            </div>
          )}
      </div>

      {/* ── RIGHT: Chat panel ──────────────────────────────────────────────── */}
      <div
        style={{
          flex:          1,
          display:       'flex',
          flexDirection: 'column',
          background:    'var(--surface)',
          border:        '1px solid var(--border)',
          borderRadius:  18,
          overflow:      'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding:      '14px 20px',
            borderBottom: '1px solid var(--border)',
            display:      'flex',
            alignItems:   'center',
            gap:          10,
            flexShrink:   0,
            background:   'linear-gradient(135deg,rgba(59,91,255,0.08),rgba(91,143,255,0.03))',
          }}
        >
          <div
            style={{
              width:          34,
              height:         34,
              borderRadius:   10,
              background:     'linear-gradient(135deg,#3b5bff,#5b8fff)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
            }}
          >
            <Icon d={IC.brain} size={16} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)' }}>
              {isAr ? 'المساعد الذكي' : 'AI Data Analyst'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
              {freeChat.loadedSources.length === 0
                ? isAr
                  ? 'لا توجد بيانات محمّلة — اختر من اليسار'
                  : 'No data loaded — pick sources from the left'
                : isAr
                  ? `${freeChat.loadedSources.length} مصدر محمّل`
                  : `${freeChat.loadedSources.length} source${freeChat.loadedSources.length > 1 ? 's' : ''} loaded`}
            </div>
          </div>

          {/* Online badge */}
          <span
            className="ai-badge"
            style={{
              background: 'rgba(16,185,129,0.1)',
              color:      '#34d399',
              border:     '1px solid rgba(16,185,129,0.2)',
            }}
          >
            <span
              style={{
                width:        5,
                height:       5,
                borderRadius: '50%',
                background:   '#34d399',
                display:      'inline-block',
              }}
            />{' '}
            {isAr ? 'مستشار ذكي' : 'AI Advisor'}
          </span>

          {/* Clear button — clears messages only, preserves loaded sources */}
          {freeChat.messages.length > 0 && (
            <button
              onClick={() =>
                setFreeChat((p) => ({
                  ...p,
                  messages: [],
                  input:    '',
                }))
              }
              style={{
                background:  'var(--surface2)',
                border:      '1px solid var(--border)',
                borderRadius: 8,
                padding:     '5px 10px',
                cursor:      'pointer',
                fontSize:    11,
                fontWeight:  700,
                color:       'var(--txt3)',
                display:     'flex',
                alignItems:  'center',
                gap:         5,
                fontFamily:  'inherit',
              }}
            >
              <Icon d={IC.trash} size={11} />
              {isAr ? 'مسح' : 'Clear'}
            </button>
          )}
        </div>

        {/* Messages */}
        <div
          id="ai-free-msgs"
          className="scroll-area"
          style={{
            flex:          1,
            overflowY:     'auto',
            padding:       '14px 18px',
            display:       'flex',
            flexDirection: 'column',
            gap:           10,
          }}
        >
          {/* Empty state */}
          {freeChat.messages.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding:   '60px 20px',
                color:     'var(--txt3)',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
              <div
                style={{
                  fontSize:     15,
                  fontWeight:   700,
                  color:        'var(--txt2)',
                  marginBottom: 8,
                }}
              >
                {isAr ? 'مرحباً! كيف يمكنني مساعدتك؟' : 'Hello! How can I help you?'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                {isAr
                  ? 'حمّل مصدراً من اليسار أو اسألني مباشرة.'
                  : 'Load a data source from the left panel or ask me directly.'}
              </div>
            </div>
          )}

          {/* Message bubbles
           *  FIX v3: added dir + textAlign + direction for proper RTL rendering.
           *  FIX v3: uses renderBold() so the AI can format **bold** and ### headers.
           */}
          {freeChat.messages.map((m, i) => (
            <div
              key={i}
              className={`ai-msg ${m.role === 'user' ? 'user' : 'ai'}`}
              dir={isAr ? 'rtl' : 'ltr'}
              style={{
                textAlign: isAr ? 'right' : 'left',
                direction: isAr ? 'rtl'   : 'ltr',
              }}
            >
              {m.content.split('\n').map((line, li, arr) => (
                <span
                  key={li}
                  style={{ display: 'inline-block', width: '100%', unicodeBidi: 'plaintext' }}
                >
                  {renderBold(line)}
                  {li < arr.length - 1 && <br />}
                </span>
              ))}
            </div>
          ))}

          {/* Thinking indicator */}
          {freeChat.loading && (
            <div className="ai-msg thinking">
              <div className="ai-dot" />
              <div className="ai-dot" style={{ animationDelay: '.2s' }} />
              <div className="ai-dot" style={{ animationDelay: '.4s' }} />
              <span style={{ marginLeft: 4 }}>
                {isAr ? 'يفكر...' : 'Thinking...'}
              </span>
            </div>
          )}
        </div>

        {/* Input row */}
        <div
          className="ai-input-row"
          style={{ padding: '14px 18px' }}
        >
          <textarea
            ref={chatInputRef}
            id="chat-input"
            className="ai-input"
            rows={2}
            autoFocus
            defaultValue=""
            onKeyDown={handleKeyDown}
            placeholder={
              isAr
                ? 'اكتب سؤالك هنا... (Enter للإرسال)'
                : 'Type your question... (Enter to send)'
            }
            style={{ opacity: freeChat.loading ? 0.6 : 1 }}
          />
          <button
            className="ai-send-btn"
            onClick={sendMessage}
            disabled={freeChat.loading}
          >
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}