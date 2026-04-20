import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { PresenceService } from '@iconicedu/api/modules/presence/presence.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

@Controller('presence')
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Get()
  @UseGuards(AuthGuard)
  list(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('profileIds') profileIds: string,
  ) {
    return this.presenceService.list(extractBearerToken(req.headers.authorization), {
      orgId,
      profileIds: profileIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    });
  }

  @Post()
  @UseGuards(AuthGuard)
  update(@Body() body: { orgId: string; profileId: string; status: string }) {
    return this.presenceService.update(body);
  }
}
