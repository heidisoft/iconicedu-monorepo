import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, MessageCircle, User } from 'lucide-react-native';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/hooks/use-profile';
import { useActivityFeed } from '@/hooks/use-activity-feed';
import { useUpcomingSessions } from '@/hooks/use-upcoming-sessions';
import { useTheme } from '@/providers/theme-provider';
import { useFlag } from '@/providers/feature-flags-provider';
import { ActivityFeedSkeleton } from '@/components/skeletons';
import { PulseBox } from '@/components/skeletons/pulse-box';
import { SessionCard } from '@/components/sessions/session-card';
import {
  ActivityItem,
  makeActivityItemStyles,
} from '@/components/activity/activity-item';
import type { AppColors } from '@/lib/theme';
import type { ActivityFeedItemVM } from '@iconicedu/shared-types';

// ---------------------------------------------------------------------------
// Avatar color helpers — ui_theme_key → hex, fallback to seed palette
// ---------------------------------------------------------------------------

const THEME_KEY_COLORS: Record<string, { bg: string; fg: string }> = {
  slate: { bg: '#64748b', fg: '#ffffff' },
  gray: { bg: '#6b7280', fg: '#ffffff' },
  zinc: { bg: '#71717a', fg: '#ffffff' },
  neutral: { bg: '#737373', fg: '#ffffff' },
  stone: { bg: '#78716c', fg: '#ffffff' },
  red: { bg: '#ef4444', fg: '#ffffff' },
  orange: { bg: '#f97316', fg: '#ffffff' },
  amber: { bg: '#f59e0b', fg: '#1f2937' },
  yellow: { bg: '#eab308', fg: '#1f2937' },
  lime: { bg: '#84cc16', fg: '#1f2937' },
  green: { bg: '#22c55e', fg: '#ffffff' },
  emerald: { bg: '#10b981', fg: '#ffffff' },
  teal: { bg: '#14b8a6', fg: '#ffffff' },
  cyan: { bg: '#06b6d4', fg: '#ffffff' },
  sky: { bg: '#0ea5e9', fg: '#ffffff' },
  blue: { bg: '#3b82f6', fg: '#ffffff' },
  indigo: { bg: '#6366f1', fg: '#ffffff' },
  violet: { bg: '#8b5cf6', fg: '#ffffff' },
  purple: { bg: '#a855f7', fg: '#ffffff' },
  fuchsia: { bg: '#d946ef', fg: '#ffffff' },
  pink: { bg: '#ec4899', fg: '#ffffff' },
  rose: { bg: '#f43f5e', fg: '#ffffff' },
};

const AVATAR_COLORS = [
  '#5B8DEF',
  '#E07B54',
  '#6CC070',
  '#A86CC1',
  '#E0A854',
  '#54B8C4',
  '#E06C8A',
];

function seedColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

function resolveAvatarColor(
  themeKey?: string | null,
  seed?: string | null,
): { bg: string; fg: string } {
  if (themeKey && THEME_KEY_COLORS[themeKey]) return THEME_KEY_COLORS[themeKey]!;
  const bg = seedColor(seed ?? 'default');
  return { bg, fg: '#ffffff' };
}

