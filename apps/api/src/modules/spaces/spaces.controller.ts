import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { SpacesService } from '@iconicedu/api/modules/spaces/spaces.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

function requireOrgId(orgId: string | undefined): asserts orgId is string {
  if (!orgId || typeof orgId !== 'string') {
    throw new BadRequestException('orgId is required');
  }
}

@Controller('spaces')
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  @Get()
  @UseGuards(AuthGuard)
  list(@Req() req: AuthenticatedRequest, @Query('orgId') orgId: string) {
    requireOrgId(orgId);
    return this.spacesService.list(extractBearerToken(req.headers.authorization), orgId);
  }

  @Get('support-channel')
  @UseGuards(AuthGuard)
  supportChannel(@Req() req: AuthenticatedRequest, @Query('orgId') orgId: string) {
    requireOrgId(orgId);
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
    requireOrgId(orgId);
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
    requireOrgId(orgId);
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
    requireOrgId(orgId);
    return this.spacesService.participants(
      extractBearerToken(req.headers.authorization),
      orgId,
      spaceId,
    );
  }
}
