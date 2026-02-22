import type {
  ActivityFeedVM,
  ActivityFeedItemVM,
  ActivityFeedLeafItemVM,
  ActivityFeedGroupItemVM,
  UserProfileVM,
} from '@iconicedu/shared-types';

const ORG = 'org-demo';

function mkActor(id: string, name: string): UserProfileVM {
  return {
    kind: 'educator',
    ids: { id, orgId: ORG, accountId: `acct-${id}` },
    profile: { displayName: name, avatar: { source: 'seed', seed: id } },
    prefs: {},
    meta: { createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
  } as unknown as UserProfileVM;
}

// Dynamic dates so sections (Today / This week / Earlier) stay correct at runtime
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const daysAgo  = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

const PRIYA  = mkActor('priya-001',  'Priya S.');
const TEVIN  = mkActor('tevin-001',  'Tevin T.');
const RILEY  = mkActor('riley-001',  'Riley T.');
const SYSTEM = mkActor('system-001', 'ICONIC System');

const TODAY_ITEMS: ActivityFeedItemVM[] = [
  // --- session summary posted ---
  {
    kind: 'leaf',
    ids: { id: 'af-1', orgId: ORG },
    timestamps: { occurredAt: hoursAgo(1), createdAt: hoursAgo(1) },
    tabKey: 'classes',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'summary.posted',
    refs: { actor: PRIYA },
    content: {
      leading: { kind: 'icon', iconKey: 'Sparkles', tone: 'success' },
      headline: {
        primary: 'Priya S.',
        secondary: 'posted a session summary for',
        emphasis: 'Math Foundations',
      },
      summary: 'Reviewed equivalent fractions and number line placement.',
      expandedContent:
        'Tevin made great progress on fractions this week. He correctly identified equivalent fractions and placed them on a number line. Next steps: mixed numbers and word problems.',
    },
    state: { isRead: false, importance: 'normal' },
  } as ActivityFeedLeafItemVM,

  // --- homework submitted ---
  {
    kind: 'leaf',
    ids: { id: 'af-2', orgId: ORG },
    timestamps: { occurredAt: hoursAgo(3), createdAt: hoursAgo(3) },
    tabKey: 'classes',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'homework.submitted',
    refs: { actor: TEVIN },
    content: {
      leading: { kind: 'icon', iconKey: 'Paperclip', tone: 'info' },
      headline: {
        primary: 'Tevin T.',
        secondary: 'submitted homework for',
        emphasis: 'Fractions Practice Set',
      },
      summary: '1 image attached',
    },
    state: { isRead: false, importance: 'normal' },
  } as ActivityFeedLeafItemVM,

  // --- new message ---
  {
    kind: 'leaf',
    ids: { id: 'af-3', orgId: ORG },
    timestamps: { occurredAt: hoursAgo(5), createdAt: hoursAgo(5) },
    tabKey: 'classes',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'message.posted',
    refs: { actor: PRIYA },
    content: {
      leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'neutral' },
      headline: {
        primary: 'Priya S.',
        secondary: 'sent a message in',
        emphasis: 'Math Foundations',
      },
      summary: '"Please complete the worksheet before our next session."',
    },
    state: { isRead: false, importance: 'normal' },
  } as ActivityFeedLeafItemVM,
];

const SUB_ITEMS: ActivityFeedLeafItemVM[] = [
  {
    kind: 'leaf',
    ids: { id: 'af-5a', orgId: ORG },
    timestamps: { occurredAt: daysAgo(3), createdAt: daysAgo(3) },
    tabKey: 'classes',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'session.scheduled',
    refs: { actor: PRIYA },
    content: { headline: { primary: 'Math Foundations', secondary: '— Wed Dec 25, 5:00 PM' } },
    state: { isRead: true },
  },
  {
    kind: 'leaf',
    ids: { id: 'af-5b', orgId: ORG },
    timestamps: { occurredAt: daysAgo(3), createdAt: daysAgo(3) },
    tabKey: 'classes',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'session.scheduled',
    refs: { actor: PRIYA },
    content: { headline: { primary: 'Writing Workshop', secondary: '— Thu Dec 26, 4:00 PM' } },
    state: { isRead: true },
  },
  {
    kind: 'leaf',
    ids: { id: 'af-5c', orgId: ORG },
    timestamps: { occurredAt: daysAgo(3), createdAt: daysAgo(3) },
    tabKey: 'classes',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'session.scheduled',
    refs: { actor: PRIYA },
    content: { headline: { primary: 'Chess Strategy Lab', secondary: '— Fri Dec 27, 4:30 PM' } },
    state: { isRead: true },
  },
];

