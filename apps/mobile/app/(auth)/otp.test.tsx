import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({
  email: 'iconicedudev+student@gmail.com',
}));
const mockVerifyOtp = jest.fn();
const mockSignInWithOtp = jest.fn();
const mockSetOnboardingCompletionStatus = jest.fn();
const mockScreen = jest.fn();
const mockCapture = jest.fn();
const mockFetchOnboardingStatus = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: (...args: unknown[]) => mockUseLocalSearchParams(...args),
  useRouter: () => ({
    back: jest.fn(),
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
    screen: mockScreen,
    capture: mockCapture,
  }),
}));

jest.mock('@/lib/api/queries', () => ({
  fetchOnboardingStatus: () => mockFetchOnboardingStatus(),
}));

import OtpScreen from './otp';

describe('OtpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockSignInWithOtp.mockResolvedValue({ error: null });
    mockFetchOnboardingStatus.mockResolvedValue({ isComplete: true });
  });

  it('automatically verifies once all 6 digits are entered', async () => {
    render(<OtpScreen />);

    fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith(
        'iconicedudev+student@gmail.com',
        '123456',
      );
    });

    await waitFor(() => {
      expect(mockSetOnboardingCompletionStatus).toHaveBeenCalledWith(true);
      expect(mockReplace).toHaveBeenCalledWith('/(app)/(tabs)');
    });
  });
});
