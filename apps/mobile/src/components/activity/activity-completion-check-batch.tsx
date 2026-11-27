import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import type { ActivityFeedLeafItemVM } from '@iconicedu/shared-types';
import type { AppColors } from '@/lib/theme';
import { ActivityCompletionCheck } from '@/components/activity/activity-completion-check';

type SessionEntry = {
  scheduleId: string;
  occurrenceStart: string;
  title: string;
  channelId: string;
  learningSpaceId?: string | null;
  sessionCompletion?: {
    id?: string;
    status?: 'pending' | 'confirmed' | 'disputed' | 'auto_confirmed';
  } | null;
};

function getSessionResponseKey(session: SessionEntry) {
  return `${session.scheduleId}:${session.occurrenceStart}`;
}

function getSessions(activity: ActivityFeedLeafItemVM): SessionEntry[] {
  const m = (activity.metadata ?? {}) as Record<string, unknown>;
  if (!Array.isArray(m.sessions)) return [];
  return (m.sessions as unknown[]).filter(
    (s): s is SessionEntry =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as Record<string, unknown>).scheduleId === 'string',
  );
}

type Props = {
  activity: ActivityFeedLeafItemVM;
  colors: AppColors;
  currentProfileId?: string | null;
};

export function ActivityCompletionCheckBatch({
  activity,
  colors,
  currentProfileId,
}: Props) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const sessions = useMemo(() => getSessions(activity), [activity]);

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(
    () =>
      new Set(
        sessions
          .filter(
            (session) =>
              session.sessionCompletion?.status === 'confirmed' ||
              session.sessionCompletion?.status === 'auto_confirmed',
          )
          .map(getSessionResponseKey),
      ),
  );
  const [disputedIds, setDisputedIds] = useState<Set<string>>(
    () =>
      new Set(
        sessions
          .filter((session) => session.sessionCompletion?.status === 'disputed')
          .map(getSessionResponseKey),
      ),
  );

  const resolvedCount = confirmedIds.size + disputedIds.size;

  if (sessions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {sessions.length} classes ended
        </Text>
        {resolvedCount > 0 ? (
          <View style={[styles.progressPill, { backgroundColor: colors.actionSubtle }]}>
            <Text style={[styles.progressText, { color: colors.action }]}>
              {resolvedCount} of {sessions.length} confirmed
            </Text>
          </View>
        ) : (
          <Text style={[styles.subTitle, { color: colors.textMuted }]}>
            How did they go?
          </Text>
        )}
      </View>

      {sessions.map((session, index) => {
        const isExpanded = expandedIndex === index;
        const sessionResponseKey = getSessionResponseKey(session);
        const isConfirmed = confirmedIds.has(sessionResponseKey);
        const isDisputed = disputedIds.has(sessionResponseKey);
        const isResolved = isConfirmed || isDisputed;
        // Answered sessions collapse to a one-word status. A row the user just
        // answered stays open (so the rating step can follow) until they close it.
        const isCollapsedResolved = isResolved && !isExpanded;

        // Build a synthetic activity item for the single-session component
        const syntheticActivity: ActivityFeedLeafItemVM = {
          ...activity,
          metadata: {
            ...(activity.metadata ?? {}),
            scheduleId: session.scheduleId,
            occurrenceStart: session.occurrenceStart,
            channelId: session.channelId,
            learningSpaceId: session.learningSpaceId ?? null,
            feedbackUiEnabled: true,
            completionCheckUiEnabled: true,
            sessionCompletionId: session.sessionCompletion?.id ?? null,
            sessionCompletion: session.sessionCompletion ?? null,
          },
        };

        return (
          <View key={`${session.scheduleId}:${session.occurrenceStart}`}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${session.title} — ${isResolved ? 'resolved' : 'needs confirmation'}`}
              disabled={isCollapsedResolved}
              onPress={() => setExpandedIndex(isExpanded ? null : index)}
              style={({ pressed }) => [
                styles.sessionRow,
                {
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.inkSubtle : 'transparent',
                },
              ]}
            >
              <View style={styles.sessionRowLeft}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: isConfirmed
                        ? colors.action
                        : isDisputed
                          ? colors.warning
                          : colors.border,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.sessionTitle,
                    { color: isResolved ? colors.textMuted : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {session.title}
                </Text>
              </View>
              {isCollapsedResolved ? (
                <Text
                  style={[
                    styles.statusText,
                    { color: isDisputed ? colors.warning : colors.success },
                  ]}
                >
                  {isDisputed ? 'Reported' : 'Completed'}
                </Text>
              ) : isExpanded ? (
                <ChevronUp size={14} color={colors.textMuted} />
              ) : (
                <ChevronDown size={14} color={colors.textMuted} />
              )}
            </Pressable>

            {isExpanded ? (
              <View style={styles.sessionPanel}>
                <ActivityCompletionCheck
                  activity={syntheticActivity}
                  colors={colors}
                  currentProfileId={currentProfileId}
                  // The row above already names the session, so drop the
                  // check's own title and chrome rather than nest a card here.
                  embedded
                  onCompletionSubmit={(status) => {
                    if (status === 'confirmed') {
                      setConfirmedIds((current) =>
                        new Set(current).add(sessionResponseKey),
                      );
                      setDisputedIds((current) => {
                        const next = new Set(current);
                        next.delete(sessionResponseKey);
                        return next;
                      });
                    } else {
                      setDisputedIds((current) =>
                        new Set(current).add(sessionResponseKey),
                      );
                      setConfirmedIds((current) => {
                        const next = new Set(current);
                        next.delete(sessionResponseKey);
                        return next;
                      });
                    }
                  }}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    // White panel on the feed's page background.
    container: {
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    sessionPanel: {
      paddingHorizontal: 14,
      paddingBottom: 14,
      paddingTop: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      paddingBottom: 10,
      gap: 8,
    },
    headerTitle: {
      fontSize: 14,
      fontWeight: '700',
    },
    subTitle: {
      fontSize: 12,
    },
    progressPill: {
      borderRadius: 12,
      paddingVertical: 3,
      paddingHorizontal: 8,
    },
    progressText: {
      fontSize: 12,
      fontWeight: '600',
    },
    sessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderTopWidth: 1,
      gap: 8,
    },
    sessionRowLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
    },
    sessionTitle: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
