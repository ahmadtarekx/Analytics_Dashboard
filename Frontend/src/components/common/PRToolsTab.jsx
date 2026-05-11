/**
 * PRToolsTab.jsx — Department Tab Component
 *
 * Self-contained UI for the Public Relations department (dept 4).
 * Owns ALL PR-specific state and API calls. No external context required.
 *
 * ── RBAC ────────────────────────────────────────────────────────────────────
 *   PR Employee  (role='emp'):          New Campaign | Press Release | My Submissions
 *   PR Manager   (role='dep_manager'):  Campaign Approvals | Press Releases (review)
 *
 * ── Dependencies ────────────────────────────────────────────────────────────
 *   useAuth()      — user, language, isPRManager  (no useDashboard / no DashboardContext)
 *   prRepository   — all API calls via Repository Pattern
 *   useTranslation — i18n strings
 *
 * ── Sub-tab keys ────────────────────────────────────────────────────────────
 *   'campaigns' — New Campaign form (emp) | Campaign Approvals queue (manager)
 *   'press'     — Press Release draft form (emp) | Press Release review (manager)
 *   'my'        — My Submissions history (emp only)
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth }        from '../../context/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import prRepository       from '../../api/prRepository';
import Icon, { IC, FastInput, FastTextArea } from '../../components/ui/Icon';

// ── Constants ────────────────────────────────────────────────────────────────

const CAMP_TYPES = ['Social Media', 'Email', 'Event', 'Influencer', 'Ad Campaign', 'Press'];
const PLATFORMS  = ['Instagram', 'Facebook', 'Twitter/X', 'LinkedIn', 'TikTok', 'YouTube', 'Multi-channel', 'Other'];

const CAMP_COLOR = {
  'Social Media': '#4f7cff',
  'Email':        '#10b981',
  'Event':        '#f59e0b',
  'Influencer':   '#ec4899',
  'Ad Campaign':  '#8b5cf6',
  'Press':        '#06b6d4',
};

const fmtDate = (s) => {
  try {
    return new Date(s).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return s; }
};

// ── Local shared UI helpers ───────────────────────────────────────────────────

const SectionHead = ({ title, subtitle }) => (
  <div style={{ marginBottom: 24 }}>
    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.4px' }}>{title}</h1>
    <div style={{ height: 3, width: 44, background: 'linear-gradient(90deg,var(--accent),var(--accent2))', borderRadius: 2, marginTop: 7 }} />
    {subtitle && (
      <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 10 }}>{subtitle}</div>
    )}
  </div>
);

const StatusBanner = ({ status }) => {
  if (!status) return null;
  const isErr = status.type === 'error';
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: 8,
      background: isErr ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
      color:      isErr ? '#ef4444'              : '#10b981',
      border:     `1px solid ${isErr ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.22)'}`,
    }}>
      <Icon d={isErr ? IC.warn : IC.check} size={13} />
      {status.msg}
    </div>
  );
};

const SubTabNav = ({ tabs, active, onChange }) => (
  <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
    {tabs.map(t => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
          fontFamily: 'inherit', fontWeight: 700, fontSize: 13, transition: 'all .2s',
          background: active === t.id ? 'rgba(79,124,255,0.12)' : 'transparent',
          border:     `1.5px solid ${active === t.id ? 'rgba(79,124,255,0.4)' : 'transparent'}`,
          color:      active === t.id ? 'var(--accent2)' : 'var(--txt3)',
        }}
      >
        <Icon d={t.icon} size={13} color={active === t.id ? 'var(--accent2)' : 'var(--txt3)'} />
        {t.label}
        {t.badge > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 800,
            background: 'rgba(239,68,68,0.2)', color: '#fca5a5',
            border: '1px solid rgba(239,68,68,0.3)',
            padding: '1px 7px', borderRadius: 999,
          }}>
            {t.badge}
          </span>
        )}
      </button>
    ))}
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────

export default function PRToolsTab() {
  const { user, language, isPRManager } = useAuth();
  const tx = useTranslation(language);

  // ── Sub-tab routing ────────────────────────────────────────────────────────
  // Employee default: 'campaigns' | Manager default: 'campaigns' (approval queue)
  const [prActiveTab, setPrActiveTab] = useState('campaigns');

  // ── Campaign form (emp only) ──────────────────────────────────────────────
  const [campName,      setCampName]      = useState('');
  const [campType,      setCampType]      = useState('Social Media');
  const [campPlatform,  setCampPlatform]  = useState('');
  const [campBudget,    setCampBudget]    = useState('');
  const [campAudience,  setCampAudience]  = useState('');
  const [campStartDate, setCampStartDate] = useState('');
  const [campEndDate,   setCampEndDate]   = useState('');
  const [campNotes,     setCampNotes]     = useState('');
  const [campLoading,   setCampLoading]   = useState(false);
  const [campStatus,    setCampStatus]    = useState(null);

  // ── Press release form (emp only) ─────────────────────────────────────────
  const [prPressTitle,   setPrPressTitle]   = useState('');
  const [prPressContent, setPrPressContent] = useState('');
  const [prPressDate,    setPrPressDate]    = useState('');
  const [prPressOutlets, setPrPressOutlets] = useState('');
  const [prPressLoading, setPrPressLoading] = useState(false);
  const [prPressStatus,  setPrPressStatus]  = useState(null);

  // ── Data lists ────────────────────────────────────────────────────────────
  const [myCampaigns,             setMyCampaigns]             = useState([]);
  const [myCampaignsLoading,      setMyCampaignsLoading]      = useState(false);
  const [pendingCampaigns,        setPendingCampaigns]        = useState([]);
  const [pendingCampaignsLoading, setPendingCampaignsLoading] = useState(false);
  const [pressReleases,           setPressReleases]           = useState([]);
  const [pressReleasesLoading,    setPressReleasesLoading]    = useState(false);

  // ── Data loaders ──────────────────────────────────────────────────────────

  const loadMyCampaigns = useCallback(async () => {
    setMyCampaignsLoading(true);
    try {
      const d = await prRepository.getMyCampaigns(user.id);
      setMyCampaigns(Array.isArray(d) ? d : []);
    } catch (err) {
      console.error('[PRToolsTab] loadMyCampaigns:', err.message);
    } finally {
      setMyCampaignsLoading(false);
    }
  }, [user.id]);

  const loadPendingCampaigns = useCallback(async () => {
    setPendingCampaignsLoading(true);
    try {
      const d = await prRepository.getPendingCampaigns(user.id);
      setPendingCampaigns(Array.isArray(d) ? d : []);
    } catch (err) {
      console.error('[PRToolsTab] loadPendingCampaigns:', err.message);
    } finally {
      setPendingCampaignsLoading(false);
    }
  }, [user.id]);

  const loadPressReleases = useCallback(async () => {
    setPressReleasesLoading(true);
    try {
      const d = await prRepository.getPressReleases(user.id);
      setPressReleases(Array.isArray(d) ? d : []);
    } catch (err) {
      console.error('[PRToolsTab] loadPressReleases:', err.message);
    } finally {
      setPressReleasesLoading(false);
    }
  }, [user.id]);

  // Auto-load on mount: manager gets pending campaigns queue immediately
  useEffect(() => {
    if (isPRManager) loadPendingCampaigns();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sub-tab change handler ────────────────────────────────────────────────

  const handleSubTabChange = (tab) => {
    setPrActiveTab(tab);
    if (tab === 'campaigns' && isPRManager)  loadPendingCampaigns();
    if (tab === 'press'     && isPRManager)  loadPressReleases();
    if (tab === 'my'        && !isPRManager) loadMyCampaigns();
  };

  // ── Form submit handlers ──────────────────────────────────────────────────

  const submitCampaign = async () => {
    if (!campName || !campType) return;
    setCampLoading(true);
    setCampStatus(null);
    try {
      const d = await prRepository.submitCampaign({
        emp_id: user.id,  emp_name: user.name,
        campaign_name: campName, campaign_type: campType,
        platform:      campPlatform,
        budget:        campBudget ? parseFloat(campBudget) : null,
        target_audience:    campAudience,
        campaign_start_date: campStartDate || null,
        campaign_end_date:   campEndDate   || null,
        notes: campNotes,
      });
      setCampStatus({ type: 'success', msg: d.message || 'Campaign request submitted.' });
      setCampName(''); setCampPlatform(''); setCampBudget('');
      setCampAudience(''); setCampStartDate(''); setCampEndDate(''); setCampNotes('');
    } catch (err) {
      setCampStatus({ type: 'error', msg: err.message || 'Network error.' });
    } finally {
      setCampLoading(false);
    }
  };

  const submitPressRelease = async () => {
    if (!prPressTitle || !prPressContent.trim()) return;
    setPrPressLoading(true);
    setPrPressStatus(null);
    try {
      const d = await prRepository.submitPressRelease({
        emp_id: user.id, emp_name: user.name,
        title:         prPressTitle,
        content:       prPressContent,
        target_date:   prPressDate,
        media_outlets: prPressOutlets,
      });
      setPrPressStatus({ type: 'success', msg: d.message || 'Press release submitted.' });
      setPrPressTitle(''); setPrPressContent(''); setPrPressDate(''); setPrPressOutlets('');
    } catch (err) {
      setPrPressStatus({ type: 'error', msg: err.message || 'Network error.' });
    } finally {
      setPrPressLoading(false);
    }
  };

  const resolveCampaign = async (ticketId, action) => {
    try {
      await prRepository.resolveCampaign({ ticket_id: ticketId, action });
      loadPendingCampaigns();
    } catch (err) {
      console.error('[PRToolsTab] resolveCampaign:', err.message);
    }
  };

  const resolvePressRelease = async (ticketId, action) => {
    try {
      await prRepository.resolveCampaign({ ticket_id: ticketId, action });
      loadPressReleases();
    } catch (err) {
      console.error('[PRToolsTab] resolvePressRelease:', err.message);
    }
  };

  // ── Sub-tab config ────────────────────────────────────────────────────────

  const TABS = isPRManager
    ? [
        { id: 'campaigns', label: tx?.prTabCampaignApprovals ?? 'Campaign Approvals', icon: IC.layers, badge: pendingCampaigns.length },
        { id: 'press',     label: tx?.prTabPressReleases     ?? 'Press Releases',     icon: IC.mail  },
      ]
    : [
        { id: 'campaigns', label: tx?.prTabNewCampaign   ?? 'New Campaign',    icon: IC.layers },
        { id: 'press',     label: tx?.prTabPressRelease  ?? 'Press Release',   icon: IC.mail   },
        { id: 'my',        label: tx?.prTabMySubmissions ?? 'My Submissions',  icon: IC.ticket },
      ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>

      {/* ── Header ── */}
      <SectionHead
        title={isPRManager ? (tx?.prCommandCenter ?? 'PR Command Center') : (tx?.prTools ?? 'PR Tools')}
        subtitle={isPRManager
          ? (tx?.prSubMgr ?? 'Review and action campaign requests and press releases.')
          : (tx?.prSubEmp ?? 'Submit campaign requests and draft press releases for manager review.')}
      />

      {/* ── Sub-tab navigation ── */}
      <SubTabNav tabs={TABS} active={prActiveTab} onChange={handleSubTabChange} />

      {/* ══════════════════════════════════════════════════════════════════════
          EMPLOYEE — NEW CAMPAIGN FORM
      ════════════════════════════════════════════════════════════════════════ */}
      {prActiveTab === 'campaigns' && !isPRManager && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

          {/* Form card */}
          <div className="ticket-card">
            <div style={{ height: 4, background: 'linear-gradient(90deg,#ec4899,#8b5cf6)' }} />
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Card header */}
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon d={IC.layers} size={15} color="#ec4899" />
                {tx?.prCampaignRequest ?? 'Campaign Request'}
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#8b5cf6', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', padding: '3px 10px', borderRadius: 999 }}>
                  {tx?.prRequiresApproval ?? 'Requires Manager Approval'}
                </span>
              </div>

              <StatusBanner status={campStatus} />

              {/* Campaign Name */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {tx?.prCampaignName ?? 'Campaign Name'}
                </label>
                <FastInput
                  value={campName}
                  onChange={v => setCampName(v)}
                  className="it-input"
                  style={{ marginTop: 6 }}
                  placeholder={tx?.prCampaignNamePH ?? 'e.g. Summer Launch 2026'}
                />
              </div>

              {/* Campaign Type */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {tx?.prCampaignType ?? 'Campaign Type'}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {CAMP_TYPES.map(t => {
                    const col = CAMP_COLOR[t] || '#94a3b8';
                    return (
                      <button
                        key={t}
                        onClick={() => setCampType(t)}
                        style={{
                          padding: '6px 13px', borderRadius: 9, cursor: 'pointer',
                          fontFamily: 'inherit', fontWeight: 700, fontSize: 11, transition: 'all .18s',
                          background: campType === t ? `${col}18` : 'var(--surface2)',
                          border:     `1.5px solid ${campType === t ? col + '55' : 'var(--border)'}`,
                          color:      campType === t ? col : 'var(--txt3)',
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Platform + Budget */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    {tx?.prPlatform ?? 'Platform'}
                  </label>
                  <select value={campPlatform} onChange={e => setCampPlatform(e.target.value)} className="it-input" style={{ marginTop: 6 }}>
                    <option value="">{tx?.prSelectPlatform ?? 'Select platform...'}</option>
                    {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    {tx?.prBudget ?? 'Budget (EGP)'}
                  </label>
                  <input
                    type="number" min="0" value={campBudget}
                    onChange={e => setCampBudget(e.target.value)}
                    className="it-input" style={{ marginTop: 6 }}
                    placeholder={tx?.prBudgetPH ?? 'Optional'}
                  />
                </div>
              </div>

              {/* Target Audience */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {tx?.prTargetAudience ?? 'Target Audience'}
                </label>
                <FastInput
                  value={campAudience}
                  onChange={v => setCampAudience(v)}
                  className="it-input" style={{ marginTop: 6 }}
                  placeholder={tx?.prTargetAudiencePH ?? 'e.g. Ages 25–40, Cairo'}
                />
              </div>

              {/* Campaign Duration */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 8 }}>
                  {language === 'ar' ? 'مدة الحملة' : 'Campaign Duration'}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                      {language === 'ar' ? 'تاريخ البدء' : 'Start Date'}
                    </label>
                    <input
                      type="date" value={campStartDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setCampStartDate(e.target.value)}
                      className="it-input"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                      {language === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}
                    </label>
                    <input
                      type="date" value={campEndDate}
                      min={campStartDate || new Date().toISOString().split('T')[0]}
                      onChange={e => setCampEndDate(e.target.value)}
                      className="it-input"
                    />
                  </div>
                </div>
                {campStartDate && campEndDate && campEndDate < campStartDate && (
                  <div style={{ fontSize: 11, color: '#ef4444', marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Icon d={IC.warn} size={11} color="#ef4444" />
                    {language === 'ar' ? 'لا يمكن أن يكون تاريخ الانتهاء قبل تاريخ البدء' : 'End date cannot be before start date'}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {tx?.prNotes ?? 'Notes / Objectives'}
                </label>
                <FastTextArea
                  value={campNotes} onChange={v => setCampNotes(v)}
                  className="it-input" rows="3" style={{ resize: 'vertical', marginTop: 6 }}
                  placeholder={tx?.prNotesPH ?? 'Campaign goals, key messages, KPIs...'}
                />
              </div>

              {/* Submit */}
              <button
                onClick={submitCampaign}
                disabled={campLoading || !campName || !campType}
                className="it-btn"
                style={{ marginTop: 0, background: 'linear-gradient(90deg,#ec4899,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (campLoading || !campName) ? 0.5 : 1 }}
              >
                {campLoading
                  ? <><span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,.3)', borderTopColor: '#fff' }} />{tx?.prSubmitting ?? 'Submitting...'}</>
                  : <><Icon d={IC.layers} size={14} />{tx?.prSubmitCampaign ?? 'Submit Campaign Request'}</>}
              </button>
            </div>
          </div>

          {/* Campaign type legend sidebar */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>
              {tx?.prCampaignTypes ?? 'Campaign Types'}
            </div>
            {CAMP_TYPES.map(t => {
              const col = CAMP_COLOR[t] || '#94a3b8';
              return (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, boxShadow: `0 0 5px ${col}80`, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 600 }}>{t}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MANAGER — CAMPAIGN APPROVAL QUEUE
      ════════════════════════════════════════════════════════════════════════ */}
      {prActiveTab === 'campaigns' && isPRManager && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              onClick={loadPendingCampaigns}
              style={{ padding: '7px 16px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {pendingCampaignsLoading ? <span className="spinner" style={{ width: 11, height: 11 }} /> : '↻'}
              {tx?.prRefresh ?? 'Refresh'}
            </button>
          </div>

          {pendingCampaignsLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--txt3)', fontSize: 13 }}>
              <span className="spinner" style={{ width: 15, height: 15 }} /> {tx?.prLoading ?? 'Loading...'}
            </div>
          )}

          {!pendingCampaignsLoading && pendingCampaigns.length === 0 && (
            <div style={{ textAlign: 'center', padding: '52px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16 }}>
              <Icon d={IC.check} size={32} color="var(--border2)" style={{ margin: '0 auto 14px', display: 'block' }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt3)', marginTop: 14 }}>
                {tx?.prNoPending ?? 'No pending campaign requests'}
              </div>
            </div>
          )}

          {pendingCampaigns.map(c => {
            const col = CAMP_COLOR[c.campaign_type] || '#94a3b8';
            return (
              <div key={c.ticket_id} className="ticket-card" style={{ marginBottom: 12 }}>
                <div style={{ height: 3, background: `linear-gradient(90deg,${col},${col}55)` }} />
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: `${col}18`, color: col, border: `1px solid ${col}35` }}>
                          {c.campaign_type}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)' }}>{c.campaign_name}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                        {tx?.prByWord ?? 'by'} <strong style={{ color: 'var(--txt2)' }}>{c.emp_name}</strong> · {fmtDate(c.time)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                    {c.platform && (
                      <div style={{ fontSize: 11, color: 'var(--txt3)', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 8 }}>
                        <strong>{tx?.prPlatformLbl ?? 'Platform:'}</strong> {c.platform}
                      </div>
                    )}
                    {c.budget && (
                      <div style={{ fontSize: 11, color: 'var(--txt3)', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 8 }}>
                        <strong>{tx?.prBudgetLbl ?? 'Budget:'}</strong> {Number(c.budget).toLocaleString()} {tx?.currency ?? 'EGP'}
                      </div>
                    )}
                    {(c.campaign_start_date || c.campaign_end_date) && (
                      <div style={{ fontSize: 11, color: 'var(--txt3)', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 8 }}>
                        <strong>{language === 'ar' ? 'المدة:' : 'Duration:'}</strong> {c.campaign_start_date || '?'} → {c.campaign_end_date || '?'}
                      </div>
                    )}
                  </div>
                  {c.target_audience && (
                    <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 8 }}>
                      <strong>{tx?.prAudienceLbl ?? 'Audience:'}</strong> {c.target_audience}
                    </div>
                  )}
                  {c.notes && (
                    <div style={{ fontSize: 12, color: 'var(--txt2)', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 12 }}>
                      {c.notes}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => resolveCampaign(c.ticket_id, 'approve')}
                      style={{ flex: 1, padding: '9px', borderRadius: 9, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Icon d={IC.check} size={12} color="#10b981" /> {tx?.prApprove ?? 'Approve'}
                    </button>
                    <button
                      onClick={() => resolveCampaign(c.ticket_id, 'reject')}
                      style={{ flex: 1, padding: '9px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Icon d={IC.warn} size={12} color="#ef4444" /> {tx?.prReject ?? 'Reject'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          EMPLOYEE — PRESS RELEASE DRAFT FORM
      ════════════════════════════════════════════════════════════════════════ */}
      {prActiveTab === 'press' && !isPRManager && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

          <div className="ticket-card">
            <div style={{ height: 4, background: 'linear-gradient(90deg,#06b6d4,#5b8fff)' }} />
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon d={IC.mail} size={15} color="#06b6d4" />
                {tx?.prPressDraft ?? 'Press Release Draft'}
              </div>

              <StatusBanner status={prPressStatus} />

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {tx?.prHeadline ?? 'Headline'}
                </label>
                <FastInput
                  value={prPressTitle} onChange={v => setPrPressTitle(v)}
                  className="it-input" style={{ marginTop: 6 }}
                  placeholder={tx?.prHeadlinePH ?? 'Press release headline...'}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    {tx?.prReleaseDate ?? 'Target Release Date'}
                  </label>
                  <input
                    type="date" value={prPressDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setPrPressDate(e.target.value)}
                    className="it-input" style={{ marginTop: 6 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    {tx?.prMediaOutlets ?? 'Media Outlets'}
                  </label>
                  <FastInput
                    value={prPressOutlets} onChange={v => setPrPressOutlets(v)}
                    className="it-input" style={{ marginTop: 6 }}
                    placeholder={tx?.prMediaOutletsPH ?? 'e.g. Reuters, Al Ahram...'}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {tx?.prContent ?? 'Content'}
                </label>
                <FastTextArea
                  value={prPressContent} onChange={v => setPrPressContent(v)}
                  className="it-input" rows="6" style={{ resize: 'vertical', marginTop: 6 }}
                  placeholder={tx?.prContentPH ?? 'Write the press release content here...'}
                />
              </div>

              <button
                onClick={submitPressRelease}
                disabled={prPressLoading || !prPressTitle || !prPressContent.trim()}
                className="it-btn"
                style={{ marginTop: 0, background: 'linear-gradient(90deg,#06b6d4,#5b8fff)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (prPressLoading || !prPressTitle || !prPressContent.trim()) ? 0.5 : 1 }}
              >
                {prPressLoading
                  ? <><span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,.3)', borderTopColor: '#fff' }} />{tx?.prSubmitting ?? 'Submitting...'}</>
                  : <><Icon d={IC.mail} size={14} />{tx?.prSubmitPress ?? 'Submit Press Release'}</>}
              </button>
            </div>
          </div>

          {/* Guidelines sidebar */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>
              {tx?.prGuidelines ?? 'Guidelines'}
            </div>
            {(tx?.prGuidelinesList ?? [
              'Start with a compelling headline that summarises the story.',
              'Cover the who, what, when, where, and why in the opening paragraph.',
              'Keep the body concise — 300–500 words is ideal.',
              'Add a company boilerplate at the end.',
            ]).map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, fontWeight: 800, color: '#06b6d4' }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.5 }}>{tip}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MANAGER — PRESS RELEASE REVIEW QUEUE
      ════════════════════════════════════════════════════════════════════════ */}
      {prActiveTab === 'press' && isPRManager && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              onClick={loadPressReleases}
              style={{ padding: '7px 16px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {pressReleasesLoading ? <span className="spinner" style={{ width: 11, height: 11 }} /> : '↻'}
              {tx?.prRefresh ?? 'Refresh'}
            </button>
          </div>

          {pressReleasesLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--txt3)', fontSize: 13 }}>
              <span className="spinner" style={{ width: 15, height: 15 }} /> {tx?.prLoading ?? 'Loading...'}
            </div>
          )}

          {!pressReleasesLoading && pressReleases.length === 0 && (
            <div style={{ textAlign: 'center', padding: '52px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16 }}>
              <Icon d={IC.mail} size={32} color="var(--border2)" style={{ display: 'block', margin: '0 auto 14px' }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt3)' }}>
                {tx?.prNoPressReleases ?? 'No press releases pending review'}
              </div>
            </div>
          )}

          {pressReleases.map(pr => (
            <div key={pr.ticket_id} className="ticket-card" style={{ marginBottom: 12 }}>
              <div style={{ height: 3, background: 'linear-gradient(90deg,#06b6d4,#5b8fff)' }} />
              <div style={{ padding: '16px 20px' }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', marginBottom: 4 }}>{pr.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                    {tx?.prByWord ?? 'by'} <strong style={{ color: 'var(--txt2)' }}>{pr.emp_name}</strong> · {fmtDate(pr.time)}
                  </div>
                </div>
                {(pr.target_date || pr.media_outlets) && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    {pr.target_date && (
                      <span style={{ fontSize: 11, color: 'var(--txt3)', padding: '4px 10px', background: 'var(--surface2)', borderRadius: 7 }}>
                        {tx?.prReleasePrefix ?? 'Release:'} {pr.target_date}
                      </span>
                    )}
                    {pr.media_outlets && (
                      <span style={{ fontSize: 11, color: 'var(--txt3)', padding: '4px 10px', background: 'var(--surface2)', borderRadius: 7 }}>
                        {tx?.prOutletsPrefix ?? 'Outlets:'} {pr.media_outlets}
                      </span>
                    )}
                  </div>
                )}
                <div style={{
                  fontSize: 12, color: 'var(--txt2)', padding: '10px 14px',
                  background: 'var(--surface2)', borderRadius: 9, marginBottom: 12,
                  maxHeight: 80, overflow: 'hidden',
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                  whiteSpace: 'pre-wrap',
                }}>
                  {pr.content}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => resolvePressRelease(pr.ticket_id, 'approve')}
                    style={{ flex: 1, padding: '9px', borderRadius: 9, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Icon d={IC.check} size={12} color="#10b981" /> {tx?.prApprovePublish ?? 'Approve & Publish'}
                  </button>
                  <button
                    onClick={() => resolvePressRelease(pr.ticket_id, 'reject')}
                    style={{ flex: 1, padding: '9px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Icon d={IC.warn} size={12} color="#ef4444" /> {tx?.prReject ?? 'Reject'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          EMPLOYEE — MY SUBMISSIONS HISTORY
      ════════════════════════════════════════════════════════════════════════ */}
      {prActiveTab === 'my' && !isPRManager && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              onClick={loadMyCampaigns}
              style={{ padding: '7px 16px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {myCampaignsLoading ? <span className="spinner" style={{ width: 11, height: 11 }} /> : '↻'}
              {tx?.prRefresh ?? 'Refresh'}
            </button>
          </div>

          {myCampaignsLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--txt3)', fontSize: 13 }}>
              <span className="spinner" style={{ width: 15, height: 15 }} /> {tx?.prLoading ?? 'Loading...'}
            </div>
          )}

          {!myCampaignsLoading && myCampaigns.length === 0 && (
            <div style={{ textAlign: 'center', padding: '52px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16, color: 'var(--txt3)' }}>
              <Icon d={IC.layers} size={32} color="var(--border2)" style={{ display: 'block', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {tx?.prNoSubmissions ?? 'No campaigns submitted yet'}
              </div>
            </div>
          )}

          {myCampaigns.map(c => {
            const col = CAMP_COLOR[c.campaign_type] || '#94a3b8';
            return (
              <div key={c.ticket_id} style={{ display: 'flex', gap: 14, padding: '13px 18px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 10 }}>
                <div style={{ width: 3, borderRadius: 3, background: col, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: `${col}18`, color: col, border: `1px solid ${col}35`, flexShrink: 0 }}>
                      {c.campaign_type}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.campaign_name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--txt3)', flexShrink: 0 }}>{fmtDate(c.time)}</span>
                  </div>
                  {c.notes && (
                    <div style={{ fontSize: 12, color: 'var(--txt3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
