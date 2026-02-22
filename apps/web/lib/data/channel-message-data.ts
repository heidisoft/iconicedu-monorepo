import type { ChannelVM } from '@iconicedu/shared-types';
import { CHANNEL_IDS, LEARNING_SPACE_IDS, DEMO_ORG_ID } from '@iconicedu/web/lib/data/ids';
import {
  CHILD_MAYA_PROFILE,
  CHILD_TEHARA_PROFILE,
  CHILD_TEVIN_PROFILE,
  EDUCATOR_AVA_PROFILE,
  EDUCATOR_ELENA_PROFILE,
  EDUCATOR_LUCAS_PROFILE,
  EDUCATOR_MISHAN_PROFILE,
  EDUCATOR_PRIYA_PROFILE,
  GUARDIAN_RILEY_PROFILE,
  STAFF_SUPPORT_PROFILE,
} from '@iconicedu/web/lib/data/profiles';
import {
  CHESS_CHANNEL_MESSAGES,
  DM_AVA_MESSAGES,
  DM_ELENA_MESSAGES,
  DM_LUCAS_MESSAGES,
  DM_MISHAN_MESSAGES,
  DM_PRIYA_MESSAGES,
  ELA_CHANNEL_MESSAGES,
  MATH_CHANNEL_MESSAGES,
  SCIENCE_CHANNEL_MESSAGES,
  SUPPORT_CHANNEL_MESSAGES,
} from '@iconicedu/web/lib/data/channel-messages';
import {
  DM_PRIYA_FILES,
  DM_ELENA_FILES,
  ELA_CHANNEL_FILES,
  MATH_CHANNEL_FILES,
  SCIENCE_CHANNEL_FILES,
} from '@iconicedu/web/lib/data/channel-files';
import { DM_PRIYA_MEDIA, MATH_CHANNEL_MEDIA } from '@iconicedu/web/lib/data/channel-media';

const mathChannel: ChannelVM = {
  ids: { id: CHANNEL_IDS.mathSpace, orgId: DEMO_ORG_ID },
  basics: {
    kind: 'channel',
    topic: 'Math Foundations',
    iconKey: 'square-pi',
    description: 'Math skills and confidence building.',
    visibility: 'private',
    purpose: 'learning-space',
  },
  lifecycle: {
    status: 'active',
    createdBy: EDUCATOR_PRIYA_PROFILE.ids.id,
    createdAt: '2025-12-15T08:00:00.000Z',
    archivedAt: null,
  },
  postingPolicy: {
    kind: 'members-only',
    allowThreads: true,
    allowReactions: true,
  },
  context: {
    primaryEntity: { kind: 'learning_space', id: LEARNING_SPACE_IDS.math },
    capabilities: ['has_schedule', 'has_homework', 'has_summaries'],
  },
  collections: {
    participants: [EDUCATOR_PRIYA_PROFILE, GUARDIAN_RILEY_PROFILE, CHILD_TEVIN_PROFILE],
    messages: {
      items: MATH_CHANNEL_MESSAGES,
      total: MATH_CHANNEL_MESSAGES.length,
    },
    media: {
      items: MATH_CHANNEL_MEDIA,
      total: MATH_CHANNEL_MEDIA.length,
    },
    files: {
      items: MATH_CHANNEL_FILES,
      total: MATH_CHANNEL_FILES.length,
    },
    readState: {
      channelId: CHANNEL_IDS.mathSpace,
      lastReadMessageId: MATH_CHANNEL_MESSAGES[MATH_CHANNEL_MESSAGES.length - 1]?.ids.id,
      lastReadAt: '2025-12-21T18:20:00.000Z',
      unreadCount: 0,
    },
  },
  ui: {
    themeKey: 'emerald',
    defaultRightPanelOpen: true,
    defaultRightPanelKey: 'channel_info',
    infoPanel: {
      showHeader: true,
      showDetails: false,
      showMedia: true,
      showMembers: true,
      showQuickActions: true,
      showHiddenQuickActions: false,
    },
    headerQuickMetaActions: [
      { key: 'saved', label: 'Saved' },
      { key: 'homework', label: 'Homework' },
      { key: 'session-summary', label: 'Summaries' },
      { key: 'next-session', label: 'Next Tue 3:00 PM' },
    ],
    headerActions: [{ key: 'info', label: 'Info' }],
    quickActions: [
      { key: 'join', label: 'Join', iconKey: 'video', isPrimary: true },
      { key: 'homework', label: 'Homework', iconKey: 'clipboard-check' },
      { key: 'session-summary', label: 'Class summary', iconKey: 'file-text' },
      { key: 'saved', label: 'Saved', iconKey: 'bookmark' },
      { key: 'more', label: 'More', iconKey: 'more-horizontal' },
    ],
  },
};

