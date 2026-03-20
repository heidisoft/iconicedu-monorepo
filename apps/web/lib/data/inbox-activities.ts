import type {
  ActivityFeedLeafItemVM,
  ActivityFeedVM,
  ActivityFeedItemVM,
} from '@iconicedu/shared-types';
import {
  CHANNEL_IDS,
  CLASS_SCHEDULE_IDS,
  DEMO_ORG_ID,
  FILE_IDS,
  LEARNING_SPACE_IDS,
  MESSAGE_IDS,
} from '@iconicedu/web/lib/data/ids';
import {
  CHILD_TEHARA_PROFILE,
  CHILD_TEVIN_PROFILE,
  EDUCATOR_ELENA_PROFILE,
  EDUCATOR_PRIYA_PROFILE,
  GUARDIAN_RILEY_PROFILE,
  STAFF_SUPPORT_PROFILE,
  SYSTEM_PROFILE,
} from '@iconicedu/web/lib/data/profiles';

function ts(occurredAt: string, createdAt = occurredAt) {
  return { occurredAt, createdAt };
}

function unread(isRead = false) {
  return { importance: 'normal' as const, isRead };
}

const CLASS_LIVE_NOW: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-session-started-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-07T14:00:00.000Z', '2026-03-07T14:00:05.000Z'),
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
    visibility: 'scope_only',
  },
  verb: 'session.started',
  refs: {
    actor: EDUCATOR_PRIYA_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
    object: { kind: 'session', id: CLASS_SCHEDULE_IDS.math },
  },
  content: {
    leading: { kind: 'icon', iconKey: 'Video', tone: 'success' },
    headline: {
      primary: 'Class is live now',
      secondary: 'Math Foundations - Weekly Session',
    },
    summary: 'Started at 2:00 PM PT',
    actionButton: {
      label: 'Join class',
      variant: 'default',
      href: `/iconic-academy/spaces/${CHANNEL_IDS.mathSpace}`,
    },
  },
  state: unread(false),
};

const TEACHER_JOINED_CLASS: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-member-joined-teacher-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-07T13:58:00.000Z', '2026-03-07T13:58:08.000Z'),
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
    visibility: 'scope_only',
  },
  verb: 'member.joined',
  refs: {
    actor: EDUCATOR_PRIYA_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
  },
  content: {
    leading: { kind: 'icon', iconKey: 'Mic', tone: 'info' },
    headline: {
      primary: 'Teacher joined the class',
      secondary: EDUCATOR_PRIYA_PROFILE.profile.displayName,
    },
    summary: 'Preparing warm-up questions.',
  },
  state: unread(true),
};

const STUDENT_JOINED_CLASS: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-member-joined-student-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-07T14:01:00.000Z', '2026-03-07T14:01:09.000Z'),
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
    visibility: 'scope_only',
  },
  verb: 'member.joined',
  refs: {
    actor: CHILD_TEVIN_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
  },
  content: {
    leading: { kind: 'icon', iconKey: 'Mic', tone: 'success' },
    headline: {
      primary: 'Student joined the class',
      secondary: CHILD_TEVIN_PROFILE.profile.displayName,
    },
    summary: 'Attendance updated.',
  },
  state: unread(false),
};

const HOMEWORK_ASSIGNED: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-homework-assigned-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-07T15:10:00.000Z', '2026-03-07T15:11:00.000Z'),
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
    visibility: 'scope_only',
  },
  verb: 'homework.assigned',
  refs: {
    actor: EDUCATOR_PRIYA_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
    object: { kind: 'homework', id: MESSAGE_IDS.mathHomework },
  },
  content: {
    leading: { kind: 'icon', iconKey: 'ClipboardCheck', tone: 'info' },
    headline: {
      primary: 'Homework assigned',
      secondary: 'Fractions Practice Set',
    },
    summary: 'Due Mar 10, 8:00 PM PT',
    expandedContent:
      'Complete questions 1-15. Show work for 5 challenge items. Submit PDF or photo.',
    actionButton: {
      label: 'View homework',
      variant: 'default',
      href: `/iconic-academy/spaces/${CHANNEL_IDS.mathSpace}`,
    },
  },
  state: unread(false),
};

