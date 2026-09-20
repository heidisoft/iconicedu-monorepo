/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MESSAGE_DRAFT_AUTOSAVE_DEBOUNCE_MS } from '@iconicedu/shared-types';
import { useMessageDraft } from './use-message-draft';
import { readMessageDraft } from './message-draft-store';

const scope = {
  accountId: 'account-1',
  profileId: 'profile-1',
  orgId: 'org-1',
  channelId: 'channel-1',
  threadId: null,
};

describe('useMessageDraft', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it('is fully inert when disabled — no localStorage writes, no restore', () => {
    const { result } = renderHook(() => useMessageDraft({ enabled: false, scope }));

    expect(result.current.restoredDraft).toBeNull();

    act(() => {
      result.current.notifyContentChange('some text that would otherwise be saved');
      vi.advanceTimersByTime(MESSAGE_DRAFT_AUTOSAVE_DEBOUNCE_MS + 100);
    });

    expect(readMessageDraft(scope)).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('is inert when the scope is null even if enabled', () => {
    const { result } = renderHook(() => useMessageDraft({ enabled: true, scope: null }));

    act(() => {
      result.current.notifyContentChange('typed while scope unresolved');
      vi.advanceTimersByTime(MESSAGE_DRAFT_AUTOSAVE_DEBOUNCE_MS + 100);
    });

    expect(readMessageDraft(scope)).toBeNull();
  });

  it('debounce-autosaves non-empty content and flashes a "saved" status', () => {
    const { result } = renderHook(() => useMessageDraft({ enabled: true, scope }));

    act(() => {
      result.current.notifyContentChange('Hello world');
    });
    // Not yet written — still inside the debounce window.
    expect(readMessageDraft(scope)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(MESSAGE_DRAFT_AUTOSAVE_DEBOUNCE_MS);
    });

    expect(readMessageDraft(scope)?.content).toBe('Hello world');
    expect(result.current.status).toBe('saved');
  });

  it('does not persist a draft for empty/whitespace-only content, and clears an existing one', () => {
    const { result } = renderHook(() => useMessageDraft({ enabled: true, scope }));

    act(() => {
      result.current.notifyContentChange('Something');
      vi.advanceTimersByTime(MESSAGE_DRAFT_AUTOSAVE_DEBOUNCE_MS);
    });
    expect(readMessageDraft(scope)).not.toBeNull();

    act(() => {
      result.current.notifyContentChange('   ');
      vi.advanceTimersByTime(MESSAGE_DRAFT_AUTOSAVE_DEBOUNCE_MS);
    });
    expect(readMessageDraft(scope)).toBeNull();
  });

  it('restores a previously saved draft on mount and flashes "restored"', () => {
    const { result: writer } = renderHook(() =>
      useMessageDraft({ enabled: true, scope }),
    );
    act(() => {
      writer.current.notifyContentChange('Draft from earlier session');
      vi.advanceTimersByTime(MESSAGE_DRAFT_AUTOSAVE_DEBOUNCE_MS);
    });

    const { result: restored } = renderHook(() =>
      useMessageDraft({ enabled: true, scope }),
    );

    expect(restored.current.restoredDraft?.content).toBe('Draft from earlier session');
    expect(restored.current.status).toBe('restored');
  });

  it('clearDraft removes the persisted entry and resets local state', () => {
    const { result } = renderHook(() => useMessageDraft({ enabled: true, scope }));

    act(() => {
      result.current.notifyContentChange('to be cleared');
      vi.advanceTimersByTime(MESSAGE_DRAFT_AUTOSAVE_DEBOUNCE_MS);
    });
    expect(readMessageDraft(scope)).not.toBeNull();

    act(() => {
      result.current.clearDraft();
    });

    expect(readMessageDraft(scope)).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('does not restore a draft belonging to a different profile', () => {
    const { result: writer } = renderHook(() =>
      useMessageDraft({ enabled: true, scope }),
    );
    act(() => {
      writer.current.notifyContentChange('guardian draft');
      vi.advanceTimersByTime(MESSAGE_DRAFT_AUTOSAVE_DEBOUNCE_MS);
    });

    const otherProfileScope = { ...scope, profileId: 'profile-2' };
    const { result: otherProfile } = renderHook(() =>
      useMessageDraft({ enabled: true, scope: otherProfileScope }),
    );

    expect(otherProfile.current.restoredDraft).toBeNull();
  });
});
