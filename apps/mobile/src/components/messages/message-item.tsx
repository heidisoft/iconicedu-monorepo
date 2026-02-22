import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Linking } from 'react-native';
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
  ReactionVM,
} from '@iconicedu/shared-types';
import type { AppColors } from '@/lib/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function getAvatarUrl(message: MessageVM): string | null {
  const avatar = (message.core.sender.profile as { avatar?: { url?: string | null } }).avatar;
  return avatar?.url ?? null;
}

// Deterministic color per sender name (Slack-style)
const NAME_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];
function senderColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}

type S = ReturnType<typeof makeStyles>;

// ─── Reaction pills ───────────────────────────────────────────────────────────

type ReactionRowProps = {
  reactions: ReactionVM[];
  colors: AppColors;
  messageId: string;
  onReactionToggle?: (messageId: string, emoji: string) => void;
};

function ReactionRow({ reactions, colors, messageId, onReactionToggle }: ReactionRowProps) {
  if (!reactions.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {reactions.map((r) => (
        <TouchableOpacity
          key={r.emoji}
          onPress={() => onReactionToggle?.(messageId, r.emoji)}
          activeOpacity={0.75}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: r.reactedByMe ? colors.tealBg : colors.inputBg,
            borderWidth: 1,
            borderColor: r.reactedByMe ? colors.teal : colors.border,
            borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
          }}
        >
          <Text style={{ fontSize: 13 }}>{r.emoji}</Text>
          <Text style={{ fontSize: 12, color: r.reactedByMe ? colors.teal : colors.textMuted, fontWeight: '600' }}>
            {r.count}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Thread indicator ─────────────────────────────────────────────────────────

function ThreadIndicator({ colors, onPress }: { colors: AppColors; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ marginTop: 4 }}>
      <Text style={{ fontSize: 12, color: colors.teal, fontWeight: '600' }}>💬 Reply in thread</Text>
    </TouchableOpacity>
  );
}

// ─── Card sub-renderers ───────────────────────────────────────────────────────

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

function AssignmentCard({ message, colors, s }: { message: LessonAssignmentMessageVM; colors: AppColors; s: S }) {
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
            {assignment.difficulty[0]!.toUpperCase() + assignment.difficulty.slice(1)}
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

function SessionSummaryCard({ message, colors, s }: { message: SessionSummaryMessageVM; colors: AppColors; s: S }) {
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
          {session.highlights.map((h, i) => <Text key={i} style={[s.listItem, { color: colors.textMuted }]}>✓ {h}</Text>)}
        </View>
      )}
      {!!session.nextSteps?.length && (
        <View style={{ marginTop: 8 }}>
          <Text style={[s.sectionLabel, { color: colors.text }]}>Next Steps</Text>
          {session.nextSteps.map((step, i) => <Text key={i} style={[s.listItem, { color: colors.textMuted }]}>→ {step}</Text>)}
        </View>
      )}
    </View>
  );
}

