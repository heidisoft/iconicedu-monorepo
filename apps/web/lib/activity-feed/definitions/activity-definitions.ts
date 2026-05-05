import type {
  ActivityImportanceVM,
  ActivityItemContentVM,
  ActivityVerbVM,
  InboxActionButtonVM,
  InboxLeadingVM,
  InboxTabKeyVM,
} from '@iconicedu/shared-types';
import type { ActivityEventRow } from '@iconicedu/shared-types';
import type { SupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { resolveRecipientsForActivityEvent } from '@iconicedu/web/lib/activity-feed/projector/recipient-resolution';

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

function getContextTitle(payload: Record<string, unknown>) {
  return (
    asOptionalString(payload.learningSpaceTitle) ??
    asOptionalString(payload.channelTopic) ??
    asOptionalString(payload.title)
  );
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
  return {
    verb: event.event_type as ActivityVerbVM,
    leading: {
      kind: 'icon',
      iconKey: tone === 'warning' ? 'CalendarX' : 'CalendarCheck',
      tone,
    },
    headline: {
      primary,
      secondary: getContextTitle(payload),
      secondaryHref: buildInboxSourceHref(event, payload),
    },
    summary: asOptionalString(payload.summary) ?? 'Class schedule updated.',
    actionButton: sourceAction(event, payload, 'outline', 'Open class'),
  };
}

function renderMessageHeadline(payload: Record<string, unknown>, isDirect: boolean) {
  const senderName = asString(payload.senderName, 'Someone');
  const contextTitle = getContextTitle(payload);
  const mention = asOptionalString(payload.mentionedProfileId);

  if (mention) {
    return {
      primary: `${senderName} mentioned you in`,
      secondary: contextTitle,
    };
  }

  if (contextTitle) {
    return {
      primary: `${senderName} sent you ${isDirect ? 'a direct message in' : 'a message in'}`,
      secondary: contextTitle,
    };
  }

  return {
    primary: `${senderName} sent you ${isDirect ? 'a direct message' : 'a message'}`,
  };
}

function renderMessageItem(
  event: ActivityEventRow,
  verb: ActivityVerbVM,
  isDirect: boolean,
) {
  const payload = asRecord(event.payload);
  return {
    verb,
    leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
    headline: renderMessageHeadline(payload, isDirect),
    expandedContent: asOptionalString(payload.content),
    actionButton: sourceAction(
      event,
      payload,
      'outline',
      isDirect ? 'Open conversation' : 'Open messages',
    ),
    metadata: {
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

  return {
    verb: 'reaction.added',
    leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
    headline: {
      primary: isDirect
        ? `${senderName} reacted ${emoji} to your direct message`
        : `${senderName} reacted ${emoji} to your message in`,
      secondary: getContextTitle(payload),
      secondaryHref: buildInboxSourceHref(event, payload),
    },
    actionButton: sourceAction(event, payload),
    metadata: {
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
  'dm.posted': {
    eventType: 'dm.posted',
    tabKey: 'all',
    importance: 'normal',
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderMessageItem(event, 'message.posted', true),
  },
  'message.posted': {
    eventType: 'message.posted',
    tabKey: 'all',
    importance: 'normal',
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderMessageItem(event, 'message.posted', false),
  },
  'reaction.added': {
    eventType: 'reaction.added',
    tabKey: 'all',
    importance: 'normal',
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderReactionItem(event),
  },
  'class.session.rescheduled': {
    eventType: 'class.session.rescheduled',
    tabKey: 'classes',
    importance: 'important',
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderClassUpdateGroup(event, 'Class session rescheduled', 'info'),
  },
  'class.sessions.rescheduled': {
    eventType: 'class.sessions.rescheduled',
    tabKey: 'classes',
    importance: 'important',
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) =>
      renderClassUpdateGroup(event, 'Class sessions rescheduled', 'info'),
  },
  'class.session.canceled': {
    eventType: 'class.session.canceled',
    tabKey: 'classes',
    importance: 'important',
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => renderClassUpdateGroup(event, 'Class session canceled', 'warning'),
  },
  'class.sessions.canceled': {
    eventType: 'class.sessions.canceled',
    tabKey: 'classes',
    importance: 'important',
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) =>
      renderClassUpdateGroup(event, 'Class sessions canceled', 'warning'),
  },
  'session.reminder.sent': {
    eventType: 'session.reminder.sent',
    tabKey: 'classes',
    importance: 'normal',
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'session.reminder.sent',
        leading: { kind: 'icon', iconKey: 'Bell', tone: 'info' },
        headline: {
          primary: 'Class reminder',
          secondary: getContextTitle(payload),
          secondaryHref: buildInboxSourceHref(event, payload),
        },
        summary:
          asOptionalString(payload.summary) ?? asOptionalString(payload.occurrenceStart),
        actionButton: sourceAction(event, payload, 'default', 'Open class'),
      };
    },
  },
  'sessions.reminder.sent': {
    eventType: 'sessions.reminder.sent',
    tabKey: 'classes',
    importance: 'normal',
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'sessions.reminder.sent',
        leading: { kind: 'icon', iconKey: 'Bell', tone: 'info' },
        headline: {
          primary: 'Class reminders',
          secondary: getContextTitle(payload),
          secondaryHref: buildInboxSourceHref(event, payload),
        },
        summary: asOptionalString(payload.summary),
        actionButton: sourceAction(event, payload, 'default', 'Open class'),
      };
    },
  },
  'session.feedback_request.sent': {
    eventType: 'session.feedback_request.sent',
    tabKey: 'classes',
    importance: 'normal',
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'session.feedback_request.sent',
        leading: { kind: 'icon', iconKey: 'Bell', tone: 'info' },
        headline: {
          primary: 'Class feedback requested',
          secondary: getContextTitle(payload),
          secondaryHref: buildInboxSourceHref(event, payload),
        },
        summary:
          asOptionalString(payload.summary) ?? 'Share feedback about this session.',
        actionButton: sourceAction(event, payload, 'outline', 'Open class'),
      };
    },
  },
  'sessions.feedback_request.sent': {
    eventType: 'sessions.feedback_request.sent',
    tabKey: 'classes',
    importance: 'normal',
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'sessions.feedback_request.sent',
        leading: { kind: 'icon', iconKey: 'Bell', tone: 'info' },
        headline: {
          primary: 'Class feedback requested',
          secondary: getContextTitle(payload),
          secondaryHref: buildInboxSourceHref(event, payload),
        },
        summary:
          asOptionalString(payload.summary) ??
          'Share feedback about your recent sessions.',
        actionButton: sourceAction(event, payload, 'outline', 'Open class'),
      };
    },
  },
};

export function getActivityEventDefinition(eventType: string) {
  return ACTIVITY_EVENT_DEFINITIONS[eventType];
}

export function listActivityEventDefinitionTypes() {
  return Object.keys(ACTIVITY_EVENT_DEFINITIONS).sort();
}
