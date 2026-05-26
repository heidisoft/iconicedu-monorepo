import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ChannelsService } from '@iconicedu/api/modules/channels/channels.service';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  @UseGuards(AuthGuard)
  listLegacy(@Req() req: AuthenticatedRequest) {
    return this.channelsService.listChannelsForUser(req.user.id);
  }

  @Get('dms')
  @UseGuards(AuthGuard)
  listDms(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('profileId') profileId: string,
    @Query('accountId') accountId: string,
  ) {
    return this.channelsService.getDirectMessages(
      extractBearerToken(req.headers.authorization),
      { orgId, profileId, accountId },
    );
  }

  @Get('supervised-dms')
  @UseGuards(AuthGuard)
  listSupervisedDms(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('guardianAccountId') guardianAccountId: string,
    @Query('guardianProfileId') guardianProfileId: string,
  ) {
    return this.channelsService.getSupervisedDirectMessages(
      extractBearerToken(req.headers.authorization),
      { orgId, guardianAccountId, guardianProfileId },
    );
  }

  @Get('find-dm')
  @UseGuards(AuthGuard)
  findDm(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('profileId') profileId: string,
    @Query('otherProfileId') otherProfileId: string,
  ) {
    return this.channelsService.findDirectMessageChannel(
      extractBearerToken(req.headers.authorization),
      { orgId, profileId, otherProfileId },
    );
  }

  @Post('ensure-dm')
  @UseGuards(AuthGuard)
  ensureDm(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      orgId?: string;
      profileId?: string;
      otherProfileId?: string;
    },
  ) {
    return this.channelsService.ensureDirectMessageChannel(
      extractBearerToken(req.headers.authorization),
      {
        orgId: body.orgId ?? '',
        profileId: body.profileId ?? '',
        otherProfileId: body.otherProfileId ?? '',
      },
    );
  }

  @Get('list')
  @UseGuards(AuthGuard)
  list(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('accountId') accountId: string,
  ) {
    return this.channelsService.getChannels(
      extractBearerToken(req.headers.authorization),
      { orgId, accountId },
    );
  }

  @Get(':channelId/dm-meta')
  @UseGuards(AuthGuard)
  dmMeta(
    @Req() req: AuthenticatedRequest,
    @Param('channelId') channelId: string,
    @Query('orgId') orgId: string,
    @Query('profileId') profileId: string,
    @Query('accountId') accountId: string,
  ) {
    return this.channelsService.getDirectMessageChannelMeta(
      extractBearerToken(req.headers.authorization),
      { orgId, profileId, accountId, channelId },
    );
  }

  @Get(':channelId/meta')
  @UseGuards(AuthGuard)
  meta(
    @Req() req: AuthenticatedRequest,
    @Param('channelId') channelId: string,
    @Query('orgId') orgId: string,
    @Query('accountId') accountId: string,
  ) {
    return this.channelsService.getChannelMeta(
      extractBearerToken(req.headers.authorization),
      { orgId, accountId, channelId },
    );
  }

  @Get(':channelId/membership')
  @UseGuards(AuthGuard)
  membership(
    @Req() req: AuthenticatedRequest,
    @Param('channelId') channelId: string,
    @Query('orgId') orgId: string,
    @Query('profileId') profileId: string,
  ) {
    return this.channelsService.getMembership(
      extractBearerToken(req.headers.authorization),
      { orgId, channelId, profileId },
    );
  }

  @Get(':channelId/read-state')
  @UseGuards(AuthGuard)
  getReadState(
    @Req() req: AuthenticatedRequest,
    @Param('channelId') channelId: string,
    @Query('accountId') accountId: string,
    @Query('threadId') threadId?: string,
  ) {
    return this.channelsService.getReadState(
      extractBearerToken(req.headers.authorization),
      { channelId, accountId, threadId },
    );
  }

  @Post(':channelId/read-state')
  @UseGuards(AuthGuard)
  markReadState(
    @Req() req: AuthenticatedRequest,
    @Param('channelId') channelId: string,
    @Body()
    body: {
      orgId: string;
      accountId: string;
      profileId: string;
      threadId?: string | null;
      lastReadMessageId?: string | null;
    },
  ) {
    return this.channelsService.markReadState(
      extractBearerToken(req.headers.authorization),
      {
        ...body,
        channelId,
      },
    );
  }

  @Post(':channelId/read')
  @UseGuards(AuthGuard)
  markRead(
    @Req() req: AuthenticatedRequest,
    @Param('channelId') channelId: string,
    @Body()
    body: {
      orgId: string;
      accountId: string;
      profileId: string;
      lastReadMessageId?: string;
    },
  ) {
    return this.channelsService.markRead(extractBearerToken(req.headers.authorization), {
      ...body,
      channelId,
    });
  }
}