const LESSON_ASSIGNMENT_ASSIGNED: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-lesson-assignment-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-07T15:12:00.000Z', '2026-03-07T15:13:00.000Z'),
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
      primary: 'Class assignment assigned',
      secondary: 'Lesson 08 - Ratios Checkpoint',
    },
    summary: 'In-class assignment for next weekly session',
    expandedContent:
      'Students will solve 8 ratio problems and present one solution approach in class.',
    actionButton: {
      label: 'Open class',
      variant: 'outline',
      href: `/iconic-academy/spaces/${CHANNEL_IDS.mathSpace}`,
    },
  },
  state: unread(false),
};

const HOMEWORK_ATTACHMENT_UPLOADED: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-homework-file-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-07T15:18:00.000Z', '2026-03-07T15:18:20.000Z'),
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
    visibility: 'scope_only',
  },
  verb: 'file.uploaded',
  refs: {
    actor: EDUCATOR_PRIYA_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
    object: { kind: 'file', id: FILE_IDS.mathWorksheet },
  },
  content: {
    leading: { kind: 'icon', iconKey: 'FileText', tone: 'info' },
    headline: {
      primary: 'File attached for homework',
      secondary: 'fractions-practice-v2.pdf',
    },
    summary: 'Worksheet and answer template uploaded',
    actionButton: {
      label: 'Open class',
      variant: 'outline',
      href: `/iconic-academy/spaces/${CHANNEL_IDS.mathSpace}`,
    },
  },
  state: unread(true),
};

const CLASS_FEEDBACK_REQUESTED: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-feedback-request-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-07T16:00:00.000Z', '2026-03-07T16:00:03.000Z'),
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
    visibility: 'scope_only',
  },
  verb: 'session.feedback_request.sent',
  refs: {
    actor: EDUCATOR_PRIYA_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
    object: { kind: 'session', id: CLASS_SCHEDULE_IDS.math },
  },
  content: {
    leading: { kind: 'icon', iconKey: 'Sparkles', tone: 'info' },
    headline: {
      primary: 'Class feedback requested',
      secondary: 'How was today’s session?',
    },
    summary: 'Takes about 60 seconds.',
    actionButton: {
      label: 'Leave feedback',
      variant: 'default',
      href: `/iconic-academy/spaces/${CHANNEL_IDS.mathSpace}`,
    },
  },
  state: unread(false),
};

const CLASS_SESSION_ENDED: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-session-ended-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-07T16:05:00.000Z', '2026-03-07T16:05:10.000Z'),
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
    visibility: 'scope_only',
  },
  verb: 'session.ended',
  refs: {
    actor: EDUCATOR_PRIYA_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
    object: { kind: 'session', id: CLASS_SCHEDULE_IDS.math },
  },
  content: {
    leading: { kind: 'icon', iconKey: 'Video', tone: 'neutral' },
    headline: {
      primary: 'Class ended',
      secondary: 'Math Foundations - Weekly Session',
    },
    summary: 'Duration: 62 minutes',
  },
  state: unread(true),
};

