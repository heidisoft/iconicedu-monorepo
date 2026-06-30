import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  SubmitCompletionVoteInput,
  SubmitSessionFeedbackInput,
} from '@iconicedu/shared-types';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { ActivityFeedService } from '@iconicedu/api/modules/activity-feed/activity-feed.service';
import { ActivityFeedQueryService } from '@iconicedu/api/modules/activity-feed/activity-feed-query.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

type SubmitSessionFeedbackRequest = SubmitSessionFeedbackInput & {
  recipientProfileId?: string | null;
};

@Controller('activity-feed')
export class ActivityFeedController {
  private readonly logger = new Logger(ActivityFeedController.name);

  constructor(
    private readonly activityFeedService: ActivityFeedService,
    private readonly activityFeedQueryService: ActivityFeedQueryService,
  ) {}

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

  @Post('feedback')
  @UseGuards(AuthGuard)
  submitFeedback(
    @Req() req: AuthenticatedRequest,
    @Body() body: SubmitSessionFeedbackRequest,
  ) {
    extractBearerToken(req.headers.authorization);
    this.logger.log(
      `submitFeedback authUserId=${req.user.id} orgId=${body.orgId} recipientProfileId=${body.recipientProfileId ?? 'none'} rating=${body.rating} sourceEventId=${body.sourceEventId ?? 'none'} messageId=${body.messageId ?? 'none'}`,
    );
    return this.activityFeedService.submitFeedback(req.user.id, body);
  }

  @Post('session-completion-vote')
  @UseGuards(AuthGuard)
  submitCompletionVote(
    @Req() req: AuthenticatedRequest,
    @Body() body: SubmitCompletionVoteInput,
  ) {
    this.logger.log(
      `submitCompletionVote authUserId=${req.user.id} orgId=${body.orgId} scheduleId=${body.scheduleId} status=${body.status}`,
    );
    return this.activityFeedService.submitCompletionVote(req.user.id, body);
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
