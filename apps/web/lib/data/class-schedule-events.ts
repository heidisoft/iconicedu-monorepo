import type { ClassScheduleVM } from '@iconicedu/shared-types';
import {
  CHANNEL_IDS,
  CLASS_SCHEDULE_IDS,
  LEARNING_SPACE_IDS,
  DEMO_ORG_ID,
  RECURRENCE_IDS,
} from '@iconicedu/web/lib/data/ids';
import {
  CHILD_MAYA_PROFILE,
  CHILD_TEHARA_PROFILE,
  CHILD_TEVIN_PROFILE,
  EDUCATOR_ELENA_PROFILE,
  EDUCATOR_LUCAS_PROFILE,
  EDUCATOR_MISHAN_PROFILE,
  EDUCATOR_PRIYA_PROFILE,
} from '@iconicedu/web/lib/data/profiles';

export const MATH_SCHEDULE_EVENT: ClassScheduleVM = {
  ids: { id: CLASS_SCHEDULE_IDS.math, orgId: DEMO_ORG_ID },
  title: 'Math: Foundations & Fluency',
  description: 'Weekly math session focused on number sense and fluency.',
  location: 'Zoom',
  meetingLink: 'https://us06web.zoom.us/j/82163287655?pwd=MujGqqespu4eUIe6zE3CpLqasOp6Nu.1',
  startAt: '2026-01-06T23:00:00.000Z',
  endAt: '2026-01-06T23:45:00.000Z',
  timezone: 'America/Los_Angeles',
  status: 'scheduled',
  visibility: 'class-members',
  themeKey: 'emerald',
  participants: [
    {
      ids: { id: EDUCATOR_PRIYA_PROFILE.ids.id, orgId: DEMO_ORG_ID },
      role: 'educator',
      status: 'accepted',
      displayName: EDUCATOR_PRIYA_PROFILE.profile.displayName,
      avatarUrl: EDUCATOR_PRIYA_PROFILE.profile.avatar.url ?? null,
      themeKey: EDUCATOR_PRIYA_PROFILE.ui?.themeKey ?? null,
    },
    {
      ids: { id: CHILD_TEVIN_PROFILE.ids.id, orgId: DEMO_ORG_ID },
      role: 'child',
      status: 'accepted',
      displayName: CHILD_TEVIN_PROFILE.profile.displayName,
      avatarUrl: CHILD_TEVIN_PROFILE.profile.avatar.url ?? null,
      themeKey: CHILD_TEVIN_PROFILE.ui?.themeKey ?? null,
    },
  ],
  source: {
    kind: 'class_session',
    learningSpaceId: LEARNING_SPACE_IDS.math,
    channelId: CHANNEL_IDS.mathSpace,
  },
  recurrence: {
    ids: { id: RECURRENCE_IDS.math, orgId: DEMO_ORG_ID },
    rule: {
      frequency: 'weekly',
      interval: 1,
      byWeekday: ['TU'],
      timezone: 'America/Los_Angeles',
    },
    exceptions: [
      {
        occurrenceKey: '2026-01-27T23:00:00.000Z',
        reason: 'Spring break',
      },
    ],
    overrides: [
      {
        occurrenceKey: '2026-01-13T23:00:00.000Z',
        patch: {
          startAt: '2026-01-13T23:30:00.000Z',
          endAt: '2026-01-14T00:15:00.000Z',
          location: 'Zoom (updated link)',
        },
      },
    ],
  },
  audit: {
    createdAt: '2025-12-15T08:00:00.000Z',
    createdBy: EDUCATOR_PRIYA_PROFILE.ids.id,
    updatedAt: '2026-01-01T10:00:00.000Z',
    updatedBy: EDUCATOR_PRIYA_PROFILE.ids.id,
  },
};

