import type { ActivityFeedVM, ActivityFeedItemVM } from '@iconicedu/shared-types';
import {
  ACTIVITY_IDS,
  CHANNEL_IDS,
  FILE_IDS,
  LEARNING_SPACE_IDS,
  DEMO_ORG_ID,
} from '@iconicedu/web/lib/data/ids';
import {
  EDUCATOR_ELENA_PROFILE,
  EDUCATOR_LUCAS_PROFILE,
  EDUCATOR_PRIYA_PROFILE,
  GUARDIAN_RILEY_PROFILE,
  SYSTEM_PROFILE,
} from '@iconicedu/web/lib/data/profiles';

const MATH_HOMEWORK_ACTIVITY: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: ACTIVITY_IDS.mathHomework, orgId: DEMO_ORG_ID },
  timestamps: {
    occurredAt: '2025-12-19T17:30:00.000Z',
    createdAt: '2025-12-19T17:35:00.000Z',
  },
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
    visibility: 'scope_only',
  },
  verb: 'homework.assigned',
  refs: {
    actor: EDUCATOR_PRIYA_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
  },
  content: {
    leading: { kind: 'icon', iconKey: 'ClipboardCheck', tone: 'info' },
    headline: {
      primary: 'New math homework assigned',
      secondary: 'Fractions Practice Set',
    },
    summary: 'Due Sunday, Feb 22',
    expandedContent:
      'Focus on equivalent fractions and number lines. Complete problems 1-10 before next session.',
    actionButton: {
      label: 'View homework',
      variant: 'default',
      href: `/iconic-academy/spaces/${CHANNEL_IDS.mathSpace}`,
    },
  },
  state: { importance: 'normal', isRead: false },
};

const MATH_HOMEWORK_SUBMIT_ACTIVITY: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: ACTIVITY_IDS.mathHomeworkSubmit, orgId: DEMO_ORG_ID },
  timestamps: {
    occurredAt: '2025-12-20T19:40:00.000Z',
    createdAt: '2025-12-20T19:42:00.000Z',
  },
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
    visibility: 'scope_only',
  },
  verb: 'homework.submitted',
  refs: {
    actor: GUARDIAN_RILEY_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
  },
  content: {
    leading: { kind: 'icon', iconKey: 'ClipboardCheck', tone: 'success' },
    headline: {
      primary: 'Homework submitted',
      secondary: 'Fractions Practice Set',
    },
    summary: 'Submitted by Tevin',
  },
  state: { importance: 'normal', isRead: false },
};

const SCIENCE_FILE_ACTIVITY: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: ACTIVITY_IDS.scienceFile, orgId: DEMO_ORG_ID },
  timestamps: {
    occurredAt: '2025-12-19T18:45:00.000Z',
    createdAt: '2025-12-19T18:46:00.000Z',
  },
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.science },
    visibility: 'scope_only',
  },
  verb: 'file.uploaded',
  refs: {
    actor: EDUCATOR_LUCAS_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.science },
    object: { kind: 'file', id: FILE_IDS.scienceLabPdf },
  },
  content: {
    leading: { kind: 'icon', iconKey: 'FileText', tone: 'info' },
    headline: {
      primary: 'New lab guide uploaded',
      secondary: 'Science Lab Explorers',
    },
    summary: 'science-lab-guide.pdf',
    expandedContent:
      'Includes safety checklist, materials list, and a short pre-lab quiz.',
  },
  state: { importance: 'normal', isRead: true },
};

const ELA_SUMMARY_ACTIVITY: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: ACTIVITY_IDS.elaSummary, orgId: DEMO_ORG_ID },
  timestamps: {
    occurredAt: '2025-12-18T19:20:00.000Z',
    createdAt: '2025-12-18T19:21:00.000Z',
  },
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.ela },
    visibility: 'scope_only',
  },
  verb: 'summary.posted',
  refs: {
    actor: EDUCATOR_ELENA_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.ela },
  },
  content: {
    leading: { kind: 'icon', iconKey: 'FileText', tone: 'neutral' },
    headline: {
      primary: 'Session summary posted',
      secondary: 'Writing Workshop',
    },
    summary: 'Story Seeds discussion highlights',
    expandedContent:
      'Covered narrative hooks, character arcs, and setting details. Next session: revise your opening paragraph.',
  },
  state: { importance: 'normal', isRead: true },
};

const SYSTEM_PAYMENT_ACTIVITY: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: ACTIVITY_IDS.systemPayment, orgId: DEMO_ORG_ID },
  timestamps: {
    occurredAt: '2025-12-17T14:00:00.000Z',
    createdAt: '2025-12-17T14:01:00.000Z',
  },
  tabKey: 'payment',
  audience: {
    scope: { kind: 'global' },
    visibility: 'direct',
  },
  verb: 'role.changed',
  refs: {
    actor: SYSTEM_PROFILE,
  },
  content: {
    leading: { kind: 'icon', iconKey: 'CreditCard', tone: 'warning' },
    headline: {
      primary: 'Payment method expiring soon',
      secondary: 'Update your billing details',
    },
    summary: 'Card ending in 1234 expires in 14 days.',
    actionButton: {
      label: 'Update billing',
      variant: 'default',
      href: '/iconic-academy',
    },
  },
  state: { importance: 'important', isRead: false },
};

