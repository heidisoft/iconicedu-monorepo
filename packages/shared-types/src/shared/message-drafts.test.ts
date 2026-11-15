import { describe, expect, it } from 'vitest';

import {
  MESSAGE_DRAFT_TTL_MS,
  buildMessageDraftStorageKey,
  isMessageDraftExpired,
} from './message-drafts';

describe('@iconicedu/shared-types message drafts', () => {
  it('builds a storage key scoped to account, profile, org, channel and thread', () => {
    expect(
      buildMessageDraftStorageKey({
        accountId: 'acc-1',
        profileId: 'prof-1',
        orgId: 'org-1',
        channelId: 'chan-1',
        threadId: 'thread-1',
      }),
    ).toBe('message-draft:acc-1:prof-1:org-1:chan-1:thread-1');
  });

  it('falls back to "main" when there is no thread', () => {
    expect(
      buildMessageDraftStorageKey({
        accountId: 'acc-1',
        profileId: 'prof-1',
        orgId: 'org-1',
        channelId: 'chan-1',
      }),
    ).toBe('message-draft:acc-1:prof-1:org-1:chan-1:main');
  });

  it('treats a draft older than the TTL as expired', () => {
    const now = Date.now();
    const stale = new Date(now - MESSAGE_DRAFT_TTL_MS - 1000).toISOString();
    const fresh = new Date(now - 1000).toISOString();

    expect(isMessageDraftExpired({ updatedAt: stale }, now)).toBe(true);
    expect(isMessageDraftExpired({ updatedAt: fresh }, now)).toBe(false);
  });

  it('treats an unparsable timestamp as expired', () => {
    expect(isMessageDraftExpired({ updatedAt: 'not-a-date' })).toBe(true);
  });
});
