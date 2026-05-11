/**
 * tabsConfig.js — RBAC Tab Configuration
 *
 * Single source of truth for EVERY sidebar navigation item in AnalyticOS.
 *
 * ─── Why this file exists ─────────────────────────────────────────────────────
 *
 * The original Dashboard.jsx used a chain of inline `{condition && <NavItem>}`
 * expressions scattered across ~160 lines of JSX.  Adding a new tab or changing
 * access rules required hunting through raw JSX, easy to miss and error-prone.
 *
 * This config replaces that with a declarative array:
 *   1. Each tab is ONE object — label, icon, access condition in one place.
 *   2. `Sidebar.jsx` iterates the array — zero if/else chains in the view layer.
 *   3. Access rules live here alone — changing a rule is a one-line edit.
 *   4. Adding a new tab = adding one object to this array.
 *
 * ─── Data shape ───────────────────────────────────────────────────────────────
 *
 * {
 *   key: string           — matches `activeTab` value (e.g. 'profile', 'sales_tools')
 *   icon: string          — IC path string (import { IC } from '../components/ui/Icon')
 *   label: {              — display text, both languages
 *     en: string,
 *     ar: string,
 *   },
 *   labelAlt?: {          — optional override label for a specific role (e.g. managers)
 *     en: string,
 *     ar: string,
 *     when: (auth) => boolean   — use labelAlt when this returns true
 *   },
 *   condition: (auth) => boolean  — receives the full useAuth() return value;
 *                                   tab is visible only when this is true
 *   badge?: (auth) => number | null  — optional dynamic badge count (null = hidden)
 *   onActivate?: (auth, helpers) => void  — optional side-effect on tab click
 *                                           (e.g. pre-fetch branch summary)
 * }
 *
 * ─── RBAC Summary ─────────────────────────────────────────────────────────────
 *
 *   profile         → ALL roles
 *   sales_tools     → dept 1 (Sales) — label changes for managers
 *   approvals       → managers (dep_manager / sales_manager / owner) EXCEPT sales_manager
 *   emp_search      → all managers (dep_manager / sales_manager / owner)
 *   it_tools        → dept 6 (IT) only
 *   it_inbox        → dept 6 (IT) only
 *   contact_admin   → all NON-IT employees
 *   ai              → all NON-IT employees AND aiEnabled toggle is ON
 *   overview        → all non-IT employees with hasDash (non-Sales employees)
 *   graphs          → same as overview
 *   products        → dept 5 (Inventory) + hasDash
 *   hr_adjustments  → dept 3 (HR) non-manager + hasDash
 *   finance_tools   → dept 2 (Finance) non-owner + hasDash
 *   pr_tools        → dept 4 (PR) non-owner + hasDash, label changes for PR manager
 *
 * ─── Usage in Sidebar.jsx ────────────────────────────────────────────────────
 *
 *   import { IC } from '../ui/Icon';
 *   import { TAB_CONFIG } from '../../config/tabsConfig';
 *
 *   const auth = useAuth();
 *
 *   const visibleTabs = TAB_CONFIG.filter(t => t.condition(auth));
 *
 *   visibleTabs.map(t => {
 *     const label = t.labelAlt && t.labelAlt.when(auth)
 *       ? t.labelAlt[language]
 *       : t.label[language];
 *     ...
 *   });
 */

import { IC } from '../components/ui/Icon';

/**
 * TAB_CONFIG
 *
 * Ordered array of nav item descriptors.  The sidebar renders them in this
 * exact order — reordering here reorders the sidebar.
 *
 * @type {Array<TabDescriptor>}
 */
