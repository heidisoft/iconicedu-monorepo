import React, { useState, useCallback, useMemo } from 'react';
import {
  Bell,
  CheckCircle,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  MessageSquare,
  Paperclip,
  Sparkles,
  Video,
} from 'lucide-react-native';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';
import { useActivityFeed } from '@/hooks/use-activity-feed';
import { ActivityFeedSkeleton } from '@/components/skeletons';
import type { AppColors } from '@/lib/theme';
import type {
  ActivityFeedItemVM,
  ActivityFeedGroupItemVM,
  ActivityFeedLeafItemVM,
  InboxTabKeyVM,
  InboxIconKeyVM,
} from '@iconicedu/shared-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ICON_MAP: Record<
  InboxIconKeyVM,
  React.ComponentType<{ size: number; color: string }>
> = {
  Bell: Bell,
  CheckCircle2: CheckCircle,
  ClipboardCheck: ClipboardCheck,
  CreditCard: CreditCard,
  FileText: FileText,
  GraduationCap: GraduationCap,
  MessageSquare: MessageSquare,
  Paperclip: Paperclip,
  Sparkles: Sparkles,
  Video: Video,
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
// Activity item
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

  // Sub-activity: compact single-line row
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
        {/* Row: avatar + content + unread dot */}
        <View style={s.itemRow}>
          {/* Avatar */}
          <View style={s.avatarWrap}>
            <View style={[s.avatar, { backgroundColor: iconBg }]}>
              <IconComponent size={22} color={iconFg} />
            </View>
          </View>

          {/* Content */}
          <View style={s.content}>
            {/* Headline: primary + secondary + emphasis badge */}
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

            {/* Meta: time ago • Category */}
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

          {/* Unread dot — right side */}
          {!isRead && <View style={[s.unreadDot, { backgroundColor: colors.teal }]} />}
        </View>

        {/* Preview card — summary text */}
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

        {/* Expanded detail card */}
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

        {/* Read more link */}
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

        {/* Action button */}
        {hasActionBtn && (
          <TouchableOpacity style={[s.actionBtn, { borderColor: colors.border }]}>
            <Text style={[s.actionBtnText, { color: colors.text }]}>
              {item.content.actionButton!.label}
            </Text>
          </TouchableOpacity>
        )}

        {/* Group sub-items */}
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
// Styles
// ---------------------------------------------------------------------------

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },

    // Header
    header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
    title: { fontSize: 30, fontWeight: '800', color: C.text, letterSpacing: -0.5 },

    // Full-width underline tab bar (matches web shadcn Tabs)
    tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      marginBottom: -1,
    },
    tabActive: { borderBottomColor: C.teal },
    tabInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    tabText: { fontSize: 13, fontWeight: '600', color: C.textFaint },
    tabTextActive: { color: C.teal },
    tabBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#ef4444',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    tabBadgeText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },

    // Section header
    sectionHeader: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },

    // Outer wrapper owns the horizontal margin so Pressable doesn't fight SectionList
    itemOuter: { marginHorizontal: 16 },

    // Item card
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
    // Spacer between cards
    separator: { height: 8 },
    itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },

    // Avatar
    avatarWrap: { width: 52, height: 52, flexShrink: 0 },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarEmoji: { fontSize: 22 },

    // Unread dot — right side of itemRow, aligned with headline
    unreadDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0, marginTop: 8 },

    // Content
    content: { flex: 1, paddingTop: 2 },
    headlineRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 5,
      marginBottom: 5,
    },
    headlineText: { fontSize: 15, lineHeight: 22, color: '#000' },
    bold: { fontWeight: '700' },

    // Emphasis badge (icon + text inline pill)
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    badgeEmoji: { fontSize: 12 },
    badgeText: { fontSize: 13, fontWeight: '600' },

    // Meta row: "2 hours ago  •  Classes"
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { fontSize: 13 },
    metaDot: { width: 3, height: 3, borderRadius: 2 },

    // Preview card (summary / expanded content)
    previewCard: {
      marginTop: 10,
      marginLeft: 64,
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
    },
    previewText: { fontSize: 14, lineHeight: 22 },

    // Read more
    readMoreBtn: { marginTop: 8, marginLeft: 64 },
    readMoreText: { fontSize: 13, fontWeight: '600' },

    // Action button
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

    // Sub-items
    subItemsWrap: { marginTop: 10, marginLeft: 64, borderLeftWidth: 2, paddingLeft: 12 },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
    subBullet: { width: 5, height: 5, borderRadius: 3, flexShrink: 0 },
    subText: { flex: 1, fontSize: 13, lineHeight: 18 },

    // Empty state
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingBottom: 60,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: { fontSize: 18, fontWeight: '700' },
    emptyDesc: {
      fontSize: 14,
      textAlign: 'center',
      paddingHorizontal: 40,
      lineHeight: 21,
    },
  });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

