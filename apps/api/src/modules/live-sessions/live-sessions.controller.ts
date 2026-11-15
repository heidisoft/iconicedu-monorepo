import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';
import { LiveSessionsService } from '@iconicedu/api/modules/live-sessions/live-sessions.service';
import { parseJoinLiveSessionDto } from '@iconicedu/api/modules/live-sessions/dto/join-live-session.dto';

@Controller('channels')
export class LiveSessionsController {
  constructor(private readonly liveSessionsService: LiveSessionsService) {}

  @Post(':channelId/live-sessions/join')
  @UseGuards(AuthGuard)
  join(
    @Req() req: AuthenticatedRequest,
    @Param('channelId') channelId: string,
    @Body() body: unknown,
  ) {
    return this.liveSessionsService.joinLiveSession(
      extractBearerToken(req.headers.authorization),
      channelId,
      parseJoinLiveSessionDto(body),
    );
  }
}
