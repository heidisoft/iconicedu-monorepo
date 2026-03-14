import { useEffect, useRef } from 'react';

import { getExpoPushToken, storePushToken } from '@/lib/notifications/push-token';

import { useAccount } from './use-account';
import { useProfile } from './use-profile';

/**
 * Registers the device for Expo push notifications and stores the token in the database.
 * Runs once when the authenticated user's orgId and profileId are available.
 * Errors are caught silently — push registration should never block the user.
 */
export function usePushRegistration() {
  const { data: account } = useAccount();
  const { data: profile } = useProfile();

  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;
  const profileId = (profile as Record<string, unknown> | undefined)?.id as
    | string
    | undefined;

  const registered = useRef(false);

  useEffect(() => {
    if (!orgId || !profileId || registered.current) return;

    registered.current = true;

    getExpoPushToken()
      .then((token) => {
        if (!token) return;
        return storePushToken(orgId, profileId, token);
      })
      .catch(() => {
        // Push registration errors must never surface to the user
      });
  }, [orgId, profileId]);
}