const CLASS_SESSION_GROUP: ActivityFeedItemVM = {
  kind: 'group',
  ids: { id: 'activity-class-session-group-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-07T16:12:00.000Z', '2026-03-07T16:12:10.000Z'),
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
    visibility: 'scope_only',
  },
  verb: 'class.sessions.rescheduled',
  refs: {
    actor: EDUCATOR_PRIYA_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
    object: { kind: 'session', id: CLASS_SCHEDULE_IDS.math },
  },
  grouping: {
    groupType: 'class',
    groupKey: `live-session:learning_space:${LEARNING_SPACE_IDS.math}:2026-03-07T14:00`,
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
          name: CHILD_TEVIN_PROFILE.profile.displayName,
          avatar: CHILD_TEVIN_PROFILE.profile.avatar,
          themeKey: CHILD_TEVIN_PROFILE.ui?.themeKey ?? null,
        },
        {
          name: GUARDIAN_RILEY_PROFILE.profile.displayName,
          avatar: GUARDIAN_RILEY_PROFILE.profile.avatar,
          themeKey: GUARDIAN_RILEY_PROFILE.ui?.themeKey ?? null,
        },
      ],
      overflowCount: 0,
    },
    headline: {
      primary: 'Class session Sat, Mar 7 at 2:00 PM PT',
      secondary: 'Math Foundations',
    },
    summary: 'Welcome to Class session Sat, Mar 7 at 2:00 PM PT for Math Foundations.',
    actionButton: {
      label: 'Open class',
      variant: 'outline',
      href: `/iconic-academy/spaces/${CHANNEL_IDS.mathSpace}`,
    },
  },
  state: unread(false),
  isCollapsed: true,
  subActivityCount: 10,
  subActivities: {
    items: [
      {
        kind: 'leaf',
        ids: { id: 'activity-summary-posted-sub-1', orgId: DEMO_ORG_ID },
        timestamps: ts('2026-03-07T16:12:00.000Z', '2026-03-07T16:12:10.000Z'),
        tabKey: 'classes',
        audience: {
          scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
          visibility: 'scope_only',
        },
        verb: 'summary.posted',
        refs: {
          actor: EDUCATOR_PRIYA_PROFILE,
          target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
          object: { kind: 'summary', id: MESSAGE_IDS.mathSessionSummary },
        },
        content: {
          headline: {
            primary: 'Session summary posted',
            secondary: 'Math Foundations - Weekly Session',
          },
          summary: 'Fractions fluency, ratio reasoning, and next-step recommendations.',
        },
        state: unread(true),
      },
      CLASS_SESSION_ENDED as ActivityFeedLeafItemVM,
      CLASS_FEEDBACK_REQUESTED as ActivityFeedLeafItemVM,
      HOMEWORK_ATTACHMENT_UPLOADED as ActivityFeedLeafItemVM,
      LESSON_ASSIGNMENT_ASSIGNED as ActivityFeedLeafItemVM,
      HOMEWORK_ASSIGNED as ActivityFeedLeafItemVM,
      STUDENT_JOINED_CLASS as ActivityFeedLeafItemVM,
      CLASS_LIVE_NOW as ActivityFeedLeafItemVM,
      TEACHER_JOINED_CLASS as ActivityFeedLeafItemVM,
      {
        kind: 'leaf',
        ids: { id: 'activity-session-reminder-sub-1', orgId: DEMO_ORG_ID },
        timestamps: ts('2026-03-07T13:55:00.000Z', '2026-03-07T13:55:05.000Z'),
        tabKey: 'classes',
        audience: {
          scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
          visibility: 'scope_only',
        },
        verb: 'session.reminder.sent',
        refs: {
          actor: SYSTEM_PROFILE,
          target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
          object: { kind: 'session', id: CLASS_SCHEDULE_IDS.math },
        },
        content: {
          headline: {
            primary: 'Class starts in 5 mins',
            secondary: 'Math Foundations - Weekly Session',
          },
          summary: 'Join link and materials are ready.',
        },
        state: unread(false),
      },
    ],
    total: 10,
  },
};

const SCHEDULE_UPDATED: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-schedule-updated-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-07T11:30:00.000Z', '2026-03-07T11:31:00.000Z'),
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
    visibility: 'scope_only',
  },
  verb: 'class.updated',
  refs: {
    actor: EDUCATOR_PRIYA_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
  },
  content: {
    leading: { kind: 'icon', iconKey: 'GraduationCap', tone: 'neutral' },
    headline: {
      primary: 'Schedule updated',
      secondary: 'Math Foundations',
    },
    summary: 'Weekly session now starts at 2:00 PM PT',
    actionButton: {
      label: 'Open class',
      variant: 'outline',
      href: `/iconic-academy/spaces/${CHANNEL_IDS.mathSpace}`,
    },
  },
  state: unread(true),
};

