import React from 'react';
import { View, Text, Image, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import {
  AlertCircle,
  ArrowRight,
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
/** Left edge of the body (previews, actions, interactive widgets). */
export const ACTIVITY_BODY_INDENT = LEADING_SIZE + CONTENT_GAP;
const SUB_BODY_INDENT = SUB_LEADING_SIZE + 10;

export function makeActivityItemStyles(C: AppColors) {
  return StyleSheet.create({
    // Outer wrapper owns horizontal margin (inbox SectionList / home ScrollView)
    itemOuter: { marginHorizontal: 16 },

    // Item card — borderless, soft shadow (matches SessionCard)
    itemWrap: {
      borderRadius: 18,
      backgroundColor: C.card,
      paddingHorizontal: 16,
      paddingVertical: 16,
      shadowColor: '#1f2a26',
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
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
      borderColor: C.card,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Content
    content: { flex: 1, minWidth: 0 },
    topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    headlineText: { flex: 1, fontSize: 15, lineHeight: 21 },
    subHeadlineText: { flex: 1, fontSize: 14, lineHeight: 19 },
    strong: { fontWeight: '700' },
    strongRead: { fontWeight: '600' },
    trailing: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingTop: 2,
    },
    timeText: { fontSize: 13, fontVariant: ['tabular-nums'] },
    unreadDot: { width: 8, height: 8, borderRadius: 4 },

    // Meta row (category)
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    metaText: { fontSize: 13 },

    // Body — everything under the headline aligns with the headline text
    body: { marginLeft: ACTIVITY_BODY_INDENT, marginTop: 12, gap: 10 },
    subBody: { marginLeft: SUB_BODY_INDENT, marginTop: 8, gap: 8 },

    // Inset panel (preview / expanded content) — recessed, no border
    inset: {
      borderRadius: 12,
      backgroundColor: C.bg,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    insetDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border },
    insetText: { fontSize: 14, lineHeight: 20, color: C.text },
    readMoreBtn: { alignSelf: 'flex-start' },
    readMoreText: { fontSize: 13, fontWeight: '600' },

    // Actions
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: 999,
    },
    actionBtnPrimary: { backgroundColor: C.action },
    actionBtnTonal: { backgroundColor: C.actionSubtle },
    actionBtnText: { fontSize: 14, fontWeight: '600' },

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
  s,
  IconComponent,
  iconBg,
  iconFg,
  isSubActivity,
}: {
  avatar: ActivityLeadingAvatar | null;
  s: ActivityItemStyles;
  IconComponent: ActivityIconComponent;
  iconBg: string;
  iconFg: string;
  isSubActivity: boolean;
}) {
  if (!avatar) {
    return (
      <View
        style={[isSubActivity ? s.subIconChip : s.iconChip, { backgroundColor: iconBg }]}
        testID="activity-leading-icon"
      >
        <IconComponent size={isSubActivity ? 14 : 18} color={iconFg} />
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
    </View>
  );
}

type ActivityHeaderRowProps = {
  colors: AppColors;
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
  tabLabel?: string;
};

function ActivityHeaderRow({
  colors,
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
  tabLabel,
}: ActivityHeaderRowProps) {
  const showTab = !isSubActivity && Boolean(tabLabel && tabLabel !== 'All');
  const strongStyle = isRead ? s.strongRead : s.strong;

  return (
    <View style={s.itemRow}>
      <ActivityLeading
        avatar={avatar}
        s={s}
        IconComponent={IconComponent}
        iconBg={iconBg}
        iconFg={iconFg}
        isSubActivity={isSubActivity}
      />

      <View style={s.content}>
        <View style={s.topRow}>
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

          <View style={s.trailing}>
            <Text
              style={[s.timeText, { color: isRead ? colors.textMuted : colors.text }]}
              accessibilityLabel={relativeTime(occurredAt)}
            >
              {compactTime(occurredAt)}
            </Text>
            {isRead ? null : (
              <View
                style={[s.unreadDot, { backgroundColor: colors.action }]}
                accessibilityLabel="Unread"
                testID="activity-unread-indicator"
              />
            )}
          </View>
        </View>

        {showTab ? (
          <View style={s.metaRow}>
            <Text style={[s.metaText, { color: colors.textMuted }]}>{tabLabel}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ActivityInset({
  colors,
  expandedContent,
  isExpanded,
  numberOfLines,
  onToggle,
  previewText,
  s,
}: {
  colors: AppColors;
  expandedContent?: string;
  isExpanded: boolean;
  numberOfLines: number;
  onToggle: () => void;
  previewText: string | null;
  s: ActivityItemStyles;
}) {
  const hasExpanded = Boolean(expandedContent);
  if (!previewText && !hasExpanded) return null;

  return (
    <View style={s.inset}>
      {previewText ? (
        <Text style={s.insetText} numberOfLines={isExpanded ? undefined : numberOfLines}>
          {previewText}
        </Text>
      ) : null}

      {hasExpanded && isExpanded ? (
        <>
          {previewText ? <View style={s.insetDivider} /> : null}
          <Text style={s.insetText}>{expandedContent}</Text>
        </>
      ) : null}

      {hasExpanded ? (
        <TouchableOpacity
          onPress={onToggle}
          hitSlop={8}
          style={s.readMoreBtn}
          accessibilityRole="button"
        >
          <Text style={[s.readMoreText, { color: colors.action }]}>
            {isExpanded ? 'Show less' : 'Read more'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function ActivityActionButton({
  colors,
  label,
  onPress,
  s,
  variant,
}: {
  colors: AppColors;
  label: string;
  onPress: () => void;
  s: ActivityItemStyles;
  variant?: 'default' | 'outline' | 'secondary';
}) {
  const isPrimary = variant === 'default';
  const fg = isPrimary ? colors.actionForeground : colors.action;
  return (
    <View style={s.actionsRow}>
      <TouchableOpacity
        style={[s.actionBtn, isPrimary ? s.actionBtnPrimary : s.actionBtnTonal]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={[s.actionBtnText, { color: fg }]}>{label}</Text>
        <ArrowRight size={15} color={fg} />
      </TouchableOpacity>
    </View>
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
  const iconKey = getIconKey(item);
  const tone =
    item.content.leading?.kind === 'icon' ? item.content.leading.tone : undefined;
  const { bg: iconBg, fg: iconFg } = isDark ? toneColorsDark(tone) : toneColors(tone);
  const IconComponent = ACTIVITY_ICON_MAP[iconKey] ?? Bell;
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
  const expandedContent = item.content.expandedContent?.trim() || undefined;
  const hasExpandedContent = Boolean(expandedContent);
  const actionButton = item.content.actionButton;
  const canShowFeedbackRequest =
    item.kind === 'leaf' &&
    item.verb === 'session.feedback_request.sent' &&
    canRenderMobileActivityFeedbackRequest(item);
  const canShowCompletionCheck =
    item.kind === 'leaf' &&
    (item.verb === 'session.completion_check.sent' ||
      item.verb === 'session.completion_check.batch.sent');
  const hidesDefaultContent =
    !isSubActivity && (canShowFeedbackRequest || canShowCompletionCheck);
  const shouldShowPreview = !hidesDefaultContent;
  const shouldShowActionButton = Boolean(actionButton) && !hidesDefaultContent;
  const tabLabel = TAB_LABELS[item.tabKey] ?? item.tabKey;

  const handlePress = () => {
    if (!isRead) onMarkRead(item.ids.id);
    if (hasExpandedContent) onToggle(item.ids.id);
  };

  const handleActionPress = () => {
    if (!isRead) onMarkRead(item.ids.id);
    onActionPress?.(item);
  };

  const header = (
    <ActivityHeaderRow
      colors={colors}
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
      tabLabel={tabLabel}
    />
  );

  const inset = shouldShowPreview ? (
    <ActivityInset
      colors={colors}
      expandedContent={expandedContent}
      isExpanded={isExpanded}
      numberOfLines={isSubActivity ? 3 : 4}
      onToggle={() => onToggle(item.ids.id)}
      previewText={previewText}
      s={s}
    />
  ) : null;

  const action =
    shouldShowActionButton && actionButton ? (
      <ActivityActionButton
        colors={colors}
        label={actionButton.label}
        onPress={handleActionPress}
        s={s}
        variant={actionButton.variant}
      />
    ) : null;

  // Sub-activity: compact leaf view
  if (isSubActivity) {
    const hasBody = Boolean(inset) || Boolean(action);
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [s.subItemInner, pressed && { opacity: 0.7 }]}
      >
        {header}
        {hasBody ? (
          <View style={s.subBody}>
            {inset}
            {action}
          </View>
        ) : null}
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

  const hasPreviewContent =
    shouldShowPreview && (Boolean(previewText) || hasExpandedContent);
  const hasBody = hasPreviewContent || Boolean(action) || Boolean(interactiveWidget);

  return (
    <View style={s.itemOuter}>
      <Pressable
        onPress={handlePress}
        accessibilityHint={isRead ? undefined : 'Marks this notification as read'}
        style={({ pressed }) => [s.itemWrap, pressed && { opacity: 0.92 }]}
      >
        {header}

        {hasBody ? (
          <View style={s.body}>
            {hasPreviewContent ? inset : null}
            {interactiveWidget}
            {action}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
