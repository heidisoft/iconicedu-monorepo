import type {
  ActivityGroupKeyVM,
  ActivityImportanceVM,
  ActivityItemContentVM,
  ActivityVerbVM,
  InboxActionButtonVM,
  InboxIconKeyVM,
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
  group?: {
    groupType: ActivityGroupKeyVM;
    collapseByDefault?: boolean;
    buildGroupKey: (event: ActivityEventRow) => string | null;
    renderGroup?: (event: ActivityEventRow) => ActivityRenderResult;
  } | null;
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

function asOptionalRouteKind(value: unknown) {
  return value === 'space' || value === 'dm' || value === 'channel' ? value : undefined;
}

function formatShortDate(value: unknown) {
  if (typeof value !== 'string' || !value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getScopeKind(event: ActivityEventRow) {
  const scope = asRecord(event.scope);
  return typeof scope.kind === 'string' ? scope.kind : undefined;
}

function getScopeLearningSpaceId(event: ActivityEventRow) {
  const scope = asRecord(event.scope);
  if (scope.kind === 'learning_space' && typeof scope.learningSpaceId === 'string') {
    return scope.learningSpaceId;
  }
  return undefined;
}

function getLearningSpaceId(event: ActivityEventRow, payload: Record<string, unknown>) {
  return asOptionalString(payload.learningSpaceId) ?? getScopeLearningSpaceId(event);
}

function resolveSessionAnchor(payload: Record<string, unknown>, fallback: string) {
  const explicit =
    asOptionalString(payload.occurrenceStart) ??
    asOptionalString(payload.startAt) ??
    asOptionalString(payload.startedAt);
  const value = explicit ?? fallback;
  return value.slice(0, 16);
}

function getContextTitle(payload: Record<string, unknown>) {
  return (
    asOptionalString(payload.learningSpaceTitle) ??
    asOptionalString(payload.channelTopic) ??
    asOptionalString(payload.title)
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

  const routeKind = asOptionalRouteKind(payload.channelRouteKind);
  if (routeKind === 'space') {
    return `../spaces/${channelId}`;
  }
  if (routeKind === 'dm') {
    return `../dm/${channelId}`;
  }
  if (routeKind === 'channel') {
    return `../c/${channelId}`;
  }

  const scopeKind = getScopeKind(event);
  const isLearningSpace =
    scopeKind === 'learning_space' || typeof payload.learningSpaceId === 'string';

  return isLearningSpace ? `../spaces/${channelId}` : `../c/${channelId}`;
}

function sourceAction(
  event: ActivityEventRow,
  payload: Record<string, unknown>,
  variant: InboxActionButtonVM['variant'] = 'outline',
  customLabel?: string,
): InboxActionButtonVM | undefined {
  const href = buildInboxSourceHref(event, payload);
  if (!href) {
    return undefined;
  }

  const routeKind = asOptionalRouteKind(payload.channelRouteKind);
  const resolvedLabel =
    routeKind === 'space' || href.includes('/spaces/')
      ? 'Open class'
      : routeKind === 'dm' || href.includes('/dm/')
        ? 'Open conversation'
        : 'Open channel';

  return {
    label: customLabel ?? resolvedLabel,
    variant,
    href,
  };
}

function sourceScheduleAction(event: ActivityEventRow, payload: Record<string, unknown>) {
  const href = buildInboxSourceHref(event, payload);
  if (!href) {
    return undefined;
  }

  return {
    label: 'View schedule',
    variant: 'outline' as const,
    href: `${href}${href.includes('?') ? '&' : '?'}tab=schedule`,
  };
}

function paymentAction(
  payload: Record<string, unknown>,
): InboxActionButtonVM | undefined {
  const href = asOptionalString(payload.href);
  if (!href) return undefined;
  return {
    label: 'View payment',
    variant: 'default',
    href,
  };
}

const DEFAULT_RECIPIENTS: ActivityEventDefinition['resolveRecipients'] = async (
  supabase,
  event,
) => resolveRecipientsForActivityEvent(supabase, event);

function className(payload: Record<string, unknown>) {
  return asString(payload.title, 'Learning space');
}

function sessionName(payload: Record<string, unknown>) {
  return asString(payload.title, 'Session');
}

function formatSessionLabel(startAt: unknown, timezone: unknown) {
  if (typeof startAt !== 'string' || startAt.length === 0) {
    return undefined;
  }
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  const timeZone =
    typeof timezone === 'string' && timezone.length > 0 ? timezone : undefined;
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone,
  }).format(date);
  const timeWithZone = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
    timeZoneName: 'short',
  }).format(date);
  return `${weekday} ${timeWithZone}`;
}

