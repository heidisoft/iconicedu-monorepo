import type { ChannelCapabilityRecordVM } from '@iconicedu/shared-types';
import { CHANNEL_IDS, DEMO_ORG_ID } from '@iconicedu/web/lib/data/ids';

export const CHANNEL_CAPABILITY_RECORDS: ChannelCapabilityRecordVM[] = [
  {
    ids: {
      id: '64a8c0d1-1d2e-4c3f-8a51-9b1e2f3a4b5c',
      orgId: DEMO_ORG_ID,
      channelId: CHANNEL_IDS.mathSpace,
    },
    capability: 'has_schedule',
    createdAt: '2025-12-15T08:00:00.000Z',
    updatedAt: '2025-12-15T08:00:00.000Z',
  },
  {
    ids: {
      id: '75b9d1e2-2e3f-4d40-9b62-ac2f3a4b5c6d',
      orgId: DEMO_ORG_ID,
      channelId: CHANNEL_IDS.mathSpace,
    },
    capability: 'has_homework',
    createdAt: '2025-12-15T08:00:00.000Z',
    updatedAt: '2025-12-15T08:00:00.000Z',
  },
  {
    ids: {
      id: '86cae2f3-3f40-4e51-8c73-bd3f4a5b6c7e',
      orgId: DEMO_ORG_ID,
      channelId: CHANNEL_IDS.elaSpace,
    },
    capability: 'has_summaries',
    createdAt: '2025-12-20T09:15:00.000Z',
    updatedAt: '2025-12-20T09:15:00.000Z',
  },
  {
    ids: {
      id: '97dbf304-4051-4f62-9d84-ce4f5a6b7c8f',
      orgId: DEMO_ORG_ID,
      channelId: CHANNEL_IDS.scienceSpace,
    },
    capability: 'has_schedule',
    createdAt: '2025-12-18T08:30:00.000Z',
    updatedAt: '2025-12-18T08:30:00.000Z',
  },
  {
    ids: {
      id: 'a8ec0415-5162-4063-8e95-df5a6b7c8d90',
      orgId: DEMO_ORG_ID,
      channelId: CHANNEL_IDS.scienceSpace,
    },
    capability: 'has_homework',
    createdAt: '2025-12-18T08:30:00.000Z',
    updatedAt: '2025-12-18T08:30:00.000Z',
  },
];
