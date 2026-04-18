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

function getContextTitle(payload: Record<string, unknown>) {
  return (
    asOptionalString(payload.learningSpaceTitle) ?? asOptionalString(payload.channelTopic)
  );
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

  if (eventType === 'dm.posted') {
    const senderName = asString(payload.senderName);
    const content = asString(payload.content).slice(0, 160);
    const dmMessageKind = asString(payload.dmMessageKind);

    let title: string;
    if (!senderName) {
      title = 'New direct message';
    } else if (dmMessageKind === 'image') {
      title = `${senderName} sent you an image`;
    } else if (dmMessageKind === 'audio') {
      title = `${senderName} sent you a voice message`;
    } else if (dmMessageKind === 'file') {
      title = `${senderName} sent you a file`;
    } else {
      title = `${senderName} sent you a direct message`;
    }

    return { title, summary: content || title };
  }

  if (eventType === 'message.posted') {
    const senderName = asString(payload.senderName);
    const content = asString(payload.content).slice(0, 160);
    const contextTitle = getContextTitle(payload);
    const isMention = Boolean(asOptionalString(payload.mentionedProfileId));
    const isThreadReply = payload.threadReply === true;

    let title: string;
    if (isThreadReply) {
      if (senderName && contextTitle) {
        title = `${senderName} replied to a thread in ${contextTitle}`;
      } else if (senderName) {
        title = `${senderName} replied to a thread`;
      } else {
        title = 'New reply in a thread';
      }
    } else if (senderName && isMention) {
      title = contextTitle
        ? `${senderName} mentioned you in ${contextTitle}`
        : `${senderName} mentioned you`;
    } else if (senderName) {
      title = contextTitle
        ? `${senderName} sent you a message in ${contextTitle}`
        : `${senderName} sent you a message`;
    } else {
      title = 'New message';
    }

    return { title, summary: content || title };
  }

  if (eventType === 'file.uploaded') {
    const senderName = asString(payload.senderName);
    const name = asString(payload.name, 'File');
    const content = asOptionalString(payload.content);
    const contextTitle = getContextTitle(payload);
    const dmMessageKind = asString(payload.dmMessageKind);
    const fileCount =
      typeof payload.fileCount === 'number' && Number.isFinite(payload.fileCount)
        ? payload.fileCount
        : 1;

    let title: string;
    if (!senderName) {
      title = fileCount > 1 ? 'New files shared' : 'New file shared';
    } else if (fileCount > 1) {
      title = contextTitle
        ? `${senderName} shared ${fileCount} files in ${contextTitle}`
        : `${senderName} shared ${fileCount} files`;
    } else if (dmMessageKind === 'image') {
      title = contextTitle
        ? `${senderName} shared an image in ${contextTitle}`
        : `${senderName} shared an image`;
    } else if (dmMessageKind === 'audio') {
      title = contextTitle
        ? `${senderName} shared an audio file in ${contextTitle}`
        : `${senderName} shared an audio file`;
    } else {
      title = contextTitle
        ? `${senderName} shared a file in ${contextTitle}`
        : `${senderName} shared a file`;
    }

    const summary = (content ?? name).slice(0, 160);
    return { title, summary };
  }

  if (eventType === 'dm.reaction.added') {
    const senderName = asString(payload.senderName);
    const emoji = asString(payload.emoji);
    const emojiPart = emoji ? ` ${emoji}` : '';

    const title = senderName
      ? `${senderName} reacted${emojiPart} to your message`
      : 'New reaction to your message';
    return { title, summary: title };
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

  const members = normalizeMembers(payload.members);
  if (!members.length) {
    return null;
  }

  const recipient = members.find(
    (member) => asString(member.profileId) === recipientProfileId,
  );
  if (!recipient) {
    return null;
  }

  const educator = members.find((member) => asString(member.role) === 'educator');
  const child = members.find((member) => asString(member.role) === 'child');
  const teacherName = asOptionalString(educator?.displayName);
  const studentName = asOptionalString(child?.displayName);
  const classTitle = asString(payload.title, 'class');

  if (eventType === 'session.reminder.sent') {
    const explicitOffset = payload.reminderOffsetMinutes;
    const offsetMinutes =
      typeof explicitOffset === 'number' && Number.isFinite(explicitOffset)
        ? Math.round(explicitOffset)
        : undefined;

    if (offsetMinutes === undefined) {
      return null;
    }

    const titleSuffix = `${offsetMinutes} min`;
    const fallbackTitle = `Class starts in ${offsetMinutes} minutes`;
    const fallbackSummary = classTitle;

    switch (asString(recipient.role)) {
      case 'child':
        if (teacherName) {
          return {
            title: `Your class with ${teacherName} starts in ${titleSuffix}`,
            summary: `${classTitle} with ${teacherName}`,
          };
        }
        return { title: fallbackTitle, summary: fallbackSummary };
      case 'educator':
        if (studentName) {
          return {
            title: `${studentName}'s class starts in ${titleSuffix}`,
            summary: `${classTitle} with ${studentName}`,
          };
        }
        return { title: fallbackTitle, summary: fallbackSummary };
      case 'guardian':
      case 'staff':
        if (teacherName && studentName) {
          return {
            title: `${studentName}'s class with ${teacherName} starts in ${titleSuffix}`,
            summary: classTitle,
          };
        }
        return { title: fallbackTitle, summary: fallbackSummary };
      default:
        return { title: fallbackTitle, summary: fallbackSummary };
    }
  }

  if (eventType === 'session.feedback_request.sent') {
    const fallbackTitle = `How was today's class?`;
    const summary = `Rate today's ${classTitle} session`;

    switch (asString(recipient.role)) {
      case 'child':
        if (teacherName) {
          return {
            title: `How was your class with ${teacherName}?`,
            summary,
          };
        }
        return { title: fallbackTitle, summary };
      case 'educator':
        if (studentName) {
          return {
            title: `How did ${studentName} do?`,
            summary,
          };
        }
        return { title: fallbackTitle, summary };
      case 'guardian':
      case 'staff':
        if (teacherName && studentName) {
          return {
            title: `How was ${studentName}'s class with ${teacherName}?`,
            summary,
          };
        }
        return { title: fallbackTitle, summary };
      default:
        return { title: fallbackTitle, summary };
    }
  }

  return null;
}
