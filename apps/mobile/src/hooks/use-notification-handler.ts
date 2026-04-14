import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useEffect } from 'react';

import {
  NOTIFICATION_REGISTRY,
  DEFAULT_NOTIFICATION_ROUTE,
} from '@/lib/notifications/notification-config';

function getNotificationsModule() {
  // Function-scoped require avoids loading the native module in Expo Go.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  return require('expo-notifications') as typeof import('expo-notifications');
}

type NotificationData = {
  prefKey?: string;
  scopeKind?: 'channel' | 'learning_space';
  scopeId?: string;
  channelId?: string;
  orgId?: string;
};

/**
 * Sets up a listener for notification taps and navigates to the relevant screen.
 * Routing is determined by the central NOTIFICATION_REGISTRY keyed on prefKey.
 * Must be called inside a component that has access to the Expo Router.
 */
export function useNotificationHandler() {
  const router = useRouter();

  useEffect(() => {
    if (Constants.appOwnership === 'expo') {
      return;
    }

    let isMounted = true;
    let subscription: { remove: () => void } | null = null;

    void (async () => {
      const Notifications = getNotificationsModule();

      // Configure foreground behavior only when the native module is available.
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      if (!isMounted) {
        return;
      }

      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as NotificationData;
        const config = data?.prefKey ? NOTIFICATION_REGISTRY[data.prefKey] : undefined;
        const route = config
          ? config.getRoute({
              scopeKind: data.scopeKind,
              scopeId: data.scopeId,
              channelId: data.channelId,
            })
          : DEFAULT_NOTIFICATION_ROUTE;
        router.push(route as Parameters<typeof router.push>[0]);
      });
    })();

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, [router]);
}
