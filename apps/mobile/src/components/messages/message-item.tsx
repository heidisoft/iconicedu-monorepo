import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Avatar } from '@iconicedu/ui-native';
import type {
  MessageVM,
  LessonAssignmentMessageVM,
  SessionSummaryMessageVM,
  SessionCompleteMessageVM,
  ProgressUpdateMessageVM,
  EventReminderMessageVM,
  HomeworkSubmissionMessageVM,
  FileMessageVM,
  AudioRecordingMessageVM,
} from '@iconicedu/shared-types';
import type { AppColors } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getAvatarUrl(message: MessageVM): string | null {
  const avatar = (message.core.sender.profile as { avatar?: { url?: string | null } }).avatar;
  return avatar?.url ?? null;
}

// ---------------------------------------------------------------------------
// Shared style type
// ---------------------------------------------------------------------------

type S = ReturnType<typeof makeStyles>;

// ---------------------------------------------------------------------------
// Bubble sub-renderers
// ---------------------------------------------------------------------------

function TextBubble({
  text, isOwn, time, colors, s,
}: { text: string; isOwn: boolean; time: string; colors: AppColors; s: S }) {
  return (
    <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
      <Text style={{ fontSize: 15, lineHeight: 22, color: isOwn ? colors.tealFg : colors.text }}>{text}</Text>
      <Text style={{ fontSize: 10, marginTop: 2, alignSelf: 'flex-end', color: isOwn ? 'rgba(4,47,46,0.55)' : colors.textFaint }}>
        {time}
      </Text>
    </View>
  );
}

function FileBubble({
  message, isOwn, time, colors, s,
}: { message: FileMessageVM; isOwn: boolean; time: string; colors: AppColors; s: S }) {
  const { attachment, content } = message;
  return (
    <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
      {!!content?.text && (
        <Text style={{ fontSize: 15, lineHeight: 22, color: isOwn ? colors.tealFg : colors.text, marginBottom: 8 }}>
          {content.text}
        </Text>
      )}
      <TouchableOpacity
        style={[s.fileRow, { borderColor: colors.border }]}
        onPress={() => Linking.openURL(attachment.url).catch(() => null)}
      >
        <View style={[s.fileIcon, { backgroundColor: colors.tealBg }]}>
          <Text style={{ fontSize: 18 }}>📎</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: isOwn ? colors.tealFg : colors.text }} numberOfLines={1}>
            {attachment.name}
          </Text>
          <Text style={{ fontSize: 11, marginTop: 2, color: isOwn ? 'rgba(4,47,46,0.55)' : colors.textFaint }}>
            {formatFileSize(attachment.size)}
          </Text>
        </View>
      </TouchableOpacity>
      <Text style={{ fontSize: 10, marginTop: 4, alignSelf: 'flex-end', color: isOwn ? 'rgba(4,47,46,0.55)' : colors.textFaint }}>
        {time}
      </Text>
    </View>
  );
}

function ImageBubble({
  isOwn, time, colors, s,
}: { isOwn: boolean; time: string; colors: AppColors; s: S }) {
  return (
    <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther, { padding: 0, overflow: 'hidden' }]}>
      <View style={{ width: 200, height: 150, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 32 }}>🖼</Text>
        <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: 4 }}>Image</Text>
      </View>
      <Text style={{ fontSize: 10, margin: 6, alignSelf: 'flex-end', color: isOwn ? 'rgba(4,47,46,0.55)' : colors.textFaint }}>
        {time}
      </Text>
    </View>
  );
}

function AudioBubble({
  message, isOwn, time, colors, s,
}: { message: AudioRecordingMessageVM; isOwn: boolean; time: string; colors: AppColors; s: S }) {
  const { audio } = message;
  const mins = Math.floor(audio.durationSeconds / 60);
  const secs = audio.durationSeconds % 60;
  const duration = `${mins}:${String(secs).padStart(2, '0')}`;
  const waveform = audio.waveform ?? [0.3, 0.5, 0.4, 0.7, 0.6, 0.5, 0.4, 0.8, 0.5, 0.3];

  return (
    <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
      <View style={[s.playBtn, { backgroundColor: isOwn ? colors.tealFg : colors.teal }]}>
        <Text style={{ color: isOwn ? colors.teal : colors.tealFg, fontSize: 12, fontWeight: '700' }}>▶</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, height: 24 }}>
          {waveform.map((v, i) => (
            <View
              key={i}
              style={{
                width: 3,
                height: Math.max(4, v * 24),
                backgroundColor: isOwn ? colors.tealFg : colors.teal,
                borderRadius: 2,
              }}
            />
          ))}
        </View>
        <Text style={{ color: isOwn ? 'rgba(4,47,46,0.7)' : colors.textFaint, fontSize: 11 }}>{duration}</Text>
      </View>
      <Text style={{ fontSize: 10, alignSelf: 'flex-end', color: isOwn ? 'rgba(4,47,46,0.55)' : colors.textFaint }}>
        {time}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Card sub-renderers
