import type { MessagesContainerTabKey } from './messages-container-tabs';

const STORAGE_PREFIX = 'messages-container-tab';

export function getMessagesContainerTabStorageKey(
  orgId: string,
  channelId: string,
): string {
  return `${STORAGE_PREFIX}:${orgId}:${channelId}`;
}

export function readMessagesContainerPersistedTab(
  storageKey: string,
): MessagesContainerTabKey | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    if (raw === 'messages' || raw === 'files' || raw === 'schedule' || raw === 'members') {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function persistMessagesContainerTab(
  storageKey: string,
  tab: MessagesContainerTabKey,
): void {
  try {
    window.localStorage.setItem(storageKey, tab);
  } catch {
    // best effort
  }
}
