import React, { useState, useCallback, useRef } from 'react';
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
  CalendarDays,
  BookOpenCheck,
  Users,
  LayoutGrid,
  LifeBuoy,
  ArrowRightLeft,
  Check,
} from 'lucide-react-native';
import { BottomSheet, Card, IconButton, SiteLogo } from '@iconicedu/ui-native';
import { useAuth } from '@/providers/auth-provider';
import { useAccount } from '@/hooks/use-account';
import { useProfile } from '@/hooks/use-profile';
import { useUpcomingSessions } from '@/hooks/use-upcoming-sessions';
import { useFamilyLinks } from '@/hooks/use-family-links';
import { useLearningSpaces } from '@/hooks/use-learning-spaces';
import { useSupportChannel } from '@/hooks/use-support-channel';
import { useTheme } from '@/providers/theme-provider';
import { useFamilyView } from '@/providers/family-view-provider';
import { PulseBox } from '@/components/skeletons/pulse-box';
import { SessionCard } from '@/components/sessions/session-card';
import { AppSupportFooter } from '@/components/support/app-support-footer';
import { buildHomeMetricSummary, splitHomeSessionsByTimeline } from '@/lib/home-metrics';
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

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'U';
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase();
  }
  return trimmed[0]?.toUpperCase() ?? 'U';
}

const FAMILY_SWITCH_HANDLE_HEIGHT = 28;
const FAMILY_SWITCH_HEADER_HEIGHT = 76;
const FAMILY_SWITCH_CARD_PADDING = 36;
const FAMILY_SWITCH_ROW_HEIGHT = 62;
const FAMILY_SWITCH_ROW_GAP = 12;
const FAMILY_SWITCH_BOTTOM_PADDING = 18;