type FeedSection = { label: string; data: ActivityFeedItemVM[] };

const FALLBACK_TABS: Array<{ key: InboxTabKeyVM; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'classes', label: 'Classes' },
  { key: 'payment', label: 'Payment' },
  { key: 'system', label: 'System' },
];

export default function InboxScreen() {
  const { colors, isDark } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);

  const { data: feed, isPending: feedLoading, refetch: refetchFeed } = useActivityFeed();

  const [activeTab, setActiveTab] = useState<InboxTabKeyVM>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // Local read-state overlay (optimistic until next refetch)
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(new Set());

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refetchFeed().finally(() => {
      setLocalReadIds(new Set());
      setExpandedIds(new Set());
      setRefreshing(false);
    });
  }, [refetchFeed]);

  const onToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onMarkRead = useCallback((id: string) => {
    setLocalReadIds((prev) => new Set(prev).add(id));
  }, []);

  const feedSections = useMemo(() => feed?.sections ?? [], [feed?.sections]);
  const feedTabs =
    feed?.tabs ??
    FALLBACK_TABS.map((t) => ({ key: t.key, label: t.label, badgeCount: 0 }));

  // Apply local read overlay
  const sectionsWithLocalRead = useMemo(() => {
    if (!localReadIds.size) return feedSections;
    return feedSections.map((section) => ({
      ...section,
      items: section.items.map((item) => {
        if (localReadIds.has(item.ids.id))
          return { ...item, state: { ...item.state, isRead: true } };
        if (
          item.kind === 'group' &&
          (item as ActivityFeedGroupItemVM).subActivities?.items
        ) {
          return {
            ...item,
            subActivities: {
              ...(item as ActivityFeedGroupItemVM).subActivities,
              items: (item as ActivityFeedGroupItemVM).subActivities!.items.map(
                (sub: ActivityFeedLeafItemVM) =>
                  localReadIds.has(sub.ids.id)
                    ? { ...sub, state: { ...sub.state, isRead: true } }
                    : sub,
              ),
            },
          };
        }
        return item;
      }),
    }));
  }, [feedSections, localReadIds]);

  // Unread counts per tab (driven by real data + local overlay)
  const tabCounts = useMemo(() => {
    return feedTabs.reduce(
      (acc, tab) => {
        acc[tab.key] = sectionsWithLocalRead.reduce((total, section) => {
          return (
            total +
            section.items.filter(
              (item) =>
                (tab.key === 'all' || item.tabKey === tab.key) && !item.state?.isRead,
            ).length
          );
        }, 0);
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [sectionsWithLocalRead, feedTabs]);

  // Filter sections by active tab, drop empty
  const filteredSections = useMemo<FeedSection[]>(() => {
    return sectionsWithLocalRead
      .map((section) => ({
        label: section.label,
        data: section.items.filter(
          (item) => activeTab === 'all' || item.tabKey === activeTab,
        ),
      }))
      .filter((section) => section.data.length > 0);
  }, [sectionsWithLocalRead, activeTab]);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Inbox</Text>
      </View>

      {/* Full-width underline tab bar */}
      <View style={s.tabBar}>
        {feedTabs.map((tab) => {
          const count = tabCounts[tab.key] ?? 0;
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, isActive && s.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <View style={s.tabInner}>
                <Text style={[s.tabText, isActive && s.tabTextActive]}>{tab.label}</Text>
                {count > 0 && (
                  <View style={s.tabBadge}>
                    <Text style={s.tabBadgeText}>{count > 9 ? '9+' : count}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {feedLoading || refreshing ? (
        <ActivityFeedSkeleton count={4} />
      ) : filteredSections.length === 0 ? (
        <View style={s.emptyWrap}>
          <View style={[s.emptyIcon, { backgroundColor: colors.inputBg }]}>
            <Bell size={32} color={colors.teal} />
          </View>
          <Text style={[s.emptyTitle, { color: colors.text }]}>All caught up</Text>
          <Text style={[s.emptyDesc, { color: colors.textMuted }]}>
            Notifications and activity will appear here.
          </Text>
        </View>
      ) : (
        <SectionList<ActivityFeedItemVM, FeedSection>
          sections={filteredSections}
          keyExtractor={(item) => item.ids.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.teal}
            />
          }
          renderSectionHeader={({ section }) => (
            <View style={s.sectionHeader}>
              <Text style={s.sectionLabel}>{section.label}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ActivityItem
              item={item}
              colors={colors}
              isDark={isDark}
              s={s}
              onMarkRead={onMarkRead}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          )}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </SafeAreaView>
  );
}