function ProgressCard({ message, colors, s }: { message: ProgressUpdateMessageVM; colors: AppColors; s: S }) {
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

function EventCard({ message, colors, s }: { message: EventReminderMessageVM; colors: AppColors; s: S }) {
  const { event } = message;
  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <CardHeader emoji="📅" label="Event Reminder" colors={colors} s={s} />
      <Text style={[s.cardTitle, { color: colors.text }]}>{event.title}</Text>
      <Text style={[s.metaChip, { color: colors.textMuted }]}>
        {formatDate(event.startAt)} · {formatTime(event.startAt)}
        {event.endAt ? ` – ${formatTime(event.endAt)}` : ''}
      </Text>
      {!!event.location && <Text style={[s.metaChip, { color: colors.textMuted }]}>📍 {event.location}</Text>}
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

function HomeworkCard({ message, colors, s }: { message: HomeworkSubmissionMessageVM; colors: AppColors; s: S }) {
  const { homework } = message;
  const statusColor = homework.status === 'graded' ? '#22c55e' : homework.status === 'needs-revision' ? '#f59e0b' : colors.teal;
  const statusLabel = { submitted: '✓ Submitted', graded: '✓ Graded', 'needs-revision': '⚠ Needs Revision' }[homework.status];
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
      {!!homework.grade && <Text style={[s.metaChip, { color: colors.textMuted, marginTop: 6 }]}>Grade: {homework.grade}</Text>}
      {!!homework.feedback && <Text style={[s.cardDesc, { color: colors.textMuted }]}>{homework.feedback}</Text>}
    </View>
  );
}

function SessionCompleteBar({ message, colors, s }: { message: SessionCompleteMessageVM; colors: AppColors; s: S }) {
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

// ─── Styles factory ───────────────────────────────────────────────────────────

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    // Slack two-column row
    row:          { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 4 },
    rowGroupStart: { paddingTop: 14 },

    // Left column — 44px (avatar or empty spacer)
    leftCol:  { width: 44, alignItems: 'center', paddingTop: 2, flexShrink: 0 },

    // Right column
    rightCol: { flex: 1, gap: 2 },

    // Sender name + timestamp header (group start only)
    nameRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 1 },
    senderName: { fontSize: 15, fontWeight: '700' },
    msgTime:    { fontSize: 12, color: colors.textFaint },

    // Plain text content (no bubble background)
    textContent: { fontSize: 15, lineHeight: 22, color: colors.text },

    // File attachment
    fileWrap: { backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginTop: 2 },
    fileRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
    fileIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.tealBg, alignItems: 'center', justifyContent: 'center' },

    // Audio player
    audioWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginTop: 2 },
    playBtn:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

    // Image placeholder
    imagePlaceholder: { width: 200, height: 150, borderRadius: 10, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },

    // Structured cards
    card:            { borderWidth: 1, borderRadius: 16, padding: 14, gap: 4, marginTop: 2 },
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
    attachRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 8, marginTop: 8 },
    attachName:      { flex: 1, fontSize: 12, fontWeight: '500' },
    joinBtn:         { borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
    statusBadge:     { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 4 },
    progressTrack:   { height: 8, borderRadius: 4, overflow: 'hidden' },
    progressFill:    { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
    improvementBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 4 },

    // Session complete divider
    sessionCompleteRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 10 },
    sessionCompleteLine:   { flex: 1, height: 1 },
    sessionCompleteCenter: { alignItems: 'center', gap: 4 },
    sessionCompleteIcon:   { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    sessionCompleteTitle:  { fontSize: 12, fontWeight: '600', textAlign: 'center', maxWidth: 160 },
  });
}

// ─── Card type set ────────────────────────────────────────────────────────────

const CARD_TYPES = new Set([
  'lesson-assignment', 'session-summary', 'progress-update',
  'event-reminder', 'homework-submission', 'feedback-request',
  'session-booking', 'payment-reminder',
]);

// ─── Main component ───────────────────────────────────────────────────────────

