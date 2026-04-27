import { describe, expect, it } from 'vitest';

import { defaultMessageUiThemeKeyForChannelKind } from '@iconicedu/web/lib/channels/ui-defaults';

describe('defaultMessageUiThemeKeyForChannelKind', () => {
  it('uses classic message UI for direct-message channel kinds', () => {
    expect(defaultMessageUiThemeKeyForChannelKind('dm')).toBe('classic');
    expect(defaultMessageUiThemeKeyForChannelKind('group_dm')).toBe('classic');
  });

  it('uses feed message UI for standard channels', () => {
    expect(defaultMessageUiThemeKeyForChannelKind('channel')).toBe('feed');
  });
});
