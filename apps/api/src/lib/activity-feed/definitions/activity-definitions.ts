import type {
  ActivityImportanceVM,
  ActivityItemContentVM,
  ActivityVerbVM,
  InboxActionButtonVM,
  InboxLeadingVM,
  InboxTabKeyVM,
  NotificationDeliveryChannel,
} from '@iconicedu/shared-types';
import type { ActivityEventRow } from '@iconicedu/shared-types';
import type { SupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { resolveRecipientsForActivityEvent } from '@iconicedu/api/lib/activity-feed/projector/recipient-resolution';
import { formatDateTime, resolveViewerTimezone } from '@iconicedu/utils';
import { formatSessionReminderStartCopy } from '@iconicedu/api/lib/notifications/session-reminder-copy';
import { buildSessionCompletionCopy } from '@iconicedu/api/lib/notifications/session-completion-copy';

export type ActivityRenderResult = {
  verb: ActivityVerbVM;
  leading?: InboxLeadingVM;
  headline: ActivityItemContentVM['headline'];
  summary?: string;
  preview?: ActivityItemContentVM['preview'];
  actionButton?: InboxActionButtonVM;
  expandedContent?: string;
  metadata?: Record<string, unknown>;
};

export type ActivityEventDefinition = {
  eventType: string;
  tabKey: InboxTabKeyVM;
  importance?: ActivityImportanceVM;
  notification?: {
    defaultChannels: NotificationDeliveryChannel[];
    timing: 'immediate' | 'standard' | 'digest';
    isCritical?: boolean;
    presenceAware?: boolean;
    prefKey?: string;
  };
  resolveRecipients: (
    supabase: SupabaseServiceClient,
    event: ActivityEventRow,
  ) => Promise<string[]>;
  render: (event: ActivityEventRow) => ActivityRenderResult;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string => typeof entry === 'string' && entry.length > 0,
      )
    : [];
}

function formatNamesList(names: string[]) {
  const uniqueNames = Array.from(new Set(names.filter(Boolean)));
  if (!uniqueNames.length) return undefined;
  if (uniqueNames.length === 1) return uniqueNames[0];
  if (uniqueNames.length === 2) return `${uniqueNames[0]} and ${uniqueNames[1]}`;
  return `${uniqueNames[0]}, ${uniqueNames[1]} +${uniqueNames.length - 2} more`;
}

function getContextTitle(payload: Record<string, unknown>) {
  return (
    asOptionalString(payload.learningSpaceTitle) ??
    asOptionalString(payload.channelTopic) ??
    asOptionalString(payload.title)
  );
}

function getActivityContext(payload: Record<string, unknown>) {
  const context = asRecord(payload.activityContext);
  return {
    viewerRole:
      asOptionalString(context.viewerRole) ?? asOptionalString(payload.viewerRole),
    viewerIsAdminStaff:
      context.viewerIsAdminStaff === true || payload.viewerIsAdminStaff === true,
    classTitle:
      asOptionalString(context.classTitle) ??
      asOptionalString(context.contextTitle) ??
      getContextTitle(payload),
    contextTitle: asOptionalString(context.contextTitle) ?? getContextTitle(payload),
    teacherNames: asStringArray(context.teacherNames),
    studentNames: asStringArray(context.studentNames),
    guardianNames: asStringArray(context.guardianNames),
    viewerStudentNames: asStringArray(context.viewerStudentNames),
    participantNamesLabel: asOptionalString(context.participantNamesLabel),
  };
}

function formatCompactNames(names: string[], suffix?: string) {
  const uniqueNames = Array.from(new Set(names.filter(Boolean)));
  if (!uniqueNames.length) return undefined;
  if (uniqueNames.length === 1) return uniqueNames[0];

  const extraCount = uniqueNames.length - 1;
  const suffixText = suffix ? ` ${extraCount === 1 ? suffix : `${suffix}s`}` : '';
  return `${uniqueNames[0]} + ${extraCount}${suffixText}`;
}

function buildRoleContextLabel(payload: Record<string, unknown>) {
  const context = getActivityContext(payload);
  const viewerRole = context.viewerRole;
  const teacherLabel = formatCompactNames(context.teacherNames);
  const studentNames =
    viewerRole === 'guardian' && context.viewerStudentNames.length
      ? context.viewerStudentNames
      : context.studentNames;
  const studentLabel = formatCompactNames(
    studentNames,
    viewerRole === 'educator' ? 'student' : undefined,
  );
  const guardianLabel = formatCompactNames(context.guardianNames);

  if (context.viewerIsAdminStaff || viewerRole === 'staff') {
    const parts = [
      guardianLabel ? `Parent: ${guardianLabel}` : undefined,
      studentLabel ? `Student: ${studentLabel}` : undefined,
      teacherLabel ? `Teacher: ${teacherLabel}` : undefined,
    ].filter((part): part is string => Boolean(part));
    return parts.length ? parts.join(' · ') : undefined;
  }

  if (viewerRole === 'guardian') {
    if (studentLabel && teacherLabel) return `For ${studentLabel} with ${teacherLabel}`;
    if (studentLabel) return `For ${studentLabel}`;
    if (teacherLabel) return `With ${teacherLabel}`;
    return undefined;
  }

  if (viewerRole === 'educator') {
    return studentLabel ? `With ${studentLabel}` : undefined;
  }

  if (viewerRole === 'child') {
    return teacherLabel ? `With ${teacherLabel}` : undefined;
  }

  if (studentLabel && teacherLabel) return `For ${studentLabel} with ${teacherLabel}`;
  if (teacherLabel) return `With ${teacherLabel}`;
  if (studentLabel) return `With ${studentLabel}`;
  return undefined;
}