function formatWeeklyTimeLabel(startAt: unknown, timezone: unknown) {
  if (typeof startAt !== 'string' || startAt.length === 0) {
    return undefined;
  }
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  const timeZone =
    typeof timezone === 'string' && timezone.length > 0 ? timezone : undefined;
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
    timeZoneName: 'short',
  }).format(date);
}

function buildHourlyLearningSpaceGroupKey(
  prefix: string,
  event: ActivityEventRow,
  payload: Record<string, unknown>,
) {
  const learningSpaceId = getLearningSpaceId(event, payload);
  if (!learningSpaceId) {
    return null;
  }

  const hourBucket = event.occurred_at.slice(0, 13);
  return `${prefix}:${learningSpaceId}:${hourBucket}`;
}

function buildWeeklyLearningSpaceGroupKey(
  prefix: string,
  event: ActivityEventRow,
  payload: Record<string, unknown>,
) {
  const learningSpaceId = getLearningSpaceId(event, payload);
  if (!learningSpaceId) {
    return null;
  }

  const occurredAt = new Date(event.occurred_at);
  if (Number.isNaN(occurredAt.getTime())) {
    return null;
  }

  const day = occurredAt.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  occurredAt.setUTCDate(occurredAt.getUTCDate() + offset);
  occurredAt.setUTCHours(0, 0, 0, 0);

  return `${prefix}:${learningSpaceId}:${occurredAt.toISOString().slice(0, 10)}`;
}

function buildClassCreatedGroupKey(event: ActivityEventRow) {
  const payload = asRecord(event.payload);
  const learningSpaceId = getLearningSpaceId(event, payload);
  if (!learningSpaceId) {
    return null;
  }
  return `class-created:${learningSpaceId}`;
}

function buildClassUpdatedGroupKey(event: ActivityEventRow) {
  const payload = asRecord(event.payload);
  const learningSpaceId = getLearningSpaceId(event, payload);
  if (!learningSpaceId) {
    return null;
  }
  return `class-updated:${learningSpaceId}:${event.occurred_at.slice(0, 10)}`;
}

function buildSessionGroupKey(event: ActivityEventRow) {
  const payload = asRecord(event.payload);
  const learningSpaceId = getLearningSpaceId(event, payload);
  if (!learningSpaceId) {
    return null;
  }
  const sessionAnchor = resolveSessionAnchor(payload, event.occurred_at);
  return `class-session:${learningSpaceId}:${sessionAnchor}`;
}

function buildClassLifecycleGroupKey(event: ActivityEventRow) {
  const payload = asRecord(event.payload);
  const phase = asOptionalString(payload.activityPhase);
  if (phase === 'updated') {
    return buildClassUpdatedGroupKey(event);
  }
  return buildClassCreatedGroupKey(event);
}

function renderGroupedClassActivity(
  event: ActivityEventRow,
  input: {
    iconKey: InboxIconKeyVM;
    tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
    primary: string;
  },
) {
  const payload = asRecord(event.payload);
  return {
    verb: event.event_type as ActivityVerbVM,
    leading: { kind: 'icon', iconKey: input.iconKey, tone: input.tone },
    headline: {
      primary: input.primary,
      secondary: getContextTitle(payload),
    },
    summary: 'Open to review the latest class activity.',
    actionButton: sourceAction(event, payload),
  } satisfies ActivityRenderResult;
}

