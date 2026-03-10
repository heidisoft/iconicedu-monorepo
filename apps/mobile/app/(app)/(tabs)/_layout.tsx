import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, MessageCircle, Bell, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';
import { useTablet } from '@/hooks/use-tablet';

// Fixed height for the icon + label content area.
const TAB_CONTENT_HEIGHT = 57;

// MD3 recommends ≥8dp of breathing room between navigation items and the
// system gesture / button bar edge (Material Design 3 — Navigation bar specs).
const MD3_BOTTOM_MARGIN = 8;

// Width of the left-side navigation rail shown on tablets.
const SIDE_RAIL_WIDTH = 72;

// Visible tabs in the order they appear in both the bottom bar and side rail.
const VISIBLE_TABS = [
  { name: 'index', title: 'Home', Icon: Home },
  { name: 'messages', title: 'Messages', Icon: MessageCircle },
  { name: 'inbox', title: 'Inbox', Icon: Bell },
  { name: 'account', title: 'Account', Icon: User },
] as const;

type SideRailProps = {
  state: { routes: Array<{ name: string; key: string }>; index: number };
  navigation: { navigate: (name: string) => void };
};

function SideRail({ state, navigation }: SideRailProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: SIDE_RAIL_WIDTH,
        backgroundColor: colors.tabBg,
        borderRightWidth: 1,
        borderRightColor: colors.tabBorder,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 16,
        alignItems: 'center',
        gap: 4,
      }}
    >
      {VISIBLE_TABS.map(({ name, title, Icon }) => {
        const routeIndex = state.routes.findIndex((r) => r.name === name);
        if (routeIndex === -1) return null;
        const isFocused = state.index === routeIndex;
        const color = isFocused ? colors.tabActive : colors.tabInactive;

        return (
          <TouchableOpacity
            key={name}
            onPress={() => navigation.navigate(name)}
            accessibilityLabel={title}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            style={{
              width: 52,
              height: 52,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              backgroundColor: isFocused ? colors.tealBg : 'transparent',
            }}
          >
            <Icon size={22} color={color} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isTablet = useTablet();

  // insets.bottom accounts for the navigation type automatically:
  //   Gesture navigation → gesture hint height  (~28–34 dp)
  //   3-button nav bar  → full nav bar height   (~48–56 dp)
  // MD3_BOTTOM_MARGIN adds the recommended 8 dp gap above the system bar so
  // icons have comfortable breathing room regardless of navigation mode.
  const bottomPadding = insets.bottom + MD3_BOTTOM_MARGIN;
  const tabBarHeight = TAB_CONTENT_HEIGHT + bottomPadding;

  return (
    <Tabs
      tabBar={isTablet ? (props) => <SideRail {...props} /> : undefined}
      sceneContainerStyle={isTablet ? { paddingLeft: SIDE_RAIL_WIDTH } : undefined}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBg,
          borderTopColor: colors.tabBorder,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: bottomPadding,
          paddingTop: 10,
        },
        // tabBarBackground fills the full container (icon area + gesture/nav area)
        // with the theme color so it shows through the transparent system bar.
        tabBarBackground: () => (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: colors.tabBg,
            }}
          />
        ),
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <MessageCircle size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color }) => <Bell size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => <User size={22} color={color} />,
        }}
      />
      <Tabs.Screen name="schedule" options={{ href: null }} />
    </Tabs>
  );
}
