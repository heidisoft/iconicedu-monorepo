type SessionMember = Record<string, unknown> & {
  profileId?: string;
  role?: string;
  displayName?: string;
};

export type SessionCompletionCopy = {
  title: string;
  summary: string;
  promptTitle: string;
  promptBody: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
      )
    : [];
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

function formatNamesList(names: string[]) {
  const uniqueNames = Array.from(
    new Set(names.map((name) => name.trim()).filter(Boolean)),
  );
  if (!uniqueNames.length) {
    return undefined;
  }
  if (uniqueNames.length === 1) {
    return uniqueNames[0];
  }
  if (uniqueNames.length === 2) {
    return `${uniqueNames[0]} and ${uniqueNames[1]}`;
  }
  return `${uniqueNames[0]}, ${uniqueNames[1]} +${uniqueNames.length - 2} more`;
}

function possessiveName(name: string) {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

function getClassTitle(payload: Record<string, unknown>) {
  return (
    asOptionalString(payload.title) ??
    asOptionalString(payload.learningSpaceTitle) ??
    asOptionalString(payload.channelTopic) ??
    'Class'
  );
}

function getCompletionContext(payload: Record<string, unknown>) {
  const context = asRecord(payload.activityContext);
  const members = normalizeMembers(payload.members);
  const teacherNames = asStringArray(context.teacherNames);
  const studentNames = asStringArray(context.studentNames);
  const viewerStudentNames = asStringArray(context.viewerStudentNames);
  const fallbackTeacherNames = members
    .filter((member) => member.role === 'educator' || member.role === 'teacher')
    .map((member) => asOptionalString(member.displayName))
    .filter((value): value is string => Boolean(value));
  const fallbackStudentNames = members
    .filter((member) => member.role === 'child')
    .map((member) => asOptionalString(member.displayName))
    .filter((value): value is string => Boolean(value));

  return {
    classTitle:
      asOptionalString(context.classTitle) ??
      asOptionalString(context.contextTitle) ??
      getClassTitle(payload),
    viewerRole:
      asOptionalString(context.viewerRole) ?? asOptionalString(payload.viewerRole),
    teacherLabel: formatNamesList(teacherNames) ?? formatNamesList(fallbackTeacherNames),
    studentLabel:
      formatNamesList(viewerStudentNames) ??
      formatNamesList(studentNames) ??
      formatNamesList(fallbackStudentNames),
  };
}

function buildLessonSubject(input: {
  viewerRole?: string;
  teacherLabel?: string;
  studentLabel?: string;
}) {
  if (input.viewerRole === 'guardian' || input.viewerRole === 'staff') {
    if (input.studentLabel && input.teacherLabel) {
      return `the lesson for ${input.studentLabel} with ${input.teacherLabel}`;
    }
    if (input.studentLabel) {
      return `the lesson for ${input.studentLabel}`;
    }
  }

  if (input.viewerRole === 'educator') {
    if (input.studentLabel) {
      return `your lesson with ${input.studentLabel}`;
    }
  }

  if (input.viewerRole === 'child') {
    if (input.teacherLabel) {
      return `your lesson with ${input.teacherLabel}`;
    }
  }

  if (input.teacherLabel) {
    return `your lesson with ${input.teacherLabel}`;
  }

  if (input.studentLabel) {
    return `the lesson for ${input.studentLabel}`;
  }

  return 'your lesson';
}

function buildQuestionSubject(input: {
  viewerRole?: string;
  teacherLabel?: string;
  studentLabel?: string;
}) {
  if (input.viewerRole === 'guardian' || input.viewerRole === 'staff') {
    if (input.studentLabel && input.teacherLabel) {
      return `${input.studentLabel.includes(' and ') || input.studentLabel.includes(',') ? `the class for ${input.studentLabel}` : `${possessiveName(input.studentLabel)} class`} with ${input.teacherLabel}`;
    }
    if (input.studentLabel) {
      return `${input.studentLabel.includes(' and ') || input.studentLabel.includes(',') ? `the class for ${input.studentLabel}` : `${possessiveName(input.studentLabel)} class`}`;
    }
  }

  if (input.viewerRole === 'educator' && input.studentLabel) {
    return `your class with ${input.studentLabel}`;
  }

  if (input.viewerRole === 'child' && input.teacherLabel) {
    return `your class with ${input.teacherLabel}`;
  }

  if (input.teacherLabel) {
    return `your class with ${input.teacherLabel}`;
  }

  if (input.studentLabel) {
    return `the class for ${input.studentLabel}`;
  }

  return 'your class';
}

export function buildSessionCompletionCopy(
  eventPayload: Record<string, unknown>,
): SessionCompletionCopy {
  const payload = asRecord(eventPayload);
  const context = getCompletionContext(payload);
  const lessonSubject = buildLessonSubject(context);
  const questionSubject = buildQuestionSubject(context);
  const title = `Confirm ${lessonSubject}`;
  const promptBody = `How did ${questionSubject} go? Confirm, leave feedback, or report a problem. After 3 days, we will auto-confirm and release credits to the teacher.`;

  return {
    title,
    summary: promptBody,
    promptTitle: title,
    promptBody,
  };
}