function renderClassCreatedGroup(event: ActivityEventRow) {
  const payload = asRecord(event.payload);
  const invitedMembers = buildParticipantAvatars(payload);
  const invitedMembersOverflow = Math.max(0, invitedMembers.length - 3);
  const invitedCountRaw = payload.invitedCount;
  const invitedCount =
    typeof invitedCountRaw === 'number' && Number.isFinite(invitedCountRaw)
      ? invitedCountRaw
      : undefined;
  const firstSessionLabel =
    formatSessionLabel(payload.firstSessionStartAt, payload.firstSessionTimezone) ??
    asOptionalString(payload.firstSessionLabel);
  const summaryParts: string[] = [];
  if (typeof invitedCount === 'number') {
    summaryParts.push(`${invitedCount} invited`);
  }
  if (firstSessionLabel) {
    summaryParts.push(`first lesson ${firstSessionLabel}`);
  }

  return {
    verb: event.event_type as ActivityVerbVM,
    leading:
      invitedMembers.length > 0
        ? {
            kind: 'avatars',
            avatars: invitedMembers,
            overflowCount: invitedMembersOverflow,
          }
        : { kind: 'icon', iconKey: 'GraduationCap', tone: 'info' },
    headline: {
      primary: 'Learning space created and assigned',
      secondary: getContextTitle(payload),
    },
    summary: summaryParts.length
      ? summaryParts.join(', ')
      : 'Learning space setup completed.',
    actionButton: sourceAction(event, payload, 'outline', 'View your learning space'),
  } satisfies ActivityRenderResult;
}

function renderLearningSpaceUpdatedGroup(event: ActivityEventRow) {
  const payload = asRecord(event.payload);
  const invitedMembers = buildParticipantAvatars(payload);
  const invitedMembersOverflow = Math.max(0, invitedMembers.length - 3);
  return {
    verb: event.event_type as ActivityVerbVM,
    leading:
      invitedMembers.length > 0
        ? {
            kind: 'avatars',
            avatars: invitedMembers,
            overflowCount: invitedMembersOverflow,
          }
        : buildSystemLeadingAvatar(),
    headline: {
      primary: 'Learning space updated',
      secondary: getContextTitle(payload),
    },
    summary:
      asOptionalString(payload.changeSummary) ??
      'Schedule, roster, or settings were updated.',
    actionButton: sourceAction(event, payload, 'outline', 'View your learning space'),
  } satisfies ActivityRenderResult;
}

function buildParticipantAvatars(payload: Record<string, unknown>) {
  const invitedMembersRaw = Array.isArray(payload.invitedMembers)
    ? payload.invitedMembers
    : [];
  return invitedMembersRaw
    .map((entry) =>
      entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null,
    )
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => ({
      name: asString(entry.name, 'Participant'),
      avatar: {
        source: asOptionalString(entry.avatarUrl)
          ? ('upload' as const)
          : ('seed' as const),
        ...(asOptionalString(entry.avatarUrl)
          ? { url: asOptionalString(entry.avatarUrl) }
          : {
              seed:
                asOptionalString(entry.profileId) ?? asString(entry.name, 'participant'),
            }),
      },
      themeKey: asOptionalString(entry.themeKey) ?? null,
    }));
}

type ActivityMemberSummary = {
  profileId: string;
  name: string;
  avatarUrl: string | null;
  themeKey: string | null;
};

function seedFromName(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function extractActivityMembers(
  payload: Record<string, unknown>,
): ActivityMemberSummary[] {
  const membersRaw = Array.isArray(payload.members) ? payload.members : [];
  const membersFromArray = membersRaw
    .map((entry) =>
      entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null,
    )
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => {
      const name = asString(entry.displayName, asString(entry.name, 'Member'));
      return {
        profileId:
          asOptionalString(entry.profileId) ??
          asOptionalString(entry.memberProfileId) ??
          seedFromName(name),
        name,
        avatarUrl: asOptionalString(entry.avatarUrl) ?? null,
        themeKey: asOptionalString(entry.themeKey) ?? null,
      };
    });

  if (membersFromArray.length > 0) {
    return membersFromArray;
  }

  const memberName = asOptionalString(payload.memberDisplayName);
  if (!memberName) {
    return [];
  }

  return [
    {
      profileId: asOptionalString(payload.memberProfileId) ?? seedFromName(memberName),
      name: memberName,
      avatarUrl: asOptionalString(payload.memberAvatarUrl) ?? null,
      themeKey: asOptionalString(payload.memberThemeKey) ?? null,
    },
  ];
}

