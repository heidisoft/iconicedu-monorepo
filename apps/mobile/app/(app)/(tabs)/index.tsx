import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Bell,
  CheckCircle,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  MessageCircle,
  MessageSquare,
  Paperclip,
  Sparkles,
  User,
  Video,
} from 'lucide-react-native';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/hooks/use-profile';
import { useActivityFeed } from '@/hooks/use-activity-feed';
import { useUpcomingSessions } from '@/hooks/use-upcoming-sessions';
import { useTheme } from '@/providers/theme-provider';
import { useFlag } from '@/providers/feature-flags-provider';
import { ActivityFeedSkeleton } from '@/components/skeletons';
import { PulseBox } from '@/components/skeletons/pulse-box';
import { SessionCard } from '@/components/sessions/session-card';
import type { AppColors } from '@/lib/theme';
import type {
  ActivityFeedItemVM,
  ActivityFeedGroupItemVM,
  ActivityFeedLeafItemVM,
  InboxIconKeyVM,
} from '@iconicedu/shared-types';

// ---------------------------------------------------------------------------
// Activity helpers (same as inbox)
// ---------------------------------------------------------------------------

const ICON_MAP: Record<
  InboxIconKeyVM,
  React.ComponentType<{ size: number; color: string }>
> = {
  Bell,
  CheckCircle2: CheckCircle,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  MessageSquare,
  Paperclip,
  Sparkles,
  Video,
};

const TAB_LABELS: Record<string, string> = {
  all: 'All',
  classes: 'Classes',
  payment: 'Payment',
  system: 'System',
};

function toneColors(tone?: string): { bg: string; fg: string } {
  switch (tone) {
    case 'success':
      return { bg: '#dcfce7', fg: '#16a34a' };
    case 'warning':
      return { bg: '#fef9c3', fg: '#ca8a04' };
    case 'danger':
      return { bg: '#fee2e2', fg: '#dc2626' };
    case 'info':
      return { bg: '#dbeafe', fg: '#2563eb' };
    default:
      return { bg: '#f1f5f9', fg: '#64748b' };
  }
}

function toneColorsDark(tone?: string): { bg: string; fg: string } {
  switch (tone) {
    case 'success':
      return { bg: '#14532d', fg: '#4ade80' };
    case 'warning':
      return { bg: '#713f12', fg: '#fbbf24' };
    case 'danger':
      return { bg: '#7f1d1d', fg: '#f87171' };
    case 'info':
      return { bg: '#1e3a5f', fg: '#60a5fa' };
    default:
      return { bg: '#1e293b', fg: '#94a3b8' };
  }
}

function getIconKey(item: ActivityFeedItemVM): InboxIconKeyVM {
  if (item.content.leading?.kind === 'icon') return item.content.leading.iconKey;
  if (item.kind === 'group') {
    const t = (item as ActivityFeedGroupItemVM).grouping?.groupType;
    if (t === 'payment') return 'CreditCard';
    if (t === 'class') return 'GraduationCap';
    if (t === 'homework') return 'Paperclip';
    if (t === 'message') return 'MessageSquare';
    if (t === 'recording') return 'Video';
    if (t === 'notes') return 'FileText';
    if (t === 'ai-summary') return 'Sparkles';
    if (t === 'complete-class') return 'CheckCircle2';
    return 'Bell';
  }
  switch (item.verb) {
    case 'homework.assigned':
    case 'homework.submitted':
    case 'homework.reviewed':
      return 'Paperclip';
    case 'summary.posted':
      return 'Sparkles';
    case 'notes.posted':
    case 'file.uploaded':
      return 'FileText';
    case 'message.posted':
    case 'message.edited':
      return 'MessageSquare';
    case 'session.scheduled':
    case 'session.completed':
    case 'class.created':
      return 'GraduationCap';
    case 'member.joined':
    case 'member.invited':
      return 'CheckCircle2';
    default:
      return 'Bell';
  }
}

function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

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

