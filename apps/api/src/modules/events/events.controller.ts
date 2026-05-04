import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import type { EventPipelineJobKind } from '@iconicedu/shared-types';

import { EventPipelineService } from '@iconicedu/api/modules/events/event-pipeline.service';

function resolveExpectedEventsDispatchToken() {
  return process.env.INTERNAL_EVENTS_TOKEN?.trim() || '';
}

function isAuthorizedBearer(
  authorization: string | undefined,
  tokens: Array<string | undefined>,
) {
  return tokens.some((token) => Boolean(token) && authorization === `Bearer ${token}`);
}

@Controller()
export class EventsController {
  constructor(private readonly eventPipelineService: EventPipelineService) {}

  @Post('internal/events/dispatch')
  async dispatchEventPipeline(
    @Headers('authorization') authorization: string | undefined,
    @Body()
    body: {
      limit?: number;
      leaseSeconds?: number;
      leaseOwner?: string;
      jobKinds?: EventPipelineJobKind[];
    } | null,
  ) {
    const expectedToken = resolveExpectedEventsDispatchToken();
    if (!expectedToken || !isAuthorizedBearer(authorization, [expectedToken])) {
      throw new UnauthorizedException('Unauthorized');
    }

    const allowedKinds = new Set<EventPipelineJobKind>([
      'activity.generate',
      'activity.project',
      'notification.prepare',
      'notification.deliver',
      'reminder.reconcile',
      'reminder.dispatch',
    ]);
    const jobKinds = Array.isArray(body?.jobKinds)
      ? body.jobKinds.filter((kind): kind is EventPipelineJobKind =>
          allowedKinds.has(kind),
        )
      : undefined;

    return this.eventPipelineService.dispatchDueJobs({
      leaseOwner:
        typeof body?.leaseOwner === 'string' && body.leaseOwner.trim().length > 0
          ? body.leaseOwner.trim()
          : 'internal-events-dispatch-api',
      limit: typeof body?.limit === 'number' ? body.limit : undefined,
      leaseSeconds:
        typeof body?.leaseSeconds === 'number' ? body.leaseSeconds : undefined,
      jobKinds,
    });
  }
}
