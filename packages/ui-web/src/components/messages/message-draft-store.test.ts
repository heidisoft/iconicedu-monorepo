/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MESSAGE_DRAFT_TTL_MS } from '@iconicedu/shared-types';
import {
  clearAllMessageDraftsForProfile,
  clearMessageDraft,
  hasNonExpiredDraft,
  MESSAGE_DRAFT_CHANGE_EVENT,
  readMessageDraft,
  writeMessageDraft,
} from './message-draft-store';

const scope = {
  accountId: 'account-1',
  profileId: 'profile-1',
  orgId: 'org-1',
  channelId: 'channel-1',
  threadId: null,
};

describe('message-draft-store', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it('returns null when there is no draft', () => {
    expect(readMessageDraft(scope)).toBeNull();
    expect(hasNonExpiredDraft(scope)).toBe(false);
  });

  it('writes and reads back a draft for the given scope', () => {
    writeMessageDraft({ scope, content: 'Hello there', mentions: [] });

    const draft = readMessageDraft(scope);
    expect(draft?.content).toBe('Hello there');
    expect(draft?.accountId).toBe('account-1');
    expect(draft?.profileId).toBe('profile-1');
    expect(hasNonExpiredDraft(scope)).toBe(true);
  });

  it('scopes drafts per channel/thread — a different channel never sees another draft', () => {
    writeMessageDraft({ scope, content: 'Channel one draft' });
    const otherChannelScope = { ...scope, channelId: 'channel-2' };
    expect(readMessageDraft(otherChannelScope)).toBeNull();

    const threadScope = { ...scope, threadId: 'thread-1' };
    writeMessageDraft({ scope: threadScope, content: 'Thread draft' });
    expect(readMessageDraft(scope)?.content).toBe('Channel one draft');
    expect(readMessageDraft(threadScope)?.content).toBe('Thread draft');
  });

  it('never leaks a draft across profiles, even on the same account/channel', () => {
    writeMessageDraft({ scope, content: 'Guardian draft' });
    const otherProfileScope = { ...scope, profileId: 'profile-2' };
    expect(readMessageDraft(otherProfileScope)).toBeNull();
  });

  it('discards and clears a draft older than the TTL', () => {
    const oldTimestamp = new Date(Date.now() - MESSAGE_DRAFT_TTL_MS - 1000).toISOString();
    window.localStorage.setItem(
      'message-draft:account-1:profile-1:org-1:channel-1:main',
      JSON.stringify({
        version: 1,
        ...scope,
        content: 'Stale draft',
        updatedAt: oldTimestamp,
      }),
    );

    expect(readMessageDraft(scope)).toBeNull();
    expect(
      window.localStorage.getItem(
        'message-draft:account-1:profile-1:org-1:channel-1:main',
      ),
    ).toBeNull();
  });

  it('clears a draft explicitly', () => {
    writeMessageDraft({ scope, content: 'To be cleared' });
    expect(hasNonExpiredDraft(scope)).toBe(true);

    clearMessageDraft(scope);
    expect(hasNonExpiredDraft(scope)).toBe(false);
  });

  it('dispatches a change event on write and on clear', () => {
    const handler = vi.fn();
    window.addEventListener(MESSAGE_DRAFT_CHANGE_EVENT, handler);

    writeMessageDraft({ scope, content: 'Event test' });
    expect(handler).toHaveBeenCalledTimes(1);

    clearMessageDraft(scope);
    expect(handler).toHaveBeenCalledTimes(2);

    window.removeEventListener(MESSAGE_DRAFT_CHANGE_EVENT, handler);
  });

  it('clears every draft for a given account+profile regardless of channel', () => {
    writeMessageDraft({ scope, content: 'Channel one' });
    writeMessageDraft({
      scope: { ...scope, channelId: 'channel-2' },
      content: 'Channel two',
    });
    writeMessageDraft({
      scope: { ...scope, profileId: 'profile-2' },
      content: 'Different profile, must survive',
    });

    clearAllMessageDraftsForProfile({ accountId: 'account-1', profileId: 'profile-1' });

    expect(readMessageDraft(scope)).toBeNull();
    expect(readMessageDraft({ ...scope, channelId: 'channel-2' })).toBeNull();
    expect(readMessageDraft({ ...scope, profileId: 'profile-2' })?.content).toBe(
      'Different profile, must survive',
    );
  });
});
