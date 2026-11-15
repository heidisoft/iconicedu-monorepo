import type { MessageMentionVM } from '../vm/message';

/**
 * Local-storage draft schema shared by web (browser storage) and mobile
 * (AsyncStorage). Drafts are per-device and never sent to the server; the
 * scoping fields below are what keys a draft to a specific composer and
 * what isolates one profile's drafts from another's on a shared device.
 */
export interface MessageDraftEntry {
  version: 1;
  accountId: string;
  profileId: string;
  orgId: string;
  channelId: string;
  /** Null/undefined for the main channel composer; set for a thread composer. */
  threadId?: string | null;
  content: string;
  mentions?: MessageMentionVM[];
  updatedAt: string;
}

export const MESSAGE_DRAFT_STORAGE_VERSION = 1;

/** Drafts older than this are treated as expired and discarded on read. */
export const MESSAGE_DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Debounce window between the last keystroke and persisting a draft. */
export const MESSAGE_DRAFT_AUTOSAVE_DEBOUNCE_MS = 750;

export function buildMessageDraftStorageKey(
  input: Pick<
    MessageDraftEntry,
    'accountId' | 'profileId' | 'orgId' | 'channelId' | 'threadId'
  >,
): string {
  return [
    'message-draft',
    input.accountId,
    input.profileId,
    input.orgId,
    input.channelId,
    input.threadId ?? 'main',
  ].join(':');
}

export function isMessageDraftExpired(
  draft: Pick<MessageDraftEntry, 'updatedAt'>,
  now: number = Date.now(),
): boolean {
  const updatedAtMs = Date.parse(draft.updatedAt);
  if (Number.isNaN(updatedAtMs)) {
    return true;
  }
  return now - updatedAtMs > MESSAGE_DRAFT_TTL_MS;
}
