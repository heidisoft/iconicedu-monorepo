import { redirectClassroomLink } from '@/lib/classroom/incoming-link';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Alert, NativeModules } from 'react-native';
import { supabase } from '@/lib/supabase/client';
import { apiPost } from '@/lib/api/http-client';
import {
  resolveJoinHrefForMobile,
  getAppLiveSessionIdentifier,
} from './live-session-join';

/** Personal handoffs are never used for sharing or copied to the clipboard. */
export async function openLiveSession(href: string) {
  try {
    const identifier = getAppLiveSessionIdentifier(href);
    if (!identifier) {
      await Linking.openURL(resolveJoinHrefForMobile(href));
      return;
    }
    if (NativeModules.RNZoomVideoSdk) {
      const destination = await redirectClassroomLink(
        resolveJoinHrefForMobile(href),
        new URL(resolveJoinHrefForMobile('/')).origin,
      );
      const resolved = /^\/classroom\/([a-zA-Z0-9-]+)\?entry=([\d-]+)$/.exec(destination);
      if (!resolved) {
        router.navigate('/classroom-link-error');
        return;
      }
      router.navigate({
        pathname: '/classroom/[sessionId]',
        params: { sessionId: resolved[1], entry: resolved[2] },
      });
      return;
    }
    const fragment = new URLSearchParams(
      new URL(resolveJoinHrefForMobile(href)).hash.slice(1),
    );
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (fragment.has('invite') || fragment.has('handoff') || !session) {
      await WebBrowser.openBrowserAsync(resolveJoinHrefForMobile(href), {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        enableDefaultShareMenuItem: false,
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
  const identifier = getAppLiveSessionIdentifier(href);
  if (!identifier) return resolveJoinHrefForMobile(href);
  const result = await apiPost<{ sharePath?: string; joinPath: string }>(
    `/live-sessions/${encodeURIComponent(identifier)}/invite-link`,
    {},
  );
  return result.sharePath ?? result.joinPath;
}
