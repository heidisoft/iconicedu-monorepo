/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { getChannelMetadata } from './channel-info-panel';

describe('channel-info-panel metadata', () => {
  it('builds channel metadata rows including created and visibility', () => {
    const metadata = getChannelMetadata({
      ids: { id: 'channel-1', orgId: 'org-1' },
      basics: {
        kind: 'channel',
        topic: 'General',
        visibility: 'private',
        purpose: 'general',
      },
      lifecycle: {
        status: 'active',
        createdBy: 'profile-1',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
      postingPolicy: { kind: 'members-only' },
      collections: {
        participants: [],
        messages: { items: [] },
        media: { items: [] },
        files: { items: [] },
      },
    } as any);

    expect(metadata.map((row) => row.label)).toEqual([
      'Created',
      'Visibility',
      'Purpose',
      'Posting',
      'Status',
    ]);
    expect(metadata.find((row) => row.label === 'Visibility')?.value).toBe('private');
  });
});
