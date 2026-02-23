import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Pressable, Linking, ActivityIndicator } from 'react-native';
import type {
  MessageVM,
  ThreadVM,
  LessonAssignmentMessageVM,
  SessionSummaryMessageVM,
  SessionCompleteMessageVM,
  ProgressUpdateMessageVM,
  EventReminderMessageVM,
  HomeworkSubmissionMessageVM,
  FeedbackRequestMessageVM,
  SessionBookingMessageVM,
  PaymentReminderMessageVM,
  FileMessageVM,
  AudioRecordingMessageVM,
  ReactionVM,
} from '@iconicedu/shared-types';
import type { AppColors } from '@/lib/theme';
import { fetchThreadMessages } from '@/lib/api/queries';

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

type AvatarInfo = { url: string | null; seed: string };

function getAvatarInfo(message: MessageVM): AvatarInfo {
  const profile = message.core.sender.profile as {
    avatar?: { source?: string; url?: string | null; seed?: string | null };
  };
  const avatar = profile.avatar;
  const url = avatar?.source === 'url' ? (avatar.url ?? null) : null;
  const seed = avatar?.source === 'seed'
    ? (avatar.seed ?? message.core.sender.ids.id)
    : message.core.sender.ids.id;
  return { url, seed };
}

// ─── Inline avatar (avoids NativeWind sizing issues on Image) ─────────────────

const AVATAR_SIZE = 36;
const AVATAR_COLORS = ['#5B8DEF', '#E07B54', '#6CC070', '#A86CC1', '#E0A854', '#54B8C4', '#E06C8A'];

function avatarBgColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name[0]?.toUpperCase() ?? '?';
}

function MessageAvatar({ name, src, seed }: { name: string; src: string | null; seed: string }) {
  if (src) {
    return (
      <Image
        source={{ uri: src }}
        style={avatarStyles.img}
        accessibilityLabel={name}
      />
    );
  }
  return (
    <View style={[avatarStyles.circle, { backgroundColor: avatarBgColor(seed) }]}>
      <Text style={avatarStyles.initials}>{getInitials(name)}</Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  img:      { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  circle:   { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
});

// Deterministic color per sender name (Slack-style)
const NAME_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];
function senderColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}

type S = ReturnType<typeof makeStyles>;

// ─── Social bar: reactions + thread pill in one row ──────────────────────────

type SocialBarProps = {
  reactions: ReactionVM[];
  thread: ThreadVM | null;
  messageId: string;
  colors: AppColors;
  onReactionToggle?: (messageId: string, emoji: string) => void;
  onThreadPress?: () => void;
  threadExpanded?: boolean;
};

function SocialBar({ reactions, thread, messageId, colors, onReactionToggle, onThreadPress, threadExpanded }: SocialBarProps) {
  const hasThread = !!thread && thread.stats.messageCount > 0;
  if (!reactions.length && !hasThread) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, alignItems: 'center' }}>
      {/* Reaction pills */}
      {reactions.map((r) => (
        <TouchableOpacity
          key={r.emoji}
          onPress={() => onReactionToggle?.(messageId, r.emoji)}
          activeOpacity={0.75}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: r.reactedByMe ? colors.tealBg : colors.pageBg,
            borderWidth: 1,
            borderColor: r.reactedByMe ? colors.teal : colors.border,
            borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
          }}
        >
          <Text style={{ fontSize: 14 }}>{r.emoji}</Text>
          <Text style={{ fontSize: 12, color: r.reactedByMe ? colors.teal : colors.text, fontWeight: '600' }}>
            {r.count}
          </Text>
        </TouchableOpacity>
      ))}

      {/* Thread pill */}
      {hasThread && (
        <ThreadPill thread={thread!} colors={colors} onPress={onThreadPress ?? (() => {})} expanded={threadExpanded} />
      )}
    </View>
  );
}

// ─── Thread pill ──────────────────────────────────────────────────────────────