const CLASS_UPDATE_INVITED_STUDENT: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-class-update-invite-student-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-06T17:10:00.000Z', '2026-03-06T17:10:15.000Z'),
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
    visibility: 'scope_only',
  },
  verb: 'member.invited',
  refs: {
    actor: EDUCATOR_PRIYA_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
    object: { kind: 'user', id: CHILD_TEHARA_PROFILE.ids.id },
  },
  content: {
    headline: {
      primary: 'Student invited',
      secondary: CHILD_TEHARA_PROFILE.profile.displayName,
    },
    summary: 'Added to Math Foundations roster.',
  },
  state: unread(false),
};

const CLASS_UPDATE_INVITED_GUARDIAN: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-class-update-invite-guardian-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-06T17:11:00.000Z', '2026-03-06T17:11:20.000Z'),
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
    visibility: 'scope_only',
  },
  verb: 'member.invited',
  refs: {
    actor: EDUCATOR_PRIYA_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
    object: { kind: 'user', id: GUARDIAN_RILEY_PROFILE.ids.id },
  },
  content: {
    headline: {
      primary: 'Guardian invited',
      secondary: GUARDIAN_RILEY_PROFILE.profile.displayName,
    },
    summary: 'Class access and notifications enabled.',
  },
  state: unread(false),
};

const CLASS_UPDATE_SESSION_RESCHEDULED: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-class-update-rescheduled-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-06T20:00:00.000Z', '2026-03-06T20:00:20.000Z'),
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
    visibility: 'scope_only',
  },
  verb: 'class.session.rescheduled',
  refs: {
    actor: EDUCATOR_PRIYA_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
    object: { kind: 'session', id: CLASS_SCHEDULE_IDS.math },
  },
  content: {
    headline: {
      primary: 'Class session rescheduled',
      secondary: 'Math Foundations',
    },
    summary:
      'Session: Math Foundations weekly session (Sat Mar 7) moved from 2:00 PM to 2:30 PM PT',
  },
  state: unread(false),
};

const CLASS_UPDATE_SESSION_CANCELLED: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-class-update-cancelled-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-06T22:00:00.000Z', '2026-03-06T22:00:30.000Z'),
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
    visibility: 'scope_only',
  },
  verb: 'class.session.canceled',
  refs: {
    actor: EDUCATOR_PRIYA_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
    object: { kind: 'session', id: CLASS_SCHEDULE_IDS.math },
  },
  content: {
    headline: {
      primary: 'Class session cancelled',
      secondary: 'Math Foundations',
    },
    summary:
      'Session: Math Foundations weekly session (Sat Mar 14, 2:30 PM PT) canceled due to holiday closure',
  },
  state: unread(false),
};

const DIRECT_DM_SINGLE: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-dm-single-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-07T12:45:00.000Z', '2026-03-07T12:45:07.000Z'),
  tabKey: 'all',
  audience: {
    scope: { kind: 'channel', channelId: CHANNEL_IDS.dmElena },
    visibility: 'direct',
  },
  verb: 'message.posted',
  refs: {
    actor: EDUCATOR_ELENA_PROFILE,
    object: { kind: 'message', id: MESSAGE_IDS.dmElena1 },
  },
  content: {
    leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
    headline: {
      primary: `${EDUCATOR_ELENA_PROFILE.profile.displayName} sent you a direct message in`,
      secondary: EDUCATOR_ELENA_PROFILE.profile.displayName,
    },
    summary: 'Can we adjust tomorrow’s assignment difficulty?',
    actionButton: {
      label: 'Open conversation',
      variant: 'outline',
      href: `/iconic-academy/dm/${CHANNEL_IDS.dmElena}`,
    },
  },
  state: unread(false),
};

