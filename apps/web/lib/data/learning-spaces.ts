import type { LearningSpaceVM } from '@iconicedu/shared-types';
import {
  CHANNEL_IDS,
  LEARNING_SPACE_IDS,
  DEMO_ORG_ID,
} from '@iconicedu/web/lib/data/ids';
import {
  CHILD_MAYA_PROFILE,
  CHILD_TEHARA_PROFILE,
  CHILD_TEVIN_PROFILE,
  EDUCATOR_ELENA_PROFILE,
  EDUCATOR_LUCAS_PROFILE,
  EDUCATOR_MISHAN_PROFILE,
  EDUCATOR_PRIYA_PROFILE,
  GUARDIAN_RILEY_PROFILE,
} from '@iconicedu/web/lib/data/profiles';
import {
  CHESS_SCHEDULE_EVENT,
  ELA_SCHEDULE_EVENT,
  MATH_SCHEDULE_EVENT,
  SCIENCE_SCHEDULE_EVENT,
} from '@iconicedu/web/lib/data/class-schedule-events';
import { LEARNING_SPACE_CHANNELS_BY_ID } from '@iconicedu/web/lib/data/channel-message-data';

export const LEARNING_SPACES: LearningSpaceVM[] = [
  {
    ids: { id: LEARNING_SPACE_IDS.math, orgId: DEMO_ORG_ID },
    basics: {
      kind: 'one_on_one',
      status: 'active',
      title: 'Math Foundations',
      iconKey: 'square-pi',
      subject: 'MATH',
      description: 'Build core math confidence with weekly practice.',
    },
    channels: {
      primaryChannel: LEARNING_SPACE_CHANNELS_BY_ID[CHANNEL_IDS.mathSpace],
    },
    schedule: {
      scheduleSeries: MATH_SCHEDULE_EVENT,
    },
    resources: {
      links: [
        {
          label: 'Join Zoom',
          iconKey: 'video',
          url: MATH_SCHEDULE_EVENT.meetingLink,
          status: 'active',
        },
        {
          label: 'Math Workbook',
          iconKey: 'folder',
          url: 'https://files.example.com/math-workbook.pdf',
          status: 'active',
        },
        {
          label: 'Homework Hub',
          iconKey: 'graduation-cap',
          url: 'https://iconic.edu/homework/math',
          status: 'active',
        },
      ],
    },
    lifecycle: {
      createdAt: '2025-12-15T08:00:00.000Z',
      createdBy: EDUCATOR_PRIYA_PROFILE.ids.id,
      archivedAt: null,
    },
    participants: [EDUCATOR_PRIYA_PROFILE, GUARDIAN_RILEY_PROFILE, CHILD_TEVIN_PROFILE],
  },
  {
    ids: { id: LEARNING_SPACE_IDS.science, orgId: DEMO_ORG_ID },
    basics: {
      kind: 'one_on_one',
      status: 'active',
      title: 'Science Lab Explorers',
      iconKey: 'earth',
      subject: 'SCIENCE',
      description: 'Hands-on lab activities and inquiry skills.',
    },
    channels: {
      primaryChannel: LEARNING_SPACE_CHANNELS_BY_ID[CHANNEL_IDS.scienceSpace],
    },
    schedule: {
      scheduleSeries: SCIENCE_SCHEDULE_EVENT,
    },
    resources: {
      links: [
        {
          label: 'Join Zoom',
          iconKey: 'video',
          url: SCIENCE_SCHEDULE_EVENT.meetingLink,
          status: 'active',
        },
        {
          label: 'Lab Kit Checklist',
          iconKey: 'folder',
          url: 'https://files.example.com/science-kit-checklist.pdf',
          status: 'active',
        },
        {
          label: 'Weekly Experiments',
          iconKey: 'graduation-cap',
          url: 'https://iconic.edu/resources/science',
          status: 'active',
        },
      ],
    },
    lifecycle: {
      createdAt: '2025-12-18T08:30:00.000Z',
      createdBy: EDUCATOR_LUCAS_PROFILE.ids.id,
      archivedAt: null,
    },
    participants: [EDUCATOR_LUCAS_PROFILE, GUARDIAN_RILEY_PROFILE, CHILD_TEHARA_PROFILE],
  },
  {
    ids: { id: LEARNING_SPACE_IDS.ela, orgId: DEMO_ORG_ID },
    basics: {
      kind: 'one_on_one',
      status: 'active',
      title: 'Writing Workshop',
      iconKey: 'languages',
      subject: 'ELA',
      description: 'Writing practice with structured feedback.',
    },
    channels: {
      primaryChannel: LEARNING_SPACE_CHANNELS_BY_ID[CHANNEL_IDS.elaSpace],
    },
    schedule: {
      scheduleSeries: ELA_SCHEDULE_EVENT,
    },
    resources: {
      links: [
        {
          label: 'Join Zoom',
          iconKey: 'video',
          url: ELA_SCHEDULE_EVENT.meetingLink,
          status: 'active',
        },
        {
          label: 'Story Prompts',
          iconKey: 'folder',
          url: 'https://files.example.com/story-prompt.pdf',
          status: 'active',
        },
        {
          label: 'Writing Guide',
          iconKey: 'graduation-cap',
          url: 'https://iconic.edu/resources/ela',
          status: 'active',
        },
      ],
    },
    lifecycle: {
      createdAt: '2025-12-20T09:15:00.000Z',
      createdBy: EDUCATOR_ELENA_PROFILE.ids.id,
      archivedAt: null,
    },
    participants: [EDUCATOR_ELENA_PROFILE, GUARDIAN_RILEY_PROFILE, CHILD_MAYA_PROFILE],
  },
  {
    ids: { id: LEARNING_SPACE_IDS.chess, orgId: DEMO_ORG_ID },
    basics: {
      kind: 'one_on_one',
      status: 'active',
      title: 'Chess Strategy Lab',
      iconKey: 'chef-hat',
      subject: 'CHESS',
      description: 'Weekly strategy session and tactical puzzles.',
    },
    channels: {
      primaryChannel: LEARNING_SPACE_CHANNELS_BY_ID[CHANNEL_IDS.chessSpace],
    },
    schedule: {
      scheduleSeries: CHESS_SCHEDULE_EVENT,
    },
    resources: {
      links: [
        {
          label: 'Join Zoom',
          iconKey: 'video',
          url: CHESS_SCHEDULE_EVENT.meetingLink,
          status: 'active',
        },
        {
          label: 'Tactics Library',
          iconKey: 'folder',
          url: 'https://iconic.edu/resources/chess',
          status: 'active',
        },
        {
          label: 'Puzzle Pack',
          iconKey: 'graduation-cap',
          url: 'https://files.example.com/chess-puzzles.pdf',
          status: 'active',
        },
      ],
    },
    lifecycle: {
      createdAt: '2025-12-22T08:30:00.000Z',
      createdBy: EDUCATOR_MISHAN_PROFILE.ids.id,
      archivedAt: null,
    },
    participants: [EDUCATOR_MISHAN_PROFILE, GUARDIAN_RILEY_PROFILE, CHILD_TEVIN_PROFILE],
  },
];

export const LEARNING_SPACE_BY_CHANNEL_ID: Record<string, LearningSpaceVM> = {
  [CHANNEL_IDS.mathSpace]: LEARNING_SPACES[0],
  [CHANNEL_IDS.scienceSpace]: LEARNING_SPACES[1],
  [CHANNEL_IDS.elaSpace]: LEARNING_SPACES[2],
  [CHANNEL_IDS.chessSpace]: LEARNING_SPACES[3],
};
