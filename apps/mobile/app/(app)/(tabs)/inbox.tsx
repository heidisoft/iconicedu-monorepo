import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Bell } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';
import { useActivityFeed, useMarkActivityFeedRead } from '@/hooks/use-activity-feed';
import { ActivityFeedSkeleton } from '@/components/skeletons';
import {
  ActivityItem,
  makeActivityItemStyles,
} from '@/components/activity/activity-item';
import type { AppColors } from '@/lib/theme';
import type { ActivityFeedItemVM, InboxTabKeyVM } from '@iconicedu/shared-types';

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

    // Spacer between cards
    separator: { height: 8 },

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

// Auto-read: item must be 60% visible for 1500ms
const VIEWABILITY_CONFIG = { minimumViewTime: 1500, itemVisiblePercentThreshold: 60 };

export default function InboxScreen() {
  const { colors, isDark } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);
  const activityS = React.useMemo(() => makeActivityItemStyles(colors), [colors]);

  const { data: feed, isPending: feedLoading, refetch: refetchFeed } = useActivityFeed();
  const { mutate: markRead } = useMarkActivityFeedRead();

  const [activeTab, setActiveTab] = useState<InboxTabKeyVM>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setExpandedIds(new Set());
    refetchFeed().finally(() => setRefreshing(false));
  }, [refetchFeed]);

  const onToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Press-to-read: immediately mark via mutation (optimistic cache update)
  const onMarkRead = useCallback((id: string) => markRead([id]), [markRead]);

  // Auto-read via SectionList viewability — stable ref pattern to avoid re-renders
  const markReadRef = useRef(markRead);
  markReadRef.current = markRead;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: ActivityFeedItemVM }> }) => {
      const unreadIds = viewableItems
        .filter(({ item }) => item?.ids?.id && !item.state?.isRead)
        .map(({ item }) => item.ids.id);
      if (unreadIds.length) markReadRef.current(unreadIds);
    },
  ).current;

  const feedSections = useMemo(() => feed?.sections ?? [], [feed?.sections]);
  const feedTabs =
    feed?.tabs ??
    FALLBACK_TABS.map((t) => ({ key: t.key, label: t.label, badgeCount: 0 }));

  // Unread counts per tab
  const tabCounts = useMemo(() => {
    return feedTabs.reduce(
      (acc, tab) => {
        acc[tab.key] = feedSections.reduce((total, section) => {
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
  }, [feedSections, feedTabs]);

  // Filter sections by active tab, drop empty
  const filteredSections = useMemo<FeedSection[]>(() => {
    return feedSections
      .map((section) => ({
        label: section.label,
        data: section.items.filter(
          (item) => activeTab === 'all' || item.tabKey === activeTab,
        ),
      }))
      .filter((section) => section.data.length > 0);
  }, [feedSections, activeTab]);

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
          keyExtractor={(item, index) => item?.ids?.id ?? String(index)}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
          viewabilityConfig={VIEWABILITY_CONFIG}
          onViewableItemsChanged={onViewableItemsChanged}
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
              s={activityS}
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
