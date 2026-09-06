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
  completionVote?: {
    status?: 'confirmed' | 'disputed';
  } | null;
};

function getSessionResponseKey(session: SessionEntry) {
  return session.occurrenceStart;
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
          .filter((session) => session.completionVote?.status === 'confirmed')
          .map(getSessionResponseKey),
      ),
  );
  const [disputedIds, setDisputedIds] = useState<Set<string>>(
    () =>
      new Set(
        sessions
          .filter((session) => session.completionVote?.status === 'disputed')
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
          <View style={[styles.progressPill, { backgroundColor: `${colors.teal}22` }]}>
            <Text style={[styles.progressText, { color: colors.teal }]}>
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
            completionVote: session.completionVote ?? null,
          },
        };

        return (
          <View key={`${session.scheduleId}:${session.occurrenceStart}`}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${session.title} — ${isResolved ? 'resolved' : 'needs confirmation'}`}
              onPress={() => setExpandedIndex(isExpanded ? null : index)}
              style={({ pressed }) => [
                styles.sessionRow,
                {
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.inputBg : colors.card,
                },
              ]}
            >
              <View style={styles.sessionRowLeft}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: isConfirmed
                        ? colors.teal
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
              {isExpanded ? (
                <ChevronUp size={14} color={colors.textMuted} />
              ) : (
                <ChevronDown size={14} color={colors.textMuted} />
              )}
            </Pressable>

            {isExpanded ? (
              <ActivityCompletionCheck
                activity={syntheticActivity}
                colors={colors}
                currentProfileId={currentProfileId}
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
                    setDisputedIds((current) => new Set(current).add(sessionResponseKey));
                    setConfirmedIds((current) => {
                      const next = new Set(current);
                      next.delete(sessionResponseKey);
                      return next;
                    });
                  }
                }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      marginTop: 10,
      marginLeft: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      overflow: 'hidden',
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
      fontSize: 13,
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
    sessionTitle: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