function getDisplayTimezone(payload: Record<string, unknown>) {
  return resolveViewerTimezone(
    asOptionalString(payload.viewerTimezone) ??
      asOptionalString(payload.recipientTimezone) ??
      asOptionalString(payload.timezone) ??
      asOptionalString(payload.firstSessionTimezone),
  );
}

function formatSessionDateTime(value: unknown, payload: Record<string, unknown>) {
  if (typeof value !== 'string' || !value.length) return undefined;
  return formatDateTime(value, getDisplayTimezone(payload), 'natural');
}

function firstOptionalString(...values: unknown[]) {
  for (const value of values) {
    const normalized = asOptionalString(value);
    if (normalized) return normalized;
  }
  return undefined;
}

function joinSecondaryParts(parts: Array<string | undefined>) {
  const normalized = parts.filter((part): part is string => Boolean(part));
  return normalized.length ? normalized.join(' · ') : undefined;
}

function buildRoleAwareContextLabel(payload: Record<string, unknown>) {
  const context = getActivityContext(payload);
  const classTitle = context.classTitle ?? getContextTitle(payload);
  if (!classTitle) {
    return undefined;
  }

  const teacherLabel = formatNamesList(context.teacherNames);
  const studentLabel = formatNamesList(
    context.viewerRole === 'guardian' && context.viewerStudentNames.length
      ? context.viewerStudentNames
      : context.studentNames,
  );
  const guardianLabel = formatNamesList(context.guardianNames);

  if (context.viewerIsAdminStaff) {
    const parts = [
      studentLabel,
      guardianLabel ? `parents ${guardianLabel}` : undefined,
      teacherLabel ? `teacher ${teacherLabel}` : undefined,
    ].filter((part): part is string => Boolean(part));
    return parts.length ? `${classTitle}: ${parts.join(', ')}` : classTitle;
  }

  if (context.viewerRole === 'guardian') {
    if (studentLabel && teacherLabel)
      return `${classTitle} for ${studentLabel} with ${teacherLabel}`;
    if (studentLabel) return `${classTitle} for ${studentLabel}`;
    if (teacherLabel) return `${classTitle} with ${teacherLabel}`;
    return classTitle;
  }

  if (context.viewerRole === 'educator') {
    return studentLabel ? `${classTitle} with ${studentLabel}` : classTitle;
  }

  if (context.viewerRole === 'child') {
    return teacherLabel ? `${classTitle} with ${teacherLabel}` : classTitle;
  }

  if (teacherLabel) return `${classTitle} with ${teacherLabel}`;
  return classTitle;
}

function buildCommonContextMetadata(payload: Record<string, unknown>) {
  const context = getActivityContext(payload);
  return {
    classTitle: context.classTitle,
    contextTitle: context.contextTitle,
    teacherNames: context.teacherNames,
    studentNames: context.studentNames,
    guardianNames: context.guardianNames,
    viewerStudentNames: context.viewerStudentNames,
    participantNamesLabel: context.participantNamesLabel,
  };
}

function getLearningSpaceId(event: ActivityEventRow, payload: Record<string, unknown>) {
  const scope = asRecord(event.scope);
  return (
    asOptionalString(payload.learningSpaceId) ??
    (scope.kind === 'learning_space'
      ? asOptionalString(scope.learningSpaceId)
      : undefined)
  );
}

function buildInboxSourceHref(event: ActivityEventRow, payload: Record<string, unknown>) {
  const explicitHref = asOptionalString(payload.href);
  if (explicitHref) {
    return explicitHref;
  }

  const channelId = asOptionalString(payload.channelId);
  if (!channelId) {
    return undefined;
  }

  const orgSlug = asOptionalString(payload.orgSlug);
  const basePath = orgSlug ? `/${orgSlug}` : '..';
  const routeKind = payload.channelRouteKind;
  if (routeKind === 'dm') {
    return `${basePath}/dm/${channelId}`;
  }
  if (routeKind === 'channel') {
    return `${basePath}/c/${channelId}`;
  }

  if (routeKind === 'space' || getLearningSpaceId(event, payload)) {
    return `${basePath}/s/${channelId}`;
  }

  return `${basePath}/c/${channelId}`;
}

function sourceAction(
  event: ActivityEventRow,
  payload: Record<string, unknown>,
  variant: InboxActionButtonVM['variant'] = 'outline',
  customLabel?: string,
) {
  const href = buildInboxSourceHref(event, payload);
  if (!href) {
    return undefined;
  }

  return {
    label: customLabel ?? 'Open',
    variant,
    href,
  } satisfies InboxActionButtonVM;
}

function resolveMessageNoun(payload: Record<string, unknown>) {
  const dmMessageKind = asOptionalString(payload.dmMessageKind);
  if (dmMessageKind === 'image') {
    return 'an image';
  }
  if (dmMessageKind === 'audio') {
    return 'a voice message';
  }
  if (dmMessageKind === 'file') {
    return 'a file';
  }
  return 'a message';
}

