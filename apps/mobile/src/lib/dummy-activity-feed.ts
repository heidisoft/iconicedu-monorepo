import type {
  ActivityFeedGroupItemVM,
  ActivityFeedItemVM,
  ActivityFeedLeafItemVM,
  ActivityFeedVM,
  UserProfileVM,
} from '@iconicedu/shared-types';

const ORG = 'org-demo';

function mkActor(id: string, name: string): UserProfileVM {
  return {
    kind: 'educator',
    ids: { id, orgId: ORG, accountId: `acct-${id}` },
    profile: { displayName: name, avatar: { source: 'seed', seed: id } },
    prefs: {},
    meta: {
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
  } as unknown as UserProfileVM;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const PRIYA = mkActor('priya-001', 'Priya S.');
const SYSTEM = mkActor('system-001', 'ICONIC System');

const MESSAGE_ITEMS: ActivityFeedLeafItemVM[] = [
  {
    kind: 'leaf',
    ids: { id: 'af-msg-1', orgId: ORG },
    timestamps: { occurredAt: hoursAgo(1), createdAt: hoursAgo(1) },
    tabKey: 'all',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'message.posted',
    refs: { actor: PRIYA },
    content: {
      leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
      headline: {
        primary: 'Priya S. sent you a message in',
        secondary: 'Math Foundations',
      },
      summary: 'Please complete the worksheet before tomorrow.',
    },
    state: { isRead: false, importance: 'normal' },
  },
  {
    kind: 'leaf',
    ids: { id: 'af-msg-2', orgId: ORG },
    timestamps: { occurredAt: hoursAgo(2), createdAt: hoursAgo(2) },
    tabKey: 'all',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'reaction.added',
    refs: { actor: PRIYA },
    content: {
      leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
      headline: {
        primary: 'Priya S. reacted 😀 to your message in',
        secondary: 'Math Foundations',
      },
    },
    state: { isRead: true, importance: 'normal' },
  },
];

const TODAY_ITEMS: ActivityFeedItemVM[] = [
  {
    kind: 'group',
    ids: { id: 'af-group-1', orgId: ORG },
    timestamps: { occurredAt: hoursAgo(1), createdAt: hoursAgo(1) },
    tabKey: 'all',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'messages.posted',
    refs: { actor: PRIYA },
    grouping: { groupType: 'message', groupKey: 'message-group-1' },
    subActivityCount: MESSAGE_ITEMS.length,
    subActivities: { items: MESSAGE_ITEMS },
    content: {
      leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
      headline: { primary: 'New messages', secondary: 'Math Foundations' },
    },
    state: { isRead: false, importance: 'normal' },
  } satisfies ActivityFeedGroupItemVM,
  {
    kind: 'leaf',
    ids: { id: 'af-reschedule-1', orgId: ORG },
    timestamps: { occurredAt: hoursAgo(4), createdAt: hoursAgo(4) },
    tabKey: 'classes',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'class.session.rescheduled',
    refs: { actor: SYSTEM },
    content: {
      leading: { kind: 'icon', iconKey: 'CalendarCheck', tone: 'info' },
      headline: {
        primary: 'Class session rescheduled',
        secondary: 'Math Foundations',
      },
      summary: 'Moved to Tuesday at 4:00 PM PT.',
    },
    state: { isRead: false, importance: 'important' },
  } satisfies ActivityFeedLeafItemVM,
  {
    kind: 'leaf',
    ids: { id: 'af-payment-1', orgId: ORG },
    timestamps: { occurredAt: hoursAgo(6), createdAt: hoursAgo(6) },
    tabKey: 'payment',
    audience: { scope: { kind: 'global' }, visibility: 'public' },
    verb: 'payment.reminder.sent',
    refs: { actor: SYSTEM },
    content: {
      leading: { kind: 'icon', iconKey: 'CreditCard', tone: 'warning' },
      headline: {
        primary: 'Payment reminder',
        secondary: 'March tutoring invoice',
      },
      summary: '$480 due this week.',
    },
    state: { isRead: true, importance: 'important' },
  } satisfies ActivityFeedLeafItemVM,
];

export const DEMO_ACTIVITY_FEED: ActivityFeedVM = {
  activeTab: 'all',
  tabs: [
    { key: 'all', label: 'All' },
    { key: 'classes', label: 'Classes' },
    { key: 'payment', label: 'Payment' },
    { key: 'system', label: 'System' },
  ],
  sections: [{ label: 'Today', items: TODAY_ITEMS }],
  unreadCount: 2,
};
