import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  clearAllMessageDrafts,
  clearMessageDraftsForProfile,
  listMessageDraftChannelIds,
  useMessageDraft,
  useMessageDraftChannelIds,
  type MessageDraftScope,
} from '@/hooks/use-message-draft';
import { MESSAGE_DRAFT_STORAGE_VERSION } from '@iconicedu/shared-types';

const SCOPE: MessageDraftScope = {
  accountId: 'account-1',
  profileId: 'profile-1',
  orgId: 'org-1',
  channelId: 'channel-1',
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useMessageDraft', () => {
  it('does nothing when disabled', async () => {
    const { result } = renderHook(() => useMessageDraft(SCOPE, false));
    await waitFor(() => expect(result.current.isRestored).toBe(true));
    expect(result.current.restoredDraft).toBeNull();

    act(() => {
      result.current.notifyContentChanged('hello');
      jest.advanceTimersByTime(2000);
    });

    expect(
      await AsyncStorage.getItem(
        'message-draft:account-1:profile-1:org-1:channel-1:main',
      ),
    ).toBeNull();
  });

  it('autosaves after the debounce window and reports a saved status', async () => {
    const { result } = renderHook(() => useMessageDraft(SCOPE, true));
    await waitFor(() => expect(result.current.isRestored).toBe(true));

    act(() => {
      result.current.notifyContentChanged('Hello world');
    });

    // Not yet persisted before the debounce window elapses.
    expect(
      await AsyncStorage.getItem(
        'message-draft:account-1:profile-1:org-1:channel-1:main',
      ),
    ).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });

    const raw = await AsyncStorage.getItem(
      'message-draft:account-1:profile-1:org-1:channel-1:main',
    );
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.content).toBe('Hello world');
    expect(parsed.version).toBe(MESSAGE_DRAFT_STORAGE_VERSION);
    await waitFor(() => expect(result.current.status).toBe('saved'));
  });

  it('restores a non-expired draft on mount', async () => {
    await AsyncStorage.setItem(
      'message-draft:account-1:profile-1:org-1:channel-1:main',
      JSON.stringify({
        version: MESSAGE_DRAFT_STORAGE_VERSION,
        accountId: 'account-1',
        profileId: 'profile-1',
        orgId: 'org-1',
        channelId: 'channel-1',
        threadId: null,
        content: 'Restored draft text',
        updatedAt: new Date().toISOString(),
      }),
    );

    const { result } = renderHook(() => useMessageDraft(SCOPE, true));
    await waitFor(() => expect(result.current.isRestored).toBe(true));

    expect(result.current.restoredDraft?.content).toBe('Restored draft text');
    expect(result.current.status).toBe('restored');
  });

  it('discards an expired draft instead of restoring it', async () => {
    const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem(
      'message-draft:account-1:profile-1:org-1:channel-1:main',
      JSON.stringify({
        version: MESSAGE_DRAFT_STORAGE_VERSION,
        accountId: 'account-1',
        profileId: 'profile-1',
        orgId: 'org-1',
        channelId: 'channel-1',
        threadId: null,
        content: 'Stale draft',
        updatedAt: new Date(Date.now() - THIRTY_ONE_DAYS_MS).toISOString(),
      }),
    );

    const { result } = renderHook(() => useMessageDraft(SCOPE, true));
    await waitFor(() => expect(result.current.isRestored).toBe(true));

    expect(result.current.restoredDraft).toBeNull();
    expect(
      await AsyncStorage.getItem(
        'message-draft:account-1:profile-1:org-1:channel-1:main',
      ),
    ).toBeNull();
  });

  it('clearDraft removes the persisted entry and is only meant to be called on confirmed send', async () => {
    const { result } = renderHook(() => useMessageDraft(SCOPE, true));
    await waitFor(() => expect(result.current.isRestored).toBe(true));

    act(() => {
      result.current.notifyContentChanged('Draft to clear');
    });
    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });
    expect(
      await AsyncStorage.getItem(
        'message-draft:account-1:profile-1:org-1:channel-1:main',
      ),
    ).not.toBeNull();

    await act(async () => {
      await result.current.clearDraft();
    });

    expect(
      await AsyncStorage.getItem(
        'message-draft:account-1:profile-1:org-1:channel-1:main',
      ),
    ).toBeNull();
  });

  it('keeps main and thread composer drafts isolated by storage key', async () => {
    const mainHook = renderHook(() => useMessageDraft(SCOPE, true));
    const threadHook = renderHook(() =>
      useMessageDraft({ ...SCOPE, threadId: 'thread-1' }, true),
    );
    await waitFor(() => expect(mainHook.result.current.isRestored).toBe(true));
    await waitFor(() => expect(threadHook.result.current.isRestored).toBe(true));

    act(() => {
      mainHook.result.current.notifyContentChanged('Main composer draft');
    });
    await act(async () => {
      jest.advanceTimersByTime(800);
      await Promise.resolve();
    });

    expect(
      await AsyncStorage.getItem(
        'message-draft:account-1:profile-1:org-1:channel-1:main',
      ),
    ).not.toBeNull();
    expect(
      await AsyncStorage.getItem(
        'message-draft:account-1:profile-1:org-1:channel-1:thread-1',
      ),
    ).toBeNull();
  });
});