function ThreadPill({ thread, colors, onPress, expanded }: { thread: ThreadVM; colors: AppColors; onPress: () => void; expanded?: boolean }) {
  const count = thread.stats.messageCount;
  const participants = thread.participants.slice(0, 3);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: expanded ? colors.tealBg : colors.pageBg,
        borderWidth: 1, borderColor: expanded ? colors.teal : colors.border,
        borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
      }}
    >
      {/* Chat bubble icon */}
      <Text style={{ fontSize: 13, color: expanded ? colors.teal : colors.textMuted }}>💬</Text>

      {/* Reply count */}
      <Text style={{ fontSize: 12, color: expanded ? colors.teal : colors.textMuted, fontWeight: '600' }}>
        {count} {count === 1 ? 'reply' : 'replies'}
      </Text>

      {/* Overlapping participant initials/avatars */}
      {participants.length > 0 && (
        <View style={{ flexDirection: 'row', marginLeft: 2 }}>
          {participants.map((p, i) => {
            const name = p.profile.displayName;
            const avatarProfile = p.profile as { avatar?: { source?: string; url?: string | null; seed?: string | null } };
            const src = avatarProfile.avatar?.source === 'url' ? (avatarProfile.avatar.url ?? null) : null;
            const seed = avatarProfile.avatar?.source === 'seed'
              ? (avatarProfile.avatar.seed ?? p.ids.id)
              : p.ids.id;
            return src ? (
              <Image
                key={p.ids.id}
                source={{ uri: src }}
                style={{
                  width: 20, height: 20, borderRadius: 10,
                  borderWidth: 1.5, borderColor: colors.pageBg,
                  marginLeft: i > 0 ? -6 : 0,
                  zIndex: participants.length - i,
                }}
              />
            ) : (
              <View
                key={p.ids.id}
                style={{
                  width: 20, height: 20, borderRadius: 10,
                  backgroundColor: avatarBgColor(seed),
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1.5, borderColor: colors.pageBg,
                  marginLeft: i > 0 ? -6 : 0,
                  zIndex: participants.length - i,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>
                  {getInitials(name)[0]}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Inline thread reply (compact) ────────────────────────────────────────────

function InlineReply({ message, colors }: { message: MessageVM; colors: AppColors }) {
  const senderName = message.core.sender.profile.displayName;
  const time = formatTime(message.core.createdAt);
  const { url: src, seed } = getAvatarInfo(message);
  const text = (message as { content?: { text?: string } }).content?.text ?? '';

  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
      {src ? (
        <Image source={{ uri: src }} style={{ width: 28, height: 28, borderRadius: 14 }} accessibilityLabel={senderName} />
      ) : (
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: avatarBgColor(seed), alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{getInitials(senderName)}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'baseline', marginBottom: 2 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: senderColor(senderName) }}>{senderName}</Text>
          <Text style={{ fontSize: 11, color: colors.textFaint }}>{time}</Text>
        </View>
        <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>{text}</Text>
      </View>
    </View>
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

function FeedbackRequestCard({ message, colors, s }: { message: FeedbackRequestMessageVM; colors: AppColors; s: S }) {
  const prompt = message.feedback?.prompt ?? message.content?.text ?? '';
  const rating = message.feedback?.rating;
  const comment = message.feedback?.comment;
  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <CardHeader emoji="💬" label="Feedback Request" tag={message.feedback?.sessionTitle ?? undefined} colors={colors} s={s} />
      {!!prompt && <Text style={[s.cardDesc, { color: colors.textMuted }]}>{prompt}</Text>}
      {rating !== null && rating !== undefined && (
        <Text style={[s.metaChip, { color: colors.textMuted, marginTop: 4 }]}>
          {'★'.repeat(rating)}{'☆'.repeat(Math.max(0, 5 - rating))} {rating}/5
        </Text>
      )}
      {!!comment && <Text style={[s.cardDesc, { color: colors.textMuted, marginTop: 4 }]}>{comment}</Text>}
    </View>
  );
}

function SessionBookingCard({ message, colors, s }: { message: SessionBookingMessageVM; colors: AppColors; s: S }) {
  const { session } = message;
  const statusColor = { scheduled: colors.textMuted, confirmed: '#22c55e', cancelled: '#ef4444', completed: colors.teal }[session.status] ?? colors.textMuted;
  const statusLabel = { scheduled: '📅 Scheduled', confirmed: '✓ Confirmed', cancelled: '✗ Cancelled', completed: '✓ Completed' }[session.status];
  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <CardHeader emoji="🗓" label="Session Booked" tag={session.subject} colors={colors} s={s} />
      <Text style={[s.cardTitle, { color: colors.text }]}>{session.title}</Text>
      <Text style={[s.metaChip, { color: colors.textMuted }]}>
        {formatDate(session.startAt)} · {formatTime(session.startAt)}
        {session.durationMinutes ? ` · ${session.durationMinutes} min` : ''}
      </Text>
      <View style={[s.statusBadge, { backgroundColor: statusColor + '22' }]}>
        <Text style={{ color: statusColor, fontWeight: '600', fontSize: 12 }}>{statusLabel}</Text>
      </View>
      {!!session.meetingLink && (
        <TouchableOpacity
          style={[s.joinBtn, { backgroundColor: colors.teal }]}
          onPress={() => Linking.openURL(session.meetingLink!).catch(() => null)}
        >
          <Text style={{ color: colors.tealFg, fontWeight: '700', fontSize: 13 }}>Join Meeting</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function PaymentReminderCard({ message, colors, s }: { message: PaymentReminderMessageVM; colors: AppColors; s: S }) {
  const { payment } = message;
  const statusColor = { pending: '#f59e0b', paid: '#22c55e', overdue: '#ef4444' }[payment.status] ?? colors.textMuted;
  const statusLabel = { pending: '⏳ Pending', paid: '✓ Paid', overdue: '⚠ Overdue' }[payment.status];
  return (
    <View style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <CardHeader emoji="💳" label="Payment Reminder" colors={colors} s={s} />
      <Text style={[s.cardTitle, { color: colors.text }]}>
        {payment.currency} {payment.amount.toLocaleString()}
      </Text>
      <View style={[s.statusBadge, { backgroundColor: statusColor + '22' }]}>
        <Text style={{ color: statusColor, fontWeight: '600', fontSize: 12 }}>{statusLabel}</Text>
      </View>
      <Text style={[s.metaChip, { color: colors.textMuted, marginTop: 6 }]}>Due {formatDate(payment.dueAt)}</Text>
      {!!payment.description && <Text style={[s.cardDesc, { color: colors.textMuted }]}>{payment.description}</Text>}
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
    // ── Outer row: avatar + content, aligned to top ──────────────────────────
    row:          { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingVertical: 3, gap: 8 },
    rowOwn:       { flexDirection: 'row-reverse' },
    rowGroupStart: { paddingTop: 12 },

    // ── Avatar slot (always 36px to reserve space) ───────────────────────────
    avatarSlot:   { width: 36, flexShrink: 0, alignItems: 'center' },

    // ── Content column ────────────────────────────────────────────────────────
    contentCol:    { flex: 1, alignItems: 'flex-start', gap: 4 },
    contentColOwn: { alignItems: 'flex-end' },

    // ── Name + time row (inside bubble) ──────────────────────────────────────
    nameRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 2 },
    senderName: { fontSize: 14, fontWeight: '700' },
    msgTime:    { fontSize: 11, color: colors.textFaint },

    // ── Message bubble ────────────────────────────────────────────────────────
    bubble: {
      maxWidth: '85%',
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    bubbleOther: {
      backgroundColor: colors.card,
    },
    bubbleOwn: {
      backgroundColor: colors.teal,
    },

    // ── Text inside bubble ────────────────────────────────────────────────────
    textContent:    { fontSize: 15, lineHeight: 22, color: colors.text },
    textContentOwn: { color: '#fff' },

    // ── File attachment (inside bubble for others, inverted for own) ──────────
    fileWrap: { gap: 8 },
    fileRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
    fileIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.tealBg, alignItems: 'center', justifyContent: 'center' },

    // ── Audio player ──────────────────────────────────────────────────────────
    audioRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
    playBtn:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

    // ── Image placeholder ─────────────────────────────────────────────────────
    imagePlaceholder: { width: 200, height: 150, borderRadius: 10, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },

    // ── Structured cards (self-contained, no outer bubble) ────────────────────
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
    attachRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 8, marginTop: 8 },
    attachName:      { flex: 1, fontSize: 12, fontWeight: '500' },
    joinBtn:         { borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
    statusBadge:     { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 4 },
    progressTrack:   { height: 8, borderRadius: 4, overflow: 'hidden' },
    progressFill:    { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
    improvementBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 4 },

    // ── Session complete divider ───────────────────────────────────────────────
    sessionCompleteRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 10 },
    sessionCompleteLine:   { flex: 1, height: 1 },
    sessionCompleteCenter: { alignItems: 'center', gap: 4 },
    sessionCompleteIcon:   { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    sessionCompleteTitle:  { fontSize: 12, fontWeight: '600', textAlign: 'center', maxWidth: 160 },

    // ── Inline thread expansion ────────────────────────────────────────────────
    inlineThread:    { flexDirection: 'row', marginTop: 6 },
    // For own (right-aligned) messages: push thread to the right half so it
    // sits beneath the bubble rather than spanning the full content column.
    inlineThreadOwn: { alignSelf: 'stretch', marginLeft: '25%' },
    threadLine:      { width: 2, borderRadius: 1, alignSelf: 'stretch', marginLeft: 2, marginRight: 8 },
    inlineReplies:   { flex: 1 },
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
  currentProfileId?: string;
  currentAccountId?: string;
};

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isOwn,
  isGroupStart,
  colors,
  onLongPress,
  onReactionToggle,
  onThreadOpen,
  currentProfileId,
  currentAccountId,
}) => {
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [threadExpanded, setThreadExpanded] = useState(false);
  const [threadReplies, setThreadReplies] = useState<MessageVM[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const type = message.core.type;
  const senderDisplayName = message.core.sender.profile.displayName;
  const { url: avatarUrl, seed: avatarSeed } = getAvatarInfo(message);
  const time = formatTime(message.core.createdAt);
  const reactions = message.social?.reactions ?? [];
  const thread = message.social?.thread ?? null;
  const isCard = CARD_TYPES.has(type);

  const handleThreadPress = useCallback(async () => {
    if (!thread) return;
    const next = !threadExpanded;
    setThreadExpanded(next);
    if (next && threadReplies.length === 0) {
      setThreadLoading(true);
      try {
        const replies = await fetchThreadMessages(
          thread.ids.id,
          message.ids.id,
          currentProfileId ?? '',
          currentAccountId ?? '',
        );
        setThreadReplies(replies);
      } catch (err) {
        console.warn('[MessageItem] fetchThreadMessages error:', err);
      } finally {
        setThreadLoading(false);
      }
    }
  }, [thread, threadExpanded, threadReplies.length, message.ids.id, currentProfileId, currentAccountId]);

  // session-complete: full-width centred divider, no bubble
  if (type === 'session-complete') {
    return <SessionCompleteBar message={message as SessionCompleteMessageVM} colors={colors} s={s} />;
  }

  // ── Content inside bubble (or card) ──────────────────────────────────────

  const renderBubbleContent = () => {
    if (type === 'file') {
      const fm = message as FileMessageVM;
      return (
        <View style={s.fileWrap}>
          {!!fm.content?.text && (
            <Text style={[s.textContent, isOwn && s.textContentOwn, { marginBottom: 6 }]}>
              {fm.content.text}
            </Text>
          )}
          <TouchableOpacity
            style={s.fileRow}
            onPress={() => Linking.openURL(fm.attachment.url).catch(() => null)}
          >
            <View style={s.fileIcon}><Text style={{ fontSize: 18 }}>📎</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: isOwn ? '#fff' : colors.text }} numberOfLines={1}>
                {fm.attachment.name}
              </Text>
              <Text style={{ fontSize: 11, marginTop: 2, color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textFaint }}>
                {formatFileSize(fm.attachment.size)}
              </Text>
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
      const waveColor = isOwn ? 'rgba(255,255,255,0.8)' : colors.teal;
      return (
        <View style={s.audioRow}>
          <View style={[s.playBtn, { backgroundColor: isOwn ? 'rgba(255,255,255,0.25)' : colors.teal }]}>
            <Text style={{ color: isOwn ? '#fff' : colors.tealFg, fontSize: 12, fontWeight: '700' }}>▶</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, height: 24 }}>
              {waveform.map((v, i) => (
                <View key={i} style={{ width: 3, height: Math.max(4, v * 24), backgroundColor: waveColor, borderRadius: 2 }} />
              ))}
            </View>
            <Text style={{ color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textFaint, fontSize: 11 }}>{duration}</Text>
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
    return <Text style={[s.textContent, isOwn && s.textContentOwn]}>{text}</Text>;
  };

  // ── Card messages (lesson-assignment, session-summary, etc.) ──────────────
  // Cards manage their own visual styling; we just align them correctly.

  if (isCard) {
    return (
      <Pressable
        onLongPress={() => onLongPress?.(message)}
        delayLongPress={350}
        style={[s.row, isOwn && s.rowOwn, isGroupStart && s.rowGroupStart]}
      >
        <View style={s.avatarSlot}>
          {isGroupStart && <MessageAvatar name={senderDisplayName} src={avatarUrl} seed={avatarSeed} />}
        </View>
        <View style={[s.contentCol, isOwn && s.contentColOwn]}>
          {isGroupStart && (
            <View style={s.nameRow}>
              {!isOwn && (
                <Text style={[s.senderName, { color: senderColor(senderDisplayName) }]}>
                  {senderDisplayName}
                </Text>
              )}
              <Text style={s.msgTime}>{time}</Text>
            </View>
          )}
          {type === 'lesson-assignment'   && <AssignmentCard message={message as LessonAssignmentMessageVM} colors={colors} s={s} />}
          {type === 'session-summary'     && <SessionSummaryCard message={message as SessionSummaryMessageVM} colors={colors} s={s} />}
          {type === 'progress-update'     && <ProgressCard message={message as ProgressUpdateMessageVM} colors={colors} s={s} />}
          {type === 'event-reminder'      && <EventCard message={message as EventReminderMessageVM} colors={colors} s={s} />}
          {type === 'homework-submission' && <HomeworkCard message={message as HomeworkSubmissionMessageVM} colors={colors} s={s} />}
          {type === 'feedback-request'    && <FeedbackRequestCard message={message as FeedbackRequestMessageVM} colors={colors} s={s} />}
          {type === 'session-booking'     && <SessionBookingCard message={message as SessionBookingMessageVM} colors={colors} s={s} />}
          {type === 'payment-reminder'    && <PaymentReminderCard message={message as PaymentReminderMessageVM} colors={colors} s={s} />}
          <SocialBar
            reactions={reactions}
            thread={thread}
            messageId={message.ids.id}
            colors={colors}
            onReactionToggle={onReactionToggle}
            onThreadPress={handleThreadPress}
            threadExpanded={threadExpanded}
          />
          {threadExpanded && (
            <View style={[s.inlineThread, isOwn && s.inlineThreadOwn]}>
              <View style={[s.threadLine, { backgroundColor: colors.border }]} />
              <View style={s.inlineReplies}>
                {threadLoading ? (
                  <View style={{ paddingVertical: 8, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.teal} />
                  </View>
                ) : threadReplies.map((reply) => (
                  <InlineReply key={reply.ids.id} message={reply} colors={colors} />
                ))}
              </View>
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  // ── Bubble messages (text, file, audio, image) ────────────────────────────

  return (
    <Pressable
      onLongPress={() => onLongPress?.(message)}
      delayLongPress={350}
      style={[s.row, isOwn && s.rowOwn, isGroupStart && s.rowGroupStart]}
    >
      {/* Avatar slot */}
      <View style={s.avatarSlot}>
        {isGroupStart && <MessageAvatar name={senderDisplayName} src={avatarUrl} seed={avatarSeed} />}
      </View>

      {/* Content column */}
      <View style={[s.contentCol, isOwn && s.contentColOwn]}>
        {/* Name + time above bubble */}
        {isGroupStart && (
          <View style={s.nameRow}>
            {!isOwn && (
              <Text style={[s.senderName, { color: senderColor(senderDisplayName) }]}>
                {senderDisplayName}
              </Text>
            )}
            <Text style={s.msgTime}>{time}</Text>
          </View>
        )}
        {/* Bubble */}
        <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
          {renderBubbleContent()}
        </View>

        {/* Reactions + thread pill in one row */}
        <SocialBar
          reactions={reactions}
          thread={thread}
          messageId={message.ids.id}
          colors={colors}
          onReactionToggle={onReactionToggle}
          onThreadPress={handleThreadPress}
          threadExpanded={threadExpanded}
        />

        {/* Inline thread replies */}
        {threadExpanded && (
          <View style={[s.inlineThread, isOwn && s.inlineThreadOwn]}>
            <View style={[s.threadLine, { backgroundColor: colors.border }]} />
            <View style={s.inlineReplies}>
              {threadLoading ? (
                <View style={{ paddingVertical: 8, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.teal} />
                </View>
              ) : threadReplies.map((reply) => (
                <InlineReply key={reply.ids.id} message={reply} colors={colors} />
              ))}
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
};
