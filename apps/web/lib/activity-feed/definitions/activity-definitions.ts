import type {
  ActivityGroupKeyVM,
  ActivityImportanceVM,
  ActivityItemContentVM,
  ActivityVerbVM,
  InboxActionButtonVM,
  InboxIconKeyVM,
  InboxLeadingVM,
  InboxTabKeyVM,
  ThemeKey,
} from '@iconicedu/shared-types';
import {
  formatDate,
  formatDateTime,
  formatTime,
  resolveViewerTimezone,
} from '@iconicedu/utils';
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

function asOptionalThemeKey(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? (value as ThemeKey) : null;
}

function extractDisplayTimezone(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  const record = asRecord(value);
  return (
    asOptionalString(record.viewerTimezone) ??
    asOptionalString(record.recipientTimezone) ??
    asOptionalString(record.timezone) ??
    asOptionalString(record.firstSessionTimezone) ??
    null
  );
}

function resolveDisplayTimezone(preferred: unknown, fallback?: unknown) {
  return resolveViewerTimezone(
    extractDisplayTimezone(preferred),
    extractDisplayTimezone(fallback),
  );
}

function formatShortDate(value: unknown, timezone?: unknown) {
  if (typeof value !== 'string' || !value) {
    return undefined;
  }

  return formatDate(value, resolveDisplayTimezone(timezone), 'short');
}

function formatNaturalDate(value: unknown, timezone?: unknown) {
  if (typeof value !== 'string' || !value) {
    return undefined;
  }

  return formatDate(value, resolveDisplayTimezone(timezone), 'natural');
}

function formatNaturalDateTime(value: unknown, timezone: unknown) {
  if (typeof value !== 'string' || !value) {
    return undefined;
  }

  return formatDateTime(value, resolveDisplayTimezone(timezone), 'natural');
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
    asOptionalString(payload.scheduledStartAt) ??
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

  const orgSlug = asOptionalString(payload.orgSlug);
  const basePath = orgSlug ? `/${orgSlug}` : '..';
  const routeKind = asOptionalRouteKind(payload.channelRouteKind);
  if (routeKind === 'space') {
    return `${basePath}/spaces/${channelId}`;
  }
  if (routeKind === 'dm') {
    return `${basePath}/dm/${channelId}`;
  }
  if (routeKind === 'channel') {
    return `${basePath}/c/${channelId}`;
  }

  const scopeKind = getScopeKind(event);
  const isLearningSpace =
    scopeKind === 'learning_space' || typeof payload.learningSpaceId === 'string';

  return isLearningSpace
    ? `${basePath}/spaces/${channelId}`
    : `${basePath}/c/${channelId}`;
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
        : 'View messages';

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
  return asString(payload.title, 'Class');
}

function sessionName(payload: Record<string, unknown>) {
  return asString(payload.title, 'Session');
}

function formatSessionLabel(startAt: unknown, timezone: unknown) {
  if (typeof startAt !== 'string' || startAt.length === 0) {
    return undefined;
  }
  return formatDateTime(startAt, resolveDisplayTimezone(timezone), 'weekdayTimeWithZone');
}

function formatWeeklyTimeLabel(startAt: unknown, timezone: unknown) {
  if (typeof startAt !== 'string' || startAt.length === 0) {
    return undefined;
  }
  return formatTime(startAt, resolveDisplayTimezone(timezone), 'withZone');
}

function formatScheduleChangePart(
  value: string,
  timezone: unknown,
  options: Intl.DateTimeFormatOptions,
) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: resolveDisplayTimezone(timezone),
    ...options,
  }).format(date);
}

function formatScheduleDayLabel(value: string, timezone: unknown) {
  return formatScheduleChangePart(value, timezone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatScheduleTimeLabel(value: string, timezone: unknown, includeZone = false) {
  return formatScheduleChangePart(value, timezone, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(includeZone ? { timeZoneName: 'shortGeneric' } : {}),
  });
}

function formatScheduleDateTimeLabel(
  value: string,
  timezone: unknown,
  includeComma = true,
) {
  const dayLabel = formatScheduleDayLabel(value, timezone);
  const timeLabel = formatScheduleTimeLabel(value, timezone, true);
  if (!dayLabel || !timeLabel) {
    return null;
  }
  return includeComma ? `${dayLabel}, ${timeLabel}` : `${dayLabel} ${timeLabel}`;
}

function isSameScheduleDay(a: string, b: string, timezone: unknown) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveDisplayTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date(a)) === formatter.format(new Date(b));
}

