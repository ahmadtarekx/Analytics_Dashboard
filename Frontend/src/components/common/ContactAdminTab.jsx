/**
 * ContactAdminTab.jsx — Shared Tab Component   [FINAL REFACTORED v2]
 *
 * Full "Contact Admin" experience for all non-IT employees.
 * Extracted from old Dashboard.jsx ~line 3738–4230 and refactored to:
 *   • Use itRepository.sendTicket()        instead of raw fetch('/api/it/send-ticket')
 *   • Use ticketRepository.getMyTickets()  instead of raw fetch('/api/tickets/my/:id')
 *   • Use ticketRepository.deleteMyTicket()instead of raw fetch DELETE '/api/tickets/:id/employee/:id'
 *   • Use hrRepository.submitLeaveRequest()instead of raw fetch('/api/hr/leave-request')
 *
 * ── Sub-tabs ────────────────────────────────────────────────────────────────
 *   Admin Support  — submit an IT support ticket via itRepository.sendTicket()
 *   Request Leave  — submit a leave request to the HR Manager via hrRepository
 *
 * ── Features ────────────────────────────────────────────────────────────────
 *   • Issue-type grid (6 types) with keyword validation
 *   • Anti-spam validator (unique character check)
 *   • Duplicate-ticket guard (blocks second pending ticket of same type)
 *   • Live description hint + real-time mismatch warning
 *   • Ticket preview card (mock ID, status, sender info)
 *   • "My Submitted Tickets" list with refresh + delete
 *   • Leave request form with per-type date rules and server-side submission
 *
 * ── RBAC guard ──────────────────────────────────────────────────────────────
 *   Rendered by Dashboard.jsx only when: activeTab === 'contact_admin' && !isIT
 *
 * ── Props ───────────────────────────────────────────────────────────────────
 *   tx  {object}   — translation strings forwarded from Dashboard
 *                    (used for labels that must match Dashboard-level i18n)
 *
 * ── Context (via useAuth) ────────────────────────────────────────────────────
 *   user, language
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth }        from '../../context/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import itRepository       from '../../api/itRepository';
import ticketRepository   from '../../api/ticketRepository';
import hrRepository       from '../../api/hrRepository';
import Icon, { IC, FastTextArea } from '../ui/Icon';

// ── Module-level constants ────────────────────────────────────────────────────

const ISSUE_TYPES = (language) => [
  { value: 'Hardware Issue', icon: IC.zap,      color: '#f97316', desc: language === 'ar' ? 'مشكلة في الأجهزة'      : 'Laptop, mouse, monitor, etc.'  },
  { value: 'Software Issue', icon: IC.terminal, color: '#06b6d4', desc: language === 'ar' ? 'مشكلة في البرامج'      : 'App crash, installation, etc.' },
  { value: 'Network Access', icon: IC.globe,    color: '#10b981', desc: language === 'ar' ? 'مشكلة في الشبكة'       : 'VPN, WiFi, connectivity'       },
  { value: 'Password Reset', icon: IC.shield,   color: '#8b5cf6', desc: language === 'ar' ? 'إعادة تعيين الباسورد' : 'Reset account password'        },
  { value: 'Account Setup',  icon: IC.user,     color: '#4f7cff', desc: language === 'ar' ? 'إعداد الحساب'          : 'New account, permissions'      },
  { value: 'Other',          icon: IC.ticket,   color: '#f59e0b', desc: language === 'ar' ? 'أخرى'                  : 'Any other Admin issue'         },
];

/**
 * ISSUE_KEYWORDS
 *
 * Per-type keyword lists.  The description must contain at least one keyword
 * from the selected type's list before the ticket can be submitted.
 * 'Other' has no restriction (empty array → always passes).
 */
