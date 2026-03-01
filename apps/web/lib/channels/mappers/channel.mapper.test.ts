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
      ui_defaults: {
        defaultRightPanelOpen: false,
        defaultRightPanelKey: 'saved',
        infoPanel: {
          showMembers: false,
          showMedia: false,
        },
      },
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

    expect(channel.ui?.defaultRightPanelOpen).toBe(false);
    expect(channel.ui?.defaultRightPanelKey).toBe('saved');
    expect(channel.ui?.infoPanel?.showMembers).toBe(false);
    expect(channel.ui?.themeKey).toBe('sky');
  });

  it('does not auto-open the right panel for learning-space channels without explicit ui defaults', () => {
    const row: ChannelRow = {
      id: 'channel-2',
      org_id: 'org-1',
      kind: 'channel',
      topic: 'Science',
      icon_key: 'flask-conical',
      description: null,
      visibility: 'private',
      purpose: 'learning-space',
      status: 'active',
      dm_key: null,
      posting_policy_kind: 'members-only',
      allow_threads: true,
      allow_reactions: true,
      primary_entity_kind: 'learning_space',
      primary_entity_id: 'space-2',
      ui_theme_key: null,
      ui_defaults: null,
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

    expect(channel.ui?.defaultRightPanelOpen).toBeUndefined();
    expect(channel.ui?.defaultRightPanelKey).toBe('channel_info');
  });

  it('maps provider-neutral live session config from live_session_config', () => {
    const row: ChannelRow = {
      id: 'channel-3',
      org_id: 'org-1',
      kind: 'channel',
      topic: 'Physics',
      icon_key: null,
      description: null,
      visibility: 'private',
      purpose: 'learning-space',
      status: 'active',
      dm_key: null,
      posting_policy_kind: 'members-only',
      allow_threads: true,
      allow_reactions: true,
      primary_entity_kind: null,
      primary_entity_id: null,
      ui_theme_key: null,
      ui_defaults: null,
      live_session_config: {
        enabled: true,
        provider: 'daily',
        mode: 'video',
      },
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

    expect(channel.context?.liveSession).toEqual({
      enabled: true,
      provider: 'daily',
      mode: 'video',
    });
  });
});
