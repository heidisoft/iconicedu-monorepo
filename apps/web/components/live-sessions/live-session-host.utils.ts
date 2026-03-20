import type { LiveSessionProviderVM } from '@iconicedu/shared-types';

function formatChannelPurpose(purpose?: string | null) {
  if (!purpose) return null;
  if (purpose === 'learning-space') return 'Class';
  return purpose
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getLiveSessionHostHeading(input: {
  provider: LiveSessionProviderVM;
  channelTopic?: string | null;
}) {
  return input.channelTopic?.trim() || `${input.provider} live session`;
}

export function getLiveSessionHostSubheading(input: { purpose?: string | null }) {
  const formattedPurpose = formatChannelPurpose(input.purpose);
  return formattedPurpose
    ? `${formattedPurpose} joined inline without leaving the app.`
    : 'Joined inline without leaving the app.';
}

export function getLiveSessionReturnPath(input: {
  orgSlug: string;
  channelId: string;
  channelKind?: string | null;
  channelPurpose?: string | null;
}) {
  if (input.channelPurpose === 'learning-space') {
    return `/${input.orgSlug}/s/${input.channelId}`;
  }
  if (input.channelKind === 'dm' || input.channelKind === 'group_dm') {
    return `/${input.orgSlug}/dm/${input.channelId}`;
  }
  return `/${input.orgSlug}/c/${input.channelId}`;
}
