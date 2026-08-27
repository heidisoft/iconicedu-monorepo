import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type {
  ClassSessionJoinAvailabilityVM,
  ClassSessionJoinResultVM,
} from '@iconicedu/shared-types';

import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import type { AuthenticatedRequest } from '@iconicedu/api/lib/http/authenticated-request';
import { LiveSessionsService } from '@iconicedu/api/modules/live-sessions/live-sessions.service';
import {
  parseClassSessionJoinAvailabilityDto,
  parseClassSessionJoinAvailabilityRangeDto,
  parseJoinChannelLiveSessionDto,
  parseJoinClassSessionOccurrenceDto,
} from '@iconicedu/api/modules/live-sessions/dto/join-class-session-occurrence.dto';

@Controller('live-sessions')
export class LiveSessionsController {
  constructor(private readonly liveSessionsService: LiveSessionsService) {}

  /**
   * Whether the authenticated actor may join one exact class-session occurrence.
   * Clients call this instead of deciding from the viewer's role (issue #195).
   */
  @Post('class-sessions/availability')
  @UseGuards(AuthGuard)
  getClassSessionJoinAvailability(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<ClassSessionJoinAvailabilityVM> {
    return this.liveSessionsService.getClassSessionJoinAvailability({
      authUserId: req.user.id,
      dto: parseClassSessionJoinAvailabilityDto(body),
    });
  }

  /**
   * Availability for every visible occurrence in a range. Surfaces that render a
   * list of session cards ask once instead of per card.
   */
  @Post('class-sessions/availability-range')
  @UseGuards(AuthGuard)
  listClassSessionJoinAvailability(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<ClassSessionJoinAvailabilityVM[]> {
    return this.liveSessionsService.listClassSessionJoinAvailability({
      authUserId: req.user.id,
      dto: parseClassSessionJoinAvailabilityRangeDto(body),
    });
  }

  /** Create or reuse the live room for one exact class-session occurrence. */
  @Post('class-sessions/join')
  @UseGuards(AuthGuard)
  joinClassSessionOccurrence(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<ClassSessionJoinResultVM> {
    return this.liveSessionsService.joinClassSessionOccurrence({
      authUserId: req.user.id,
      dto: parseJoinClassSessionOccurrenceDto(body),
    });
  }

  /**
   * Channel-scoped join for the classroom header, which joins whichever occurrence
   * is currently in its join window rather than a specific dated card.
   */
  @Post('channels/:channelId/join')
  @UseGuards(AuthGuard)
  joinChannelLiveSession(
    @Req() req: AuthenticatedRequest,
    @Param('channelId') channelId: string,
    @Body() body: unknown,
  ) {
    return this.liveSessionsService.joinChannelLiveSession({
      authUserId: req.user.id,
      channelId,
      dto: parseJoinChannelLiveSessionDto(body),
    });
  }
}
