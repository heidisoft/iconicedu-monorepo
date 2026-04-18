import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { SpacesService } from '@iconicedu/api/modules/spaces/spaces.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

@Controller('spaces')
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  @Get()
  @UseGuards(AuthGuard)
  list(@Req() req: AuthenticatedRequest, @Query('orgId') orgId: string) {
    return this.spacesService.list(extractBearerToken(req.headers.authorization), orgId);
  }

  @Get('support-channel')
  @UseGuards(AuthGuard)
  supportChannel(@Req() req: AuthenticatedRequest, @Query('orgId') orgId: string) {
    return this.spacesService.supportChannel(
      extractBearerToken(req.headers.authorization),
      orgId,
    );
  }

  @Get('channels')
  @UseGuards(AuthGuard)
  channelsForProfile(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('profileId') profileId: string,
    @Query('accountId') accountId: string,
  ) {
    return this.spacesService.channels(
      extractBearerToken(req.headers.authorization),
      orgId,
      profileId,
      accountId,
    );
  }

  @Get(':spaceId/channels')
  @UseGuards(AuthGuard)
  channels(
    @Req() req: AuthenticatedRequest,
    @Param('spaceId') _spaceId: string,
    @Query('orgId') orgId: string,
    @Query('profileId') profileId: string,
    @Query('accountId') accountId: string,
  ) {
    return this.spacesService.channels(
      extractBearerToken(req.headers.authorization),
      orgId,
      profileId,
      accountId,
    );
  }

  @Get(':spaceId/participants')
  @UseGuards(AuthGuard)
  participants(
    @Req() req: AuthenticatedRequest,
    @Param('spaceId') spaceId: string,
    @Query('orgId') orgId: string,
  ) {
    return this.spacesService.participants(
      extractBearerToken(req.headers.authorization),
      orgId,
      spaceId,
    );
  }
}
