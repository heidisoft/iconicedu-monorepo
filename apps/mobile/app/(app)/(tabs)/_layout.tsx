import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, MessageCircle, Bell, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';
import { useTablet } from '@/hooks/use-tablet';
import { useActivityFeed } from '@/hooks/use-activity-feed';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useDirectMessages } from '@/hooks/use-direct-messages';
import { useLearningSpaceChannels } from '@/hooks/use-learning-space-channels';
import { useSupervisedDirectMessages } from '@/hooks/use-supervised-direct-messages';

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
  { name: 'inbox', title: 'Notifications', Icon: Bell },
  { name: 'account', title: 'Account', Icon: User },
] as const;

type SideRailProps = {
  state: { routes: Array<{ name: string; key: string }>; index: number };
  navigation: { navigate: (name: string) => void };
  inboxUnreadCount: number;
};

function SideRail({ state, navigation, inboxUnreadCount }: SideRailProps) {
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
            <View style={{ position: 'relative' }}>
              <Icon size={22} color={color} />
              {name === 'inbox' && inboxUnreadCount > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -10,
                    minWidth: 18,
                    height: 18,
                    paddingHorizontal: 4,
                    borderRadius: 9,
                    backgroundColor: '#ef4444',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: '700',
                    }}
                  >
                    {inboxUnreadCount > 99 ? '99+' : inboxUnreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
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
  const { data: account } = useAccount();
  const { data: profile } = useProfile();
  const { data: feed } = useActivityFeed();
  const orgId = account?.org_id ?? '';
  const accountId =
    ((account as Record<string, unknown> | undefined)?.id as string) ?? '';
  const profileId =
    ((profile as Record<string, unknown> | undefined)?.id as string | undefined) ?? '';
  const { data: dms } = useDirectMessages(orgId, profileId, accountId);
  const { data: channels } = useLearningSpaceChannels(orgId, profileId, accountId);
  const { data: supervisedDms } = useSupervisedDirectMessages(
    orgId,
    accountId,
    profileId,
  );
  const inboxUnreadCount =
    feed?.sections.reduce(
      (total, section) =>
        total + section.items.filter((item) => !item.state?.isRead).length,
      0,
    ) ?? 0;
  const messagesUnreadCount =
    (dms?.reduce((total, item) => total + (item.unread_count ?? 0), 0) ?? 0) +
    (channels?.reduce((total, item) => total + (item.unread_count ?? 0), 0) ?? 0) +
    (supervisedDms?.reduce((total, item) => total + (item.unread_count ?? 0), 0) ?? 0);

  // insets.bottom accounts for the navigation type automatically:
  //   Gesture navigation → gesture hint height  (~28–34 dp)
  //   3-button nav bar  → full nav bar height   (~48–56 dp)
  // MD3_BOTTOM_MARGIN adds the recommended 8 dp gap above the system bar so
  // icons have comfortable breathing room regardless of navigation mode.
  const bottomPadding = insets.bottom + MD3_BOTTOM_MARGIN;
  const tabBarHeight = TAB_CONTENT_HEIGHT + bottomPadding;

  return (
    <Tabs
      tabBar={
        isTablet
          ? (props) => <SideRail {...props} inboxUnreadCount={inboxUnreadCount} />
          : undefined
      }
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: colors.pageBg,
          ...(isTablet ? { paddingLeft: SIDE_RAIL_WIDTH } : null),
        },
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
          tabBarBadge:
            messagesUnreadCount > 0
              ? messagesUnreadCount > 99
                ? '99+'
                : messagesUnreadCount
              : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#ef4444',
            color: '#fff',
            fontSize: 10,
            fontWeight: '700',
          },
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color }) => <Bell size={22} color={color} />,
          tabBarBadge:
            inboxUnreadCount > 0
              ? inboxUnreadCount > 99
                ? '99+'
                : inboxUnreadCount
              : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#ef4444',
            color: '#fff',
            fontSize: 10,
            fontWeight: '700',
          },
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
