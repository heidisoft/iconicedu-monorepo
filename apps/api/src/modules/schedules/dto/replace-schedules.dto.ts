import { BadRequestException } from '@nestjs/common';

export type RecurrenceExceptionInput = {
  occurrenceKey: string;
  reason: string | null;
};

export type RecurrenceOverrideInput = {
  occurrenceKey: string;
  patch: {
    startAt: string;
    endAt: string;
    reason: string | null;
  };
};

export type RecurrenceRowInput = {
  frequency: string;
  interval: number | null;
  count: number | null;
  until: string | null;
  timezone: string | null;
  rawRrule: string | null;
  bysecond: number[] | null;
  byminute: number[] | null;
  byhour: number[] | null;
  byday: string[] | null;
  bymonthday: number[] | null;
  byyearday: number[] | null;
  byweekno: number[] | null;
  bymonth: number[] | null;
  bysetpos: number[] | null;
  wkst: string | null;
  exceptions: RecurrenceExceptionInput[];
  overrides: RecurrenceOverrideInput[];
};

export type ScheduleRowInput = {
  startAt: string;
  endAt: string;
  timezone: string;
  recurrence: RecurrenceRowInput | null;
};

export type ParticipantRowInput = {
  profileId: string;
  kind: 'educator' | 'child' | 'guardian' | 'staff' | 'observer';
  displayName: string | null;
  avatarUrl: string | null;
  themeKey: string | null;
};

export type ReplaceSchedulesDto = {
  orgId: string;
  learningSpaceId: string;
  channelId: string;
  createdBy: string;
  title: string;
  description: string | null;
  themeKey: string | null;
  participants: ParticipantRowInput[];
  schedules: ScheduleRowInput[];
};

function asRequiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${key} is required`);
  }
  return value.trim();
}

function asOptionalString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new BadRequestException(`${key} must be a string`);
  return value.trim() || null;
}

function asRequiredArray<T>(
  body: Record<string, unknown>,
  key: string,
  itemParser: (item: unknown, index: number) => T,
): T[] {
  const value = body[key];
  if (!Array.isArray(value)) throw new BadRequestException(`${key} must be an array`);
  return value.map(itemParser);
}

function parseParticipant(item: unknown, index: number): ParticipantRowInput {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new BadRequestException(`participants[${index}] is invalid`);
  }
  const p = item as Record<string, unknown>;
  const kind = p['kind'];
  if (
    kind !== 'educator' &&
    kind !== 'child' &&
    kind !== 'guardian' &&
    kind !== 'staff' &&
    kind !== 'observer'
  ) {
    throw new BadRequestException(
      `participants[${index}].kind must be educator, child, guardian, staff, or observer`,
    );
  }
  return {
    profileId: asRequiredString(p, 'profileId'),
    kind,
    displayName: asOptionalString(p, 'displayName'),
    avatarUrl: asOptionalString(p, 'avatarUrl'),
    themeKey: asOptionalString(p, 'themeKey'),
  };
}

function parseRecurrenceException(
  item: unknown,
  index: number,
): RecurrenceExceptionInput {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new BadRequestException(`exceptions[${index}] is invalid`);
  }
  const e = item as Record<string, unknown>;
  return {
    occurrenceKey: asRequiredString(e, 'occurrenceKey'),
    reason: asOptionalString(e, 'reason'),
  };
}

function parseRecurrenceOverride(item: unknown, index: number): RecurrenceOverrideInput {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new BadRequestException(`overrides[${index}] is invalid`);
  }
  const o = item as Record<string, unknown>;
  const patch = o['patch'];
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new BadRequestException(`overrides[${index}].patch is invalid`);
  }
  const p = patch as Record<string, unknown>;
  return {
    occurrenceKey: asRequiredString(o, 'occurrenceKey'),
    patch: {
      startAt: asRequiredString(p, 'startAt'),
      endAt: asRequiredString(p, 'endAt'),
      reason: asOptionalString(p, 'reason'),
    },
  };
}

function asOptionalNumberArray(
  body: Record<string, unknown>,
  key: string,
): number[] | null {
  const value = body[key];
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) throw new BadRequestException(`${key} must be an array`);
  return value.map((v, i) => {
    if (typeof v !== 'number')
      throw new BadRequestException(`${key}[${i}] must be a number`);
    return v;
  });
}

function asOptionalStringArray(
  body: Record<string, unknown>,
  key: string,
): string[] | null {
  const value = body[key];
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) throw new BadRequestException(`${key} must be an array`);
  return value.map((v, i) => {
    if (typeof v !== 'string')
      throw new BadRequestException(`${key}[${i}] must be a string`);
    return v;
  });
}

function parseRecurrence(item: unknown): RecurrenceRowInput | null {
  if (item === null || item === undefined) return null;
  if (typeof item !== 'object' || Array.isArray(item)) {
    throw new BadRequestException('recurrence must be an object');
  }
  const r = item as Record<string, unknown>;
  return {
    frequency: asRequiredString(r, 'frequency'),
    interval: typeof r['interval'] === 'number' ? r['interval'] : null,
    count: typeof r['count'] === 'number' ? r['count'] : null,
    until: asOptionalString(r, 'until'),
    timezone: asOptionalString(r, 'timezone'),
    rawRrule: asOptionalString(r, 'rawRrule'),
    bysecond: asOptionalNumberArray(r, 'bysecond'),
    byminute: asOptionalNumberArray(r, 'byminute'),
    byhour: asOptionalNumberArray(r, 'byhour'),
    byday: asOptionalStringArray(r, 'byday'),
    bymonthday: asOptionalNumberArray(r, 'bymonthday'),
    byyearday: asOptionalNumberArray(r, 'byyearday'),
    byweekno: asOptionalNumberArray(r, 'byweekno'),
    bymonth: asOptionalNumberArray(r, 'bymonth'),
    bysetpos: asOptionalNumberArray(r, 'bysetpos'),
    wkst: asOptionalString(r, 'wkst'),
    exceptions: Array.isArray(r['exceptions'])
      ? r['exceptions'].map(parseRecurrenceException)
      : [],
    overrides: Array.isArray(r['overrides'])
      ? r['overrides'].map(parseRecurrenceOverride)
      : [],
  };
}

function parseScheduleRow(item: unknown, index: number): ScheduleRowInput {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new BadRequestException(`schedules[${index}] is invalid`);
  }
  const s = item as Record<string, unknown>;
  return {
    startAt: asRequiredString(s, 'startAt'),
    endAt: asRequiredString(s, 'endAt'),
    timezone: asRequiredString(s, 'timezone'),
    recurrence: 'recurrence' in s ? parseRecurrence(s['recurrence']) : null,
  };
}

export function parseReplaceSchedulesDto(input: unknown): ReplaceSchedulesDto {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Invalid request body');
  }
  const body = input as Record<string, unknown>;
  return {
    orgId: asRequiredString(body, 'orgId'),
    learningSpaceId: asRequiredString(body, 'learningSpaceId'),
    channelId: asRequiredString(body, 'channelId'),
    createdBy: asRequiredString(body, 'createdBy'),
    title: asRequiredString(body, 'title'),
    description: asOptionalString(body, 'description'),
    themeKey: asOptionalString(body, 'themeKey'),
    participants: asRequiredArray(body, 'participants', parseParticipant),
    schedules: asRequiredArray(body, 'schedules', parseScheduleRow),
  };
}
