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
import type {
  ConfirmSessionCompletionInput,
  DisputeSessionCompletionInput,
  RateSessionCompletionInput,
  UndoSessionCompletionInput,
} from '@iconicedu/shared-types';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { SessionCompletionsService } from '@iconicedu/api/modules/session-completions/session-completions.service';
import type { AuthenticatedRequest } from '@iconicedu/api/lib/http/authenticated-request';

/**
 * Normalises the optional `completedSince` / `completedUntil` query pair at the
 * API boundary. Both are forwarded straight into PostgREST `session_end_at`
 * predicates, so a malformed value would otherwise surface as an internal
 * database error instead of a client-safe 400. Rejects non-timestamps and
 * inverted ranges, and canonicalises accepted values to ISO 8601 UTC so the
 * downstream half-open `[since, until)` window is always well-formed.
 */
function parseCompletedRange(
  completedSince: string | undefined,
  completedUntil: string | undefined,
): { completedSince: string | null; completedUntil: string | null } {
  const toEpochMs = (value: string | undefined, field: string): number | null => {
    if (value === undefined) return null;
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) {
      throw new BadRequestException(`${field} must be an ISO 8601 timestamp`);
    }
    return ms;
  };

  const sinceMs = toEpochMs(completedSince, 'completedSince');
  const untilMs = toEpochMs(completedUntil, 'completedUntil');
  if (sinceMs !== null && untilMs !== null && sinceMs >= untilMs) {
    throw new BadRequestException('completedSince must be earlier than completedUntil');
  }

  return {
    completedSince: sinceMs === null ? null : new Date(sinceMs).toISOString(),
    completedUntil: untilMs === null ? null : new Date(untilMs).toISOString(),
  };
}

@Controller('session-completions')
export class SessionCompletionsController {
  constructor(private readonly sessionCompletionsService: SessionCompletionsService) {}

  @Get('summary')
  @UseGuards(AuthGuard)
  summary(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('profileId') profileId: string,
    @Query('completedSince') completedSince?: string,
    @Query('completedUntil') completedUntil?: string,
  ) {
    return this.sessionCompletionsService.getCompletionSummaryForProfile(req.user.id, {
      orgId,
      profileId,
      ...parseCompletedRange(completedSince, completedUntil),
    });
  }

  @Get('org-summary')
  @UseGuards(AuthGuard)
  orgSummary(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('completedSince') completedSince?: string,
    @Query('completedUntil') completedUntil?: string,
  ) {
    return this.sessionCompletionsService.getOrgCompletionSummary(req.user.id, {
      orgId,
      ...parseCompletedRange(completedSince, completedUntil),
    });
  }

  @Get('channel-states')
  @UseGuards(AuthGuard)
  listChannelStates(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('channelId') channelId: string,
  ) {
    return this.sessionCompletionsService.listChannelCompletionStates(req.user.id, {
      orgId,
      channelId,
    });
  }

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

  @Get('admin')
  @UseGuards(AuthGuard)
  listForAdmin(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('completedSince') completedSince?: string,
    @Query('completedUntil') completedUntil?: string,
  ) {
    return this.sessionCompletionsService.listForAdmin(req.user.id, {
      orgId,
      ...parseCompletedRange(completedSince, completedUntil),
    });
  }
}
