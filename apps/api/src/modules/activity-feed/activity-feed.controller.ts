import {
  Body,
  Controller,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { SubmitSessionFeedbackInput } from '@iconicedu/shared-types';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { ActivityFeedService } from '@iconicedu/api/modules/activity-feed/activity-feed.service';

type AuthenticatedRequest = {
  user: { id: string };
  headers: { authorization?: string };
};

type SubmitSessionFeedbackRequest = SubmitSessionFeedbackInput & {
  recipientProfileId?: string | null;
};

function extractBearerToken(authorization: string | undefined): string {
  const header = authorization?.trim() ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    throw new UnauthorizedException('Missing token');
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw new UnauthorizedException('Missing token');
  }
  return token;
}

@Controller('activity-feed')
export class ActivityFeedController {
  private readonly logger = new Logger(ActivityFeedController.name);

  constructor(private readonly activityFeedService: ActivityFeedService) {}

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
}
