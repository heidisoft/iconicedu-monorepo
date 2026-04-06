import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import {
  NOTIFICATION_REGISTRY,
  DEFAULT_NOTIFICATION_ROUTE,
} from '@/lib/notifications/notification-config';

// Show notifications as banners with sound when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
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
      },
    );

    return () => subscription.remove();
  }, [router]);
}
