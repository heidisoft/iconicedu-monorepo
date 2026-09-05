import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  ConfirmSessionCompletionInput,
  DisputeSessionCompletionInput,
  RateSessionCompletionInput,
  UndoSessionCompletionInput,
} from '@iconicedu/shared-types';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { SessionCompletionsService } from '@iconicedu/api/modules/session-completions/session-completions.service';
import type { AuthenticatedRequest } from '@iconicedu/api/lib/http/authenticated-request';

@Controller('session-completions')
export class SessionCompletionsController {
  constructor(private readonly sessionCompletionsService: SessionCompletionsService) {}

  @Get()
  @UseGuards(AuthGuard)
  list(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('profileId') profileId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.sessionCompletionsService.listForProfile(req.user.id, {
      orgId,
      profileId,
      cursor: cursor ?? null,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }

  @Post(':id/confirm')
  @UseGuards(AuthGuard)
  confirm(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: ConfirmSessionCompletionInput,
  ) {
    return this.sessionCompletionsService.confirm(req.user.id, {
      ...body,
      sessionCompletionId: id,
    });
  }

  @Post(':id/dispute')
  @UseGuards(AuthGuard)
  dispute(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: DisputeSessionCompletionInput,
  ) {
    return this.sessionCompletionsService.dispute(req.user.id, {
      ...body,
      sessionCompletionId: id,
    });
  }

  @Post(':id/rate')
  @UseGuards(AuthGuard)
  rate(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: RateSessionCompletionInput,
  ) {
    return this.sessionCompletionsService.rate(req.user.id, {
      ...body,
      sessionCompletionId: id,
    });
  }

  @Post(':id/undo')
  @UseGuards(AuthGuard)
  undo(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UndoSessionCompletionInput,
  ) {
    return this.sessionCompletionsService.undo(req.user.id, {
      ...body,
      sessionCompletionId: id,
    });
  }
}
