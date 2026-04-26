import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { ThreadsService } from '@iconicedu/api/modules/threads/threads.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

@Controller('threads')
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Get()
  @UseGuards(AuthGuard)
  get(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('channelId') channelId: string,
    @Query('threadId') threadId: string,
    @Query('accountId') accountId?: string,
  ) {
    return this.threadsService.get(extractBearerToken(req.headers.authorization), {
      orgId,
      channelId,
      threadId,
      accountId,
    });
  }
}
