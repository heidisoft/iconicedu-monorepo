import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  CalendarCheck,
  BookOpenCheck,
  Users,
  LayoutGrid,
  LifeBuoy,
} from 'lucide-react-native';
import { SiteLogo } from '@iconicedu/ui-native';
import { useAuth } from '@/providers/auth-provider';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useUpcomingSessions } from '@/hooks/use-upcoming-sessions';
import { useFamilyLinks } from '@/hooks/use-family-links';
import { useLearningSpaces } from '@/hooks/use-learning-spaces';
import { useSupportChannel } from '@/hooks/use-support-channel';
import { useTheme } from '@/providers/theme-provider';
import { PulseBox } from '@/components/skeletons/pulse-box';
import { SessionCard } from '@/components/sessions/session-card';
import { AppSupportFooter } from '@/components/support/app-support-footer';
import { buildHomeMetricSummary } from '@/lib/home-metrics';
import { fetchOrgSessions, queryKeys } from '@/lib/api/queries';
import type { AppColors } from '@/lib/theme';

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getSupportPalette(C: AppColors) {
  const isDark = C.bg === C.pageBg && C.text === '#FFFFFF';
  return {
    bg: isDark ? '#f59e0b22' : '#fff7ed',
    border: isDark ? '#f59e0b55' : '#fdba74',
    text: isDark ? '#fbbf24' : '#c2410c',
  };
}