function buildRescheduledSessionSummary(payload: Record<string, unknown>) {
  const timezone = payload;
  const title = sessionName(payload);
  const fromValue =
    asOptionalString(payload.rescheduledFromStartAt) ?? asOptionalString(payload.startAt);
  const toValue =
    asOptionalString(payload.rescheduledToStartAt) ??
    asOptionalString(payload.newStartAt);
  const reason =
    asOptionalString(payload.rescheduledReason) ?? asOptionalString(payload.reason);

  if (!fromValue || !toValue) {
    return undefined;
  }

  const sameDay = isSameScheduleDay(fromValue, toValue, timezone);
  if (sameDay) {
    const dayLabel = formatScheduleDayLabel(fromValue, timezone);
    const fromTime = formatScheduleTimeLabel(fromValue, timezone);
    const toTime = formatScheduleTimeLabel(toValue, timezone, true);
    if (!dayLabel || !fromTime || !toTime) {
      return undefined;
    }
    return `Session: ${title} weekly session (${dayLabel}) moved from ${fromTime} to ${toTime}${
      reason ? ` due to ${reason}` : ''
    }`;
  }

  const fromDateTime = formatScheduleDateTimeLabel(fromValue, timezone);
  const toDateTime = formatScheduleDateTimeLabel(toValue, timezone);
  if (!fromDateTime || !toDateTime) {
    return undefined;
  }

  return `Session: ${title} weekly session moved from ${fromDateTime} to ${toDateTime}${
    reason ? ` due to ${reason}` : ''
  }`;
}

function buildCanceledSessionSummary(payload: Record<string, unknown>) {
  const timezone = payload;
  const title = sessionName(payload);
  const canceledValue =
    asOptionalString(payload.canceledStartAt) ?? asOptionalString(payload.startAt);
  const reason =
    asOptionalString(payload.canceledReason) ?? asOptionalString(payload.reason);

  if (!canceledValue) {
    return undefined;
  }

  const dateTimeLabel = formatScheduleDateTimeLabel(canceledValue, timezone, false);
  if (!dateTimeLabel) {
    return undefined;
  }

  return `Session: ${title} weekly session (${dateTimeLabel}) canceled${
    reason ? ` due to ${reason}` : ''
  }`;
}

function buildHourlyChannelGroupKey(
  prefix: string,
  event: ActivityEventRow,
  payload: Record<string, unknown>,
) {
  const channelId = asOptionalString(payload.channelId);
  if (!channelId) {
    return null;
  }

  const hourBucket = event.occurred_at.slice(0, 13);
  return `${prefix}:${channelId}:${hourBucket}`;
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
  const firstSessionLabel =
    formatNaturalDateTime(payload.firstSessionStartAt, payload) ??
    asOptionalString(payload.firstSessionLabel);
  const participantsSummary = buildParticipantNamesSummary(payload, 'Participants');
  const summaryParts = [
    asOptionalString(payload.subject)
      ? `${asOptionalString(payload.subject)} class created`
      : 'Class created',
    firstSessionLabel ? `First session ${firstSessionLabel}` : undefined,
    participantsSummary,
  ].filter((value): value is string => Boolean(value));

  return {
    verb: event.event_type as ActivityVerbVM,
    leading:
      invitedMembers.length > 0
        ? {
            kind: 'avatars',
            avatars: invitedMembers,
            overflowCount: Math.max(0, invitedMembers.length - 3),
          }
        : buildSystemLeadingAvatar(),
    headline: {
      primary: 'Class created',
      secondary: getContextTitle(payload),
    },
    summary: summaryParts.join('. '),
    actionButton: sourceAction(event, payload, 'outline', 'Open classroom'),
  } satisfies ActivityRenderResult;
}

function renderClassCreatedLeaf(event: ActivityEventRow) {
  const payload = asRecord(event.payload);
  const firstSessionLabel =
    formatNaturalDateTime(payload.firstSessionStartAt, payload) ??
    asOptionalString(payload.firstSessionLabel);

  return {
    verb: 'class.created',
    leading: buildSystemLeadingAvatar(),
    headline: {
      primary: 'Class created',
      secondary: className(payload),
    },
    summary: firstSessionLabel ? `First session ${firstSessionLabel}.` : 'Class created.',
  } satisfies ActivityRenderResult;
}

