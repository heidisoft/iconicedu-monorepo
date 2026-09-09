import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
  ADMIN_TOOL_KINDS,
  type AdminToolsDispatchRequest,
} from '@iconicedu/shared-types';

export function parseAdminToolsDispatchRequest(
  input: unknown,
): AdminToolsDispatchRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new BadRequestException('Invalid request');
  const body = input as Record<string, unknown>;
  if (typeof body.orgId !== 'string' || !isUUID(body.orgId))
    throw new BadRequestException('A valid orgId is required');
  if (!ADMIN_TOOL_KINDS.includes(body.kind as AdminToolsDispatchRequest['kind']))
    throw new BadRequestException('Unknown admin tool');
  const integer = (key: string, min: number, max: number): number | undefined => {
    const value = body[key];
    if (value === undefined) return undefined;
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < min ||
      value > max
    ) {
      throw new BadRequestException(
        `${key} must be an integer between ${min} and ${max}`,
      );
    }
    return value;
  };
  if (
    body.leaseOwner !== undefined &&
    (typeof body.leaseOwner !== 'string' ||
      !body.leaseOwner.trim() ||
      body.leaseOwner.length > 100)
  ) {
    throw new BadRequestException('leaseOwner must be between 1 and 100 characters');
  }
  return {
    orgId: body.orgId,
    kind: body.kind as AdminToolsDispatchRequest['kind'],
    limit: integer('limit', 1, 200),
    leaseSeconds: integer('leaseSeconds', 30, 600),
    leaseOwner: typeof body.leaseOwner === 'string' ? body.leaseOwner.trim() : undefined,
  };
}
