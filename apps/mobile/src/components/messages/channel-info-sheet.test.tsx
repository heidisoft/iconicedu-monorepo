import { __test__ } from './channel-info-sheet';

describe('channel-info-sheet tab visibility', () => {
  it('shows all tabs by default', () => {
    expect(__test__.getVisibleChannelInfoTabs(null).map((tab) => tab.key)).toEqual([
      'files',
      'saved',
      'members',
    ]);
  });

  it('hides disabled tabs from channel settings', () => {
    const parsed = __test__.parseChannelUiDefaults({
      disabledTabs: ['saved', 'members', 'schedule'],
    });

    expect(__test__.getVisibleChannelInfoTabs(parsed).map((tab) => tab.key)).toEqual([
      'files',
    ]);
  });

  it('ignores info panel visibility flags for mobile tabs', () => {
    const parsed = __test__.parseChannelUiDefaults({
      infoPanel: {
        showMedia: false,
        showMembers: false,
      },
    });

    expect(__test__.getVisibleChannelInfoTabs(parsed).map((tab) => tab.key)).toEqual([
      'files',
      'saved',
      'members',
    ]);
  });

  it('deduplicates disabled tabs and ignores unsupported values', () => {
    const parsed = __test__.parseChannelUiDefaults({
      disabledTabs: ['saved', 'saved', 'bogus', 'files'],
    });

    expect(parsed.disabledTabs).toEqual(['saved', 'files']);
  });
});

describe('channel-info-sheet notification controls', () => {
  it('stays hidden while the feature flag is off', () => {
    expect(
      __test__.resolveNotificationControlsVisibility({
        enabled: false,
        channelId: 'channel-1',
        orgId: 'org-1',
        profileId: 'profile-1',
      }),
    ).toBe(false);
  });

  it('shows once the flag is on and the identity is complete', () => {
    expect(
      __test__.resolveNotificationControlsVisibility({
        enabled: true,
        channelId: 'channel-1',
        orgId: 'org-1',
        profileId: 'profile-1',
      }),
    ).toBe(true);
  });

  it('stays hidden when the channel or identity is missing', () => {
    expect(
      __test__.resolveNotificationControlsVisibility({
        enabled: true,
        channelId: '',
        orgId: 'org-1',
        profileId: 'profile-1',
      }),
    ).toBe(false);
    expect(
      __test__.resolveNotificationControlsVisibility({
        enabled: true,
        channelId: 'channel-1',
        orgId: '',
        profileId: 'profile-1',
      }),
    ).toBe(false);
    expect(
      __test__.resolveNotificationControlsVisibility({
        enabled: true,
        channelId: 'channel-1',
        orgId: 'org-1',
        profileId: '',
      }),
    ).toBe(false);
  });

  it('maps learning spaces to the learning_space scope and everything else to channel', () => {
    expect(__test__.resolveNotificationScopeKind('space')).toBe('learning_space');
    expect(__test__.resolveNotificationScopeKind('channel')).toBe('channel');
    expect(__test__.resolveNotificationScopeKind('dm')).toBe('channel');
  });
});