const scienceChannel: ChannelVM = {
  ids: { id: CHANNEL_IDS.scienceSpace, orgId: DEMO_ORG_ID },
  basics: {
    kind: 'channel',
    topic: 'Science Lab Explorers',
    iconKey: 'earth',
    description: 'Hands-on science labs and inquiry learning.',
    visibility: 'private',
    purpose: 'learning-space',
  },
  lifecycle: {
    status: 'active',
    createdBy: EDUCATOR_LUCAS_PROFILE.ids.id,
    createdAt: '2025-12-18T08:30:00.000Z',
    archivedAt: null,
  },
  postingPolicy: {
    kind: 'members-only',
    allowThreads: true,
    allowReactions: true,
  },
  context: {
    primaryEntity: { kind: 'learning_space', id: LEARNING_SPACE_IDS.science },
    capabilities: ['has_schedule', 'has_homework'],
  },
  collections: {
    participants: [EDUCATOR_LUCAS_PROFILE, GUARDIAN_RILEY_PROFILE, CHILD_TEHARA_PROFILE],
    messages: {
      items: SCIENCE_CHANNEL_MESSAGES,
      total: SCIENCE_CHANNEL_MESSAGES.length,
    },
    media: { items: [], total: 0 },
    files: { items: SCIENCE_CHANNEL_FILES, total: SCIENCE_CHANNEL_FILES.length },
    readState: {
      channelId: CHANNEL_IDS.scienceSpace,
      lastReadMessageId:
        SCIENCE_CHANNEL_MESSAGES[SCIENCE_CHANNEL_MESSAGES.length - 1]?.ids.id,
      lastReadAt: '2025-12-19T19:00:00.000Z',
      unreadCount: 1,
    },
  },
  ui: {
    themeKey: 'sky',
    defaultRightPanelOpen: true,
    defaultRightPanelKey: 'channel_info',
    infoPanel: {
      showHeader: true,
      showDetails: false,
      showMedia: true,
      showMembers: true,
      showQuickActions: true,
      showHiddenQuickActions: false,
    },
    headerQuickMetaActions: [
      { key: 'saved', label: 'Saved' },
      { key: 'homework', label: 'Homework' },
      { key: 'next-session', label: 'Next Wed 3:30 PM' },
    ],
    headerActions: [{ key: 'info', label: 'Info' }],
    quickActions: [
      { key: 'join', label: 'Join', iconKey: 'video', isPrimary: true },
      { key: 'homework', label: 'Homework', iconKey: 'clipboard-check' },
      { key: 'saved', label: 'Saved', iconKey: 'bookmark' },
      { key: 'more', label: 'More', iconKey: 'more-horizontal' },
    ],
  },
};

