import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockSignOut = jest.fn();
const mockDeleteCurrentAccount = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    signOut: mockSignOut,
  }),
}));

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: {
      pageBg: '#ffffff',
      border: '#e5e7eb',
      card: '#ffffff',
      text: '#111827',
      textMuted: '#6b7280',
      textFaint: '#9ca3af',
      red: '#dc2626',
    },
  }),
}));

jest.mock('@/lib/api/account/queries', () => ({
  deleteCurrentAccount: (...args: unknown[]) => mockDeleteCurrentAccount(...args),
}));

jest.mock('@iconicedu/ui-native', () => ({
  SettingsRow: ({
    label,
    onPress,
    trailing,
  }: {
    label: string;
    onPress?: () => void;
    trailing?: React.ReactNode;
  }) => {
    const { Text, TouchableOpacity } = require('react-native');
    return (
      <TouchableOpacity onPress={onPress} accessibilityRole="button">
        <Text>{label}</Text>
        {trailing}
      </TouchableOpacity>
    );
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('lucide-react-native', () => {
  const { Text } = require('react-native');
  const Icon = ({ size }: { size?: number }) => <Text>{`icon-${size ?? 0}`}</Text>;
  return {
    ChevronLeft: Icon,
    Shield: Icon,
    Trash2: Icon,
  };
});

import PrivacyDataScreen from './privacy-data';

describe('PrivacyDataScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    mockDeleteCurrentAccount.mockResolvedValue({ deletedAt: '2026-06-02T00:00:00Z' });
    mockSignOut.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the account deletion action', () => {
    render(<PrivacyDataScreen />);

    expect(screen.getByText('Privacy & Data')).toBeTruthy();
    expect(screen.getByText('Delete account')).toBeTruthy();
    expect(screen.getByText('This action cannot be undone.')).toBeTruthy();
  });

  it('lets the first confirmation be cancelled', () => {
    render(<PrivacyDataScreen />);

    fireEvent.press(screen.getByText('Delete account'));
    const firstAlert = (Alert.alert as jest.Mock).mock.calls[0];
    firstAlert[2][0].onPress?.();

    expect(mockDeleteCurrentAccount).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('deletes the account and signs out after final confirmation', async () => {
    render(<PrivacyDataScreen />);

    fireEvent.press(screen.getByText('Delete account'));
    const firstAlert = (Alert.alert as jest.Mock).mock.calls[0];
    firstAlert[2][1].onPress();
    const secondAlert = (Alert.alert as jest.Mock).mock.calls[1];
    await act(async () => {
      secondAlert[2][1].onPress();
    });

    await waitFor(() => expect(mockDeleteCurrentAccount).toHaveBeenCalledTimes(1));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('shows an alert when account deletion fails', async () => {
    mockDeleteCurrentAccount.mockRejectedValueOnce(new Error('Server failed'));
    render(<PrivacyDataScreen />);

    fireEvent.press(screen.getByText('Delete account'));
    const firstAlert = (Alert.alert as jest.Mock).mock.calls[0];
    firstAlert[2][1].onPress();
    const secondAlert = (Alert.alert as jest.Mock).mock.calls[1];
    await act(async () => {
      secondAlert[2][1].onPress();
    });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Unable to delete account',
        'Server failed',
      ),
    );
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
