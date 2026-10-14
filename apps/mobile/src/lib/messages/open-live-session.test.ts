import { Linking, Alert, NativeModules } from 'react-native';
import { rememberNativeInvitation } from '@/lib/classroom/link-recovery';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase/client';
import { apiPost, publicApiPost } from '@/lib/api/http-client';
import { openLiveSession, getLiveSessionShareUrl } from './open-live-session';
jest.mock('@/lib/classroom/link-recovery', () => ({
  rememberNativeInvitation: jest.fn().mockResolvedValue(undefined),
  nativeHandoffRedemptionKey: jest.fn().mockResolvedValue('synthetic-redemption-key'),
}));
jest.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { getSession: jest.fn() } },
}));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: { FULL_SCREEN: 'fullScreen' },
}));
jest.mock('@/lib/api/http-client', () => ({
  apiPost: jest.fn(),
  publicApiPost: jest.fn(),
}));
describe('mobile meeting browser and sharing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'synthetic-member' } } },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    delete NativeModules.RNZoomVideoSdk;
    process.env.EXPO_PUBLIC_WEB_URL = 'https://app.invalid';
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  it('opens a personal single-use handoff in the in-app browser', async () => {
    jest.mocked(apiPost).mockResolvedValue({
      browserPath: 'https://app.invalid/live/aaaa-bbbb-cccc#handoff=synthetic',
    });
    await openLiveSession('/live/aaaa-bbbb-cccc');
    expect(apiPost).toHaveBeenCalledWith(
      '/live-sessions/aaaa-bbbb-cccc/browser-handoff',
      {},
    );
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      expect.stringContaining('#handoff='),
      {
        presentationStyle: 'fullScreen',
        createTask: true,
        showInRecents: true,
        useProxyActivity: true,
        enableDefaultShareMenuItem: false,
      },
    );
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
  it('shares an invitation rather than a personal handoff or raw password', async () => {
    jest.mocked(apiPost).mockResolvedValue({
      sharePath: 'https://app.invalid/live/aaaa-bbbb-cccc#invite=synthetic',
    });
    expect(await getLiveSessionShareUrl('/live/aaaa-bbbb-cccc')).toContain('#invite=');
    expect(apiPost).toHaveBeenCalledWith('/live-sessions/aaaa-bbbb-cccc/invite-link', {});
  });
  it('opens the native preview when this binary includes the SDK', async () => {
    NativeModules.RNZoomVideoSdk = {};
    await openLiveSession('/live/aaaa-bbbb-cccc');
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/classroom/[sessionId]',
      params: { sessionId: 'aaaa-bbbb-cccc', entry: expect.stringMatching(/^[\d-]+$/) },
    });
    expect(apiPost).not.toHaveBeenCalled();
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });
  it('leaves external providers on their own links', async () => {
    await openLiveSession('https://zoom.invalid/meeting');
    expect(Linking.openURL).toHaveBeenCalledWith('https://zoom.invalid/meeting');
    expect(apiPost).not.toHaveBeenCalled();
  });
  it('shows a retry message if the handoff fails without opening a signed-out browser', async () => {
    jest.mocked(apiPost).mockRejectedValue(new Error('network unavailable'));
    await openLiveSession('/live/aaaa-bbbb-cccc');
    expect(Alert.alert).toHaveBeenCalled();
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });
});

it('stores native invitations encrypted before navigating without a secret URL parameter', async () => {
  jest.clearAllMocks();
  NativeModules.RNZoomVideoSdk = {};
  process.env.EXPO_PUBLIC_WEB_URL = 'https://app.invalid';
  await openLiveSession('/live/aaaa-bbbb-cccc#invite=synthetic-invitation');
  expect(rememberNativeInvitation).toHaveBeenCalledWith(
    'aaaa-bbbb-cccc',
    'synthetic-invitation',
  );
  expect(router.navigate).toHaveBeenCalledWith({
    pathname: '/classroom/[sessionId]',
    params: { sessionId: 'aaaa-bbbb-cccc', entry: expect.stringMatching(/^[\d-]+$/) },
  });
});

it('preserves guest invitations in the browser fallback without requiring login', async () => {
  delete NativeModules.RNZoomVideoSdk;
  process.env.EXPO_PUBLIC_WEB_URL = 'https://app.invalid';
  jest.clearAllMocks();
  jest
    .mocked(supabase.auth.getSession)
    .mockResolvedValue({ data: { session: null }, error: null });
  await openLiveSession('/live/aaaa#invite=synthetic');
  expect(apiPost).not.toHaveBeenCalled();
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
    'https://app.invalid/live/aaaa#invite=synthetic',
    expect.any(Object),
  );
});

it('uses the same recoverable native handoff route as OS-delivered links', async () => {
  jest.clearAllMocks();
  NativeModules.RNZoomVideoSdk = {};
  process.env.EXPO_PUBLIC_WEB_URL = 'https://app.invalid';
  jest.mocked(publicApiPost).mockResolvedValue({ linkToken: 'synthetic-access' });
  await openLiveSession('/live/aaaa#handoff=synthetic');
  expect(publicApiPost).toHaveBeenCalledWith(
    '/live-sessions/aaaa/link-info',
    expect.objectContaining({ handoff: true, redemptionKey: 'synthetic-redemption-key' }),
  );
  expect(router.navigate).toHaveBeenCalledWith({
    pathname: '/classroom/[sessionId]',
    params: { sessionId: 'aaaa', entry: expect.any(String) },
  });
  expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
});
it('refreshes entry when the in-app Join action opens the same classroom twice', async () => {
  jest.clearAllMocks();
  NativeModules.RNZoomVideoSdk = {};
  process.env.EXPO_PUBLIC_WEB_URL = 'https://app.invalid';
  await openLiveSession('/live/aaaa');
  await openLiveSession('/live/aaaa');
  expect(jest.mocked(router.navigate).mock.calls[0][0]).not.toEqual(
    jest.mocked(router.navigate).mock.calls[1][0],
  );
});