const ISSUE_KEYWORDS = {
  'Hardware Issue': {
    keywords: [
      'laptop','computer','pc','keyboard','mouse','monitor','screen','printer','scanner',
      'cable','charger','battery','device','hardware','broken','damaged','not working',
      'wont turn','كمبيوتر','لابتوب','شاشة','طابعة','ماوس','كيبورد','جهاز','بطارية','شاحن',
    ],
    hint:   'hardware (e.g. laptop, monitor, keyboard, mouse, printer, cable…)',
    arHint: 'الأجهزة (مثلاً: لابتوب، شاشة، كيبورد، ماوس، طابعة، كابل…)',
  },
  'Software Issue': {
    keywords: [
      'software','app','application','program','install','crash','error','bug','update',
      'windows','office','excel','word','browser','system','freeze','slow','not opening',
      'not loading','برنامج','تطبيق','تثبيت','خطأ','تعطل','ويندوز','أوفيس','تحديث','بطيء',
    ],
    hint:   'software (e.g. app crash, installation error, Windows, Office…)',
    arHint: 'البرامج (مثلاً: تعطل التطبيق، خطأ تثبيت، ويندوز، أوفيس…)',
  },
  'Network Access': {
    keywords: [
      'network','wifi','wi-fi','internet','vpn','connection','connectivity','disconnect',
      'ip','dns','bandwidth','speed','router','switch','port','access',
      'شبكة','إنترنت','اتصال','انقطع','واي فاي','في بي إن','سرعة',
    ],
    hint:   'network (e.g. WiFi, VPN, internet connection, disconnection…)',
    arHint: 'الشبكة (مثلاً: واي فاي، VPN، انقطاع الإنترنت…)',
  },
  'Password Reset': {
    keywords: [
      'password','pass','login','sign in','forgot','locked','account','credential','reset',
      'log in','باسورد','كلمة مرور','تسجيل دخول','حساب','نسيت','مقفل','إعادة تعيين',
    ],
    hint:   'password or login (e.g. forgot password, locked account, unable to sign in…)',
    arHint: 'كلمة المرور أو تسجيل الدخول (مثلاً: نسيت الباسورد، الحساب مقفل…)',
  },
  'Account Setup': {
    keywords: [
      'account','setup','create','new user','permission','access','role','profile',
      'register','onboard','حساب','صلاحية','إنشاء','مستخدم','جديد','وصول','بروفايل',
    ],
    hint:   'account setup (e.g. new account, permissions, user profile…)',
    arHint: 'إعداد الحساب (مثلاً: حساب جديد، صلاحيات، بروفايل…)',
  },
  'Other': { keywords: [], hint: '', arHint: '' },
};

/** Live hints shown beneath the textarea while the user types. */
const LIVE_HINTS = (language) => ({
  'Hardware Issue': language === 'ar'
    ? '💡 اذكر الجهاز المتأثر — مثلاً: لابتوب، شاشة، كيبورد، ماوس، طابعة، شاحن...'
    : '💡 Mention the affected device — e.g. laptop, monitor, keyboard, mouse, printer, charger…',
  'Software Issue': language === 'ar'
    ? '💡 اذكر البرنامج أو التطبيق — مثلاً: أوفيس، ويندوز، متصفح، برنامج معين...'
    : '💡 Mention the software or app — e.g. Office, Windows, browser, specific program…',
  'Network Access': language === 'ar'
    ? '💡 اذكر نوع مشكلة الاتصال — مثلاً: واي فاي، VPN، إنترنت، انقطاع الاتصال...'
    : '💡 Mention the connectivity issue — e.g. WiFi, VPN, internet, disconnection…',
  'Password Reset': language === 'ar'
    ? '💡 اذكر مشكلة الدخول — مثلاً: نسيت الباسورد، الحساب مقفل، لا أستطيع تسجيل الدخول...'
    : '💡 Mention the login issue — e.g. forgot password, account locked, unable to sign in…',
  'Account Setup': language === 'ar'
    ? '💡 اذكر ما يخص الحساب — مثلاً: حساب جديد، صلاحيات، إضافة مستخدم...'
    : '💡 Mention account details — e.g. new account, permissions, user access…',
});

const LEAVE_TYPES = ['Annual', 'Sick', 'Emergency', 'Unpaid', 'Maternity/Paternity'];

