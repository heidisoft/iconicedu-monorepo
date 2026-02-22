import { describe, expect, it } from 'vitest';

import { mapChannelRowToVM } from '@iconicedu/web/lib/channels/mappers/channel.mapper';
import type { ChannelRow } from '@iconicedu/shared-types';

describe('mapChannelRowToVM', () => {
  it('maps ui theme key for learning-space channels', () => {
    const row: ChannelRow = {
      id: 'channel-1',
      org_id: 'org-1',
      kind: 'channel',
      topic: 'Algebra',
      icon_key: 'book-open',
      description: null,
      visibility: 'private',
      purpose: 'learning-space',
      status: 'active',
      dm_key: null,
      posting_policy_kind: 'members-only',
      allow_threads: true,
      allow_reactions: true,
      primary_entity_kind: 'learning_space',
      primary_entity_id: 'space-1',
      ui_theme_key: 'sky',
      created_by_profile_id: 'profile-1',
      created_at: '2026-01-01T00:00:00.000Z',
      archived_at: null,
      created_by: 'profile-1',
      updated_at: '2026-01-01T00:00:00.000Z',
      updated_by: 'profile-1',
      deleted_at: null,
      deleted_by: null,
    };

    const channel = mapChannelRowToVM(row, {
      participants: [],
      messages: [],
      media: [],
      files: [],
      capabilities: [],
    });

    expect(channel.ui?.defaultRightPanelKey).toBe('channel_info');
    expect(channel.ui?.themeKey).toBe('sky');
  });
});

