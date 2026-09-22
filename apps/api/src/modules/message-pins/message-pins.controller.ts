import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { MessagePinsService } from '@iconicedu/api/modules/message-pins/message-pins.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

@Controller('message-pins')
export class MessagePinsController {
  constructor(private readonly messagePinsService: MessagePinsService) {}

  @Get()
  @UseGuards(AuthGuard)
  list(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('channelId') channelId: string,
    @Query('profileId') profileId: string,
    @Query('accountId') accountId: string,
  ) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.messagePinsService.listPinned(accessToken, {
      orgId,
      channelId,
      profileId,
      accountId,
    });
  }

  @Post()
  @UseGuards(AuthGuard)
  toggle(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      orgId: string;
      channelId: string;
      messageId: string;
      isPinned: boolean;
      profileId: string;
    },
  ) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.messagePinsService.togglePin(accessToken, body);
  }
}
