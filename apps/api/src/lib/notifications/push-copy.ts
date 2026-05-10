import { formatDateTime, formatTime, resolveViewerTimezone } from '@iconicedu/utils';

type SessionMember = Record<string, unknown> & {
  profileId?: string;
  role?: string;
  displayName?: string;
};

type PersonalizedCopy = {
  title: string;
  summary: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function firstDefinedString(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    const normalized = asOptionalString(value);
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

function getContextTitle(payload: Record<string, unknown>) {
  return (
    asOptionalString(payload.learningSpaceTitle) ?? asOptionalString(payload.channelTopic)
  );
}

function getClassTitle(payload: Record<string, unknown>, fallback = 'Class') {
  return (
    firstDefinedString(
      payload.title,
      payload.learningSpaceTitle,
      payload.channelTopic,
      payload.description,
    ) ?? fallback
  );
}

function getEventSummary(
  payload: Record<string, unknown>,
  fallback: string,
  maxLength = 160,
) {
  const summary = firstDefinedString(
    payload.summary,
    payload.message,
    payload.description,
    payload.content,
    payload.startAt,
    payload.occurrenceStart,
  );
  return (summary ?? fallback).slice(0, maxLength);
}

function extractDisplayTimezone(payload: Record<string, unknown>) {
  return firstDefinedString(
    payload.viewerTimezone,
    payload.recipientTimezone,
    payload.timezone,
    payload.firstSessionTimezone,
  );
}

function formatSessionDateTime(value: unknown, payload: Record<string, unknown>) {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  return formatDateTime(
    value,
    resolveViewerTimezone(extractDisplayTimezone(payload)),
    'natural',
  );
}

function formatSessionWeekday(value: unknown, payload: Record<string, unknown>) {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: resolveViewerTimezone(extractDisplayTimezone(payload)),
    weekday: 'long',
  }).format(date);
}

function formatSessionWeeklyRecurrence(value: unknown, payload: Record<string, unknown>) {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  const weekday = formatSessionWeekday(value, payload);
  if (!weekday) {
    return undefined;
  }

  const timeLabel = formatTime(
    value,
    resolveViewerTimezone(extractDisplayTimezone(payload)),
    'withZone',
  );
  if (!timeLabel) {
    return undefined;
  }

  return `Every ${weekday} at ${timeLabel}`;
}

function appendReason(summary: string | undefined, reason: string | undefined) {
  if (!summary) {
    return undefined;
  }

  if (!reason) {
    return summary;
  }

  return `${summary} Reason: ${reason}.`;
}

function joinSummaryParts(parts: Array<string | undefined>) {
  const normalized = parts.filter((part): part is string => Boolean(part));
  return normalized.length ? normalized.join(' · ') : undefined;
}