function buildMembersLeading(payload: Record<string, unknown>): InboxLeadingVM {
  const members = extractActivityMembers(payload);
  if (!members.length) {
    return {
      kind: 'avatars',
      avatars: [
        {
          name: 'Member',
          avatar: { source: 'seed', seed: 'member' },
          themeKey: null,
        },
      ],
      overflowCount: 0,
    };
  }
  const visible = members.slice(0, 3);
  return {
    kind: 'avatars',
    avatars: visible.map((member) => ({
      name: member.name,
      avatar: member.avatarUrl
        ? { source: 'upload', url: member.avatarUrl }
        : { source: 'seed', seed: member.profileId },
      themeKey: member.themeKey,
    })),
    overflowCount: Math.max(0, members.length - visible.length),
  };
}

function buildMembersSummary(
  prefix: 'Added' | 'Removed',
  payload: Record<string, unknown>,
) {
  const names = extractActivityMembers(payload)
    .map((member) => member.name)
    .filter(Boolean);
  if (!names.length) {
    return undefined;
  }
  const listed = names.slice(0, 3).join(', ');
  const remaining = names.length - 3;
  const suffix = remaining > 0 ? ` +${remaining} more` : '';
  return `${prefix}: ${listed}${suffix}.`;
}

function buildSystemLeadingAvatar(): InboxLeadingVM {
  return {
    kind: 'avatars',
    avatars: [
      {
        name: 'System',
        avatar: { source: 'seed', seed: 'system' },
        themeKey: null,
      },
    ],
    overflowCount: 0,
  };
}

