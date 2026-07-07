import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';
import { useActivityFeed, useMarkActivityFeedRead } from '@/hooks/use-activity-feed';
import { useProfile } from '@/hooks/use-profile';
import { useAccount } from '@/hooks/use-account';
import { ActivityFeedSkeleton } from '@/components/skeletons';
import { QueryError } from '@/components/errors/query-error';
import { createHeaderSurface } from '@/lib/header-surface';
import {
  ActivityItem,
  makeActivityItemStyles,
} from '@/components/activity/activity-item';
import type { AppColors } from '@/lib/theme';
import type { ActivityFeedItemVM, InboxTabKeyVM } from '@iconicedu/shared-types';
import {
  DEFAULT_NOTIFICATION_ROUTE,
  NOTIFICATION_REGISTRY,
} from '@/lib/notifications/notification-config';
import { usePushNudge } from '@/hooks/use-push-nudge';
import { PushNudgeSheet } from '@/components/notifications/push-nudge-sheet';
import {
  approveSessionChangeRequest,
  fetchSessionChangeRequests,
  queryKeys,
  rejectSessionChangeRequest,
} from '@/lib/api/queries';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },

    // Header
    header: {
      ...createHeaderSurface(C.bg, C.border),
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    title: { fontSize: 30, fontWeight: '800', color: C.text, letterSpacing: 0 },
    markAllBtn: {
      minHeight: 32,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      backgroundColor: C.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markAllBtnDisabled: {
      opacity: 0.45,
    },
    markAllBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: C.teal,
    },

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
    tabText: { fontSize: 14, fontWeight: '600', color: C.textFaint },
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
    tabBadgeText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },

    // Section header
    sectionHeader: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: C.textFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // Spacer between cards
    separator: { height: 8 },

    modalBackdrop: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      backgroundColor: 'rgba(15, 23, 42, 0.42)',
    },
    modalCard: {
      gap: 14,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      padding: 18,
    },
    modalTitle: { fontSize: 19, fontWeight: '800', color: C.text },
    modalDescription: {
      fontSize: 14,
      lineHeight: 20,
      color: C.textMuted,
    },
    reasonInput: {
      minHeight: 92,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.inputBg,
      color: C.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      textAlignVertical: 'top',
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      flexWrap: 'wrap',
    },
    modalButton: {
      minHeight: 42,
      borderRadius: 21,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalButtonSecondary: {
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.inputBg,
    },
    modalButtonPrimary: { backgroundColor: C.teal },
    modalButtonDanger: { backgroundColor: C.red },
    modalButtonText: { fontSize: 15, fontWeight: '800' },

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
    emptyTitle: { fontSize: 20, fontWeight: '700' },
    emptyDesc: {
      fontSize: 15,
      textAlign: 'center',
      paddingHorizontal: 40,
      lineHeight: 20,
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
  const router = useRouter();
  const params = useLocalSearchParams<{ activityId?: string | string[] }>();
  const { colors, isDark } = useTheme();
  const s = React.useMemo(() => makeStyles(colors), [colors]);
  const activityS = React.useMemo(() => makeActivityItemStyles(colors), [colors]);
  const { data: profile, isError: profileError } = useProfile();
  const { data: account } = useAccount();
  const queryClient = useQueryClient();
  const orgId = (account as Record<string, unknown> | undefined)?.org_id as
    | string
    | undefined;

  const {
    data: feed,
    isPending: feedLoading,
    isError: feedError,
    refetch: refetchFeed,
  } = useActivityFeed();
  const { mutate: markRead } = useMarkActivityFeedRead();

  const [activeTab, setActiveTab] = useState<InboxTabKeyVM>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [decisionModal, setDecisionModal] = useState<{
    activity: ActivityFeedItemVM;
    decision: 'approve' | 'reject';
    reason: string;
  } | null>(null);
  const sectionListRef = useRef<SectionList<ActivityFeedItemVM, FeedSection>>(null);
  const lastScrolledTargetRef = useRef<string | null>(null);
  const targetActivityId = Array.isArray(params.activityId)
    ? params.activityId[0]
    : params.activityId;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setExpandedIds(new Set());
    Promise.all([
      refetchFeed(),
      orgId
        ? queryClient.invalidateQueries({
            queryKey: queryKeys.sessionChangeRequests(orgId, ''),
          })
        : Promise.resolve(),
    ]).finally(() => setRefreshing(false));
  }, [orgId, queryClient, refetchFeed]);

  const pendingRequestsQuery = useQuery({
    queryKey: queryKeys.sessionChangeRequests(orgId ?? '', ''),
    queryFn: () => fetchSessionChangeRequests({ orgId: orgId ?? '' }),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  });
  const pendingSessionChangeRequestIds = useMemo(
    () =>
      new Set(
        (pendingRequestsQuery.data ?? [])
          .filter((request) => request.status === 'pending')
          .map((request) => request.id),
      ),
    [pendingRequestsQuery.data],
  );

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
  const getActivityRequestId = useCallback((item: ActivityFeedItemVM) => {
    const metadata =
      item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
        ? (item.metadata as Record<string, unknown>)
        : {};
    return typeof metadata.requestId === 'string' ? metadata.requestId : null;
  }, []);
  const decisionMutation = useMutation({
    mutationFn: async (input: {
      item: ActivityFeedItemVM;
      decision: 'approve' | 'reject';
      reason: string;
    }) => {
      const requestId = getActivityRequestId(input.item);
      if (!requestId) throw new Error('Request not found');
      const note = input.reason.trim();
      if (!note) throw new Error('Reason is required');
      return input.decision === 'approve'
        ? approveSessionChangeRequest({ requestId, note })
        : rejectSessionChangeRequest({ requestId, note });
    },
    onSuccess: async () => {
      setDecisionModal(null);
      await Promise.all([
        refetchFeed(),
        orgId
          ? queryClient.invalidateQueries({
              queryKey: queryKeys.sessionChangeRequests(orgId, ''),
            })
          : Promise.resolve(),
      ]);
    },
    onError: (error) => {
      Alert.alert(
        'Unable to send decision',
        error instanceof Error ? error.message : 'Please try again.',
      );
    },
  });
  const decisionInFlightRequestId = decisionMutation.variables
    ? getActivityRequestId(decisionMutation.variables.item)
    : null;

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
  const unreadIdsForActiveTab = useMemo(
    () =>
      feedSections.flatMap((section) =>
        section.items
          .filter(
            (item) =>
              (activeTab === 'all' || item.tabKey === activeTab) && !item.state?.isRead,
          )
          .map((item) => item.ids.id),
      ),
    [activeTab, feedSections],
  );
  const handleMarkAllRead = useCallback(() => {
    if (unreadIdsForActiveTab.length === 0) return;
    markRead(unreadIdsForActiveTab);
  }, [markRead, unreadIdsForActiveTab]);

  const {
    isVisible: isNudgeVisible,
    nudgeVariant,
    triggerNudge,
    handleEnable: handleNudgeEnable,
    handleOpenSettings: handleNudgeOpenSettings,
    handleDismiss: handleNudgeDismiss,
  } = usePushNudge();

  // Tier 1: user opened the inbox and has unread items — they clearly want to know
  // when things happen, so this is a purposeful moment to ask about push.
  const inboxNudgedRef = useRef(false);
  useEffect(() => {
    if (inboxNudgedRef.current || feedLoading || !unreadIdsForActiveTab.length) return;
    inboxNudgedRef.current = true;
    void triggerNudge();
  }, [feedLoading, unreadIdsForActiveTab, triggerNudge]);

  useEffect(() => {
    if (!targetActivityId) return;

    const targetItem = feedSections
      .flatMap((section) => section.items)
      .find((item) => item.ids.id === targetActivityId);

    if (!targetItem) return;

    if (activeTab !== 'all' && activeTab !== targetItem.tabKey) {
      setActiveTab(targetItem.tabKey);
    }

    if (targetItem.verb === 'session.feedback_request.sent') {
      setExpandedIds((prev) => {
        if (prev.has(targetActivityId)) return prev;
        const next = new Set(prev);
        next.add(targetActivityId);
        return next;
      });
    }
  }, [activeTab, feedSections, targetActivityId]);

  const handleActivityAction = useCallback(
    (item: ActivityFeedItemVM) => {
      if (item.verb === 'session.feedback_request.sent') {
        setExpandedIds((prev) => new Set(prev).add(item.ids.id));
        return;
      }

      const metadata =
        item.metadata &&
        typeof item.metadata === 'object' &&
        !Array.isArray(item.metadata)
          ? item.metadata
          : {};
      const scope = item.audience.scope;
      const scopeKind = scope.kind;
      const scopeId =
        scope.kind === 'channel'
          ? scope.channelId
          : scope.kind === 'learning_space'
            ? scope.learningSpaceId
            : scope.kind === 'dm'
              ? scope.threadId
              : undefined;
      const channelId =
        typeof metadata.channelId === 'string' && metadata.channelId.length > 0
          ? metadata.channelId
          : scope.kind === 'channel'
            ? scope.channelId
            : scope.kind === 'dm'
              ? scope.threadId
              : undefined;
      const threadId =
        typeof metadata.threadId === 'string' && metadata.threadId.length > 0
          ? metadata.threadId
          : null;
      const actionHref =
        typeof item.content.actionButton?.href === 'string'
          ? item.content.actionButton.href
          : '';
      const channelRouteKind =
        metadata.channelRouteKind === 'space' ||
        metadata.channelRouteKind === 'dm' ||
        metadata.channelRouteKind === 'channel'
          ? metadata.channelRouteKind
          : scope.kind === 'dm'
            ? 'dm'
            : actionHref.includes('/dm/')
              ? 'dm'
              : item.tabKey === 'classes'
                ? 'space'
                : undefined;
      const route =
        NOTIFICATION_REGISTRY[item.verb]?.getRoute({
          scopeKind,
          scopeId,
          channelId,
          threadId,
          channelRouteKind,
        }) ?? DEFAULT_NOTIFICATION_ROUTE;

      router.push(route as Parameters<typeof router.push>[0]);
    },
    [router],
  );

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

  useEffect(() => {
    if (!targetActivityId || feedLoading || filteredSections.length === 0) return;

    const sectionIndex = filteredSections.findIndex((section) =>
      section.data.some((item) => item.ids.id === targetActivityId),
    );
    if (sectionIndex < 0) return;

    const itemIndex = filteredSections[sectionIndex].data.findIndex(
      (item) => item.ids.id === targetActivityId,
    );
    if (itemIndex < 0) return;

    const scrollKey = `${activeTab}:${targetActivityId}`;
    if (lastScrolledTargetRef.current === scrollKey) return;
    lastScrolledTargetRef.current = scrollKey;

    const timer = setTimeout(() => {
      sectionListRef.current?.scrollToLocation({
        sectionIndex,
        itemIndex,
        animated: true,
        viewPosition: 0.15,
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [activeTab, feedLoading, filteredSections, targetActivityId]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Notifications</Text>
        <TouchableOpacity
          style={[
            s.markAllBtn,
            unreadIdsForActiveTab.length === 0 && s.markAllBtnDisabled,
          ]}
          onPress={handleMarkAllRead}
          disabled={unreadIdsForActiveTab.length === 0}
          activeOpacity={0.8}
          accessibilityLabel="Mark all notifications as read"
        >
          <Text style={s.markAllBtnText}>Mark all read</Text>
        </TouchableOpacity>
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
      {(!profileError && feedLoading) || refreshing ? (
        <ActivityFeedSkeleton count={3} />
      ) : (profileError || feedError) && !feed ? (
        <QueryError onRetry={onRefresh} />
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
          ref={sectionListRef}
          sections={filteredSections}
          keyExtractor={(item, index) => item?.ids?.id ?? String(index)}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
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
              onActionPress={handleActivityAction}
              onSessionChangeDecision={(activity, decision) =>
                setDecisionModal({ activity, decision, reason: '' })
              }
              pendingSessionChangeRequestIds={pendingSessionChangeRequestIds}
              decisionInFlightRequestId={decisionInFlightRequestId}
              viewerTimezone={profile?.timezone ?? null}
              currentProfileId={profile?.id ?? null}
            />
          )}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}

      {/* Push notification nudge */}
      <PushNudgeSheet
        visible={isNudgeVisible}
        variant={nudgeVariant}
        onEnable={handleNudgeEnable}
        onOpenSettings={handleNudgeOpenSettings}
        onDismiss={handleNudgeDismiss}
      />
      <Modal
        animationType="fade"
        transparent
        visible={Boolean(decisionModal)}
        onRequestClose={() => setDecisionModal(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setDecisionModal(null)}>
          <Pressable style={s.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={{ gap: 6 }}>
              <Text style={s.modalTitle}>
                {decisionModal?.decision === 'approve'
                  ? 'Approve request'
                  : 'Deny request'}
              </Text>
              <Text style={s.modalDescription}>
                Add a reason to include with the activity sent to the family.
              </Text>
            </View>
            <TextInput
              style={s.reasonInput}
              value={decisionModal?.reason ?? ''}
              onChangeText={(reason) =>
                setDecisionModal((current) =>
                  current ? { ...current, reason } : current,
                )
              }
              placeholder="Reason"
              placeholderTextColor={colors.textMuted}
              multiline
              editable={!decisionMutation.isPending}
            />
            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalButton, s.modalButtonSecondary]}
                onPress={() => setDecisionModal(null)}
                disabled={decisionMutation.isPending}
                activeOpacity={0.85}
              >
                <Text style={[s.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.modalButton,
                  decisionModal?.decision === 'approve'
                    ? s.modalButtonPrimary
                    : s.modalButtonDanger,
                  {
                    opacity:
                      decisionMutation.isPending || !decisionModal?.reason.trim()
                        ? 0.55
                        : 1,
                  },
                ]}
                disabled={decisionMutation.isPending || !decisionModal?.reason.trim()}
                onPress={() => {
                  if (!decisionModal) return;
                  decisionMutation.mutate({
                    item: decisionModal.activity,
                    decision: decisionModal.decision,
                    reason: decisionModal.reason,
                  });
                }}
                activeOpacity={0.85}
              >
                <Text style={[s.modalButtonText, { color: '#ffffff' }]}>
                  {decisionModal?.decision === 'approve' ? 'Approve' : 'Deny'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
