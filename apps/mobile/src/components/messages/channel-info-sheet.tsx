import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Animated,
  PanResponder,
  Dimensions,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FileText,
  CalendarDays,
  Bookmark,
  Users,
  ChevronRight,
  Image as ImageIcon,
  Mic,
  Download,
  File,
  ChevronDown,
  Video,
  Clock3,
  CalendarPlus,
  CheckCircle2,
} from 'lucide-react-native';
import { useTheme } from '@/providers/theme-provider';
import type { AppColors } from '@/lib/theme';
import type {
  MessageVM,
  ImageMessageVM,
  FileMessageVM,
  AudioRecordingMessageVM,
  TextMessageVM,
  UserProfileVM,
  ClassScheduleVM,
} from '@iconicedu/shared-types';

// ─── Screen dimensions ─────────────────────────────────────────────────────────

const SCREEN_HEIGHT = Dimensions.get('window').height;
const PARTIAL_HEIGHT = SCREEN_HEIGHT * 0.58;

// ─── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#5B8DEF', '#E07B54', '#6CC070', '#A86CC1', '#E0A854', '#54B8C4', '#E06C8A'];

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name[0]?.toUpperCase() ?? '?';
}

// ─── Sender name helper ────────────────────────────────────────────────────────

function getSenderName(sender: UserProfileVM): string {
  return sender.profile.displayName?.trim() || sender.profile.firstName?.trim() || 'Unknown';
}

// ─── Data extraction helpers ───────────────────────────────────────────────────

type FileItem = {
  id: string;
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
  durationSeconds?: number;
  createdAt: string;
  kind: 'image' | 'file' | 'audio';
};