const GROUPED_HOMEWORK_ACTIVITY: ActivityFeedItemVM = {
  kind: 'group',
  ids: { id: ACTIVITY_IDS.groupHomework, orgId: DEMO_ORG_ID },
  timestamps: {
    occurredAt: '2025-12-20T21:00:00.000Z',
    createdAt: '2025-12-20T21:01:00.000Z',
  },
  tabKey: 'classes',
  audience: {
    scope: { kind: 'global' },
    visibility: 'public',
  },
  verb: 'homework.assigned',
  refs: {
    actor: EDUCATOR_PRIYA_PROFILE,
  },
  grouping: {
    groupType: 'homework',
    groupKey: 'homework-week-08',
  },
  content: {
    leading: {
      kind: 'avatars',
      avatars: [
        {
          name: EDUCATOR_PRIYA_PROFILE.profile.displayName,
          avatar: EDUCATOR_PRIYA_PROFILE.profile.avatar,
          themeKey: EDUCATOR_PRIYA_PROFILE.ui?.themeKey ?? null,
        },
        {
          name: EDUCATOR_ELENA_PROFILE.profile.displayName,
          avatar: EDUCATOR_ELENA_PROFILE.profile.avatar,
          themeKey: EDUCATOR_ELENA_PROFILE.ui?.themeKey ?? null,
        },
      ],
      overflowCount: 0,
    },
    headline: {
      primary: '2 new homework updates',
      secondary: 'Math + Writing',
    },
    summary: 'Review assignments for the week',
    expandedContent:
      'Math: Fractions Practice Set. Writing: Story Prompt Draft with feedback goals.',
  },
  state: { importance: 'normal', isRead: false },
  isCollapsed: true,
  subActivityCount: 2,
  subActivities: {
    items: [
      {
        kind: 'leaf',
        ids: { id: ACTIVITY_IDS.groupHomework1, orgId: DEMO_ORG_ID },
        timestamps: {
          occurredAt: '2025-12-20T20:50:00.000Z',
          createdAt: '2025-12-20T20:55:00.000Z',
        },
        tabKey: 'classes',
        audience: {
          scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
          visibility: 'scope_only',
        },
        verb: 'homework.assigned',
        refs: {
          actor: EDUCATOR_PRIYA_PROFILE,
          target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
        },
        content: {
          leading: { kind: 'icon', iconKey: 'ClipboardCheck', tone: 'info' },
          headline: {
            primary: 'Math homework assigned',
            secondary: 'Fractions Practice Set',
          },
          summary: 'Due Sunday',
        },
        state: { importance: 'normal', isRead: false },
      },
      {
        kind: 'leaf',
        ids: { id: ACTIVITY_IDS.groupHomework2, orgId: DEMO_ORG_ID },
        timestamps: {
          occurredAt: '2025-12-20T20:52:00.000Z',
          createdAt: '2025-12-20T20:56:00.000Z',
        },
        tabKey: 'classes',
        audience: {
          scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.ela },
          visibility: 'scope_only',
        },
        verb: 'homework.assigned',
        refs: {
          actor: EDUCATOR_ELENA_PROFILE,
          target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.ela },
        },
        content: {
          leading: { kind: 'icon', iconKey: 'ClipboardCheck', tone: 'info' },
          headline: {
            primary: 'ELA homework assigned',
            secondary: 'Story Prompt Draft',
          },
          summary: 'Due Monday',
        },
        state: { importance: 'normal', isRead: false },
      },
    ],
    total: 2,
  },
};

export const INBOX_ACTIVITY_FEED: ActivityFeedVM = {
  activeTab: 'all',
  tabs: [
    { key: 'all', label: 'All', badgeCount: 6 },
    { key: 'classes', label: 'Classes', badgeCount: 4 },
    { key: 'payment', label: 'Payment', badgeCount: 1 },
    { key: 'system', label: 'System', badgeCount: 1 },
  ],
  sections: [
    {
      label: 'Today',
      items: [
        MATH_HOMEWORK_ACTIVITY,
        MATH_HOMEWORK_SUBMIT_ACTIVITY,
        SCIENCE_FILE_ACTIVITY,
        ELA_SUMMARY_ACTIVITY,
      ],
    },
    {
      label: 'This week',
      items: [GROUPED_HOMEWORK_ACTIVITY, SYSTEM_PAYMENT_ACTIVITY],
    },
  ],
  nextCursor: null,
  unreadCount: 3,
};
