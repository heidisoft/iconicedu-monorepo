import { describe, expect, it, vi } from 'vitest';

import { ensureSupportChannel } from './ensure-support-channel';

function createSelectChain(result: { data: unknown; error: { message: string } | null }) {
  const chain: {
    eq: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  } = {
    eq: vi.fn(),
    is: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(async () => result),
  };
  chain.eq.mockReturnValue(chain);
  chain.is.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

describe('ensureSupportChannel', () => {
  it('returns existing support channel when one already exists', async () => {
    const selectChain = createSelectChain({
      data: {
        id: 'support-existing',
        topic: 'Live Support',
        icon_key: 'life-buoy',
        ui_theme_key: 'amber',
        ui_defaults: {
          defaultRightPanelOpen: false,
          defaultRightPanelKey: 'channel_info',
          messageUiThemeKey: 'feed',
          disabledTabs: ['members'],
          infoPanel: {
            showHeader: false,
            showDetails: false,
            showMedia: false,
            showMembers: false,
            showQuickActions: false,
            showHiddenQuickActions: false,
          },
        },
        visibility: 'public',
        posting_policy_kind: 'members-only',
        allow_threads: true,
        allow_reactions: true,
      },
      error: null,
    });
    const insert = vi.fn();
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'channels') {
          return {
            select: vi.fn(() => selectChain),
            insert,
          };
        }
        return {};
      }),
    } as never;

    const result = await ensureSupportChannel({
      supabase,
      orgId: 'org-1',
      creatorProfileId: 'profile-1',
    });

    expect(result).toEqual({ channelId: 'support-existing' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('creates a public support channel when one does not exist', async () => {
    const selectChain = createSelectChain({
      data: null,
      error: null,
    });
    const insert = vi.fn(async () => ({ error: null }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'channels') {
          return {
            select: vi.fn(() => selectChain),
            insert,
          };
        }
        return {};
      }),
    } as never;

    const result = await ensureSupportChannel({
      supabase,
      orgId: 'org-1',
      creatorProfileId: 'profile-1',
    });

    expect(typeof result.channelId).toBe('string');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        topic: 'Live Support',
        purpose: 'support',
        icon_key: 'life-buoy',
        ui_theme_key: 'amber',
        ui_defaults: expect.objectContaining({
          defaultRightPanelOpen: false,
          defaultRightPanelKey: 'channel_info',
          messageUiThemeKey: 'feed',
          disabledTabs: expect.arrayContaining(['members']),
          infoPanel: expect.objectContaining({
            showHeader: false,
            showDetails: false,
            showMedia: false,
            showMembers: false,
            showQuickActions: false,
            showHiddenQuickActions: false,
          }),
        }),
        visibility: 'public',
        posting_policy_kind: 'members-only',
      }),
    );
  });

  it('throws when channel insert fails', async () => {
    const selectChain = createSelectChain({
      data: null,
      error: null,
    });
    const insert = vi.fn(async () => ({ error: { message: 'insert failed' } }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'channels') {
          return {
            select: vi.fn(() => selectChain),
            insert,
          };
        }
        return {};
      }),
    } as never;

    await expect(
      ensureSupportChannel({
        supabase,
        orgId: 'org-1',
        creatorProfileId: 'profile-1',
      }),
    ).rejects.toThrow('insert failed');
  });

  it('normalizes an existing support channel to public defaults', async () => {
    const selectChain = createSelectChain({
      data: {
        id: 'support-existing',
        topic: 'Help',
        icon_key: null,
        ui_theme_key: null,
        ui_defaults: null,
        visibility: 'private',
        posting_policy_kind: 'everyone',
        allow_threads: false,
        allow_reactions: false,
      },
      error: null,
    });
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(async () => ({ error: null })),
        })),
      })),
    }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'channels') {
          return {
            select: vi.fn(() => selectChain),
            update,
          };
        }
        return {};
      }),
    } as never;

    const result = await ensureSupportChannel({
      supabase,
      orgId: 'org-1',
      creatorProfileId: 'profile-1',
    });

    expect(result).toEqual({ channelId: 'support-existing' });
    expect(update).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'Live Support',
        icon_key: 'life-buoy',
        ui_theme_key: 'amber',
        ui_defaults: expect.objectContaining({
          defaultRightPanelOpen: false,
          defaultRightPanelKey: 'channel_info',
          messageUiThemeKey: 'feed',
          disabledTabs: expect.arrayContaining(['members']),
          infoPanel: expect.objectContaining({
            showHeader: false,
            showDetails: false,
            showMedia: false,
            showMembers: false,
            showQuickActions: false,
            showHiddenQuickActions: false,
          }),
        }),
      }),
    );
  });
});
