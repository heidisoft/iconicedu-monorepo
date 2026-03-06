import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

import {
  parseDispatchRemindersDto,
  type DispatchRemindersDto,
} from '@iconicedu/api/modules/reminders/dto/dispatch-reminders.dto';
import { RemindersService } from '@iconicedu/api/modules/reminders/reminders.service';

function resolveExpectedToken() {
  return (
    process.env.INTERNAL_REMINDERS_TOKEN_API?.trim() ||
    process.env.INTERNAL_REMINDERS_TOKEN?.trim() ||
    ''
  );
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
}