const DM_MULTIPLE_MESSAGES_GROUP: ActivityFeedItemVM = {
  kind: 'group',
  ids: { id: 'activity-dm-group-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-07T13:20:00.000Z', '2026-03-07T13:21:00.000Z'),
  tabKey: 'all',
  audience: {
    scope: { kind: 'channel', channelId: CHANNEL_IDS.dmPriya },
    visibility: 'direct',
  },
  verb: 'message.posted',
  refs: {
    actor: EDUCATOR_PRIYA_PROFILE,
    target: { kind: 'user', id: GUARDIAN_RILEY_PROFILE.ids.id },
  },
  grouping: {
    groupType: 'message',
    groupKey: `dm:${CHANNEL_IDS.dmPriya}:2026-03-07T13`,
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
      ],
      overflowCount: 0,
    },
    headline: {
      primary: `${EDUCATOR_PRIYA_PROFILE.profile.displayName} sent you multiple direct messages in`,
      secondary: EDUCATOR_PRIYA_PROFILE.profile.displayName,
    },
    summary: '3 new messages in direct conversation',
    actionButton: {
      label: 'Open conversation',
      variant: 'outline',
      href: `/iconic-academy/dm/${CHANNEL_IDS.dmPriya}`,
    },
  },
  state: unread(false),
  isCollapsed: true,
  subActivityCount: 3,
  subActivities: {
    items: [
      {
        kind: 'leaf',
        ids: { id: 'activity-dm-group-sub-1', orgId: DEMO_ORG_ID },
        timestamps: ts('2026-03-07T13:16:00.000Z'),
        tabKey: 'all',
        audience: {
          scope: { kind: 'channel', channelId: CHANNEL_IDS.dmPriya },
          visibility: 'direct',
        },
        verb: 'message.posted',
        refs: {
          actor: EDUCATOR_PRIYA_PROFILE,
          object: { kind: 'message', id: MESSAGE_IDS.dmPriya1 },
        },
        content: {
          headline: { primary: 'Please review Tevin’s worksheet attempt' },
          summary: 'I added notes on questions 6 and 9.',
        },
        state: unread(true),
      },
      {
        kind: 'leaf',
        ids: { id: 'activity-dm-group-sub-2', orgId: DEMO_ORG_ID },
        timestamps: ts('2026-03-07T13:18:00.000Z'),
        tabKey: 'all',
        audience: {
          scope: { kind: 'channel', channelId: CHANNEL_IDS.dmPriya },
          visibility: 'direct',
        },
        verb: 'message.posted',
        refs: {
          actor: EDUCATOR_PRIYA_PROFILE,
          object: { kind: 'message', id: MESSAGE_IDS.dmPriya2 },
        },
        content: {
          headline: { primary: 'Also attaching a quick revision plan' },
          summary: 'Should take about 20 minutes tonight.',
        },
        state: unread(false),
      },
      {
        kind: 'leaf',
        ids: { id: 'activity-dm-group-sub-3', orgId: DEMO_ORG_ID },
        timestamps: ts('2026-03-07T13:19:30.000Z'),
        tabKey: 'all',
        audience: {
          scope: { kind: 'channel', channelId: CHANNEL_IDS.dmPriya },
          visibility: 'direct',
        },
        verb: 'message.posted',
        refs: {
          actor: EDUCATOR_PRIYA_PROFILE,
          object: { kind: 'message', id: MESSAGE_IDS.mathFeedbackRequest },
        },
        content: {
          headline: { primary: 'Can you confirm availability for Monday?' },
          summary: 'I can offer a short prep call.',
        },
        state: unread(false),
      },
    ],
    total: 3,
  },
};

