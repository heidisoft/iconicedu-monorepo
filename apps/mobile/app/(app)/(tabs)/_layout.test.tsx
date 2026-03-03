import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TabsLayout from './_layout';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: {
      tabBg: '#ffffff',
      tabBorder: '#e2e8f0',
      tabActive: '#2dd4a8',
      tabInactive: '#94a3b8',
      tealBg: '#f0fdfa',
    },
  }),
}));

jest.mock('@/hooks/use-tablet', () => ({
  useTablet: jest.fn(),
}));

jest.mock('lucide-react-native', () => ({
  Home: () => null,
  MessageCircle: () => null,
  Bell: () => null,
  User: () => null,
}));

// Capture the tabBar render prop so we can test it in isolation.
let capturedTabBar: ((props: unknown) => React.ReactNode) | undefined;
let capturedSceneContainerStyle: object | undefined;

jest.mock('expo-router', () => {
  const { View } = require('react-native');

  const Screen = ({ name }: { name: string }) => (
    <View testID={`screen-${name}`} />
  );

  const Tabs = ({
    children,
    tabBar,
    sceneContainerStyle,
  }: {
    children: React.ReactNode;
    tabBar?: (props: unknown) => React.ReactNode;
    sceneContainerStyle?: object;
  }) => {
    capturedTabBar = tabBar;
    capturedSceneContainerStyle = sceneContainerStyle;
    return <View testID="tabs">{children}</View>;
  };

  Tabs.Screen = Screen;

  return { Tabs };
});

// ─── Tests ──────────────────────────────────────────────────────────────────

import { useTablet } from '@/hooks/use-tablet';

const mockTabBarProps = {
  state: {
    routes: [
      { name: 'index',    key: 'index' },
      { name: 'messages', key: 'messages' },
      { name: 'inbox',    key: 'inbox' },
      { name: 'account',  key: 'account' },
      { name: 'schedule', key: 'schedule' },
    ],
    index: 0,
  },
  navigation: { navigate: jest.fn() },
  descriptors: {},
};

describe('TabsLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedTabBar = undefined;
    capturedSceneContainerStyle = undefined;
  });

  describe('on phone (isTablet = false)', () => {
    beforeEach(() => {
      (useTablet as jest.Mock).mockReturnValue(false);
    });

    it('renders without crashing', () => {
      const { getByTestId } = render(<TabsLayout />);
      expect(getByTestId('tabs')).toBeTruthy();
    });

    it('does not pass a custom tabBar prop', () => {
      render(<TabsLayout />);
      expect(capturedTabBar).toBeUndefined();
    });

    it('does not add paddingLeft to sceneContainerStyle', () => {
      render(<TabsLayout />);
      expect(capturedSceneContainerStyle).toBeUndefined();
    });
  });

  describe('on tablet (isTablet = true)', () => {
    beforeEach(() => {
      (useTablet as jest.Mock).mockReturnValue(true);
    });

    it('renders without crashing', () => {
      const { getByTestId } = render(<TabsLayout />);
      expect(getByTestId('tabs')).toBeTruthy();
    });

    it('passes a custom tabBar render prop', () => {
      render(<TabsLayout />);
      expect(capturedTabBar).toBeInstanceOf(Function);
    });

    it('adds paddingLeft to sceneContainerStyle for side rail offset', () => {
      render(<TabsLayout />);
      expect(capturedSceneContainerStyle).toEqual({ paddingLeft: 72 });
    });

    it('SideRail renders a pressable item for each visible tab', () => {
      render(<TabsLayout />);
      const { getAllByRole } = render(
        capturedTabBar!(mockTabBarProps) as React.ReactElement,
      );
      // 4 visible tabs (index, messages, inbox, account) — schedule is hidden
      expect(getAllByRole('tab')).toHaveLength(4);
    });

    it('SideRail highlights the focused tab', () => {
      render(<TabsLayout />);
      const { getAllByRole } = render(
        capturedTabBar!(mockTabBarProps) as React.ReactElement,
      );
      const tabs = getAllByRole('tab');
      // First tab (index = 0) is focused
      expect(tabs[0]?.props.accessibilityState).toEqual({ selected: true });
      expect(tabs[1]?.props.accessibilityState).toEqual({ selected: false });
    });

    it('SideRail calls navigation.navigate on press', () => {
      render(<TabsLayout />);
      const navigate = jest.fn();
      const { getAllByRole } = render(
        capturedTabBar!({
          ...mockTabBarProps,
          navigation: { navigate },
        }) as React.ReactElement,
      );
      const tabs = getAllByRole('tab');
      fireEvent.press(tabs[1]!); // messages tab
      expect(navigate).toHaveBeenCalledWith('messages');
    });
  });
});
