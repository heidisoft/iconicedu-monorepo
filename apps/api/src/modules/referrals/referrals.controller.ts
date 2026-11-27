import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';
import { ReferralsService } from './referrals.service';
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}
  @Get('offer')
  @Header('Cache-Control', 'no-store')
  offer() {
    return this.referrals.offer();
  }
  @Post('link')
  @UseGuards(AuthGuard)
  @Header('Cache-Control', 'no-store')
  link(@Req() req: AuthenticatedRequest, @Body() body: { orgId?: unknown }) {
    return this.referrals.link(
      extractBearerToken(req.headers.authorization),
      body?.orgId,
    );
  }
  @Get('links/:code')
  @Header('Cache-Control', 'no-store')
  resolve(@Param('code') code: string) {
    return this.referrals.resolve(code);
  }
  @Get('review')
  @UseGuards(AuthGuard)
  @Header('Cache-Control', 'no-store')
  list(@Req() req: AuthenticatedRequest, @Query('orgId') orgId: string) {
    return this.referrals.list(extractBearerToken(req.headers.authorization), orgId);
  }
  @Put(':id/review')
  @UseGuards(AuthGuard)
  review(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { status?: unknown; note?: unknown; referrerAccountId?: unknown },
  ) {
    return this.referrals.review(extractBearerToken(req.headers.authorization), id, body);
  }
}