export const SCIENCE_SCHEDULE_EVENT: ClassScheduleVM = {
  ids: { id: CLASS_SCHEDULE_IDS.science, orgId: DEMO_ORG_ID },
  title: 'Science Lab Explorers',
  description: 'Hands-on experiments and guided inquiry.',
  location: 'Zoom',
  meetingLink: 'https://us06web.zoom.us/j/88676118659?pwd=gsLCQZrCkU60T91Dc37DaaNiWdsgTq.1',
  startAt: '2026-01-07T23:30:00.000Z',
  endAt: '2026-01-08T00:15:00.000Z',
  timezone: 'America/Los_Angeles',
  status: 'scheduled',
  visibility: 'class-members',
  themeKey: 'sky',
  participants: [
    {
      ids: { id: EDUCATOR_LUCAS_PROFILE.ids.id, orgId: DEMO_ORG_ID },
      role: 'educator',
      status: 'accepted',
      displayName: EDUCATOR_LUCAS_PROFILE.profile.displayName,
      avatarUrl: EDUCATOR_LUCAS_PROFILE.profile.avatar.url ?? null,
      themeKey: EDUCATOR_LUCAS_PROFILE.ui?.themeKey ?? null,
    },
    {
      ids: { id: CHILD_TEHARA_PROFILE.ids.id, orgId: DEMO_ORG_ID },
      role: 'child',
      status: 'accepted',
      displayName: CHILD_TEHARA_PROFILE.profile.displayName,
      avatarUrl: CHILD_TEHARA_PROFILE.profile.avatar.url ?? null,
      themeKey: CHILD_TEHARA_PROFILE.ui?.themeKey ?? null,
    },
  ],
  source: {
    kind: 'class_session',
    learningSpaceId: LEARNING_SPACE_IDS.science,
    channelId: CHANNEL_IDS.scienceSpace,
  },
  recurrence: {
    ids: { id: RECURRENCE_IDS.science, orgId: DEMO_ORG_ID },
    rule: {
      frequency: 'weekly',
      interval: 1,
      byWeekday: ['WE'],
      timezone: 'America/Los_Angeles',
    },
    overrides: [
      {
        occurrenceKey: '2026-01-14T23:30:00.000Z',
        patch: {
          description: 'Special lab: volcano reaction',
        },
      },
    ],
  },
  audit: {
    createdAt: '2025-12-18T08:30:00.000Z',
    createdBy: EDUCATOR_LUCAS_PROFILE.ids.id,
    updatedAt: '2026-01-01T09:00:00.000Z',
    updatedBy: EDUCATOR_LUCAS_PROFILE.ids.id,
  },
};

export const ELA_SCHEDULE_EVENT: ClassScheduleVM = {
  ids: { id: CLASS_SCHEDULE_IDS.ela, orgId: DEMO_ORG_ID },
  title: 'ELA: Writing Workshop',
  description: 'Crafting narratives and improving clarity.',
  location: 'Zoom',
  meetingLink: 'https://us06web.zoom.us/j/82163287655?pwd=MujGqqespu4eUIe6zE3CpLqasOp6Nu.1',
  startAt: '2026-01-08T00:00:00.000Z',
  endAt: '2026-01-08T00:45:00.000Z',
  timezone: 'America/Los_Angeles',
  status: 'scheduled',
  visibility: 'class-members',
  themeKey: 'violet',
  participants: [
    {
      ids: { id: EDUCATOR_ELENA_PROFILE.ids.id, orgId: DEMO_ORG_ID },
      role: 'educator',
      status: 'accepted',
      displayName: EDUCATOR_ELENA_PROFILE.profile.displayName,
      avatarUrl: EDUCATOR_ELENA_PROFILE.profile.avatar.url ?? null,
      themeKey: EDUCATOR_ELENA_PROFILE.ui?.themeKey ?? null,
    },
    {
      ids: { id: CHILD_MAYA_PROFILE.ids.id, orgId: DEMO_ORG_ID },
      role: 'child',
      status: 'accepted',
      displayName: CHILD_MAYA_PROFILE.profile.displayName,
      avatarUrl: CHILD_MAYA_PROFILE.profile.avatar.url ?? null,
      themeKey: CHILD_MAYA_PROFILE.ui?.themeKey ?? null,
    },
  ],
  source: {
    kind: 'class_session',
    learningSpaceId: LEARNING_SPACE_IDS.ela,
    channelId: CHANNEL_IDS.elaSpace,
  },
  recurrence: {
    ids: { id: RECURRENCE_IDS.ela, orgId: DEMO_ORG_ID },
    rule: {
      frequency: 'weekly',
      interval: 1,
      byWeekday: ['TH'],
      timezone: 'America/Los_Angeles',
    },
    overrides: [
      {
        occurrenceKey: '2026-01-15T00:00:00.000Z',
        patch: {
          startAt: '2026-01-15T00:15:00.000Z',
          endAt: '2026-01-15T01:00:00.000Z',
        },
      },
    ],
  },
  audit: {
    createdAt: '2025-12-20T09:15:00.000Z',
    createdBy: EDUCATOR_ELENA_PROFILE.ids.id,
    updatedAt: '2026-01-01T09:45:00.000Z',
    updatedBy: EDUCATOR_ELENA_PROFILE.ids.id,
  },
};

