import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { SchedulesService } from '@iconicedu/api/modules/schedules/schedules.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  @UseGuards(AuthGuard)
  list(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('channelId') channelId?: string,
  ) {
    return this.schedulesService.list(extractBearerToken(req.headers.authorization), {
      orgId,
      channelId,
    });
  }

  @Post('exceptions')
  @UseGuards(AuthGuard)
  createException(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: { orgId: string; scheduleId: string; date: string; reason?: string | null },
  ) {
    return this.schedulesService.createException(
      extractBearerToken(req.headers.authorization),
      body,
    );
  }
}
