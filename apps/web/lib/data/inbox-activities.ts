import type {
  ActivityFeedItemVM,
  ActivityFeedLeafItemVM,
  ActivityFeedVM,
} from '@iconicedu/shared-types';
import {
  CHANNEL_IDS,
  DEMO_ORG_ID,
  LEARNING_SPACE_IDS,
} from '@iconicedu/web/lib/data/ids';
import {
  EDUCATOR_PRIYA_PROFILE,
  STAFF_SUPPORT_PROFILE,
} from '@iconicedu/web/lib/data/profiles';

function ts(occurredAt: string, createdAt = occurredAt) {
  return { occurredAt, createdAt };
}

function unread(isRead = false) {
  return { importance: 'normal' as const, isRead };
}

const FEED_ITEMS: ActivityFeedItemVM[] = [
  {
    kind: 'leaf',
    ids: { id: 'activity-message-1', orgId: DEMO_ORG_ID },
    timestamps: ts('2026-03-07T15:10:00.000Z'),
    tabKey: 'all',
    audience: {
      scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
      visibility: 'scope_only',
    },
    verb: 'message.posted',
    refs: {
      actor: EDUCATOR_PRIYA_PROFILE,
      target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
    },
    content: {
      leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
      headline: {
        primary: 'Priya S. sent you a message in',
        secondary: 'Math Foundations',
      },
      summary: 'Please review the fraction examples before tomorrow.',
      actionButton: {
        label: 'Open class',
        variant: 'outline',
        href: `/iconic-academy/s/${CHANNEL_IDS.mathSpace}`,
      },
    },
    state: unread(false),
  } satisfies ActivityFeedLeafItemVM,
  {
    kind: 'leaf',
    ids: { id: 'activity-reaction-1', orgId: DEMO_ORG_ID },
    timestamps: ts('2026-03-07T15:15:00.000Z'),
    tabKey: 'all',
    audience: {
      scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
      visibility: 'scope_only',
    },
    verb: 'reaction.added',
    refs: {
      actor: STAFF_SUPPORT_PROFILE,
      target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
    },
    content: {
      leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
      headline: {
        primary: 'Support reacted 😀 to your message in',
        secondary: 'Math Foundations',
      },
      actionButton: {
        label: 'Open class',
        variant: 'outline',
        href: `/iconic-academy/s/${CHANNEL_IDS.mathSpace}`,
      },
    },
    state: unread(true),
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
  sections: [{ label: 'Today', items: FEED_ITEMS }],
  unreadCount: FEED_ITEMS.filter((item) => !item.state?.isRead).length,
};
