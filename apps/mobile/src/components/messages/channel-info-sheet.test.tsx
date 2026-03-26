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
