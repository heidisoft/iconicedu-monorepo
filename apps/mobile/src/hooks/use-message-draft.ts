import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildMessageDraftStorageKey,
  isMessageDraftExpired,
  MESSAGE_DRAFT_AUTOSAVE_DEBOUNCE_MS,
  MESSAGE_DRAFT_STORAGE_VERSION,
  type MessageDraftEntry,
  type MessageMentionVM,
} from '@iconicedu/shared-types';

const DRAFT_KEY_PREFIX = 'message-draft:';

// Lets the conversation list refresh after a write lands, including the final
// flush that runs as a composer unmounts (which can finish after the list
// regains focus and has already re-read storage).
const draftWriteListeners = new Set<() => void>();
function notifyDraftWritten() {
  draftWriteListeners.forEach((listener) => listener());
}

export type MessageDraftScope = {
  accountId: string;
  profileId: string;
  orgId: string;
  channelId: string;
  /** Null/undefined for the main channel composer; set for a thread composer. */
  threadId?: string | null;
};

export type RestoredMessageDraft = {
  content: string;
  mentions?: MessageMentionVM[];
};

export type MessageDraftStatus = 'idle' | 'restored' | 'saved';

export type UseMessageDraftResult = {
  /** Call on every composer content change; persistence is debounced internally. */
  notifyContentChanged: (content: string, mentions?: MessageMentionVM[]) => void;
  /** Clears the persisted draft immediately. Call only after a CONFIRMED send. */
  clearDraft: () => Promise<void>;
  /** True once the initial AsyncStorage read for this scope has resolved. */
  isRestored: boolean;
  /** The draft found at restore time, or null when there was none / it expired. */
  restoredDraft: RestoredMessageDraft | null;
  /** Drives a subtle "Draft saved" / "Draft restored" hint near the composer. */
  status: MessageDraftStatus;
  /** Dismisses the transient status hint (e.g. once the user starts typing again). */
  dismissStatus: () => void;
};

function isValidDraftEntry(value: unknown): value is MessageDraftEntry {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as MessageDraftEntry).content === 'string' &&
    typeof (value as MessageDraftEntry).updatedAt === 'string'
  );
}

/**
 * Debounced AsyncStorage-backed draft autosave/restore for a single composer
 * (main channel composer or one thread composer — distinguished by `threadId`
 * in the scope, which is baked into the storage key by
 * buildMessageDraftStorageKey). Isolated per account/profile/org/channel/thread
 * by construction of that key, so switching profiles never surfaces another
 * profile's draft even though AsyncStorage itself is device-wide.
 */
export function useMessageDraft(
  scope: MessageDraftScope | null,
  enabled: boolean,
): UseMessageDraftResult {
  const storageKey =
    scope && scope.accountId && scope.profileId && scope.orgId && scope.channelId
      ? buildMessageDraftStorageKey(scope)
      : null;

  const [isRestored, setIsRestored] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState<RestoredMessageDraft | null>(null);
  const [status, setStatus] = useState<MessageDraftStatus>('idle');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore on mount and whenever the composer scope (channel/thread) changes.
  useEffect(() => {
    let cancelled = false;
    setIsRestored(false);
    setRestoredDraft(null);

    if (!enabled || !storageKey) {
      setIsRestored(true);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (cancelled) return;
        if (!raw) {
          setIsRestored(true);
          return;
        }

        const parsed: unknown = JSON.parse(raw);
        if (
          !isValidDraftEntry(parsed) ||
          parsed.version !== MESSAGE_DRAFT_STORAGE_VERSION ||
          isMessageDraftExpired(parsed)
        ) {
          await AsyncStorage.removeItem(storageKey);
          setIsRestored(true);
          return;
        }

        if (!parsed.content.trim()) {
          setIsRestored(true);
          return;
        }

        setRestoredDraft({ content: parsed.content, mentions: parsed.mentions });
        setStatus('restored');
        setIsRestored(true);
      } catch {
        // A corrupt draft is not worth blocking the composer over.
        setIsRestored(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, storageKey]);

  const removePersisted = useCallback(async () => {
    if (!storageKey) return;
    try {
      await AsyncStorage.removeItem(storageKey);
      notifyDraftWritten();
    } catch {
      // Best-effort — a failed clear just leaves a stale draft to expire later.
    }
  }, [storageKey]);

  const persist = useCallback(
    async (content: string, mentions?: MessageMentionVM[]) => {
      if (!scope || !storageKey) return;
      const entry: MessageDraftEntry = {
        version: MESSAGE_DRAFT_STORAGE_VERSION,
        accountId: scope.accountId,
        profileId: scope.profileId,
        orgId: scope.orgId,
        channelId: scope.channelId,
        threadId: scope.threadId ?? null,
        content,
        ...(mentions?.length ? { mentions } : {}),
        updatedAt: new Date().toISOString(),
      };
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(entry));
        notifyDraftWritten();
        setStatus('saved');
        if (savedStatusTimerRef.current) clearTimeout(savedStatusTimerRef.current);
        savedStatusTimerRef.current = setTimeout(() => setStatus('idle'), 2000);
      } catch {
        // Best-effort — losing a draft save is not fatal.
      }
    },
    [scope, storageKey],
  );

  // The write a still-pending debounce would perform, so it can be flushed
  // instead of dropped when the composer unmounts or changes scope.
  const pendingWriteRef = useRef<(() => void) | null>(null);

  const notifyContentChanged = useCallback(
    (content: string, mentions?: MessageMentionVM[]) => {
      if (!enabled || !storageKey) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);

      // Nothing left to draft — clear any previously persisted content
      // after the same debounce window rather than leaving it stale.
      const write = content.trim()
        ? () => void persist(content, mentions)
        : () => void removePersisted();
      pendingWriteRef.current = write;
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        pendingWriteRef.current = null;
        write();
      }, MESSAGE_DRAFT_AUTOSAVE_DEBOUNCE_MS);
    },
    [enabled, storageKey, persist, removePersisted],
  );

  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const pendingWrite = pendingWriteRef.current;
      pendingWriteRef.current = null;
      pendingWrite?.();
    },
    [storageKey],
  );

  const clearDraft = useCallback(async () => {
    pendingWriteRef.current = null;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    await removePersisted();
    setStatus('idle');
    setRestoredDraft(null);
  }, [removePersisted]);

  const dismissStatus = useCallback(() => setStatus('idle'), []);

  useEffect(
    () => () => {
      if (savedStatusTimerRef.current) clearTimeout(savedStatusTimerRef.current);
    },
    [],
  );

  return {
    notifyContentChanged,
    clearDraft,
    isRestored,
    restoredDraft,
    status,
    dismissStatus,
  };
}

