import { Body, Controller, Delete, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { ReactionsService } from '@iconicedu/api/modules/reactions/reactions.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

@Controller('reactions')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post()
  @UseGuards(AuthGuard)
  add(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      orgId: string;
      messageId: string;
      emoji: string;
      accountId: string;
      profileId: string;
    },
  ) {
    return this.reactionsService.add(extractBearerToken(req.headers.authorization), body);
  }

  @Delete()
  @UseGuards(AuthGuard)
  remove(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      orgId: string;
      messageId: string;
      emoji: string;
      accountId: string;
      profileId: string;
    },
  ) {
    return this.reactionsService.remove(
      extractBearerToken(req.headers.authorization),
      body,
    );
  }
}