export const ACTIVITY_EVENT_DEFINITIONS: Record<string, ActivityEventDefinition> = {
  'message.posted': {
    eventType: 'message.posted',
    tabKey: 'all',
    importance: 'normal',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const senderName = asString(payload.senderName, 'Someone');
      const content = asString(payload.content).slice(0, 160);
      const mentionedProfileId = asOptionalString(payload.mentionedProfileId);
      const isDirectMessage = asOptionalRouteKind(payload.channelRouteKind) === 'dm';
      const isThreadReply = Boolean(payload.threadReply);
      const isMention = Boolean(mentionedProfileId);
      return {
        verb: 'message.posted',
        leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
        headline: {
          primary: isMention
            ? `${senderName} mentioned you`
            : isDirectMessage
              ? `${senderName} sent you a message`
              : isThreadReply
                ? `${senderName} replied in a thread`
                : `${senderName} sent a message`,
          secondary: getContextTitle(payload),
        },
        summary: undefined,
        expandedContent: content || undefined,
        actionButton: sourceAction(event, payload),
        metadata: {
          channelId: payload.channelId,
          messageId: payload.messageId,
          ...(mentionedProfileId ? { mentionedProfileId } : {}),
          ...(isMention ? { notificationKey: 'messages.mentions' } : {}),
        },
      };
    },
  },
  'file.uploaded': {
    eventType: 'file.uploaded',
    tabKey: 'classes',
    importance: 'normal',
    group: {
      groupType: 'class',
      collapseByDefault: true,
      buildGroupKey: (event) => {
        const payload = asRecord(event.payload);
        return buildHourlyLearningSpaceGroupKey('files', event, payload);
      },
      renderGroup: (event) =>
        renderGroupedClassActivity(event, {
          iconKey: 'FileText',
          tone: 'info',
          primary: 'New class files',
        }),
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const name = asString(payload.name, 'File');
      const content = asOptionalString(payload.content);
      const contextTitle = getContextTitle(payload);
      const fileCount =
        typeof payload.fileCount === 'number' && Number.isFinite(payload.fileCount)
          ? payload.fileCount
          : null;
      return {
        verb: 'file.uploaded',
        leading: { kind: 'icon', iconKey: 'FileText', tone: 'info' },
        headline: {
          primary:
            fileCount && fileCount > 1
              ? `${fileCount} new files uploaded`
              : 'New file uploaded',
          secondary: contextTitle ?? (fileCount && fileCount > 1 ? undefined : name),
        },
        summary: fileCount && fileCount > 1 ? (content ?? name) : (content ?? name),
        preview: content ? { text: content.slice(0, 160) } : undefined,
        actionButton: sourceAction(event, payload),
        metadata: {
          channelId: payload.channelId,
          messageId: payload.messageId,
          storagePath: payload.storagePath,
          mimeType: payload.mimeType,
          fileCount,
        },
      };
    },
  },
  'homework.assigned': {
    eventType: 'homework.assigned',
    tabKey: 'classes',
    importance: 'normal',
    group: {
      groupType: 'homework',
      collapseByDefault: true,
      buildGroupKey: (event) => {
        const payload = asRecord(event.payload);
        return buildWeeklyLearningSpaceGroupKey('homework', event, payload);
      },
      renderGroup: (event) =>
        renderGroupedClassActivity(event, {
          iconKey: 'ClipboardCheck',
          tone: 'info',
          primary: 'Homework updates',
        }),
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const dueLabel = formatShortDate(payload.dueAt);
      return {
        verb: 'homework.assigned',
        leading: { kind: 'icon', iconKey: 'ClipboardCheck', tone: 'info' },
        headline: {
          primary: 'New homework assigned',
          secondary: asString(payload.title, 'Homework assignment'),
        },
        summary: dueLabel ? `Due ${dueLabel}` : getContextTitle(payload),
        expandedContent: asOptionalString(payload.description),
        actionButton: sourceAction(event, payload, 'default', 'View homework'),
        metadata: {
          channelId: payload.channelId,
          messageId: payload.messageId,
          learningSpaceId: payload.learningSpaceId,
        },
      };
    },
  },
  'class.created': {
    eventType: 'class.created',
    tabKey: 'classes',
    importance: 'normal',
    group: {
      groupType: 'class',
      collapseByDefault: true,
      buildGroupKey: (event) => buildClassCreatedGroupKey(event),
      renderGroup: (event) => renderClassCreatedGroup(event),
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'class.created',
        leading: buildSystemLeadingAvatar(),
        headline: {
          primary: 'Learning space created and assigned',
          secondary: className(payload),
        },
        summary: renderClassCreatedGroup(event).summary,
        actionButton: sourceAction(event, payload, 'outline', 'View your learning space'),
      };
    },
  },
  'class.updated': {
    eventType: 'class.updated',
    tabKey: 'classes',
    importance: 'normal',
    group: {
      groupType: 'class',
      collapseByDefault: true,
      buildGroupKey: (event) => buildClassUpdatedGroupKey(event),
      renderGroup: (event) => renderLearningSpaceUpdatedGroup(event),
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const grouped = renderLearningSpaceUpdatedGroup(event);
      return {
        verb: 'class.updated',
        leading: grouped.leading,
        headline: { primary: 'Learning space updated', secondary: className(payload) },
        summary:
          asOptionalString(payload.changeSummary) ?? asOptionalString(payload.subject),
        actionButton: sourceAction(event, payload, 'outline', 'View your learning space'),
      };
    },
  },
  'class.archived': {
    eventType: 'class.archived',
    tabKey: 'classes',
    importance: 'important',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'class.archived',
        leading: { kind: 'icon', iconKey: 'GraduationCap', tone: 'warning' },
        headline: { primary: 'Class archived', secondary: className(payload) },
        actionButton: sourceAction(event, payload),
      };
    },
  },
  'member.invited': {
    eventType: 'member.invited',
    tabKey: 'classes',
    importance: 'normal',
    group: {
      groupType: 'class',
      collapseByDefault: true,
      buildGroupKey: (event) => buildClassLifecycleGroupKey(event),
      renderGroup: (event) => {
        const payload = asRecord(event.payload);
        if (asOptionalString(payload.activityPhase) === 'created') {
          return renderClassCreatedGroup(event);
        }
        return renderLearningSpaceUpdatedGroup(event);
      },
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const members = extractActivityMembers(payload);
      const memberCountRaw = payload.memberCount;
      const memberCount =
        typeof memberCountRaw === 'number' && Number.isFinite(memberCountRaw)
          ? memberCountRaw
          : members.length;
      const memberName =
        members[0]?.name ?? asString(payload.memberDisplayName, 'Member');
      const membersSummary = buildMembersSummary('Added', payload);
      return {
        verb: 'member.invited',
        leading: buildMembersLeading(payload),
        headline: {
          primary:
            memberCount > 1
              ? `${memberCount} members invited to the learning space`
              : `${memberName} invited to the learning space`,
        },
        summary: `${membersSummary ? `${membersSummary} ` : ''}Added to ${className(payload)} with access and notifications enabled.`,
      };
    },
  },
  'member.joined': {
    eventType: 'member.joined',
    tabKey: 'classes',
    importance: 'normal',
    group: {
      groupType: 'class',
      collapseByDefault: true,
      buildGroupKey: (event) => buildSessionGroupKey(event),
      renderGroup: (event) =>
        renderGroupedClassActivity(event, {
          iconKey: 'Video',
          tone: 'info',
          primary: 'Class session',
        }),
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'member.joined',
        leading: { kind: 'icon', iconKey: 'CheckCircle2', tone: 'info' },
        headline: {
          primary: `${asString(payload.memberDisplayName, 'Participant')} joined class`,
          secondary: asString(payload.memberDisplayName, 'New member'),
        },
        summary: asOptionalString(payload.role),
        actionButton: sourceAction(event, payload),
      };
    },
  },
  'member.removed': {
    eventType: 'member.removed',
    tabKey: 'classes',
    importance: 'important',
    group: {
      groupType: 'class',
      collapseByDefault: true,
      buildGroupKey: (event) => buildClassLifecycleGroupKey(event),
      renderGroup: (event) => {
        const payload = asRecord(event.payload);
        if (asOptionalString(payload.activityPhase) === 'created') {
          return renderClassCreatedGroup(event);
        }
        return renderLearningSpaceUpdatedGroup(event);
      },
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const members = extractActivityMembers(payload);
      const memberCountRaw = payload.memberCount;
      const memberCount =
        typeof memberCountRaw === 'number' && Number.isFinite(memberCountRaw)
          ? memberCountRaw
          : members.length;
      const memberName =
        members[0]?.name ?? asString(payload.memberDisplayName, 'Member');
      const membersSummary = buildMembersSummary('Removed', payload);
      return {
        verb: 'member.removed',
        leading: buildMembersLeading(payload),
        headline: {
          primary:
            memberCount > 1
              ? `${memberCount} members removed from the learning space`
              : `${memberName} removed from the learning space`,
        },
        summary: `${membersSummary ? `${membersSummary} ` : ''}Removed from ${className(payload)} and access notifications disabled.`,
      };
    },
  },
  'role.changed': {
    eventType: 'role.changed',
    tabKey: 'classes',
    importance: 'normal',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'role.changed',
        leading: { kind: 'icon', iconKey: 'CheckCircle2', tone: 'info' },
        headline: {
          primary: 'Role changed',
          secondary: asString(payload.memberDisplayName, 'Member'),
        },
        summary: asOptionalString(payload.role),
        actionButton: sourceAction(event, payload),
      };
    },
  },
  'session.scheduled': {
    eventType: 'session.scheduled',
    tabKey: 'classes',
    importance: 'normal',
    group: {
      groupType: 'class',
      collapseByDefault: true,
      buildGroupKey: (event) => buildClassLifecycleGroupKey(event),
      renderGroup: (event) => {
        const payload = asRecord(event.payload);
        if (asOptionalString(payload.activityPhase) === 'created') {
          return renderClassCreatedGroup(event);
        }
        return renderLearningSpaceUpdatedGroup(event);
      },
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const firstSessionLabel = formatSessionLabel(payload.startAt, payload.timezone);
      const weeklyTime = formatWeeklyTimeLabel(payload.startAt, payload.timezone);
      return {
        verb: 'session.scheduled',
        leading: buildSystemLeadingAvatar(),
        headline: { primary: 'Session scheduled', secondary: sessionName(payload) },
        summary:
          firstSessionLabel && weeklyTime
            ? `First session: ${firstSessionLabel}, then weekly ${weeklyTime}`
            : (asOptionalString(payload.startAt) ?? undefined),
        actionButton: sourceScheduleAction(event, payload),
      };
    },
  },
  'session.rescheduled': {
    eventType: 'session.rescheduled',
    tabKey: 'classes',
    importance: 'important',
    group: {
      groupType: 'class',
      collapseByDefault: true,
      buildGroupKey: (event) => buildClassUpdatedGroupKey(event),
      renderGroup: (event) => renderLearningSpaceUpdatedGroup(event),
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'session.rescheduled',
        leading: { kind: 'icon', iconKey: 'GraduationCap', tone: 'warning' },
        headline: {
          primary: 'Class session rescheduled',
          secondary: sessionName(payload),
        },
        summary:
          asOptionalString(payload.description) ?? asOptionalString(payload.startAt),
      };
    },
  },
  'session.canceled': {
    eventType: 'session.canceled',
    tabKey: 'classes',
    importance: 'important',
    group: {
      groupType: 'class',
      collapseByDefault: true,
      buildGroupKey: (event) => buildClassUpdatedGroupKey(event),
      renderGroup: (event) => renderLearningSpaceUpdatedGroup(event),
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'session.canceled',
        leading: { kind: 'icon', iconKey: 'GraduationCap', tone: 'danger' },
        headline: { primary: 'Class session cancelled', secondary: sessionName(payload) },
        summary: asOptionalString(payload.description),
      };
    },
  },
  'session.started': {
    eventType: 'session.started',
    tabKey: 'classes',
    importance: 'important',
    group: {
      groupType: 'class',
      collapseByDefault: true,
      buildGroupKey: (event) => buildSessionGroupKey(event),
      renderGroup: (event) =>
        renderGroupedClassActivity(event, {
          iconKey: 'Video',
          tone: 'success',
          primary: 'Class session',
        }),
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const joinPath = asOptionalString(payload.joinPath);
      return {
        verb: 'session.started',
        leading: { kind: 'icon', iconKey: 'Video', tone: 'success' },
        headline: { primary: 'Class is live now', secondary: sessionName(payload) },
        actionButton: joinPath
          ? {
              label: 'Join now',
              variant: 'default',
              href: joinPath,
            }
          : sourceAction(event, payload),
      };
    },
  },
  'session.ended': {
    eventType: 'session.ended',
    tabKey: 'classes',
    importance: 'normal',
    group: {
      groupType: 'class',
      collapseByDefault: true,
      buildGroupKey: (event) => buildSessionGroupKey(event),
      renderGroup: (event) =>
        renderGroupedClassActivity(event, {
          iconKey: 'Video',
          tone: 'neutral',
          primary: 'Class session',
        }),
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'session.ended',
        leading: { kind: 'icon', iconKey: 'Video', tone: 'neutral' },
        headline: { primary: 'Class ended', secondary: sessionName(payload) },
        actionButton: sourceAction(event, payload),
      };
    },
  },
  'session.completed': {
    eventType: 'session.completed',
    tabKey: 'classes',
    importance: 'normal',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'session.completed',
        leading: { kind: 'icon', iconKey: 'CheckCircle2', tone: 'success' },
        headline: { primary: 'Session completed', secondary: sessionName(payload) },
        actionButton: sourceAction(event, payload),
      };
    },
  },
  'session.reminder.sent': {
    eventType: 'session.reminder.sent',
    tabKey: 'classes',
    importance: 'normal',
    group: {
      groupType: 'class',
      collapseByDefault: true,
      buildGroupKey: (event) => buildSessionGroupKey(event),
      renderGroup: (event) => {
        const payload = asRecord(event.payload);
        return {
          verb: 'session.reminder.sent',
          leading: { kind: 'icon', iconKey: 'Bell', tone: 'info' },
          headline: {
            primary: 'Class session',
            secondary: getContextTitle(payload),
          },
          actionButton: sourceAction(event, payload),
        };
      },
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'session.reminder.sent',
        leading: { kind: 'icon', iconKey: 'Bell', tone: 'info' },
        headline: {
          primary: 'Class starts in 5 mins',
          secondary: sessionName(payload),
        },
        summary:
          asOptionalString(payload.summary) ?? asOptionalString(payload.occurrenceStart),
        actionButton: sourceAction(event, payload),
      };
    },
  },
  'session.feedback_request.sent': {
    eventType: 'session.feedback_request.sent',
    tabKey: 'classes',
    importance: 'normal',
    group: {
      groupType: 'class',
      collapseByDefault: true,
      buildGroupKey: (event) => buildSessionGroupKey(event),
      renderGroup: (event) => {
        const payload = asRecord(event.payload);
        return {
          verb: 'session.feedback_request.sent',
          leading: { kind: 'icon', iconKey: 'ClipboardCheck', tone: 'info' },
          headline: {
            primary: 'Class session',
            secondary: getContextTitle(payload),
          },
          actionButton: sourceAction(event, payload),
        };
      },
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'session.feedback_request.sent',
        leading: { kind: 'icon', iconKey: 'Sparkles', tone: 'info' },
        headline: {
          primary: 'Class feedback requested',
          secondary: sessionName(payload),
        },
        summary: asOptionalString(payload.summary),
        actionButton: sourceAction(event, payload),
      };
    },
  },
  'payment.reminder': {
    eventType: 'payment.reminder',
    tabKey: 'payment',
    importance: 'important',
    group: {
      groupType: 'payment',
      collapseByDefault: true,
      buildGroupKey: (event) => {
        const payload = asRecord(event.payload);
        return asOptionalString(payload.invoiceId) ?? null;
      },
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'payment.reminder',
        leading: { kind: 'icon', iconKey: 'CreditCard', tone: 'warning' },
        headline: { primary: 'Payment reminder' },
        summary: asOptionalString(payload.description),
        actionButton: paymentAction(payload),
      };
    },
  },
  'payment.reminder.sent': {
    eventType: 'payment.reminder.sent',
    tabKey: 'payment',
    importance: 'important',
    group: {
      groupType: 'payment',
      collapseByDefault: true,
      buildGroupKey: (event) => {
        const payload = asRecord(event.payload);
        return asOptionalString(payload.invoiceId) ?? null;
      },
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'payment.reminder.sent',
        leading: { kind: 'icon', iconKey: 'CreditCard', tone: 'warning' },
        headline: {
          primary: 'Payment reminder',
          secondary: asOptionalString(payload.title),
        },
        summary: asOptionalString(payload.summary),
        actionButton: paymentAction(payload) ?? sourceAction(event, payload),
      };
    },
  },
  'payment.received': {
    eventType: 'payment.received',
    tabKey: 'payment',
    importance: 'normal',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'payment.received',
        leading: { kind: 'icon', iconKey: 'CreditCard', tone: 'success' },
        headline: { primary: 'Payment received' },
        summary: asOptionalString(payload.description),
        actionButton: paymentAction(payload),
      };
    },
  },
  'payment.failed': {
    eventType: 'payment.failed',
    tabKey: 'payment',
    importance: 'urgent',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'payment.failed',
        leading: { kind: 'icon', iconKey: 'CreditCard', tone: 'danger' },
        headline: { primary: 'Payment failed' },
        summary: asOptionalString(payload.description),
        actionButton: paymentAction(payload),
      };
    },
  },
  'system.notice': {
    eventType: 'system.notice',
    tabKey: 'system',
    importance: 'important',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const href = asOptionalString(payload.href);
      const actionLabel = asOptionalString(payload.actionLabel);
      return {
        verb: 'system.notice',
        leading: { kind: 'icon', iconKey: 'Bell', tone: 'info' },
        headline: { primary: asString(payload.title, 'System notice') },
        summary: asOptionalString(payload.message),
        actionButton:
          href && actionLabel
            ? {
                label: actionLabel,
                variant: 'default',
                href,
              }
            : undefined,
      };
    },
  },
};

export function getActivityEventDefinition(eventType: string) {
  return ACTIVITY_EVENT_DEFINITIONS[eventType];
}
