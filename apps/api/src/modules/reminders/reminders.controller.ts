import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import {
  parseDispatchRemindersDto,
  type DispatchRemindersDto,
} from '@iconicedu/api/modules/reminders/dto/dispatch-reminders.dto';
import { parseLearningSpaceRemindersDto } from '@iconicedu/api/modules/reminders/dto/learning-space-reminders.dto';
import { RemindersService } from '@iconicedu/api/modules/reminders/reminders.service';

function resolveExpectedToken() {
  return process.env.INTERNAL_REMINDERS_TOKEN?.trim() || '';
}

@Controller()
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get('healthz')
  health() {
    return {
      ok: true,
      service: 'api',
      now: new Date().toISOString(),
    };
  }

  @Post('internal/reminders/dispatch')
  async dispatch(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const expectedToken = resolveExpectedToken();
    if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
      throw new UnauthorizedException('Unauthorized');
    }

    const dto: DispatchRemindersDto = parseDispatchRemindersDto(body);
    return this.remindersService.dispatchDueReminderJobs({
      leaseOwner: dto.leaseOwner ?? 'internal-reminders-dispatch-api',
      limit: dto.limit,
      leaseSeconds: dto.leaseSeconds,
    });
  }

  @Post('reminders/learning-space/compile')
  @UseGuards(AuthGuard)
  compileLearningSpace(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const dto = parseLearningSpaceRemindersDto(body);
    return this.remindersService.compileLearningSpaceReminderJobs(
      extractBearerToken(req.headers.authorization),
      dto,
    );
  }

  @Post('reminders/learning-space/cancel')
  @UseGuards(AuthGuard)
  cancelLearningSpace(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const dto = parseLearningSpaceRemindersDto(body);
    return this.remindersService.cancelLearningSpaceReminderJobs(
      extractBearerToken(req.headers.authorization),
      dto,
    );
  }

  @Post('reminders/learning-space/reconcile')
  @UseGuards(AuthGuard)
  reconcileLearningSpace(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const dto = parseLearningSpaceRemindersDto(body);
    return this.remindersService.reconcileLearningSpaceReminderJobs(
      extractBearerToken(req.headers.authorization),
      dto,
    );
  }

  @Post('internal/reminders/reconcile-space')
  async reconcileSpaceInternal(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const expectedToken = resolveExpectedToken();
    if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
      throw new UnauthorizedException('Unauthorized');
    }
    const dto = parseLearningSpaceRemindersDto(body);
    return this.remindersService.reconcileLearningSpaceReminderJobsInternal(dto);
  }

  @Post('internal/reminders/reset-and-reconcile-org')
  async resetAndReconcileOrg(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const expectedToken = resolveExpectedToken();
    if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
      throw new UnauthorizedException('Unauthorized');
    }
    const input =
      body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const orgId = typeof input.orgId === 'string' ? input.orgId.trim() : '';
    if (!orgId) {
      throw new BadRequestException('orgId is required');
    }
    return this.remindersService.resetAndReconcileOrgReminderJobs(orgId);
  }
}
