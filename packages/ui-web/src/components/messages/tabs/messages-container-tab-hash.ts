import type { MessagesContainerTabKey } from './messages-container-tabs';

const TAB_HASH_MAP: Record<MessagesContainerTabKey, string> = {
  messages: 'messages',
  files: 'files',
  schedule: 'sessions',
  saved: 'saved',
  members: 'members',
};

const HASH_TAB_MAP: Record<string, MessagesContainerTabKey> = {
  messages: 'messages',
  files: 'files',
  sessions: 'schedule',
  saved: 'saved',
  members: 'members',
};

export function tabKeyToHash(tab: MessagesContainerTabKey): string {
  return TAB_HASH_MAP[tab];
}

export function hashToTabKey(hash: string): MessagesContainerTabKey | null {
  const normalized = hash.replace(/^#/, '').trim().toLowerCase();
  if (!normalized) return null;
  return HASH_TAB_MAP[normalized] ?? null;
}
