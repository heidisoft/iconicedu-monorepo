import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { MessageSearchService } from '@iconicedu/api/modules/message-search/message-search.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

@Controller('message-search')
export class MessageSearchController {
  constructor(private readonly messageSearchService: MessageSearchService) {}

  @Get()
  @UseGuards(AuthGuard)
  search(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('channelId') channelId: string,
    @Query('query') query: string,
    @Query('profileId') profileId: string,
    @Query('accountId') accountId: string,
    @Query('senderProfileId') senderProfileId?: string,
    @Query('createdAfter') createdAfter?: string,
    @Query('createdBefore') createdBefore?: string,
    @Query('limit') limit?: string,
  ) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.messageSearchService.searchChannelMessages(accessToken, {
      orgId,
      channelId,
      query,
      profileId,
      accountId,
      senderProfileId,
      createdAfter,
      createdBefore,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