const elaChannel: ChannelVM = {
  ids: { id: CHANNEL_IDS.elaSpace, orgId: DEMO_ORG_ID },
  basics: {
    kind: 'channel',
    topic: 'Writing Workshop',
    iconKey: 'languages',
    description: 'Narrative writing and reading comprehension.',
    visibility: 'private',
    purpose: 'learning-space',
  },
  lifecycle: {
    status: 'active',
    createdBy: EDUCATOR_ELENA_PROFILE.ids.id,
    createdAt: '2025-12-20T09:15:00.000Z',
    archivedAt: null,
  },
  postingPolicy: {
    kind: 'members-only',
    allowThreads: true,
    allowReactions: true,
  },
  context: {
    primaryEntity: { kind: 'learning_space', id: LEARNING_SPACE_IDS.ela },
    capabilities: ['has_schedule', 'has_homework', 'has_summaries'],
  },
  collections: {
    participants: [EDUCATOR_ELENA_PROFILE, GUARDIAN_RILEY_PROFILE, CHILD_MAYA_PROFILE],
    messages: {
      items: ELA_CHANNEL_MESSAGES,
      total: ELA_CHANNEL_MESSAGES.length,
    },
    media: { items: [], total: 0 },
    files: { items: ELA_CHANNEL_FILES, total: ELA_CHANNEL_FILES.length },
    readState: {
      channelId: CHANNEL_IDS.elaSpace,
      lastReadMessageId: ELA_CHANNEL_MESSAGES[0]?.ids.id,
      lastReadAt: '2025-12-18T19:10:00.000Z',
      unreadCount: 2,
    },
  },
  ui: {
    themeKey: 'violet',
    defaultRightPanelOpen: true,
    defaultRightPanelKey: 'channel_info',
    infoPanel: {
      showHeader: true,
      showDetails: false,
      showMedia: true,
      showMembers: true,
      showQuickActions: true,
      showHiddenQuickActions: false,
    },
    headerQuickMetaActions: [
      { key: 'saved', label: 'Saved' },
      { key: 'homework', label: 'Homework' },
      { key: 'session-summary', label: 'Summaries' },
      { key: 'next-session', label: 'Next Thu 4:00 PM' },
    ],
    headerActions: [{ key: 'info', label: 'Info' }],
    quickActions: [
      { key: 'join', label: 'Join', iconKey: 'video', isPrimary: true },
      { key: 'homework', label: 'Homework', iconKey: 'clipboard-check' },
      { key: 'session-summary', label: 'Class summary', iconKey: 'file-text' },
      { key: 'saved', label: 'Saved', iconKey: 'bookmark' },
      { key: 'more', label: 'More', iconKey: 'more-horizontal' },
    ],
  },
};

const chessChannel: ChannelVM = {
  ids: { id: CHANNEL_IDS.chessSpace, orgId: DEMO_ORG_ID },
  basics: {
    kind: 'channel',
    topic: 'Chess Strategy Lab',
    iconKey: 'chef-hat',
    description: 'Chess fundamentals and strategic thinking.',
    visibility: 'private',
    purpose: 'learning-space',
  },
  lifecycle: {
    status: 'active',
    createdBy: EDUCATOR_MISHAN_PROFILE.ids.id,
    createdAt: '2025-12-22T08:30:00.000Z',
    archivedAt: null,
  },
  postingPolicy: {
    kind: 'members-only',
    allowThreads: true,
    allowReactions: true,
  },
  context: {
    primaryEntity: { kind: 'learning_space', id: LEARNING_SPACE_IDS.chess },
    capabilities: ['has_schedule'],
  },
  collections: {
    participants: [EDUCATOR_MISHAN_PROFILE, GUARDIAN_RILEY_PROFILE, CHILD_TEVIN_PROFILE],
    messages: {
      items: CHESS_CHANNEL_MESSAGES,
      total: CHESS_CHANNEL_MESSAGES.length,
    },
    media: { items: [], total: 0 },
    files: { items: [], total: 0 },
    readState: {
      channelId: CHANNEL_IDS.chessSpace,
      lastReadMessageId: CHESS_CHANNEL_MESSAGES[0]?.ids.id,
      lastReadAt: '2025-12-18T20:05:00.000Z',
      unreadCount: 1,
    },
  },
  ui: {
    themeKey: 'amber',
    defaultRightPanelOpen: true,
    defaultRightPanelKey: 'channel_info',
    infoPanel: {
      showHeader: true,
      showDetails: false,
      showMedia: true,
      showMembers: true,
      showQuickActions: true,
      showHiddenQuickActions: false,
    },
    headerQuickMetaActions: [
      { key: 'saved', label: 'Saved' },
      { key: 'next-session', label: 'Next Fri 4:30 PM' },
    ],
    headerActions: [{ key: 'info', label: 'Info' }],
    quickActions: [
      { key: 'join', label: 'Join', iconKey: 'video', isPrimary: true },
      { key: 'saved', label: 'Saved', iconKey: 'bookmark' },
      { key: 'more', label: 'More', iconKey: 'more-horizontal' },
    ],
  },
};