export type MessageItemProps = {
  message: MessageVM;
  isOwn: boolean;
  isGroupStart: boolean;
  colors: AppColors;
  onLongPress?: (message: MessageVM) => void;
  onReactionToggle?: (messageId: string, emoji: string) => void;
  onThreadOpen?: (message: MessageVM) => void;
};

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isOwn,
  isGroupStart,
  colors,
  onLongPress,
  onReactionToggle,
  onThreadOpen,
}) => {
  const s = useMemo(() => makeStyles(colors), [colors]);
  const type = message.core.type;
  const senderName = message.core.sender.profile.displayName;
  const avatarUrl = getAvatarUrl(message);
  const time = formatTime(message.core.createdAt);
  const reactions = message.social?.reactions ?? [];
  const threadParentId = (message as { threadParentId?: string }).threadParentId;
  const nameColor = isOwn ? colors.teal : senderColor(senderName);

  // ── session-complete: full-width centred divider ──
  if (type === 'session-complete') {
    return <SessionCompleteBar message={message as SessionCompleteMessageVM} colors={colors} s={s} />;
  }

  const renderContent = () => {
    if (CARD_TYPES.has(type)) {
      return (
        <>
          {type === 'lesson-assignment'   && <AssignmentCard message={message as LessonAssignmentMessageVM} colors={colors} s={s} />}
          {type === 'session-summary'     && <SessionSummaryCard message={message as SessionSummaryMessageVM} colors={colors} s={s} />}
          {type === 'progress-update'     && <ProgressCard message={message as ProgressUpdateMessageVM} colors={colors} s={s} />}
          {type === 'event-reminder'      && <EventCard message={message as EventReminderMessageVM} colors={colors} s={s} />}
          {type === 'homework-submission' && <HomeworkCard message={message as HomeworkSubmissionMessageVM} colors={colors} s={s} />}
        </>
      );
    }
    if (type === 'file') {
      const fm = message as FileMessageVM;
      return (
        <View style={s.fileWrap}>
          {!!fm.content?.text && (
            <Text style={[s.textContent, { marginBottom: 8 }]}>{fm.content.text}</Text>
          )}
          <TouchableOpacity
            style={s.fileRow}
            onPress={() => Linking.openURL(fm.attachment.url).catch(() => null)}
          >
            <View style={s.fileIcon}><Text style={{ fontSize: 18 }}>📎</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }} numberOfLines={1}>{fm.attachment.name}</Text>
              <Text style={{ fontSize: 11, marginTop: 2, color: colors.textFaint }}>{formatFileSize(fm.attachment.size)}</Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    }
    if (type === 'audio-recording') {
      const am = message as AudioRecordingMessageVM;
      const mins = Math.floor(am.audio.durationSeconds / 60);
      const secs = am.audio.durationSeconds % 60;
      const duration = `${mins}:${String(secs).padStart(2, '0')}`;
      const waveform = am.audio.waveform ?? [0.3, 0.5, 0.4, 0.7, 0.6, 0.5, 0.4, 0.8, 0.5, 0.3];
      return (
        <View style={s.audioWrap}>
          <View style={[s.playBtn, { backgroundColor: colors.teal }]}>
            <Text style={{ color: colors.tealFg, fontSize: 12, fontWeight: '700' }}>▶</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, height: 24 }}>
              {waveform.map((v, i) => (
                <View key={i} style={{ width: 3, height: Math.max(4, v * 24), backgroundColor: colors.teal, borderRadius: 2 }} />
              ))}
            </View>
            <Text style={{ color: colors.textFaint, fontSize: 11 }}>{duration}</Text>
          </View>
        </View>
      );
    }
    if (type === 'image') {
      return (
        <View style={s.imagePlaceholder}>
          <Text style={{ fontSize: 32 }}>🖼</Text>
          <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: 4 }}>Image</Text>
        </View>
      );
    }
    // Default: plain text
    const text = (message as { content?: { text?: string } }).content?.text ?? '';
    return <Text style={s.textContent}>{text}</Text>;
  };

  return (
    <Pressable
      onLongPress={() => onLongPress?.(message)}
      delayLongPress={350}
      style={[s.row, isGroupStart && s.rowGroupStart]}
    >
      {/* Left column: avatar for group start, empty spacer for continuations */}
      <View style={s.leftCol}>
        {isGroupStart && <Avatar name={senderName} src={avatarUrl} size="sm" />}
      </View>

      {/* Right column */}
      <View style={s.rightCol}>
        {isGroupStart && (
          <View style={s.nameRow}>
            <Text style={[s.senderName, { color: nameColor }]}>{senderName}</Text>
            <Text style={s.msgTime}>{time}</Text>
          </View>
        )}

        {renderContent()}

        {reactions.length > 0 && (
          <ReactionRow
            reactions={reactions}
            colors={colors}
            messageId={message.ids.id}
            onReactionToggle={onReactionToggle}
          />
        )}

        {!threadParentId && onThreadOpen && (
          <ThreadIndicator colors={colors} onPress={() => onThreadOpen(message)} />
        )}
      </View>
    </Pressable>
  );
};
