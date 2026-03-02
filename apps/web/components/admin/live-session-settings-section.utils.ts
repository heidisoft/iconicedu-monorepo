import type {
  ChannelLiveSessionConfigVM,
  LiveSessionProviderVM,
} from '@iconicedu/shared-types';

export function shouldShowLiveSessionJoinUrlField(value: ChannelLiveSessionConfigVM): boolean {
  return value.enabled && value.provider === 'custom';
}

export function withNextLiveSessionProvider(
  value: ChannelLiveSessionConfigVM,
  provider: LiveSessionProviderVM,
): ChannelLiveSessionConfigVM {
  return {
    ...value,
    provider,
    joinUrl: provider === 'custom' ? value.joinUrl ?? '' : null,
  };
}