type MessageRenderVariant =
  | 'message'
  | 'mention'
  | 'thread_reply'
  | 'file'
  | 'image'
  | 'audio';

function getMessagePreview(payload: Record<string, unknown>) {
  return (
    asOptionalString(payload.messagePreview) ??
    asOptionalString(payload.content) ??
    undefined
  );
}

function getFileName(payload: Record<string, unknown>) {
  return (
    asOptionalString(payload.fileName) ??
    asOptionalString(payload.name) ??
    asOptionalString(payload.content)
  );
}

function buildFileDetails(payload: Record<string, unknown>, fallback: string) {
  const details = [
    getFileName(payload) ?? fallback,
    asOptionalString(payload.mimeType),
    asOptionalString(payload.content),
  ].filter((part): part is string => Boolean(part));
  return Array.from(new Set(details)).join('\n');
}

function renderMessageItem(
  event: ActivityEventRow,
  verb: ActivityVerbVM,
  variant: MessageRenderVariant,
) {
  const payload = asRecord(event.payload);
  const senderName = asString(payload.senderName, 'Someone');
  const contextLabel = buildRoleAwareContextLabel(payload) ?? getContextTitle(payload);
  const isDirect = payload.channelRouteKind === 'dm';
  const href = buildInboxSourceHref(event, payload);
  const fileName = getFileName(payload);
  const messagePreview = getMessagePreview(payload);
  const iconKey =
    variant === 'mention'
      ? 'AtSign'
      : variant === 'thread_reply'
        ? 'MessageSquareReply'
        : variant === 'file'
          ? 'FileBadge'
          : variant === 'image'
            ? 'BookImage'
            : variant === 'audio'
              ? 'FileHeadphone'
              : isDirect
                ? 'MessagesSquare'
                : 'MessageSquareDot';
  const secondary =
    variant === 'mention'
      ? isDirect
        ? 'mentioned you in a direct message'
        : contextLabel
          ? `mentioned you in ${contextLabel}`
          : 'mentioned you'
      : variant === 'thread_reply'
        ? isDirect
          ? 'replied in your direct message thread'
          : contextLabel
            ? `replied in a thread in ${contextLabel}`
            : 'replied in a thread'
        : variant === 'file'
          ? isDirect
            ? 'shared a file with you'
            : contextLabel
              ? `shared a file in ${contextLabel}`
              : 'shared a file'
          : variant === 'image'
            ? isDirect
              ? 'shared an image with you'
              : contextLabel
                ? `shared an image in ${contextLabel}`
                : 'shared an image'
            : variant === 'audio'
              ? isDirect
                ? 'sent you a voice message'
                : contextLabel
                  ? `sent a voice message in ${contextLabel}`
                  : 'sent a voice message'
              : isDirect
                ? 'sent you a direct message'
                : contextLabel
                  ? `sent a message in ${contextLabel}`
                  : `sent ${resolveMessageNoun(payload)}`;
  const summary =
    variant === 'file' || variant === 'image' || variant === 'audio'
      ? fileName
      : messagePreview;
  const expandedContent =
    variant === 'file'
      ? buildFileDetails(payload, 'File details')
      : variant === 'image'
        ? buildFileDetails(payload, 'Image preview')
        : variant === 'audio'
          ? buildFileDetails(payload, 'Audio player')
          : messagePreview;
  const actionLabel =
    variant === 'mention'
      ? isDirect
        ? 'Reply'
        : 'View mention'
      : variant === 'thread_reply'
        ? 'Open thread'
        : variant === 'file'
          ? 'Open file'
          : variant === 'image'
            ? 'View image'
            : variant === 'audio'
              ? 'Play audio'
              : isDirect
                ? 'Reply'
                : 'Open message';

  return {
    verb,
    leading: { kind: 'icon', iconKey, tone: 'info' },
    headline: {
      primary: senderName,
      secondary,
      secondaryHref: href,
    },
    summary,
    preview: summary ? { text: summary } : undefined,
    expandedContent,
    actionButton: sourceAction(event, payload, 'outline', actionLabel),
    metadata: {
      ...buildCommonContextMetadata(payload),
      channelId: asOptionalString(payload.channelId),
      channelRouteKind:
        payload.channelRouteKind === 'space' ||
        payload.channelRouteKind === 'dm' ||
        payload.channelRouteKind === 'channel'
          ? payload.channelRouteKind
          : undefined,
      messageId: asOptionalString(payload.messageId),
      threadId: asOptionalString(payload.threadId),
      fileName,
      threadReply: payload.threadReply === true,
    },
  } satisfies ActivityRenderResult;
}

