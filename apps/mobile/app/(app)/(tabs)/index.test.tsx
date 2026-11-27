import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

let mockReferralEnabled = true;
jest.mock('@/hooks/use-mobile-feature-flag', () => ({
  useMobileFeatureFlag: () => mockReferralEnabled,
}));
let mockViewingAsChild = false;
let mockHasChild = false;
const mockSubmitClassRequest = jest.fn();
jest.mock('@/lib/api/queries', () => ({
  ...jest.requireActual('@/lib/api/queries'),
  submitClassRequest: (...args: unknown[]) => mockSubmitClassRequest(...args),
}));
let mockProfileKind = 'guardian';
let mockSupportChannel: { id: string; topic: string } | null = null;
const mockParentTiles = jest.fn(
  (_props: {
    orgId: string;
    accountId: string;
    onAddChild: () => void;
    onRefer?: () => void;
    onRequestClass?: () => void;
    onSuggestionDismissed?: () => void;
  }) => null,
);
const mockFamilyActions = jest.fn(
  (_props: {
    highlight?: number;
    referralsEnabled?: boolean;
    onAddChild: () => void;
    onRefer?: () => void;
    onRequestClass?: () => void;
  }) => null,
);
jest.mock('@/components/home/family-actions-tile', () => ({
  FamilyActionsTile: (props: Parameters<typeof mockFamilyActions>[0]) => {
    const { Text } = require('react-native');
    mockFamilyActions(props);
    return <Text>Permanent family actions tile</Text>;
  },
}));
jest.mock('@/components/home/parent-home-tiles', () => ({
  ParentHomeTiles: (props: Parameters<typeof mockParentTiles>[0]) => {
    const { Text } = require('react-native');
    mockParentTiles(props);
    return <Text>Family suggestions tile</Text>;
  },
}));
jest.mock('@/components/home/parent-referral-explainer', () => ({
  ParentReferralExplainer: ({
    orgId,
    onClose,
  }: {
    orgId: string;
    onClose: () => void;
  }) => {
    const { Text, Pressable, View } = require('react-native');
    return (
      <View>
        <Text>Referral explainer for {orgId}</Text>
        <Pressable accessibilityLabel="Close mock referral explainer" onPress={onClose} />
      </View>
    );
  },
}));
jest.mock('@/components/home/family-action-explainer', () => ({
  FamilyActionExplainer: ({
    kind,
    onContinue,
    onClose,
    onInvite,
  }: {
    kind: string;
    onContinue: () => void;
    onClose: () => void;
    onInvite: () => void;
  }) => {
    const { Text, Pressable, View } = require('react-native');
    return (
      <View>
        <Text>{`Introduction: ${kind}`}</Text>
        <Pressable accessibilityLabel="Continue family introduction" onPress={onContinue}>
          <Text>Continue</Text>
        </Pressable>
        <Pressable accessibilityLabel="Close family introduction" onPress={onClose}>
          <Text>Close</Text>
        </Pressable>
        <Pressable accessibilityLabel="Invite from introduction" onPress={onInvite}>
          <Text>Invite</Text>
        </Pressable>
      </View>
    );
  },
}));
const mockInvalidateQueries = jest.fn(() => Promise.resolve());
const mockRefetchAccount = jest.fn(() => Promise.resolve());
const mockRefetchProfile = jest.fn(() => Promise.resolve());
const mockRefetchSessions = jest.fn(() => Promise.resolve());
const mockRefetchLearningSpaces = jest.fn(() => Promise.resolve());
const mockRefetchSupportChannel = jest.fn(() => Promise.resolve());
const mockRefetchOrgSchedules = jest.fn(() => Promise.resolve());
const mockRouterPush = jest.fn();
const mockRefetchCompletedSessions = jest.fn(() => Promise.resolve());

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useIsFocused: () => true,
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
    familySwitchOptions: mockHasChild
      ? [
          {
            kind: 'child',
            profileId: 'child-1',
            displayName: 'Child One',
            label: 'Child One',
          },
        ]
      : [],
    switchFamilyView: jest.fn(),
    isViewingAsChild: mockViewingAsChild,
    guardianProfileId: 'guardian-profile',
    guardianAccountId: 'account-1',
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
      kind: mockProfileKind,
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

jest.mock('@/hooks/use-completed-sessions', () => ({
  useCompletedSessions: () => ({
    sessions: [{ id: 'completion-1' }],
    summary: { completed: 7, pending: 2 },
    isOrgAdminView: false,
    isPending: false,
    refetch: mockRefetchCompletedSessions,
  }),
}));

