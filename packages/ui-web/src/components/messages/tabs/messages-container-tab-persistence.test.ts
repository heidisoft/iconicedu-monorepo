import { beforeEach, describe, expect, it } from 'vitest';
import {
  getMessagesContainerTabStorageKey,
  persistMessagesContainerTab,
  readMessagesContainerPersistedTab,
} from './messages-container-tab-persistence';

describe('messages-container-tab-persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('builds a channel-scoped storage key', () => {
    expect(getMessagesContainerTabStorageKey('org-1', 'channel-1')).toBe(
      'messages-container-tab:org-1:channel-1',
    );
  });

  it('persists and reads tab keys', () => {
    const key = getMessagesContainerTabStorageKey('org-1', 'channel-1');
    persistMessagesContainerTab(key, 'files');
    expect(readMessagesContainerPersistedTab(key)).toBe('files');
  });

  it('supports persisting members tab', () => {
    const key = getMessagesContainerTabStorageKey('org-1', 'channel-1');
    persistMessagesContainerTab(key, 'members');
    expect(readMessagesContainerPersistedTab(key)).toBe('members');
  });

  it('ignores invalid persisted values', () => {
    const key = getMessagesContainerTabStorageKey('org-1', 'channel-1');
    window.localStorage.setItem(key, 'invalid');
    expect(readMessagesContainerPersistedTab(key)).toBeNull();
  });
});
