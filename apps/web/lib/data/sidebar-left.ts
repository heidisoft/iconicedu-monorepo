import type { SidebarLeftDataVM } from '@iconicedu/shared-types';
import { GUARDIAN_ACCOUNT } from '@iconicedu/web/lib/data/accounts';
import { LEARNING_SPACES } from '@iconicedu/web/lib/data/learning-spaces';
import { DIRECT_MESSAGE_CHANNELS_WITH_MESSAGES } from '@iconicedu/web/lib/data/channel-message-data';
import { CHANNEL_IDS } from '@iconicedu/web/lib/data/ids';
import { GUARDIAN_RILEY_PROFILE } from '@iconicedu/web/lib/data/profiles';

export const SIDEBAR_LEFT_DATA: SidebarLeftDataVM = {
  user: {
    profile: GUARDIAN_RILEY_PROFILE,
    account: GUARDIAN_ACCOUNT,
  },
  navigation: {
    navMain: [
      {
        title: 'Home',
        url: '/iconic-academy',
        icon: 'home',
      },
      {
        title: 'Calendar',
        url: '/iconic-academy/class-schedule',
        icon: 'class-schedule',
      },
      {
        title: 'Notifications',
        url: '/iconic-academy/notifications',
        icon: 'notifications',
        count: 3,
      },
    ],
    navSecondary: [
      {
        title: '24/7 Live Support',
        url: `/iconic-academy/c/${CHANNEL_IDS.support}`,
        icon: 'life-buoy',
      },
    ],
  },
  collections: {
    learningSpaces: LEARNING_SPACES,
    directMessages: DIRECT_MESSAGE_CHANNELS_WITH_MESSAGES,
  },
};
