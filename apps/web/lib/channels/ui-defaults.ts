import type {
  ChannelKind,
  ChannelUiDefaultsVM,
  MessageUiThemeKeyVM,
} from '@iconicedu/shared-types';

export const CLASSIC_MESSAGE_UI_THEME_KEY = 'classic' as const;
export const FEED_MESSAGE_UI_THEME_KEY = 'feed' as const;

export function defaultMessageUiThemeKeyForChannelKind(
  kind: ChannelKind,
): MessageUiThemeKeyVM {
  return kind === 'dm' || kind === 'group_dm'
    ? CLASSIC_MESSAGE_UI_THEME_KEY
    : FEED_MESSAGE_UI_THEME_KEY;
}

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
