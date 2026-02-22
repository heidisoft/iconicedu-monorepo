import React, { useState, useCallback, useMemo } from 'react';
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
import type { AppColors } from '@/lib/theme';
import type {
  ActivityFeedItemVM,
  ActivityFeedGroupItemVM,
  ActivityFeedLeafItemVM,
  InboxTabKeyVM,
  InboxIconKeyVM,
} from '@iconicedu/shared-types';
import { DEMO_ACTIVITY_FEED } from '@/lib/dummy-activity-feed';

// ---------------------------------------------------------------------------
// Icon + Tone helpers
// ---------------------------------------------------------------------------

const ICON_EMOJI: Record<InboxIconKeyVM, string> = {
  Bell:           '🔔',
  CheckCircle2:   '✅',
  ClipboardCheck: '📋',
  CreditCard:     '💳',
  FileText:       '📄',
  GraduationCap:  '🎓',
  MessageSquare:  '💬',
  Paperclip:      '📎',
  Sparkles:       '✨',
  Video:          '🎥',
};

function toneColors(tone?: string): { bg: string; fg: string } {
  switch (tone) {
    case 'success': return { bg: '#dcfce7', fg: '#16a34a' };
    case 'warning': return { bg: '#fef9c3', fg: '#d97706' };
    case 'danger':  return { bg: '#fee2e2', fg: '#dc2626' };
    case 'info':    return { bg: '#dbeafe', fg: '#2563eb' };
    default:        return { bg: '#f1f5f9', fg: '#64748b' };
  }
}

function getIconKey(item: ActivityFeedItemVM): InboxIconKeyVM {
  if (item.content.leading?.kind === 'icon') return item.content.leading.iconKey;
  if (item.kind === 'group') {
    const t = (item as ActivityFeedGroupItemVM).grouping?.groupType;
    if (t === 'payment')        return 'CreditCard';
    if (t === 'class')          return 'GraduationCap';
    if (t === 'homework')       return 'Paperclip';
    if (t === 'message')        return 'MessageSquare';
    if (t === 'recording')      return 'Video';
    if (t === 'notes')          return 'FileText';
    if (t === 'ai-summary')     return 'Sparkles';
    if (t === 'complete-class') return 'CheckCircle2';
    return 'Bell';
  }
  switch (item.verb) {
    case 'homework.assigned':
    case 'homework.submitted':
    case 'homework.reviewed':   return 'Paperclip';
    case 'summary.posted':      return 'Sparkles';
    case 'notes.posted':
    case 'file.uploaded':       return 'FileText';
    case 'message.posted':
    case 'message.edited':      return 'MessageSquare';
    case 'session.scheduled':
    case 'session.completed':
    case 'class.created':       return 'GraduationCap';
    case 'member.joined':
    case 'member.invited':      return 'CheckCircle2';
    default:                    return 'Bell';
  }
}

function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ---------------------------------------------------------------------------
// Activity item component
// ---------------------------------------------------------------------------

type ActivityItemProps = {
  item: ActivityFeedItemVM;
  colors: AppColors;
  s: ReturnType<typeof makeStyles>;
  onMarkRead: (id: string) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  isSubActivity?: boolean;
};

