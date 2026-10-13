import { Linking, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { apiPost } from '@/lib/api/http-client';
import { openLiveSession, getLiveSessionShareUrl } from './open-live-session';
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: { FULL_SCREEN: 'fullScreen' },
}));
jest.mock('@/lib/api/http-client', () => ({ apiPost: jest.fn() }));
describe('mobile meeting browser and sharing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
