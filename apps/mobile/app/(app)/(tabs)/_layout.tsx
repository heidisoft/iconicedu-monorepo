import React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, MessageCircle, Bell, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';

// Fixed height for the icon + label content area.
const TAB_CONTENT_HEIGHT = 57;

// MD3 recommends ≥8dp of breathing room between navigation items and the
// system gesture / button bar edge (Material Design 3 — Navigation bar specs).
const MD3_BOTTOM_MARGIN = 8;

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // insets.bottom accounts for the navigation type automatically:
  //   Gesture navigation → gesture hint height  (~28–34 dp)
  //   3-button nav bar  → full nav bar height   (~48–56 dp)
  // MD3_BOTTOM_MARGIN adds the recommended 8 dp gap above the system bar so
  // icons have comfortable breathing room regardless of navigation mode.
  const bottomPadding = insets.bottom + MD3_BOTTOM_MARGIN;
  const tabBarHeight = TAB_CONTENT_HEIGHT + bottomPadding;

  return (
    <Tabs
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
      <Tabs.Screen
        name="schedule"
        options={{ href: null }}
      />
    </Tabs>
  );
}
