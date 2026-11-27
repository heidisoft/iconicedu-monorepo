import React, { useState } from 'react';
import { View, Text, Image, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import {
  AlertCircle,
  AtSign,
  Bell,
  BookImage,
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  CreditCard,
  FileBadge,
  FileHeadphone,
  GraduationCap,
  MessageSquare,
  MessageSquareDot,
  MessageSquareHeart,
  MessageSquareReply,
  MessagesSquare,
  SmilePlus,
  NotepadText,
  Star,
} from 'lucide-react-native';
import type { AppColors } from '@/lib/theme';
import type {
  ActivityFeedItemVM,
  ActivityVerbVM,
  InboxIconKeyVM,
} from '@iconicedu/shared-types';
import { profileAvatarColors } from '@/lib/profile-avatar-colors';
import {
  ActivityFeedbackRequest,
  canRenderMobileActivityFeedbackRequest,
} from '@/components/activity/activity-feedback-request';
import { ActivityCompletionCheck } from '@/components/activity/activity-completion-check';
import { ActivityCompletionCheckBatch } from '@/components/activity/activity-completion-check-batch';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const ACTIVITY_ICON_MAP: Record<
  InboxIconKeyVM,
  React.ComponentType<{ size: number; color: string }>
> = {
  AtSign,
  Bell,
  BookImage,
  AlertCircle,
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  CreditCard,
  FileBadge,
  FileHeadphone,
  GraduationCap,
  MessageSquare,
  MessageSquareDot,
  MessageSquareHeart,
  MessageSquareReply,
  MessagesSquare,
  SmilePlus,
  Star,
};

export const TAB_LABELS: Record<string, string> = {
  all: 'All',
  classes: 'Classes',
  payment: 'Payment',
  system: 'System',
};

// Activity / notification icon tones. Flat, muted — kept in sync with the
// forest-green + sage theme tokens (see @/lib/theme). Dark-aware.
export function toneColors(tone?: string): { bg: string; fg: string } {
  switch (tone) {
    case 'success':
      return { bg: '#e2f0e2', fg: '#2f7d4a' };
    case 'warning':
      return { bg: '#f4ecdd', fg: '#a97b34' };
    case 'danger':
      return { bg: '#f5e7e4', fg: '#bf574e' };
    case 'info':
      return { bg: '#e8ecf7', fg: '#4a6a9e' };
    default:
      return { bg: '#eef0ea', fg: '#6b7469' };
  }
}

export function toneColorsDark(tone?: string): { bg: string; fg: string } {
  switch (tone) {
    case 'success':
      return { bg: '#1c3226', fg: '#5fb17e' };
    case 'warning':
      return { bg: '#33291a', fg: '#d1a568' };
    case 'danger':
      return { bg: '#33231f', fg: '#d77f78' };
    case 'info':
      return { bg: '#232a3a', fg: '#8ba8d4' };
    default:
      return { bg: '#262b23', fg: '#a0a89c' };
  }
}

export function getIconKey(item: ActivityFeedItemVM): InboxIconKeyVM {
  if (item.content.leading?.kind === 'icon') return item.content.leading.iconKey;
  switch (item.verb) {
    case 'message.posted':
      return 'MessageSquareDot';
    case 'message.mentioned':
      return 'AtSign';
    case 'message.unviewed_intended_participants':
      return 'AlertCircle';
    case 'message.thread_reply.posted':
      return 'MessageSquareReply';
    case 'file.uploaded':
      return 'FileBadge';
    case 'image.uploaded':
      return 'BookImage';
    case 'audio.uploaded':
      return 'FileHeadphone';
    case 'reaction.added':
      return 'SmilePlus';
    case 'class.schedule.created':
      return 'CalendarCheck';
    case 'class.schedule.ended':
      return 'CalendarX';
    case 'class.session.rescheduled':
      return 'CalendarCheck';
    case 'class.session.canceled':
      return 'CalendarX';
    case 'session.reminder.sent':
      return 'Bell';
    case 'session.feedback_request.sent':
      return 'Star';
    default:
      return 'Bell';
  }
}

type ActivityIconComponentType = React.ComponentType<{ size: number; color: string }>;

// Client-side icon overrides for verbs whose meaning reads better with an icon
// outside the shared InboxIconKeyVM set (kept out of the API contract).
const VERB_ICON_OVERRIDES: Partial<Record<ActivityVerbVM, ActivityIconComponentType>> = {
  // "Confirm the lesson…" — a lesson note, not a generic check mark.
  'session.completion_check.sent': NotepadText,
  'session.completion_check.batch.sent': NotepadText,
};

export function getActivityIcon(item: ActivityFeedItemVM): ActivityIconComponentType {
  return VERB_ICON_OVERRIDES[item.verb] ?? ACTIVITY_ICON_MAP[getIconKey(item)] ?? Bell;
}

export function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

/**
 * Short timestamp for the top-right corner of a notification: "now", "5m",
 * "3h", "2d", then a calendar date ("Mar 4") once it is more than a week old.
 * The long form (`relativeTime`) stays available as the accessibility label.
 */
export function compactTime(iso: string, now: number = Date.now()): string {
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return '';
  const diff = Math.max(0, now - timestamp);
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(timestamp),
  );
}

