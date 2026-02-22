import type { ChannelFileItemVM } from '@iconicedu/shared-types';
import { CHANNEL_IDS, FILE_IDS, MESSAGE_IDS, DEMO_ORG_ID } from '@iconicedu/web/lib/data/ids';
import {
  EDUCATOR_ELENA_PROFILE,
  EDUCATOR_LUCAS_PROFILE,
  EDUCATOR_PRIYA_PROFILE,
} from '@iconicedu/web/lib/data/profiles';

export const MATH_CHANNEL_FILES: ChannelFileItemVM[] = [
  {
    ids: {
      id: FILE_IDS.mathWorksheet,
      orgId: DEMO_ORG_ID,
      channelId: CHANNEL_IDS.mathSpace,
    },
    messageId: MESSAGE_IDS.mathHomework,
    senderId: EDUCATOR_PRIYA_PROFILE.ids.id,
    kind: 'file',
    url: 'https://files.example.com/fractions-practice.pdf',
    name: 'fractions-practice.pdf',
    mimeType: 'application/pdf',
    size: 312000,
    tool: 'pdf',
    createdAt: '2025-12-19T17:30:00.000Z',
  },
];

export const SCIENCE_CHANNEL_FILES: ChannelFileItemVM[] = [
  {
    ids: {
      id: FILE_IDS.scienceLabPdf,
      orgId: DEMO_ORG_ID,
      channelId: CHANNEL_IDS.scienceSpace,
    },
    messageId: MESSAGE_IDS.scienceResource,
    senderId: EDUCATOR_LUCAS_PROFILE.ids.id,
    kind: 'file',
    url: 'https://files.example.com/science-lab-guide.pdf',
    name: 'science-lab-guide.pdf',
    mimeType: 'application/pdf',
    size: 402000,
    tool: 'pdf',
    createdAt: '2025-12-19T18:45:00.000Z',
  },
];

export const ELA_CHANNEL_FILES: ChannelFileItemVM[] = [
  {
    ids: {
      id: FILE_IDS.elaEssayDoc,
      orgId: DEMO_ORG_ID,
      channelId: CHANNEL_IDS.elaSpace,
    },
    messageId: MESSAGE_IDS.elaHomework,
    senderId: EDUCATOR_ELENA_PROFILE.ids.id,
    kind: 'file',
    url: 'https://files.example.com/story-prompt.pdf',
    name: 'story-prompt.pdf',
    mimeType: 'application/pdf',
    size: 156000,
    tool: 'pdf',
    createdAt: '2025-12-18T19:25:00.000Z',
  },
];

export const DM_PRIYA_FILES: ChannelFileItemVM[] = [
  {
    ids: {
      id: FILE_IDS.dmPriyaPdf,
      orgId: DEMO_ORG_ID,
      channelId: CHANNEL_IDS.dmPriya,
    },
    messageId: MESSAGE_IDS.dmPriya1,
    senderId: EDUCATOR_PRIYA_PROFILE.ids.id,
    kind: 'file',
    url: 'https://files.example.com/fractions-sample.pdf',
    name: 'fractions-sample.pdf',
    mimeType: 'application/pdf',
    size: 280000,
    tool: 'pdf',
    createdAt: '2025-12-18T17:10:00.000Z',
  },
];

export const DM_ELENA_FILES: ChannelFileItemVM[] = [
  {
    ids: {
      id: FILE_IDS.dmElenaDoc,
      orgId: DEMO_ORG_ID,
      channelId: CHANNEL_IDS.dmElena,
    },
    messageId: MESSAGE_IDS.dmElena1,
    senderId: EDUCATOR_ELENA_PROFILE.ids.id,
    kind: 'file',
    url: 'https://files.example.com/story-outline.docx',
    name: 'story-outline.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 182000,
    tool: 'word',
    createdAt: '2025-12-18T16:40:00.000Z',
  },
];