// ---------------------------------------------------------------------------

function CardHeader({ emoji, label, tag, colors, s }: {
  emoji: string; label: string; tag?: string; colors: AppColors; s: S;
}) {
  return (
    <View style={s.cardHeader}>
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
      <Text style={[s.cardHeaderLabel, { color: colors.teal }]}>{label}</Text>
      {!!tag && (
        <View style={[s.subjectTag, { backgroundColor: colors.tealBg }]}>
          <Text style={[s.subjectTagText, { color: colors.teal }]}>{tag}</Text>
        </View>
      )}
    </View>
  );
}

function AssignmentCard({ message, colors, s }: {
  message: LessonAssignmentMessageVM; colors: AppColors; s: S;
}) {
  const { assignment } = message;
  const diffColor = { beginner: '#22c55e', intermediate: '#f59e0b', advanced: '#ef4444' }[assignment.difficulty ?? 'intermediate'] ?? colors.textMuted;

  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <CardHeader emoji="📚" label="Assignment" tag={assignment.subject} colors={colors} s={s} />
      <Text style={[s.cardTitle, { color: colors.text }]}>{assignment.title}</Text>
      <Text style={[s.cardDesc, { color: colors.textMuted }]}>{assignment.description}</Text>

      <View style={s.cardMeta}>
        <Text style={[s.metaChip, { color: colors.textMuted }]}>📅 Due {formatDate(assignment.dueAt)}</Text>
        {!!assignment.estimatedDuration && (
          <Text style={[s.metaChip, { color: colors.textMuted }]}>⏱ {assignment.estimatedDuration} min</Text>
        )}
        {!!assignment.difficulty && (
          <Text style={[s.metaChip, { color: diffColor, fontWeight: '600' }]}>
            {assignment.difficulty.charAt(0).toUpperCase() + assignment.difficulty.slice(1)}
          </Text>
        )}
      </View>

      {assignment.attachments?.map((att, i) => (
        <View key={i} style={[s.attachRow, { borderColor: colors.border }]}>
          <Text style={{ fontSize: 14 }}>📎</Text>
          <Text style={[s.attachName, { color: colors.text }]} numberOfLines={1}>{att.name}</Text>
        </View>
      ))}
    </View>
  );
}

