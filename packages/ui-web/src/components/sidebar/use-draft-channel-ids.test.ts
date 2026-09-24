/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeMessageDraft } from '@iconicedu/ui-web/components/messages/message-draft-store';
import { useDraftChannelIds } from './use-draft-channel-ids';

const channels = [
  { id: 'channel-1', orgId: 'org-1' },
  { id: 'channel-2', orgId: 'org-1' },
];

describe('useDraftChannelIds', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('is empty when disabled, even with saved drafts', () => {
    writeMessageDraft({
      scope: {
        accountId: 'account-1',
        profileId: 'profile-1',
        orgId: 'org-1',
        channelId: 'channel-1',
        threadId: null,
      },
      content: 'draft text',
    });

    const { result } = renderHook(() =>
      useDraftChannelIds({
        enabled: false,
        accountId: 'account-1',
        profileId: 'profile-1',
        channels,
      }),
    );

    expect(result.current.size).toBe(0);
  });

  it('includes only channels with a non-expired main-composer draft for this profile', () => {
    writeMessageDraft({
      scope: {
        accountId: 'account-1',
        profileId: 'profile-1',
        orgId: 'org-1',
        channelId: 'channel-1',
        threadId: null,
      },
      content: 'draft text',
    });

    const { result } = renderHook(() =>
      useDraftChannelIds({
        enabled: true,
        accountId: 'account-1',
        profileId: 'profile-1',
        channels,
      }),
    );

    expect(result.current.has('channel-1')).toBe(true);
    expect(result.current.has('channel-2')).toBe(false);
  });

  it('never shows a draft saved by a different profile on the same account', () => {
    writeMessageDraft({
      scope: {
        accountId: 'account-1',
        profileId: 'child-profile',
        orgId: 'org-1',
        channelId: 'channel-1',
        threadId: null,
      },
      content: "child's draft",
    });

    const { result } = renderHook(() =>
      useDraftChannelIds({
        enabled: true,
        accountId: 'account-1',
        profileId: 'guardian-profile',
        channels,
      }),
    );

    expect(result.current.has('channel-1')).toBe(false);
  });

  it('updates live when a draft is saved after the initial render', () => {
    const { result } = renderHook(() =>
      useDraftChannelIds({
        enabled: true,
        accountId: 'account-1',
        profileId: 'profile-1',
        channels,
      }),
    );

    expect(result.current.has('channel-2')).toBe(false);

    act(() => {
      writeMessageDraft({
        scope: {
          accountId: 'account-1',
          profileId: 'profile-1',
          orgId: 'org-1',
          channelId: 'channel-2',
          threadId: null,
        },
        content: 'new draft',
      });
    });

    expect(result.current.has('channel-2')).toBe(true);
  });
});