function formatNamesList(names: string[]) {
  if (!names.length) {
    return undefined;
  }

  if (names.length === 1) {
    return names[0];
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names[0]}, ${names[1]} +${names.length - 2} more`;
}

function getRoleLabel(member: SessionMember | undefined) {
  return asString(member?.role);
}

function buildSessionAudienceLabel(input: {
  classTitle: string;
  teacherName?: string;
  studentLabel?: string;
  recipientRole?: string;
}) {
  const { classTitle, teacherName, studentLabel, recipientRole } = input;

  if (recipientRole === 'guardian' || recipientRole === 'staff') {
    if (studentLabel && teacherName) {
      return `${classTitle} for ${studentLabel} with ${teacherName}`;
    }
    if (studentLabel) {
      return `${classTitle} for ${studentLabel}`;
    }
  }

  if (recipientRole === 'educator') {
    if (studentLabel) {
      return `${classTitle} with ${studentLabel}`;
    }
    return classTitle;
  }

  if (recipientRole === 'child') {
    if (teacherName) {
      return `${classTitle} with ${teacherName}`;
    }
  }

  if (teacherName) {
    return `${classTitle} with ${teacherName}`;
  }

  return classTitle;
}

function getScheduledSessionSummary(payload: Record<string, unknown>) {
  const startAt = firstDefinedString(payload.startAt, payload.firstSessionStartAt);
  const recurringLabel = formatSessionWeeklyRecurrence(startAt, payload);
  const exactLabel = formatSessionDateTime(startAt, payload);

  if (recurringLabel && exactLabel) {
    return `${recurringLabel}. First session ${exactLabel}.`;
  }

  if (exactLabel) {
    return `Scheduled for ${exactLabel}.`;
  }

  return undefined;
}

function getRescheduledSessionSummary(payload: Record<string, unknown>) {
  const nextStartAt = firstDefinedString(
    payload.rescheduledToStartAt,
    payload.newStartAt,
    payload.startAt,
    payload.firstSessionStartAt,
  );
  const previousStartAt = firstDefinedString(
    payload.rescheduledFromStartAt,
    payload.previousStartAt,
  );
  const reason = firstDefinedString(payload.rescheduledReason, payload.reason);
  const nextLabel = formatSessionDateTime(nextStartAt, payload);
  const previousLabel = formatSessionDateTime(previousStartAt, payload);

  if (nextLabel && previousLabel) {
    return appendReason(`Moved from ${previousLabel} to ${nextLabel}.`, reason);
  }

  if (nextLabel) {
    return appendReason(`Now scheduled for ${nextLabel}.`, reason);
  }

  return undefined;
}

function getCanceledSessionSummary(payload: Record<string, unknown>) {
  const canceledAt = firstDefinedString(
    payload.canceledStartAt,
    payload.startAt,
    payload.firstSessionStartAt,
  );
  const reason = firstDefinedString(payload.canceledReason, payload.reason);
  const canceledLabel = formatSessionDateTime(canceledAt, payload);

  if (canceledLabel) {
    return appendReason(`Canceled for ${canceledLabel}.`, reason);
  }

  return undefined;
}

function normalizeMembers(value: unknown): SessionMember[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is SessionMember =>
      entry !== null && typeof entry === 'object' && !Array.isArray(entry),
  );
}

export function buildPersonalizedSessionCopy(
  eventType: string,
  eventPayload: Record<string, unknown>,
  recipientProfileId: string,
): PersonalizedCopy | null {
  const payload = asRecord(eventPayload);
  const members = normalizeMembers(payload.members);
  const recipient = members.find(
    (member) => asString(member.profileId) === recipientProfileId,
  );
  const educators = members.filter((member) => asString(member.role) === 'educator');
  const students = members.filter((member) => asString(member.role) === 'child');
  const teacherName = asOptionalString(educators[0]?.displayName);
  const studentLabel = formatNamesList(
    students
      .map((member) => asOptionalString(member.displayName))
      .filter((value): value is string => Boolean(value)),
  );
  const recipientRole = getRoleLabel(recipient);
  const classTitle = getClassTitle(payload, 'Class');
  const sessionAudienceLabel = buildSessionAudienceLabel({
    classTitle,
    teacherName,
    studentLabel,
    recipientRole,
  });

  if (
    eventType === 'message.posted' ||
    eventType === 'message.mentioned' ||
    eventType === 'message.thread_reply.posted' ||
    eventType === 'file.uploaded' ||
    eventType === 'image.uploaded' ||
    eventType === 'audio.uploaded'
  ) {
    const senderName = asString(payload.senderName);
    const content = asString(payload.content).slice(0, 160);
    const contextTitle = getContextTitle(payload);
    const isDirect = payload.channelRouteKind === 'dm';
    const isMention =
      eventType === 'message.mentioned' ||
      Boolean(asOptionalString(payload.mentionedProfileId));
    const isThreadReply =
      eventType === 'message.thread_reply.posted' || payload.threadReply === true;
    const dmMessageKind =
      eventType === 'image.uploaded'
        ? 'image'
        : eventType === 'audio.uploaded'
          ? 'audio'
          : eventType === 'file.uploaded'
            ? 'file'
            : asString(payload.dmMessageKind);

    let title: string;
    if (isThreadReply) {
      if (senderName && isDirect) {
        title = `${senderName} replied in your direct message thread`;
      } else if (senderName && contextTitle) {
        title = `${senderName} replied to a thread in ${contextTitle}`;
      } else if (senderName) {
        title = `${senderName} replied to a thread`;
      } else {
        title = 'New reply in a thread';
      }
    } else if (senderName && isMention) {
      title = isDirect
        ? `${senderName} mentioned you in a direct message`
        : contextTitle
          ? `${senderName} mentioned you in ${contextTitle}`
          : `${senderName} mentioned you`;
    } else if (senderName) {
      const messageLabel =
        dmMessageKind === 'image'
          ? 'an image'
          : dmMessageKind === 'audio'
            ? 'a voice message'
            : dmMessageKind === 'file'
              ? 'a file'
              : 'a message';
      const action =
        dmMessageKind === 'file' || dmMessageKind === 'image' ? 'shared' : 'sent';
      if (isDirect && dmMessageKind === 'file') {
        title = `${senderName} shared a file with you`;
      } else if (isDirect && dmMessageKind === 'image') {
        title = `${senderName} shared an image with you`;
      } else if (isDirect) {
        title = `${senderName} sent you ${
          messageLabel === 'a message' ? 'a direct message' : messageLabel
        }`;
      } else if (contextTitle) {
        title = `${senderName} ${action} ${messageLabel} in ${contextTitle}`;
      } else {
        title = `${senderName} ${action} ${messageLabel}`;
      }
    } else {
      title = 'New message';
    }

    return { title, summary: content || title };
  }

  if (eventType === 'reaction.added') {
    const senderName = asString(payload.senderName);
    const emoji = asString(payload.emoji);
    const contextTitle = getContextTitle(payload);
    const emojiPart = emoji ? ` ${emoji}` : '';

    let title: string;
    if (senderName && contextTitle) {
      title = `${senderName} reacted${emojiPart} to your message in ${contextTitle}`;
    } else if (senderName) {
      title = `${senderName} reacted${emojiPart} to your message`;
    } else {
      title = 'New reaction to your message';
    }
    return { title, summary: title };
  }

  if (eventType === 'class.session.rescheduled') {
    const oldLabel = formatSessionDateTime(
      firstDefinedString(
        payload.oldSessionDateTime,
        payload.rescheduledFromStartAt,
        payload.previousStartAt,
        payload.originalStartAt,
        payload.occurrenceStart,
      ),
      payload,
    );
    const newLabel = formatSessionDateTime(
      firstDefinedString(
        payload.newSessionDateTime,
        payload.rescheduledToStartAt,
        payload.newStartAt,
        payload.startAt,
        payload.firstSessionStartAt,
      ),
      payload,
    );
    return {
      title: classTitle,
      summary:
        oldLabel && newLabel
          ? `${classTitle} session ${oldLabel} was moved to ${newLabel}`
          : (getRescheduledSessionSummary(payload) ??
            'A class session has been rescheduled.'),
    };
  }

  if (eventType === 'class.session.canceled') {
    const sessionLabel = formatSessionDateTime(
      firstDefinedString(
        payload.sessionDateTime,
        payload.canceledStartAt,
        payload.startAt,
        payload.occurrenceStart,
        payload.firstSessionStartAt,
      ),
      payload,
    );
    return {
      title: classTitle,
      summary: sessionLabel
        ? `${classTitle} session ${sessionLabel} was canceled`
        : (getCanceledSessionSummary(payload) ?? 'A class session has been canceled.'),
    };
  }

  if (eventType === 'session.reminder.sent') {
    const startAt = firstDefinedString(
      payload.sessionDateTime,
      payload.startAt,
      payload.occurrenceStart,
      payload.firstSessionStartAt,
    );
    const startTime = startAt
      ? formatTime(
          startAt,
          resolveViewerTimezone(extractDisplayTimezone(payload)),
          'withZone',
        )
      : undefined;
    return {
      title: classTitle,
      summary:
        joinSummaryParts([
          'starts soon',
          startTime ? `Starts at ${startTime}` : undefined,
        ]) ?? getEventSummary(payload, `${classTitle} starts soon`),
    };
  }

  if (eventType === 'session.feedback_request.sent') {
    return {
      title: `Share feedback for ${classTitle}`,
      summary: 'Tell us how the session went',
    };
  }

  if (eventType === 'session.completed') {
    const fallback = `${classTitle} is complete`;
    return {
      title: recipient ? `${sessionAudienceLabel} is complete` : fallback,
      summary: getEventSummary(payload, 'Your class session is complete.'),
    };
  }

  if (!members.length) {
    return null;
  }

  if (!recipient) {
    return null;
  }

  return null;
}
