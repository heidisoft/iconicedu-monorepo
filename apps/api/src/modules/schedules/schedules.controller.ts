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
  parseSplitRecurringSessionDto,
} from '@iconicedu/api/modules/schedules/dto';

/** Upper bound on `?scheduleIds=` so a single request cannot fan out into an
 * unbounded `in (...)` filter. Web only ever asks for one id at a time today. */
export const MAX_CALENDAR_SCHEDULE_IDS = 100;

function parseScheduleIds(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') {
    throw new BadRequestException('scheduleIds must be a comma-separated string');
  }
  const ids = Array.from(
    new Set(
      raw
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  );
  if (ids.length > MAX_CALENDAR_SCHEDULE_IDS) {
    throw new BadRequestException(
      `scheduleIds accepts at most ${MAX_CALENDAR_SCHEDULE_IDS} ids`,
    );
  }
  return ids;
}

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

  @Get('schedules/calendar')
  @UseGuards(AuthGuard)
  listForCalendar(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('scheduleIds') scheduleIds?: string,
  ) {
    if (!orgId || typeof orgId !== 'string') {
      throw new BadRequestException('orgId is required');
    }
    return this.schedulesService.listForCalendar(
      extractBearerToken(req.headers.authorization),
      { orgId, scheduleIds: parseScheduleIds(scheduleIds) },
    );
  }

  @Get('schedules/learning-space/context')
  @UseGuards(AuthGuard)
  getLearningSpaceEditContext(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('learningSpaceId') learningSpaceId: string,
    @Query('channelId') channelId: string,
  ) {
    if (!orgId || typeof orgId !== 'string') {
      throw new BadRequestException('orgId is required');
    }
    if (!learningSpaceId || typeof learningSpaceId !== 'string') {
      throw new BadRequestException('learningSpaceId is required');
    }
    if (!channelId || typeof channelId !== 'string') {
      throw new BadRequestException('channelId is required');
    }
    return this.schedulesService.getLearningSpaceEditContext(
      extractBearerToken(req.headers.authorization),
      { orgId, learningSpaceId, channelId },
    );
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

  @Post('schedules/session/split')
  @UseGuards(AuthGuard)
  splitSession(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const dto = parseSplitRecurringSessionDto(body);
    return this.schedulesService.splitRecurringSeries(
      extractBearerToken(req.headers.authorization),
      dto,
    );
  }
}
