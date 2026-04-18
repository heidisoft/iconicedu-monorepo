import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { PushTokensService } from '@iconicedu/api/modules/push-tokens/push-tokens.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

@Controller('push-tokens')
export class PushTokensController {
  constructor(private readonly pushTokensService: PushTokensService) {}

  @Post('register')
  @UseGuards(AuthGuard)
  register(
    @Req() req: AuthenticatedRequest,
    @Body() body: { orgId: string; profileId: string; token: string; platform: string },
  ) {
    return this.pushTokensService.register(
      extractBearerToken(req.headers.authorization),
      body,
    );
  }

  @Post('revoke')
  @UseGuards(AuthGuard)
  revoke(@Req() req: AuthenticatedRequest, @Body() body: { token: string }) {
    return this.pushTokensService.revoke(
      extractBearerToken(req.headers.authorization),
      body,
    );
  }
}
