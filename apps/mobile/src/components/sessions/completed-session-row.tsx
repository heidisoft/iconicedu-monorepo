import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Clock3, Flag, Star } from 'lucide-react-native';
import { ActivityFeedbackRequest } from '@/components/activity/activity-feedback-request';
import { toActivity } from '@/components/sessions/session-completed-tile';
import type { CompletedSessionRow as Row } from '@/lib/sessions/completed-sessions';
import type { AppColors } from '@/lib/theme';

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

function statusTone(row: Row, C: AppColors) {
  if (row.awaitingConfirmation) return { bg: C.warningSubtle, fg: C.warning };
  if (row.confirmedBy === 'staff') return { bg: C.infoSubtle, fg: C.info };
  if (row.confirmedBy === 'system') return { bg: C.inkSubtle, fg: C.textMuted };
  return { bg: C.successSubtle, fg: C.success };
}

type Props = {
  row: Row;
  colors: AppColors;
  /** `enable-session-completion-reports`: shows the Report action and badges. */
  reportsEnabled: boolean;
  /** True once the viewer reported it on this screen, before the list refetches. */
  reportedLocally?: boolean;
  onReport?: (row: Row) => void;
  onRated?: () => void;
};

export function CompletedSessionRow({
  row,
  colors,
  reportsEnabled,
  reportedLocally = false,
  onReport,
  onRated,
}: Props) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [rated, setRated] = useState(false);
  const { dayName, dayNum, time } = formatDayParts(row.startsAt);
  const tone = statusTone(row, colors);
  // ActivityFeedbackRequest resets its rating state whenever `activity` changes
  // identity, so build it once per completion. Building it inline meant the
  // re-render after the first star tap (hiding "Rate session") handed it a fresh
  // object and wiped the just-submitted rating — the first tap looked ignored.
  const ratingActivity = useMemo(() => {
    const completion = row.completion;
    if (!completion) return null;
    // A skipped rating stamps `ratedAt` with no score; the widget would read that
    // as already rated and disable the stars. It's still unrated here.
    return toActivity(
      completion.rating == null ? { ...completion, ratedAt: null } : completion,
    );
  }, [row.completion]);

  const reportCount = row.reportCount || (reportedLocally ? 1 : 0);
  const showReported = reportsEnabled && reportCount > 0;
  const canReport = reportsEnabled && row.reportable && !reportedLocally && onReport;
  const canRate = row.ratable && row.completion && !rated;
  const reportedLabel = row.completion
    ? 'Reported'
    : `Reported${reportCount > 1 ? ` (${reportCount})` : ''}`;

  return (
    <View style={s.card}>
      <View
        style={s.row}
        accessible
        accessibilityLabel={[
          row.title,
          `${dayName} ${dayNum} ${time}`,
          row.subtitle,
          row.statusLabel,
          showReported ? reportedLabel : null,
          row.rating != null ? `Rated ${Number(row.rating.toFixed(1))} out of 5` : null,
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
            <View style={[s.badge, { backgroundColor: tone.bg }]}>
              <Text style={[s.badgeText, { color: tone.fg }]}>{row.statusLabel}</Text>
            </View>
            {showReported ? (
              <View style={[s.badge, { backgroundColor: colors.warningSubtle }]}>
                <Text style={[s.badgeText, { color: colors.warning }]}>
                  {reportedLabel}
                </Text>
              </View>
            ) : null}
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
          <View style={s.rating}>
            <Star size={12} color={colors.warning} fill={colors.warning} />
            <Text style={s.ratingText}>{Number(row.rating.toFixed(1))}</Text>
          </View>
        ) : null}
      </View>

      {canRate || canReport ? (
        <View style={s.actions}>
          {canRate && !ratingOpen ? (
            <TouchableOpacity
              style={s.action}
              onPress={() => setRatingOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Rate ${row.title}`}
            >
              <Star size={14} color={colors.action} />
              <Text style={[s.actionText, { color: colors.action }]}>Rate session</Text>
            </TouchableOpacity>
          ) : null}
          {canReport ? (
            <TouchableOpacity
              style={s.action}
              onPress={() => onReport?.(row)}
              accessibilityRole="button"
              accessibilityLabel={`Report ${row.title} as wrongly marked complete`}
            >
              <Flag size={14} color={colors.textMuted} />
              <Text style={[s.actionText, { color: colors.textMuted }]}>
                {"Didn't take part? Report"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {ratingOpen && ratingActivity ? (
        <ActivityFeedbackRequest
          activity={ratingActivity}
          colors={colors}
          autoDismiss={false}
          bare
          onRatingSubmit={() => {
            setRated(true);
            onRated?.();
          }}
        />
      ) : null}
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      padding: 14,
      gap: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
    titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    title: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: C.text },
    badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    badgeText: { fontSize: 10, fontWeight: '700' },
    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
    metaText: { fontSize: 12, color: C.textFaint },
    metaAccent: { fontWeight: '600', color: C.teal },
    rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    ratingText: { fontSize: 12, fontWeight: '600', color: C.textMuted },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    },
    action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
    actionText: { fontSize: 13, fontWeight: '600' },
  });
}