/**
 * Inbox section header: "Today" → "Today, Mar 9"; "Yesterday" → "Yesterday, Mar 8".
 * Broader buckets ("This week", "Earlier") span several days and stay as-is.
 */
export function formatFeedSectionLabel(
  label: string,
  firstItemIso?: string | null,
): string {
  if (!firstItemIso || !/^(today|yesterday)$/i.test(label.trim())) return label;
  const date = new Date(firstItemIso);
  if (Number.isNaN(date.getTime())) return label;
  const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    date,
  );
  return `${label}, ${day}`;
}

function normalizeForCompare(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?…\s]+$/u, '')
    .trim();
}

/**
 * True when the preview only restates what the headline already says (e.g. a
 * reminder whose headline is "ELA with Ms Denise Class session starts Wed…" and
 * whose summary is "Class session starts Wed…"). Showing it twice makes the feed
 * feel noisy without telling the reader anything new.
 */
export function isPreviewRedundant(headline: string, preview: string): boolean {
  const normalizedPreview = normalizeForCompare(preview);
  if (!normalizedPreview) return true;
  return normalizeForCompare(headline).includes(normalizedPreview);
}

/**
 * "Read more" only earns its place when the expanded text says something the
 * preview and headline do not — e.g. a short chat message whose full body is
 * identical to its preview should not offer to expand.
 */
export function hasMoreToRead(
  headline: string,
  previewText: string | null,
  expandedContent: string | undefined,
): boolean {
  if (!expandedContent) return false;
  return !isPreviewRedundant(`${headline} ${previewText ?? ''}`, expandedContent);
}

// Verbs driven by a person's action — these lead with that person's avatar so
// the reader sees *who* before *what*. System-generated verbs (reminders,
// schedule changes, completion checks) keep the tone icon chip.
const PERSON_DRIVEN_VERBS = new Set<ActivityVerbVM>([
  'message.posted',
  'message.mentioned',
  'message.thread_reply.posted',
  'file.uploaded',
  'image.uploaded',
  'audio.uploaded',
  'reaction.added',
]);

export type ActivityLeadingAvatar = {
  name: string;
  url: string | null;
  seed: string;
  themeKey: string | null;
};

function resolveAvatarUrl(avatar?: { source?: string; url?: string | null } | null) {
  if (!avatar || avatar.source === 'seed') return null;
  const url = avatar.url?.trim();
  return url ? url : null;
}

export function getLeadingAvatar(item: ActivityFeedItemVM): ActivityLeadingAvatar | null {
  const leading = item.content.leading;
  if (leading?.kind === 'avatars') {
    const first = leading.avatars[0];
    if (!first) return null;
    return {
      name: first.name,
      url: resolveAvatarUrl(first.avatar),
      seed: first.avatar.seed ?? first.profileId ?? first.name,
      themeKey: first.themeKey ?? null,
    };
  }

  if (!PERSON_DRIVEN_VERBS.has(item.verb)) return null;
  const actor = item.refs.actor;
  if (!actor) return null;
  const avatar = actor.profile.avatar;
  return {
    name: actor.profile.displayName,
    url: resolveAvatarUrl(avatar),
    seed: avatar?.seed ?? actor.ids.id,
    themeKey: actor.ui?.themeKey ?? null,
  };
}

