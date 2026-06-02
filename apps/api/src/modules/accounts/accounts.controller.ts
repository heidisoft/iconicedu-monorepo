import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { AccountsService } from '@iconicedu/api/modules/accounts/accounts.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    return this.accountsService.me(extractBearerToken(req.headers.authorization));
  }

  @Post('link-auth')
  @UseGuards(AuthGuard)
  linkAuth(@Req() req: AuthenticatedRequest, @Body() body: { email: string }) {
    return this.accountsService.linkAuth(
      extractBearerToken(req.headers.authorization),
      body,
    );
  }

  @Put('me')
  @UseGuards(AuthGuard)
  updateMe(
    @Req() req: AuthenticatedRequest,
    @Body() body: { phone?: string; onboardingCompletedAt?: string | null },
  ) {
    return this.accountsService.updateMe(
      extractBearerToken(req.headers.authorization),
      body,
    );
  }

  @Delete('me')
  @UseGuards(AuthGuard)
  deleteMe(@Req() req: AuthenticatedRequest) {
    return this.accountsService.deleteMe(extractBearerToken(req.headers.authorization));
  }

  @Post('activate')
  @UseGuards(AuthGuard)
  activate(@Req() req: AuthenticatedRequest) {
    return this.accountsService.activate(extractBearerToken(req.headers.authorization));
  }

  @Get('by-ids')
  @UseGuards(AuthGuard)
  byIds(@Req() req: AuthenticatedRequest, @Query('ids') ids: string) {
    const idList = (ids ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    return this.accountsService.byIds(
      extractBearerToken(req.headers.authorization),
      idList,
    );
  }
}
