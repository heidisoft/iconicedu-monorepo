import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockInvalidateQueries = jest.fn(() => Promise.resolve());
const mockRefetchAccount = jest.fn(() => Promise.resolve());
const mockRefetchProfile = jest.fn(() => Promise.resolve());
const mockRefetchSessions = jest.fn(() => Promise.resolve());
const mockRefetchLearningSpaces = jest.fn(() => Promise.resolve());
const mockRefetchSupportChannel = jest.fn(() => Promise.resolve());
const mockRefetchOrgSchedules = jest.fn(() => Promise.resolve());
const mockRouterPush = jest.fn();

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
  useQuery: () => ({
    data: [],
    isPending: false,
    refetch: mockRefetchOrgSchedules,
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'auth-user-1', email: 'parent@example.com' },
  }),
}));

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: {
      pageBg: '#ffffff',
      bg: '#ffffff',
      border: '#e5e7eb',
      card: '#ffffff',
      inputBg: '#f9fafb',
      text: '#111827',
      textMuted: '#6b7280',
      textFaint: '#9ca3af',
      teal: '#0f766e',
      tealBg: '#ecfeff',
      tealFg: '#ffffff',
      red: '#dc2626',
    },
  }),
}));

jest.mock('@/providers/family-view-provider', () => ({
  useFamilyView: () => ({
    familySwitchOptions: [],
    switchFamilyView: jest.fn(),
    isViewingAsChild: false,
  }),
}));

jest.mock('@/hooks/use-account', () => ({
  useAccount: () => ({
    data: {
      id: 'account-1',
      org_id: 'org-1',
      primary_role: 'guardian',
    },
    isPending: false,
    isError: false,
    refetch: mockRefetchAccount,
  }),
}));

jest.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({
    data: {
      id: 'profile-1',
      kind: 'guardian',
      first_name: 'Parent',
      last_name: 'One',
      display_name: 'Parent One',
      timezone: 'America/New_York',
      avatar_url: null,
      avatar_seed: 'seed-1',
      ui_theme_key: null,
    },
    isPending: false,
    isError: false,
    refetch: mockRefetchProfile,
  }),
}));

jest.mock('@/hooks/use-upcoming-sessions', () => ({
  useUpcomingSessions: () => ({
    sessions: [],
    isPending: false,
    isError: false,
    refetch: mockRefetchSessions,
  }),
}));

jest.mock('@/hooks/use-family-links', () => ({
  useFamilyLinks: () => ({
    childProfiles: [],
  }),
}));

jest.mock('@/hooks/use-learning-spaces', () => ({
  useLearningSpaces: () => ({
    data: [],
    isPending: false,
    refetch: mockRefetchLearningSpaces,
  }),
}));

jest.mock('@/hooks/use-support-channel', () => ({
  useSupportChannel: () => ({
    data: null,
    isPending: false,
    refetch: mockRefetchSupportChannel,
  }),
}));

jest.mock('@/components/sessions/session-card', () => ({
  SessionCard: () => null,
}));

jest.mock('@/components/support/app-support-footer', () => ({
  AppSupportFooter: () => null,
}));

jest.mock('@/components/errors/query-error', () => ({
  QueryError: () => null,
}));

jest.mock('@/components/skeletons/pulse-box', () => ({
  PulseBox: () => null,
}));

jest.mock('@iconicedu/ui-native', () => ({
  BottomSheet: ({
    children,
    visible,
  }: {
    children: React.ReactNode;
    visible: boolean;
  }) => (visible ? <>{children}</> : null),
  Card: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  IconButton: () => null,
  SiteLogo: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('lucide-react-native', () => {
  const { Text } = require('react-native');
  const Icon = ({ size }: { size?: number }) => <Text>{`icon-${size ?? 0}`}</Text>;
  return {
    CalendarClock: Icon,
    CalendarCheck: Icon,
    CalendarDays: Icon,
    BookOpenCheck: Icon,
    Users: Icon,
    LayoutGrid: Icon,
    LifeBuoy: Icon,
    ArrowRightLeft: Icon,
    Check: Icon,
    Sparkles: Icon,
  };
});

import HomeScreen from './index';

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refreshes home data when the tab receives focus', async () => {
    render(<HomeScreen />);

    await waitFor(() => expect(mockRefetchAccount).toHaveBeenCalledTimes(1));
    expect(mockRefetchProfile).toHaveBeenCalledTimes(1);
    expect(mockRefetchSessions).toHaveBeenCalledTimes(1);
    expect(mockRefetchLearningSpaces).toHaveBeenCalledTimes(1);
    expect(mockRefetchSupportChannel).toHaveBeenCalledTimes(1);
    expect(mockRefetchOrgSchedules).toHaveBeenCalledTimes(1);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['familyLinks', 'org-1', 'account-1'],
    });
  });
});