const MENTIONED_YOU: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-mentioned-you-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-07T10:10:00.000Z', '2026-03-07T10:10:10.000Z'),
  tabKey: 'all',
  audience: {
    scope: { kind: 'channel', channelId: CHANNEL_IDS.support },
    visibility: 'direct',
  },
  verb: 'message.posted',
  refs: {
    actor: STAFF_SUPPORT_PROFILE,
    object: { kind: 'message', id: MESSAGE_IDS.supportReply },
  },
  content: {
    leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
    headline: {
      primary: 'Someone mentioned you in',
      secondary: STAFF_SUPPORT_PROFILE.profile.displayName,
    },
    summary: '@Riley We can update session reminders to 30 mins.',
    actionButton: {
      label: 'Open conversation',
      variant: 'outline',
      href: `/iconic-academy/c/${CHANNEL_IDS.support}`,
    },
  },
  state: unread(false),
};

const PAYMENT_REMINDER: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-payment-reminder-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-07T09:00:00.000Z', '2026-03-07T09:00:05.000Z'),
  tabKey: 'payment',
  audience: {
    scope: { kind: 'global' },
    visibility: 'direct',
  },
  verb: 'payment.reminder.sent',
  refs: {
    actor: SYSTEM_PROFILE,
  },
  content: {
    leading: { kind: 'icon', iconKey: 'CreditCard', tone: 'warning' },
    headline: {
      primary: 'Payment reminder',
      secondary: 'Invoice INV-2026-0312',
    },
    summary: 'Due Mar 12, 11:59 PM PT - $240.00',
    actionButton: {
      label: 'Pay now',
      variant: 'default',
      href: '/iconic-academy/billing',
    },
  },
  state: { importance: 'important', isRead: false },
};

const PAYMENT_RECEIVED: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-payment-received-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-05T12:22:00.000Z', '2026-03-05T12:22:03.000Z'),
  tabKey: 'payment',
  audience: {
    scope: { kind: 'global' },
    visibility: 'direct',
  },
  verb: 'payment.received',
  refs: {
    actor: SYSTEM_PROFILE,
  },
  content: {
    leading: { kind: 'icon', iconKey: 'CreditCard', tone: 'success' },
    headline: {
      primary: 'Payment received',
      secondary: 'Invoice INV-2026-0305',
    },
    summary: '$240.00 paid successfully.',
    actionButton: {
      label: 'View receipt',
      variant: 'outline',
      href: '/iconic-academy/billing',
    },
  },
  state: unread(true),
};

