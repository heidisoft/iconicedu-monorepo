import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ClassroomCallDetails } from './classroom-call-details';
import { classroomCallsApi } from '@/lib/classroom/calls-api';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    canGoBack: () => true,
    replace: jest.fn(),
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: {
      text: 'black',
      bg: 'white',
      card: 'white',
      action: 'green',
      actionForeground: 'white',
    },
  }),
}));
jest.mock('@/lib/classroom/calls-api', () => ({
  classroomCallsApi: {
    detail: jest.fn(),
    joinMissed: jest.fn(),
    messageTutor: jest.fn(),
  },
}));
const missed = {
  id: 'call',
  sessionId: 'session',
  classTitle: 'Test class',
  callerName: 'Test tutor',
  status: 'expired' as const,
  expiresAt: '2026-11-03T12:00:00Z',
  canJoin: true,
  messageAvailable: true,
};
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(classroomCallsApi.detail).mockResolvedValue(missed);
  jest.mocked(classroomCallsApi.joinMissed).mockResolvedValue({ sessionId: 'session' });
  jest
    .mocked(classroomCallsApi.messageTutor)
    .mockResolvedValue({ nativePath: '/(app)/dm/tutor', webPath: '/academy/dm/tutor' });
});
it('shows the missed tutor call and rechecks authorization before joining the classroom', async () => {
  const screen = render(<ClassroomCallDetails callId="call" />);
  await act(async () => {});
  expect(screen.getByText('Missed call')).toBeTruthy();
  expect(screen.getByText('From Test tutor')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Join classroom'));
  await act(async () => {});
  expect(classroomCallsApi.joinMissed).toHaveBeenCalledWith('call');
  expect(mockPush).toHaveBeenCalledWith('/classroom/session');
});
it('keeps messaging available after class time, while joining stays disabled', async () => {
  jest.mocked(classroomCallsApi.detail).mockResolvedValue({ ...missed, canJoin: false });
  const screen = render(<ClassroomCallDetails callId="call" />);
  await act(async () => {});
  fireEvent.press(screen.getByLabelText('Join classroom'));
  expect(classroomCallsApi.joinMissed).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Message tutor'));
  await act(async () => {});
  expect(mockPush).toHaveBeenCalledWith('/(app)/dm/tutor');
});
it('offers retry for an offline or unavailable missed call', async () => {
  jest.mocked(classroomCallsApi.detail).mockRejectedValueOnce(new Error('offline'));
  const screen = render(<ClassroomCallDetails callId="call" />);
  await act(async () => {});
  expect(screen.getByRole('alert')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Retry'));
  await act(async () => {});
  expect(screen.getByText('From Test tutor')).toBeTruthy();
});
