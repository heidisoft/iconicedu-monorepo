jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: 'standalone' },
}));
import * as Notifications from 'expo-notifications';
import { markActivityFeedRead } from '@/lib/api/queries';
jest.mock('@/providers/family-view-provider', () => ({
  useFamilyView: () => ({ profile: { id: 'synthetic-profile' } }),
}));
jest.mock('@/lib/api/queries', () => ({ markActivityFeedRead: jest.fn(async () => {}) }));
import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { IncomingClassCall } from './incoming-class-call';
import { classroomCallsApi } from '@/lib/classroom/calls-api';
const mockPush = jest.fn();
const mockPlayer = { play: jest.fn(), pause: jest.fn(), loop: false };
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-notifications', () => ({
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => {}),
  setBadgeCountAsync: jest.fn(async () => {}),
}));
jest.mock('expo-audio', () => ({ useAudioPlayer: () => mockPlayer }));
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ session: { user: { id: 'synthetic' } } }),
}));
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { text: 'black', card: 'white', modalOverlay: 'gray' } }),
}));
jest.mock('@/lib/classroom/calls-api', () => ({
  classroomCallsApi: { incoming: jest.fn(), respond: jest.fn(), messageTutor: jest.fn() },
}));
const call = {
  id: 'test-call',
  sessionId: 'test-session',
  callerName: 'Test teacher',
  classTitle: 'Test class',
  status: 'ringing' as const,
  messageAvailable: true,
  expiresAt: new Date(Date.now() + 45_000).toISOString(),
};
beforeEach(() => {
  Object.defineProperty(AppState, 'currentState', {
    value: 'active',
    configurable: true,
    writable: true,
  });
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(classroomCallsApi.incoming).mockResolvedValue([call]);
  jest.mocked(classroomCallsApi.respond).mockResolvedValue({ sessionId: call.sessionId });
});
afterEach(() => jest.useRealTimers());
it('rings for an authorized invitation and opens preview only after Join', async () => {
  const screen = render(<IncomingClassCall />);
  await act(async () => {});
  expect(screen.getByText('Test teacher')).toBeTruthy();
  expect(mockPlayer.play).toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Join class call'));
  await act(async () => {});
  expect(classroomCallsApi.respond).toHaveBeenCalledWith(call.id, 'accepted');
  expect(mockPush).toHaveBeenCalledWith('/classroom/test-session');
  expect(mockPlayer.pause).toHaveBeenCalled();
});
it('declines without navigating', async () => {
  const screen = render(<IncomingClassCall />);
  await act(async () => {});
  fireEvent.press(screen.getByLabelText('Decline class call'));
  await act(async () => {});
  expect(classroomCallsApi.respond).toHaveBeenCalledWith(call.id, 'declined');
  expect(mockPush).not.toHaveBeenCalled();
});
it('stops ringing locally when the invitation expires even if the API is offline', async () => {
  const screen = render(<IncomingClassCall />);
  await act(async () => {});
  jest.mocked(classroomCallsApi.incoming).mockRejectedValue(new Error('offline'));
  await act(async () => {
    jest.advanceTimersByTime(46_000);
  });
  expect(screen.queryByText('Test teacher')).toBeNull();
  expect(mockPlayer.pause).toHaveBeenCalled();
});
it('shows a rejected answer without joining and guards duplicate presses', async () => {
  jest
    .mocked(classroomCallsApi.respond)
    .mockRejectedValue(new Error('Call no longer ringing'));
  const screen = render(<IncomingClassCall />);
  await act(async () => {});
  fireEvent.press(screen.getByLabelText('Join class call'));
  fireEvent.press(screen.getByLabelText('Join class call'));
  await act(async () => {});
  expect(classroomCallsApi.respond).toHaveBeenCalledTimes(1);
  expect(mockPush).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Call no longer ringing');
});

it('opens the tutor conversation without joining or sending a message', async () => {
  jest.mocked(classroomCallsApi.messageTutor).mockResolvedValue({
    nativePath: '/(app)/dm/test-dm',
    webPath: '/academy/dm/test-dm',
  });
  const screen = render(<IncomingClassCall />);
  await act(async () => {});
  fireEvent.press(screen.getByLabelText('Message tutor'));
  await act(async () => {});
  expect(classroomCallsApi.messageTutor).toHaveBeenCalledWith(call.id);
  expect(mockPush).toHaveBeenCalledWith('/(app)/dm/test-dm');
  expect(classroomCallsApi.respond).not.toHaveBeenCalledWith(call.id, 'accepted');
});

it('opens follow-up options when a call notification is tapped after ringing ended', async () => {
  jest.mocked(classroomCallsApi.incoming).mockResolvedValue([]);
  jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValueOnce({
    notification: {
      request: {
        content: { data: { prefKey: 'classroom.call', classroomCallId: 'old-call' } },
      },
    },
  } as never);
  render(<IncomingClassCall />);
  await act(async () => {});
  expect(mockPush).toHaveBeenCalledWith('/classroom-call/old-call');
});
it('opens a cold-launch missed-call notification and acknowledges its inbox item', async () => {
  jest.mocked(classroomCallsApi.incoming).mockResolvedValue([]);
  jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValueOnce({
    notification: {
      request: {
        content: {
          data: {
            prefKey: 'classroom.call.missed',
            classroomCallId: 'missed-call',
            activityFeedItemId: 'feed-item',
            orgId: 'org',
          },
        },
      },
    },
  } as never);
  render(<IncomingClassCall />);
  await act(async () => {});
  expect(mockPush).toHaveBeenCalledWith('/classroom-call/missed-call');
  expect(markActivityFeedRead).toHaveBeenCalledWith('org', 'synthetic-profile', [
    'feed-item',
  ]);
});
