import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { ActivityFeedQueryService } from '@iconicedu/api/modules/activity-feed/activity-feed-query.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

@Controller('activity-feed')
export class ActivityFeedController {
  constructor(private readonly activityFeedQueryService: ActivityFeedQueryService) {}

  @Get()
  @UseGuards(AuthGuard)
  getFeed(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('profileId') profileId: string,
  ) {
    return this.activityFeedQueryService.fetchFeed(
      extractBearerToken(req.headers.authorization),
      orgId,
      profileId,
    );
  }

  @Get('unread-badge-count')
  @UseGuards(AuthGuard)
  getUnreadBadgeCount(@Req() req: AuthenticatedRequest, @Query('orgId') orgId: string) {
    extractBearerToken(req.headers.authorization);
    return this.activityFeedQueryService.fetchUnreadBadgeCount(req.user.id, orgId);
  }

  @Get('admin/audit')
  @UseGuards(AuthGuard)
  getAdminAudit(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('limit') limit?: string,
  ) {
    extractBearerToken(req.headers.authorization);
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.activityFeedQueryService.fetchAdminActivityFeedAudit(req.user.id, orgId, {
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }

  @Post('read')
  @UseGuards(AuthGuard)
  markRead(
    @Req() req: AuthenticatedRequest,
    @Body() body: { orgId: string; profileId: string; ids: string[] },
  ) {
    return this.activityFeedQueryService.markRead(
      extractBearerToken(req.headers.authorization),
      body.orgId,
      body.profileId,
      body.ids,
    );
  }
}
