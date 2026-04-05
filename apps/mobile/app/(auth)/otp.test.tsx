import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

const mockUseLocalSearchParams = jest.fn(() => ({
  email: 'iconicedudev+student@gmail.com',
}));
const mockVerifyOtp = jest.fn();
const mockSignInWithOtp = jest.fn();
const mockSetOnboardingCompletionStatus = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let consoleErrorSpy: jest.SpyInstance | undefined;

jest.mock('expo-router', () => ({
  useLocalSearchParams: (...args: unknown[]) => mockUseLocalSearchParams(...args),
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    verifyOtp: mockVerifyOtp,
    signInWithOtp: mockSignInWithOtp,
    setOnboardingCompletionStatus: mockSetOnboardingCompletionStatus,
  }),
}));

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: {
      bg: '#ffffff',
      text: '#111111',
      textMuted: '#666666',
      textFaint: '#999999',
      border: '#dddddd',
      inputBg: '#f5f5f5',
      red: '#ff0000',
      teal: '#00aaaa',
      tealFg: '#ffffff',
    },
  }),
}));

jest.mock('@/providers/analytics-provider', () => ({
  useAnalytics: () => ({
    screen: jest.fn(),
    capture: jest.fn(),
  }),
}));

import OtpScreen from './otp';

describe('OtpScreen', () => {
  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
      const joined = args.map(String).join(' ');
      if (
        joined.includes('An update to OtpScreen inside a test was not wrapped in act')
      ) {
        return;
      }
    });
  });

  afterAll(() => {
    consoleErrorSpy?.mockRestore();
  });

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockSignInWithOtp.mockResolvedValue({ error: null });
  });

  it('automatically verifies once all 6 digits are entered', async () => {
    render(<OtpScreen />);
    const input = screen.getByLabelText('Verification code');

    act(() => {
      input.props.onChangeText('123456');
    });

    expect(mockVerifyOtp).toHaveBeenCalledTimes(1);
    expect(mockVerifyOtp).toHaveBeenCalledWith(
      'iconicedudev+student@gmail.com',
      '123456',
    );
  });
});
