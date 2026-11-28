import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { CompletedSessionRow } from '@/components/sessions/completed-session-row';
import { ReportCompletionSheet } from '@/components/sessions/report-completion-sheet';
import { SessionCompletedTile } from '@/components/sessions/session-completed-tile';
import { useCompletedSessionsHistory } from '@/hooks/use-completed-sessions-history';
import { useMobileFeatureFlag } from '@/hooks/use-mobile-feature-flag';
import { mobileFeatureFlagKeys } from '@/lib/feature-flags';
import {
  ADMIN_MIN_MONTH_OFFSET,
  monthRange,
  type CompletedSessionRow as Row,
  type CompletedSessionsTab,
} from '@/lib/sessions/completed-sessions';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.pageBg },
    nav: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    navBack: { padding: 8, borderRadius: 8 },
    navTitle: {
      flex: 1,
      fontSize: 19,
      fontWeight: '700',
      color: C.text,
      textAlign: 'center',
      marginRight: 40,
    },
    controls: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, gap: 12 },
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    monthButton: { padding: 8, borderRadius: 8 },
    monthLabel: { fontSize: 16, fontWeight: '700', color: C.text },
    segment: {
      flexDirection: 'row',
      padding: 3,
      borderRadius: 10,
      backgroundColor: C.inkSubtle,
    },
    segmentItem: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
    },
    segmentItemActive: { backgroundColor: C.card },
    segmentText: { fontSize: 13, fontWeight: '600', color: C.textMuted },
    segmentTextActive: { color: C.text },
    listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 10 },
    // Lets the empty state fill the space below the controls so it centres.
    listContentEmpty: { flexGrow: 1 },
    // Same empty-state template as the Inbox and Messages tabs.
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
      backgroundColor: C.inputBg,
    },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: C.text },
    emptyDesc: {
      fontSize: 15,
      textAlign: 'center',
      paddingHorizontal: 40,
      lineHeight: 20,
      color: C.textMuted,
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    errorText: { fontSize: 14, color: C.textMuted, textAlign: 'center' },
    retryButton: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: C.action,
    },
    retryText: { fontSize: 14, fontWeight: '600', color: C.actionForeground },
    footer: { paddingVertical: 16 },
  });
}

const TABS: Array<{ key: CompletedSessionsTab; label: string }> = [
  { key: 'completed', label: 'Completed' },
  { key: 'pending', label: 'Awaiting confirmation' },
];

