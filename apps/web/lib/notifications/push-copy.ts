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
