import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';

import { NotificationEngineService } from '@iconicedu/api/modules/notification-engine/notification-engine.service';

function resolveExpectedActivityFeedToken() {
  return process.env.INTERNAL_ACTIVITY_FEED_TOKEN?.trim() || '';
}

function resolveExpectedNotificationsToken() {
  return (
    process.env.INTERNAL_NOTIFICATIONS_TOKEN_API?.trim() ||
    process.env.INTERNAL_NOTIFICATIONS_TOKEN?.trim() ||
    ''
  );
}

@Controller()
export class NotificationEngineController {
  constructor(private readonly notificationEngineService: NotificationEngineService) {}

  @Post('internal/activity-feed/project')
  async projectActivityFeed(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { eventIds?: string[]; limit?: number } | null,
  ) {
    const expectedToken = resolveExpectedActivityFeedToken();
    if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.notificationEngineService.projectActivityEvents({
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
    if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.notificationEngineService.dispatchDueNotificationJobs({
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
