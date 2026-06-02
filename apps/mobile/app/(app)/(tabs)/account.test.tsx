import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockSignOut = jest.fn();
const mockSwitchFamilyView = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'parent@example.com' },
    signOut: mockSignOut,
  }),
}));

jest.mock('@/providers/family-view-provider', () => ({
  useFamilyView: () => ({
    familySwitchOptions: [
      {
        profileId: 'guardian-profile',
        kind: 'guardian',
        label: 'Parent',
        displayName: 'Parent One',
        isActive: true,
        isParentOption: true,
      },
      {
        profileId: 'child-profile',
        kind: 'child',
        label: 'Student',
        displayName: 'Child One',
        isActive: false,
        isParentOption: false,
      },
    ],
    switchFamilyView: mockSwitchFamilyView,
    isViewingAsChild: false,
  }),
}));

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: {
      pageBg: '#ffffff',
      bg: '#ffffff',
      border: '#e5e7eb',
      card: '#ffffff',
      text: '#111827',
      textMuted: '#6b7280',
      textFaint: '#9ca3af',
      teal: '#0f766e',
      tealBg: '#ecfeff',
      red: '#dc2626',
    },
  }),
}));

jest.mock('@/hooks/use-account', () => ({
  useAccount: () => ({
    data: { id: 'account-1', primary_role: 'guardian' },
    isPending: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({
    data: {
      id: 'guardian-profile',
      kind: 'guardian',
      display_name: 'Parent One',
      first_name: 'Parent',
      avatar_url: null,
      avatar_seed: 'seed-1',
      ui_theme_key: null,
    },
    isPending: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@iconicedu/ui-native', () => ({
  BottomSheet: ({
    visible,
    children,
  }: {
    visible: boolean;
    children: React.ReactNode;
  }) => (visible ? <>{children}</> : null),
  Card: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SettingsRow: ({
    label,
    onPress,
    trailing,
  }: {
    label: string;
    onPress?: () => void;
    trailing?: React.ReactNode;
  }) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity onPress={onPress} accessibilityRole="button">
        <Text>{label}</Text>
        {trailing}
      </TouchableOpacity>
    );
  },
}));

jest.mock('@/lib/header-surface', () => ({
  createHeaderSurface: () => ({}),
}));

jest.mock('@/components/skeletons', () => ({
  ProfileSkeleton: () => {
    const { Text } = require('react-native');
    return <Text>loading</Text>;
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('lucide-react-native', () => {
  const { Text } = require('react-native');
  const Icon = ({ size }: { size?: number }) => <Text>{`icon-${size ?? 0}`}</Text>;
  return {
    User: Icon,
    Mail: Icon,
    Sun: Icon,
    MapPin: Icon,
    Bell: Icon,
    Users: Icon,
    Shield: Icon,
    LogOut: Icon,
    ArrowRightLeft: Icon,
    Check: Icon,
  };
});

import AccountScreen from './account';

describe('AccountScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the family switch row above personal and opens the same switch drawer as home', () => {
    render(<AccountScreen />);

    expect(screen.queryByText('Family View')).toBeNull();
    expect(screen.getByText('Switch to child account')).toBeTruthy();
    expect(screen.getByText('Personal')).toBeTruthy();

    fireEvent.press(screen.getByText('Switch to child account'));

    expect(screen.getByText('View as')).toBeTruthy();
    expect(
      screen.getByText('Switch between your parent view and linked child accounts.'),
    ).toBeTruthy();
    expect(screen.getAllByText('Parent One').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Child One').length).toBeGreaterThan(0);
  });

  it('routes Privacy & Data to the privacy data screen', () => {
    render(<AccountScreen />);

    fireEvent.press(screen.getByText('Privacy & Data'));

    expect(mockPush).toHaveBeenCalledWith('/(app)/settings/privacy-data');
  });
});