function ActivityItem({
  item, colors, s, onMarkRead, expandedIds, onToggle, isSubActivity = false,
}: ActivityItemProps) {
  const iconKey = getIconKey(item);
  const tone = item.content.leading?.kind === 'icon' ? item.content.leading.tone : undefined;
  const { bg: iconBg } = toneColors(tone);
  const emoji = ICON_EMOJI[iconKey];
  const time = relativeTime(item.timestamps.occurredAt);
  const isRead = item.state?.isRead ?? false;
  const isExpanded = expandedIds.has(item.ids.id);
  const isGroup = item.kind === 'group';
  const subItems = isGroup ? (item as ActivityFeedGroupItemVM).subActivities?.items ?? [] : [];
  const subCount = isGroup ? ((item as ActivityFeedGroupItemVM).subActivityCount ?? subItems.length) : 0;
  const hasExpandedContent = !isGroup && !!item.content.expandedContent;

  const handlePress = () => {
    if (!isRead) onMarkRead(item.ids.id);
    if (isGroup && subCount > 0) onToggle(item.ids.id);
    else if (hasExpandedContent) onToggle(item.ids.id);
  };

  return (
    <View>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          s.itemRow,
          isSubActivity && s.subItemRow,
          pressed && { backgroundColor: colors.inputBg },
        ]}
      >
        {/* Icon circle (hidden for sub-items to keep hierarchy clean) */}
        {!isSubActivity ? (
          <View style={[s.iconCircle, { backgroundColor: iconBg }]}>
            <Text style={{ fontSize: 15 }}>{emoji}</Text>
          </View>
        ) : (
          <View style={s.subIconDot}>
            <View style={[s.subDotInner, { backgroundColor: colors.border }]} />
          </View>
        )}

        {/* Content */}
        <View style={s.itemContent}>
          {/* Headline */}
          <View style={s.headlineRow}>
            <Text style={[s.headlineText, { color: colors.text }]} numberOfLines={isSubActivity ? 1 : 3}>
              <Text style={{ fontWeight: '700' }}>{item.content.headline.primary}</Text>
              {!!item.content.headline.secondary && (
                <Text style={{ color: colors.textMuted, fontWeight: '400' }}>
                  {' '}{item.content.headline.secondary}
                </Text>
              )}
              {!!item.content.headline.emphasis && (
                <Text style={{ fontWeight: '600' }}>
                  {' '}{item.content.headline.emphasis}
                </Text>
              )}
            </Text>
            {!isRead && <View style={[s.unreadDot, { backgroundColor: colors.teal }]} />}
          </View>

          {/* Summary */}
          {!!item.content.summary && !isSubActivity && (
            <Text style={[s.summaryText, { color: colors.textMuted }]}>
              {item.content.summary}
            </Text>
          )}

          {/* Expanded content */}
          {hasExpandedContent && isExpanded && (
            <Text style={[s.expandedText, { color: colors.textMuted, borderTopColor: colors.border }]}>
              {item.content.expandedContent}
            </Text>
          )}

          {/* Action button */}
          {!!item.content.actionButton && !isSubActivity && (
            <TouchableOpacity style={[s.actionBtn, { borderColor: colors.border }]}>
              <Text style={[s.actionBtnText, { color: colors.text }]}>
                {item.content.actionButton.label}
              </Text>
            </TouchableOpacity>
          )}

          {/* Footer: time + group count + read-more */}
          <View style={s.footerRow}>
            <Text style={[s.timeText, { color: colors.textFaint }]}>{time}</Text>
            {isGroup && subCount > 0 && (
              <View style={s.subCountRow}>
                <View style={[s.subCountBadge, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Text style={[s.subCountText, { color: colors.textMuted }]}>{subCount}</Text>
                </View>
                <Text style={{ fontSize: 10, color: colors.textFaint }}>
                  {isExpanded ? '▲' : '▼'}
                </Text>
              </View>
            )}
            {hasExpandedContent && (
              <Text style={[s.readMoreText, { color: colors.teal }]}>
                {isExpanded ? 'Show less' : 'Read more'}
              </Text>
            )}
          </View>
        </View>
      </Pressable>

      {/* Sub-activities (groups) */}
      {isGroup && isExpanded && subItems.length > 0 && (
        <View style={[s.subItemsContainer, { borderLeftColor: colors.border }]}>
          {subItems.map((sub: ActivityFeedLeafItemVM) => (
            <ActivityItem
              key={sub.ids.id}
              item={sub}
              colors={colors}
              s={s}
              onMarkRead={onMarkRead}
              expandedIds={expandedIds}
              onToggle={onToggle}
              isSubActivity
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe:     { flex: 1, backgroundColor: colors.bg },
    header:   { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
    title:    { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },

    // Tabs
    tabBar:   { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 12 },
    tab:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
    tabActive:{ borderBottomColor: colors.teal },
    tabText:  { fontSize: 13, fontWeight: '600', color: colors.textFaint },
    tabTextActive: { color: colors.teal },
    badge:    { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
    badgeText:{ color: '#ffffff', fontSize: 10, fontWeight: '700' },

    // Section header
    sectionHeader: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.bg },
    sectionLabel:  { fontSize: 11, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.8 },

    // Item row
    itemRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
    subItemRow:  { paddingLeft: 20, paddingVertical: 8, backgroundColor: colors.pageBg },
    iconCircle:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
    subIconDot:  { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4 },
    subDotInner: { width: 6, height: 6, borderRadius: 3 },
    itemContent: { flex: 1, gap: 3 },
    headlineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    headlineText:{ flex: 1, fontSize: 14, lineHeight: 20 },
    unreadDot:   { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0 },
    summaryText: { fontSize: 13, lineHeight: 18 },
    expandedText:{ fontSize: 13, lineHeight: 19, marginTop: 6, paddingTop: 8, borderTopWidth: 1 },
    actionBtn:   { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
    actionBtnText:{ fontSize: 13, fontWeight: '600' },
    footerRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    timeText:    { fontSize: 11 },
    subCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    subCountBadge:{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, borderWidth: 1 },
    subCountText: { fontSize: 10, fontWeight: '600' },
    readMoreText: { fontSize: 11, fontWeight: '600' },

    // Sub-items
    subItemsContainer: { borderLeftWidth: 2, marginLeft: 34 },

    // Separator
    separator: { height: 1, marginLeft: 64 },

    // Empty state
    emptyWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 60 },
    emptyIcon:    { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
    emptyTitle:   { fontSize: 18, fontWeight: '700' },
    emptyDesc:    { fontSize: 14, textAlign: 'center', paddingHorizontal: 40, lineHeight: 21 },
  });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

type FeedSection = { label: string; data: ActivityFeedItemVM[] };

export default function InboxScreen() {
  const { colors } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);

  const [activeTab, setActiveTab] = useState<InboxTabKeyVM>(DEMO_ACTIVITY_FEED.activeTab);
  const [sections, setSections] = useState(DEMO_ACTIVITY_FEED.sections);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setSections(DEMO_ACTIVITY_FEED.sections);
      setExpandedIds(new Set());
      setRefreshing(false);
    }, 1200);
  }, []);

  const onToggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onMarkRead = useCallback((id: string) => {
    setSections(prev =>
      prev.map(section => ({
        ...section,
        items: section.items.map(item => {
          if (item.ids.id === id) return { ...item, state: { ...item.state, isRead: true } };
          if (item.kind === 'group' && (item as ActivityFeedGroupItemVM).subActivities?.items) {
            return {
              ...item,
              subActivities: {
                ...(item as ActivityFeedGroupItemVM).subActivities,
                items: (item as ActivityFeedGroupItemVM).subActivities!.items.map(
                  (sub: ActivityFeedLeafItemVM) =>
                    sub.ids.id === id ? { ...sub, state: { ...sub.state, isRead: true } } : sub,
                ),
              },
            };
          }
          return item;
        }),
      })),
    );
  }, []);

  // Unread counts per tab (for badges)
  const tabCounts = useMemo(() => {
    return DEMO_ACTIVITY_FEED.tabs.reduce((acc, tab) => {
      acc[tab.key] = sections.reduce((total, section) => {
        return total + section.items.filter(
          item => (tab.key === 'all' || item.tabKey === tab.key) && !item.state?.isRead,
        ).length;
      }, 0);
      return acc;
    }, {} as Record<string, number>);
  }, [sections]);

  // Filter sections by active tab, drop empty ones
  const filteredSections = useMemo<FeedSection[]>(() => {
    return sections
      .map(section => ({
        label: section.label,
        data: section.items.filter(
          item => activeTab === 'all' || item.tabKey === activeTab,
        ),
      }))
      .filter(section => section.data.length > 0);
  }, [sections, activeTab]);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Inbox</Text>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {DEMO_ACTIVITY_FEED.tabs.map(tab => {
          const count = tabCounts[tab.key] ?? 0;
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, isActive && s.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[s.tabText, isActive && s.tabTextActive]}>{tab.label}</Text>
              {count > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{count > 9 ? '9+' : count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {filteredSections.length === 0 ? (
        <View style={s.emptyWrap}>
          <View style={[s.emptyIcon, { backgroundColor: colors.inputBg }]}>
            <Text style={{ fontSize: 36 }}>🔔</Text>
          </View>
          <Text style={[s.emptyTitle, { color: colors.text }]}>All caught up</Text>
          <Text style={[s.emptyDesc, { color: colors.textMuted }]}>
            Notifications and activity will appear here.
          </Text>
        </View>
      ) : (
        <SectionList<ActivityFeedItemVM, FeedSection>
          sections={filteredSections}
          keyExtractor={item => item.ids.id}
          stickySectionHeaders={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}
          renderSectionHeader={({ section }) => (
            <View style={s.sectionHeader}>
              <Text style={s.sectionLabel}>{section.label}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ActivityItem
              item={item}
              colors={colors}
              s={s}
              onMarkRead={onMarkRead}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          )}
          ItemSeparatorComponent={() => (
            <View style={[s.separator, { backgroundColor: colors.border }]} />
          )}
        />
      )}
    </SafeAreaView>
  );
}
