import { flag, getProviderData as getCodeProviderData } from 'flags/next';
import { resolveAppUrl } from '@iconicedu/web/lib/config/app-url';

function isLocalOrPreviewEnvironment() {
  const vercelEnv = (
    process.env.VERCEL_ENV?.trim() ??
    process.env.NEXT_PUBLIC_VERCEL_ENV?.trim() ??
    ''
  ).toLowerCase();
  if (vercelEnv === 'preview') {
    return true;
  }

  if (process.env.NODE_ENV !== 'development') {
    return false;
  }

  const hostname = new URL(resolveAppUrl()).hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function resolveDistinctId(profileId?: string | null) {
  const resolved = profileId?.trim();
  if (resolved) {
    return resolved;
  }
  return 'anonymous';
}

async function evaluateWebBooleanFlag(input: {
  flagKey: string;
  profileId?: string | null;
}) {
  if (isLocalOrPreviewEnvironment()) {
    return true;
  }

  const { evaluatePosthogBooleanFlag } =
    await import('@iconicedu/web/lib/flags/posthog-flags');
  return evaluatePosthogBooleanFlag({
    flagKey: input.flagKey,
    distinctId: resolveDistinctId(input.profileId),
  });
}

export const enableChannelCommunications = flag<boolean, { profileId?: string | null }>({
  key: 'enable-channel-communications',
  description:
    'Enables channel-level communication features that are still behind rollout control.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: 'enable-channel-communications',
      profileId: entities?.profileId,
    });
  },
});

export const enableMessageTypeComposer = flag<boolean, { profileId?: string | null }>({
  key: 'enable-message-type-composer',
  description: 'Shows the + create message type composer action in message inputs.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: 'enable-message-type-composer',
      profileId: entities?.profileId,
    });
  },
});

export const enableAdminReports = flag<boolean, { profileId?: string | null }>({
  key: 'enable-admin-reports',
  description: 'Enables the admin reporting dashboard and navigation entry.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: true,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: 'enable-admin-reports',
      profileId: entities?.profileId,
    });
  },
});

export const enableAdminActivityFeedAudit = flag<boolean, { profileId?: string | null }>({
  key: 'enable-admin-activity-feed-audit',
  description: 'Enables the admin audit view for generated activity feed items.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: 'enable-admin-activity-feed-audit',
      profileId: entities?.profileId,
    });
  },
});

export const enableClassScheduleStaffCancel = flag<
  boolean,
  { profileId?: string | null }
>({
  key: 'enable-class-schedule-staff-cancel',
  description:
    'Allows staff users to cancel class schedule sessions from the calendar surface.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: true,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: 'enable-class-schedule-staff-cancel',
      profileId: entities?.profileId,
    });
  },
});

export const enableClassScheduleStaffEdit = flag<boolean, { profileId?: string | null }>({
  key: 'enable-class-schedule-staff-edit',
  description:
    'Allows staff users to edit class schedule sessions from the calendar surface.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: 'enable-class-schedule-staff-edit',
      profileId: entities?.profileId,
    });
  },
});

export const enableMarketingSitePages = flag<boolean, { profileId?: string | null }>({
  key: 'enable-marketing-site-pages',
  description:
    'Enables standard marketing pages and regional microsite routes while content is staged.',
  options: [
    { label: 'Off', value: false },
    { label: 'On', value: true },
  ],
  defaultValue: false,
  async decide({ entities }) {
    return evaluateWebBooleanFlag({
      flagKey: 'enable-marketing-site-pages',
      profileId: entities?.profileId,
    });
  },
});

export const webFlags = {
  enableAdminActivityFeedAudit,
  enableAdminReports,
  enableChannelCommunications,
  enableClassScheduleStaffCancel,
  enableClassScheduleStaffEdit,
  enableMarketingSitePages,
  enableMessageTypeComposer,
} as const;

export type WebFlagKey = keyof typeof webFlags;

export function isVercelFlagsSdkConfigured() {
  if (isLocalOrPreviewEnvironment()) {
    return false;
  }

  const posthogKey =
    process.env.POSTHOG_KEY?.trim() ?? process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? '';
  const posthogHost =
    process.env.POSTHOG_HOST?.trim() ??
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ??
    '';
  return posthogKey.length > 0 && posthogHost.length > 0;
}

export async function getFlagsProviderData() {
  return getCodeProviderData(webFlags);
}
