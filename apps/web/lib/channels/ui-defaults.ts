import type { ChannelUiDefaultsVM } from '@iconicedu/shared-types';

export function withInfoPanelDisabled(
  uiDefaults?: ChannelUiDefaultsVM | null,
): ChannelUiDefaultsVM {
  return {
    ...(uiDefaults ?? {}),
    defaultRightPanelOpen: false,
    defaultRightPanelKey: uiDefaults?.defaultRightPanelKey ?? 'channel_info',
    infoPanel: {
      ...(uiDefaults?.infoPanel ?? {}),
      showHeader: false,
      showDetails: false,
      showMedia: false,
      showMembers: false,
      showQuickActions: false,
      showHiddenQuickActions: false,
    },
  };
}
