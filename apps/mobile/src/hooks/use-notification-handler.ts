import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

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

/**
 * Sets up a listener for notification taps and navigates to the inbox.
 * Must be called inside a component that has access to the Expo Router.
 */
export function useNotificationHandler() {
  const router = useRouter();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/(app)/(tabs)/inbox');
    });

    return () => subscription.remove();
  }, [router]);
}