function renderUnviewedClassroomMessageItem(event: ActivityEventRow) {
  const payload = asRecord(event.payload);
  const senderName = asString(payload.senderName, 'Someone');
  const classTitle = getContextTitle(payload) ?? 'Classroom';
  const names = asStringArray(payload.unviewedParticipantNames);
  const participantLabel =
    formatNamesList(names) ??
    `${typeof payload.unviewedParticipantCount === 'number' ? payload.unviewedParticipantCount : 'Some'} participant(s)`;
  const thresholdHours =
    typeof payload.thresholdHours === 'number' ? payload.thresholdHours : 4;
  const summary = `${participantLabel} has not viewed ${senderName}'s message after ${thresholdHours} hours.`;

  return {
    verb: 'message.unviewed_intended_participants',
    leading: { kind: 'icon', iconKey: 'AlertCircle', tone: 'warning' },
    headline: {
      primary: `${classTitle} message not viewed`,
      secondary: summary,
      secondaryHref: buildInboxSourceHref(event, payload),
    },
    summary,
    preview: { text: summary },
    expandedContent: names.length
      ? `Unviewed intended participants\n${names.join('\n')}`
      : summary,
    actionButton: sourceAction(event, payload, 'outline', 'Open message'),
    metadata: {
      ...buildCommonContextMetadata(payload),
      channelId: asOptionalString(payload.channelId),
      channelRouteKind: payload.channelRouteKind === 'space' ? 'space' : undefined,
      messageId: asOptionalString(payload.messageId),
      senderProfileId: asOptionalString(payload.senderProfileId),
      unviewedParticipantIds: asStringArray(payload.unviewedParticipantIds),
      unviewedParticipantNames: names,
      thresholdHours,
    },
  } satisfies ActivityRenderResult;
}

function renderReactionItem(event: ActivityEventRow) {
  const payload = asRecord(event.payload);
  const senderName = asString(payload.senderName, 'Someone');
  const emoji = asString(payload.emoji, '😀');
  const isDirect = payload.channelRouteKind === 'dm';
  const contextLabel = buildRoleAwareContextLabel(payload) ?? getContextTitle(payload);
  const messagePreview = getMessagePreview(payload);

  return {
    verb: 'reaction.added',
    leading: {
      kind: 'icon',
      iconKey: isDirect ? 'MessageSquare' : 'SmilePlus',
      tone: 'info',
    },
    headline: {
      primary: isDirect
        ? `${senderName} reacted ${emoji} to your direct message`
        : contextLabel
          ? `${senderName} reacted ${emoji} to your message in ${contextLabel}`
          : `${senderName} reacted ${emoji} to your message`,
      secondaryHref: buildInboxSourceHref(event, payload),
    },
    summary: messagePreview ? `Your message: ${messagePreview}` : undefined,
    preview: messagePreview ? { text: `Your message: ${messagePreview}` } : undefined,
    expandedContent: messagePreview
      ? `Original message with reaction context\n${messagePreview}`
      : 'Original message with reaction context',
    actionButton: sourceAction(event, payload, 'outline', 'View message'),
    metadata: {
      ...buildCommonContextMetadata(payload),
      channelId: asOptionalString(payload.channelId),
      channelRouteKind:
        payload.channelRouteKind === 'space' ||
        payload.channelRouteKind === 'dm' ||
        payload.channelRouteKind === 'channel'
          ? payload.channelRouteKind
          : undefined,
      messageId: asOptionalString(payload.messageId),
      threadId: asOptionalString(payload.threadId),
      emoji,
    },
  } satisfies ActivityRenderResult;
}

type ScheduleRenderVariant = 'created' | 'ended';
type SessionRenderVariant =
  | 'rescheduled'
  | 'canceled'
  | 'cancel_restored'
  | 'reschedule_requested'
  | 'cancel_requested'
  | 'change_request_approved'
  | 'change_request_rejected'
  | 'reminder'
  | 'feedback';

function renderScheduleItem(event: ActivityEventRow, variant: ScheduleRenderVariant) {
  const payload = asRecord(event.payload);
  const classTitle =
    getActivityContext(payload).classTitle ?? getContextTitle(payload) ?? 'Class';
  const roleContext = buildRoleContextLabel(payload);
  const startAt = firstOptionalString(payload.startAt, payload.firstSessionStartAt);
  const endAt = firstOptionalString(payload.recurrenceUntil, payload.until);
  const startLabel = formatSessionDateTime(startAt, payload);
  const endLabel = formatSessionDateTime(endAt, payload);

  const config = {
    created: {
      verb: 'class.schedule.created' as const,
      iconKey: 'CalendarCheck' as const,
      tone: 'info' as const,
      secondary: joinSecondaryParts([
        'new schedule added',
        roleContext,
        startLabel ? `Starts ${startLabel}` : undefined,
      ]),
      summary: startLabel
        ? `${classTitle} has a new schedule starting ${startLabel}`
        : `${classTitle} has a new schedule`,
    },
    ended: {
      verb: 'class.schedule.ended' as const,
      iconKey: 'CalendarX' as const,
      tone: 'warning' as const,
      secondary: joinSecondaryParts([
        'schedule end date set',
        roleContext,
        endLabel ? `Ends ${endLabel}` : undefined,
      ]),
      summary: endLabel
        ? `${classTitle} schedule now ends ${endLabel}`
        : `${classTitle} schedule has an end date`,
    },
  }[variant];

  return {
    verb: config.verb,
    leading: { kind: 'icon', iconKey: config.iconKey, tone: config.tone },
    headline: {
      primary: classTitle,
      secondary: config.secondary,
      secondaryHref: buildInboxSourceHref(event, payload),
    },
    summary: config.summary,
    preview: { text: config.summary },
    actionButton: sourceAction(event, payload, 'outline', 'Open class'),
    metadata: {
      ...buildCommonContextMetadata(payload),
      roleContext,
      channelId: asOptionalString(payload.channelId),
      learningSpaceId: asOptionalString(payload.learningSpaceId),
      scheduleId: asOptionalString(payload.scheduleId),
      startAt,
      endAt,
    },
  } satisfies ActivityRenderResult;
}

