import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { MessageMentionVM } from '@iconicedu/shared-types';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { ScheduledMessagesService } from '@iconicedu/api/modules/scheduled-messages/scheduled-messages.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

function resolveExpectedInternalToken() {
  return process.env.INTERNAL_REMINDERS_TOKEN?.trim() || '';
}

// No class-level route prefix (matches RemindersController) so the internal
// dispatch route can live outside the authenticated /scheduled-messages
// surface at exactly /internal/scheduled-messages/dispatch.
@Controller()
export class ScheduledMessagesController {
  constructor(private readonly scheduledMessagesService: ScheduledMessagesService) {}

  @Post('scheduled-messages')
  @UseGuards(AuthGuard)
  create(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      orgId: string;
      channelId: string;
      senderProfileId: string;
      content: string;
      mentions?: MessageMentionVM[];
      threadParentId?: string | null;
      threadId?: string | null;
      sendAt: string;
      timezone?: string | null;
    },
  ) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.scheduledMessagesService.create(req.user.id, accessToken, body);
  }

  @Get('scheduled-messages')
  @UseGuards(AuthGuard)
  list(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('senderProfileId') senderProfileId: string,
  ) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.scheduledMessagesService.list(accessToken, { orgId, senderProfileId });
  }

  @Put('scheduled-messages/:id')
  @UseGuards(AuthGuard)
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body()
    body: {
      orgId: string;
      content?: string;
      mentions?: MessageMentionVM[];
      sendAt?: string;
      timezone?: string | null;
    },
  ) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.scheduledMessagesService.update(accessToken, { ...body, id });
  }

  @Delete('scheduled-messages/:id')
  @UseGuards(AuthGuard)
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('orgId') orgId: string,
  ) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.scheduledMessagesService.cancel(accessToken, { orgId, id });
  }

  @Post('scheduled-messages/:id/send-now')
  @UseGuards(AuthGuard)
  sendNow(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { orgId: string },
  ) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.scheduledMessagesService.sendNow(accessToken, { orgId: body.orgId, id });
  }

  @Post('internal/scheduled-messages/dispatch')
  dispatch(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { limit?: number; leaseSeconds?: number; leaseOwner?: string },
  ) {
    const expectedToken = resolveExpectedInternalToken();
    if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
      throw new UnauthorizedException('Unauthorized');
    }
    return this.scheduledMessagesService.dispatchDueScheduledMessages({
      leaseOwner: body.leaseOwner ?? 'internal-scheduled-messages-dispatch-api',
      limit: body.limit,
      leaseSeconds: body.leaseSeconds,
    });
  }
}