export const CHESS_SCHEDULE_EVENT: ClassScheduleVM = {
  ids: { id: CLASS_SCHEDULE_IDS.chess, orgId: DEMO_ORG_ID },
  title: 'Chess Strategy Lab',
  description: 'Build opening strategies and tactical awareness.',
  location: 'Zoom',
  meetingLink: 'https://us06web.zoom.us/j/88676118659?pwd=gsLCQZrCkU60T91Dc37DaaNiWdsgTq.1',
  startAt: '2026-01-02T23:30:00.000Z',
  endAt: '2026-01-03T00:15:00.000Z',
  timezone: 'America/Los_Angeles',
  status: 'scheduled',
  visibility: 'class-members',
  themeKey: 'amber',
  participants: [
    {
      ids: { id: EDUCATOR_MISHAN_PROFILE.ids.id, orgId: DEMO_ORG_ID },
      role: 'educator',
      status: 'accepted',
      displayName: EDUCATOR_MISHAN_PROFILE.profile.displayName,
      avatarUrl: EDUCATOR_MISHAN_PROFILE.profile.avatar.url ?? null,
      themeKey: EDUCATOR_MISHAN_PROFILE.ui?.themeKey ?? null,
    },
    {
      ids: { id: CHILD_TEVIN_PROFILE.ids.id, orgId: DEMO_ORG_ID },
      role: 'child',
      status: 'accepted',
      displayName: CHILD_TEVIN_PROFILE.profile.displayName,
      avatarUrl: CHILD_TEVIN_PROFILE.profile.avatar.url ?? null,
      themeKey: CHILD_TEVIN_PROFILE.ui?.themeKey ?? null,
    },
  ],
  source: {
    kind: 'class_session',
    learningSpaceId: LEARNING_SPACE_IDS.chess,
    channelId: CHANNEL_IDS.chessSpace,
  },
  recurrence: {
    ids: { id: RECURRENCE_IDS.chess, orgId: DEMO_ORG_ID },
    rule: {
      frequency: 'weekly',
      interval: 1,
      byWeekday: ['FR'],
      timezone: 'America/Los_Angeles',
    },
    exceptions: [
      {
        occurrenceKey: '2026-01-23T23:30:00.000Z',
        reason: 'Tournament week',
      },
    ],
  },
  audit: {
    createdAt: '2025-12-22T08:30:00.000Z',
    createdBy: EDUCATOR_MISHAN_PROFILE.ids.id,
    updatedAt: '2026-01-01T09:00:00.000Z',
    updatedBy: EDUCATOR_MISHAN_PROFILE.ids.id,
  },
};

export const baseEvents: ClassScheduleVM[] = [
  MATH_SCHEDULE_EVENT,
  SCIENCE_SCHEDULE_EVENT,
  ELA_SCHEDULE_EVENT,
  CHESS_SCHEDULE_EVENT,
];
