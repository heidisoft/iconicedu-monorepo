import { describe, expect, it } from 'vitest';
import {
  getHeaderJoinQuickAction,
  resolveHeaderJoinQuickAction,
  getVisibleHeaderActions,
} from './messages-container-header-actions';

describe('messages-container-header-actions helpers', () => {
  it('removes info and hidden actions from header actions', () => {
    const actions = getVisibleHeaderActions([
      { key: 'info', label: 'Info' },
      { key: 'saved', label: 'Saved' },
      { key: 'custom', label: 'Hidden custom', hidden: true },
    ]);

    expect(actions).toEqual([{ key: 'saved', label: 'Saved' }]);
  });

  it('returns the join quick action when available', () => {
    const joinAction = getHeaderJoinQuickAction([
      { key: 'saved', label: 'Saved' },
      { key: 'join', label: 'Join', url: 'https://example.com/join' },
    ]);

    expect(joinAction).toEqual({
      key: 'join',
      label: 'Join',
      url: 'https://example.com/join',
    });
  });

  it('returns null when join action is hidden or missing', () => {
    expect(
      getHeaderJoinQuickAction([{ key: 'join', label: 'Join', hidden: true }]),
    ).toBeNull();
    expect(getHeaderJoinQuickAction([{ key: 'saved', label: 'Saved' }])).toBeNull();
  });

  it('returns the first visible join quick action', () => {
    const join = getHeaderJoinQuickAction([
      { key: 'join', label: 'Hidden join', hidden: true, url: 'https://example.com/hidden' },
      { key: 'join', label: 'Visible join', url: 'https://example.com/live' },
    ]);

    expect(join).toEqual({
      key: 'join',
      label: 'Visible join',
      url: 'https://example.com/live',
    });
  });

  it('falls back to default join action when missing for non-dm headers', () => {
    expect(resolveHeaderJoinQuickAction([{ key: 'saved', label: 'Saved' }], true)).toEqual({
      key: 'join',
      label: 'Join',
      isPrimary: true,
    });
  });

  it('does not fallback join action for dm headers', () => {
    expect(resolveHeaderJoinQuickAction([{ key: 'saved', label: 'Saved' }], false)).toBeNull();
  });
});