function SessionSummaryCard({ message, colors, s }: {
  message: SessionSummaryMessageVM; colors: AppColors; s: S;
}) {
  const { session } = message;
  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <CardHeader emoji="📋" label="Session Summary" colors={colors} s={s} />
      <Text style={[s.cardTitle, { color: colors.text }]}>{session.title}</Text>
      <Text style={[s.metaChip, { color: colors.textMuted, marginBottom: 4 }]}>
        {formatDate(session.startAt)}{session.durationMinutes ? ` · ${session.durationMinutes} min` : ''}
      </Text>
      <Text style={[s.cardDesc, { color: colors.textMuted }]}>{session.summary}</Text>

      {!!session.highlights?.length && (
        <View style={{ marginTop: 10 }}>
          <Text style={[s.sectionLabel, { color: colors.text }]}>Highlights</Text>
          {session.highlights.map((h, i) => (
            <Text key={i} style={[s.listItem, { color: colors.textMuted }]}>✓ {h}</Text>
          ))}
        </View>
      )}

      {!!session.nextSteps?.length && (
        <View style={{ marginTop: 8 }}>
          <Text style={[s.sectionLabel, { color: colors.text }]}>Next Steps</Text>
          {session.nextSteps.map((step, i) => (
            <Text key={i} style={[s.listItem, { color: colors.textMuted }]}>→ {step}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

function ProgressCard({ message, colors, s }: {
  message: ProgressUpdateMessageVM; colors: AppColors; s: S;
}) {
  const { progress } = message;
  const target = progress.targetValue ?? Math.max(progress.currentValue * 1.3, 100);
  const currRatio = Math.min(progress.currentValue / target, 1);

  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <CardHeader emoji="📈" label="Progress Update" tag={progress.subject} colors={colors} s={s} />
      <Text style={[s.cardTitle, { color: colors.text }]}>{progress.metric}</Text>

      <View style={{ marginVertical: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Before: {progress.previousValue}%</Text>
          <Text style={{ color: colors.teal, fontSize: 13, fontWeight: '700' }}>Now: {progress.currentValue}%</Text>
        </View>
        <View style={[s.progressTrack, { backgroundColor: colors.inputBg }]}>
          <View style={[s.progressFill, { width: `${Math.round(currRatio * 100)}%` as `${number}%`, backgroundColor: colors.teal }]} />
        </View>
        {!!progress.targetValue && (
          <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 4 }}>Target: {progress.targetValue}%</Text>
        )}
      </View>

      <View style={[s.improvementBadge, { backgroundColor: colors.tealBg }]}>
        <Text style={{ color: colors.teal, fontWeight: '700', fontSize: 13 }}>+{progress.improvement} improvement</Text>
      </View>
      <Text style={[s.cardDesc, { color: colors.textMuted, marginTop: 8 }]}>{progress.summary}</Text>
    </View>
  );
}

function EventCard({ message, colors, s }: {
  message: EventReminderMessageVM; colors: AppColors; s: S;
}) {
  const { event } = message;
  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <CardHeader emoji="📅" label="Event Reminder" colors={colors} s={s} />
      <Text style={[s.cardTitle, { color: colors.text }]}>{event.title}</Text>
      <Text style={[s.metaChip, { color: colors.textMuted }]}>
        {formatDate(event.startAt)} · {formatTime(event.startAt)}
        {event.endAt ? ` – ${formatTime(event.endAt)}` : ''}
      </Text>
      {!!event.location && (
        <Text style={[s.metaChip, { color: colors.textMuted }]}>📍 {event.location}</Text>
      )}
      {!!event.meetingLink && (
        <TouchableOpacity
          style={[s.joinBtn, { backgroundColor: colors.teal }]}
          onPress={() => Linking.openURL(event.meetingLink!).catch(() => null)}
        >
          <Text style={{ color: colors.tealFg, fontWeight: '700', fontSize: 13 }}>Join Meeting</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function HomeworkCard({ message, colors, s }: {
  message: HomeworkSubmissionMessageVM; colors: AppColors; s: S;
}) {
  const { homework } = message;
  const statusColor =
    homework.status === 'graded' ? '#22c55e'
    : homework.status === 'needs-revision' ? '#f59e0b'
    : colors.teal;
  const statusLabel = {
    submitted: '✓ Submitted',
    graded: '✓ Graded',
    'needs-revision': '⚠ Needs Revision',
  }[homework.status];

  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <CardHeader emoji="📝" label="Homework Submitted" colors={colors} s={s} />
      <Text style={[s.cardTitle, { color: colors.text }]}>{homework.assignmentTitle}</Text>

      <View style={[s.statusBadge, { backgroundColor: statusColor + '22' }]}>
        <Text style={{ color: statusColor, fontWeight: '600', fontSize: 12 }}>{statusLabel}</Text>
      </View>

      {homework.attachments.map((att, i) => (
        <View key={i} style={[s.attachRow, { borderColor: colors.border }]}>
          <Text style={{ fontSize: 14 }}>{att.type === 'image' ? '🖼' : '📎'}</Text>
          <Text style={[s.attachName, { color: colors.text }]} numberOfLines={1}>{att.name}</Text>
        </View>
      ))}

      {!!homework.grade && (
        <Text style={[s.metaChip, { color: colors.textMuted, marginTop: 6 }]}>Grade: {homework.grade}</Text>
      )}
      {!!homework.feedback && (
        <Text style={[s.cardDesc, { color: colors.textMuted }]}>{homework.feedback}</Text>
      )}
    </View>
  );
}

function SessionCompleteBar({ message, colors, s }: {
  message: SessionCompleteMessageVM; colors: AppColors; s: S;
}) {
  return (
    <View style={s.sessionCompleteRow}>
      <View style={[s.sessionCompleteLine, { backgroundColor: colors.border }]} />
      <View style={s.sessionCompleteCenter}>
        <View style={[s.sessionCompleteIcon, { backgroundColor: colors.tealBg, borderColor: colors.teal }]}>
          <Text style={{ color: colors.teal, fontSize: 14 }}>✓</Text>
        </View>
        <Text style={[s.sessionCompleteTitle, { color: colors.textMuted }]} numberOfLines={2}>
          {message.session.title}
        </Text>
        {!!message.session.endAt && (
          <Text style={{ fontSize: 10, color: colors.textFaint }}>{formatTime(message.session.endAt)}</Text>
        )}
      </View>
      <View style={[s.sessionCompleteLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles factory
// ---------------------------------------------------------------------------

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    outerRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 3 },
    outerRowOwn: { flexDirection: 'row-reverse' },
    avatarSpacer: { width: 32, height: 32 },

    bubble:      { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleOther: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
    bubbleOwn:   { backgroundColor: colors.teal, borderBottomRightRadius: 4 },

    senderName: { fontSize: 12, fontWeight: '600', color: colors.teal, paddingLeft: 52, marginBottom: 1 },

    cardRow:        { paddingHorizontal: 12, paddingVertical: 6 },
    cardSenderRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    cardSenderName: { fontSize: 13, fontWeight: '600', color: colors.text, flex: 1 },
    cardSenderTime: { fontSize: 11, color: colors.textFaint },

    card:            { borderWidth: 1, borderRadius: 16, padding: 14, gap: 4 },
    cardHeader:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    cardHeaderLabel: { fontSize: 13, fontWeight: '700', flex: 1 },
    subjectTag:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
    subjectTagText:  { fontSize: 11, fontWeight: '600' },
    cardTitle:       { fontSize: 16, fontWeight: '700', marginBottom: 2 },
    cardDesc:        { fontSize: 13, lineHeight: 19 },
    cardMeta:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    metaChip:        { fontSize: 12 },
    sectionLabel:    { fontSize: 12, fontWeight: '700', marginBottom: 4 },
    listItem:        { fontSize: 13, lineHeight: 20 },

    attachRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 8, marginTop: 8 },
    attachName: { flex: 1, fontSize: 12, fontWeight: '500' },

    fileRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 10, marginVertical: 4 },
    fileIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

    playBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

    progressTrack:    { height: 8, borderRadius: 4, overflow: 'hidden' },
    progressFill:     { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
    improvementBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 4 },

    statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 4 },

    joinBtn: { borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },

    sessionCompleteRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 10 },
    sessionCompleteLine:   { flex: 1, height: 1 },
    sessionCompleteCenter: { alignItems: 'center', gap: 4 },
    sessionCompleteIcon:   { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    sessionCompleteTitle:  { fontSize: 12, fontWeight: '600', textAlign: 'center', maxWidth: 160 },
  });
}

// ---------------------------------------------------------------------------
// Card vs. bubble classification
// ---------------------------------------------------------------------------

const CARD_TYPES = new Set([
  'lesson-assignment',
  'session-summary',
  'progress-update',
  'event-reminder',
  'homework-submission',
  'feedback-request',
  'session-booking',
  'payment-reminder',
]);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export type MessageItemProps = {
  message: MessageVM;
  isOwn: boolean;
  showSender: boolean;
  colors: AppColors;
};

export const MessageItem: React.FC<MessageItemProps> = ({ message, isOwn, showSender, colors }) => {
  const s = useMemo(() => makeStyles(colors), [colors]);
  const type = message.core.type;
  const senderName = message.core.sender.profile.displayName;
  const avatarUrl = getAvatarUrl(message);
  const time = formatTime(message.core.createdAt);

  // Session complete: full-width centered divider
  if (type === 'session-complete') {
    return <SessionCompleteBar message={message as SessionCompleteMessageVM} colors={colors} s={s} />;
  }

  // Structured card types
  if (CARD_TYPES.has(type)) {
    return (
      <View style={s.cardRow}>
        {showSender && (
          <View style={s.cardSenderRow}>
            <Avatar name={senderName} src={avatarUrl} size="sm" />
            <Text style={s.cardSenderName}>{senderName}</Text>
            <Text style={s.cardSenderTime}>{time}</Text>
          </View>
        )}

        {type === 'lesson-assignment' && (
          <AssignmentCard message={message as LessonAssignmentMessageVM} colors={colors} s={s} />
        )}
        {type === 'session-summary' && (
          <SessionSummaryCard message={message as SessionSummaryMessageVM} colors={colors} s={s} />
        )}
        {type === 'progress-update' && (
          <ProgressCard message={message as ProgressUpdateMessageVM} colors={colors} s={s} />
        )}
        {type === 'event-reminder' && (
          <EventCard message={message as EventReminderMessageVM} colors={colors} s={s} />
        )}
        {type === 'homework-submission' && (
          <HomeworkCard message={message as HomeworkSubmissionMessageVM} colors={colors} s={s} />
        )}

        {!showSender && (
          <Text style={{ fontSize: 10, color: colors.textFaint, textAlign: 'right', marginTop: 4 }}>
            {time}
          </Text>
        )}
      </View>
    );
  }

  // Bubble types: text, file, image, audio-recording
  return (
    <View>
      {!isOwn && showSender && <Text style={s.senderName}>{senderName}</Text>}
      <View style={[s.outerRow, isOwn && s.outerRowOwn]}>
        {!isOwn && (
          showSender
            ? <Avatar name={senderName} src={avatarUrl} size="sm" />
            : <View style={s.avatarSpacer} />
        )}
        {type === 'file'
          ? <FileBubble message={message as FileMessageVM} isOwn={isOwn} time={time} colors={colors} s={s} />
          : type === 'audio-recording'
          ? <AudioBubble message={message as AudioRecordingMessageVM} isOwn={isOwn} time={time} colors={colors} s={s} />
          : type === 'image'
          ? <ImageBubble isOwn={isOwn} time={time} colors={colors} s={s} />
          : <TextBubble
              text={(message as { content?: { text?: string } }).content?.text ?? ''}
              isOwn={isOwn}
              time={time}
              colors={colors}
              s={s}
            />
        }
      </View>
    </View>
  );
};
