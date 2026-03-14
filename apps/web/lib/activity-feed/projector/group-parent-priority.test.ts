import { describe, expect, it } from 'vitest';

import { shouldReplaceGroupParent } from '@iconicedu/web/lib/activity-feed/projector/group-parent-priority';

describe('shouldReplaceGroupParent', () => {
  it('prefers class.created as the parent for class-created groups', () => {
    expect(
      shouldReplaceGroupParent({
        groupKey: 'class-created:space-1',
        existingVerb: 'class.created',
        nextVerb: 'members.invited',
      }),
    ).toBe(false);
  });

  it('allows class.created to replace a child-owned class-created parent', () => {
    expect(
      shouldReplaceGroupParent({
        groupKey: 'class-created:space-1',
        existingVerb: 'members.invited',
        nextVerb: 'class.created',
      }),
    ).toBe(true);
  });

  it('prefers class.updated as the parent for class-updated groups', () => {
    expect(
      shouldReplaceGroupParent({
        groupKey: 'class-updated:space-1:2026-03-08',
        existingVerb: 'members.invited',
        nextVerb: 'member.removed',
      }),
    ).toBe(false);
  });

  it('keeps class.updated as the parent when plural class session updates arrive', () => {
    expect(
      shouldReplaceGroupParent({
        groupKey: 'class-updated:space-1:2026-03-08',
        existingVerb: 'class.updated',
        nextVerb: 'class.sessions.rescheduled',
      }),
    ).toBe(false);
    expect(
      shouldReplaceGroupParent({
        groupKey: 'class-updated:space-1:2026-03-08',
        existingVerb: 'class.updated',
        nextVerb: 'class.sessions.canceled',
      }),
    ).toBe(false);
  });

  it('falls back to replacing for unrelated group keys', () => {
    expect(
      shouldReplaceGroupParent({
        groupKey: 'files:space-1:2026-03-08T12',
        existingVerb: 'file.uploaded',
        nextVerb: 'files.uploaded',
      }),
    ).toBe(true);
  });

  it('prefers messages.posted as the parent for grouped channel-message groups', () => {
    expect(
      shouldReplaceGroupParent({
        groupKey: 'message-posted:channel-1:2026-03-08T12',
        existingVerb: 'message.posted',
        nextVerb: 'messages.posted',
      }),
    ).toBe(true);
    expect(
      shouldReplaceGroupParent({
        groupKey: 'message-posted:channel-1:2026-03-08T12',
        existingVerb: 'messages.posted',
        nextVerb: 'message.posted',
      }),
    ).toBe(false);
  });
});