function renderLearningSpaceUpdatedGroup(event: ActivityEventRow) {
  const payload = asRecord(event.payload);
  const invitedMembers = buildParticipantAvatars(payload);
  const firstSessionLabel = formatNaturalDateTime(payload.firstSessionStartAt, payload);
  return {
    verb: event.event_type as ActivityVerbVM,
    leading:
      invitedMembers.length > 0
        ? {
            kind: 'avatars',
            avatars: invitedMembers,
            overflowCount: Math.max(0, invitedMembers.length - 3),
          }
        : buildSystemLeadingAvatar(),
    headline: {
      primary: 'Class updated',
      secondary: getContextTitle(payload),
    },
    summary:
      asOptionalString(payload.changeSummary) ??
      (firstSessionLabel ? `Next session ${firstSessionLabel}.` : null) ??
      'Class details, participants, or schedule changed.',
    actionButton: sourceAction(event, payload, 'outline', 'Open classroom'),
  } satisfies ActivityRenderResult;
}

function renderLearningSpaceUpdatedLeaf(event: ActivityEventRow) {
  const payload = asRecord(event.payload);
  return {
    verb: 'class.updated',
    leading: buildSystemLeadingAvatar(),
    headline: {
      primary: 'Class updated',
      secondary: className(payload),
    },
    summary:
      asOptionalString(payload.changeSummary) ??
      asOptionalString(payload.subject) ??
      'Class details updated.',
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
      themeKey: asOptionalThemeKey(entry.themeKey),
    }));
}