const dmPriyaChannel: ChannelVM = {
  ids: { id: CHANNEL_IDS.dmPriya, orgId: DEMO_ORG_ID },
  basics: {
    kind: 'dm',
    topic: 'Priya Nair',
    description: 'Direct messages with Priya.',
    visibility: 'private',
    purpose: 'general',
  },
  lifecycle: {
    status: 'active',
    createdBy: GUARDIAN_RILEY_PROFILE.ids.id,
    createdAt: '2025-12-10T12:00:00.000Z',
    archivedAt: null,
  },
  postingPolicy: {
    kind: 'members-only',
    allowThreads: true,
    allowReactions: true,
  },
  dm: {
    dmKey: `dm:${[GUARDIAN_RILEY_PROFILE.ids.id, EDUCATOR_PRIYA_PROFILE.ids.id].sort().join('-')}`,
  },
  collections: {
    participants: [GUARDIAN_RILEY_PROFILE, EDUCATOR_PRIYA_PROFILE],
    messages: { items: DM_PRIYA_MESSAGES, total: DM_PRIYA_MESSAGES.length },
    media: { items: DM_PRIYA_MEDIA, total: DM_PRIYA_MEDIA.length },
    files: { items: DM_PRIYA_FILES, total: DM_PRIYA_FILES.length },
    readState: {
      channelId: CHANNEL_IDS.dmPriya,
      lastReadMessageId: DM_PRIYA_MESSAGES[DM_PRIYA_MESSAGES.length - 1]?.ids.id,
      lastReadAt: '2025-12-18T17:25:00.000Z',
      unreadCount: 0,
    },
  },
  ui: {
    headerQuickMetaActions: [{ key: 'last-seen', label: 'Last seen 5m ago' }],
    headerActions: [{ key: 'info', label: 'Info' }],
  },
};

const dmElenaChannel: ChannelVM = {
  ids: { id: CHANNEL_IDS.dmElena, orgId: DEMO_ORG_ID },
  basics: {
    kind: 'dm',
    topic: 'Elena Brooks',
    description: 'Direct messages with Elena.',
    visibility: 'private',
    purpose: 'general',
  },
  lifecycle: {
    status: 'active',
    createdBy: GUARDIAN_RILEY_PROFILE.ids.id,
    createdAt: '2025-12-10T12:10:00.000Z',
    archivedAt: null,
  },
  postingPolicy: {
    kind: 'members-only',
    allowThreads: true,
    allowReactions: true,
  },
  dm: {
    dmKey: `dm:${[GUARDIAN_RILEY_PROFILE.ids.id, EDUCATOR_ELENA_PROFILE.ids.id].sort().join('-')}`,
  },
  collections: {
    participants: [GUARDIAN_RILEY_PROFILE, EDUCATOR_ELENA_PROFILE],
    messages: { items: DM_ELENA_MESSAGES, total: DM_ELENA_MESSAGES.length },
    media: { items: [], total: 0 },
    files: {
      items: DM_ELENA_FILES,
      total: DM_ELENA_FILES.length,
    },
    readState: {
      channelId: CHANNEL_IDS.dmElena,
      lastReadMessageId: DM_ELENA_MESSAGES[0]?.ids.id,
      lastReadAt: '2025-12-18T16:45:00.000Z',
      unreadCount: 1,
    },
  },
  ui: {
    headerQuickMetaActions: [{ key: 'last-seen', label: 'Last seen 15m ago' }],
    headerActions: [{ key: 'info', label: 'Info' }],
  },
};