export type ActivityTagTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
export type ActivityTag = { label: string; tone: ActivityTagTone };

function completionStatus(item: ActivityFeedItemVM): string | null {
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  const completion =
    metadata.sessionCompletion && typeof metadata.sessionCompletion === 'object'
      ? (metadata.sessionCompletion as Record<string, unknown>)
      : null;
  return typeof completion?.status === 'string' ? completion.status : null;
}

const RESOLVED_COMPLETION_STATUSES = new Set(['confirmed', 'auto_confirmed', 'disputed']);

function batchSessionStatuses(item: ActivityFeedItemVM): Array<string | null> {
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  if (!Array.isArray(metadata.sessions)) return [];
  return (metadata.sessions as unknown[]).map((session) => {
    const completion =
      session && typeof session === 'object'
        ? (session as Record<string, unknown>).sessionCompletion
        : null;
    const status =
      completion && typeof completion === 'object'
        ? (completion as Record<string, unknown>).status
        : null;
    return typeof status === 'string' ? status : null;
  });
}

/**
 * True when a completion check has already been answered (confirmed,
 * auto-confirmed or reported). Those rows collapse to their status tag — the
 * prompt, "marked as completed" copy and rating tile are no longer useful.
 */
export function isCompletionCheckResolved(item: ActivityFeedItemVM): boolean {
  if (item.verb === 'session.completion_check.sent') {
    const status = completionStatus(item);
    return status !== null && RESOLVED_COMPLETION_STATUSES.has(status);
  }
  if (item.verb === 'session.completion_check.batch.sent') {
    const statuses = batchSessionStatuses(item);
    return (
      statuses.length > 0 &&
      statuses.every(
        (status) => status !== null && RESOLVED_COMPLETION_STATUSES.has(status),
      )
    );
  }
  return false;
}

/**
 * Short status tag shown top-right on system notifications. It describes what
 * *happened* (Rescheduled, Canceled, Action needed…) rather than the inbox tab,
 * which would read "Classes" on nearly every row and tell the reader nothing.
 * Person-driven rows return null — the avatar + sentence already say it.
 */
export function getActivityTag(item: ActivityFeedItemVM): ActivityTag | null {
  switch (item.verb) {
    case 'class.session.rescheduled':
      return { label: 'Rescheduled', tone: 'warning' };
    case 'class.session.canceled':
      return { label: 'Canceled', tone: 'danger' };
    case 'class.schedule.created':
      return { label: 'New class', tone: 'success' };
    case 'class.schedule.ended':
      return { label: 'Class ended', tone: 'neutral' };
    case 'session.reminder.sent':
      return { label: 'Reminder', tone: 'info' };
    case 'session.feedback_request.sent':
      return { label: 'Feedback', tone: 'info' };
    case 'session.completion.dispute_reported':
      return { label: 'Issue reported', tone: 'danger' };
    case 'message.unviewed_intended_participants':
      return { label: 'Unseen', tone: 'warning' };
    case 'session.completion_check.batch.sent':
      return isCompletionCheckResolved(item)
        ? { label: 'Completed', tone: 'success' }
        : { label: 'Action needed', tone: 'warning' };
    case 'session.completion_check.sent': {
      const status = completionStatus(item);
      if (status === 'confirmed' || status === 'auto_confirmed') {
        return { label: 'Confirmed', tone: 'success' };
      }
      if (status === 'disputed') return { label: 'Reported', tone: 'danger' };
      return { label: 'Action needed', tone: 'warning' };
    }
    default:
      return null;
  }
}