export default function CompletedSessionsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [tab, setTab] = useState<CompletedSessionsTab>('completed');
  const [monthOffset, setMonthOffset] = useState(0);
  const month = useMemo(() => monthRange(monthOffset), [monthOffset]);
  const [refreshing, setRefreshing] = useState(false);
  const reportsEnabled = useMobileFeatureFlag(
    mobileFeatureFlagKeys.enableSessionCompletionReports,
  );
  const [reportTarget, setReportTarget] = useState<Row | null>(null);
  // Rows reported on this screen show as reported before the list refetches.
  const [reportedIds, setReportedIds] = useState<ReadonlySet<string>>(new Set());

  const {
    rows,
    counts,
    isOrgAdminView,
    isPending,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useCompletedSessionsHistory(tab, month);

  // A confirm/dispute from a pending tile changes the counts, the Completed tab
  // and the home carousel. The tile itself stays put (it still shows the rating
  // step and the undo window), so the full refresh waits until the viewer moves
  // to another tab or month, or leaves the screen.
  const dirtyRef = useRef(false);
  const flushIfDirty = useCallback(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    void queryClient.invalidateQueries({ queryKey: ['session-completions'] });
  }, [queryClient]);
  useEffect(() => flushIfDirty, [flushIfDirty]);

  const handleCompletionChanged = useCallback(() => {
    dirtyRef.current = true;
    void queryClient.invalidateQueries({ queryKey: ['session-completions', 'summary'] });
  }, [queryClient]);

  const handleReported = useCallback((completionId: string) => {
    setReportedIds((ids) => new Set(ids).add(completionId));
    setReportTarget(null);
    dirtyRef.current = true;
  }, []);

  const selectTab = (next: CompletedSessionsTab) => {
    if (next === tab) return;
    flushIfDirty();
    setTab(next);
  };
  const shiftMonth = (delta: number) => {
    flushIfDirty();
    setMonthOffset((offset) => offset + delta);
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    dirtyRef.current = true;
    flushIfDirty();
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [flushIfDirty, refetch]);

  const canGoBack = !isOrgAdminView || monthOffset > ADMIN_MIN_MONTH_OFFSET;
  const canGoForward = monthOffset < 0;

  const renderItem = useCallback(
    ({ item }: { item: Row }) =>
      item.awaitingConfirmation && item.completion ? (
        <SessionCompletedTile
          completion={item.completion}
          colors={colors}
          onCompletionSubmit={handleCompletionChanged}
          onRatingSubmit={handleCompletionChanged}
        />
      ) : (
        <CompletedSessionRow
          row={item}
          colors={colors}
          reportsEnabled={reportsEnabled}
          reportedLocally={reportedIds.has(item.id)}
          onReport={setReportTarget}
          onRated={handleCompletionChanged}
        />
      ),
    [colors, handleCompletionChanged, reportedIds, reportsEnabled],
  );

  let content: React.ReactNode;
  if (isPending && !refreshing) {
    content = (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  } else if (isError && rows.length === 0) {
    content = (
      <View style={s.centered}>
        <Text style={s.errorText}>{"We couldn't load these sessions."}</Text>
        <TouchableOpacity
          style={s.retryButton}
          onPress={() => void refetch()}
          accessibilityRole="button"
        >
          <Text style={s.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  } else {
    content = (
      <FlatList
        testID="completed-sessions-list"
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[s.listContent, rows.length === 0 && s.listContentEmpty]}
        onEndReached={fetchNextPage}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.teal}
          />
        }
        ListFooterComponent={
          hasNextPage && isFetchingNextPage ? (
            <View style={s.footer}>
              <ActivityIndicator color={colors.teal} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <View style={s.emptyIcon}>
              <CalendarCheck size={32} color={colors.teal} />
            </View>
            <Text style={s.emptyTitle}>
              {tab === 'completed' ? 'No completed sessions' : 'All caught up'}
            </Text>
            <Text style={s.emptyDesc}>
              {tab === 'completed'
                ? `Sessions completed in ${month.label} will appear here.`
                : `Nothing is awaiting confirmation for ${month.label}.`}
            </Text>
          </View>
        }
      />
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <TouchableOpacity
          style={s.navBack}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.navTitle}>Sessions completed</Text>
      </View>

      <View style={s.controls}>
        <View style={s.monthRow}>
          <TouchableOpacity
            style={[s.monthButton, !canGoBack && { opacity: 0.3 }]}
            onPress={() => shiftMonth(-1)}
            disabled={!canGoBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            accessibilityState={{ disabled: !canGoBack }}
          >
            <ChevronLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.monthLabel} accessibilityRole="header">
            {month.label}
          </Text>
          <TouchableOpacity
            style={[s.monthButton, !canGoForward && { opacity: 0.3 }]}
            onPress={() => shiftMonth(1)}
            disabled={!canGoForward}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            accessibilityState={{ disabled: !canGoForward }}
          >
            <ChevronRight size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={s.segment} accessibilityRole="tablist">
          {TABS.map(({ key, label }) => {
            const active = key === tab;
            const count = counts ? counts[key] : null;
            const text = count == null ? label : `${label} (${count})`;
            return (
              <TouchableOpacity
                key={key}
                style={[s.segmentItem, active && s.segmentItemActive]}
                onPress={() => selectTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={text}
              >
                <Text
                  style={[s.segmentText, active && s.segmentTextActive]}
                  numberOfLines={1}
                >
                  {text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {content}

      <ReportCompletionSheet
        completion={reportTarget?.completion ?? null}
        confirmedBy={reportTarget?.confirmedBy ?? null}
        colors={colors}
        onClose={() => setReportTarget(null)}
        onReported={handleReported}
      />
    </SafeAreaView>
  );
}
