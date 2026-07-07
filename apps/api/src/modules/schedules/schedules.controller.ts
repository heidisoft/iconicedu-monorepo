import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
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
  parseDecideSessionChangeRequestDto,
  parseDeleteSchedulesDto,
  parseReplaceSchedulesDto,
  parseRescheduleSessionDto,
  parseSelfServeCancelSessionDto,
  parseSelfServeRescheduleSessionDto,
  parseSelfServeUndoCancelSessionDto,
  parseUpsertSelfServePolicyDto,
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

  @Get('schedules/session/change-requests')
  @UseGuards(AuthGuard)
  listSessionChangeRequests(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('channelId') channelId?: string,
    @Query('scheduleId') scheduleId?: string,
  ) {
    if (!orgId || typeof orgId !== 'string') {
      throw new BadRequestException('orgId is required');
    }
    return this.schedulesService.listSessionChangeRequests(
      extractBearerToken(req.headers.authorization),
      { orgId, channelId, scheduleId },
    );
  }

  @Post('schedules/session/self-serve/cancel')
  @UseGuards(AuthGuard)
  selfServeCancelSession(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const dto = parseSelfServeCancelSessionDto(body);
    return this.schedulesService.selfServeCancelSession(
      extractBearerToken(req.headers.authorization),
      dto,
    );
  }

  @Post('schedules/session/self-serve/reschedule')
  @UseGuards(AuthGuard)
  selfServeRescheduleSession(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const dto = parseSelfServeRescheduleSessionDto(body);
    return this.schedulesService.selfServeRescheduleSession(
      extractBearerToken(req.headers.authorization),
      dto,
    );
  }

  @Get('schedules/session/self-serve/reschedule-options')
  @UseGuards(AuthGuard)
  getSelfServeRescheduleOptions(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('scheduleId') scheduleId: string,
    @Query('occurrenceKey') occurrenceKey?: string,
  ) {
    if (!orgId || typeof orgId !== 'string') {
      throw new BadRequestException('orgId is required');
    }
    if (!scheduleId || typeof scheduleId !== 'string') {
      throw new BadRequestException('scheduleId is required');
    }
    return this.schedulesService.getSelfServeRescheduleOptions(
      extractBearerToken(req.headers.authorization),
      {
        orgId,
        scheduleId,
        occurrenceKey:
          typeof occurrenceKey === 'string' && occurrenceKey.trim()
            ? occurrenceKey.trim()
            : null,
      },
    );
  }

  @Post('schedules/session/self-serve/undo-cancel')
  @UseGuards(AuthGuard)
  selfServeUndoCancelSession(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const dto = parseSelfServeUndoCancelSessionDto(body);
    return this.schedulesService.selfServeUndoCancelSession(
      extractBearerToken(req.headers.authorization),
      dto,
    );
  }

  @Get('schedules/session/self-serve/policies')
  @UseGuards(AuthGuard)
  listSelfServePolicies(@Req() req: AuthenticatedRequest, @Query('orgId') orgId: string) {
    if (!orgId || typeof orgId !== 'string') {
      throw new BadRequestException('orgId is required');
    }
    return this.schedulesService.listSelfServePolicies(
      extractBearerToken(req.headers.authorization),
      orgId,
    );
  }

  @Post('schedules/session/self-serve/policies')
  @UseGuards(AuthGuard)
  upsertSelfServePolicy(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const dto = parseUpsertSelfServePolicyDto(body);
    return this.schedulesService.upsertSelfServePolicy(
      extractBearerToken(req.headers.authorization),
      dto,
    );
  }

  @Post('schedules/session/change-requests/:id/approve')
  @UseGuards(AuthGuard)
  approveSessionChangeRequest(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = parseDecideSessionChangeRequestDto(body);
    return this.schedulesService.approveSessionChangeRequest(
      extractBearerToken(req.headers.authorization),
      id,
      dto,
    );
  }

  @Post('schedules/session/change-requests/:id/reject')
  @UseGuards(AuthGuard)
  rejectSessionChangeRequest(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = parseDecideSessionChangeRequestDto(body);
    return this.schedulesService.rejectSessionChangeRequest(
      extractBearerToken(req.headers.authorization),
      id,
      dto,
    );
  }
}