/** Meta-line timestamp: "Just now", "5m ago", "3h ago", "2d ago", "Mar 4". */
export function metaTime(iso: string, now: number = Date.now()): string {
  const compact = compactTime(iso, now);
  if (!compact) return '';
  if (compact === 'now') return 'Just now';
  return /^\d+[mhd]$/.test(compact) ? `${compact} ago` : compact;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return words[0]?.[0]?.toUpperCase() ?? '?';
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const LEADING_SIZE = 40;
const SUB_LEADING_SIZE = 28;
const CONTENT_GAP = 12;
// Vertical rhythm inside a row: tight within the header block, one step
// between the header and anything under it (preview, link, widget).
const SPACE_TIGHT = 2;
const SPACE_SM = 6;
const SPACE_MD = 10;
/** Left edge of the body (previews, actions, interactive widgets). */
export const ACTIVITY_BODY_INDENT = LEADING_SIZE + CONTENT_GAP;
const SUB_BODY_INDENT = SUB_LEADING_SIZE + 10;

export function makeActivityItemStyles(C: AppColors) {
  return StyleSheet.create({
    // Flat row on the page background; the list draws hairline separators.
    itemOuter: {},
    itemWrap: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    itemWrapPressed: { backgroundColor: C.inkSubtle },
    itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: CONTENT_GAP },

    // Leading visual — actor avatar or tone icon chip
    leading: { width: LEADING_SIZE, height: LEADING_SIZE },
    subLeading: { width: SUB_LEADING_SIZE, height: SUB_LEADING_SIZE },
    iconChip: {
      width: LEADING_SIZE,
      height: LEADING_SIZE,
      borderRadius: LEADING_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    subIconChip: {
      width: SUB_LEADING_SIZE,
      height: SUB_LEADING_SIZE,
      borderRadius: SUB_LEADING_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: {
      width: LEADING_SIZE,
      height: LEADING_SIZE,
      borderRadius: LEADING_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    subAvatar: {
      width: SUB_LEADING_SIZE,
      height: SUB_LEADING_SIZE,
      borderRadius: SUB_LEADING_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarInitials: { fontSize: 14, fontWeight: '700' },
    subAvatarInitials: { fontSize: 11, fontWeight: '700' },
    // Small type badge pinned to the avatar's bottom-right
    typeBadge: {
      position: 'absolute',
      right: -3,
      bottom: -3,
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      // Ring matches the row background (flat list on the page colour).
      borderColor: C.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Content
    content: { flex: 1, minWidth: 0 },
    topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    // Sentence headline (person-driven rows)
    headlineText: { flex: 1, fontSize: 15, lineHeight: 21 },
    subHeadlineText: { flex: 1, fontSize: 14, lineHeight: 19 },
    // Title + detail (system rows)
    titleText: { flex: 1, fontSize: 15, lineHeight: 21 },
    detailText: { fontSize: 14, lineHeight: 20, marginTop: SPACE_TIGHT },
    strong: { fontWeight: '700' },
    strongRead: { fontWeight: '600' },

    // Time — top-right on the headline line
    timeText: {
      flexShrink: 0,
      fontSize: 13,
      lineHeight: 21,
      fontVariant: ['tabular-nums'],
    },

    // Status tag — small pill under the detail line (system rows only)
    tag: {
      alignSelf: 'flex-start',
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 3,
      marginTop: SPACE_SM,
    },
    tagText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },

    // Unread dot — pinned to the leading visual's top-left corner
    unreadDot: {
      position: 'absolute',
      top: -2,
      left: -2,
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
    },

    // Body — previews and actions align with the headline text
    body: { marginLeft: ACTIVITY_BODY_INDENT, marginTop: SPACE_MD, gap: SPACE_SM },
    subBody: { marginLeft: SUB_BODY_INDENT, marginTop: SPACE_SM, gap: SPACE_SM },
    // Interactive widgets (completion check, rating) share the body's indent so
    // every block under the headline starts on the same left edge.
    widget: { marginLeft: ACTIVITY_BODY_INDENT, marginTop: SPACE_MD },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: C.border,
      marginHorizontal: 20,
    },

    // Inset panel (preview / expanded content) — white panel on the page bg
    inset: {
      borderRadius: 12,
      backgroundColor: C.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    insetDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border },
    insetText: { fontSize: 14, lineHeight: 20, color: C.text },

    // Read more / Show less — quiet text link under the preview
    expandLink: { alignSelf: 'flex-start', paddingVertical: 2 },
    expandLinkText: { fontSize: 14, fontWeight: '600' },

    // Sub-activity: compact leaf view
    subItemInner: { paddingVertical: 10 },
  });
}

export type ActivityItemStyles = ReturnType<typeof makeActivityItemStyles>;

// ---------------------------------------------------------------------------
// ActivityItem component
// ---------------------------------------------------------------------------

type ActivityItemProps = {
  item: ActivityFeedItemVM;
  colors: AppColors;
  isDark: boolean;
  s: ActivityItemStyles;
  onMarkRead: (id: string) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onActionPress?: (item: ActivityFeedItemVM) => void;
  isSubActivity?: boolean;
  viewerTimezone?: string | null;
  currentProfileId?: string | null;
};

function normalizeTimezone(timezone?: string | null) {
  const value = timezone?.trim();
  return value ? value : null;
}

function isValidTimezone(timezone?: string | null) {
  const candidate = normalizeTimezone(timezone);
  if (!candidate) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function resolveDisplayTimezone(
  viewerTimezone?: string | null,
  scheduleTimezone?: string | null,
) {
  if (isValidTimezone(viewerTimezone)) {
    return viewerTimezone!.trim();
  }

  if (isValidTimezone(scheduleTimezone)) {
    return scheduleTimezone!.trim();
  }

  try {
    const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isValidTimezone(deviceTimezone)) {
      return deviceTimezone;
    }
  } catch {
    // Fall back to UTC when the runtime cannot resolve a local timezone.
  }

  return 'UTC';
}

export function formatActivityPrimaryHeadline(
  item: ActivityFeedItemVM,
  viewerTimezone?: string | null,
) {
  const metadata = item.metadata as Record<string, unknown> | undefined;
  if (metadata?.preserveActivitySummary === true) {
    return item.content.headline.primary;
  }
  if (!metadata?.sessionGroupLocalTime) {
    return item.content.headline.primary;
  }

  const occurrenceStart = metadata.occurrenceStart;
  if (typeof occurrenceStart !== 'string' || occurrenceStart.length === 0) {
    return item.content.headline.primary;
  }

  const date = new Date(occurrenceStart);
  if (Number.isNaN(date.getTime())) {
    return item.content.headline.primary;
  }

  const localLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: resolveDisplayTimezone(
      viewerTimezone,
      typeof metadata.timezone === 'string' ? metadata.timezone : null,
    ),
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace(',', ' at');

  const participantNamesLabel =
    typeof metadata.participantNamesLabel === 'string' &&
    metadata.participantNamesLabel.length > 0
      ? metadata.participantNamesLabel
      : undefined;

  return `Class session${participantNamesLabel ? ` for ${participantNamesLabel}` : ''} ${localLabel}`;
}

type ActivityIconComponent = React.ComponentType<{ size: number; color: string }>;

function ActivityLeading({
  avatar,
  colors,
  s,
  IconComponent,
  iconBg,
  iconFg,
  isRead,
  isSubActivity,
}: {
  avatar: ActivityLeadingAvatar | null;
  colors: AppColors;
  s: ActivityItemStyles;
  IconComponent: ActivityIconComponent;
  iconBg: string;
  iconFg: string;
  isRead: boolean;
  isSubActivity: boolean;
}) {
  // Unread marker pinned to the leading visual's top-left corner, ringed with
  // the page colour so it reads cleanly over avatars and icon chips.
  const unreadDot = isRead ? null : (
    <View
      style={[s.unreadDot, { backgroundColor: colors.action, borderColor: colors.bg }]}
      accessibilityLabel="Unread"
      testID="activity-unread-indicator"
    />
  );

  if (!avatar) {
    return (
      <View
        style={[isSubActivity ? s.subIconChip : s.iconChip, { backgroundColor: iconBg }]}
        testID="activity-leading-icon"
      >
        <IconComponent size={isSubActivity ? 14 : 18} color={iconFg} />
        {unreadDot}
      </View>
    );
  }

  const avatarColors = profileAvatarColors({
    seed: avatar.seed,
    themeKey: avatar.themeKey,
  });

  return (
    <View
      style={isSubActivity ? s.subLeading : s.leading}
      testID="activity-leading-avatar"
    >
      {avatar.url ? (
        <Image
          source={{ uri: avatar.url }}
          style={isSubActivity ? s.subAvatar : s.avatar}
          accessibilityLabel={avatar.name}
        />
      ) : (
        <View
          style={[
            isSubActivity ? s.subAvatar : s.avatar,
            { backgroundColor: avatarColors.bg },
          ]}
          accessibilityLabel={avatar.name}
        >
          <Text
            style={[
              isSubActivity ? s.subAvatarInitials : s.avatarInitials,
              { color: avatarColors.fg },
            ]}
          >
            {getInitials(avatar.name)}
          </Text>
        </View>
      )}
      {isSubActivity ? null : (
        <View style={[s.typeBadge, { backgroundColor: iconBg }]}>
          <IconComponent size={10} color={iconFg} />
        </View>
      )}
      {unreadDot}
    </View>
  );
}

type ActivityHeaderRowProps = {
  colors: AppColors;
  isDark: boolean;
  s: ActivityItemStyles;
  avatar: ActivityLeadingAvatar | null;
  IconComponent: ActivityIconComponent;
  iconBg: string;
  iconFg: string;
  isRead: boolean;
  isSubActivity: boolean;
  primary: string;
  secondary?: string;
  emphasis?: string;
  occurredAt: string;
  tag: ActivityTag | null;
};

function ActivityTagPill({
  isDark,
  s,
  tag,
}: {
  isDark: boolean;
  s: ActivityItemStyles;
  tag: ActivityTag;
}) {
  const { bg, fg } = isDark ? toneColorsDark(tag.tone) : toneColors(tag.tone);
  return (
    <View style={[s.tag, { backgroundColor: bg }]} testID="activity-tag">
      <Text style={[s.tagText, { color: fg }]}>{tag.label}</Text>
    </View>
  );
}

function ActivityHeaderRow({
  colors,
  isDark,
  s,
  avatar,
  IconComponent,
  iconBg,
  iconFg,
  isRead,
  isSubActivity,
  primary,
  secondary,
  emphasis,
  occurredAt,
  tag,
}: ActivityHeaderRowProps) {
  const strongStyle = isRead ? s.strongRead : s.strong;
  // Person-driven rows read as one sentence ("Marc F sent a message in Math");
  // system rows split into a title and a detail line so the "what" scans first.
  const isSentence = Boolean(avatar) || isSubActivity;
  const detail = [secondary, emphasis].filter(Boolean).join(' ');

  return (
    <View style={s.itemRow}>
      <ActivityLeading
        avatar={avatar}
        colors={colors}
        s={s}
        IconComponent={IconComponent}
        iconBg={iconBg}
        iconFg={iconFg}
        isRead={isRead}
        isSubActivity={isSubActivity}
      />

      <View style={s.content}>
        <View style={s.topRow}>
          {isSentence ? (
            <Text
              style={[
                isSubActivity ? s.subHeadlineText : s.headlineText,
                { color: colors.textMuted },
              ]}
            >
              <Text style={[strongStyle, { color: colors.text }]}>{primary}</Text>
              {secondary ? ` ${secondary}` : null}
              {emphasis ? (
                <>
                  {' '}
                  <Text style={[strongStyle, { color: colors.text }]}>{emphasis}</Text>
                </>
              ) : null}
            </Text>
          ) : (
            <Text style={[s.titleText, strongStyle, { color: colors.text }]}>
              {primary}
            </Text>
          )}

          <Text
            style={[s.timeText, { color: colors.textMuted }]}
            accessibilityLabel={relativeTime(occurredAt)}
          >
            {metaTime(occurredAt)}
          </Text>
        </View>

        {!isSentence && detail ? (
          <Text style={[s.detailText, { color: colors.textMuted }]}>{detail}</Text>
        ) : null}

        {tag && !isSubActivity ? (
          <ActivityTagPill isDark={isDark} s={s} tag={tag} />
        ) : null}
      </View>
    </View>
  );
}

function ActivityInset({
  expandedContent,
  isExpanded,
  numberOfLines,
  previewText,
  s,
}: {
  expandedContent?: string;
  isExpanded: boolean;
  numberOfLines: number;
  previewText: string | null;
  s: ActivityItemStyles;
}) {
  const showExpanded = Boolean(expandedContent) && isExpanded;
  if (!previewText && !showExpanded) return null;

  // When the expanded text already contains the preview (a long message and its
  // first lines), show it in place of the preview instead of repeating it.
  const expandedReplacesPreview =
    showExpanded &&
    Boolean(previewText) &&
    isPreviewRedundant(expandedContent!, previewText!);

  return (
    <View style={s.inset} testID="activity-preview">
      {previewText && !expandedReplacesPreview ? (
        <Text style={s.insetText} numberOfLines={isExpanded ? undefined : numberOfLines}>
          {previewText}
        </Text>
      ) : null}

      {showExpanded ? (
        <>
          {previewText && !expandedReplacesPreview ? (
            <View style={s.insetDivider} />
          ) : null}
          <Text style={s.insetText}>{expandedContent}</Text>
        </>
      ) : null}
    </View>
  );
}

function ActivityExpandLink({
  colors,
  isExpanded,
  onPress,
  s,
}: {
  colors: AppColors;
  isExpanded: boolean;
  onPress: () => void;
  s: ActivityItemStyles;
}) {
  return (
    <TouchableOpacity
      style={s.expandLink}
      onPress={onPress}
      hitSlop={8}
      activeOpacity={0.7}
      accessibilityRole="button"
      testID="activity-expand-link"
    >
      <Text style={[s.expandLinkText, { color: colors.action }]}>
        {isExpanded ? 'Show less' : 'Read more'}
      </Text>
    </TouchableOpacity>
  );
}

export function ActivityItem({
  item,
  colors,
  isDark,
  s,
  onMarkRead,
  expandedIds,
  onToggle,
  onActionPress,
  isSubActivity = false,
  viewerTimezone,
  currentProfileId,
}: ActivityItemProps) {
  // Captured once: a check that was still pending when the row mounted keeps its
  // widget after the user answers (so the "How was it?" rating step can follow),
  // while rows that load already answered collapse to their status tag.
  const [completionPendingOnMount] = useState(() => !isCompletionCheckResolved(item));
  // Pressed state is tracked manually: NativeWind's babel interop drops
  // Pressable's function-form `style`, which silently removed all row padding.
  const [isPressed, setIsPressed] = useState(false);
  const pressHandlers = {
    onPressIn: () => setIsPressed(true),
    onPressOut: () => setIsPressed(false),
  };

  const tone =
    item.content.leading?.kind === 'icon' ? item.content.leading.tone : undefined;
  const { bg: iconBg, fg: iconFg } = isDark ? toneColorsDark(tone) : toneColors(tone);
  const IconComponent = getActivityIcon(item);
  const avatar = getLeadingAvatar(item);
  const isRead = item.state?.isRead ?? false;
  const isExpanded = expandedIds.has(item.ids.id);
  const primary = formatActivityPrimaryHeadline(item, viewerTimezone);
  const { secondary, emphasis } = item.content.headline;
  const headlineText = [primary, secondary, emphasis].filter(Boolean).join(' ');
  const rawPreview =
    item.content.summary?.trim() || item.content.preview?.text?.trim() || '';
  const previewText =
    rawPreview && !isPreviewRedundant(headlineText, rawPreview) ? rawPreview : null;
  const rawExpanded = item.content.expandedContent?.trim() || undefined;
  const isExpandable = hasMoreToRead(headlineText, previewText, rawExpanded);
  const expandedContent = isExpandable ? rawExpanded : undefined;
  // Every feed action button navigates (open class / message / reply), so the
  // row itself is the tap target — no separate "Open …" pill.
  const navigationLabel = item.content.actionButton?.label ?? null;
  const isCompletionCheck =
    item.kind === 'leaf' &&
    (item.verb === 'session.completion_check.sent' ||
      item.verb === 'session.completion_check.batch.sent');
  const canShowFeedbackRequest =
    item.kind === 'leaf' &&
    item.verb === 'session.feedback_request.sent' &&
    canRenderMobileActivityFeedbackRequest(item);
  const canShowCompletionCheck = isCompletionCheck && completionPendingOnMount;
  const hidesDefaultContent =
    !isSubActivity && (canShowFeedbackRequest || isCompletionCheck);
  const shouldShowPreview = !hidesDefaultContent;
  const canNavigate = Boolean(navigationLabel) && !hidesDefaultContent;
  const tag = getActivityTag(item);

  const toggleExpanded = () => {
    if (!isRead) onMarkRead(item.ids.id);
    onToggle(item.ids.id);
  };

  const handlePress = () => {
    if (!isRead) onMarkRead(item.ids.id);
    if (canNavigate) {
      onActionPress?.(item);
      return;
    }
    if (isExpandable) onToggle(item.ids.id);
  };

  const header = (
    <ActivityHeaderRow
      colors={colors}
      isDark={isDark}
      s={s}
      avatar={avatar}
      IconComponent={IconComponent}
      iconBg={iconBg}
      iconFg={iconFg}
      isRead={isRead}
      isSubActivity={isSubActivity}
      primary={primary}
      secondary={secondary}
      emphasis={emphasis}
      occurredAt={item.timestamps.occurredAt}
      tag={tag}
    />
  );

  const showPreview =
    shouldShowPreview && (Boolean(previewText) || (isExpandable && isExpanded));
  const showExpandLink = shouldShowPreview && isExpandable;
  const body =
    showPreview || showExpandLink ? (
      <View style={isSubActivity ? s.subBody : s.body}>
        {showPreview ? (
          <ActivityInset
            expandedContent={expandedContent}
            isExpanded={isExpanded}
            numberOfLines={isSubActivity ? 3 : 4}
            previewText={previewText}
            s={s}
          />
        ) : null}
        {showExpandLink ? (
          <ActivityExpandLink
            colors={colors}
            isExpanded={isExpanded}
            onPress={toggleExpanded}
            s={s}
          />
        ) : null}
      </View>
    ) : null;

  const a11yHint = canNavigate
    ? navigationLabel!
    : isRead
      ? undefined
      : 'Marks this notification as read';

  // Sub-activity: compact leaf view
  if (isSubActivity) {
    return (
      <Pressable
        onPress={handlePress}
        {...pressHandlers}
        accessibilityRole="button"
        accessibilityHint={a11yHint}
      >
        <View style={[s.subItemInner, isPressed && { opacity: 0.7 }]}>
          {header}
          {body}
        </View>
      </Pressable>
    );
  }

  const interactiveWidget = canShowFeedbackRequest ? (
    <ActivityFeedbackRequest
      activity={item}
      colors={colors}
      currentProfileId={currentProfileId}
    />
  ) : canShowCompletionCheck ? (
    item.verb === 'session.completion_check.batch.sent' ? (
      <ActivityCompletionCheckBatch
        activity={item}
        colors={colors}
        currentProfileId={currentProfileId}
      />
    ) : (
      <ActivityCompletionCheck
        activity={item}
        colors={colors}
        currentProfileId={currentProfileId}
      />
    )
  ) : null;

  return (
    <View style={s.itemOuter}>
      <Pressable
        onPress={handlePress}
        {...pressHandlers}
        accessibilityRole="button"
        accessibilityHint={a11yHint}
      >
        <View style={[s.itemWrap, isPressed && s.itemWrapPressed]} testID="activity-row">
          {header}
          {body}
          {interactiveWidget ? <View style={s.widget}>{interactiveWidget}</View> : null}
        </View>
      </Pressable>
    </View>
  );
}
