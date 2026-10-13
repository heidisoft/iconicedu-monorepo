import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeClassroomEntry } from './native-classroom-entry';
import { NativeClassroom } from './native-classroom';
import { classroomApi } from '@/lib/classroom/api';
jest.mock('@zoom/react-native-videosdk', () => ({
  ZoomVideoSdkProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: { bg: 'white', text: 'black' } }),
}));
jest.mock('./native-classroom', () => {
  const Text = require('react-native').Text;
  return {
    NativeClassroom: jest.fn(
      ({
        sessionId,
        credentials,
        hostEligible,
      }: {
        sessionId: string;
        credentials: { displayName: string };
        hostEligible: boolean;
      }) => (
        <Text testID="preview">{`${sessionId}|${credentials.displayName}|${hostEligible}`}</Text>
      ),
    ),
  };
});
jest.mock('@/lib/classroom/api', () => ({
  classroomApi: { info: jest.fn(), join: jest.fn(), admission: jest.fn() },
}));
const credentials = {
  sessionName: 'Test',
  displayName: 'Verified student',
  token: 'synthetic',
  expiresAt: null,
};
const info = {
  exists: true as const,
  isActive: true as const,
  sessionId: 'canonical-session',
  sessionTitle: 'Class',
  isHost: false as const,
  participant: { displayName: 'Verified student' },
};
describe('native real link-entry contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(classroomApi.info).mockResolvedValue(info);
    jest.mocked(classroomApi.join).mockResolvedValue(credentials);
  });
  it('resolves short codes to canonical IDs and uses signed-in identity without asking name/password', async () => {
    const screen = render(<NativeClassroomEntry sessionId="aaaa-bbbb-cccc" />);
    await waitFor(() =>
      expect(screen.getByTestId('preview')).toHaveTextContent(
        'canonical-session|Verified student|false',
      ),
    );
    expect(classroomApi.join).toHaveBeenCalledWith('canonical-session', {
      displayName: 'Verified student',
      passcode: '',
      studentProfileId: undefined,
      admissionToken: undefined,
    });
    expect(screen.queryByPlaceholderText(/password|name/i)).toBeNull();
  });
  it('renews credentials at Join and forwards an explicit display-name override', async () => {
    render(<NativeClassroomEntry sessionId="short-code" />);
    await waitFor(() => expect(NativeClassroom).toHaveBeenCalled());
    const preview = jest.mocked(NativeClassroom).mock.calls.at(-1)![0];
    const renewed = { ...credentials, token: 'renewed-synthetic-token' };
    jest.mocked(classroomApi.join).mockResolvedValueOnce(renewed);
    await expect(preview.authorize?.('Updated name')).resolves.toEqual(renewed);
    expect(classroomApi.join).toHaveBeenLastCalledWith(
      'canonical-session',
      expect.objectContaining({
        displayName: 'Verified student',
        displayNameOverride: 'Updated name',
        passcode: '',
      }),
    );
  });
  it('uses host credentials issued by the API without a second guest join', async () => {
    jest.mocked(classroomApi.info).mockResolvedValue({
      ...info,
      isHost: true,
      hostJoin: { ...credentials, displayName: 'Verified teacher', passcode: null },
    });
    const screen = render(<NativeClassroomEntry sessionId="short-code" />);
    await waitFor(() =>
      expect(screen.getByTestId('preview')).toHaveTextContent(
        'canonical-session|Verified teacher|true',
      ),
    );
    expect(classroomApi.join).not.toHaveBeenCalled();
  });
  it('requires a parent with multiple students to choose an enrolled identity', async () => {
    jest.mocked(classroomApi.info).mockResolvedValue({
      ...info,
      participant: {
        displayName: 'Guardian',
        students: [
          { profileId: 'child-1', displayName: 'Child one' },
          { profileId: 'child-2', displayName: 'Child two' },
        ],
      },
    });
    const screen = render(<NativeClassroomEntry sessionId="code" />);
    await waitFor(() => expect(screen.getByText('Child two')).toBeTruthy());
    expect(classroomApi.join).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Child two'));
    await waitFor(() =>
      expect(classroomApi.join).toHaveBeenCalledWith(
        'canonical-session',
        expect.objectContaining({ studentProfileId: 'child-2' }),
      ),
    );
  });
  it('polls waiting admission and redeems approval through the same join contract', async () => {
    jest.useFakeTimers();
    jest
      .mocked(classroomApi.join)
      .mockResolvedValueOnce({
        admission: { token: 'synthetic-admission', status: 'waiting' },
      })
      .mockResolvedValue(credentials);
    jest
      .mocked(classroomApi.admission)
      .mockResolvedValue({ token: 'synthetic-admission', status: 'approved' });
    const screen = render(<NativeClassroomEntry sessionId="code" />);
    await waitFor(() =>
      expect(screen.getByText('Waiting for the teacher to admit you')).toBeTruthy(),
    );
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    await waitFor(() => expect(screen.getByTestId('preview')).toBeTruthy());
    expect(classroomApi.admission).toHaveBeenCalledWith(
      'canonical-session',
      'synthetic-admission',
    );
    expect(classroomApi.join).toHaveBeenLastCalledWith(
      'canonical-session',
      expect.objectContaining({ admissionToken: 'synthetic-admission' }),
    );
    screen.unmount();
    jest.useRealTimers();
  });
  it('offers a retry on network failure and never opens a preview for an ended session', async () => {
    jest
      .mocked(classroomApi.info)
      .mockRejectedValueOnce(new Error('Unable to reach the server'))
      .mockResolvedValue({ exists: false });
    const screen = render(<NativeClassroomEntry sessionId="code" />);
    await waitFor(() => expect(screen.getByText('Retry')).toBeTruthy());
    fireEvent.press(screen.getByText('Retry'));
    await waitFor(() =>
      expect(screen.getByText('This meeting is no longer active.')).toBeTruthy(),
    );
    expect(classroomApi.join).not.toHaveBeenCalled();
  });
});
