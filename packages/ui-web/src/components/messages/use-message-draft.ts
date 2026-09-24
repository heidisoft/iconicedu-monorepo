import { useCallback, useEffect, useRef, useState } from 'react';
import type { MessageMentionVM } from '@iconicedu/shared-types';
import { MESSAGE_DRAFT_AUTOSAVE_DEBOUNCE_MS } from '@iconicedu/shared-types';
import {
  clearMessageDraft,
  readMessageDraft,
  writeMessageDraft,
  type MessageDraftScope,
} from './message-draft-store';

/** How long the transient "Draft saved" / "Draft restored" hint stays visible. */
const DRAFT_STATUS_VISIBLE_MS = 2500;

export type MessageDraftStatus = 'idle' | 'restored' | 'saved';

export type UseMessageDraftInput = {
  /** Master gate — when false, this hook never touches localStorage. */
  enabled: boolean;
  /** Null when required identity isn't resolved yet (e.g. no profile id). */
  scope: MessageDraftScope | null;
};

export type UseMessageDraftResult = {
  /** The draft found on mount for the current scope, if any (read once per scope). */
  restoredDraft: { content: string; mentions?: MessageMentionVM[] } | null;
  /** Call on every composer keystroke; internally debounced. */
  notifyContentChange: (content: string, mentions?: MessageMentionVM[]) => void;
  /** Call after a confirmed send or an explicit "discard draft" — never on a failed send. */
  clearDraft: () => void;
  /** Transient status for a subtle "Draft saved" / "Draft restored" label. */
  status: MessageDraftStatus;
};

function scopeKey(scope: MessageDraftScope | null): string | null {
  if (!scope) return null;
  return [
    scope.accountId,
    scope.profileId,
    scope.orgId,
    scope.channelId,
    scope.threadId ?? 'main',
  ].join(':');
}

export function useMessageDraft({
  enabled,
  scope,
}: UseMessageDraftInput): UseMessageDraftResult {
  const [restoredDraft, setRestoredDraft] = useState<{
    content: string;
    mentions?: MessageMentionVM[];
  } | null>(null);
  const [status, setStatus] = useState<MessageDraftStatus>('idle');
  const debounceTimeoutRef = useRef<number | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);
  const currentScopeRef = useRef<MessageDraftScope | null>(null);
  const key = scopeKey(scope);

  const clearDebounce = useCallback(() => {
    if (debounceTimeoutRef.current !== null) {
      window.clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  const flashStatus = useCallback((next: MessageDraftStatus) => {
    if (statusTimeoutRef.current !== null) {
      window.clearTimeout(statusTimeoutRef.current);
    }
    setStatus(next);
    statusTimeoutRef.current = window.setTimeout(() => {
      setStatus('idle');
      statusTimeoutRef.current = null;
    }, DRAFT_STATUS_VISIBLE_MS);
  }, []);

  // Restore once per distinct scope (channel/thread/profile/account/org).
  useEffect(() => {
    currentScopeRef.current = scope;
    clearDebounce();
    if (!enabled || !scope) {
      setRestoredDraft(null);
      return;
    }
    const draft = readMessageDraft(scope);
    if (draft) {
      setRestoredDraft({ content: draft.content, mentions: draft.mentions });
      flashStatus('restored');
    } else {
      setRestoredDraft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  useEffect(
    () => () => {
      clearDebounce();
      if (statusTimeoutRef.current !== null) {
        window.clearTimeout(statusTimeoutRef.current);
      }
    },
    [clearDebounce],
  );

  const notifyContentChange = useCallback(
    (content: string, mentions?: MessageMentionVM[]) => {
      if (!enabled || !scope) return;
      clearDebounce();
      debounceTimeoutRef.current = window.setTimeout(() => {
        debounceTimeoutRef.current = null;
        const activeScope = currentScopeRef.current;
        if (!activeScope) return;
        if (!content.trim()) {
          // The composer was emptied out — don't let a stale draft resurrect.
          clearMessageDraft(activeScope);
          return;
        }
        writeMessageDraft({ scope: activeScope, content, mentions });
        flashStatus('saved');
      }, MESSAGE_DRAFT_AUTOSAVE_DEBOUNCE_MS);
    },
    [clearDebounce, enabled, flashStatus, scope],
  );

  const clearDraft = useCallback(() => {
    clearDebounce();
    if (!scope) return;
    clearMessageDraft(scope);
    setRestoredDraft(null);
    setStatus('idle');
  }, [clearDebounce, scope]);

  return { restoredDraft, notifyContentChange, clearDraft, status };
}