function getRecentItems(
  sections: ActivityFeedItemVM[][] | undefined,
  n: number,
): ActivityFeedItemVM[] {
  if (!sections) return [];
  return sections.flat().slice(0, n);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const quickNav = [
  {
    label: 'Messages',
    Icon: MessageCircle,
    route: '/(app)/(tabs)/messages',
    desc: 'Your conversations',
  },
  {
    label: 'Account',
    Icon: User,
    route: '/(app)/(tabs)/account',
    desc: 'Profile & settings',
  },
] as const;

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.pageBg },
    scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 22 },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarTxt: { color: '#ffffff', fontWeight: '800', fontSize: 18 },
    bellBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.tealBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    greetingLine: { fontSize: 15, color: C.textMuted, fontWeight: '500' },
    headline: {
      fontSize: 28,
      fontWeight: '800',
      color: C.text,
      letterSpacing: -0.5,
      lineHeight: 34,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridItem: {
      width: '47%',
      backgroundColor: C.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      padding: 16,
      gap: 6,
    },
    gridTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    gridLabel: { fontSize: 14, fontWeight: '700', color: C.text },
    gridDesc: { fontSize: 12, color: C.textMuted, lineHeight: 17 },
    activityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    activitySeeAll: { fontSize: 13, fontWeight: '600', color: C.teal },
    activityList: { gap: 8 },
  });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: feed, isPending: feedLoading, refetch: refetchFeed } = useActivityFeed();
  const {
    sessions,
    isPending: sessionsLoading,
    refetch: refetchSessions,
  } = useUpcomingSessions();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const showQuickAccess = useFlag('enable-quick-access');
  const s = React.useMemo(() => makeStyles(colors), [colors]);
  const activityS = React.useMemo(
    () => ({ ...makeActivityItemStyles(colors), itemOuter: {} }),
    [colors],
  );

  const profileData = profile as {
    first_name?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    avatar_seed?: string | null;
    ui_theme_key?: string | null;
  } | null;
  const firstName =
    profileData?.first_name?.trim() ||
    profileData?.display_name?.trim()?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'there';
  const initial = firstName[0]?.toUpperCase() ?? 'U';
  const avatarUrl = profileData?.avatar_url ?? null;
  const { bg: avatarBg, fg: avatarFg } = resolveAvatarColor(
    profileData?.ui_theme_key,
    profileData?.avatar_seed ?? user?.id ?? user?.email,
  );

  const recentItems = React.useMemo(
    () =>
      getRecentItems(
        feed?.sections.map((sec) => sec.items),
        5,
      ),
    [feed],
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const onToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const onMarkRead = useCallback((_id: string) => {}, []);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([refetchFeed(), refetchSessions()]).finally(() => setRefreshing(false));
  }, [refetchFeed, refetchSessions]);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.teal}
          />
        }
      >
        {/* Top bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <TouchableOpacity
            style={[
              s.avatar,
              {
                backgroundColor: avatarUrl ? 'transparent' : avatarBg,
                overflow: 'hidden',
              },
            ]}
            onPress={() => router.push('/(app)/(tabs)/account')}
            activeOpacity={0.8}
            accessibilityLabel="Open account"
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: 44, height: 44 }} />
            ) : (
              <Text style={[s.avatarTxt, { color: avatarFg }]}>{initial}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={s.bellBtn}
            onPress={() => router.push('/(app)/(tabs)/inbox')}
            activeOpacity={0.8}
            accessibilityLabel="Open inbox"
          >
            <Bell size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Greeting */}
        <View style={{ gap: 6 }}>
          <Text style={s.greetingLine}>
            {getGreeting()}, {firstName} 👋
          </Text>
          <Text style={s.headline}>Welcome back</Text>
        </View>

        {/* Quick nav — shown only when the feature flag is enabled */}
        {showQuickAccess && (
          <View style={{ gap: 10 }}>
            <Text style={s.sectionLabel}>Quick access</Text>
            <View style={s.grid}>
              {quickNav.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={s.gridItem}
                  onPress={() => router.push(item.route as never)}
                  activeOpacity={0.75}
                  accessibilityLabel={item.label}
                >
                  <View style={s.gridTitleRow}>
                    <item.Icon size={20} color={colors.text} />
                    <Text style={s.gridLabel}>{item.label}</Text>
                  </View>
                  <Text style={s.gridDesc}>{item.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Upcoming sessions */}
        {(sessionsLoading || sessions.length > 0) && (
          <View style={{ gap: 10 }}>
            <View style={s.activityHeader}>
              <Text style={s.sectionLabel}>Upcoming sessions</Text>
            </View>
            {sessionsLoading || refreshing ? (
              <View style={{ gap: 6 }}>
                {[0, 1].map((i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    }}
                  >
                    <PulseBox width={44} height={60} radius={10} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <PulseBox width={i === 0 ? 140 : 120} height={13} radius={4} />
                      <PulseBox width={80} height={11} radius={4} />
                    </View>
                    <PulseBox width={50} height={26} radius={20} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ gap: 6 }}>
                {sessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Recent activity */}
        {(feedLoading || refreshing || recentItems.length > 0) && (
          <View style={{ gap: 10 }}>
            <View style={s.activityHeader}>
              <Text style={s.sectionLabel}>Recent activity</Text>
              <TouchableOpacity
                onPress={() => router.push('/(app)/(tabs)/inbox')}
                hitSlop={8}
              >
                <Text style={s.activitySeeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={s.activityList}>
              {feedLoading || refreshing ? (
                <ActivityFeedSkeleton count={3} />
              ) : (
                recentItems.map((item) => (
                  <ActivityItem
                    key={item.ids.id}
                    item={item}
                    colors={colors}
                    isDark={isDark}
                    s={activityS}
                    onMarkRead={onMarkRead}
                    expandedIds={expandedIds}
                    onToggle={onToggle}
                  />
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
