import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import type {
  ActivityEventRow,
  ActivityEventTypeVM,
  AudienceRuleVM,
  EntityRefVM,
  FeedScopeVM,
} from '@iconicedu/shared-types';

import { EventsService } from '@iconicedu/api/modules/events/events.service';

function resolveExpectedActivityFeedToken() {
  return process.env.INTERNAL_ACTIVITY_FEED_TOKEN?.trim() || '';
}

function resolveExpectedActivityProjectorToken() {
  return process.env.INTERNAL_ACTIVITY_PROJECTOR_TOKEN?.trim() || '';
}

function resolveExpectedNotificationsToken() {
  return (
    process.env.INTERNAL_NOTIFICATIONS_TOKEN_API?.trim() ||
    process.env.INTERNAL_NOTIFICATIONS_TOKEN?.trim() ||
    ''
  );
}

function isAuthorizedBearer(
  authorization: string | undefined,
  tokens: Array<string | undefined>,
) {
  return tokens.some((token) => Boolean(token) && authorization === `Bearer ${token}`);
}

@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post('internal/activity-feed/publish')
  async publishActivityFeedEvent(
    @Headers('authorization') authorization: string | undefined,
    @Body()
    body: {
      orgId: string;
      eventType: ActivityEventTypeVM;
      emitterLabel?: string;
      occurredAt?: string;
      sourceKind: ActivityEventRow['source_kind'];
      actorProfileId?: string | null;
      scope: FeedScopeVM;
      objectRef?: EntityRefVM | null;
      targetRef?: EntityRefVM | null;
      audienceRules?: AudienceRuleVM[];
      payload: Record<string, unknown>;
      dedupeKey?: string | null;
      createdBy?: string | null;
    } | null,
  ) {
    const expectedToken = resolveExpectedActivityFeedToken();
    if (!expectedToken || !isAuthorizedBearer(authorization, [expectedToken])) {
      throw new UnauthorizedException('Unauthorized');
    }

    if (
      !body ||
      typeof body.orgId !== 'string' ||
      typeof body.eventType !== 'string' ||
      typeof body.sourceKind !== 'string' ||
      !body.scope ||
      typeof body.scope !== 'object' ||
      !body.payload ||
      typeof body.payload !== 'object' ||
      Array.isArray(body.payload)
    ) {
      throw new UnauthorizedException('Invalid activity publish payload');
    }

    return this.eventsService.publishEvent({
      orgId: body.orgId,
      eventType: body.eventType,
      emitterLabel: body.emitterLabel,
      occurredAt: body.occurredAt,
      sourceKind: body.sourceKind,
      actorProfileId: body.actorProfileId ?? null,
      scope: body.scope,
      objectRef: body.objectRef ?? null,
      targetRef: body.targetRef ?? null,
      audienceRules: Array.isArray(body.audienceRules) ? body.audienceRules : undefined,
      payload: body.payload,
      dedupeKey: body.dedupeKey ?? null,
      createdBy: body.createdBy ?? null,
    });
  }

  @Post('internal/activity-feed/project')
  async projectActivityFeed(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { eventIds?: string[]; limit?: number } | null,
  ) {
    const expectedToken = resolveExpectedActivityProjectorToken();
    const fallbackToken = resolveExpectedActivityFeedToken();
    if (!isAuthorizedBearer(authorization, [expectedToken, fallbackToken])) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.eventsService.projectPendingEvents({
      eventIds: Array.isArray(body?.eventIds) ? body.eventIds : undefined,
      limit: typeof body?.limit === 'number' ? body.limit : undefined,
    });
  }

  @Post('internal/notifications/dispatch')
  async dispatchNotifications(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { limit?: number; leaseSeconds?: number; leaseOwner?: string } | null,
  ) {
    const expectedToken = resolveExpectedNotificationsToken();
    if (!expectedToken || !isAuthorizedBearer(authorization, [expectedToken])) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.eventsService.dispatchDueNotifications({
      leaseOwner:
        typeof body?.leaseOwner === 'string' && body.leaseOwner.trim().length > 0
          ? body.leaseOwner.trim()
          : 'internal-notifications-dispatch-api',
      limit: typeof body?.limit === 'number' ? body.limit : undefined,
      leaseSeconds:
        typeof body?.leaseSeconds === 'number' ? body.leaseSeconds : undefined,
    });
  }
}