function renderSessionItem(event: ActivityEventRow, variant: SessionRenderVariant) {
  const payload = asRecord(event.payload);
  const classTitle =
    getActivityContext(payload).classTitle ?? getContextTitle(payload) ?? 'Class';
  const roleContext = buildRoleContextLabel(payload);
  const oldStartAt = firstOptionalString(
    payload.oldSessionDateTime,
    payload.rescheduledFromStartAt,
    payload.previousStartAt,
    payload.originalStartAt,
    payload.occurrenceStart,
  );
  const newStartAt = firstOptionalString(
    payload.newSessionDateTime,
    payload.rescheduledToStartAt,
    payload.newStartAt,
    payload.startAt,
    payload.firstSessionStartAt,
  );
  const sessionStartAt = firstOptionalString(
    payload.sessionDateTime,
    payload.canceledStartAt,
    payload.restoredStartAt,
    payload.startAt,
    payload.occurrenceStart,
    payload.firstSessionStartAt,
  );
  const oldLabel = formatSessionDateTime(oldStartAt, payload);
  const newLabel = formatSessionDateTime(newStartAt, payload);
  const sessionLabel = formatSessionDateTime(sessionStartAt, payload);
  const rescheduledReason = firstOptionalString(
    payload.rescheduledReason,
    payload.reason,
  );
  const canceledReason = firstOptionalString(payload.canceledReason, payload.reason);
  const restoredReason = firstOptionalString(payload.restoredReason, payload.reason);
  const requestedStartAt = firstOptionalString(payload.requestedStartAt);
  const requestedLabel = formatSessionDateTime(requestedStartAt, payload);
  const requestedByName = firstOptionalString(payload.requestedByName);
  const requestNote = firstOptionalString(payload.requestedNote);
  const decisionNote = firstOptionalString(payload.decisionNote);
  const reminderSessionLabel = formatSessionDateTime(
    firstOptionalString(
      payload.sessionDateTime,
      payload.startAt,
      payload.occurrenceStart,
    ),
    payload,
  );

  const config = {
    rescheduled: {
      verb: 'class.session.rescheduled' as const,
      iconKey: 'CalendarCheck' as const,
      tone: 'info' as const,
      primary: classTitle,
      secondary: joinSecondaryParts([
        'session was rescheduled',
        roleContext,
        newLabel ? `New time: ${newLabel}` : undefined,
      ]),
      summary:
        oldLabel && newLabel
          ? `${classTitle} session ${oldLabel} was moved to ${newLabel}`
          : newLabel
            ? `${classTitle} session was moved to ${newLabel}`
            : undefined,
      expandedContent: rescheduledReason ? `Reason: ${rescheduledReason}` : undefined,
      actionLabel: 'Open class',
    },
    canceled: {
      verb: 'class.session.canceled' as const,
      iconKey: 'CalendarX' as const,
      tone: 'warning' as const,
      primary: classTitle,
      secondary: sessionLabel
        ? joinSecondaryParts([`session ${sessionLabel} was canceled`, roleContext])
        : joinSecondaryParts(['session was canceled', roleContext]),
      summary: sessionLabel
        ? `${classTitle} session ${sessionLabel} was canceled`
        : `${classTitle} session was canceled`,
      expandedContent: canceledReason ? `Reason: ${canceledReason}` : undefined,
      actionLabel: 'Open class',
    },
    cancel_restored: {
      verb: 'class.session.cancel_restored' as const,
      iconKey: 'CalendarCheck' as const,
      tone: 'success' as const,
      primary: classTitle,
      secondary: sessionLabel
        ? joinSecondaryParts([
            `session ${sessionLabel} cancellation was restored`,
            roleContext,
          ])
        : joinSecondaryParts(['session cancellation was restored', roleContext]),
      summary: sessionLabel
        ? `${classTitle} session ${sessionLabel} is back on the calendar`
        : `${classTitle} session is back on the calendar`,
      expandedContent: restoredReason ? `Reason: ${restoredReason}` : undefined,
      actionLabel: 'Open class',
    },
    reschedule_requested: {
      verb: 'class.session.reschedule_requested' as const,
      iconKey: 'CalendarCheck' as const,
      tone: 'warning' as const,
      primary: classTitle,
      secondary: joinSecondaryParts([
        requestedByName
          ? `${requestedByName} requested a reschedule`
          : 'reschedule requested',
        roleContext,
        requestedLabel ? `Requested time: ${requestedLabel}` : undefined,
      ]),
      summary: requestedLabel
        ? `${classTitle} reschedule requested for ${requestedLabel}`
        : `${classTitle} reschedule requested`,
      expandedContent: requestNote ? `Note: ${requestNote}` : undefined,
      actionLabel: 'Open class',
    },
    cancel_requested: {
      verb: 'class.session.cancel_requested' as const,
      iconKey: 'CalendarX' as const,
      tone: 'warning' as const,
      primary: classTitle,
      secondary: joinSecondaryParts([
        requestedByName
          ? `${requestedByName} requested a cancellation`
          : 'cancellation requested',
        roleContext,
        sessionLabel,
      ]),
      summary: sessionLabel
        ? `${classTitle} cancellation requested for ${sessionLabel}`
        : `${classTitle} cancellation requested`,
      expandedContent: requestNote ? `Note: ${requestNote}` : undefined,
      actionLabel: 'Open class',
    },
    change_request_approved: {
      verb: 'class.session.change_request.approved' as const,
      iconKey: 'CheckCircle2' as const,
      tone: 'success' as const,
      primary: classTitle,
      secondary: joinSecondaryParts(['session change approved', roleContext]),
      summary: `${classTitle} session change approved`,
      expandedContent: decisionNote ? `Decision note: ${decisionNote}` : undefined,
      actionLabel: 'Open class',
    },
    change_request_rejected: {
      verb: 'class.session.change_request.rejected' as const,
      iconKey: 'AlertCircle' as const,
      tone: 'warning' as const,
      primary: classTitle,
      secondary: joinSecondaryParts(['session change declined', roleContext]),
      summary: `${classTitle} session change declined`,
      expandedContent: decisionNote ? `Decision note: ${decisionNote}` : undefined,
      actionLabel: 'Open class',
    },
    reminder: {
      verb: 'session.reminder.sent' as const,
      iconKey: 'Bell' as const,
      tone: 'info' as const,
      primary: classTitle,
      secondary: joinSecondaryParts([
        formatSessionReminderStartCopy({ startAt: sessionStartAt, payload }),
        roleContext,
      ]),
      summary: reminderSessionLabel
        ? (formatSessionReminderStartCopy({ startAt: sessionStartAt, payload }) ??
          `${classTitle} is scheduled for ${reminderSessionLabel}`)
        : (asOptionalString(payload.summary) ?? `${classTitle} session reminder`),
      expandedContent: firstOptionalString(
        payload.joinDetails,
        payload.outline,
        payload.sessionNotes,
      ),
      actionLabel: 'Open class',
    },
    feedback: {
      verb: 'session.feedback_request.sent' as const,
      iconKey: 'Star' as const,
      tone: 'info' as const,
      primary: `Share feedback for ${classTitle}`,
      secondary: joinSecondaryParts([
        roleContext,
        'Your feedback helps improve future sessions',
      ]),
      summary: 'Tell us how the session went',
      expandedContent: firstOptionalString(
        payload.feedbackPrompt,
        payload.feedbackDetails,
      ),
      actionLabel: 'Give feedback',
    },
  }[variant];

  return {
    verb: config.verb,
    leading: { kind: 'icon', iconKey: config.iconKey, tone: config.tone },
    headline: {
      primary: config.primary,
      secondary: config.secondary,
      secondaryHref: buildInboxSourceHref(event, payload),
    },
    summary: config.summary,
    preview: config.summary ? { text: config.summary } : undefined,
    expandedContent: config.expandedContent,
    actionButton: sourceAction(event, payload, 'outline', config.actionLabel),
    metadata: {
      ...buildCommonContextMetadata(payload),
      roleContext,
      ...(variant === 'feedback'
        ? {
            sourceEventId: event.id,
            classSessionId: firstOptionalString(
              payload.classSessionId,
              payload.sourceSessionId,
              payload.scheduleId,
            ),
            classroomId: firstOptionalString(
              payload.classroomId,
              payload.learningSpaceId,
            ),
            occurrenceStart: firstOptionalString(
              payload.occurrenceStart,
              payload.startAt,
              sessionStartAt,
            ),
            feedbackUiEnabled: payload.feedbackUiEnabled !== false,
          }
        : {}),
      channelId: asOptionalString(payload.channelId),
      learningSpaceId: asOptionalString(payload.learningSpaceId),
      scheduleId: asOptionalString(payload.scheduleId),
      startAt: sessionStartAt,
      oldStartAt,
      newStartAt,
    },
  } satisfies ActivityRenderResult;
}

