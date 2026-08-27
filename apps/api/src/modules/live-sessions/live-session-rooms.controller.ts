import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import type { AuthenticatedRequest } from '@iconicedu/api/lib/http/authenticated-request';
import { LiveSessionsService } from '@iconicedu/api/modules/live-sessions/live-sessions.service';

type RoomJoinAccessBody = {
  orgSlug?: unknown;
  orgId?: unknown;
  actingProfileId?: unknown;
};

/**
 * Provider join credentials for an already-created live room.
 *
 * Kept separate from `LiveSessionsController` because this answers "let me into
 * room X" rather than "may I join occurrence Y" — membership is re-verified here,
 * so possessing a room id is never sufficient.
 */
@Controller('live-sessions/rooms')
export class LiveSessionRoomsController {
  constructor(private readonly liveSessionsService: LiveSessionsService) {}

  @Post(':liveSessionId/join-access')
  @UseGuards(AuthGuard)
  resolveJoinAccess(
    @Req() req: AuthenticatedRequest,
    @Param('liveSessionId') liveSessionId: string,
    @Body() body: RoomJoinAccessBody,
  ) {
    const orgSlug = typeof body?.orgSlug === 'string' ? body.orgSlug.trim() : '';
    const orgId = typeof body?.orgId === 'string' ? body.orgId.trim() : '';
    if (!orgSlug && !orgId) {
      throw new BadRequestException('orgSlug or orgId is required');
    }

    const actingProfileId =
      typeof body?.actingProfileId === 'string' ? body.actingProfileId.trim() : null;

    return this.liveSessionsService.resolveRoomJoinAccess({
      authUserId: req.user.id,
      orgSlug: orgSlug || null,
      orgId: orgId || null,
      liveSessionId,
      actingProfileId: actingProfileId || null,
    });
  }
}
