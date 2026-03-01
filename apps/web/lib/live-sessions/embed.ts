import type { LiveSessionProviderVM } from '@iconicedu/shared-types';

export function canEmbedLiveSession(joinUrl?: string | null): boolean {
  return typeof joinUrl === 'string' && joinUrl.trim().length > 0;
}

export function getEmbeddedLiveSessionFrameAllow(
  provider: LiveSessionProviderVM,
): string {
  switch (provider) {
    case 'daily':
      return [
        'camera',
        'microphone',
        'display-capture',
        'autoplay',
        'clipboard-read',
        'clipboard-write',
        'fullscreen',
      ].join('; ');
    default:
      return ['camera', 'microphone', 'autoplay', 'fullscreen'].join('; ');
  }
}

export function getEmbeddedLiveSessionTitle(provider: LiveSessionProviderVM): string {
  switch (provider) {
    case 'daily':
      return 'Daily live session';
    case 'zoom':
      return 'Zoom live session';
    case 'jitsi':
      return 'Jitsi live session';
    case 'custom':
      return 'Live session';
    default:
      return 'Live session';
  }
}
