import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Alert, NativeModules } from 'react-native';
import { apiPost } from '@/lib/api/http-client';
import { resolveJoinHrefForMobile } from './live-session-join';

function meetingIdentifier(href: string) {
  const url = new URL(resolveJoinHrefForMobile(href));
  const base = new URL(
    process.env.EXPO_PUBLIC_WEB_URL?.trim() || 'http://localhost:3000',
  );
  return url.origin === base.origin
    ? /^\/live\/([^/]+)$/.exec(url.pathname)?.[1]
    : undefined;
}
/** Personal handoffs are never used for sharing or copied to the clipboard. */
export async function openLiveSession(href: string) {
  try {
    const identifier = meetingIdentifier(href);
    if (!identifier) {
      await Linking.openURL(resolveJoinHrefForMobile(href));
      return;
    }
    if (NativeModules.RNZoomVideoSdk) {
      router.navigate({
        pathname: '/classroom/[sessionId]',
        params: { sessionId: identifier },
      });
      return;
    }
    const { browserPath } = await apiPost<{ browserPath: string }>(
      `/live-sessions/${encodeURIComponent(identifier)}/browser-handoff`,
      {},
    );
    await WebBrowser.openBrowserAsync(browserPath, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      // Keep Android meetings available when switching back to the app.
      createTask: true,
      showInRecents: true,
      useProxyActivity: true,
      enableDefaultShareMenuItem: false,
    });
  } catch {
    Alert.alert('Unable to open meeting', 'Please try joining again.');
  }
}
export async function getLiveSessionShareUrl(href: string) {
  const identifier = meetingIdentifier(href);
  if (!identifier) return resolveJoinHrefForMobile(href);
  const result = await apiPost<{ sharePath?: string; joinPath: string }>(
    `/live-sessions/${encodeURIComponent(identifier)}/invite-link`,
    {},
  );
  return result.sharePath ?? result.joinPath;
}