function extractFiles(messages: MessageVM[]): FileItem[] {
  const items: FileItem[] = [];
  for (const msg of messages) {
    if (msg.core.type === 'image') {
      const m = msg as ImageMessageVM;
      const allAttachments = m.attachments ?? [m.attachment];
      for (const att of allAttachments) {
        items.push({
          id: `${msg.ids.id}-${att.name}`,
          name: att.name,
          url: att.url,
          kind: 'image',
          createdAt: msg.core.createdAt,
        });
      }
    } else if (msg.core.type === 'file') {
      const m = msg as FileMessageVM;
      const allAttachments = m.attachments ?? [m.attachment];
      for (const att of allAttachments) {
        items.push({
          id: `${msg.ids.id}-${att.name}`,
          name: att.name,
          url: att.url,
          mimeType: att.mimeType,
          size: att.size,
          kind: 'file',
          createdAt: msg.core.createdAt,
        });
      }
    } else if (msg.core.type === 'audio-recording') {
      const m = msg as AudioRecordingMessageVM;
      items.push({
        id: msg.ids.id,
        name: 'Voice message',
        url: m.audio.url,
        mimeType: m.audio.mimeType,
        size: m.audio.fileSize,
        durationSeconds: m.audio.durationSeconds,
        kind: 'audio',
        createdAt: msg.core.createdAt,
      });
    }
  }
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function getMessagePreview(msg: MessageVM): string {
  switch (msg.core.type) {
    case 'text': return (msg as TextMessageVM).content.text.slice(0, 120);
    case 'image': return '📷 Photo';
    case 'file': return `📎 ${(msg as FileMessageVM).attachment.name}`;
    case 'audio-recording': return '🎤 Voice message';
    default: return 'Message';
  }
}

function extractSaved(messages: MessageVM[]): Array<{ id: string; senderName: string; preview: string; createdAt: string }> {
  return messages
    .filter((m) => m.state?.isSaved)
    .map((m) => ({
      id: m.ids.id,
      senderName: getSenderName(m.core.sender),
      preview: getMessagePreview(m),
      createdAt: m.core.createdAt,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function extractMembers(
  messages: MessageVM[],
  extraMembers?: Array<{ id: string; name: string; avatarSeed?: string | null }> | null,
): Array<{ id: string; name: string; seed: string }> {
  const map = new Map<string, { id: string; name: string; seed: string }>();
  for (const msg of messages) {
    const s = msg.core.sender;
    if (!map.has(s.ids.id)) {
      const name = getSenderName(s);
      map.set(s.ids.id, { id: s.ids.id, name, seed: name });
    }
  }
  if (extraMembers) {
    for (const m of extraMembers) {
      if (!map.has(m.id)) {
        map.set(m.id, { id: m.id, name: m.name, seed: m.avatarSeed ?? m.name });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Sessions helpers ──────────────────────────────────────────────────────────

type SessionSubTab = 'upcoming' | 'past';

// ── Types matching web ─────────────────────────────────────────────────────────

type ClassSession = {
  id: string;
  label: string;
  time: string;
  dayName: string;
  dayNum: string;
  isToday: boolean;
  isPast: boolean;
  status: ClassScheduleVM['status'];
  meetingLink?: string | null;
  variant: 'default' | 'exception' | 'override';
  disabled: boolean;
  reason?: string | null;
  originalTime?: string | null;
  originalDate?: string | null;
  startAt: string;
  endAt: string;
};

type MonthGroup = {
  monthKey: string;
  month: string;
  year: string;
  totalCount: number;
  completedCount: number;
  isCurrentMonth: boolean;
  sessions: ClassSession[];
};

// ── Internal display type with uiState ────────────────────────────────────────

type DisplaySchedule = ClassScheduleVM & {
  uiState?: {
    kind: 'default' | 'exception' | 'override';
    disabled?: boolean;
    reason?: string | null;
    originalStartAt?: string;
    originalEndAt?: string;
  };
};

// ── Recurring expansion helpers ────────────────────────────────────────────────

const weekdayTokens: Record<number, string> = {
  0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA',
};

function startOfDay2(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays2(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function occurrenceDayKey(iso: string): string {
  return iso.slice(0, 10);
}

function expandRecurringSchedules(
  schedules: ClassScheduleVM[],
  rangeStart: Date,
  rangeEnd: Date,
): DisplaySchedule[] {
  const expanded: DisplaySchedule[] = [];
  const rangeStartDay = startOfDay2(rangeStart);
  const rangeEndDay = startOfDay2(rangeEnd);

  for (const event of schedules) {
    if (!event.recurrence) {
      const eventDay = startOfDay2(new Date(event.startAt));
      if (eventDay >= rangeStartDay && eventDay <= rangeEndDay) {
        expanded.push({ ...event, uiState: { kind: 'default' } });
      }
      continue;
    }

    const recurrence = event.recurrence;
    const rule = recurrence.rule;
    const interval = rule.interval ?? 1;
    const baseStart = new Date(event.startAt);
    const baseDate = startOfDay2(baseStart);
    const durationMs = new Date(event.endAt).getTime() - baseStart.getTime();

    const exceptions = new Set(
      recurrence.exceptions?.map((e) => e.occurrenceKey) ?? [],
    );
    const exceptionsByDay = new Set(
      recurrence.exceptions?.map((e) => occurrenceDayKey(e.occurrenceKey)) ?? [],
    );
    const overrides = new Map(
      recurrence.overrides?.map((o) => [o.occurrenceKey, o.patch]) ?? [],
    );
    const overridesByDay = new Map(
      recurrence.overrides?.map((o) => [occurrenceDayKey(o.occurrenceKey), o.patch]) ?? [],
    );

    const byWeekday = rule.byWeekday?.length
      ? rule.byWeekday
      : [weekdayTokens[baseDate.getDay()]!];

    // Add exception (skipped) occurrences
    for (const exc of recurrence.exceptions ?? []) {
      const excDayKey = occurrenceDayKey(exc.occurrenceKey);
      if (overrides.has(exc.occurrenceKey) || overridesByDay.has(excDayKey)) continue;
      const originalStart = new Date(exc.occurrenceKey);
      const originalEnd = new Date(originalStart.getTime() + durationMs);
      expanded.push({
        ...event,
        ids: { ...event.ids, id: `${event.ids.id}__${exc.occurrenceKey}__exception` },
        startAt: originalStart.toISOString(),
        endAt: originalEnd.toISOString(),
        status: 'cancelled',
        meetingLink: null,
        recurrence: undefined,
        uiState: {
          kind: 'exception',
          disabled: true,
          reason: exc.reason ?? null,
          originalStartAt: originalStart.toISOString(),
          originalEndAt: originalEnd.toISOString(),
        },
      });
    }

    // Iterate over date range to generate occurrences
    const until = rule.until ? startOfDay2(new Date(rule.until)) : null;
    let occurrenceCount = 0;

    for (
      let current = new Date(baseDate);
      current <= rangeEndDay;
      current = addDays2(current, 1)
    ) {
      if (current < rangeStartDay) continue;
      if (until && current > until) break;

      const diffDays = (current.getTime() - baseDate.getTime()) / 86400000;
      let matches = false;
      if (rule.frequency === 'daily') {
        matches = diffDays % interval === 0;
      } else if (rule.frequency === 'weekly') {
        const weeksDiff = Math.floor(diffDays / 7);
        matches =
          weeksDiff % interval === 0 &&
          byWeekday.includes(weekdayTokens[current.getDay()]!);
      }

      const occurrenceStart = new Date(current);
      occurrenceStart.setHours(
        baseStart.getHours(),
        baseStart.getMinutes(),
        baseStart.getSeconds(),
        baseStart.getMilliseconds(),
      );
      const occurrenceKey = occurrenceStart.toISOString();
      const occDayKey = occurrenceDayKey(occurrenceKey);
      const override = overrides.get(occurrenceKey) ?? overridesByDay.get(occDayKey);
      const hasOverride = Boolean(override);

      if (!matches && !hasOverride) continue;
      if ((exceptions.has(occurrenceKey) || exceptionsByDay.has(occDayKey)) && !hasOverride) continue;
      if (rule.count && occurrenceCount >= rule.count) break;

      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
      const effectiveStart = override?.startAt ? new Date(override.startAt) : occurrenceStart;
      const effectiveEnd = override?.endAt ? new Date(override.endAt) : occurrenceEnd;

      expanded.push({
        ...event,
        ...override,
        ids: { ...event.ids, id: `${event.ids.id}__${occurrenceKey}` },
        startAt: effectiveStart.toISOString(),
        endAt: effectiveEnd.toISOString(),
        status: override?.status ?? event.status,
        recurrence: undefined,
        uiState: override
          ? {
              kind: 'override',
              originalStartAt: occurrenceKey,
              originalEndAt: occurrenceEnd.toISOString(),
            }
          : { kind: 'default' },
      });

      occurrenceCount++;
    }
  }

  // Deduplicate: higher priority wins per base-id + day
  const deduped = new Map<string, DisplaySchedule>();
  for (const s of expanded) {
    const baseId = s.ids.id.includes('__')
      ? s.ids.id.slice(0, s.ids.id.indexOf('__'))
      : s.ids.id;
    const key = `${baseId}|${s.startAt.slice(0, 10)}`;
    const existing = deduped.get(key);
    const priority = (ds: DisplaySchedule) =>
      ds.uiState?.kind === 'exception' ? 3 : ds.uiState?.kind === 'override' ? 2 : 1;
    if (!existing || priority(s) > priority(existing)) {
      deduped.set(key, s);
    }
  }

  return Array.from(deduped.values());
}

// ── Format helpers (matching web) ─────────────────────────────────────────────

function formatScheduleWeekTitle(startAt: string): string {
  const start = new Date(startAt);
  const weekNumber = Math.min(5, Math.floor((start.getDate() - 1) / 7) + 1);
  const month = start.toLocaleDateString('en-US', { month: 'short' });
  return `${month} · Week ${weekNumber}`;
}

function formatScheduleTimeBadge(startAt: string): string {
  return new Date(startAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatOriginalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatOriginalDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function createGoogleCalendarUrl(session: ClassSession): string {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: session.label,
    dates: `${fmt(session.startAt)}/${fmt(session.endAt)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ── splitAndGroupSessions ─────────────────────────────────────────────────────

function splitAndGroupSessions(schedules: ClassScheduleVM[]): {
  upcoming: MonthGroup[];
  past: MonthGroup[];
} {
  const now = new Date();
  const nowMs = now.getTime();
  const nowDay = startOfDay2(now).getTime();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const rangeStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const rangeEnd = new Date(now.getFullYear() + 2, now.getMonth(), 0);

  const expanded = expandRecurringSchedules(schedules, rangeStart, rangeEnd);

  const upcoming: DisplaySchedule[] = [];
  const past: DisplaySchedule[] = [];

  for (const s of expanded) {
    if (new Date(s.startAt).getTime() >= nowMs) upcoming.push(s);
    else past.push(s);
  }

  upcoming.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  past.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

  function groupByMonth(displaySchedules: DisplaySchedule[]): MonthGroup[] {
    const map = new Map<string, DisplaySchedule[]>();
    for (const s of displaySchedules) {
      const d = new Date(s.startAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()].map(([key, list]) => {
      const [y, m] = key.split('-').map(Number);
      const monthDate = new Date(y!, m! - 1, 1);
      const sessions: ClassSession[] = list.map((s) => {
        const start = new Date(s.startAt);
        const startDay = startOfDay2(start).getTime();
        const isPast = start.getTime() < nowMs;
        return {
          id: s.ids.id,
          label: formatScheduleWeekTitle(s.startAt),
          time: formatScheduleTimeBadge(s.startAt),
          dayName: start.toLocaleDateString('en-US', { weekday: 'short' }),
          dayNum: String(start.getDate()),
          isToday: startDay === nowDay,
          isPast,
          status: s.status,
          meetingLink: s.meetingLink ?? null,
          variant: s.uiState?.kind ?? 'default',
          disabled: s.uiState?.disabled ?? false,
          reason: s.uiState?.reason ?? null,
          originalTime: s.uiState?.originalStartAt
            ? formatOriginalTime(s.uiState.originalStartAt)
            : null,
          originalDate: s.uiState?.originalStartAt
            ? formatOriginalDate(s.uiState.originalStartAt)
            : null,
          startAt: s.startAt,
          endAt: s.endAt,
        };
      });
      return {
        monthKey: key,
        month: monthDate.toLocaleDateString('en-US', { month: 'long' }),
        year: String(y),
        totalCount: sessions.length,
        completedCount: sessions.filter((s) => s.status === 'completed').length,
        isCurrentMonth: key === currentMonthKey,
        sessions,
      };
    });
  }

  return { upcoming: groupByMonth(upcoming), past: groupByMonth(past) };
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type ChannelTab = 'files' | 'sessions' | 'saved' | 'members';

export type ChannelInfoSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string | null;
  kind: 'dm' | 'channel' | 'space';
  avatarSeed?: string | null;
  iconEmoji?: string | null;
  memberCount?: number | null;
  description?: string | null;
  members?: Array<{ id: string; name: string; avatarSeed?: string | null }> | null;
  messages?: MessageVM[];
  schedules?: ClassScheduleVM[];
  isLoadingSessions?: boolean;
  sessionsError?: string | null;
  onClose: () => void;
};

// ─── Tab definitions ───────────────────────────────────────────────────────────

const TABS: Array<{ key: ChannelTab; label: string }> = [
  { key: 'files',    label: 'Files' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'saved',    label: 'Saved' },
  { key: 'members',  label: 'Members' },
];

// ─── Tab icon renderer ─────────────────────────────────────────────────────────

function TabIcon({ tabKey, color }: { tabKey: ChannelTab; color: string }) {
  const size = 16;
  if (tabKey === 'files')    return <FileText    size={size} color={color} />;
  if (tabKey === 'sessions') return <CalendarDays size={size} color={color} />;
  if (tabKey === 'saved')    return <Bookmark    size={size} color={color} />;
  return <Users size={size} color={color} />;
}

// ─── File item row ─────────────────────────────────────────────────────────────

function FileItemRow({ item, colors, s }: { item: FileItem; colors: AppColors; s: ReturnType<typeof makeStyles> }) {
  const isImage = item.kind === 'image';
  const isAudio = item.kind === 'audio';

  const iconBg = isImage ? colors.tealBg : isAudio ? '#F0E8FF' : colors.card;
  const iconColor = isImage ? colors.teal : isAudio ? '#9333ea' : colors.text;

  const meta: string[] = [];
  if (item.mimeType) meta.push(item.mimeType.split('/').pop() ?? item.mimeType);
  if (item.size) meta.push(formatFileSize(item.size));
  if (item.durationSeconds) meta.push(`${item.durationSeconds}s`);
  meta.push(formatRelativeDate(item.createdAt));

  return (
    <View style={s.fileItem}>
      <View style={[s.fileIconBox, { backgroundColor: iconBg }]}>
        {isImage ? (
          <ImageIcon size={20} color={iconColor} />
        ) : isAudio ? (
          <Mic size={20} color={iconColor} />
        ) : (
          <File size={20} color={iconColor} />
        )}
      </View>
      <View style={s.fileInfo}>
        <Text style={s.fileName} numberOfLines={1}>{item.name}</Text>
        <Text style={s.fileMeta} numberOfLines={1}>{meta.filter(Boolean).join(' • ')}</Text>
      </View>
      <TouchableOpacity
        style={s.fileDownloadBtn}
        onPress={() => void Linking.openURL(item.url)}
        hitSlop={8}
        activeOpacity={0.7}
      >
        <Download size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Session card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  colors,
  s,
}: {
  session: ClassSession;
  colors: AppColors;
  s: ReturnType<typeof makeStyles>;
}) {
  const isLive = session.isToday && !session.isPast;
  const { isPast } = session;
  const isDisabled = session.disabled;

  const badgeBg = isDisabled
    ? colors.inputBg
    : isLive
      ? colors.teal
      : isPast
        ? colors.inputBg
        : colors.card;
  const badgeTxt = isLive ? '#fff' : isPast || isDisabled ? colors.textMuted : colors.text;

  const cardExtra = isLive ? s.sessionCardLive : isPast ? s.sessionCardPast : null;

  return (
    <View style={[s.sessionCard, cardExtra]}>
      {/* Day badge */}
      <View style={[s.sessionDayBadge, { backgroundColor: badgeBg }]}>
        {isLive && <Text style={[s.sessionDayExtra, { color: '#fff' }]}>Today</Text>}
        <Text style={[s.sessionDayName, { color: badgeTxt }]}>{session.dayName}</Text>
        <Text style={[s.sessionDayNum, { color: badgeTxt }]}>{session.dayNum}</Text>
      </View>

      {/* Info */}
      <View style={s.sessionInfo}>
        <View style={s.sessionTitleRow}>
          <Text
            style={[s.sessionLabel, (isDisabled || isPast) && { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {session.label}
          </Text>
          {isLive && (
            <View style={s.liveBadge}>
              <Text style={s.liveBadgeText}>LIVE</Text>
            </View>
          )}
          {session.variant === 'exception' && (
            <View style={s.variantBadge}>
              <Text style={s.variantBadgeText}>Skipped</Text>
            </View>
          )}
          {session.variant === 'override' && (
            <View style={[s.variantBadge, s.variantBadgeOutline]}>
              <Text style={s.variantBadgeText}>Changed</Text>
            </View>
          )}
          {isPast && session.variant !== 'exception' && (
            <View style={s.variantBadge}>
              <Text style={s.variantBadgeText}>Completed</Text>
            </View>
          )}
        </View>

        <View style={s.sessionTimeRow}>
          <Clock3 size={11} color={colors.textMuted} />
          <Text style={s.sessionTimeTxt}>{session.time}</Text>
        </View>

        {session.variant === 'override' && session.originalTime && (
          <Text style={s.sessionOriginalTimeTxt}>
            Was{' '}
            {session.originalDate ? `${session.originalDate} ` : ''}
            <Text style={s.sessionOriginalTimeStrike}>{session.originalTime}</Text>
          </Text>
        )}

        {session.variant === 'exception' && session.reason && (
          <Text style={s.sessionReasonTxt}>{session.reason}</Text>
        )}
      </View>

      {/* Action buttons — row, matching web */}
      <View style={s.sessionActions}>
        {!isPast && !isDisabled ? (
          <TouchableOpacity
            style={[s.joinBtn, isLive ? s.joinBtnLive : s.joinBtnUpcoming]}
            onPress={session.meetingLink ? () => void Linking.openURL(session.meetingLink!) : undefined}
            disabled={!session.meetingLink}
            activeOpacity={0.7}
          >
            <Video size={11} color={isLive ? '#fff' : colors.teal} />
            <Text style={[s.joinBtnTxt, { color: isLive ? '#fff' : colors.teal }]}>
              {isLive ? 'Join Now' : 'Join'}
            </Text>
          </TouchableOpacity>
        ) : isDisabled ? (
          <View style={[s.joinBtn, s.joinBtnDisabled]}>
            <Video size={11} color={colors.textMuted} />
            <Text style={[s.joinBtnTxt, { color: colors.textMuted }]}>Unavailable</Text>
          </View>
        ) : (
          <TouchableOpacity style={[s.joinBtn, s.joinBtnRecording]} activeOpacity={0.7}>
            <Video size={11} color={colors.textMuted} />
            <Text style={[s.joinBtnTxt, { color: colors.textMuted }]}>Recording</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={s.calBtn}
          hitSlop={6}
          activeOpacity={0.7}
          onPress={() => void Linking.openURL(createGoogleCalendarUrl(session))}
        >
          <CalendarPlus size={14} color={colors.textMuted} />
        </TouchableOpacity>
        <ChevronRight size={15} color={colors.textFaint} />
      </View>
    </View>
  );
}

// ─── Sessions tab content ──────────────────────────────────────────────────────

function SessionsTabContent({
  schedules,
  isLoading,
  error,
  colors,
  s,
  scrollEnabled,
}: {
  schedules: ClassScheduleVM[];
  isLoading?: boolean;
  error?: string | null;
  colors: AppColors;
  s: ReturnType<typeof makeStyles>;
  scrollEnabled: boolean;
}) {
  const [activeSubTab, setActiveSubTab] = useState<SessionSubTab>('upcoming');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const { upcoming, past } = useMemo(() => splitAndGroupSessions(schedules), [schedules]);

  const toggleMonth = (key: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Auto-open current month (or first month) when sub-tab changes
  useEffect(() => {
    const groups = activeSubTab === 'upcoming' ? upcoming : past;
    const target = groups.find((g) => g.isCurrentMonth) ?? groups[0];
    setExpandedMonths(target ? new Set([target.monthKey]) : new Set());
  }, [activeSubTab, upcoming, past]);

  if (isLoading) {
    return (
      <View style={s.emptyState}>
        <ActivityIndicator size="large" color={colors.teal} />
        <Text style={s.emptySubtitle}>Loading sessions…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.emptyState}>
        <Text style={s.emptySubtitle}>{error}</Text>
      </View>
    );
  }

  const groups = activeSubTab === 'upcoming' ? upcoming : past;

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-tabs: Upcoming | Past */}
      <View style={s.subTabBar}>
        {(['upcoming', 'past'] as SessionSubTab[]).map((key) => (
          <TouchableOpacity
            key={key}
            style={[s.subTabBtn, activeSubTab === key && s.subTabBtnActive]}
            onPress={() => setActiveSubTab(key)}
            activeOpacity={0.7}
          >
            <Text style={[s.subTabLabel, activeSubTab === key && s.subTabLabelActive]}>
              {key === 'upcoming' ? 'Upcoming' : 'Past'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {groups.length === 0 ? (
        <View style={s.emptyState}>
          <CalendarDays size={40} color={colors.textMuted} style={{ opacity: 0.4 }} />
          <Text style={s.emptyTitle}>
            {activeSubTab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions yet'}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={scrollEnabled}>
          {groups.map((group) => {
            const isOpen = expandedMonths.has(group.monthKey);
            const progressPercent = group.totalCount > 0
              ? Math.round((group.completedCount / group.totalCount) * 100)
              : 0;
            const allComplete = group.completedCount === group.totalCount && group.totalCount > 0;
            return (
              <View key={group.monthKey} style={[s.monthSection, group.isCurrentMonth && s.monthSectionCurrent]}>
                {/* Month header - collapsible */}
                <TouchableOpacity
                  style={[s.monthHeader, group.isCurrentMonth && s.monthHeaderCurrent]}
                  onPress={() => toggleMonth(group.monthKey)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <View style={s.monthTitleRow}>
                      <Text style={s.monthTitle}>{group.month} {group.year}</Text>
                      {group.isCurrentMonth && (
                        <View style={s.currentMonthBadge}>
                          <Text style={s.currentMonthBadgeTxt}>Current</Text>
                        </View>
                      )}
                      {allComplete && (
                        <CheckCircle2 size={14} color={colors.teal} />
                      )}
                    </View>
                    <Text style={s.monthMeta}>
                      {group.totalCount}{' '}
                      {group.totalCount === 1 ? 'session' : 'sessions'}
                      {group.completedCount > 0 ? ` · ${group.completedCount} completed` : ''}
                    </Text>
                  </View>

                  {/* Progress bar */}
                  <View style={s.progressBarWrap}>
                    <View style={s.progressBarTrack}>
                      <View style={[s.progressBarFill, { width: `${Math.max(0, Math.min(100, progressPercent))}%` }]} />
                    </View>
                    <Text style={s.progressPct}>{progressPercent}%</Text>
                  </View>

                  <ChevronDown
                    size={18}
                    color={colors.textMuted}
                    style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {/* Session cards */}
                {isOpen &&
                  group.sessions.map((session) => (
                    <SessionCard key={session.id} session={session} colors={colors} s={s} />
                  ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Tab content ───────────────────────────────────────────────────────────────

type TabContentProps = {
  activeTab: ChannelTab;
  fileItems: FileItem[];
  savedItems: Array<{ id: string; senderName: string; preview: string; createdAt: string }>;
  memberItems: Array<{ id: string; name: string; seed: string }>;
  colors: AppColors;
  s: ReturnType<typeof makeStyles>;
  memberCount?: number | null;
  schedules: ClassScheduleVM[];
  isLoadingSessions?: boolean;
  sessionsError?: string | null;
  isFullScreen: boolean;
};

function TabContent({
  activeTab,
  fileItems,
  savedItems,
  memberItems,
  colors,
  s,
  memberCount,
  schedules,
  isLoadingSessions,
  sessionsError,
  isFullScreen,
}: TabContentProps) {
  if (activeTab === 'files') {
    if (fileItems.length === 0) {
      return (
        <View style={s.emptyState}>
          <FileText size={44} color={colors.textMuted} style={{ opacity: 0.4 }} />
          <Text style={s.emptyTitle}>No files yet</Text>
          <Text style={s.emptySubtitle}>Shared photos, files, and voice messages will appear here</Text>
        </View>
      );
    }
    return (
      <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={isFullScreen}>
        {fileItems.map((item) => (
          <FileItemRow key={item.id} item={item} colors={colors} s={s} />
        ))}
      </ScrollView>
    );
  }

  if (activeTab === 'sessions') {
    return (
      <SessionsTabContent
        schedules={schedules}
        isLoading={isLoadingSessions}
        error={sessionsError}
        colors={colors}
        s={s}
        scrollEnabled={isFullScreen}
      />
    );
  }

  if (activeTab === 'saved') {
    if (savedItems.length === 0) {
      return (
        <View style={s.emptyState}>
          <Bookmark size={44} color={colors.textMuted} style={{ opacity: 0.4 }} />
          <Text style={s.emptyTitle}>No saved messages</Text>
          <Text style={s.emptySubtitle}>Long-press any message and tap "Save" to find it here</Text>
        </View>
      );
    }
    return (
      <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={isFullScreen}>
        {savedItems.map((item) => {
          const color = avatarColor(item.senderName);
          return (
            <View key={item.id} style={s.savedItem}>
              <View style={[s.savedAvatar, { backgroundColor: color }]}>
                <Text style={s.savedAvatarTxt}>{getInitials(item.senderName)}</Text>
              </View>
              <View style={s.savedBody}>
                <View style={s.savedSenderRow}>
                  <Text style={s.savedSenderName}>{item.senderName}</Text>
                  <Text style={s.savedDate}>{formatRelativeDate(item.createdAt)}</Text>
                </View>
                <Text style={s.savedPreview} numberOfLines={2}>{item.preview}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  }

  // Members tab
  const displayCount = memberItems.length > 0 ? memberItems.length : (memberCount ?? 0);
  if (memberItems.length === 0) {
    return (
      <View style={s.emptyState}>
        <Users size={44} color={colors.textMuted} style={{ opacity: 0.4 }} />
        <Text style={s.emptyTitle}>No members yet</Text>
      </View>
    );
  }
  return (
    <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={isFullScreen}>
      <View style={s.membersHeader}>
        <Text style={s.membersCount}>
          {displayCount} member{displayCount !== 1 ? 's' : ''}
        </Text>
      </View>
      {memberItems.map((member) => (
        <View key={member.id} style={s.memberRow}>
          <View style={[s.memberAvatar, { backgroundColor: avatarColor(member.seed) }]}>
            <Text style={s.memberAvatarTxt}>{getInitials(member.name)}</Text>
          </View>
          <Text style={s.memberName}>{member.name}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(C: AppColors) {
  const hairline = StyleSheet.hairlineWidth;
  return StyleSheet.create({
    // ── Backdrop ──────────────────────────────────────────────────────────────
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },

    // ── Animated sheet ────────────────────────────────────────────────────────
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: SCREEN_HEIGHT,
      backgroundColor: C.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 16,
    },

    // ── Drag handle ───────────────────────────────────────────────────────────
    dragArea: {
      width: '100%',
      paddingVertical: 12,
      alignItems: 'center',
    },
    dragHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
    },

    // ── Header ────────────────────────────────────────────────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
    },
    headerTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '600',
      color: C.text,
    },
    closeIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Hero section (DM: large; channel/space: compact) ──────────────────────
    hero: {
      alignItems: 'center',
      paddingVertical: 20,
      paddingHorizontal: 24,
      gap: 10,
    },
    heroCompact: {
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      gap: 8,
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
    },
    avatarCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarCircleCompact: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarTxt: { color: '#fff', fontWeight: '700', fontSize: 28 },
    avatarTxtCompact: { color: '#fff', fontWeight: '700', fontSize: 22 },
    iconBox: {
      width: 72,
      height: 72,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBoxCompact: {
      width: 56,
      height: 56,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconEmojiTxt: { fontSize: 36 },
    iconEmojiTxtCompact: { fontSize: 28 },
    heroName: { fontSize: 22, fontWeight: '700', color: C.text, textAlign: 'center' },
    heroNameCompact: { fontSize: 18, fontWeight: '700', color: C.text, textAlign: 'center' },
    heroSub: { fontSize: 14, color: C.textMuted, textAlign: 'center' },

    // ── Info rows (DM only) ───────────────────────────────────────────────────
    section: {
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 12,
      backgroundColor: C.card,
      borderWidth: hairline,
      borderColor: C.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    rowSep: {
      height: hairline,
      backgroundColor: C.border,
      marginLeft: 16,
    },
    rowIcon: { fontSize: 18, width: 24, textAlign: 'center' },
    rowLabel: { flex: 1, fontSize: 14, color: C.textMuted },
    rowValue: {
      fontSize: 14,
      fontWeight: '600',
      color: C.text,
      maxWidth: 200,
      textAlign: 'right',
    },

    // ── Tab bar ───────────────────────────────────────────────────────────────
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
      backgroundColor: C.bg,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      gap: 4,
      borderBottomWidth: 2.5,
      borderBottomColor: 'transparent',
    },
    tabItemActive: {
      borderBottomColor: C.teal,
    },
    tabLabel: {
      fontSize: 11,
      color: C.textMuted,
      fontWeight: '500',
    },
    tabLabelActive: {
      color: C.teal,
    },

    // ── Empty state ───────────────────────────────────────────────────────────
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      gap: 8,
      paddingBottom: 60,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: C.text,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 13,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 19,
    },

    // ── Files tab ─────────────────────────────────────────────────────────────
    fileItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
    },
    fileIconBox: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fileInfo: {
      flex: 1,
      gap: 2,
    },
    fileName: {
      fontSize: 14,
      fontWeight: '600',
      color: C.text,
    },
    fileMeta: {
      fontSize: 12,
      color: C.textMuted,
    },
    fileDownloadBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Saved tab ─────────────────────────────────────────────────────────────
    savedItem: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
    },
    savedAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    savedAvatarTxt: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 13,
    },
    savedBody: {
      flex: 1,
    },
    savedSenderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    savedSenderName: {
      fontSize: 14,
      fontWeight: '600',
      color: C.text,
    },
    savedDate: {
      fontSize: 11,
      color: C.textMuted,
    },
    savedPreview: {
      fontSize: 13,
      color: C.textMuted,
      lineHeight: 18,
    },

    // ── Members tab ───────────────────────────────────────────────────────────
    membersHeader: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
    },
    membersCount: {
      fontSize: 13,
      fontWeight: '600',
      color: C.textMuted,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberAvatarTxt: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 15,
    },
    memberName: {
      fontSize: 15,
      color: C.text,
      flex: 1,
    },

    // ── Sessions tab ──────────────────────────────────────────────────────────
    subTabBar: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
    },
    subTabBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: C.inputBg,
    },
    subTabBtnActive: {
      backgroundColor: C.teal,
    },
    subTabLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: C.textMuted,
    },
    subTabLabelActive: {
      color: '#fff',
    },

    // Month section
    monthSection: {
      borderBottomWidth: hairline,
      borderBottomColor: C.border,
    },
    monthSectionCurrent: {
      backgroundColor: C.tealBg + '30',
    },
    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    monthHeaderCurrent: {
      backgroundColor: C.tealBg + '40',
    },
    monthTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    monthTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: C.text,
    },
    monthMeta: {
      fontSize: 12,
      color: C.textMuted,
      marginTop: 1,
    },
    currentMonthBadge: {
      backgroundColor: C.tealBg,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 99,
    },
    currentMonthBadgeTxt: {
      fontSize: 9,
      fontWeight: '700',
      color: C.teal,
    },

    // Progress bar
    progressBarWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    progressBarTrack: {
      width: 72,
      height: 5,
      backgroundColor: C.inputBg,
      borderRadius: 2.5,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: 5,
      backgroundColor: C.teal,
      borderRadius: 2.5,
    },
    progressPct: {
      fontSize: 9,
      color: C.textMuted,
      fontWeight: '500',
      minWidth: 24,
    },

    // Session card
    sessionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginHorizontal: 12,
      marginBottom: 6,
      borderRadius: 12,
      backgroundColor: C.card,
      borderWidth: hairline,
      borderColor: C.border,
    },
    sessionCardLive: {
      borderColor: C.teal,
      borderWidth: 1.5,
      backgroundColor: C.tealBg,
    },
    sessionCardPast: {
      backgroundColor: C.inputBg,
      opacity: 0.85,
    },

    // Day badge
    sessionDayBadge: {
      minWidth: 44,
      paddingHorizontal: 6,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: C.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    sessionDayExtra: {
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    sessionDayName: {
      fontSize: 10,
      fontWeight: '600',
      color: C.textMuted,
    },
    sessionDayNum: {
      fontSize: 16,
      fontWeight: '700',
      color: C.text,
      lineHeight: 20,
    },

    // Session info column
    sessionInfo: {
      flex: 1,
      gap: 3,
    },
    sessionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexWrap: 'wrap',
    },
    sessionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: C.text,
    },
    sessionTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    sessionTimeTxt: {
      fontSize: 11,
      color: C.textMuted,
    },
    sessionOriginalTimeTxt: {
      fontSize: 11,
      color: C.textMuted,
    },
    sessionOriginalTimeStrike: {
      textDecorationLine: 'line-through',
    },
    sessionReasonTxt: {
      fontSize: 11,
      color: C.textMuted,
      fontStyle: 'italic',
    },

    // LIVE badge
    liveBadge: {
      backgroundColor: C.teal,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    liveBadgeText: {
      color: '#fff',
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.5,
    },

    // Variant badges (Skipped, Changed, Completed)
    variantBadge: {
      backgroundColor: C.inputBg,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    variantBadgeOutline: {
      backgroundColor: 'transparent',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    variantBadgeText: {
      fontSize: 9,
      color: C.textMuted,
      fontWeight: '500',
    },

    // Action buttons column
    sessionActions: {
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 4,
      flexShrink: 0,
    },
    joinBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 20,
    },
    joinBtnLive: {
      backgroundColor: C.teal,
    },
    joinBtnUpcoming: {
      backgroundColor: C.tealBg,
    },
    joinBtnDisabled: {
      backgroundColor: C.inputBg,
      opacity: 0.5,
    },
    joinBtnRecording: {
      backgroundColor: C.inputBg,
    },
    joinBtnTxt: {
      fontSize: 11,
      fontWeight: '600',
    },
    calBtn: {
      width: 26,
      height: 26,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 13,
      backgroundColor: C.inputBg,
    },
  });
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ChannelInfoSheet({
  visible,
  title,
  subtitle,
  kind,
  avatarSeed,
  iconEmoji,
  memberCount,
  description,
  members,
  messages = [],
  schedules = [],
  isLoadingSessions,
  sessionsError,
  onClose,
}: ChannelInfoSheetProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<ChannelTab>('files');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // translateY: 0 = full screen top, SCREEN_HEIGHT - PARTIAL_HEIGHT = partial, SCREEN_HEIGHT = hidden
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const isFullScreenRef = useRef(false);
  // Tracks translateY value at gesture start to avoid stale closure
  const panRef = useRef<number>(SCREEN_HEIGHT - PARTIAL_HEIGHT);

  const isDm = kind === 'dm';
  const seed = avatarSeed ?? title;
  const typeLabel = isDm ? 'Direct Message' : kind === 'space' ? 'Learning Space' : 'Channel';

  // Derived data for tabs
  const fileItems = useMemo(() => extractFiles(messages), [messages]);
  const savedItems = useMemo(() => extractSaved(messages), [messages]);
  const memberItems = useMemo(() => extractMembers(messages, members), [messages, members]);

  // ── Open animation ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      isFullScreenRef.current = false;
      setIsFullScreen(false);
      setActiveTab('files');
      sheetTranslateY.setValue(SCREEN_HEIGHT);
      Animated.spring(sheetTranslateY, {
        toValue: SCREEN_HEIGHT - PARTIAL_HEIGHT,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    }
  }, [visible, sheetTranslateY]);

  // ── Internal close (animate out then notify parent) ─────────────────────────
  const handleClose = useCallback(() => {
    Animated.timing(sheetTranslateY, {
      toValue: SCREEN_HEIGHT,
      useNativeDriver: true,
      duration: 220,
    }).start(() => {
      isFullScreenRef.current = false;
      setIsFullScreen(false);
      onClose();
    });
  }, [onClose, sheetTranslateY]);

  // ── Expand to full screen ───────────────────────────────────────────────────
  const expandToFull = useCallback(() => {
    isFullScreenRef.current = true;
    setIsFullScreen(true);
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 85,
      friction: 12,
    }).start();
  }, [sheetTranslateY]);

  // ── Collapse back to partial ────────────────────────────────────────────────
  const collapseToPartial = useCallback(() => {
    isFullScreenRef.current = false;
    setIsFullScreen(false);
    Animated.spring(sheetTranslateY, {
      toValue: SCREEN_HEIGHT - PARTIAL_HEIGHT,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [sheetTranslateY]);

  // ── PanResponder (drag handle) ──────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 8,
      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation((val) => {
          panRef.current = val;
        });
      },
      onPanResponderMove: (_, { dy }) => {
        const next = Math.max(0, Math.min(SCREEN_HEIGHT, panRef.current + dy));
        sheetTranslateY.setValue(next);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const isCurrentlyFull = isFullScreenRef.current;
        if (dy < -50 || vy < -0.5) {
          // Swipe up → expand to full screen
          isFullScreenRef.current = true;
          setIsFullScreen(true);
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 85,
            friction: 12,
          }).start();
        } else if (dy > 80 || vy > 0.6) {
          if (isCurrentlyFull) {
            // Swipe down from full → collapse to partial
            isFullScreenRef.current = false;
            setIsFullScreen(false);
            Animated.spring(sheetTranslateY, {
              toValue: SCREEN_HEIGHT - PARTIAL_HEIGHT,
              useNativeDriver: true,
              tension: 80,
              friction: 12,
            }).start();
          } else {
            // Swipe down from partial → close
            Animated.timing(sheetTranslateY, {
              toValue: SCREEN_HEIGHT,
              useNativeDriver: true,
              duration: 220,
            }).start(() => {
              isFullScreenRef.current = false;
              setIsFullScreen(false);
              onClose();
            });
          }
        } else {
          // Snap back to current state
          Animated.spring(sheetTranslateY, {
            toValue: isCurrentlyFull ? 0 : SCREEN_HEIGHT - PARTIAL_HEIGHT,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* Backdrop — tapping closes sheet when in partial mode */}
      <Pressable
        style={s.backdrop}
        onPress={!isFullScreen ? handleClose : undefined}
      />

      {/* Animated sheet — full height container, translated to show partial */}
      <Animated.View
        style={[
          s.sheet,
          { transform: [{ translateY: sheetTranslateY }] },
          isFullScreen && { paddingTop: insets.top },
        ]}
      >
        {/* Drag handle — always visible, handles gesture for expand/collapse/close */}
        <View style={s.dragArea} {...panResponder.panHandlers}>
          <View style={s.dragHandle} />
        </View>

        {isDm ? (
          /* ── DM: hero + static info rows ── */
          <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={isFullScreen}>
            {/* Hero */}
            <View style={s.hero}>
              <View style={[s.avatarCircle, { backgroundColor: avatarColor(seed) }]}>
                <Text style={s.avatarTxt}>{getInitials(title)}</Text>
              </View>
              <Text style={s.heroName}>{title}</Text>
              {!!subtitle && <Text style={s.heroSub}>{subtitle}</Text>}
            </View>

            {/* Info rows */}
            <View style={s.section}>
              <View style={s.row}>
                <Text style={s.rowIcon}>💬</Text>
                <Text style={s.rowLabel}>Type</Text>
                <Text style={s.rowValue}>{typeLabel}</Text>
              </View>
              {memberCount != null && (
                <>
                  <View style={s.rowSep} />
                  <View style={s.row}>
                    <Text style={s.rowIcon}>👥</Text>
                    <Text style={s.rowLabel}>Members</Text>
                    <Text style={s.rowValue}>{memberCount}</Text>
                  </View>
                </>
              )}
              {!!description && (
                <>
                  <View style={s.rowSep} />
                  <View style={s.row}>
                    <Text style={s.rowIcon}>📝</Text>
                    <Text style={s.rowLabel}>Description</Text>
                    <Text style={s.rowValue} numberOfLines={2}>{description}</Text>
                  </View>
                </>
              )}
            </View>

            {/* Expand overlay in partial mode */}
            {!isFullScreen && (
              <Pressable style={StyleSheet.absoluteFill} onPress={expandToFull} />
            )}
          </ScrollView>
        ) : (
          /* ── Channel / Space: compact hero + fixed tabs + scrollable content ── */
          <>
            {/* Compact hero */}
            <View style={s.heroCompact}>
              <View style={[s.iconBoxCompact, { backgroundColor: colors.tealBg }]}>
                <Text style={s.iconEmojiTxtCompact}>{iconEmoji ?? '📚'}</Text>
              </View>
              <Text style={s.heroNameCompact}>{title}</Text>
              {!!subtitle && <Text style={s.heroSub}>{subtitle}</Text>}
            </View>

            {/* Fixed tab bar */}
            <View style={s.tabBar}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const tabColor = isActive ? colors.teal : colors.textMuted;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[s.tabItem, isActive && s.tabItemActive]}
                    onPress={() => setActiveTab(tab.key)}
                    activeOpacity={0.7}
                  >
                    <TabIcon tabKey={tab.key} color={tabColor} />
                    <Text style={[s.tabLabel, isActive && s.tabLabelActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tab content — flex: 1 so it fills remaining space */}
            <View style={{ flex: 1 }}>
              <TabContent
                activeTab={activeTab}
                fileItems={fileItems}
                savedItems={savedItems}
                memberItems={memberItems}
                colors={colors}
                s={s}
                memberCount={memberCount}
                schedules={schedules}
                isLoadingSessions={isLoadingSessions}
                sessionsError={sessionsError}
                isFullScreen={isFullScreen}
              />
            </View>

            {/* Expand overlay in partial mode — tapping content area expands sheet */}
            {!isFullScreen && (
              <Pressable style={StyleSheet.absoluteFill} onPress={expandToFull} />
            )}
          </>
        )}
      </Animated.View>
    </Modal>
  );
}