describe('listMessageDraftChannelIds / useMessageDraftChannelIds', () => {
  it('lists only main-composer drafts scoped to the given account/profile/org', async () => {
    const now = new Date().toISOString();
    await AsyncStorage.multiSet([
      [
        'message-draft:account-1:profile-1:org-1:channel-1:main',
        JSON.stringify({
          version: MESSAGE_DRAFT_STORAGE_VERSION,
          accountId: 'account-1',
          profileId: 'profile-1',
          orgId: 'org-1',
          channelId: 'channel-1',
          content: 'has content',
          updatedAt: now,
        }),
      ],
      [
        'message-draft:account-1:profile-1:org-1:channel-2:thread-9',
        JSON.stringify({
          version: MESSAGE_DRAFT_STORAGE_VERSION,
          accountId: 'account-1',
          profileId: 'profile-1',
          orgId: 'org-1',
          channelId: 'channel-2',
          content: 'thread draft, should not count for the list row',
          updatedAt: now,
        }),
      ],
      [
        'message-draft:account-2:profile-9:org-1:channel-3:main',
        JSON.stringify({
          version: MESSAGE_DRAFT_STORAGE_VERSION,
          accountId: 'account-2',
          profileId: 'profile-9',
          orgId: 'org-1',
          channelId: 'channel-3',
          content: 'different profile, must not leak',
          updatedAt: now,
        }),
      ],
    ]);

    const ids = await listMessageDraftChannelIds({
      accountId: 'account-1',
      profileId: 'profile-1',
      orgId: 'org-1',
    });

    expect(ids).toEqual(new Set(['channel-1']));
  });

  it('exposes the same result reactively via the hook', async () => {
    await AsyncStorage.setItem(
      'message-draft:account-1:profile-1:org-1:channel-1:main',
      JSON.stringify({
        version: MESSAGE_DRAFT_STORAGE_VERSION,
        accountId: 'account-1',
        profileId: 'profile-1',
        orgId: 'org-1',
        channelId: 'channel-1',
        content: 'draft',
        updatedAt: new Date().toISOString(),
      }),
    );

    const { result } = renderHook(() =>
      useMessageDraftChannelIds(
        { accountId: 'account-1', profileId: 'profile-1', orgId: 'org-1' },
        true,
      ),
    );

    await waitFor(() => expect(result.current.channelIds.has('channel-1')).toBe(true));
  });
});

describe('clearAllMessageDrafts / clearMessageDraftsForProfile', () => {
  it('clearAllMessageDrafts removes every draft key regardless of profile', async () => {
    await AsyncStorage.multiSet([
      ['message-draft:a:p1:o:c1:main', '{}'],
      ['message-draft:a:p2:o:c2:main', '{}'],
      ['unrelated-key', 'keep-me'],
    ]);

    await clearAllMessageDrafts();

    expect(await AsyncStorage.getItem('message-draft:a:p1:o:c1:main')).toBeNull();
    expect(await AsyncStorage.getItem('message-draft:a:p2:o:c2:main')).toBeNull();
    expect(await AsyncStorage.getItem('unrelated-key')).toBe('keep-me');
  });

  it('clearMessageDraftsForProfile only removes that profile’s drafts', async () => {
    await AsyncStorage.multiSet([
      ['message-draft:a:p1:o:c1:main', '{}'],
      ['message-draft:a:p2:o:c2:main', '{}'],
    ]);

    await clearMessageDraftsForProfile('p1');

    expect(await AsyncStorage.getItem('message-draft:a:p1:o:c1:main')).toBeNull();
    expect(await AsyncStorage.getItem('message-draft:a:p2:o:c2:main')).not.toBeNull();
  });
});
