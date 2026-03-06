export type DispatchRemindersDto = {
  limit?: number;
  leaseSeconds?: number;
  leaseOwner?: string;
};

function asOptionalInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.trunc(value);
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function parseDispatchRemindersDto(input: unknown): DispatchRemindersDto {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const body = input as Record<string, unknown>;
  return {
    limit: asOptionalInt(body.limit),
    leaseSeconds: asOptionalInt(body.leaseSeconds),
    leaseOwner: asOptionalString(body.leaseOwner),
  };
}