const CLASS_SETUP_GROUP: ActivityFeedItemVM = {
  kind: 'group',
  ids: { id: 'activity-class-setup-group-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-04T18:02:00.000Z', '2026-03-04T18:02:05.000Z'),
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
    visibility: 'scope_only',
  },
  verb: 'class.updated',
  refs: {
    actor: EDUCATOR_PRIYA_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
  },
  grouping: {
    groupType: 'class',
    groupKey: `class-setup:${LEARNING_SPACE_IDS.math}:2026-03-04T18`,
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
          name: SYSTEM_PROFILE.profile.displayName,
          avatar: SYSTEM_PROFILE.profile.avatar,
          themeKey: SYSTEM_PROFILE.ui?.themeKey ?? null,
        },
      ],
      overflowCount: 0,
    },
    headline: {
      primary: 'Class created and assigned',
      secondary: 'Math Foundations',
    },
    summary: 'Initial setup completed with first weekly session scheduled.',
    actionButton: {
      label: 'View class',
      variant: 'outline',
      href: `/iconic-academy/spaces/${CHANNEL_IDS.mathSpace}`,
    },
  },
  state: unread(false),
  isCollapsed: true,
  subActivityCount: 4,
  subActivities: {
    items: [
      {
        kind: 'leaf',
        ids: { id: 'activity-session-scheduled-sub-1', orgId: DEMO_ORG_ID },
        timestamps: ts('2026-03-04T18:02:00.000Z'),
        tabKey: 'classes',
        audience: {
          scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
          visibility: 'scope_only',
        },
        verb: 'class.session.scheduled',
        refs: {
          actor: EDUCATOR_PRIYA_PROFILE,
          target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
          object: { kind: 'session', id: CLASS_SCHEDULE_IDS.math },
        },
        content: {
          headline: {
            primary: 'Lesson scheduled',
            secondary: 'Math Foundations',
          },
          summary: 'First session: Sat 2:00 PM PT',
        },
        state: unread(true),
      },
      {
        kind: 'leaf',
        ids: { id: 'activity-class-created-invite-guardian-sub-1', orgId: DEMO_ORG_ID },
        timestamps: ts('2026-03-04T18:01:30.000Z'),
        tabKey: 'classes',
        audience: {
          scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
          visibility: 'scope_only',
        },
        verb: 'member.invited',
        refs: {
          actor: EDUCATOR_PRIYA_PROFILE,
          target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
          object: { kind: 'user', id: GUARDIAN_RILEY_PROFILE.ids.id },
        },
        content: {
          headline: {
            primary: 'Guardian invited',
            secondary: 'Riley Morgan',
          },
        },
        state: unread(false),
      },
      {
        kind: 'leaf',
        ids: { id: 'activity-class-created-invite-student-sub-1', orgId: DEMO_ORG_ID },
        timestamps: ts('2026-03-04T18:01:00.000Z'),
        tabKey: 'classes',
        audience: {
          scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
          visibility: 'scope_only',
        },
        verb: 'member.invited',
        refs: {
          actor: EDUCATOR_PRIYA_PROFILE,
          target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
          object: { kind: 'user', id: CHILD_TEHARA_PROFILE.ids.id },
        },
        content: {
          headline: {
            primary: 'Student invited',
            secondary: 'Tehara Morgan',
          },
          summary: 'Added to Math Foundations roster.',
        },
        state: unread(false),
      },
      {
        kind: 'leaf',
        ids: { id: 'activity-class-created-sub-1', orgId: DEMO_ORG_ID },
        timestamps: ts('2026-03-04T18:00:00.000Z'),
        tabKey: 'classes',
        audience: {
          scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
          visibility: 'scope_only',
        },
        verb: 'class.created',
        refs: {
          actor: EDUCATOR_PRIYA_PROFILE,
          target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
        },
        content: {
          headline: {
            primary: 'Class created',
            secondary: 'Math Foundations',
          },
          summary: 'Weekly small-group class initialized.',
        },
        state: unread(true),
      },
    ],
    total: 4,
  },
};

const CLASS_UPDATED_GROUP: ActivityFeedItemVM = {
  kind: 'group',
  ids: { id: 'activity-class-updated-group-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-07T11:30:00.000Z', '2026-03-07T11:31:00.000Z'),
  tabKey: 'classes',
  audience: {
    scope: { kind: 'learning_space', learningSpaceId: LEARNING_SPACE_IDS.math },
    visibility: 'scope_only',
  },
  verb: 'class.updated',
  refs: {
    actor: EDUCATOR_PRIYA_PROFILE,
    target: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
  },
  grouping: {
    groupType: 'class',
    groupKey: `class-updated:${LEARNING_SPACE_IDS.math}:2026-W10`,
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
          name: CHILD_TEHARA_PROFILE.profile.displayName,
          avatar: CHILD_TEHARA_PROFILE.profile.avatar,
          themeKey: CHILD_TEHARA_PROFILE.ui?.themeKey ?? null,
        },
        {
          name: GUARDIAN_RILEY_PROFILE.profile.displayName,
          avatar: GUARDIAN_RILEY_PROFILE.profile.avatar,
          themeKey: GUARDIAN_RILEY_PROFILE.ui?.themeKey ?? null,
        },
      ],
      overflowCount: 0,
    },
    headline: {
      primary: 'Class updated',
      secondary: 'Math Foundations',
    },
    summary: 'Schedule changes, cancellations, and new participant invites.',
    actionButton: {
      label: 'View class',
      variant: 'outline',
      href: `/iconic-academy/spaces/${CHANNEL_IDS.mathSpace}`,
    },
  },
  state: unread(false),
  isCollapsed: true,
  subActivityCount: 5,
  subActivities: {
    items: [
      SCHEDULE_UPDATED as ActivityFeedLeafItemVM,
      CLASS_UPDATE_SESSION_CANCELLED as ActivityFeedLeafItemVM,
      CLASS_UPDATE_SESSION_RESCHEDULED as ActivityFeedLeafItemVM,
      CLASS_UPDATE_INVITED_GUARDIAN as ActivityFeedLeafItemVM,
      CLASS_UPDATE_INVITED_STUDENT as ActivityFeedLeafItemVM,
    ],
    total: 5,
  },
};