// Status badge color map for the submitted-tickets list
const TYPE_COLORS = {
  Urgent:      { c: '#ef4444', bg: 'rgba(239,68,68,0.1)',  b: 'rgba(239,68,68,0.28)'  },
  Technical:   { c: '#06b6d4', bg: 'rgba(6,182,212,0.1)', b: 'rgba(6,182,212,0.28)'  },
  Inquiry:     { c: '#f59e0b', bg: 'rgba(245,158,11,0.1)', b: 'rgba(245,158,11,0.28)' },
  Billing:     { c: '#ec4899', bg: 'rgba(236,72,153,0.1)', b: 'rgba(236,72,153,0.28)' },
  Maintenance: { c: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', b: 'rgba(139,92,246,0.28)' },
  Support:     { c: '#10b981', bg: 'rgba(16,185,129,0.1)', b: 'rgba(16,185,129,0.28)' },
};

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Parse a YYYY-MM-DD string as local midnight (avoids UTC-offset day-shift). */
function parseLocal(s) {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

/** Return today at midnight (local time). */
function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Format a Date to YYYY-MM-DD for <input type="date">. */
function fmt(d) {
  return d.toISOString().split('T')[0];
}

/**
 * buildLeaveRules
 *
 * Returns per-type date constraint objects.  Called on every render so
 * the min/max dates always reflect the actual current date.
 */
function buildLeaveRules() {
  const today    = todayMidnight();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const plus1    = new Date(today); plus1.setDate(plus1.getDate() + 1);
  const plus7    = new Date(today); plus7.setDate(plus7.getDate() + 7);
  return {
    'Emergency':           { minStart: fmt(today),   maxStart: fmt(tomorrow), hint: 'Emergency leave can only start today or tomorrow.' },
    'Sick':                { minStart: fmt(today),   maxStart: null,          hint: 'Sick leave must start from today onwards.' },
    'Annual':              { minStart: fmt(plus1),   maxStart: null,          hint: 'Annual leave requires at least 1 day advance notice.' },
    'Unpaid':              { minStart: fmt(plus1),   maxStart: null,          hint: 'Unpaid leave requires at least 1 day advance notice.' },
    'Maternity/Paternity': { minStart: fmt(plus7),   maxStart: null,          hint: 'Maternity/Paternity leave requires at least 7 days advance notice.' },
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContactAdminTab() {
  const { user, language } = useAuth();
  const tx  = useTranslation(language);
  const isAr = language === 'ar';

  // ── Sub-tab ───────────────────────────────────────────────────────────────
  const [activeSubTab, setActiveSubTab] = useState('it'); // 'it' | 'leave'

  // ── Admin-support (IT ticket) state ──────────────────────────────────────
  const [contactType,         setContactType]         = useState('Hardware Issue');
  const [contactDesc,         setContactDesc]         = useState('');
  const [previewDesc,         setPreviewDesc]         = useState('');
  const [contactStatus,       setContactStatus]       = useState(null); // { type, msg } | null
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);
  const contactDescRef         = useRef(null);
  const contactDescDebounceRef = useRef(null);

  // ── My submitted tickets ──────────────────────────────────────────────────
  const [myTickets,        setMyTickets]        = useState([]);
  const [myTicketsLoading, setMyTicketsLoading] = useState(false);
  const [myTicketsError,   setMyTicketsError]   = useState(null);
  const [deletingTicket,   setDeletingTicket]   = useState(null); // ticket_id

  // ── Leave request state ───────────────────────────────────────────────────
  const [leaveType,    setLeaveType]    = useState('Annual');
  const [leaveStart,   setLeaveStart]   = useState('');
  const [leaveEnd,     setLeaveEnd]     = useState('');
  const [leaveReason,  setLeaveReason]  = useState('');
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveStatus,  setLeaveStatus]  = useState(null); // { type, msg } | null

  // ── Load my tickets (ticketRepository.getMyTickets) ──────────────────────
  const loadMyTickets = useCallback(async () => {
    if (!user?.id) return;
    setMyTicketsLoading(true);
    setMyTicketsError(null);
    try {
      const data = await ticketRepository.getMyTickets(user.id);
      setMyTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      setMyTicketsError(err.message || 'Failed to load tickets.');
    }
    setMyTicketsLoading(false);
  }, [user]);

  useEffect(() => { loadMyTickets(); }, [loadMyTickets]);

  // ── Delete one of my tickets (ticketRepository.deleteMyTicket) ────────────
  const deleteMyTicket = useCallback(async (ticketId) => {
    setDeletingTicket(ticketId);
    try {
      await ticketRepository.deleteMyTicket(ticketId, user.id);
      setMyTickets(prev => prev.filter(t => t.ticket_id !== ticketId));
    } catch (err) {
      alert(err.message || 'Failed to delete ticket.');
    }
    setDeletingTicket(null);
  }, [user]);

  // ── Submit IT support ticket (itRepository.sendTicket) ───────────────────
  const handleContactIT = useCallback(async (e) => {
    e.preventDefault();
    setIsContactSubmitting(true);
    setContactStatus(null);

    const descVal = contactDescRef.current?.value?.trim() || contactDesc.trim();

    // Anti-spam: reject descriptions with fewer than 4 unique non-space characters
    const uniqueChars = new Set(descVal.replace(/\s/g, '').toLowerCase());
    if (uniqueChars.size < 4) {
      setContactStatus({
        type: 'error',
        msg: isAr
          ? '⚠️ الوصف يبدو عشوائياً. يرجى كتابة وصف حقيقي للمشكلة.'
          : '⚠️ Description appears to contain random characters. Please describe your actual issue.',
      });
      setIsContactSubmitting(false);
      return;
    }

    // Duplicate-ticket guard: block a second pending ticket of the same type
    const pendingDupe = myTickets.find(
      t => t.status === 'Pending' && t.type?.toLowerCase() === contactType.toLowerCase()
    );
    if (pendingDupe) {
      setContactStatus({
        type: 'error',
        msg: isAr
          ? `⚠️ لديك بالفعل طلب "${contactType}" قيد الانتظار (رقم #${pendingDupe.ticket_id}). يرجى انتظار الرد أولاً.`
          : `⚠️ You already have a pending "${contactType}" ticket (Ticket #${pendingDupe.ticket_id}). Please wait for a response first.`,
      });
      setIsContactSubmitting(false);
      return;
    }

    // Issue-type keyword restriction
    const rule = ISSUE_KEYWORDS[contactType];
    if (rule && rule.keywords.length > 0) {
      const lower      = descVal.toLowerCase();
      const hasKeyword = rule.keywords.some(k => lower.includes(k));
      if (!hasKeyword) {
        setContactStatus({
          type: 'error',
          msg: isAr
            ? `⚠️ وصف المشكلة لا يتطابق مع نوع الطلب "${contactType}". يرجى وصف مشكلة تتعلق بـ ${rule.arHint}.`
            : `⚠️ Your description doesn't match the selected issue type "${contactType}". Please describe a ${rule.hint} issue.`,
        });
        setIsContactSubmitting(false);
        return;
      }
    }

    try {
      await itRepository.sendTicket({
        target_emp_id: user.id,
        ticket_type:   contactType,
        description:   `[From: ${user.name} | Dept: ${user.department_name}]\n\n${descVal}`,
        test_mode:     true,
      });

      setContactStatus({
        type: 'success',
        msg: isAr
          ? 'تم إرسال طلبك لفريق الدعم بنجاح! سيتواصل معك فريق الإدارة قريباً.'
          : 'Your request was sent to the Admin team successfully! They will reach out to you soon.',
      });
      setContactDesc('');
      setPreviewDesc('');
      if (contactDescRef.current) contactDescRef.current.value = '';
      loadMyTickets(); // Refresh so the new ticket appears immediately
    } catch (err) {
      setContactStatus({ type: 'error', msg: err.message || 'Network error submitting request.' });
    }
    setIsContactSubmitting(false);
  }, [contactType, contactDesc, myTickets, user, isAr, loadMyTickets]);

  // ── Submit leave request (hrRepository.submitLeaveRequest) ───────────────
  const submitLeaveHR = useCallback(async () => {
    if (!leaveStart || !leaveEnd || !leaveReason.trim()) return;

    const today   = todayMidnight();
    const startDt = parseLocal(leaveStart);
    const diff    = Math.round((startDt - today) / (1000 * 60 * 60 * 24));

    if (leaveType === 'Sick'       && diff < 0)              { setLeaveStatus({ type: 'error', msg: 'Sick leave must start from today onwards.' }); return; }
    if (leaveType === 'Emergency'  && (diff < 0 || diff > 1)){ setLeaveStatus({ type: 'error', msg: 'Emergency leave can only start today or tomorrow.' }); return; }
    if (['Annual','Unpaid'].includes(leaveType) && diff < 1) { setLeaveStatus({ type: 'error', msg: `${leaveType} leave requires at least 1 day advance notice.` }); return; }
    if (leaveType === 'Maternity/Paternity' && diff < 7)     { setLeaveStatus({ type: 'error', msg: 'Maternity/Paternity leave requires at least 7 days advance notice.' }); return; }

    setLeaveLoading(true);
    setLeaveStatus(null);
    try {
      const d = await hrRepository.submitLeaveRequest({
        emp_id:     user.id,
        emp_name:   user.name,
        start_date: leaveStart,
        end_date:   leaveEnd,
        reason:     leaveReason,
        leave_type: leaveType,
      });
      setLeaveStatus({ type: 'success', msg: d.message });
      setLeaveStart('');
      setLeaveEnd('');
      setLeaveReason('');
    } catch (err) {
      setLeaveStatus({
        type: 'error',
        msg: err.message || 'Cannot connect to server. Make sure the backend is running.',
      });
    }
    setLeaveLoading(false);
  }, [leaveType, leaveStart, leaveEnd, leaveReason, user]);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!user) return null;

  const issueTypes  = ISSUE_TYPES(language);
  const liveHints   = LIVE_HINTS(language);
  const leaveRules  = buildLeaveRules();
  const mockId      = `REQ-${String(user.id).padStart(3, '0')}-${Date.now().toString().slice(-4)}`;

  // Leave date validation for the submit button
  const leaveRule = leaveRules[leaveType] || {};
  const dateError = (() => {
    if (!leaveStart || !leaveEnd)                              return 'Please select both start and end dates.';
    if (new Date(leaveEnd) < new Date(leaveStart))             return 'End date cannot be before start date.';
    if (leaveRule.minStart && leaveStart < leaveRule.minStart) return leaveRule.hint;
    if (leaveRule.maxStart && leaveStart > leaveRule.maxStart) return leaveRule.hint;
    return null;
  })();
  const canSubmitLeave = !leaveLoading && !dateError && leaveReason.trim();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.4px' }}>
          {isAr ? 'تواصل مع الإدارة' : 'Contact Admin'}
        </h1>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
          {isAr
            ? 'تواصل مع الإدارة أو قدّم طلب إجازة لمدير الموارد البشرية.'
            : 'Submit an Admin support request or a leave request to HR.'}
        </div>
        <div style={{ height: 3, width: 44, background: 'linear-gradient(90deg,var(--accent),var(--accent2))', borderRadius: 2, marginTop: 7 }} />
      </div>

      {/* ── Sub-tab nav ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {[
          { id: 'it',    label: isAr ? 'دعم الإدارة' : 'Admin Support', icon: IC.headset  },
          { id: 'leave', label: isAr ? 'طلب إجازة'  : 'Request Leave',  icon: IC.calendar },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveSubTab(t.id); setLeaveStatus(null); setContactStatus(null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 10,
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, transition: 'all .2s',
              background: activeSubTab === t.id ? 'rgba(79,124,255,0.12)' : 'transparent',
              border: '1.5px solid ' + (activeSubTab === t.id ? 'rgba(79,124,255,0.4)' : 'transparent'),
              color: activeSubTab === t.id ? 'var(--accent2)' : 'var(--txt3)',
            }}
          >
            <Icon d={t.icon} size={14} color={activeSubTab === t.id ? 'var(--accent2)' : 'var(--txt3)'} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SUB-TAB: ADMIN SUPPORT
      ══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'it' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

            {/* ── LEFT: Request form ──────────────────────────────────────── */}
            <div className="ticket-card">
              <div style={{ height: 4, background: 'linear-gradient(90deg,#4f7cff,#7ca3ff)', transition: 'background .3s' }} />
              <div style={{ padding: '22px 24px' }}>

                {/* Status banner */}
                {contactStatus && (
                  <div style={{
                    padding: '14px 18px', borderRadius: 11, fontSize: 14, fontWeight: 600, marginBottom: 18,
                    background: contactStatus.type === 'error' ? 'rgba(239,68,68,0.1)'  : 'rgba(16,185,129,0.08)',
                    color:      contactStatus.type === 'error' ? '#ef4444'              : '#10b981',
                    border: `1px solid ${contactStatus.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)'}`,
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                  }}>
                    <Icon d={contactStatus.type === 'error' ? IC.warn : IC.check} size={16} color={contactStatus.type === 'error' ? '#ef4444' : '#10b981'} />
                    {contactStatus.msg}
                  </div>
                )}

                {/* Issue type grid */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 10 }}>
                    {tx?.contactType ?? (isAr ? 'نوع المشكلة' : 'Issue Type')}
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
                    {issueTypes.map(t => (
                      <div
                        key={t.value}
                        onClick={() => setContactType(t.value)}
                        style={{
                          padding: '12px 10px', borderRadius: 12, cursor: 'pointer', transition: 'all .18s', textAlign: 'center',
                          background: contactType === t.value ? `${t.color}15` : 'var(--surface2)',
                          border: `1.5px solid ${contactType === t.value ? t.color + '55' : 'var(--border)'}`,
                          transform: contactType === t.value ? 'scale(1.02)' : 'scale(1)',
                        }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${t.color}18`, border: `1px solid ${t.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 7px' }}>
                          <Icon d={t.icon} size={13} color={contactType === t.value ? t.color : 'var(--txt3)'} />
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: contactType === t.value ? 'var(--txt)' : 'var(--txt2)' }}>{t.value}</div>
                        <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 2, lineHeight: 1.3 }}>{t.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Description textarea */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    {tx?.contactDesc ?? (isAr ? 'وصف المشكلة' : 'Description')}
                  </label>
                  <textarea
                    ref={contactDescRef}
                    className="it-input"
                    rows="5"
                    style={{ resize: 'vertical', marginTop: 8, width: '100%', boxSizing: 'border-box' }}
                    placeholder={isAr
                      ? 'اشرح المشكلة بالتفصيل، متى بدأت، وأي خطوات جربتها...'
                      : "Describe your issue in detail, when it started, and any steps you've already tried..."}
                    defaultValue=""
                    onChange={e => {
                      const val = e.target.value;
                      clearTimeout(contactDescDebounceRef.current);
                      contactDescDebounceRef.current = setTimeout(() => {
                        setContactDesc(val);
                        setPreviewDesc(val);
                      }, 300);
                    }}
                    onBlur={e => {
                      clearTimeout(contactDescDebounceRef.current);
                      setContactDesc(e.target.value);
                      setPreviewDesc(e.target.value);
                    }}
                  />

                  {/* Live hint / mismatch warning */}
                  {(() => {
                    const hint     = liveHints[contactType];
                    if (!hint) return null;
                    const kwRule   = ISSUE_KEYWORDS[contactType];
                    const keywords = kwRule?.keywords || [];
                    const current  = contactDesc.toLowerCase();
                    const hasMismatch = current.length > 20 && keywords.length > 0 && !keywords.some(k => current.includes(k));
                    if (hasMismatch) {
                      return (
                        <div style={{ fontSize: 11, color: '#f87171', marginTop: 5, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                          <span>⚠️</span>
                          <span>
                            {isAr
                              ? `وصفك لا يتطابق مع "${contactType}". ${hint.replace('💡 ', '')}`
                              : `Description doesn't match "${contactType}". ${hint.replace('💡 ', '')}`}
                          </span>
                        </div>
                      );
                    }
                    return <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 5 }}>{hint}</div>;
                  })()}
                </div>

                {/* Submit button */}
                <button
                  onClick={handleContactIT}
                  className="it-btn"
                  disabled={isContactSubmitting || !(contactDescRef.current?.value?.trim() || contactDesc.trim())}
                  style={{ width: '100%', marginTop: 0, padding: '13px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {isContactSubmitting ? (
                    <><span className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />{isAr ? 'جاري الإرسال...' : 'Sending...'}</>
                  ) : (
                    <><Icon d={IC.mail} size={15} />{tx?.sendRequest ?? (isAr ? 'إرسال الطلب' : 'Send Request')}</>
                  )}
                </button>
              </div>
            </div>

            {/* ── RIGHT: Ticket preview ─────────────────────────────────── */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
                📋 {tx?.preview ?? 'Preview'}
              </div>
              <div className="ticket-card">
                <div style={{ height: 5, background: 'linear-gradient(90deg,#4f7cff,#7ca3ff)' }} />
                <div style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>{mockId}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)' }}>{contactType}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: tx?.submittedBy ?? 'Submitted By', value: user.name },
                      { label: tx?.dept        ?? 'Department',   value: user.department_name || (tx?.unspecified ?? 'N/A') },
                      { label: 'Branch',                          value: user.primary_branch  || (tx?.unspecified ?? 'N/A') },
                      { label: 'Status',                          value: '⏳ Pending' },
                    ].map((r, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>{r.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--txt)', fontWeight: 600 }}>{r.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: 'var(--surface2)', borderRadius: 9, padding: '10px 12px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>Description</div>
                    <div style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 100, overflow: 'hidden', color: previewDesc ? 'var(--txt2)' : 'var(--txt3)', fontStyle: previewDesc ? 'normal' : 'italic' }}>
                      {previewDesc || (isAr ? 'لم تكتب أي تفاصيل بعد...' : 'No description yet...')}
                    </div>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'rgba(79,124,255,0.07)', borderRadius: 8, border: '1px solid rgba(79,124,255,0.15)' }}>
                    <Icon d={IC.mail} size={11} color="var(--accent2)" />
                    <span style={{ fontSize: 10, color: 'var(--accent2)', fontWeight: 600 }}>
                      {isAr ? 'سيُرسل إلى:' : 'Will be sent to:'} it.entreprisex@gmail.com
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── My submitted tickets ──────────────────────────────────────── */}
          <div style={{ marginTop: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.3px' }}>
                  {isAr ? 'تذاكري المُرسَلة' : 'My Submitted Tickets'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 3 }}>
                  {isAr ? 'انقر على أيقونة الحذف لإزالة تذكرة أرسلتها.' : 'Click the trash icon to delete a ticket you submitted.'}
                </div>
              </div>
              <button
                onClick={loadMyTickets}
                disabled={myTicketsLoading}
                style={{ padding: '7px 14px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {myTicketsLoading ? <span className="spinner" style={{ width: 11, height: 11 }} /> : '↻'} {isAr ? 'تحديث' : 'Refresh'}
              </button>
            </div>

            {myTicketsError && (
              <div style={{ padding: '11px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 13, marginBottom: 14 }}>
                {myTicketsError}
              </div>
            )}

            {myTicketsLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />)}
              </div>
            )}

            {!myTicketsLoading && !myTicketsError && myTickets.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--txt3)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{isAr ? 'لا توجد تذاكر بعد' : 'No tickets yet'}</div>
                <div style={{ fontSize: 12 }}>{isAr ? 'التذاكر التي ترسلها ستظهر هنا.' : 'Tickets you send to Admin will appear here.'}</div>
              </div>
            )}

            {!myTicketsLoading && myTickets.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myTickets.map((t, i) => {
                  const tc         = TYPE_COLORS[t.type] || { c: '#94a3b8', bg: 'rgba(148,163,184,0.1)', b: 'rgba(148,163,184,0.25)' };
                  const isDeleting = deletingTicket === t.ticket_id;
                  const hasReply   = t.status === 'Replied';
                  return (
                    <div
                      key={t.ticket_id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '13px 18px', borderRadius: 12,
                        background: 'var(--surface)',
                        border: `1px solid ${hasReply ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`,
                        animationDelay: `${i * 0.03}s`,
                        opacity: isDeleting ? 0.5 : 1, transition: 'opacity .2s',
                      }}
                    >
                      <div style={{ width: 3, height: 44, borderRadius: 3, background: hasReply ? '#10b981' : tc.c, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', letterSpacing: '1px' }}>#{t.ticket_id}</span>
                          <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: tc.bg, color: tc.c, border: `1px solid ${tc.b}` }}>{t.type}</span>
                          {hasReply
                            ? <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.28)' }}>✓ Replied</span>
                            : <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>⏳ Pending</span>
                          }
                          <span style={{ fontSize: 11, color: 'var(--txt3)', marginLeft: 'auto' }}>
                            {new Date(t.time).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {t.cleanDescription && (
                          <div style={{ fontSize: 12, color: 'var(--txt3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                            {t.cleanDescription}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => { if (window.confirm(`Delete ticket #${t.ticket_id}? This cannot be undone.`)) deleteMyTicket(t.ticket_id); }}
                        disabled={isDeleting}
                        title="Delete this ticket"
                        style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all .18s' }}
                      >
                        {isDeleting
                          ? <span className="spinner" style={{ width: 12, height: 12, borderColor: 'rgba(239,68,68,0.3)', borderTopColor: '#ef4444' }} />
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                        }
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SUB-TAB: LEAVE REQUEST
      ══════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'leave' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

          {/* ── LEFT: Leave form ──────────────────────────────────────────── */}
          <div className="ticket-card">
            <div style={{ height: 4, background: 'linear-gradient(90deg,#5b8fff,#a78bfa)' }} />
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon d={IC.calendar} size={15} color="var(--accent2)" />
                {isAr ? 'طلب إجازة' : 'Leave Request'}
              </div>

              {/* Status banner */}
              {leaveStatus && (
                <div style={{
                  padding: '10px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: leaveStatus.type === 'error' ? 'rgba(239,68,68,0.08)'  : 'rgba(16,185,129,0.08)',
                  color:      leaveStatus.type === 'error' ? '#ef4444'              : '#10b981',
                  border: '1px solid ' + (leaveStatus.type === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.22)'),
                }}>
                  <Icon d={leaveStatus.type === 'error' ? IC.warn : IC.check} size={13} />
                  {leaveStatus.msg}
                </div>
              )}

              {/* Leave type selector */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {isAr ? 'نوع الإجازة' : 'Leave Type'}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {LEAVE_TYPES.map(t => (
                    <button
                      key={t}
                      onClick={() => { setLeaveType(t); setLeaveStart(''); setLeaveEnd(''); setLeaveStatus(null); }}
                      style={{
                        padding: '7px 14px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                        fontWeight: 700, fontSize: 12, transition: 'all .18s',
                        background: leaveType === t ? 'rgba(79,124,255,0.15)' : 'var(--surface2)',
                        border: '1.5px solid ' + (leaveType === t ? 'rgba(79,124,255,0.5)' : 'var(--border)'),
                        color: leaveType === t ? 'var(--accent2)' : 'var(--txt3)',
                      }}
                    >{t}</button>
                  ))}
                </div>
                {leaveRule.hint && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Icon d={IC.warn} size={11} color="#f59e0b" /> {leaveRule.hint}
                  </div>
                )}
              </div>

              {/* Date pickers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    {isAr ? 'تاريخ البداية' : 'Start Date'}
                  </label>
                  <input
                    type="date"
                    value={leaveStart}
                    min={leaveRule.minStart || fmt(todayMidnight())}
                    max={leaveRule.maxStart || undefined}
                    onChange={e => {
                      const val        = e.target.value;
                      const minAllowed = leaveRule.minStart || fmt(todayMidnight());
                      const maxAllowed = leaveRule.maxStart;
                      if (val < minAllowed)               { setLeaveStart(minAllowed); return; }
                      if (maxAllowed && val > maxAllowed) { setLeaveStart(maxAllowed); return; }
                      setLeaveStart(val);
                      if (leaveEnd && val > leaveEnd) setLeaveEnd('');
                    }}
                    className="it-input"
                    style={{ marginTop: 6 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    {isAr ? 'تاريخ النهاية' : 'End Date'}
                  </label>
                  <input
                    type="date"
                    value={leaveEnd}
                    min={leaveStart || leaveRule.minStart || fmt(todayMidnight())}
                    onChange={e => setLeaveEnd(e.target.value)}
                    className="it-input"
                    style={{ marginTop: 6 }}
                  />
                </div>
              </div>

              {/* Date validation feedback */}
              {dateError && leaveStart && leaveEnd && (
                <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon d={IC.warn} size={12} color="#ef4444" /> {dateError}
                </div>
              )}

              {/* Reason textarea */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {isAr ? 'السبب' : 'Reason'}
                </label>
                <FastTextArea
                  value={leaveReason}
                  onChange={v => setLeaveReason(v)}
                  className="it-input"
                  rows="3"
                  style={{ resize: 'vertical', marginTop: 6 }}
                  placeholder={isAr ? 'سبب الإجازة (مطلوب)...' : 'Reason for leave (required)...'}
                />
              </div>

              <button
                onClick={submitLeaveHR}
                disabled={!canSubmitLeave}
                className="it-btn"
                style={{ marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: canSubmitLeave ? 1 : 0.5 }}
              >
                {leaveLoading
                  ? <><span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,.3)', borderTopColor: '#fff' }} />{isAr ? 'جاري الإرسال...' : 'Submitting...'}</>
                  : <><Icon d={IC.calendar} size={14} />{isAr ? 'إرسال طلب الإجازة' : 'Submit Leave Request'}</>
                }
              </button>
            </div>
          </div>

          {/* ── RIGHT: Info sidebar ───────────────────────────────────────── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
              {isAr ? 'كيف يعمل' : 'How it works'}
            </div>
            {[
              { icon: IC.calendar, color: '#5b8fff', text: isAr ? 'اختر نوع الإجازة والتواريخ وأدخل السبب.' : 'Select leave type, dates, and provide a reason.' },
              { icon: IC.shield,   color: '#f59e0b', text: isAr ? 'يُرسَل الطلب مباشرة لمدير الموارد البشرية.' : 'Your request goes directly to the HR Manager for review.' },
              { icon: IC.check,    color: '#10b981', text: isAr ? 'عند الموافقة يُحفظ الطلب في قاعدة البيانات.' : 'When approved, the leave is saved to the database.' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < 2 ? 12 : 0 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: s.color + '18', border: '1px solid ' + s.color + '28', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon d={s.icon} size={12} color={s.color} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.5 }}>{s.text}</div>
              </div>
            ))}

            {/* Date rules reference table */}
            <div style={{ marginTop: 16, padding: '10px 12px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 9 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                {isAr ? 'قواعد التواريخ' : 'Date Rules'}
              </div>
              {Object.entries(leaveRules).map(([t, r]) => (
                <div key={t} style={{ fontSize: 11, color: 'var(--txt2)', marginBottom: 5, display: 'flex', gap: 5 }}>
                  <span style={{ fontWeight: 700, color: leaveType === t ? 'var(--accent2)' : 'var(--txt3)', minWidth: 90, flexShrink: 0 }}>{t}:</span>
                  <span>{r.hint}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
