import { buildListData } from '@/components/messages/message-list';
import type { MessageVM } from '@iconicedu/shared-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSender(id: string, name = 'Sender') {
  return {
    kind: 'educator',
    ids: { id, orgId: 'org-1', accountId: `acc-${id}` },
    profile: {
      displayName: name,
      avatar: {
        source: 'seed' as const,
        seed: id,
        url: null,
        updatedAt: '2025-01-01T00:00:00Z',
      },
    },
    prefs: {},
    meta: { createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
  } as unknown as MessageVM['core']['sender'];
}

function makeMsg(
  id: string,
  senderId: string,
  createdAt: string,
  senderName = 'Sender',
): MessageVM {
  return {
    ids: { id, orgId: 'org-1' },
    core: {
      type: 'text',
      sender: makeSender(senderId, senderName),
      createdAt,
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: {},
    content: { text: `Message ${id}` },
  } as unknown as MessageVM;
}

function isDateSep(item: { _type?: string }): boolean {
  return item._type === 'date-separator';
}

// ─── buildListData ────────────────────────────────────────────────────────────

describe('buildListData', () => {
  it('returns an empty array for no messages', () => {
    expect(buildListData([])).toEqual([]);
  });

  it('inserts a date separator before the first message of each day', () => {
    const msgs = [
      makeMsg('a', 'u1', '2025-12-17T10:00:00Z'),
      makeMsg('b', 'u1', '2025-12-17T11:00:00Z'),
      makeMsg('c', 'u1', '2025-12-18T09:00:00Z'),
    ];
    const items = buildListData(msgs);

    // Expected: [sep-Dec17, a, b, sep-Dec18, c]
    expect(items).toHaveLength(5);
    expect(isDateSep(items[0]!)).toBe(true);
    expect(isDateSep(items[1]!)).toBe(false); // message a
    expect(isDateSep(items[2]!)).toBe(false); // message b
    expect(isDateSep(items[3]!)).toBe(true); // sep for Dec 18
    expect(isDateSep(items[4]!)).toBe(false); // message c
  });

  it('produces only one separator per day even with many messages', () => {
    const msgs = [
      makeMsg('a', 'u1', '2025-12-17T08:00:00Z'),
      makeMsg('b', 'u1', '2025-12-17T09:00:00Z'),
      makeMsg('c', 'u1', '2025-12-17T10:00:00Z'),
    ];
    const items = buildListData(msgs);
    const seps = items.filter(isDateSep);
    expect(seps).toHaveLength(1);
  });

  it('includes a separator for each new calendar day', () => {
    const msgs = [
      makeMsg('a', 'u1', '2025-12-17T10:00:00Z'),
      makeMsg('b', 'u1', '2025-12-18T10:00:00Z'),
      makeMsg('c', 'u1', '2025-12-19T10:00:00Z'),
    ];
    const items = buildListData(msgs);
    const seps = items.filter(isDateSep);
    expect(seps).toHaveLength(3);
  });

  it('preserves the message order (oldest-first)', () => {
    const msgs = [
      makeMsg('a', 'u1', '2025-12-17T10:00:00Z'),
      makeMsg('b', 'u2', '2025-12-17T11:00:00Z'),
    ];
    const items = buildListData(msgs);
    const msgItems = items.filter((i) => !isDateSep(i)) as MessageVM[];
    expect(msgItems[0]!.ids.id).toBe('a');
    expect(msgItems[1]!.ids.id).toBe('b');
  });

  it('date separator label is "Today" for today\'s messages', () => {
    const now = new Date().toISOString();
    const items = buildListData([makeMsg('a', 'u1', now)]);
    const sep = items.find(isDateSep) as { label: string } | undefined;
    expect(sep?.label).toBe('Today');
  });

  it('reversed output puts newest message at index 0', () => {
    const msgs = [
      makeMsg('oldest', 'u1', '2025-12-17T08:00:00Z'),
      makeMsg('newest', 'u1', '2025-12-17T10:00:00Z'),
    ];
    // MessageList reverses buildListData before passing to FlatList
    const reversed = [...buildListData(msgs)].reverse();
    const msgItems = reversed.filter((i) => !isDateSep(i)) as MessageVM[];
    expect(msgItems[0]!.ids.id).toBe('newest');
    expect(msgItems[msgItems.length - 1]!.ids.id).toBe('oldest');
  });

  it('date separators appear above their day in the reversed list', () => {
    // Messages on Dec 17 and Dec 18
    const msgs = [
      makeMsg('a', 'u1', '2025-12-17T10:00:00Z'),
      makeMsg('b', 'u1', '2025-12-18T10:00:00Z'),
    ];
    const reversed = [...buildListData(msgs)].reverse();
    // Reversed: [b, sep-Dec18, a, sep-Dec17]
    // In inverted FlatList this renders visually: sep-Dec17, a, sep-Dec18, b
    // Sep for Dec 18 should appear at index 1 (just above b at index 0)
    expect(isDateSep(reversed[0]!)).toBe(false); // b (newest) at bottom
    expect(isDateSep(reversed[1]!)).toBe(true); // sep-Dec18 above b
    expect(isDateSep(reversed[2]!)).toBe(false); // a
    expect(isDateSep(reversed[3]!)).toBe(true); // sep-Dec17 at top
  });
});

// ─── isGroupStart logic (derived from message-list renderItem) ────────────────

describe('isGroupStart logic', () => {
  function computeIsGroupStart(
    msgs: MessageVM[],
    targetIndex: number, // index in the REVERSED (newest-first) list
  ): boolean {
    const reversed = [...buildListData(msgs)].reverse();
    const item = reversed[targetIndex];
    if (!item || isDateSep(item)) return false;

    // Mirror the renderItem logic: walk forward to find prevMsg (older)
    let prevMsg: MessageVM | null = null;
    for (let i = targetIndex + 1; i < reversed.length; i++) {
      const candidate = reversed[i];
      if (!isDateSep(candidate)) {
        prevMsg = candidate as MessageVM;
        break;
      }
    }

    const timeDiffMinutes = prevMsg
      ? (new Date((item as MessageVM).core.createdAt).getTime() -
          new Date(prevMsg.core.createdAt).getTime()) /
        60_000
      : Infinity;

    return (
      !prevMsg ||
      prevMsg.core.sender.ids.id !== (item as MessageVM).core.sender.ids.id ||
      timeDiffMinutes > 5
    );
  }

  it('first message in list is always a group start', () => {
    const msgs = [makeMsg('a', 'u1', '2025-12-17T10:00:00Z')];
    expect(computeIsGroupStart(msgs, 0)).toBe(true);
  });

  it('same sender within 5 minutes is NOT a group start', () => {
    const msgs = [
      makeMsg('a', 'u1', '2025-12-17T10:00:00Z'),
      makeMsg('b', 'u1', '2025-12-17T10:03:00Z'), // 3 min later
    ];
    // reversed: [b(0), a(1)]; b's prevMsg = a (same sender, 3 min gap)
    expect(computeIsGroupStart(msgs, 0)).toBe(false);
  });

  it('same sender after >5 minute gap IS a group start', () => {
    const msgs = [
      makeMsg('a', 'u1', '2025-12-17T10:00:00Z'),
      makeMsg('b', 'u1', '2025-12-17T10:06:00Z'), // 6 min later
    ];
    expect(computeIsGroupStart(msgs, 0)).toBe(true);
  });

  it('different sender in consecutive messages IS a group start', () => {
    const msgs = [
      makeMsg('a', 'u1', '2025-12-17T10:00:00Z'),
      makeMsg('b', 'u2', '2025-12-17T10:01:00Z'), // different sender
    ];
    expect(computeIsGroupStart(msgs, 0)).toBe(true);
  });

  it('own messages also participate in grouping', () => {
    const msgs = [
      makeMsg('a', 'owner', '2025-12-17T10:00:00Z'),
      makeMsg('b', 'owner', '2025-12-17T10:02:00Z'), // same owner, 2 min
    ];
    expect(computeIsGroupStart(msgs, 0)).toBe(false);
  });

  it('own message after different sender is a group start', () => {
    const msgs = [
      makeMsg('a', 'other', '2025-12-17T10:00:00Z'),
      makeMsg('b', 'owner', '2025-12-17T10:01:00Z'),
    ];
    expect(computeIsGroupStart(msgs, 0)).toBe(true);
  });
});