export const TAB_CONFIG = [
  // ── 1. My Profile ──────────────────────────────────────────────────────────
  {
    key: 'profile',
    icon: IC.user,
    label: { en: 'My Profile', ar: 'ملفي الشخصي' },
    condition: () => true,                      // visible to everyone, always
  },

  // ── 2. Sales Tools / Sales Command ─────────────────────────────────────────
  // Shown for ALL sales department employees (emp, leader, manager).
  // Label swaps to "Sales Command" when the user is a sales manager.
  {
    key: 'sales_tools',
    icon: IC.graphs,
    label:    { en: 'My Sales',       ar: 'مبيعاتي'          },
    labelAlt: {
      en: 'Sales Command', ar: 'قيادة المبيعات',
      when: ({ isSalesManager }) => isSalesManager,
    },
    condition: ({ isSales }) => isSales,
  },

  // ── 3. Pending Approvals ───────────────────────────────────────────────────
  // All managers EXCEPT sales managers (they use 'sales_tools' for their view).
  {
    key: 'approvals',
    icon: IC.check,
    label: { en: 'Pending Approvals', ar: 'الموافقات المعلقة' },
    condition: ({ isManager, isSalesManager }) => isManager && !isSalesManager,
  },

  // ── 4. Employee Search ─────────────────────────────────────────────────────
  // All managers including sales managers (for profile lookup).
  {
    key: 'emp_search',
    icon: IC.user,
    label: { en: 'Employee Search', ar: 'بحث الموظفين' },
    condition: ({ isManager }) => isManager,
  },

  // ── 5. IT Admin Tools ──────────────────────────────────────────────────────
  // IT department (dept 6) only.
  {
    key: 'it_tools',
    icon: IC.shield,
    label: { en: 'Admin Tools', ar: 'أدوات الإدارة' },
    condition: ({ isIT }) => isIT,
  },

  // ── 6. IT Ticket Inbox ─────────────────────────────────────────────────────
  // IT department (dept 6) only.  Badge shows unread count.
  {
    key: 'it_inbox',
    icon: IC.ticket,
    label: { en: 'Ticket Inbox', ar: 'صندوق التذاكر' },
    condition: ({ isIT }) => isIT,
    // Badge count is surfaced by the strategy; Sidebar reads it from context/props.
    // Defined here as a placeholder — Sidebar can override with live count.
    badge: null,
  },

  // ── 7. Contact Admin ───────────────────────────────────────────────────────
  // All NON-IT employees.  IT employees have the Ticket Inbox instead.
  {
    key: 'contact_admin',
    icon: IC.headset,
    label: { en: 'Contact Admin', ar: 'تواصل مع الإدارة' },
    condition: ({ isIT }) => !isIT,
  },

  // ── 8. AI Assistant ────────────────────────────────────────────────────────
  // All NON-IT employees when the AI toggle is enabled.
  {
    key: 'ai',
    icon: IC.brain,
    label: { en: 'AI Assistant', ar: 'مساعد AI' },
    condition: ({ isIT, aiEnabled }) => !isIT && aiEnabled,
  },

  // ── 9. Analytics Overview ──────────────────────────────────────────────────
  // All non-IT employees who have a dashboard (hasDash = true).
  // Sales employees (role === 'emp') are excluded via hasDash in AuthContext.
  {
    key: 'overview',
    icon: IC.chart,
    label: { en: 'Analytics', ar: 'لوحة التحليلات' },
    condition: ({ hasDash, isIT }) => Boolean(hasDash) && !isIT,
  },

  // ── 10. Graphs ─────────────────────────────────────────────────────────────
  // Same gate as overview — both tabs are part of the analytics suite.
  {
    key: 'graphs',
    icon: IC.graphs,
    label: { en: 'Graphs', ar: 'الرسوم البيانية' },
    condition: ({ hasDash, isIT }) => Boolean(hasDash) && !isIT,
  },

  // ── 11. Products ───────────────────────────────────────────────────────────
  // Inventory department (dept 5) only, and only when hasDash is true.
  {
    key: 'products',
    icon: IC.pkg,
    label: { en: 'Products', ar: 'المنتجات' },
    condition: ({ isInventory, hasDash, isIT }) => isInventory && Boolean(hasDash) && !isIT,
  },

  // ── 12. HR Adjustments ─────────────────────────────────────────────────────
  // HR employees (dept 3, role !== 'dep_manager').
  // HR managers use ManagerDashboardStrategy and see 'approvals' + 'emp_search' instead.
  {
    key: 'hr_adjustments',
    icon: IC.money,
    label: { en: 'HR Adjustments', ar: 'تعديلات الرواتب' },
    condition: ({ isHR, hasDash, isIT }) => isHR && Boolean(hasDash) && !isIT,
  },

  // ── 13. Finance Tools ──────────────────────────────────────────────────────
  // Finance department (dept 2), excluding the Owner (who sees cross-dept views).
  {
    key: 'finance_tools',
    icon: IC.money,
    label: { en: 'Finance Tools', ar: 'أدوات المالية' },
    condition: ({ isFinance, isOwner, hasDash, isIT }) => isFinance && !isOwner && Boolean(hasDash) && !isIT,
  },

  // ── 14. PR Tools / PR Command ──────────────────────────────────────────────
  // PR department (dept 4), excluding the Owner.
  // Label swaps to "PR Command" for the PR department manager.
  {
    key: 'pr_tools',
    icon: IC.layers,
    label:    { en: 'PR Tools',   ar: 'أدوات العلاقات العامة' },
    labelAlt: {
      en: 'PR Command', ar: 'قيادة العلاقات العامة',
      when: ({ isPRManager }) => isPRManager,
    },
    condition: ({ isPR, isOwner, hasDash, isIT }) => isPR && !isOwner && Boolean(hasDash) && !isIT,
  },
];

// ── Helper: Resolve the display label for a tab given the current auth context ─

/**
 * resolveLabel
 *
 * Returns the correct label string for a tab descriptor, respecting the
 * optional `labelAlt` override for role-specific phrasing.
 *
 * @param  {TabDescriptor} tab       — an entry from TAB_CONFIG
 * @param  {object}        auth      — the full useAuth() return value
 * @param  {string}        language  — 'ar' | 'en'
 * @returns {string}
 */
export function resolveLabel(tab, auth, language) {
  if (tab.labelAlt && tab.labelAlt.when(auth)) {
    return tab.labelAlt[language] ?? tab.labelAlt.en;
  }
  return tab.label[language] ?? tab.label.en;
}

// ── Helper: Get visible tabs for a given auth context ─────────────────────────

/**
 * getVisibleTabs
 *
 * Filters TAB_CONFIG to only the tabs the current user is authorised to see.
 *
 * @param  {object} auth   — the full useAuth() return value
 * @returns {TabDescriptor[]}
 */
export function getVisibleTabs(auth) {
  return TAB_CONFIG.filter(t => t.condition(auth));
}