// ─── Conversation-list draft indicators ────────────────────────────────────────

/**
 * Maps channel id → draft text for every non-expired, non-empty MAIN-composer
 * draft (thread drafts are intentionally excluded — the conversation list only
 * shows one row per channel/DM, not per thread) for the given account/profile/org.
 */
export async function listMessageDraftPreviews(scope: {
  accountId: string;
  profileId: string;
  orgId: string;
}): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!scope.accountId || !scope.profileId || !scope.orgId) return result;

  try {
    const prefix = `${DRAFT_KEY_PREFIX}${scope.accountId}:${scope.profileId}:${scope.orgId}:`;
    const allKeys = await AsyncStorage.getAllKeys();
    const matchingKeys = allKeys.filter(
      (key) => key.startsWith(prefix) && key.endsWith(':main'),
    );
    if (!matchingKeys.length) return result;

    const pairs = await AsyncStorage.multiGet(matchingKeys);
    for (const [, raw] of pairs) {
      if (!raw) continue;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (
          !isValidDraftEntry(parsed) ||
          parsed.version !== MESSAGE_DRAFT_STORAGE_VERSION ||
          isMessageDraftExpired(parsed) ||
          !parsed.content.trim()
        ) {
          continue;
        }
        result.set(parsed.channelId, parsed.content);
      } catch {
        // Skip a corrupt entry rather than failing the whole list.
      }
    }
  } catch {
    // Best-effort — the list screen simply shows no draft badges.
  }

  return result;
}

/**
 * Reactively exposes channel id → draft text for the conversation list,
 * refreshed on mount and via the returned `refresh()` (call on screen focus
 * so a draft saved in a composer shows up when the user backs out to the list).
 */
export function useMessageDraftPreviews(
  scope: { accountId: string; profileId: string; orgId: string } | null,
  enabled: boolean,
): { drafts: Map<string, string>; refresh: () => Promise<void> } {
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map());

  const refresh = useCallback(async () => {
    if (!enabled || !scope?.accountId || !scope.profileId || !scope.orgId) {
      setDrafts(new Map());
      return;
    }
    setDrafts(await listMessageDraftPreviews(scope));
  }, [enabled, scope?.accountId, scope?.profileId, scope?.orgId]);

  useEffect(() => {
    void refresh();
    const listener = () => void refresh();
    draftWriteListeners.add(listener);
    return () => {
      draftWriteListeners.delete(listener);
    };
  }, [refresh]);

  return { drafts, refresh };
}

// ─── Sign-out / profile-switch hygiene ─────────────────────────────────────────

/** Clears every locally-stored message draft on this device (all accounts/profiles). */
export async function clearAllMessageDrafts(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const draftKeys = allKeys.filter((key) => key.startsWith(DRAFT_KEY_PREFIX));
    if (draftKeys.length) {
      await AsyncStorage.multiRemove(draftKeys);
    }
  } catch {
    // Best-effort — stale drafts left behind are not a correctness issue,
    // since keys are already scoped per profile and expire via their TTL.
  }
}

/** Clears drafts belonging to one profile id (used when switching family view profiles). */
export async function clearMessageDraftsForProfile(profileId: string): Promise<void> {
  if (!profileId) return;
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const draftKeys = allKeys.filter((key) => {
      if (!key.startsWith(DRAFT_KEY_PREFIX)) return false;
      // Key shape: message-draft:accountId:profileId:orgId:channelId:threadOrMain
      const segments = key.split(':');
      return segments[2] === profileId;
    });
    if (draftKeys.length) {
      await AsyncStorage.multiRemove(draftKeys);
    }
  } catch {
    // Best-effort.
  }
}