const dmLucasChannel: ChannelVM = {
  ids: { id: CHANNEL_IDS.dmLucas, orgId: DEMO_ORG_ID },
  basics: {
    kind: 'dm',
    topic: 'Lucas Choi',
    description: 'Direct messages with Lucas.',
    visibility: 'private',
    purpose: 'general',
  },
  lifecycle: {
    status: 'active',
    createdBy: GUARDIAN_RILEY_PROFILE.ids.id,
    createdAt: '2025-12-10T12:20:00.000Z',
    archivedAt: null,
  },
  postingPolicy: {
    kind: 'members-only',
    allowThreads: true,
    allowReactions: true,
  },
  dm: {
    dmKey: `dm:${[GUARDIAN_RILEY_PROFILE.ids.id, EDUCATOR_LUCAS_PROFILE.ids.id].sort().join('-')}`,
  },
  collections: {
    participants: [GUARDIAN_RILEY_PROFILE, EDUCATOR_LUCAS_PROFILE],
    messages: { items: DM_LUCAS_MESSAGES, total: DM_LUCAS_MESSAGES.length },
    media: { items: [], total: 0 },
    files: { items: [], total: 0 },
    readState: {
      channelId: CHANNEL_IDS.dmLucas,
      lastReadMessageId: DM_LUCAS_MESSAGES[0]?.ids.id,
      lastReadAt: '2025-12-18T17:55:00.000Z',
      unreadCount: 0,
    },
  },
  ui: {
    headerQuickMetaActions: [{ key: 'last-seen', label: 'Last seen 2m ago' }],
    headerActions: [{ key: 'info', label: 'Info' }],
  },
};

const dmMishanChannel: ChannelVM = {
  ids: { id: CHANNEL_IDS.dmMishan, orgId: DEMO_ORG_ID },
  basics: {
    kind: 'dm',
    topic: 'Mishan Perera',
    description: 'Direct messages with Mishan.',
    visibility: 'private',
    purpose: 'general',
  },
  lifecycle: {
    status: 'active',
    createdBy: GUARDIAN_RILEY_PROFILE.ids.id,
    createdAt: '2025-12-10T12:30:00.000Z',
    archivedAt: null,
  },
  postingPolicy: {
    kind: 'members-only',
    allowThreads: true,
    allowReactions: true,
  },
  dm: {
    dmKey: `dm:${[GUARDIAN_RILEY_PROFILE.ids.id, EDUCATOR_MISHAN_PROFILE.ids.id].sort().join('-')}`,
  },
  collections: {
    participants: [GUARDIAN_RILEY_PROFILE, EDUCATOR_MISHAN_PROFILE],
    messages: { items: DM_MISHAN_MESSAGES, total: DM_MISHAN_MESSAGES.length },
    media: { items: [], total: 0 },
    files: { items: [], total: 0 },
    readState: {
      channelId: CHANNEL_IDS.dmMishan,
      lastReadMessageId: DM_MISHAN_MESSAGES[0]?.ids.id,
      lastReadAt: '2025-12-18T18:15:00.000Z',
      unreadCount: 0,
    },
  },
  ui: {
    headerQuickMetaActions: [{ key: 'last-seen', label: 'Last seen 1m ago' }],
    headerActions: [{ key: 'info', label: 'Info' }],
  },
};

