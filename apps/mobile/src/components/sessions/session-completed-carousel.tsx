import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
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

export function SessionCompletedCarousel({
  sessions,
  colors,
  width,
}: {
  sessions: SessionCompletionVM[];
  colors: AppColors;
  width: number;
}) {
  const [visibleSessions, setVisibleSessions] = useState(sessions);

  useEffect(() => {
    setVisibleSessions(sessions);
  }, [sessions]);

  if (!visibleSessions.length) return null;

  const remove = (id: string) => {
    setVisibleSessions((current) => current.filter((item) => item.id !== id));
  };

  return (
    <View
      accessibilityLabel="Session Completed"
      style={[
        styles.section,
        { borderColor: colors.border, backgroundColor: colors.card },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>Session Completed</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Confirm, then rate
          </Text>
        </View>
        <View style={[styles.count, { backgroundColor: colors.tealBg }]}>
          <Text style={[styles.countText, { color: colors.teal }]}>
            {visibleSessions.length}
          </Text>
        </View>
      </View>
      <FlatList
        horizontal
        pagingEnabled
        snapToInterval={width}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        data={visibleSessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <ActivityCompletionCheck
              activity={toActivity(item)}
              colors={colors}
              onCompletionSubmit={(status) => {
                if (status === 'disputed') remove(item.id);
              }}
              onRatingSubmit={() => remove(item.id)}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerCopy: { gap: 2 },
  title: { fontSize: 17, fontWeight: '800' },
  subtitle: { fontSize: 13 },
  count: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: 13, fontWeight: '800' },
});
