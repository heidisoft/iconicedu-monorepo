import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ChannelsService } from '@iconicedu/api/modules/channels/channels.service';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';

type AuthenticatedRequest = { user: { id: string } };

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  @UseGuards(AuthGuard)
  list(@Req() req: AuthenticatedRequest) {
    return this.channelsService.listChannelsForUser(req.user.id);
  }
}
