import type { MessageMentionVM } from '@iconicedu/shared-types';
import {
  buildMessageDraftStorageKey,
  isMessageDraftExpired,
  MESSAGE_DRAFT_STORAGE_VERSION,
  type MessageDraftEntry,
} from '@iconicedu/shared-types';

/**
 * Thin localStorage-backed store for message drafts (see
 * `@iconicedu/shared-types/shared/message-drafts` for the schema). This is a
 * plain module-level singleton rather than React context because drafts need
 * to be readable from two separate parts of the component tree that don't
 * share a provider (the composer inside `MessagesShell` and the channel/DM
 * list rows in the sidebar) — both live in the same browser tab, so a
 * `CustomEvent` on `window` (the same pattern already used for
 * `dm:mark-read`) is enough to keep them in sync without prop drilling.
 */

export type MessageDraftScope = Pick<
  MessageDraftEntry,
  'accountId' | 'profileId' | 'orgId' | 'channelId' | 'threadId'
>;

/** Fired on `window` whenever a draft is written or cleared. */
export const MESSAGE_DRAFT_CHANGE_EVENT = 'iconicedu:message-draft-changed';

export type MessageDraftChangeEventDetail = {
  key: string;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function dispatchDraftChanged(key: string) {
  if (!isBrowser()) return;
  window.dispatchEvent(
    new CustomEvent<MessageDraftChangeEventDetail>(MESSAGE_DRAFT_CHANGE_EVENT, {
      detail: { key },
    }),
  );
}

/**
 * Reads a draft for the given scope, discarding (and clearing) it if it has
 * expired. Returns `null` when there is no draft, storage is unavailable, or
 * the stored payload can't be parsed.
 */
export function readMessageDraft(scope: MessageDraftScope): MessageDraftEntry | null {
  if (!isBrowser()) return null;

  const key = buildMessageDraftStorageKey(scope);
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as MessageDraftEntry;
    if (
      !parsed ||
      typeof parsed.content !== 'string' ||
      typeof parsed.updatedAt !== 'string'
    ) {
      window.localStorage.removeItem(key);
      return null;
    }
    if (isMessageDraftExpired(parsed)) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

export function hasNonExpiredDraft(scope: MessageDraftScope): boolean {
  return readMessageDraft(scope) !== null;
}

export function writeMessageDraft(input: {
  scope: MessageDraftScope;
  content: string;
  mentions?: MessageMentionVM[];
}): void {
  if (!isBrowser()) return;

  const key = buildMessageDraftStorageKey(input.scope);
  const entry: MessageDraftEntry = {
    version: MESSAGE_DRAFT_STORAGE_VERSION,
    accountId: input.scope.accountId,
    profileId: input.scope.profileId,
    orgId: input.scope.orgId,
    channelId: input.scope.channelId,
    threadId: input.scope.threadId ?? null,
    content: input.content,
    mentions: input.mentions,
    updatedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(entry));
    dispatchDraftChanged(key);
  } catch {
    // Storage can throw (quota exceeded, private browsing) — drafts are a
    // best-effort convenience, never something a send should be blocked on.
  }
}

export function clearMessageDraft(scope: MessageDraftScope): void {
  if (!isBrowser()) return;
  const key = buildMessageDraftStorageKey(scope);
  window.localStorage.removeItem(key);
  dispatchDraftChanged(key);
}

/**
 * Removes every draft belonging to a given account+profile, regardless of
 * channel/thread. Intended for a future "clear drafts on logout / profile
 * switch" hook — see the web report for why it isn't wired to sign-out yet.
 */
export function clearAllMessageDraftsForProfile(input: {
  accountId: string;
  profileId: string;
}): void {
  if (!isBrowser()) return;
  const prefix = `message-draft:${input.accountId}:${input.profileId}:`;
  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => {
    window.localStorage.removeItem(key);
    dispatchDraftChanged(key);
  });
}