const SYSTEM_NOTICE: ActivityFeedItemVM = {
  kind: 'leaf',
  ids: { id: 'activity-system-notice-1', orgId: DEMO_ORG_ID },
  timestamps: ts('2026-03-03T08:00:00.000Z', '2026-03-03T08:00:02.000Z'),
  tabKey: 'system',
  audience: {
    scope: { kind: 'global' },
    visibility: 'direct',
  },
  verb: 'system.notice',
  refs: {
    actor: SYSTEM_PROFILE,
  },
  content: {
    leading: { kind: 'icon', iconKey: 'Bell', tone: 'info' },
    headline: {
      primary: 'Platform maintenance completed',
      secondary: 'No action required',
    },
    summary: 'Improved stability for live classes and messaging.',
  },
  state: unread(true),
};

const TODAY_ITEMS: ActivityFeedItemVM[] = [
  CLASS_SESSION_GROUP,
  CLASS_UPDATED_GROUP,
  DIRECT_DM_SINGLE,
  DM_MULTIPLE_MESSAGES_GROUP,
  MENTIONED_YOU,
  PAYMENT_REMINDER,
];

const THIS_WEEK_ITEMS: ActivityFeedItemVM[] = [
  CLASS_SETUP_GROUP,
  PAYMENT_RECEIVED,
  SYSTEM_NOTICE,
];

function countUnread(items: ActivityFeedItemVM[]) {
  return items.reduce((total, item) => {
    if (item.kind === 'group') {
      const subUnread =
        item.subActivities?.items.filter(
          (sub: ActivityFeedLeafItemVM) => !sub.state?.isRead,
        ).length ?? 0;
      return total + (subUnread > 0 ? subUnread : item.state?.isRead ? 0 : 1);
    }
    return total + (item.state?.isRead ? 0 : 1);
  }, 0);
}

const ALL_ITEMS = [...TODAY_ITEMS, ...THIS_WEEK_ITEMS];
const CLASSES_ITEMS = ALL_ITEMS.filter((item) => item.tabKey === 'classes');
const PAYMENT_ITEMS = ALL_ITEMS.filter((item) => item.tabKey === 'payment');
const SYSTEM_ITEMS = ALL_ITEMS.filter((item) => item.tabKey === 'system');

export const INBOX_ACTIVITY_FEED: ActivityFeedVM = {
  activeTab: 'all',
  tabs: [
    { key: 'all', label: 'All', badgeCount: countUnread(ALL_ITEMS) },
    { key: 'classes', label: 'Classes', badgeCount: countUnread(CLASSES_ITEMS) },
    { key: 'payment', label: 'Payment', badgeCount: countUnread(PAYMENT_ITEMS) },
    { key: 'system', label: 'System', badgeCount: countUnread(SYSTEM_ITEMS) },
  ],
  sections: [
    {
      label: 'Today',
      items: TODAY_ITEMS,
    },
    {
      label: 'This week',
      items: THIS_WEEK_ITEMS,
    },
  ],
  nextCursor: null,
  unreadCount: countUnread(ALL_ITEMS),
};
