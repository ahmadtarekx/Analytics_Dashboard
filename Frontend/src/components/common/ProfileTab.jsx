/**
 * ProfileTab.jsx — Shared Tab Component
 *
 * Displays the logged-in user's personal info cards.
 * Extracted from Dashboard.jsx ~line 5550–5582.
 *
 * Uses: useAuth() for user data, useTranslation() for labels.
 * No fetch calls — data comes entirely from the stored user object.
 */

import { useAuth }        from '../../context/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import Icon, { IC }       from '../ui/Icon';
import { ACCENTS }        from '../charts/chartUtils';

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatDate = (ds, language) => {
  if (!ds) return language === 'ar' ? 'غير محدد' : 'N/A';
  try {
    const d = new Date(ds);
    return isNaN(d.getTime())
      ? (language === 'ar' ? 'غير محدد' : 'N/A')
      : d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US');
  } catch {
    return language === 'ar' ? 'غير محدد' : 'N/A';
  }
};

const SectionHead = ({ title }) => (
  <div style={{ marginBottom: 26 }}>
    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.4px' }}>
      {title}
    </h1>
    <div style={{ height: 3, width: 44, background: 'linear-gradient(90deg,var(--accent),var(--accent2))', borderRadius: 2, marginTop: 7 }} />
  </div>
);

export default function ProfileTab() {
  const { user, language } = useAuth();
  const tx = useTranslation(language);

  if (!user) return null;

  const unspecified = language === 'ar' ? 'غير محدد' : 'N/A';

  const cards = [
    {
      icon:  IC.branch,
      label: tx?.primaryBranch ?? 'Primary Branch',
      value: `${user.primary_branch || unspecified} · ${tx?.branchNum ?? 'Branch #'}${user.branch_id}`,
    },
    ...(user.secondary_branch_id ? [{
      icon:  IC.branch,
      label: tx?.secBranch ?? 'Secondary Branch',
      value: `${user.secondary_branch || unspecified} · ${tx?.branchNum ?? 'Branch #'}${user.secondary_branch_id}`,
    }] : []),
    {
      icon:  IC.money,
      label: tx?.salary ?? 'Salary',
      value: `${user.salary ? user.salary.toLocaleString() : '0'} ${tx?.currency ?? 'EGP'}`,
    },
    {
      icon:  IC.gender,
      label: tx?.gender ?? 'Gender',
      value: user.gender === 'M' || user.gender === 'Male'
        ? (tx?.male ?? 'Male')
        : user.gender === 'F' || user.gender === 'Female'
          ? (tx?.female ?? 'Female')
          : unspecified,
    },
    {
      icon:  IC.birthday,
      label: tx?.birth ?? 'Date of Birth',
      value: formatDate(user.birth, language),
    },
    {
      icon:  IC.calendar,
      label: tx?.hired ?? 'Hire Date',
      value: formatDate(user.hired, language),
    },
    {
      icon:  IC.phone,
      label: tx?.phone ?? 'Phone',
      value: user.phone || unspecified,
    },
    {
      icon:  IC.address,
      label: tx?.address ?? 'Address',
      value: user.address || unspecified,
    },
  ];

  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      <SectionHead title={tx?.personalInfo ?? 'Personal Information'} />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))',
        gap: 14,
      }}>
        {cards.map(({ icon, label, value }, idx) => {
          const accent = ACCENTS[idx % ACCENTS.length];
          return (
            <div
              key={idx}
              className="profile-card"
              style={{ animationDelay: `${idx * 0.04}s`, borderTop: `3px solid ${accent}` }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: `${accent}18`, border: `1px solid ${accent}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon d={icon} size={14} color={accent} />
                </div>
                <span style={{
                  fontSize: 11, color: 'var(--txt2)', fontWeight: 700,
                  letterSpacing: '0.5px', textTransform: 'uppercase',
                }}>
                  {label}
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)', lineHeight: 1.4 }}>
                {value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
