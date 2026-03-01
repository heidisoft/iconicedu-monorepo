import { describe, expect, it } from 'vitest';

import {
  getLiveSessionHostHeading,
  getLiveSessionHostSubheading,
  getLiveSessionReturnPath,
} from '@iconicedu/web/components/live-sessions/live-session-host.utils';

describe('live-session-host.utils', () => {
  it('prefers channel topic for the heading', () => {
    expect(
      getLiveSessionHostHeading({
        provider: 'daily',
        channelTopic: 'Algebra 1',
      }),
    ).toBe('Algebra 1');
  });

  it('falls back to provider label when topic is missing', () => {
    expect(
      getLiveSessionHostHeading({
        provider: 'daily',
      }),
    ).toBe('daily live session');
  });

  it('formats purpose-aware subheading copy', () => {
    expect(getLiveSessionHostSubheading({ purpose: 'learning-space' })).toBe(
      'Learning space joined inline without leaving the app.',
    );
    expect(getLiveSessionHostSubheading({ purpose: 'general' })).toBe(
      'General joined inline without leaving the app.',
    );
    expect(getLiveSessionHostSubheading({})).toBe(
      'Joined inline without leaving the app.',
    );
  });

  it('builds the correct return path for the channel type', () => {
    expect(
      getLiveSessionReturnPath({
        orgSlug: 'iconic-academy',
        channelId: 'channel-1',
        channelPurpose: 'learning-space',
      }),
    ).toBe('/iconic-academy/spaces/channel-1');
    expect(
      getLiveSessionReturnPath({
        orgSlug: 'iconic-academy',
        channelId: 'channel-2',
        channelKind: 'dm',
      }),
    ).toBe('/iconic-academy/dm/channel-2');
    expect(
      getLiveSessionReturnPath({
        orgSlug: 'iconic-academy',
        channelId: 'channel-3',
        channelKind: 'channel',
      }),
    ).toBe('/iconic-academy/c/channel-3');
  });
});