const THIS_WEEK_ITEMS: ActivityFeedItemVM[] = [
  // --- payment reminder ---
  {
    kind: 'leaf',
    ids: { id: 'af-4', orgId: ORG },
    timestamps: { occurredAt: daysAgo(2), createdAt: daysAgo(2) },
    tabKey: 'payment',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'class.created',
    refs: { actor: SYSTEM },
    content: {
      leading: { kind: 'icon', iconKey: 'CreditCard', tone: 'warning' },
      headline: {
        primary: 'Payment due',
        secondary: 'for',
        emphasis: 'December tutoring sessions',
      },
      summary: '$480.00 due by Dec 31',
      actionButton: { label: 'View Invoice', variant: 'outline', href: null, actionKey: null, payload: null },
    },
    state: { isRead: false, importance: 'important' },
  } as ActivityFeedLeafItemVM,

  // --- group: 3 sessions scheduled ---
  {
    kind: 'group',
    ids: { id: 'af-5', orgId: ORG },
    timestamps: { occurredAt: daysAgo(3), createdAt: daysAgo(3) },
    tabKey: 'classes',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'session.scheduled',
    refs: { actor: PRIYA },
    grouping: { groupType: 'class', groupKey: 'sessions-week-group' },
    subActivityCount: 3,
    subActivities: { items: SUB_ITEMS },
    content: {
      leading: { kind: 'icon', iconKey: 'GraduationCap', tone: 'info' },
      headline: {
        primary: 'Priya S.',
        secondary: 'scheduled',
        emphasis: '3 sessions next week',
      },
    },
    state: { isRead: true, importance: 'normal' },
  } as ActivityFeedGroupItemVM,
];

const EARLIER_ITEMS: ActivityFeedItemVM[] = [
  // --- member joined ---
  {
    kind: 'leaf',
    ids: { id: 'af-6', orgId: ORG },
    timestamps: { occurredAt: daysAgo(10), createdAt: daysAgo(10) },
    tabKey: 'system',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'member.joined',
    refs: { actor: RILEY },
    content: {
      leading: { kind: 'icon', iconKey: 'CheckCircle2', tone: 'success' },
      headline: { primary: 'Riley T.', secondary: 'joined the organization' },
    },
    state: { isRead: true, importance: 'normal' },
  } as ActivityFeedLeafItemVM,

  // --- payment received ---
  {
    kind: 'leaf',
    ids: { id: 'af-7', orgId: ORG },
    timestamps: { occurredAt: daysAgo(14), createdAt: daysAgo(14) },
    tabKey: 'payment',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'class.updated',
    refs: { actor: SYSTEM },
    content: {
      leading: { kind: 'icon', iconKey: 'CreditCard', tone: 'success' },
      headline: {
        primary: 'Payment received',
        secondary: 'for',
        emphasis: 'November tutoring sessions',
      },
      summary: '$480.00 paid on Nov 30',
    },
    state: { isRead: true, importance: 'normal' },
  } as ActivityFeedLeafItemVM,
];

export const DEMO_ACTIVITY_FEED: ActivityFeedVM = {
  activeTab: 'all',
  tabs: [
    { key: 'all',     label: 'All' },
    { key: 'classes', label: 'Classes' },
    { key: 'payment', label: 'Payment' },
    { key: 'system',  label: 'System' },
  ],
  sections: [
    { label: 'Today',     items: TODAY_ITEMS },
    { label: 'This week', items: THIS_WEEK_ITEMS },
    { label: 'Earlier',   items: EARLIER_ITEMS },
  ],
  unreadCount: 4,
};