jest.mock('@/components/sessions/session-completed-carousel', () => ({
  SessionCompletedCarousel: ({ sessions }: { sessions: unknown[] }) => {
    const { Text } = require('react-native');
    return <Text>{`completed-carousel:${sessions.length}`}</Text>;
  },
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
    data: mockSupportChannel,
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
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaProvider: require('react-native').View,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('lucide-react-native', () => {
  const { Text } = require('react-native');
  const Icon = ({ size }: { size?: number }) => <Text>{`icon-${size ?? 0}`}</Text>;
  return {
    BookOpen: Icon,
    ChevronDown: Icon,
    X: Icon,
    Search: Icon,
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
    mockViewingAsChild = false;
    mockProfileKind = 'guardian';
    mockReferralEnabled = true;
    mockSupportChannel = null;
  });

  it('refreshes home data when the tab receives focus', async () => {
    render(<HomeScreen />);

    await waitFor(() => expect(mockRefetchAccount).toHaveBeenCalledTimes(1));
    expect(mockRefetchProfile).toHaveBeenCalledTimes(1);
    expect(mockRefetchSessions).toHaveBeenCalledTimes(1);
    expect(mockRefetchLearningSpaces).toHaveBeenCalledTimes(1);
    expect(mockRefetchSupportChannel).toHaveBeenCalledTimes(1);
    expect(mockRefetchOrgSchedules).toHaveBeenCalledTimes(1);
    expect(mockRefetchCompletedSessions).toHaveBeenCalledTimes(1);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['familyLinks', 'org-1', 'account-1'],
    });
  });

  it('shows the session completion summary tile and the recently completed carousel', () => {
    const screen = render(<HomeScreen />);

    expect(screen.getByText('Sessions completed')).toBeTruthy();
    expect(
      screen.getByLabelText(
        'Session completion summary. 7 sessions completed, 2 awaiting confirmation.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('completed-carousel:1')).toBeTruthy();
    expect(screen.queryByText('Completed Classes')).toBeNull();
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  mockViewingAsChild = false;
  mockProfileKind = 'guardian';
  mockReferralEnabled = true;
  mockSupportChannel = null;
  mockHasChild = false;
  mockSubmitClassRequest.mockResolvedValue({
    success: true,
    channelId: 'request-channel',
  });
});
it('opens the Add Child introduction before the existing form', () => {
  const view = render(<HomeScreen />);
  const props = mockParentTiles.mock.calls.at(-1)![0];
  expect(props).toMatchObject({ orgId: 'org-1', accountId: 'account-1' });
  act(() => props.onAddChild());
  expect(mockRouterPush).not.toHaveBeenCalled();
  fireEvent.press(view.getByLabelText('Continue family introduction'));
  expect(mockRouterPush).toHaveBeenCalledWith('/(app)/settings/child');
});
it.each(['child', 'educator', 'staff', 'admin'])(
  'hides parent promotions from %s profiles',
  (kind) => {
    mockProfileKind = kind;
    render(<HomeScreen />);
    expect(mockParentTiles).not.toHaveBeenCalled();
    expect(mockFamilyActions).not.toHaveBeenCalled();
  },
);
it('hides parent promotions while viewing a child', () => {
  mockViewingAsChild = true;
  render(<HomeScreen />);
  expect(mockParentTiles).not.toHaveBeenCalled();
});

it('opens the reward explainer before sharing or navigation', () => {
  const view = render(<HomeScreen />);
  act(() => mockParentTiles.mock.calls.at(-1)![0].onRefer!());
  expect(view.getByText('Referral explainer for org-1')).toBeTruthy();
  expect(mockRouterPush).not.toHaveBeenCalled();
  fireEvent.press(view.getByLabelText('Close mock referral explainer'));
  expect(view.queryByText('Referral explainer for org-1')).toBeNull();
});
it('places family suggestions before the other Overview tiles', () => {
  const view = render(<HomeScreen />);
  const suggestions = view.getByText('Family suggestions tile');
  const upcoming = view.getByText('Upcoming Sessions');
  let row = suggestions.parent;
  while (row && row.findAll((node) => node === upcoming).length === 0) row = row.parent;
  expect(row?.findAll((node) => node === suggestions || node === upcoming)[0]).toBe(
    suggestions,
  );
});

it('keeps Add Child available but provides no referral action when referrals are off', () => {
  mockReferralEnabled = false;
  const view = render(<HomeScreen />);
  const props = mockParentTiles.mock.calls.at(-1)![0];
  expect(props.onRefer).toBeUndefined();
  act(() => props.onAddChild());
  expect(mockRouterPush).not.toHaveBeenCalled();
  fireEvent.press(view.getByLabelText('Continue family introduction'));
  expect(mockRouterPush).toHaveBeenCalledWith('/(app)/settings/child');
  expect(view.queryByText('Referral explainer for org-1')).toBeNull();
});
it('closes an open referral explainer when the flag turns off', () => {
  const view = render(<HomeScreen />);
  act(() => mockParentTiles.mock.calls.at(-1)![0].onRefer!());
  expect(view.getByText('Referral explainer for org-1')).toBeTruthy();
  mockReferralEnabled = false;
  view.rerender(<HomeScreen />);
  expect(view.queryByText('Referral explainer for org-1')).toBeNull();
  mockReferralEnabled = true;
  view.rerender(<HomeScreen />);
  expect(view.queryByText('Referral explainer for org-1')).toBeNull();
});

it('opens the existing first-time class request flow from the new suggestion and submits to its conversation', async () => {
  mockHasChild = true;
  mockReferralEnabled = false;
  const view = render(<HomeScreen />);
  act(() => mockParentTiles.mock.calls.at(-1)![0].onRequestClass!());
  expect(view.getByText('Introduction: class')).toBeTruthy();
  expect(view.queryByText('Explore Classes')).toBeNull();
  fireEvent.press(view.getByLabelText('Continue family introduction'));
  expect(view.getByText('Explore Classes')).toBeTruthy();
  expect(view.getByText('Child One')).toBeTruthy();
  fireEvent.press(view.getByText('Submit request'));
  expect(view.getByText('Select at least one subject.')).toBeTruthy();
  expect(mockSubmitClassRequest).not.toHaveBeenCalled();
  fireEvent.press(view.getByLabelText('Select subjects'));
  fireEvent.press(view.getByText('Math'));
  fireEvent.press(view.getByLabelText('Done selecting'));
  fireEvent.press(view.getByText('Submit request'));
  await waitFor(() =>
    expect(mockSubmitClassRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestIntent: 'ongoing-tutoring',
        studentProfileIds: ['child-1'],
        subjects: ['Math'],
      }),
    ),
  );
  await waitFor(() =>
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/(app)/channel/[channelId]',
      params: { channelId: 'request-channel' },
    }),
  );
  expect(view.queryByText('Explore Classes')).toBeNull();
});
it('does not offer the class request slide until there is a student', () => {
  render(<HomeScreen />);
  expect(mockParentTiles.mock.calls.at(-1)![0].onRequestClass).toBeUndefined();
});

