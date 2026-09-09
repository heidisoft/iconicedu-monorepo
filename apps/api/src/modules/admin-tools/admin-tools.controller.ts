import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';
import { AdminToolsService } from './admin-tools.service';
import { parseAdminToolsDispatchRequest } from './admin-tools.dto';

@Controller('admin/tools')
export class AdminToolsController {
  constructor(private readonly tools: AdminToolsService) {}

  @Post('dispatch')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  dispatch(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.tools.dispatch(
      extractBearerToken(req.headers.authorization),
      parseAdminToolsDispatchRequest(body),
    );
  }
}
