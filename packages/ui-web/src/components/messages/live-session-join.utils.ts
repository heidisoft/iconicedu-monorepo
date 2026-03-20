import type {
  ChannelLiveSessionConfigVM,
  ChannelQuickActionVM,
} from '@iconicedu/shared-types';

export function getVisibleJoinQuickAction(
  quickActions?: ChannelQuickActionVM[] | null,
): ChannelQuickActionVM | null {
  return quickActions?.find((action) => action.key === 'join' && !action.hidden) ?? null;
}

export function resolveLiveSessionJoinHref(input: {
  quickActions?: ChannelQuickActionVM[] | null;
  fallbackUrl?: string | null;
}): string | null {
  const joinQuickAction = getVisibleJoinQuickAction(input.quickActions);
  const joinQuickActionUrl =
    typeof joinQuickAction?.url === 'string' && joinQuickAction.url.trim().length > 0
      ? joinQuickAction.url.trim()
      : null;

  if (joinQuickActionUrl) {
    return joinQuickActionUrl;
  }

  return typeof input.fallbackUrl === 'string' && input.fallbackUrl.trim().length > 0
    ? input.fallbackUrl.trim()
    : null;
}

export function isExternalJoinHref(joinHref?: string | null): boolean {
  return Boolean(joinHref && /^https?:\/\//i.test(joinHref));
}

export function resolveExternalJoinProviderLabel(joinHref?: string | null) {
  if (!joinHref || !isExternalJoinHref(joinHref)) {
    return null;
  }

  try {
    const hostname = new URL(joinHref).hostname.toLowerCase();
    if (hostname.includes('zoom')) {
      return 'Zoom';
    }
    if (hostname.includes('jitsi')) {
      return 'Jitsi';
    }
    if (hostname.includes('meet.google')) {
      return 'Google Meet';
    }
    if (hostname.includes('teams.microsoft')) {
      return 'Microsoft Teams';
    }
  } catch {
    return null;
  }

  return null;
}

export function openJoinHref(joinHref: string) {
  if (typeof window === 'undefined') {
    return;
  }

  if (isExternalJoinHref(joinHref)) {
    window.open(joinHref, '_blank', 'noopener,noreferrer');
    return;
  }

  window.location.assign(joinHref);
}

export function resolveLiveSessionJoinAction(input: {
  liveSession?: ChannelLiveSessionConfigVM | null;
  quickActions?: ChannelQuickActionVM[] | null;
  hasJoinHandler: boolean;
  allowDefaultAction?: boolean;
}) {
  const liveSessionEnabled = input.liveSession?.enabled === true;
  if (!liveSessionEnabled) {
    return {
      visible: false,
      label: 'Join',
      joinHref: null,
    };
  }

  const joinQuickAction = getVisibleJoinQuickAction(input.quickActions);
  const joinHref = resolveLiveSessionJoinHref({
    quickActions: input.quickActions,
    fallbackUrl: input.liveSession?.joinUrl ?? null,
  });
  const label = joinQuickAction?.label ?? 'Join';
  const visible = Boolean(
    joinQuickAction || input.allowDefaultAction || input.hasJoinHandler || joinHref,
  );
  const actionable = input.hasJoinHandler || Boolean(joinHref);

  return {
    visible: visible && actionable,
    label,
    joinHref,
  };
}