function makeStyles(C: AppColors) {
  const supportPalette = getSupportPalette(C);

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
    greetingLine: { fontSize: 15, color: C.textMuted, fontWeight: '500' },
    headlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    headline: {
      fontSize: 28,
      fontWeight: '800',
      color: C.text,
      letterSpacing: -0.5,
      lineHeight: 34,
      flex: 1,
    },
    supportBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 10,
      height: 32,
      borderRadius: 999,
      backgroundColor: supportPalette.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: supportPalette.border,
      position: 'relative',
    },
    supportBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: supportPalette.text,
    },
    supportIconWrap: {
      width: 14,
      height: 14,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    metricsRow: { gap: 12, paddingRight: 20 },
    metricCard: {
      minHeight: 148,
      backgroundColor: C.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      padding: 14,
      justifyContent: 'space-between',
    },
    metricHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },
    metricTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: C.text,
      lineHeight: 18,
    },
    metricIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: C.tealBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metricValue: {
      fontSize: 32,
      fontWeight: '800',
      color: C.text,
      letterSpacing: -0.8,
      lineHeight: 36,
    },
    metricLabel: { fontSize: 12, color: C.textMuted, lineHeight: 16 },
    activityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    data: profile,
    isPending: profileLoading,
    refetch: refetchProfile,
  } = useProfile();
  const {
    sessions,
    isPending: sessionsLoading,
    refetch: refetchSessions,
  } = useUpcomingSessions();
  const {
    data: account,
    isPending: accountLoading,
    refetch: refetchAccount,
  } = useAccount();
  const { width: windowWidth } = useWindowDimensions();
  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;
  const primaryRole = (account as Record<string, unknown> | undefined)?.primary_role as
    | string
    | null
    | undefined;
  const { childProfiles } = useFamilyLinks();
  const {
    data: learningSpaces = [],
    isPending: learningSpacesLoading,
    refetch: refetchLearningSpaces,
  } = useLearningSpaces(orgId ?? '');
  const { data: supportChannel, refetch: refetchSupportChannel } = useSupportChannel(
    orgId ?? '',
  );
  const {
    data: orgSchedules = [],
    isPending: schedulesSummaryLoading,
    refetch: refetchOrgSchedules,
  } = useQuery({
    queryKey: queryKeys.orgSessions(orgId ?? ''),
    queryFn: () => fetchOrgSessions(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
  const { colors } = useTheme();
  const router = useRouter();
  const s = React.useMemo(() => makeStyles(colors), [colors]);
  const supportPalette = React.useMemo(() => getSupportPalette(colors), [colors]);

  const profileData = profile as {
    id?: string | null;
    kind?: string | null;
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

  const topMetrics = React.useMemo(
    () =>
      buildHomeMetricSummary({
        schedules: orgSchedules,
        learningSpaces: learningSpaces.map((space) => ({
          id: String((space as Record<string, unknown>).id),
          status: ((space as Record<string, unknown>).status as string | null) ?? null,
          subject: ((space as Record<string, unknown>).subject as string | null) ?? null,
          title: ((space as Record<string, unknown>).title as string | null) ?? null,
        })),
        profileKind: profileData?.kind ?? null,
        primaryRole: primaryRole ?? null,
        profileId: profileData?.id ?? null,
        childProfileIds: (childProfiles as Record<string, unknown>[]).map(
          (child) => child.id as string,
        ),
      }),
    [
      childProfiles,
      learningSpaces,
      orgSchedules,
      primaryRole,
      profileData?.id,
      profileData?.kind,
    ],
  );
  const metricCardWidth = Math.max(160, (windowWidth - 40 - 12) / 2);
  const ThirdMetricIcon =
    topMetrics.thirdMetricTitle === 'Active Subjects'
      ? BookOpenCheck
      : topMetrics.thirdMetricTitle === 'Active Students'
        ? Users
        : LayoutGrid;

  const [refreshing, setRefreshing] = useState(false);
  const homeHeaderLoading = refreshing || accountLoading || profileLoading;
  const overviewLoading =
    refreshing ||
    accountLoading ||
    profileLoading ||
    schedulesSummaryLoading ||
    learningSpacesLoading;
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      refetchAccount(),
      refetchProfile(),
      refetchSessions(),
      refetchLearningSpaces(),
      refetchSupportChannel(),
      refetchOrgSchedules(),
      queryClient.invalidateQueries({
        queryKey: queryKeys.familyLinks(
          orgId ?? '',
          ((account as Record<string, unknown> | undefined)?.id as string) ?? '',
        ),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.childProfiles(
          orgId ?? '',
          (childProfiles as Record<string, unknown>[]).map((child) => child.id as string),
        ),
      }),
    ]).finally(() => setRefreshing(false));
  }, [
    account,
    childProfiles,
    orgId,
    queryClient,
    refetchAccount,
    refetchLearningSpaces,
    refetchOrgSchedules,
    refetchProfile,
    refetchSessions,
    refetchSupportChannel,
  ]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
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
        {homeHeaderLoading ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <PulseBox width={44} height={44} radius={22} />
            <PulseBox width={42} height={42} radius={12} />
          </View>
        ) : (
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
            <SiteLogo height={32} color={colors.text} />
          </View>
        )}

        {/* Greeting */}
        {homeHeaderLoading ? (
          <View style={{ gap: 8 }}>
            <PulseBox width={160} height={16} radius={4} />
            <View style={s.headlineRow}>
              <PulseBox width={220} height={30} radius={6} />
              <PulseBox width={96} height={32} radius={16} />
            </View>
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            <Text style={s.greetingLine}>
              {getGreeting()}, {firstName}
            </Text>
            <View style={s.headlineRow}>
              <Text style={s.headline}>Welcome back</Text>
              {supportChannel?.id ? (
                <TouchableOpacity
                  style={s.supportBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/channel/[channelId]',
                      params: {
                        channelId: supportChannel.id,
                        topic: supportChannel.topic ?? 'Live Support',
                      },
                    })
                  }
                  activeOpacity={0.8}
                  accessibilityLabel="Open live support"
                >
                  <View style={s.supportIconWrap}>
                    <LifeBuoy size={14} color={supportPalette.text} />
                  </View>
                  <Text style={s.supportBtnText}>Support</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}

        <View style={{ gap: 10 }}>
          <Text style={s.sectionLabel}>Overview</Text>
          {overviewLoading ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.metricsRow}
            >
              {[0, 1, 2].map((index) => (
                <View
                  key={index}
                  style={[s.metricCard, { width: metricCardWidth, gap: 18 }]}
                >
                  <View style={s.metricHeader}>
                    <PulseBox width={110} height={16} radius={4} />
                    <PulseBox width={36} height={36} radius={12} />
                  </View>
                  <View style={{ gap: 8 }}>
                    <PulseBox width={index === 1 ? 42 : 34} height={34} radius={6} />
                    <PulseBox width={90} height={12} radius={4} />
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.metricsRow}
            >
              <View style={[s.metricCard, { width: metricCardWidth }]}>
                <View style={s.metricHeader}>
                  <Text style={s.metricTitle}>Upcoming Sessions</Text>
                  <View style={s.metricIconWrap}>
                    <CalendarClock size={18} color={colors.teal} />
                  </View>
                </View>
                <View>
                  <Text style={s.metricValue}>{topMetrics.upcomingSessionsThisWeek}</Text>
                  <Text style={s.metricLabel}>This week</Text>
                </View>
              </View>

              <View style={[s.metricCard, { width: metricCardWidth }]}>
                <View style={s.metricHeader}>
                  <Text style={s.metricTitle}>Completed Classes</Text>
                  <View style={s.metricIconWrap}>
                    <CalendarCheck size={18} color={colors.teal} />
                  </View>
                </View>
                <View>
                  <Text style={s.metricValue}>
                    {topMetrics.completedClassesThisMonth}
                  </Text>
                  <Text style={s.metricLabel}>This month</Text>
                </View>
              </View>

              <View style={[s.metricCard, { width: metricCardWidth }]}>
                <View style={s.metricHeader}>
                  <Text style={s.metricTitle}>{topMetrics.thirdMetricTitle}</Text>
                  <View style={s.metricIconWrap}>
                    <ThirdMetricIcon size={18} color={colors.teal} />
                  </View>
                </View>
                <View>
                  <Text style={s.metricValue}>{topMetrics.thirdMetricValue}</Text>
                  <Text style={s.metricLabel}>{topMetrics.thirdMetricLabel}</Text>
                </View>
              </View>
            </ScrollView>
          )}
        </View>

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

        <AppSupportFooter />
      </ScrollView>
    </SafeAreaView>
  );
}