it('can dismiss an introduction without navigating or creating anything', () => {
  const view = render(<HomeScreen />);
  act(() => mockParentTiles.mock.calls.at(-1)![0].onAddChild());
  fireEvent.press(view.getByLabelText('Close family introduction'));
  expect(view.queryByText('Introduction: child')).toBeNull();
  expect(mockRouterPush).not.toHaveBeenCalled();
  expect(mockSubmitClassRequest).not.toHaveBeenCalled();
});
it('offers the original email invite from the Add child introduction', () => {
  const view = render(<HomeScreen />);
  act(() => mockParentTiles.mock.calls.at(-1)![0].onAddChild());
  fireEvent.press(view.getByLabelText('Invite from introduction'));
  expect(mockRouterPush).toHaveBeenCalledWith('/(app)/settings/invite-child');
});
it('clears the introduction when switching to a child view', () => {
  const view = render(<HomeScreen />);
  act(() => mockParentTiles.mock.calls.at(-1)![0].onAddChild());
  mockViewingAsChild = true;
  view.rerender(<HomeScreen />);
  mockViewingAsChild = false;
  view.rerender(<HomeScreen />);
  expect(view.queryByText('Introduction: child')).toBeNull();
  expect(mockRouterPush).not.toHaveBeenCalled();
});

it('keeps the permanent family tile last in Overview and highlights it after dismissal', async () => {
  const view = render(<HomeScreen />);
  const row = view.getByTestId('home-overview-row');
  const tiles = row
    .findAll((node) => node.type === require('react-native').Text)
    .map((node) => node.props.children);
  expect(tiles.at(-1)).toBe('Permanent family actions tile');
  expect(mockFamilyActions.mock.calls.at(-1)![0].highlight).toBe(0);
  await act(async () => mockParentTiles.mock.calls.at(-1)![0].onSuggestionDismissed!());
  expect(mockFamilyActions.mock.calls.at(-1)![0].highlight).toBe(1);
});
it('opens the same introductions from the permanent family actions tile', () => {
  mockHasChild = true;
  const view = render(<HomeScreen />);
  act(() => mockFamilyActions.mock.calls.at(-1)![0].onAddChild());
  expect(view.getByText('Introduction: child')).toBeTruthy();
  fireEvent.press(view.getByLabelText('Close family introduction'));
  act(() => mockFamilyActions.mock.calls.at(-1)![0].onRequestClass!());
  expect(view.getByText('Introduction: class')).toBeTruthy();
});
it('keeps referrals gated in the permanent action list', () => {
  mockReferralEnabled = false;
  render(<HomeScreen />);
  expect(mockFamilyActions.mock.calls.at(-1)![0].onRefer).toBeUndefined();
});
