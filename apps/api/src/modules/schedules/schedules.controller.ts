import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { SchedulesService } from '@iconicedu/api/modules/schedules/schedules.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';
import {
  parseCancelSessionDto,
  parseDeleteSchedulesDto,
  parseReplaceSchedulesDto,
  parseRescheduleSessionDto,
} from '@iconicedu/api/modules/schedules/dto';

@Controller()
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('schedules')
  @UseGuards(AuthGuard)
  list(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('channelId') channelId?: string,
  ) {
    if (!orgId || typeof orgId !== 'string') {
      throw new BadRequestException('orgId is required');
    }
    return this.schedulesService.list(extractBearerToken(req.headers.authorization), {
      orgId,
      channelId,
    });
  }

  @Post('schedules/exceptions')
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

  @Post('schedules/learning-space/replace')
  @UseGuards(AuthGuard)
  replaceSchedules(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const dto = parseReplaceSchedulesDto(body);
    return this.schedulesService.replaceSchedulesForLearningSpace(
      extractBearerToken(req.headers.authorization),
      dto,
    );
  }

  @Post('schedules/learning-space/delete')
  @UseGuards(AuthGuard)
  deleteSchedules(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const dto = parseDeleteSchedulesDto(body);
    return this.schedulesService.deleteSchedulesForLearningSpace(
      extractBearerToken(req.headers.authorization),
      dto,
    );
  }

  @Post('schedules/session/cancel')
  @UseGuards(AuthGuard)
  cancelSession(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const dto = parseCancelSessionDto(body);
    return this.schedulesService.cancelScheduleSession(
      extractBearerToken(req.headers.authorization),
      dto,
    );
  }

  @Post('schedules/session/reschedule')
  @UseGuards(AuthGuard)
  rescheduleSession(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const dto = parseRescheduleSessionDto(body);
    return this.schedulesService.rescheduleScheduleSession(
      extractBearerToken(req.headers.authorization),
      dto,
    );
  }
}
