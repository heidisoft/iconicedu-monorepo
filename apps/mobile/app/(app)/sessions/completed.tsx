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
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Star,
} from 'lucide-react-native';
import { SessionCompletedTile } from '@/components/sessions/session-completed-tile';
import { useCompletedSessionsHistory } from '@/hooks/use-completed-sessions-history';
import {
  ADMIN_MIN_MONTH_OFFSET,
  monthRange,
  type CompletedSessionRow,
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    dateChip: {
      minWidth: 46,
      borderRadius: 10,
      paddingVertical: 6,
      paddingHorizontal: 8,
      alignItems: 'center',
      backgroundColor: C.pageBg,
    },
    dayName: { fontSize: 10, fontWeight: '600', color: C.textMuted },
    dayNum: { fontSize: 14, fontWeight: '700', lineHeight: 18, color: C.text },
    body: { flex: 1, gap: 6 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: C.text },
    badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    badgeText: { fontSize: 10, fontWeight: '700' },
    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
    metaText: { fontSize: 12, color: C.textFaint },
    metaAccent: { fontWeight: '600', color: C.teal },
    rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    ratingText: { fontSize: 12, fontWeight: '600', color: C.textMuted },
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

type Styles = ReturnType<typeof makeStyles>;

function formatDayParts(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { dayName: '', dayNum: '', time: '' };
  return {
    dayName: date.toLocaleDateString(undefined, { weekday: 'short' }),
    dayNum: date.toLocaleDateString(undefined, { day: 'numeric' }),
    time: date
      .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
      .replace(' AM', 'am')
      .replace(' PM', 'pm'),
  };
}

function CompletedSessionListRow({
  row,
  colors,
  s,
}: {
  row: CompletedSessionRow;
  colors: AppColors;
  s: Styles;
}) {
  const { dayName, dayNum, time } = formatDayParts(row.startsAt);
  const isPending = row.awaitingConfirmation;
  return (
    <View
      style={s.row}
      accessible
      accessibilityLabel={[
        row.title,
        `${dayName} ${dayNum} ${time}`,
        row.subtitle,
        row.statusLabel,
      ]
        .filter(Boolean)
        .join(', ')}
    >
      <View style={s.dateChip}>
        <Text style={s.dayName}>{dayName}</Text>
        <Text style={s.dayNum}>{dayNum}</Text>
      </View>
      <View style={s.body}>
        <View style={s.titleRow}>
          <Text style={s.title} numberOfLines={1}>
            {row.title}
          </Text>
          <View
            style={[
              s.badge,
              {
                backgroundColor: isPending ? colors.warningSubtle : colors.successSubtle,
              },
            ]}
          >
            <Text
              style={[
                s.badgeText,
                { color: isPending ? colors.warning : colors.success },
              ]}
            >
              {row.statusLabel}
            </Text>
          </View>
        </View>
        <View style={s.metaRow}>
          <Clock3 size={11} color={colors.textFaint} />
          <Text style={s.metaText}>{time}</Text>
          {row.subtitle ? (
            <>
              <Text style={s.metaText}>·</Text>
              <Text style={[s.metaText, s.metaAccent]} numberOfLines={1}>
                {row.subtitle}
              </Text>
            </>
          ) : null}
        </View>
      </View>
      {row.rating != null ? (
        <View style={s.rating} accessibilityLabel={`Rated ${row.rating} out of 5`}>
          <Star size={12} color={colors.warning} fill={colors.warning} />
          <Text style={s.ratingText}>{Number(row.rating.toFixed(1))}</Text>
        </View>
      ) : null}
    </View>
  );
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
    ({ item }: { item: CompletedSessionRow }) =>
      item.completion ? (
        <SessionCompletedTile
          completion={item.completion}
          colors={colors}
          onCompletionSubmit={handleCompletionChanged}
          onRatingSubmit={handleCompletionChanged}
        />
      ) : (
        <CompletedSessionListRow row={item} colors={colors} s={s} />
      ),
    [colors, handleCompletionChanged, s],
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
    </SafeAreaView>
  );
}
