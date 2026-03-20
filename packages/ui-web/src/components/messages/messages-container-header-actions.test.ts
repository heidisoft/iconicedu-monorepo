import { describe, expect, it } from 'vitest';
import {
  getHeaderJoinQuickAction,
  resolveHeaderJoinQuickAction,
  resolveHeaderJoinHref,
  getVisibleHeaderActions,
} from './messages-container-header-actions';
import {
  isExternalJoinHref,
  resolveLiveSessionJoinAction,
} from '@iconicedu/ui-web/components/messages/live-session-join.utils';

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
      {
        key: 'join',
        label: 'Hidden join',
        hidden: true,
        url: 'https://example.com/hidden',
      },
      { key: 'join', label: 'Visible join', url: 'https://example.com/live' },
    ]);

    expect(join).toEqual({
      key: 'join',
      label: 'Visible join',
      url: 'https://example.com/live',
    });
  });

  it('falls back to default join action when missing for non-dm headers', () => {
    expect(
      resolveHeaderJoinQuickAction([{ key: 'saved', label: 'Saved' }], true),
    ).toEqual({
      key: 'join',
      label: 'Join',
      isPrimary: true,
    });
  });

  it('does not fallback join action for dm headers', () => {
    expect(
      resolveHeaderJoinQuickAction([{ key: 'saved', label: 'Saved' }], false),
    ).toBeNull();
  });

  it('prefers the explicit join quick action url', () => {
    expect(
      resolveHeaderJoinHref({
        joinQuickAction: {
          key: 'join',
          label: 'Join',
          url: ' https://example.com/live ',
        },
        fallbackUrl: 'https://example.com/fallback',
      }),
    ).toBe('https://example.com/live');
  });

  it('falls back to the channel live session join url when the quick action has no url', () => {
    expect(
      resolveHeaderJoinHref({
        joinQuickAction: { key: 'join', label: 'Join' },
        fallbackUrl: ' https://example.com/channel-room ',
      }),
    ).toBe('https://example.com/channel-room');
  });

  it('returns null when no join href is available', () => {
    expect(
      resolveHeaderJoinHref({
        joinQuickAction: { key: 'join', label: 'Join', url: '   ' },
        fallbackUrl: '   ',
      }),
    ).toBeNull();
  });

  it('hides join when live sessions are disabled even if a join quick action exists', () => {
    expect(
      resolveLiveSessionJoinAction({
        liveSession: {
          enabled: false,
          provider: 'custom',
          joinUrl: 'https://example.com/live',
        },
        quickActions: [{ key: 'join', label: 'Join', url: 'https://example.com/live' }],
        hasJoinHandler: true,
        allowDefaultAction: true,
      }),
    ).toEqual({
      visible: false,
      label: 'Join',
      joinHref: null,
    });
  });

  it('shows join when live sessions are enabled and a handler exists', () => {
    expect(
      resolveLiveSessionJoinAction({
        liveSession: {
          enabled: true,
          provider: 'daily',
        },
        quickActions: null,
        hasJoinHandler: true,
        allowDefaultAction: true,
      }),
    ).toEqual({
      visible: true,
      label: 'Join',
      joinHref: null,
    });
  });

  it('treats absolute join urls as external links', () => {
    expect(isExternalJoinHref('https://example.com/live')).toBe(true);
    expect(isExternalJoinHref('/iconic-academy/live-sessions/123')).toBe(false);
  });
});