function getRecentClassItems(
  sections: ActivityFeedItemVM[][] | undefined,
  n: number,
): ActivityFeedItemVM[] {
  if (!sections) return [];
  return sections
    .flat()
    .filter((item) => item.tabKey === 'classes')
    .slice(0, n);
}

// ---------------------------------------------------------------------------
// ActivityItem — exact copy from inbox screen
// ---------------------------------------------------------------------------

type ActivityItemProps = {
  item: ActivityFeedItemVM;
  colors: AppColors;
  isDark: boolean;
  s: ReturnType<typeof makeStyles>;
  onMarkRead: (id: string) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  isSubActivity?: boolean;
};

function ActivityItem({
  item,
  colors,
  isDark,
  s,
  onMarkRead,
  expandedIds,
  onToggle,
  isSubActivity = false,
}: ActivityItemProps) {
  const iconKey = getIconKey(item);
  const tone =
    item.content.leading?.kind === 'icon' ? item.content.leading.tone : undefined;
  const { bg: iconBg, fg: iconFg } = isDark ? toneColorsDark(tone) : toneColors(tone);
  const IconComponent = ICON_MAP[iconKey];
  const time = relativeTime(item.timestamps.occurredAt);
  const isRead = item.state?.isRead ?? false;
  const isExpanded = expandedIds.has(item.ids.id);
  const isGroup = item.kind === 'group';
  const subItems = isGroup
    ? ((item as ActivityFeedGroupItemVM).subActivities?.items ?? [])
    : [];
  const subCount = isGroup
    ? ((item as ActivityFeedGroupItemVM).subActivityCount ?? subItems.length)
    : 0;
  const hasExpandedContent = !isGroup && !!item.content.expandedContent;
  const hasActionBtn = !!item.content.actionButton && !isSubActivity;
  const { primary, secondary, emphasis } = item.content.headline;
  const tabLabel = TAB_LABELS[item.tabKey] ?? item.tabKey;

  const handlePress = () => {
    if (!isRead) onMarkRead(item.ids.id);
    if (isGroup && subCount > 0) onToggle(item.ids.id);
    else if (hasExpandedContent) onToggle(item.ids.id);
  };

  if (isSubActivity) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [s.subRow, pressed && { opacity: 0.7 }]}
      >
        <View style={[s.subBullet, { backgroundColor: colors.border }]} />
        <Text style={[s.subText, { color: colors.textMuted }]} numberOfLines={1}>
          <Text style={{ fontWeight: '600', color: colors.text }}>{primary}</Text>
          {!!secondary && `  ${secondary}`}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={s.itemOuter}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          s.itemWrap,
          pressed && { backgroundColor: colors.inputBg },
        ]}
      >
        <View style={s.itemRow}>
          <View style={s.avatarWrap}>
            <View style={[s.itemAvatar, { backgroundColor: iconBg }]}>
              <IconComponent size={22} color={iconFg} />
            </View>
          </View>

          <View style={s.content}>
            <View style={s.headlineRow}>
              <Text style={[s.headlineText, { color: colors.text }]}>
                <Text style={s.bold}>{primary}</Text>
                {!!secondary && ` ${secondary}`}
              </Text>
              {!!emphasis && (
                <View style={[s.badge, { backgroundColor: iconBg }]}>
                  <IconComponent size={14} color={iconFg} />
                  <Text style={[s.badgeText, { color: iconFg }]}>{emphasis}</Text>
                </View>
              )}
            </View>

            <View style={s.metaRow}>
              <Text style={[s.metaText, { color: colors.textMuted }]}>{time}</Text>
              {!!tabLabel && tabLabel !== 'All' && (
                <>
                  <View style={[s.metaDot, { backgroundColor: colors.textFaint }]} />
                  <Text style={[s.metaText, { color: colors.textMuted }]}>
                    {tabLabel}
                  </Text>
                </>
              )}
              {isGroup && subCount > 0 && (
                <>
                  <View style={[s.metaDot, { backgroundColor: colors.textFaint }]} />
                  <Text style={[s.metaText, { color: colors.textMuted }]}>
                    {subCount} items {isExpanded ? '▲' : '▼'}
                  </Text>
                </>
              )}
            </View>
          </View>

          {!isRead && <View style={[s.unreadDot, { backgroundColor: colors.teal }]} />}
        </View>

        {!!item.content.summary && (
          <View
            style={[
              s.previewCard,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <Text style={[s.previewText, { color: colors.text }]} numberOfLines={4}>
              {item.content.summary}
            </Text>
          </View>
        )}

        {hasExpandedContent && isExpanded && (
          <View
            style={[
              s.previewCard,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <Text style={[s.previewText, { color: colors.text }]}>
              {item.content.expandedContent}
            </Text>
          </View>
        )}

        {hasExpandedContent && (
          <TouchableOpacity
            onPress={() => onToggle(item.ids.id)}
            hitSlop={8}
            style={s.readMoreBtn}
          >
            <Text style={[s.readMoreText, { color: colors.teal }]}>
              {isExpanded ? 'Show less' : 'Read more'}
            </Text>
          </TouchableOpacity>
        )}

        {hasActionBtn && (
          <TouchableOpacity style={[s.actionBtn, { borderColor: colors.border }]}>
            <Text style={[s.actionBtnText, { color: colors.text }]}>
              {item.content.actionButton!.label}
            </Text>
          </TouchableOpacity>
        )}

        {isGroup && isExpanded && subItems.length > 0 && (
          <View style={[s.subItemsWrap, { borderLeftColor: colors.border }]}>
            {subItems.map((sub: ActivityFeedLeafItemVM) => (
              <ActivityItem
                key={sub.ids.id}
                item={sub}
                colors={colors}
                isDark={isDark}
                s={s}
                onMarkRead={onMarkRead}
                expandedIds={expandedIds}
                onToggle={onToggle}
                isSubActivity
              />
            ))}
          </View>
        )}
      </Pressable>
    </View>
  );
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
    // Activity section header
    activityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    activitySeeAll: { fontSize: 13, fontWeight: '600', color: C.teal },
    activityList: { gap: 8 },
    // Item styles (exact copy from inbox)
    itemOuter: {},
    itemWrap: {
      borderRadius: 14,
      backgroundColor: C.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 14,
      overflow: 'hidden',
      minHeight: 80,
    },
    itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    avatarWrap: { width: 52, height: 52, flexShrink: 0 },
    itemAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unreadDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0, marginTop: 8 },
    content: { flex: 1, paddingTop: 2 },
    headlineRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 5,
      marginBottom: 5,
    },
    headlineText: { fontSize: 15, lineHeight: 22 },
    bold: { fontWeight: '700' },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    badgeText: { fontSize: 13, fontWeight: '600' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { fontSize: 13 },
    metaDot: { width: 3, height: 3, borderRadius: 2 },
    previewCard: {
      marginTop: 10,
      marginLeft: 64,
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
    },
    previewText: { fontSize: 14, lineHeight: 22 },
    readMoreBtn: { marginTop: 8, marginLeft: 64 },
    readMoreText: { fontSize: 13, fontWeight: '600' },
    actionBtn: {
      alignSelf: 'flex-start',
      marginTop: 10,
      marginLeft: 64,
      borderRadius: 20,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    actionBtnText: { fontSize: 13, fontWeight: '600' },
    subItemsWrap: { marginTop: 10, marginLeft: 64, borderLeftWidth: 2, paddingLeft: 12 },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
    subBullet: { width: 5, height: 5, borderRadius: 3, flexShrink: 0 },
    subText: { flex: 1, fontSize: 13, lineHeight: 18 },
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
      getRecentClassItems(
        feed?.sections.map((s) => s.items),
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
              // Skeleton: 2 placeholder session cards matching SessionCard layout
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

        {/* Class activity */}
        {(feedLoading || refreshing || recentItems.length > 0) && (
          <View style={{ gap: 10 }}>
            <View style={s.activityHeader}>
              <Text style={s.sectionLabel}>Class activity</Text>
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
                    s={s}
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
