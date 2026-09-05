import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clock3 } from 'lucide-react-native';
import type {
  ActivityFeedLeafItemVM,
  SessionCompletionVM,
} from '@iconicedu/shared-types';
import type { AppColors } from '@/lib/theme';
import { ActivityCompletionCheck } from '@/components/activity/activity-completion-check';

function toActivity(completion: SessionCompletionVM): ActivityFeedLeafItemVM {
  const title = completion.sessionTitle?.trim() || 'Session';
  return {
    kind: 'leaf',
    ids: { id: completion.id, orgId: completion.orgId },
    timestamps: {
      occurredAt: completion.sessionEndAt,
      createdAt: completion.notifiedAt ?? completion.sessionEndAt,
    },
    tabKey: 'classes',
    audience: { scope: { kind: 'global' }, visibility: 'direct' },
    verb: 'session.completion_check.sent',
    refs: { object: { kind: 'session', id: completion.scheduleId } },
    content: {
      headline: { primary: 'Session Completed', secondary: title },
      summary: 'Confirm the session, then share a rating.',
    },
    metadata: {
      orgId: completion.orgId,
      scheduleId: completion.scheduleId,
      occurrenceStart: completion.occurrenceKey,
      channelId: completion.channelId ?? null,
      learningSpaceId: completion.learningSpaceId ?? null,
      sessionCompletionId: completion.id,
      sessionCompletion: completion,
      completionCheckUiEnabled: true,
      feedbackUiEnabled: true,
      completionPromptTitle: 'Session Completed',
      completionPromptBody: `${title} has ended. Please confirm that it took place.`,
    },
  };
}

function formatDateChip(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { dayName: '', dayNum: '' };
  return {
    dayName: date.toLocaleDateString(undefined, { weekday: 'short' }),
    dayNum: date.toLocaleDateString(undefined, { day: 'numeric' }),
  };
}

// e.g. "America/New_York" -> "New York time" — matches SessionCard's zone label
// (packages/utils's getTimezoneDisplayLabel) closely enough without pulling in
// that package's country-lookup dependency for this one display line.
function formatTimezoneLabel(timezone: string) {
  const segments = timezone.split('/');
  const cityOrRegion = segments[segments.length - 1] ?? timezone;
  const normalized = cityOrRegion.replace(/[_-]+/g, ' ').trim();
  return normalized ? `${normalized} time` : null;
}

// Matches SessionCard's compact time style (session-card.tsx) — lowercase am/pm,
// no space, plus the device's timezone label (e.g. "9:00am New York time").
function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const timeText = date
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(' AM', 'am')
    .replace(' PM', 'pm');

  let timezone: string | null = null;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    timezone = null;
  }
  const zoneLabel = timezone ? formatTimezoneLabel(timezone) : null;
  return zoneLabel ? `${timeText} ${zoneLabel}` : timeText;
}

type Props = {
  completion: SessionCompletionVM;
  colors: AppColors;
  onCompletionSubmit?: (status: 'confirmed' | 'disputed') => void;
  onRatingSubmit?: () => void;
};

// Single outer card — date chip + title/badge + meta row, then the shared
// ActivityCompletionCheck widget underneath (rendered chrome-less via its
// `embedded` prop) — so the whole tile reads as ONE card, not two nested ones.
// That matters now that the homepage carousel renders a card-stack: the
// placeholder cards peeking behind the front tile are sized to this tile's full
// bounding box, so a bare header sitting outside its own card previously looked
// like a disconnected floating box. Mirrors the web SessionCompletedTile
// (packages/ui-web/src/components/dashboard/session-completed-tile.tsx).
export function SessionCompletedTile({
  completion,
  colors,
  onCompletionSubmit,
  onRatingSubmit,
}: Props) {
  const { dayName, dayNum } = formatDateChip(completion.sessionEndAt);
  const time = formatTime(completion.sessionEndAt);
  const title = completion.sessionTitle?.trim() || 'Session';
  const showStudentName = Boolean(completion.studentName);

  return (
    <View
      style={[
        styles.card,
        { borderColor: colors.border, backgroundColor: colors.inputBg },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.dateChip, { backgroundColor: colors.pageBg }]}>
          <Text style={[styles.dayName, { color: colors.textMuted }]}>{dayName}</Text>
          <Text style={[styles.dayNum, { color: colors.text }]}>{dayNum}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            <View style={[styles.badge, { backgroundColor: colors.tealBg }]}>
              <Text style={[styles.badgeText, { color: colors.teal }]}>Completed</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Clock3 size={11} color={colors.textFaint} />
            <Text style={[styles.metaText, { color: colors.textFaint }]}>
              {dayName} {time}
            </Text>
            {showStudentName ? (
              <>
                <Text style={[styles.metaText, { color: colors.textFaint }]}>·</Text>
                <Text
                  style={[styles.metaText, styles.metaTextAccent, { color: colors.teal }]}
                  numberOfLines={1}
                >
                  {completion.studentName}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>

      <ActivityCompletionCheck
        activity={toActivity(completion)}
        colors={colors}
        embedded
        onCompletionSubmit={onCompletionSubmit}
        onRatingSubmit={onRatingSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  dateChip: {
    minWidth: 46,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  dayName: {
    fontSize: 10,
    fontWeight: '600',
  },
  dayNum: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  body: {
    flex: 1,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  metaTextAccent: {
    fontWeight: '600',
  },
});