const DEFAULT_RECIPIENTS: ActivityEventDefinition['resolveRecipients'] = async (
  supabase,
  event,
) => resolveRecipientsForActivityEvent(supabase, event);

export const ACTIVITY_EVENT_DEFINITIONS: Record<string, ActivityEventDefinition> = {
  'message.posted': {
    eventType: 'message.posted',
    tabKey: 'all',
    importance: 'normal',
    notification: {
      defaultChannels: ['push'],
      timing: 'immediate',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderMessageItem(event, 'message.posted', 'message'),
  },
  'message.mentioned': {
    eventType: 'message.mentioned',
    tabKey: 'all',
    importance: 'important',
    notification: {
      defaultChannels: ['push'],
      timing: 'standard',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderMessageItem(event, 'message.mentioned', 'mention'),
  },
  'message.unviewed_intended_participants': {
    eventType: 'message.unviewed_intended_participants',
    tabKey: 'all',
    importance: 'important',
    notification: {
      defaultChannels: ['push'],
      timing: 'standard',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: renderUnviewedClassroomMessageItem,
  },
  'message.thread_reply.posted': {
    eventType: 'message.thread_reply.posted',
    tabKey: 'all',
    importance: 'normal',
    notification: {
      defaultChannels: ['push'],
      timing: 'standard',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) =>
      renderMessageItem(event, 'message.thread_reply.posted', 'thread_reply'),
  },
  'file.uploaded': {
    eventType: 'file.uploaded',
    tabKey: 'all',
    importance: 'normal',
    notification: {
      defaultChannels: ['push'],
      timing: 'standard',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderMessageItem(event, 'file.uploaded', 'file'),
  },
  'image.uploaded': {
    eventType: 'image.uploaded',
    tabKey: 'all',
    importance: 'normal',
    notification: {
      defaultChannels: ['push'],
      timing: 'standard',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderMessageItem(event, 'image.uploaded', 'image'),
  },
  'audio.uploaded': {
    eventType: 'audio.uploaded',
    tabKey: 'all',
    importance: 'normal',
    notification: {
      defaultChannels: ['push'],
      timing: 'standard',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderMessageItem(event, 'audio.uploaded', 'audio'),
  },
  'reaction.added': {
    eventType: 'reaction.added',
    tabKey: 'all',
    importance: 'normal',
    notification: {
      defaultChannels: ['push'],
      timing: 'standard',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderReactionItem(event),
  },
  'class.schedule.created': {
    eventType: 'class.schedule.created',
    tabKey: 'classes',
    importance: 'important',
    notification: {
      defaultChannels: ['push', 'email'],
      timing: 'immediate',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderScheduleItem(event, 'created'),
  },
  'class.schedule.ended': {
    eventType: 'class.schedule.ended',
    tabKey: 'classes',
    importance: 'important',
    notification: {
      defaultChannels: ['push', 'email'],
      timing: 'immediate',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderScheduleItem(event, 'ended'),
  },
  'class.session.rescheduled': {
    eventType: 'class.session.rescheduled',
    tabKey: 'classes',
    importance: 'important',
    notification: {
      defaultChannels: ['push', 'email'],
      timing: 'immediate',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderSessionItem(event, 'rescheduled'),
  },
  'class.session.canceled': {
    eventType: 'class.session.canceled',
    tabKey: 'classes',
    importance: 'important',
    notification: {
      defaultChannels: ['push', 'email'],
      timing: 'immediate',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderSessionItem(event, 'canceled'),
  },
  'class.session.cancel_restored': {
    eventType: 'class.session.cancel_restored',
    tabKey: 'classes',
    importance: 'important',
    notification: {
      defaultChannels: ['push', 'email'],
      timing: 'immediate',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderSessionItem(event, 'cancel_restored'),
  },
  'class.session.reschedule_requested': {
    eventType: 'class.session.reschedule_requested',
    tabKey: 'classes',
    importance: 'important',
    notification: {
      defaultChannels: ['push', 'email'],
      timing: 'immediate',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderSessionItem(event, 'reschedule_requested'),
  },
  'class.session.cancel_requested': {
    eventType: 'class.session.cancel_requested',
    tabKey: 'classes',
    importance: 'important',
    notification: {
      defaultChannels: ['push', 'email'],
      timing: 'immediate',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderSessionItem(event, 'cancel_requested'),
  },
  'class.session.change_request.approved': {
    eventType: 'class.session.change_request.approved',
    tabKey: 'classes',
    importance: 'important',
    notification: {
      defaultChannels: ['push', 'email'],
      timing: 'immediate',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderSessionItem(event, 'change_request_approved'),
  },
  'class.session.change_request.rejected': {
    eventType: 'class.session.change_request.rejected',
    tabKey: 'classes',
    importance: 'important',
    notification: {
      defaultChannels: ['push', 'email'],
      timing: 'immediate',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderSessionItem(event, 'change_request_rejected'),
  },
  'session.reminder.sent': {
    eventType: 'session.reminder.sent',
    tabKey: 'classes',
    importance: 'normal',
    notification: {
      defaultChannels: ['push'],
      timing: 'immediate',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderSessionItem(event, 'reminder'),
  },
  'session.feedback_request.sent': {
    eventType: 'session.feedback_request.sent',
    tabKey: 'classes',
    importance: 'normal',
    notification: {
      defaultChannels: ['push', 'email'],
      timing: 'standard',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderSessionItem(event, 'feedback'),
  },
  'session.completion_check.sent': {
    eventType: 'session.completion_check.sent',
    tabKey: 'classes',
    importance: 'normal',
    notification: {
      prefKey: 'session.completion_check.sent',
      defaultChannels: ['push', 'email'],
      timing: 'standard',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const classTitle =
        getActivityContext(payload).classTitle ?? getContextTitle(payload) ?? 'Class';
      const sessionStartAt = firstOptionalString(
        payload.occurrenceStart,
        payload.startAt,
      );
      const sessionLabel = formatSessionDateTime(sessionStartAt, payload);
      const completionCopy = buildSessionCompletionCopy(payload);
      return {
        verb: 'session.completion_check.sent',
        leading: { kind: 'icon', iconKey: 'CheckCircle2', tone: 'success' },
        headline: {
          primary: completionCopy.promptTitle,
          secondary: sessionLabel ? `${classTitle} · ${sessionLabel}` : classTitle,
          secondaryHref: buildInboxSourceHref(event, payload),
        },
        summary: completionCopy.promptBody,
        preview: { text: completionCopy.promptBody },
        actionButton: undefined,
        metadata: {
          ...buildCommonContextMetadata(payload),
          sourceEventId: event.id,
          classSessionId: firstOptionalString(payload.scheduleId, payload.classSessionId),
          classroomId: firstOptionalString(payload.learningSpaceId, payload.classroomId),
          channelId: asOptionalString(payload.channelId),
          learningSpaceId: asOptionalString(payload.learningSpaceId),
          scheduleId: asOptionalString(payload.scheduleId),
          occurrenceStart: firstOptionalString(payload.occurrenceStart, payload.startAt),
          feedbackUiEnabled: payload.feedbackUiEnabled !== false,
          completionCheckUiEnabled: true,
          roleContext: getActivityContext(payload).viewerRole,
          completionPromptTitle: completionCopy.promptTitle,
          completionPromptBody: completionCopy.promptBody,
          members: payload.members ?? [],
        },
      } satisfies ActivityRenderResult;
    },
  },
  'session.completion_check.batch.sent': {
    eventType: 'session.completion_check.batch.sent',
    tabKey: 'classes',
    importance: 'normal',
    notification: {
      prefKey: 'session.completion_check.sent',
      defaultChannels: ['push', 'email'],
      timing: 'standard',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const sessionCount =
        typeof payload.sessionCount === 'number' ? payload.sessionCount : 0;
      return {
        verb: 'session.completion_check.batch.sent',
        leading: { kind: 'icon', iconKey: 'CheckCircle2', tone: 'success' },
        headline: {
          primary: `${sessionCount} classes ended`,
          secondary: 'Please confirm how each one went',
        },
        summary: `You have ${sessionCount} classes that need confirmation`,
        preview: { text: `You have ${sessionCount} classes that need confirmation` },
        actionButton: undefined,
        metadata: {
          completionCheckUiEnabled: true,
          roleContext: getActivityContext(payload).viewerRole,
          sessions: payload.sessions ?? [],
          sessionCount,
        },
      } satisfies ActivityRenderResult;
    },
  },
  'session.completion.dispute_reported': {
    eventType: 'session.completion.dispute_reported',
    tabKey: 'classes',
    importance: 'important',
    notification: {
      prefKey: 'session.completion.dispute_reported',
      defaultChannels: ['push', 'email'],
      timing: 'immediate',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const classTitle =
        getActivityContext(payload).classTitle ?? getContextTitle(payload) ?? 'Class';
      const reportedByName = asOptionalString(payload.reportedByDisplayName) ?? 'Someone';
      const disputeCategory =
        asOptionalString(payload.disputeCategory) ?? 'unknown issue';
      const recipientRole = asOptionalString(payload.recipientRole);
      const isStaff = recipientRole === 'staff';
      const educatorNames = asOptionalString(payload.educatorNames);
      const sessionStartAt = firstOptionalString(
        payload.occurrenceStart,
        payload.startAt,
      );
      const sessionLabel = formatSessionDateTime(sessionStartAt, payload);

      const categoryLabel: Record<string, string> = {
        teacher_absent: 'Teacher absent',
        student_absent: 'Student absent',
        technical_issue: 'Technical issue',
        other: 'Other issue',
      };
      const categoryText = categoryLabel[disputeCategory] ?? disputeCategory;

      const secondaryParts = [
        sessionLabel ? `${sessionLabel}` : undefined,
        categoryText,
        isStaff && educatorNames ? `Educator: ${educatorNames}` : undefined,
      ]
        .filter(Boolean)
        .join(' · ');

      const actionLabel = isStaff ? 'View class' : 'Reschedule session';

      return {
        verb: 'session.completion.dispute_reported',
        leading: { kind: 'icon', iconKey: 'AlertCircle', tone: 'warning' },
        headline: {
          primary: `${reportedByName} reported ${classTitle} didn't happen`,
          secondary: secondaryParts || undefined,
          secondaryHref: buildInboxSourceHref(event, payload),
        },
        summary: `${reportedByName} reported that ${classTitle} did not take place · ${categoryText}`,
        preview: {
          text: `${reportedByName} reported that ${classTitle} did not take place`,
        },
        actionButton: sourceAction(event, payload, 'outline', actionLabel),
        metadata: {
          ...buildCommonContextMetadata(payload),
          channelId: asOptionalString(payload.channelId),
          learningSpaceId: asOptionalString(payload.learningSpaceId),
          scheduleId: asOptionalString(payload.scheduleId),
          occurrenceStart: firstOptionalString(payload.occurrenceStart),
          reportedByProfileId: asOptionalString(payload.reportedByProfileId),
          reportedByRole: asOptionalString(payload.reportedByRole),
          disputeCategory,
          disputeReason: asOptionalString(payload.disputeReason),
          rescheduleRequested: payload.rescheduleRequested === true,
          recipientRole,
        },
      } satisfies ActivityRenderResult;
    },
  },
};

export const ActivityEventCatalog = ACTIVITY_EVENT_DEFINITIONS;

export function getActivityEventDefinition(eventType: string) {
  return ACTIVITY_EVENT_DEFINITIONS[eventType];
}

export function listActivityEventDefinitionTypes() {
  return Object.keys(ACTIVITY_EVENT_DEFINITIONS).sort();
}