type ActivityMemberSummary = {
  profileId: string;
  name: string;
  avatarUrl: string | null;
  themeKey: ThemeKey | null;
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
        themeKey: asOptionalThemeKey(entry.themeKey),
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
      themeKey: asOptionalThemeKey(payload.memberThemeKey),
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

function buildParticipantNamesSummary(
  payload: Record<string, unknown>,
  prefix = 'Participants',
) {
  const names = buildParticipantAvatars(payload)
    .map((participant) => participant.name)
    .filter(Boolean);
  if (!names.length) {
    return undefined;
  }

  const listed = names.slice(0, 3).join(', ');
  const remaining = names.length - 3;
  return `${prefix}: ${listed}${remaining > 0 ? ` +${remaining} more` : ''}`;
}

function isSessionRosterEvent(payload: Record<string, unknown>) {
  return Boolean(asOptionalString(payload.liveSessionId));
}

function buildSessionParticipantsLeading(payload: Record<string, unknown>) {
  const participants = extractActivityMembers(payload);
  if (!participants.length) {
    return { kind: 'icon', iconKey: 'Video', tone: 'info' } satisfies InboxLeadingVM;
  }

  return {
    kind: 'avatars',
    avatars: participants.map((participant) => ({
      name: participant.name,
      avatar: participant.avatarUrl
        ? { source: 'upload' as const, url: participant.avatarUrl }
        : { source: 'seed' as const, seed: participant.profileId },
      themeKey: participant.themeKey,
    })),
    overflowCount: Math.max(0, participants.length - 3),
  } satisfies InboxLeadingVM;
}

function buildSessionTimelineLabel(payload: Record<string, unknown>) {
  return (
    formatNaturalDateTime(
      payload.occurrenceStart ?? payload.scheduledStartAt ?? payload.startedAt,
      payload,
    ) ?? asOptionalString(payload.occurrenceLabel)
  );
}

function resolveReminderOffsetMinutes(payload: Record<string, unknown>) {
  const explicit = payload.reminderOffsetMinutes;
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0) {
    return Math.round(explicit);
  }

  const summary = asOptionalString(payload.summary);
  if (!summary) {
    return undefined;
  }

  const match = summary.match(/(\d+)\s+minutes?/i);
  if (!match) {
    return undefined;
  }

  const parsed = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function renderSessionTimelineGroup(event: ActivityEventRow) {
  const payload = asRecord(event.payload);
  const occurrenceStart =
    asOptionalString(payload.occurrenceStart) ??
    asOptionalString(payload.scheduledStartAt) ??
    asOptionalString(payload.startAt) ??
    asOptionalString(payload.startedAt);
  return {
    verb: event.event_type as ActivityVerbVM,
    leading: buildSessionParticipantsLeading(payload),
    headline: {
      primary: occurrenceStart ? `Class session ${occurrenceStart}` : 'Class session',
      secondary: sessionName(payload),
    },
    summary: 'Session activity and follow-up updates.',
    actionButton: undefined,
    metadata: {
      sessionGroupLocalTime: true,
      occurrenceStart,
      hideActionButton: true,
    },
  } satisfies ActivityRenderResult;
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

function buildMessageHeadline(input: {
  senderName: string;
  contextTitle?: string;
  isDirect?: boolean;
  multiple?: boolean;
}) {
  if (input.multiple) {
    return input.contextTitle
      ? `${input.senderName} sent you multiple ${
          input.isDirect ? 'direct ' : ''
        }messages in`
      : `${input.senderName} sent you multiple ${
          input.isDirect ? 'direct ' : ''
        }messages`;
  }

  return input.contextTitle
    ? `${input.senderName} sent you a ${input.isDirect ? 'direct ' : ''}message in`
    : `${input.senderName} sent you a ${input.isDirect ? 'direct ' : ''}message`;
}

export const ACTIVITY_EVENT_DEFINITIONS: Record<string, ActivityEventDefinition> = {
  'dm.posted': {
    eventType: 'dm.posted',
    tabKey: 'all',
    importance: 'normal',
    group: {
      groupType: 'message',
      collapseByDefault: true,
      buildGroupKey: (event) => {
        const payload = asRecord(event.payload);
        return buildHourlyChannelGroupKey('dm-posted', event, payload);
      },
      renderGroup: (event) => {
        const payload = asRecord(event.payload);
        const senderName = asString(payload.senderName, 'Someone');
        const contextTitle = getContextTitle(payload);
        return {
          verb: 'dms.posted',
          leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
          headline: {
            primary: buildMessageHeadline({
              senderName,
              contextTitle,
              isDirect: true,
              multiple: true,
            }),
            secondary: contextTitle,
          },
          summary: undefined,
          metadata: {
            channelId: payload.channelId,
            messageId: payload.messageId,
            dmGroup: true,
          },
        };
      },
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const senderName = asString(payload.senderName, 'Someone');
      const content = asString(payload.content).slice(0, 160);
      const contextTitle = getContextTitle(payload);
      return {
        verb: 'dm.posted',
        leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
        headline: {
          primary: buildMessageHeadline({
            senderName,
            contextTitle,
            isDirect: true,
          }),
          secondary: contextTitle,
          secondaryHref: buildInboxSourceHref(event, payload),
        },
        summary: undefined,
        expandedContent: content || undefined,
        actionButton: undefined,
        metadata: {
          channelId: payload.channelId,
          messageId: payload.messageId,
        },
      };
    },
  },
  'dm.reaction.added': {
    eventType: 'dm.reaction.added',
    tabKey: 'all',
    importance: 'normal',
    group: {
      groupType: 'message',
      collapseByDefault: true,
      buildGroupKey: (event) => {
        const payload = asRecord(event.payload);
        return buildHourlyChannelGroupKey('dm-posted', event, payload);
      },
      renderGroup: (event) => {
        const payload = asRecord(event.payload);
        const senderName = asString(payload.senderName, 'Someone');
        return {
          verb: 'dms.reactions.added',
          leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
          headline: {
            primary: `${senderName} reacted to your direct messages`,
            secondary: getContextTitle(payload),
          },
          summary: undefined,
          metadata: {
            channelId: payload.channelId,
            messageId: payload.messageId,
            dmReactionGroup: 'added',
          },
        };
      },
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const senderName = asString(payload.senderName, 'Someone');
      const emoji = asString(payload.emoji, '😀');
      return {
        verb: 'dm.reaction.added',
        leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
        headline: {
          primary: `${senderName} reacted ${emoji} to your direct message`,
          secondary: getContextTitle(payload),
        },
        summary: undefined,
        actionButton: undefined,
        metadata: {
          channelId: payload.channelId,
          messageId: payload.messageId,
          emoji,
        },
      };
    },
  },
  'dm.reaction.removed': {
    eventType: 'dm.reaction.removed',
    tabKey: 'all',
    importance: 'normal',
    group: {
      groupType: 'message',
      collapseByDefault: true,
      buildGroupKey: (event) => {
        const payload = asRecord(event.payload);
        return buildHourlyChannelGroupKey('dm-posted', event, payload);
      },
      renderGroup: (event) => {
        const payload = asRecord(event.payload);
        const senderName = asString(payload.senderName, 'Someone');
        return {
          verb: 'dms.reactions.removed',
          leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'neutral' },
          headline: {
            primary: `${senderName} removed reactions from your direct messages`,
            secondary: getContextTitle(payload),
          },
          summary: undefined,
          metadata: {
            channelId: payload.channelId,
            messageId: payload.messageId,
            dmReactionGroup: 'removed',
          },
        };
      },
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const senderName = asString(payload.senderName, 'Someone');
      const emoji = asString(payload.emoji, '😀');
      return {
        verb: 'dm.reaction.removed',
        leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'neutral' },
        headline: {
          primary: `${senderName} removed ${emoji} from your direct message`,
          secondary: getContextTitle(payload),
        },
        summary: undefined,
        actionButton: undefined,
        metadata: {
          channelId: payload.channelId,
          messageId: payload.messageId,
          emoji,
        },
      };
    },
  },
  'reaction.added': {
    eventType: 'reaction.added',
    tabKey: 'all',
    importance: 'normal',
    group: {
      groupType: 'message',
      collapseByDefault: true,
      buildGroupKey: (event) => {
        const payload = asRecord(event.payload);
        return buildHourlyChannelGroupKey('message-posted', event, payload);
      },
      renderGroup: (event) => {
        const payload = asRecord(event.payload);
        const senderName = asString(payload.senderName, 'Someone');
        return {
          verb: 'reactions.added',
          leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
          headline: {
            primary: `${senderName} reacted to your messages`,
            secondary: getContextTitle(payload),
          },
          summary: undefined,
          metadata: {
            channelId: payload.channelId,
            messageId: payload.messageId,
            reactionGroup: 'added',
          },
        };
      },
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const senderName = asString(payload.senderName, 'Someone');
      const emoji = asString(payload.emoji, '😀');
      return {
        verb: 'reaction.added',
        leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
        headline: {
          primary: `${senderName} reacted ${emoji} to your message in`,
          secondary: getContextTitle(payload),
        },
        summary: undefined,
        actionButton: sourceAction(event, payload),
        metadata: {
          channelId: payload.channelId,
          messageId: payload.messageId,
          emoji,
        },
      };
    },
  },
  'reaction.removed': {
    eventType: 'reaction.removed',
    tabKey: 'all',
    importance: 'normal',
    group: {
      groupType: 'message',
      collapseByDefault: true,
      buildGroupKey: (event) => {
        const payload = asRecord(event.payload);
        return buildHourlyChannelGroupKey('message-posted', event, payload);
      },
      renderGroup: (event) => {
        const payload = asRecord(event.payload);
        const senderName = asString(payload.senderName, 'Someone');
        return {
          verb: 'reactions.removed',
          leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'neutral' },
          headline: {
            primary: `${senderName} removed reactions from your messages`,
            secondary: getContextTitle(payload),
          },
          summary: undefined,
          metadata: {
            channelId: payload.channelId,
            messageId: payload.messageId,
            reactionGroup: 'removed',
          },
        };
      },
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const senderName = asString(payload.senderName, 'Someone');
      const emoji = asString(payload.emoji, '😀');
      return {
        verb: 'reaction.removed',
        leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'neutral' },
        headline: {
          primary: `${senderName} removed ${emoji} from your message in`,
          secondary: getContextTitle(payload),
        },
        summary: undefined,
        actionButton: sourceAction(event, payload),
        metadata: {
          channelId: payload.channelId,
          messageId: payload.messageId,
          emoji,
        },
      };
    },
  },
  'message.posted': {
    eventType: 'message.posted',
    tabKey: 'all',
    importance: 'normal',
    group: {
      groupType: 'message',
      collapseByDefault: true,
      buildGroupKey: (event) => {
        const payload = asRecord(event.payload);
        if (asOptionalString(payload.mentionedProfileId)) {
          return null;
        }
        return buildHourlyChannelGroupKey('message-posted', event, payload);
      },
      renderGroup: (event) => {
        const payload = asRecord(event.payload);
        const contextTitle = getContextTitle(payload) ?? 'Channel';
        return {
          verb: 'messages.posted',
          leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
          headline: {
            primary: 'New messages in',
            secondary: contextTitle,
          },
          summary: undefined,
          metadata: {
            channelId: payload.channelId,
            messageId: payload.messageId,
          },
        };
      },
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const senderName = asString(payload.senderName, 'Someone');
      const content = asString(payload.content).slice(0, 160);
      const mentionedProfileId = asOptionalString(payload.mentionedProfileId);
      const isMention = Boolean(mentionedProfileId);
      const contextTitle = getContextTitle(payload);
      return {
        verb: 'message.posted',
        leading: { kind: 'icon', iconKey: 'MessageSquare', tone: 'info' },
        headline: {
          primary: isMention
            ? `${senderName} mentioned you in`
            : buildMessageHeadline({
                senderName,
                contextTitle,
                isDirect: payload.channelRouteKind === 'dm',
              }),
          secondary: contextTitle,
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
      groupType: 'message',
      collapseByDefault: true,
      buildGroupKey: (event) => {
        const payload = asRecord(event.payload);
        return buildHourlyChannelGroupKey('message-posted', event, payload);
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
    render: (event) => renderClassCreatedLeaf(event),
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
    render: (event) => renderLearningSpaceUpdatedLeaf(event),
  },
  'class.archived': {
    eventType: 'class.archived',
    tabKey: 'classes',
    importance: 'important',
    group: null,
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const archivedOn = formatNaturalDate(event.occurred_at);
      return {
        verb: 'class.archived',
        leading: buildSystemLeadingAvatar(),
        headline: { primary: 'Class archived', secondary: className(payload) },
        summary: archivedOn
          ? `${className(payload)} was archived on ${archivedOn}.`
          : undefined,
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
            memberCount > 1 ? `${memberCount} participants added` : `${memberName} added`,
        },
        summary: `${membersSummary ? `${membersSummary} ` : ''}Added to ${className(payload)}.`,
      };
    },
  },
  'members.invited': {
    eventType: 'members.invited',
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
      const membersSummary = buildMembersSummary('Added', payload);
      return {
        verb: 'members.invited',
        leading: buildMembersLeading(payload),
        headline: {
          primary: `${Math.max(memberCount, members.length, 1)} participants added`,
        },
        summary: `${membersSummary ? `${membersSummary} ` : ''}Added to ${className(payload)}.`,
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
      if (isSessionRosterEvent(payload)) {
        const joinedAt =
          formatNaturalDateTime(payload.joinedAt ?? event.occurred_at, payload) ??
          formatNaturalDateTime(event.occurred_at, payload);
        return {
          verb: 'member.joined',
          leading: buildMembersLeading(payload),
          headline: {
            primary: `${asString(payload.memberDisplayName, 'Participant')} joined the session`,
          },
          summary: joinedAt ? `Joined at ${joinedAt}` : undefined,
        };
      }
      return {
        verb: 'member.joined',
        leading: buildMembersLeading(payload),
        headline: {
          primary: `${asString(payload.memberDisplayName, 'Participant')} joined class`,
        },
        summary: asOptionalString(payload.role),
      };
    },
  },
  'members.removed': {
    eventType: 'members.removed',
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
      if (isSessionRosterEvent(payload)) {
        const leftAt =
          formatNaturalDateTime(payload.leftAt ?? event.occurred_at, payload) ??
          formatNaturalDateTime(event.occurred_at, payload);
        return {
          verb: 'members.removed',
          leading: buildMembersLeading(payload),
          headline: {
            primary: `${asString(payload.memberDisplayName, 'Participant')} left the session`,
          },
          summary: leftAt ? `Left at ${leftAt}` : undefined,
        };
      }
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
        verb: 'members.removed',
        leading: buildMembersLeading(payload),
        headline: {
          primary:
            memberCount > 1
              ? `${memberCount} participants removed`
              : `${memberName} removed`,
        },
        summary: `${membersSummary ? `${membersSummary} ` : ''}Removed from ${className(payload)}.`,
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
      if (isSessionRosterEvent(payload)) {
        const leftAt =
          formatNaturalDateTime(payload.leftAt ?? event.occurred_at, payload) ??
          formatNaturalDateTime(event.occurred_at, payload);
        return {
          verb: 'member.removed',
          leading: buildMembersLeading(payload),
          headline: {
            primary: `${asString(payload.memberDisplayName, 'Participant')} left the session`,
          },
          summary: leftAt ? `Left at ${leftAt}` : undefined,
        };
      }
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
              ? `${memberCount} participants removed`
              : `${memberName} removed`,
        },
        summary: `${membersSummary ? `${membersSummary} ` : ''}Removed from ${className(payload)}.`,
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
  'class.session.scheduled': {
    eventType: 'class.session.scheduled',
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
      const firstSessionLabel = formatSessionLabel(payload.startAt, payload);
      const weeklyTime = formatWeeklyTimeLabel(payload.startAt, payload);
      const scheduledLabel = formatNaturalDateTime(
        payload.startAt ?? payload.firstSessionStartAt,
        payload,
      );
      const isUpdated = asOptionalString(payload.activityPhase) === 'updated';
      return {
        verb: 'class.session.scheduled',
        leading: { kind: 'icon', iconKey: 'CalendarDays', tone: 'info' },
        headline: {
          primary: isUpdated ? 'Class session scheduled' : 'Class session schedule added',
          secondary: sessionName(payload),
        },
        summary: isUpdated
          ? scheduledLabel
            ? `Session scheduled ${scheduledLabel}.`
            : asOptionalString(payload.startAt)
          : firstSessionLabel && weeklyTime
            ? `First session: ${firstSessionLabel}, then weekly ${weeklyTime}`
            : (asOptionalString(payload.startAt) ?? undefined),
        actionButton: sourceScheduleAction(event, payload),
        metadata: {
          sessionLocalTime: true,
          activityPhase: asOptionalString(payload.activityPhase),
          startAt: asOptionalString(payload.startAt),
          firstSessionStartAt: asOptionalString(payload.firstSessionStartAt),
        },
      };
    },
  },
  'class.sessions.scheduled': {
    eventType: 'class.sessions.scheduled',
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
      const firstSessionLabel = formatSessionLabel(payload.startAt, payload);
      const weeklyTime = formatWeeklyTimeLabel(payload.startAt, payload);
      const scheduledLabel = formatNaturalDateTime(
        payload.startAt ?? payload.firstSessionStartAt,
        payload,
      );
      const isUpdated = asOptionalString(payload.activityPhase) === 'updated';
      return {
        verb: 'class.sessions.scheduled',
        leading: { kind: 'icon', iconKey: 'CalendarDays', tone: 'info' },
        headline: {
          primary: isUpdated
            ? 'Class sessions scheduled'
            : 'Class session schedule added',
          secondary: sessionName(payload),
        },
        summary: isUpdated
          ? scheduledLabel
            ? `Session scheduled ${scheduledLabel}.`
            : asOptionalString(payload.startAt)
          : firstSessionLabel && weeklyTime
            ? `First session: ${firstSessionLabel}, then weekly ${weeklyTime}`
            : (asOptionalString(payload.startAt) ?? undefined),
        actionButton: sourceScheduleAction(event, payload),
        metadata: {
          sessionLocalTime: true,
          activityPhase: asOptionalString(payload.activityPhase),
          startAt: asOptionalString(payload.startAt),
          firstSessionStartAt: asOptionalString(payload.firstSessionStartAt),
        },
      };
    },
  },
  'class.session.rescheduled': {
    eventType: 'class.session.rescheduled',
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
        verb: 'class.session.rescheduled',
        leading: { kind: 'icon', iconKey: 'CalendarCheck', tone: 'info' },
        headline: {
          primary: 'Class session rescheduled',
          secondary: sessionName(payload),
        },
        summary:
          buildRescheduledSessionSummary(payload) ??
          asOptionalString(payload.description) ??
          asOptionalString(payload.startAt),
        metadata: {
          sessionLocalTime: true,
          title: asOptionalString(payload.title),
          startAt: asOptionalString(payload.startAt),
          firstSessionStartAt: asOptionalString(payload.firstSessionStartAt),
          timezone: asOptionalString(payload.timezone),
          firstSessionTimezone: asOptionalString(payload.firstSessionTimezone),
          rescheduledFromStartAt: asOptionalString(payload.rescheduledFromStartAt),
          rescheduledToStartAt: asOptionalString(payload.rescheduledToStartAt),
          rescheduledReason:
            asOptionalString(payload.rescheduledReason) ??
            asOptionalString(payload.reason),
        },
      };
    },
  },
  'class.sessions.rescheduled': {
    eventType: 'class.sessions.rescheduled',
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
        verb: 'class.sessions.rescheduled',
        leading: { kind: 'icon', iconKey: 'CalendarCheck', tone: 'info' },
        headline: {
          primary: 'Class sessions rescheduled',
          secondary: sessionName(payload),
        },
        summary:
          buildRescheduledSessionSummary(payload) ??
          asOptionalString(payload.description) ??
          asOptionalString(payload.startAt),
        metadata: {
          sessionLocalTime: true,
          title: asOptionalString(payload.title),
          startAt: asOptionalString(payload.startAt),
          firstSessionStartAt: asOptionalString(payload.firstSessionStartAt),
          timezone: asOptionalString(payload.timezone),
          firstSessionTimezone: asOptionalString(payload.firstSessionTimezone),
          rescheduledFromStartAt: asOptionalString(payload.rescheduledFromStartAt),
          rescheduledToStartAt: asOptionalString(payload.rescheduledToStartAt),
          rescheduledReason:
            asOptionalString(payload.rescheduledReason) ??
            asOptionalString(payload.reason),
        },
      };
    },
  },
  'class.session.canceled': {
    eventType: 'class.session.canceled',
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
        verb: 'class.session.canceled',
        leading: { kind: 'icon', iconKey: 'CalendarX', tone: 'warning' },
        headline: {
          primary: 'Class session cancelled',
          secondary: sessionName(payload),
        },
        summary:
          buildCanceledSessionSummary(payload) ??
          asOptionalString(payload.description) ??
          asOptionalString(payload.startAt),
        metadata: {
          sessionLocalTime: true,
          title: asOptionalString(payload.title),
          startAt: asOptionalString(payload.startAt),
          firstSessionStartAt: asOptionalString(payload.firstSessionStartAt),
          timezone: asOptionalString(payload.timezone),
          firstSessionTimezone: asOptionalString(payload.firstSessionTimezone),
          canceledStartAt: asOptionalString(payload.canceledStartAt),
          canceledReason:
            asOptionalString(payload.canceledReason) ?? asOptionalString(payload.reason),
        },
      };
    },
  },
  'class.sessions.canceled': {
    eventType: 'class.sessions.canceled',
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
        verb: 'class.sessions.canceled',
        leading: { kind: 'icon', iconKey: 'CalendarX', tone: 'warning' },
        headline: {
          primary: 'Class sessions cancelled',
          secondary: sessionName(payload),
        },
        summary:
          buildCanceledSessionSummary(payload) ??
          asOptionalString(payload.description) ??
          asOptionalString(payload.startAt),
        metadata: {
          sessionLocalTime: true,
          title: asOptionalString(payload.title),
          startAt: asOptionalString(payload.startAt),
          firstSessionStartAt: asOptionalString(payload.firstSessionStartAt),
          timezone: asOptionalString(payload.timezone),
          firstSessionTimezone: asOptionalString(payload.firstSessionTimezone),
          canceledStartAt: asOptionalString(payload.canceledStartAt),
          canceledReason:
            asOptionalString(payload.canceledReason) ?? asOptionalString(payload.reason),
        },
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
      renderGroup: (event) => renderSessionTimelineGroup(event),
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const timelineLabel = buildSessionTimelineLabel(payload);
      const joinPath = asOptionalString(payload.joinPath);
      return {
        verb: 'session.started',
        leading: buildSessionParticipantsLeading(payload),
        headline: {
          primary: timelineLabel
            ? `${sessionName(payload)} session ${timelineLabel}`
            : `${sessionName(payload)} session started`,
        },
        summary: 'Class is live now.',
        actionButton: joinPath
          ? {
              label: 'Join class',
              variant: 'default',
              href: joinPath,
            }
          : sourceAction(event, payload, 'outline', 'Open class'),
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
      renderGroup: (event) => renderSessionTimelineGroup(event),
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const endedAt = formatNaturalDateTime(
        payload.endedAt ?? event.occurred_at,
        payload,
      );
      return {
        verb: 'session.ended',
        leading: buildSessionParticipantsLeading(payload),
        headline: { primary: 'Session ended', secondary: sessionName(payload) },
        summary: endedAt ? `Ended at ${endedAt}` : undefined,
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
        return renderSessionTimelineGroup(event);
      },
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      const reminderOffsetMinutes = resolveReminderOffsetMinutes(payload);
      const classNameLabel = sessionName(payload);
      const sessionTimelineLabel =
        buildSessionTimelineLabel(payload) ?? asOptionalString(payload.occurrenceStart);
      return {
        verb: 'session.reminder.sent',
        leading: buildSessionParticipantsLeading(payload),
        headline: {
          primary: reminderOffsetMinutes
            ? `Your class session will start in ${reminderOffsetMinutes} minutes`
            : 'Your class session will start soon',
        },
        summary: sessionTimelineLabel
          ? `Your session for ${classNameLabel} will start on ${sessionTimelineLabel}`
          : asOptionalString(payload.summary),
        actionButton: sourceAction(event, payload, 'default', 'Join class'),
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
        return renderSessionTimelineGroup(event);
      },
    },
    resolveRecipients: DEFAULT_RECIPIENTS,
    render: (event) => {
      const payload = asRecord(event.payload);
      return {
        verb: 'session.feedback_request.sent',
        leading: buildSessionParticipantsLeading(payload),
        headline: {
          primary: 'Class feedback requested',
          secondary: "How was today's session?",
        },
        summary: asOptionalString(payload.summary) ?? 'Rate this class in one minute.',
        metadata: {
          sourceEventId: event.id,
          messageId: asOptionalString(payload.messageId),
          classSessionId: asOptionalString(payload.scheduleId),
          classroomId: asOptionalString(payload.learningSpaceId),
          channelId: asOptionalString(payload.channelId),
          occurrenceStart:
            asOptionalString(payload.occurrenceStart) ??
            asOptionalString(payload.startAt),
        },
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

export function listActivityEventDefinitionTypes() {
  return Object.keys(ACTIVITY_EVENT_DEFINITIONS).sort();
}
