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
    viewerRole: asOptionalString(context.viewerRole),
    viewerIsAdminStaff: context.viewerIsAdminStaff === true,
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

function renderClassUpdateGroup(
  event: ActivityEventRow,
  primary: string,
  tone: 'info' | 'warning',
): ActivityRenderResult {
  const payload = asRecord(event.payload);
  const contextLabel = buildRoleAwareContextLabel(payload);
  const reason =
    asOptionalString(payload.rescheduledReason) ??
    asOptionalString(payload.canceledReason);
  const eventSummary = asOptionalString(payload.summary);
  const summaryParts = [
    contextLabel,
    eventSummary,
    reason ? `Reason: ${reason}.` : undefined,
  ].filter((part): part is string => Boolean(part));
  return {
    verb: event.event_type as ActivityVerbVM,
    leading: {
      kind: 'icon',
      iconKey: tone === 'warning' ? 'CalendarX' : 'CalendarCheck',
      tone,
    },
    headline: {
      primary,
      secondary: contextLabel ?? getContextTitle(payload),
      secondaryHref: buildInboxSourceHref(event, payload),
    },
    summary: summaryParts.length ? summaryParts.join(' ') : 'Class schedule updated.',
    actionButton: sourceAction(event, payload, 'outline', 'Open class'),
    metadata: {
      ...buildCommonContextMetadata(payload),
      title: asOptionalString(payload.title),
      scheduleId: asOptionalString(payload.scheduleId),
      timezone: asOptionalString(payload.timezone),
      firstSessionStartAt: asOptionalString(payload.firstSessionStartAt),
      firstSessionTimezone: asOptionalString(payload.firstSessionTimezone),
      rescheduledFromStartAt: asOptionalString(payload.rescheduledFromStartAt),
      rescheduledToStartAt: asOptionalString(payload.rescheduledToStartAt),
      rescheduledReason: asOptionalString(payload.rescheduledReason),
      canceledStartAt: asOptionalString(payload.canceledStartAt),
      canceledReason: asOptionalString(payload.canceledReason),
      sessionLocalTime: true,
      preserveActivitySummary: true,
    },
  };
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

function renderMessageHeadline(payload: Record<string, unknown>) {
  const senderName = asString(payload.senderName, 'Someone');
  const contextTitle = buildRoleAwareContextLabel(payload) ?? getContextTitle(payload);
  const mention = asOptionalString(payload.mentionedProfileId);
  const messageNoun = resolveMessageNoun(payload);

  if (mention) {
    return {
      primary: `${senderName} mentioned you in`,
      secondary: contextTitle,
    };
  }

  if (contextTitle) {
    return {
      primary: `${senderName} sent you ${messageNoun} in`,
      secondary: contextTitle,
    };
  }

  return {
    primary: `${senderName} sent you ${messageNoun}`,
  };
}

function renderMessageItem(event: ActivityEventRow, verb: ActivityVerbVM) {
  const payload = asRecord(event.payload);
  const contextLabel = buildRoleAwareContextLabel(payload);
  return {
    verb,
    leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
    headline: renderMessageHeadline(payload),
    summary: contextLabel ? `Context: ${contextLabel}` : undefined,
    expandedContent: asOptionalString(payload.content),
    actionButton: sourceAction(event, payload, 'outline', 'Open messages'),
    metadata: {
      ...buildCommonContextMetadata(payload),
      channelId: asOptionalString(payload.channelId),
      messageId: asOptionalString(payload.messageId),
      threadReply: payload.threadReply === true,
    },
  } satisfies ActivityRenderResult;
}

function renderReactionItem(event: ActivityEventRow) {
  const payload = asRecord(event.payload);
  const senderName = asString(payload.senderName, 'Someone');
  const emoji = asString(payload.emoji, '😀');
  const isDirect = payload.channelRouteKind === 'dm';
  const contextLabel = buildRoleAwareContextLabel(payload) ?? getContextTitle(payload);

  return {
    verb: 'reaction.added',
    leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
    headline: {
      primary: isDirect
        ? `${senderName} reacted ${emoji} to your direct message`
        : `${senderName} reacted ${emoji} to your message in`,
      secondary: contextLabel,
      secondaryHref: buildInboxSourceHref(event, payload),
    },
    summary: contextLabel ? `Context: ${contextLabel}` : undefined,
    actionButton: sourceAction(event, payload),
    metadata: {
      ...buildCommonContextMetadata(payload),
      channelId: asOptionalString(payload.channelId),
      messageId: asOptionalString(payload.messageId),
      emoji,
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
      timing: 'standard',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderMessageItem(event, 'message.posted'),
  },
  'message.mentioned': {
    eventType: 'message.mentioned',
    tabKey: 'all',
    importance: 'normal',
    notification: {
      defaultChannels: ['push'],
      timing: 'standard',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderMessageItem(event, 'message.mentioned'),
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
    render: (event) => renderMessageItem(event, 'message.thread_reply.posted'),
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
    render: (event) => renderMessageItem(event, 'file.uploaded'),
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
    render: (event) => renderMessageItem(event, 'image.uploaded'),
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
    render: (event) => renderMessageItem(event, 'audio.uploaded'),
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
  'class.session.rescheduled': {
    eventType: 'class.session.rescheduled',
    tabKey: 'classes',
    importance: 'important',
    notification: {
      defaultChannels: ['push', 'email'],
      timing: 'immediate',
      isCritical: true,
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderClassUpdateGroup(event, 'Class session rescheduled', 'info'),
  },
  'class.session.canceled': {
    eventType: 'class.session.canceled',
    tabKey: 'classes',
    importance: 'important',
    notification: {
      defaultChannels: ['push', 'email'],
      timing: 'immediate',
      isCritical: true,
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderClassUpdateGroup(event, 'Class session canceled', 'warning'),
  },
  'session.reminder.sent': {
    eventType: 'session.reminder.sent',
    tabKey: 'classes',
    importance: 'normal',
    notification: {
      defaultChannels: ['push', 'email'],
      timing: 'immediate',
      isCritical: true,
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const contextLabel = buildRoleAwareContextLabel(payload);
      const summary = [contextLabel, asOptionalString(payload.summary)]
        .filter((part): part is string => Boolean(part))
        .join(' ');
      return {
        verb: 'session.reminder.sent',
        leading: { kind: 'icon', iconKey: 'Bell', tone: 'info' },
        headline: {
          primary: 'Class reminder',
          secondary: contextLabel ?? getContextTitle(payload),
          secondaryHref: buildInboxSourceHref(event, payload),
        },
        summary: summary || asOptionalString(payload.occurrenceStart),
        actionButton: sourceAction(event, payload, 'default', 'Open class'),
        metadata: {
          ...buildCommonContextMetadata(payload),
          scheduleId: asOptionalString(payload.scheduleId),
          occurrenceStart: asOptionalString(payload.occurrenceStart),
          reminderOffsetMinutes: payload.reminderOffsetMinutes,
          timezone: asOptionalString(payload.timezone),
          preserveActivitySummary: true,
        },
      };
    },
  },
  'session.feedback_request.sent': {
    eventType: 'session.feedback_request.sent',
    tabKey: 'classes',
    importance: 'normal',
    notification: {
      defaultChannels: ['push', 'email'],
      timing: 'immediate',
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const contextLabel = buildRoleAwareContextLabel(payload);
      const summary = [
        contextLabel,
        asOptionalString(payload.summary) ?? 'Share feedback about this session.',
      ]
        .filter((part): part is string => Boolean(part))
        .join(' ');
      return {
        verb: 'session.feedback_request.sent',
        leading: { kind: 'icon', iconKey: 'Bell', tone: 'info' },
        headline: {
          primary: 'Class feedback requested',
          secondary: contextLabel ?? getContextTitle(payload),
          secondaryHref: buildInboxSourceHref(event, payload),
        },
        summary,
        actionButton: sourceAction(event, payload, 'outline', 'Open class'),
        metadata: {
          ...buildCommonContextMetadata(payload),
          classSessionId: asOptionalString(payload.classSessionId),
          classroomId: asOptionalString(payload.learningSpaceId),
          channelId: asOptionalString(payload.channelId),
          occurrenceStart: asOptionalString(payload.occurrenceStart),
          timezone: asOptionalString(payload.timezone),
          feedbackUiEnabled: Boolean(
            asOptionalString(payload.classSessionId) &&
            asOptionalString(payload.learningSpaceId) &&
            asOptionalString(payload.channelId),
          ),
          preserveActivitySummary: true,
        },
      };
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
