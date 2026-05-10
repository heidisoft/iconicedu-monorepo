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
      messageId: asOptionalString(payload.messageId),
      fileName,
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
};

export const ActivityEventCatalog = ACTIVITY_EVENT_DEFINITIONS;

export function getActivityEventDefinition(eventType: string) {
  return ACTIVITY_EVENT_DEFINITIONS[eventType];
}

export function listActivityEventDefinitionTypes() {
  return Object.keys(ACTIVITY_EVENT_DEFINITIONS).sort();
}
