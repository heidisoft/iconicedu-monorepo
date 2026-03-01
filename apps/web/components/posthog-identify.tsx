'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

import { isPostHogBrowserConfigured } from '@iconicedu/web/lib/analytics/posthog-browser-config';
import { buildPostHogIdentifyProperties } from '@iconicedu/web/lib/analytics/posthog-events';

type PostHogIdentifyProps = {
  distinctId: string;
  email?: string | null;
  accountId?: string | null;
  orgId?: string | null;
  orgSlug?: string | null;
};

export function PostHogIdentify({
  distinctId,
  email,
  accountId,
  orgId,
  orgSlug,
}: PostHogIdentifyProps) {
  const hasPostHog = isPostHogBrowserConfigured();

  useEffect(() => {
    if (!hasPostHog || !distinctId) {
      return;
    }

    posthog.identify(
      distinctId,
      buildPostHogIdentifyProperties({
        email,
        accountId,
        orgId,
        orgSlug,
      }),
    );

    if (orgId) {
      posthog.group('organization', orgId, {
        orgSlug,
      });
    }

    if (accountId) {
      posthog.group('account', accountId, {
        orgId,
      });
    }
  }, [accountId, distinctId, email, hasPostHog, orgId, orgSlug]);

  return null;
}
