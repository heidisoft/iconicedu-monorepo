import { describe, expect, it } from 'vitest';

import { shouldReplaceGroupParent } from '@iconicedu/web/lib/activity-feed/projector/group-parent-priority';

describe('shouldReplaceGroupParent', () => {
  it('prefers dms.posted as the parent for grouped direct messages', () => {
    expect(
      shouldReplaceGroupParent({
        groupKey: 'dm-posted:channel-dm-1:2026-03-08T12',
        existingVerb: 'dms.posted',
        nextVerb: 'dm.posted',
      }),
    ).toBe(false);
  });

  it('allows dms.posted to replace a child-owned dm parent', () => {
    expect(
      shouldReplaceGroupParent({
        groupKey: 'dm-posted:channel-dm-1:2026-03-08T12',
        existingVerb: 'dm.posted',
        nextVerb: 'dms.posted',
      }),
    ).toBe(true);
  });

  it('prefers messages.posted as the parent for grouped channel-message groups', () => {
    expect(
      shouldReplaceGroupParent({
        groupKey: 'message-posted:channel-1:2026-03-08T12',
        existingVerb: 'messages.posted',
        nextVerb: 'message.posted',
      }),
    ).toBe(false);
    expect(
      shouldReplaceGroupParent({
        groupKey: 'message-posted:channel-1:2026-03-08T12',
        existingVerb: 'message.posted',
        nextVerb: 'messages.posted',
      }),
    ).toBe(true);
  });

  it('falls back to replacing for unrelated group keys', () => {
    expect(
      shouldReplaceGroupParent({
        groupKey: 'class-updated:space-1:2026-03-08',
        existingVerb: 'class.session.canceled',
        nextVerb: 'class.sessions.canceled',
      }),
    ).toBe(true);
  });
});
