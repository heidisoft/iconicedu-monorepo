import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeClassroomEntry } from './native-classroom-entry';
import { NativeClassroom } from './native-classroom';
import {
  readNativeMeetingLink,
  writeNativeMeetingLink,
} from '@/lib/classroom/link-recovery';
import { ApiHttpError } from '@/lib/api/http-error';
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
jest.mock('@/lib/classroom/api', () => {
  const client = {
    info: jest.fn(),
    join: jest.fn(),
    admission: jest.fn(),
    linkInfo: jest.fn(),
  };
  return { classroomApi: client, createClassroomApi: () => client };
});
jest.mock('@/lib/classroom/link-recovery', () => ({
  readNativeMeetingLink: jest.fn().mockResolvedValue(null),
  writeNativeMeetingLink: jest.fn().mockResolvedValue(undefined),
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
    jest.mocked(readNativeMeetingLink).mockResolvedValue(null);
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

it('joins a guest with separately entered credentials and shows preview before SDK join', async () => {
  jest.mocked(classroomApi.info).mockResolvedValue({
    exists: true,
    isActive: true,
    isHost: false,
    sessionTitle: 'Guest class',
    sessionId: 'canonical-session',
    passcodeRequired: true,
  });
  jest
    .mocked(classroomApi.join)
    .mockResolvedValue({ ...credentials, displayName: 'Guest student' });
  const screen = render(<NativeClassroomEntry sessionId="guest-code" />);
  await waitFor(() => expect(screen.getByLabelText('Guest name')).toBeTruthy());
  fireEvent.changeText(screen.getByLabelText('Guest name'), 'Guest student');
  fireEvent.changeText(screen.getByLabelText('Session passcode'), 'synthetic-passcode');
  fireEvent.press(screen.getByLabelText('Continue to preview'));
  await waitFor(() =>
    expect(classroomApi.join).toHaveBeenCalledWith(
      'canonical-session',
      expect.objectContaining({
        displayName: 'Guest student',
        passcode: 'synthetic-passcode',
      }),
    ),
  );
  await waitFor(() => expect(screen.getByTestId('preview')).toBeTruthy());
  expect(writeNativeMeetingLink).toHaveBeenCalledWith(
    'guest-code',
    expect.not.objectContaining({ passcode: expect.anything() }),
  );
});
it('recovers an invited guest without repeating name or password prompts', async () => {
  jest.mocked(readNativeMeetingLink).mockResolvedValue({
    token: 'synthetic-invite',
    displayName: 'Returning guest',
    expiresAt: Date.now() + 10000,
  });
  jest.mocked(classroomApi.linkInfo).mockResolvedValue({
    info: {
      exists: true,
      isActive: true,
      isHost: false,
      sessionTitle: 'Guest class',
      sessionId: 'canonical-session',
      passcodeRequired: true,
    },
    linkToken: 'synthetic-invite',
  });
  jest
    .mocked(classroomApi.join)
    .mockResolvedValue({ ...credentials, displayName: 'Returning guest' });
  const screen = render(<NativeClassroomEntry sessionId="guest-code" />);
  await waitFor(() => expect(screen.getByTestId('preview')).toBeTruthy());
  expect(screen.queryByLabelText('Guest name')).toBeNull();
  expect(screen.queryByLabelText('Session passcode')).toBeNull();
  expect(classroomApi.join).toHaveBeenCalledWith(
    'canonical-session',
    expect.objectContaining({
      displayName: 'Returning guest',
      passcode: '',
      linkToken: 'synthetic-invite',
    }),
  );
});

it('clears a revoked invitation from recovery instead of retrying it forever', async () => {
  jest.clearAllMocks();
  const expiresAt = Date.now() + 10000;
  jest.mocked(readNativeMeetingLink).mockResolvedValue({
    token: 'revoked-synthetic-invite',
    displayName: 'Guest',
    expiresAt,
  });
  jest
    .mocked(classroomApi.linkInfo)
    .mockRejectedValue(new ApiHttpError('Invitation expired', 401));
  const screen = render(<NativeClassroomEntry sessionId="guest-code" />);
  await waitFor(() => expect(screen.getByText('Invitation expired')).toBeTruthy());
  expect(writeNativeMeetingLink).toHaveBeenCalledWith('guest-code', {
    displayName: 'Guest',
    expiresAt,
  });
  expect(classroomApi.join).not.toHaveBeenCalled();
});
