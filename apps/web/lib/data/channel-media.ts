import type { ChannelMediaItemVM } from '@iconicedu/shared-types';
import { CHANNEL_IDS, MEDIA_IDS, MESSAGE_IDS, DEMO_ORG_ID } from '@iconicedu/web/lib/data/ids';
import {
  CHILD_TEVIN_PROFILE,
  EDUCATOR_PRIYA_PROFILE,
} from '@iconicedu/web/lib/data/profiles';

export const MATH_CHANNEL_MEDIA: ChannelMediaItemVM[] = [
  {
    ids: {
      id: MEDIA_IDS.mathPhoto,
      orgId: DEMO_ORG_ID,
      channelId: CHANNEL_IDS.mathSpace,
    },
    messageId: MESSAGE_IDS.mathHomeworkSubmit,
    senderId: CHILD_TEVIN_PROFILE.ids.id,
    type: 'image',
    url: 'https://images.example.com/fractions-work.jpg',
    name: 'fractions-work.jpg',
    width: 1600,
    height: 1200,
    createdAt: '2025-12-20T19:40:00.000Z',
  },
];

export const DM_PRIYA_MEDIA: ChannelMediaItemVM[] = [
  {
    ids: {
      id: MEDIA_IDS.dmPriyaScreenshot,
      orgId: DEMO_ORG_ID,
      channelId: CHANNEL_IDS.dmPriya,
    },
    messageId: MESSAGE_IDS.dmPriya2,
    senderId: EDUCATOR_PRIYA_PROFILE.ids.id,
    type: 'image',
    url: 'https://images.example.com/fractions-sample.png',
    name: 'fractions-sample.png',
    width: 1200,
    height: 900,
    createdAt: '2025-12-18T17:25:00.000Z',
  },
];