const dmAvaChannel: ChannelVM = {
  ids: { id: CHANNEL_IDS.dmAva, orgId: DEMO_ORG_ID },
  basics: {
    kind: 'dm',
    topic: 'Ava Patel',
    description: 'Direct messages with Ava.',
    visibility: 'private',
    purpose: 'general',
  },
  lifecycle: {
    status: 'active',
    createdBy: GUARDIAN_RILEY_PROFILE.ids.id,
    createdAt: '2025-12-10T12:40:00.000Z',
    archivedAt: null,
  },
  postingPolicy: {
    kind: 'members-only',
    allowThreads: true,
    allowReactions: true,
  },
  dm: {
    dmKey: `dm:${[GUARDIAN_RILEY_PROFILE.ids.id, EDUCATOR_AVA_PROFILE.ids.id].sort().join('-')}`,
  },
  collections: {
    participants: [GUARDIAN_RILEY_PROFILE, EDUCATOR_AVA_PROFILE],
    messages: { items: DM_AVA_MESSAGES, total: DM_AVA_MESSAGES.length },
    media: { items: [], total: 0 },
    files: { items: [], total: 0 },
    readState: {
      channelId: CHANNEL_IDS.dmAva,
      lastReadMessageId: DM_AVA_MESSAGES[0]?.ids.id,
      lastReadAt: '2025-12-18T18:25:00.000Z',
      unreadCount: 0,
    },
  },
  ui: {
    headerQuickMetaActions: [{ key: 'last-seen', label: 'Last seen 8m ago' }],
    headerActions: [{ key: 'info', label: 'Info' }],
  },
};

const supportChannel: ChannelVM = {
  ids: { id: CHANNEL_IDS.support, orgId: DEMO_ORG_ID },
  basics: {
    kind: 'channel',
    topic: 'Support',
    iconKey: 'support',
    description: 'ICONIC support chat channel.',
    visibility: 'private',
    purpose: 'support',
  },
  lifecycle: {
    status: 'active',
    createdBy: STAFF_SUPPORT_PROFILE.ids.id,
    createdAt: '2025-12-01T08:00:00.000Z',
    archivedAt: null,
  },
  postingPolicy: {
    kind: 'members-only',
    allowThreads: true,
    allowReactions: true,
  },
  collections: {
    participants: [STAFF_SUPPORT_PROFILE, GUARDIAN_RILEY_PROFILE],
    messages: { items: SUPPORT_CHANNEL_MESSAGES, total: SUPPORT_CHANNEL_MESSAGES.length },
    media: { items: [], total: 0 },
    files: { items: [], total: 0 },
    readState: {
      channelId: CHANNEL_IDS.support,
      lastReadMessageId:
        SUPPORT_CHANNEL_MESSAGES[SUPPORT_CHANNEL_MESSAGES.length - 1]?.ids.id,
      lastReadAt: '2025-12-18T16:05:00.000Z',
      unreadCount: 0,
    },
  },
  ui: {
    themeKey: 'gray',
    defaultRightPanelOpen: false,
    infoPanel: {
      showHeader: true,
      showDetails: false,
      showMedia: false,
      showMembers: false,
      showQuickActions: false,
      showHiddenQuickActions: false,
    },
    headerQuickMetaActions: [{ key: 'saved', label: 'Saved' }],
    headerActions: [{ key: 'info', label: 'Info', iconKey: 'life-buoy' }],
  },
};

export const LEARNING_SPACE_CHANNELS_WITH_MESSAGES: ChannelVM[] = [
  mathChannel,
  scienceChannel,
  elaChannel,
  chessChannel,
];

export const DIRECT_MESSAGE_CHANNELS_WITH_MESSAGES: ChannelVM[] = [
  dmPriyaChannel,
  dmElenaChannel,
  dmLucasChannel,
  dmMishanChannel,
  dmAvaChannel,
];

export const LEARNING_SPACE_CHANNELS_BY_ID: Record<string, ChannelVM> = {
  [mathChannel.ids.id]: mathChannel,
  [scienceChannel.ids.id]: scienceChannel,
  [elaChannel.ids.id]: elaChannel,
  [chessChannel.ids.id]: chessChannel,
};

export const DIRECT_MESSAGE_CHANNELS_BY_ID: Record<string, ChannelVM> = {
  [dmPriyaChannel.ids.id]: dmPriyaChannel,
  [dmElenaChannel.ids.id]: dmElenaChannel,
  [dmLucasChannel.ids.id]: dmLucasChannel,
  [dmMishanChannel.ids.id]: dmMishanChannel,
  [dmAvaChannel.ids.id]: dmAvaChannel,
};

export const SUPPORT_CHANNEL = supportChannel;