function makeStyles(C: AppColors) {
  const supportPalette = getSupportPalette(C);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.pageBg },
    scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 22 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    topBarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexShrink: 1,
      minWidth: 0,
    },
    profileTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flexShrink: 1,
      minWidth: 0,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarTxt: { color: '#ffffff', fontWeight: '800', fontSize: 20 },
    profileTextWrap: {
      gap: 2,
      flexShrink: 1,
      minWidth: 0,
    },
    profileName: { fontSize: 16, color: C.text, fontWeight: '700' },
    profileEmail: { fontSize: 13, color: C.textMuted },
    familySwitchSheetContent: {
      paddingBottom: FAMILY_SWITCH_BOTTOM_PADDING,
    },
    familySwitchCard: {
      padding: 18,
      gap: 12,
    },
    familySwitchHeader: {
      gap: 4,
    },
    familySwitchTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: C.text,
    },
    familySwitchSubtitle: {
      fontSize: 14,
      color: C.textMuted,
      lineHeight: 18,
    },
    familySwitchList: {
      gap: 12,
    },
    familySwitchAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    familySwitchAvatarText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '800',
    },
    switchOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.bg,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    switchOptionActive: {
      borderColor: C.teal,
      backgroundColor: C.tealBg,
    },
    switchOptionText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    switchOptionLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: C.text,
    },
    switchOptionSubtext: {
      fontSize: 13,
      color: C.textMuted,
    },
    greetingLine: { fontSize: 16, color: C.textMuted, fontWeight: '500' },
    headlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    headline: {
      fontSize: 30,
      fontWeight: '800',
      color: C.text,
      letterSpacing: 0,
      lineHeight: 36,
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
      fontSize: 13,
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
      fontSize: 13,
      fontWeight: '700',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
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
      fontSize: 15,
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
      fontSize: 34,
      fontWeight: '800',
      color: C.text,
      letterSpacing: 0,
      lineHeight: 38,
    },
    metricLabel: { fontSize: 13, color: C.textMuted, lineHeight: 17 },
    activityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    emptyWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 18,
    },
    emptyStateCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: C.border,
      backgroundColor: C.card,
      paddingHorizontal: 8,
      overflow: 'hidden',
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: C.text,
    },
    emptyDesc: {
      fontSize: 15,
      color: C.textMuted,
      textAlign: 'center',
      paddingHorizontal: 40,
      lineHeight: 20,
    },
  });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const queryClient = useQueryClient();
  const { familySwitchOptions, switchFamilyView, isViewingAsChild } = useFamilyView();
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
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
  const {
    data: supportChannel,
    isPending: supportLoading,
    refetch: refetchSupportChannel,
  } = useSupportChannel(orgId ?? '');
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
    last_name?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    avatar_seed?: string | null;
    timezone?: string | null;
    ui_theme_key?: string | null;
  } | null;
  const fullName =
    [profileData?.first_name?.trim(), profileData?.last_name?.trim()]
      .filter((value): value is string => Boolean(value))
      .join(' ') ||
    profileData?.display_name?.trim() ||
    user?.email?.split('@')[0] ||
    'User';
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
  const secondaryHeaderText = isViewingAsChild
    ? 'Viewing as student'
    : (user?.email ?? '');

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
        timezone: profileData?.timezone ?? null,
      }),
    [
      childProfiles,
      learningSpaces,
      orgSchedules,
      primaryRole,
      profileData?.id,
      profileData?.kind,
      profileData?.timezone,
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
  const [familySwitchOpen, setFamilySwitchOpen] = useState(false);
  const [switchingProfileId, setSwitchingProfileId] = useState<string | null>(null);
  const [thisWeekSectionY, setThisWeekSectionY] = useState(0);
  const sessionBuckets = React.useMemo(
    () =>
      splitHomeSessionsByTimeline({
        sessions,
        timezone: profileData?.timezone ?? null,
      }),
    [profileData?.timezone, sessions],
  );
  const todaySessions = sessionBuckets.today;
  const thisWeekSessions = sessionBuckets.thisWeek;
  const nextWeekSessions = sessionBuckets.nextWeek;
  const homeHeaderLoading =
    refreshing || accountLoading || profileLoading || supportLoading;
  const overviewLoading =
    refreshing ||
    accountLoading ||
    profileLoading ||
    schedulesSummaryLoading ||
    learningSpacesLoading;
  const supportFooterLoading = refreshing || accountLoading || supportLoading;
  const familySwitchRowsHeight =
    familySwitchOptions.length * FAMILY_SWITCH_ROW_HEIGHT +
    Math.max(familySwitchOptions.length - 1, 0) * FAMILY_SWITCH_ROW_GAP;
  const familySwitchSheetHeight = Math.min(
    FAMILY_SWITCH_HANDLE_HEIGHT +
      FAMILY_SWITCH_HEADER_HEIGHT +
      FAMILY_SWITCH_CARD_PADDING +
      familySwitchRowsHeight +
      FAMILY_SWITCH_BOTTOM_PADDING,
    windowHeight * 0.78,
  );
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
  const handleUpcomingSessionsPress = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: Math.max(thisWeekSectionY - 16, 0),
      animated: true,
    });
  }, [thisWeekSectionY]);
  const canShowFamilySwitcher =
    familySwitchOptions.length > 1 &&
    profileData?.kind &&
    ['guardian', 'child'].includes(profileData.kind);
  const handleFamilySwitch = useCallback(
    async (childProfileId: string | null) => {
      setSwitchingProfileId(childProfileId ?? '__parent__');
      setRefreshing(true);
      try {
        await switchFamilyView(childProfileId);
        await Promise.all([
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
              (childProfiles as Record<string, unknown>[]).map(
                (child) => child.id as string,
              ),
            ),
          }),
        ]);
        setFamilySwitchOpen(false);
      } finally {
        setSwitchingProfileId(null);
        setRefreshing(false);
      }
    },
    [
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
      switchFamilyView,
    ],
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        ref={scrollRef}
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
          <View style={s.topBar}>
            <View style={s.topBarLeft}>
              <View style={s.profileTrigger}>
                <PulseBox width={44} height={44} radius={22} />
                <View style={s.profileTextWrap}>
                  <PulseBox width={132} height={16} radius={4} />
                  <PulseBox width={168} height={12} radius={4} />
                </View>
              </View>
              <PulseBox width={32} height={32} radius={999} />
            </View>
            <PulseBox width={42} height={42} radius={12} />
          </View>
        ) : (
          <View style={s.topBar}>
            <View style={s.topBarLeft}>
              <TouchableOpacity
                style={s.profileTrigger}
                onPress={() => router.push('/(app)/(tabs)/account')}
                activeOpacity={0.8}
                accessibilityLabel="Open account"
              >
                <View
                  style={[
                    s.avatar,
                    {
                      backgroundColor: avatarUrl ? 'transparent' : avatarBg,
                      overflow: 'hidden',
                    },
                  ]}
                >
                  {avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={{ width: 44, height: 44 }}
                    />
                  ) : (
                    <Text style={[s.avatarTxt, { color: avatarFg }]}>{initial}</Text>
                  )}
                </View>
                <View style={s.profileTextWrap}>
                  <Text numberOfLines={1} style={s.profileName}>
                    {fullName}
                  </Text>
                  {!!secondaryHeaderText && (
                    <Text numberOfLines={1} style={s.profileEmail}>
                      {secondaryHeaderText}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
              {canShowFamilySwitcher ? (
                <IconButton
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 rounded-full"
                  onPress={() => setFamilySwitchOpen(true)}
                  label="Switch family view"
                  icon={
                    <ArrowRightLeft
                      size={16}
                      color={isViewingAsChild ? colors.teal : colors.textMuted}
                    />
                  }
                />
              ) : null}
            </View>
            <SiteLogo height={32} color={colors.text} />
          </View>
        )}

        {/* Greeting */}
        {homeHeaderLoading ? (
          <View style={{ gap: 8 }}>
            <PulseBox width={160} height={16} radius={4} />
            <View style={s.headlineRow}>
              <PulseBox width={220} height={34} radius={6} />
              <PulseBox width={96} height={32} radius={999} />
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
                        iconKey: supportChannel.icon_key ?? 'life-buoy',
                        themeKey: supportChannel.themeKey ?? '',
                        messageUiThemeKey: supportChannel.messageUiThemeKey ?? 'feed',
                        isLearningSpace: '0',
                        purpose: 'support',
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
              <TouchableOpacity
                style={[s.metricCard, { width: metricCardWidth }]}
                onPress={handleUpcomingSessionsPress}
                activeOpacity={0.85}
                disabled={sessionsLoading || refreshing}
              >
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
              </TouchableOpacity>

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
        {(sessionsLoading || refreshing || todaySessions.length > 0) && (
          <View style={{ gap: 10 }}>
            <View style={s.activityHeader}>
              <Text style={s.sectionLabel}>Today</Text>
            </View>
            {sessionsLoading || refreshing ? (
              <View style={{ gap: 6 }}>
                {[0, 1].map((i) => (
                  <View
                    key={`today-skeleton-${i}`}
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
                {todaySessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    pressTarget="messages"
                    titleVariant="message-list"
                  />
                ))}
              </View>
            )}
          </View>
        )}

        <View
          style={{ gap: 10 }}
          onLayout={(event) => setThisWeekSectionY(event.nativeEvent.layout.y)}
        >
          <View style={s.activityHeader}>
            <Text style={s.sectionLabel}>This week</Text>
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
          ) : thisWeekSessions.length > 0 ? (
            <View style={{ gap: 6 }}>
              {thisWeekSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  pressTarget="messages"
                  titleVariant="message-list"
                />
              ))}
            </View>
          ) : (
            <View style={s.emptyStateCard}>
              <View style={s.emptyWrap}>
                <View style={[s.emptyIcon, { backgroundColor: colors.inputBg }]}>
                  <CalendarDays size={32} color={colors.textMuted} />
                </View>
                <Text style={s.emptyTitle}>No more sessions this week</Text>
                <Text style={s.emptyDesc}>
                  Sessions later this week will appear here.
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={{ gap: 10 }}>
          <View style={s.activityHeader}>
            <Text style={s.sectionLabel}>Next week</Text>
          </View>
          {sessionsLoading || refreshing ? (
            <View style={{ gap: 6 }}>
              {[0, 1].map((i) => (
                <View
                  key={`next-week-skeleton-${i}`}
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
          ) : nextWeekSessions.length > 0 ? (
            <View style={{ gap: 6 }}>
              {nextWeekSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  pressTarget="messages"
                  titleVariant="message-list"
                  showJoinButton={false}
                />
              ))}
            </View>
          ) : (
            <View style={s.emptyStateCard}>
              <View style={s.emptyWrap}>
                <View style={[s.emptyIcon, { backgroundColor: colors.inputBg }]}>
                  <CalendarDays size={32} color={colors.textMuted} />
                </View>
                <Text style={s.emptyTitle}>No sessions next week</Text>
                <Text style={s.emptyDesc}>
                  Sessions scheduled for next week will appear here.
                </Text>
              </View>
            </View>
          )}
        </View>

        <AppSupportFooter isLoading={supportFooterLoading} />
      </ScrollView>
      <BottomSheet
        visible={familySwitchOpen}
        onClose={() => setFamilySwitchOpen(false)}
        partialHeight={familySwitchSheetHeight}
        sheetStyle={{ backgroundColor: colors.pageBg }}
      >
        <View style={s.familySwitchSheetContent}>
          <Card style={s.familySwitchCard}>
            <View style={s.familySwitchHeader}>
              <Text style={s.familySwitchTitle}>View as</Text>
              <Text style={s.familySwitchSubtitle}>
                Switch between your parent view and linked child accounts.
              </Text>
            </View>
            <View style={s.familySwitchList}>
              {familySwitchOptions.map((option) => {
                const optionTitle = option.displayName?.trim() || option.label;
                const optionSubtitle = option.isParentOption ? 'Parent' : 'Child';
                const isSwitching =
                  switchingProfileId ===
                  (option.isParentOption ? '__parent__' : option.profileId);
                const optionSeed = option.avatarSeed ?? option.profileId;
                const { bg: optionAvatarBg, fg: optionAvatarFg } = resolveAvatarColor(
                  option.themeKey ?? null,
                  optionSeed,
                );

                return (
                  <TouchableOpacity
                    key={option.profileId}
                    style={[
                      s.switchOption,
                      option.isActive ? s.switchOptionActive : null,
                    ]}
                    disabled={option.isActive || Boolean(switchingProfileId)}
                    onPress={() =>
                      handleFamilySwitch(option.isParentOption ? null : option.profileId)
                    }
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        s.familySwitchAvatar,
                        {
                          backgroundColor: option.avatarUrl
                            ? 'transparent'
                            : optionAvatarBg,
                        },
                      ]}
                    >
                      {option.avatarUrl ? (
                        <Image
                          source={{ uri: option.avatarUrl }}
                          style={{ width: 36, height: 36 }}
                        />
                      ) : (
                        <Text
                          style={[s.familySwitchAvatarText, { color: optionAvatarFg }]}
                        >
                          {getInitials(optionTitle)}
                        </Text>
                      )}
                    </View>
                    <View style={s.switchOptionText}>
                      <Text numberOfLines={1} style={s.switchOptionLabel}>
                        {optionTitle}
                      </Text>
                      <Text numberOfLines={1} style={s.switchOptionSubtext}>
                        {isSwitching ? 'Switching...' : optionSubtitle}
                      </Text>
                    </View>
                    {option.isActive ? <Check size={18} color={colors.teal} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
