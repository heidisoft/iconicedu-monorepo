import React from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import {
  AtSign,
  Bell,
  BookImage,
  CalendarCheck,
  CalendarX,
  CheckCheck,
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
import type { ActivityFeedItemVM, InboxIconKeyVM } from '@iconicedu/shared-types';
import {
  ActivityFeedbackRequest,
  canRenderMobileActivityFeedbackRequest,
} from '@/components/activity/activity-feedback-request';

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
  CalendarCheck,
  CalendarX,
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

export function toneColors(tone?: string): { bg: string; fg: string } {
  switch (tone) {
    case 'success':
      return { bg: '#dcfce7', fg: '#16a34a' };
    case 'warning':
      return { bg: '#fef9c3', fg: '#ca8a04' };
    case 'danger':
      return { bg: '#fee2e2', fg: '#dc2626' };
    case 'info':
      return { bg: '#dbeafe', fg: '#2563eb' };
    default:
      return { bg: '#f1f5f9', fg: '#64748b' };
  }
}

export function toneColorsDark(tone?: string): { bg: string; fg: string } {
  switch (tone) {
    case 'success':
      return { bg: '#14532d', fg: '#4ade80' };
    case 'warning':
      return { bg: '#713f12', fg: '#fbbf24' };
    case 'danger':
      return { bg: '#7f1d1d', fg: '#f87171' };
    case 'info':
      return { bg: '#1e3a5f', fg: '#60a5fa' };
    default:
      return { bg: '#1e293b', fg: '#94a3b8' };
  }
}

export function getIconKey(item: ActivityFeedItemVM): InboxIconKeyVM {
  if (item.content.leading?.kind === 'icon') return item.content.leading.iconKey;
  switch (item.verb) {
    case 'message.posted':
      return 'MessageSquareDot';
    case 'message.mentioned':
      return 'AtSign';
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

export function makeActivityItemStyles(C: AppColors) {
  return StyleSheet.create({
    // Outer wrapper owns horizontal margin (inbox SectionList / home ScrollView)
    itemOuter: { marginHorizontal: 16 },

    // Item card
    itemWrap: {
      borderRadius: 14,
      backgroundColor: C.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 14,
      overflow: 'hidden',
      minHeight: 80,
    },
    itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },

    // Avatar
    avatarWrap: { width: 28, flexShrink: 0, marginTop: 2, alignItems: 'center', gap: 6 },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Unread dot
    unreadDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
    readIcon: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },

    // Content
    content: { flex: 1 },
    headlineRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 5,
      marginBottom: 5,
    },
    headlineText: { fontSize: 16, lineHeight: 22 },
    bold: { fontWeight: '700' },

    // Emphasis badge
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    badgeText: { fontSize: 14, fontWeight: '600' },

    // Meta row
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { fontSize: 14 },
    metaDot: { width: 3, height: 3, borderRadius: 2 },

    // Preview card (summary / expanded content)
    previewCard: {
      marginTop: 10,
      marginLeft: 42,
      borderRadius: 12,
      borderWidth: 1,
      padding: 14,
    },
    previewText: { fontSize: 15, lineHeight: 20 },

    // Read more
    readMoreBtn: { marginTop: 8, marginLeft: 42 },
    readMoreText: { fontSize: 14, fontWeight: '600' },

    // Action button
    actionBtn: {
      alignSelf: 'flex-start',
      marginTop: 10,
      marginLeft: 42,
      borderRadius: 20,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    actionBtnText: { fontSize: 14, fontWeight: '600' },

    // Sub-items container
    subItemsWrap: { marginTop: 10, marginLeft: 42, borderLeftWidth: 2, paddingLeft: 12 },

    // Sub-activity: full leaf view
    subItemInner: { paddingVertical: 10 },
    subAvatarWrap: {
      width: 24,
      flexShrink: 0,
      marginTop: 2,
      alignItems: 'center',
      gap: 5,
    },
    subAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    subPreviewCard: {
      marginTop: 8,
      marginLeft: 34,
      borderRadius: 10,
      borderWidth: 1,
      padding: 12,
    },
    subReadMoreBtn: { marginTop: 6, marginLeft: 34 },
    subActionBtn: {
      alignSelf: 'flex-start',
      marginTop: 8,
      marginLeft: 34,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
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
  const time = relativeTime(item.timestamps.occurredAt);
  const isRead = item.state?.isRead ?? false;
  const isExpanded = expandedIds.has(item.ids.id);
  const previewText =
    item.content.summary?.trim() || item.content.preview?.text?.trim() || '';
  const hasPreviewText = previewText.length > 0;
  const expandedContent = item.content.expandedContent?.trim();
  const hasExpandedContent = Boolean(expandedContent);
  const hasActionBtn = !!item.content.actionButton && !isSubActivity;
  const canShowFeedbackRequest =
    item.kind === 'leaf' &&
    item.verb === 'session.feedback_request.sent' &&
    canRenderMobileActivityFeedbackRequest(item);
  const shouldShowPreviewText = hasPreviewText && !canShowFeedbackRequest;
  const shouldShowActionButton = hasActionBtn && !canShowFeedbackRequest;
  const primary = formatActivityPrimaryHeadline(item, viewerTimezone);
  const { secondary, emphasis } = item.content.headline;
  const tabLabel = TAB_LABELS[item.tabKey] ?? item.tabKey;

  const handlePress = () => {
    if (!isRead) onMarkRead(item.ids.id);
    if (hasExpandedContent) onToggle(item.ids.id);
  };

  const handleActionPress = () => {
    if (!isRead) onMarkRead(item.ids.id);
    onActionPress?.(item);
  };

  // Sub-activity: full leaf view matching web
  if (isSubActivity) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [s.subItemInner, pressed && { opacity: 0.7 }]}
      >
        <View style={s.itemRow}>
          <View style={s.subAvatarWrap}>
            <View style={[s.subAvatar, { backgroundColor: iconBg }]}>
              <IconComponent size={10} color={iconFg} />
            </View>
            {isRead ? (
              <View
                style={s.readIcon}
                accessibilityLabel="Read"
                accessibilityRole="image"
                testID="activity-read-indicator"
              >
                <CheckCheck size={12} color={colors.textMuted} />
              </View>
            ) : (
              <View
                style={[s.unreadDot, { backgroundColor: colors.teal }]}
                accessibilityLabel="Unread"
                testID="activity-unread-indicator"
              />
            )}
          </View>

          <View style={s.content}>
            <View style={s.headlineRow}>
              <Text style={[s.headlineText, { color: colors.text }]}>
                <Text style={s.bold}>{primary}</Text>
                {!!secondary && ` ${secondary}`}
              </Text>
            </View>
            <View style={s.metaRow}>
              <Text style={[s.metaText, { color: colors.textMuted }]}>{time}</Text>
            </View>
          </View>
        </View>

        {hasPreviewText && (
          <View
            style={[
              s.subPreviewCard,
              { borderColor: colors.border, backgroundColor: colors.inputBg },
            ]}
          >
            <Text style={[s.previewText, { color: colors.text }]} numberOfLines={3}>
              {previewText}
            </Text>
          </View>
        )}

        {hasExpandedContent && isExpanded && (
          <View
            style={[
              s.subPreviewCard,
              { borderColor: colors.border, backgroundColor: colors.inputBg },
            ]}
          >
            <Text style={[s.previewText, { color: colors.text }]}>{expandedContent}</Text>
          </View>
        )}

        {hasExpandedContent && (
          <TouchableOpacity
            onPress={() => onToggle(item.ids.id)}
            hitSlop={8}
            style={s.subReadMoreBtn}
          >
            <Text style={[s.readMoreText, { color: colors.teal }]}>
              {isExpanded ? 'Show less' : 'Read more'}
            </Text>
          </TouchableOpacity>
        )}

        {!!item.content.actionButton && (
          <TouchableOpacity
            style={[s.subActionBtn, { borderColor: colors.border }]}
            onPress={handleActionPress}
            accessibilityRole="button"
          >
            <Text style={[s.actionBtnText, { color: colors.text }]}>
              {item.content.actionButton.label}
            </Text>
          </TouchableOpacity>
        )}
      </Pressable>
    );
  }

  return (
    <View style={s.itemOuter}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          s.itemWrap,
          pressed && { backgroundColor: colors.inputBg },
        ]}
      >
        {/* Row: avatar + content + unread dot */}
        <View style={s.itemRow}>
          <View style={s.avatarWrap}>
            <View style={[s.avatar, { backgroundColor: iconBg }]}>
              <IconComponent size={11} color={iconFg} />
            </View>
            {isRead ? (
              <View
                style={s.readIcon}
                accessibilityLabel="Read"
                accessibilityRole="image"
                testID="activity-read-indicator"
              >
                <CheckCheck size={13} color={colors.textMuted} />
              </View>
            ) : (
              <View
                style={[s.unreadDot, { backgroundColor: colors.teal }]}
                accessibilityLabel="Unread"
                testID="activity-unread-indicator"
              />
            )}
          </View>

          <View style={s.content}>
            <View style={s.headlineRow}>
              <Text style={[s.headlineText, { color: colors.text }]}>
                <Text style={s.bold}>{primary}</Text>
                {!!secondary && ` ${secondary}`}
              </Text>
              {!!emphasis && (
                <View style={[s.badge, { backgroundColor: iconBg }]}>
                  <IconComponent size={9} color={iconFg} />
                  <Text style={[s.badgeText, { color: iconFg }]}>{emphasis}</Text>
                </View>
              )}
            </View>

            <View style={s.metaRow}>
              <Text style={[s.metaText, { color: colors.textMuted }]}>{time}</Text>
              {!!tabLabel && tabLabel !== 'All' && (
                <>
                  <View style={[s.metaDot, { backgroundColor: colors.textFaint }]} />
                  <Text style={[s.metaText, { color: colors.textMuted }]}>
                    {tabLabel}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Preview card — summary text */}
        {shouldShowPreviewText && (
          <View
            style={[
              s.previewCard,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <Text style={[s.previewText, { color: colors.text }]} numberOfLines={4}>
              {previewText}
            </Text>
          </View>
        )}

        {canShowFeedbackRequest && (
          <ActivityFeedbackRequest
            activity={item}
            colors={colors}
            currentProfileId={currentProfileId}
          />
        )}

        {/* Expanded detail card */}
        {hasExpandedContent && isExpanded && (
          <View
            style={[
              s.previewCard,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <Text style={[s.previewText, { color: colors.text }]}>{expandedContent}</Text>
          </View>
        )}

        {/* Read more link */}
        {hasExpandedContent && (
          <TouchableOpacity
            onPress={() => onToggle(item.ids.id)}
            hitSlop={8}
            style={s.readMoreBtn}
          >
            <Text style={[s.readMoreText, { color: colors.teal }]}>
              {isExpanded ? 'Show less' : 'Read more'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Action button */}
        {shouldShowActionButton && (
          <TouchableOpacity
            style={[s.actionBtn, { borderColor: colors.border }]}
            onPress={handleActionPress}
            accessibilityRole="button"
          >
            <Text style={[s.actionBtnText, { color: colors.text }]}>
              {item.content.actionButton!.label}
            </Text>
          </TouchableOpacity>
        )}
      </Pressable>
    </View>
  );
}
