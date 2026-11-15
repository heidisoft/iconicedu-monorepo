import { AuthGuard } from '../auth/auth.guard';
import { parseJoinLiveSessionDto } from './dto/join-live-session.dto';
import { extractBearerToken } from '@iconicedu/api/lib/http/authenticated-request';
import {
  BadRequestException,
  HttpException,
  Res,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { LiveSessionsService } from '@iconicedu/api/modules/live-sessions/live-sessions.service';
import { parseGuestJoinLiveSessionDto } from '@iconicedu/api/modules/live-sessions/dto/guest-join-live-session.dto';
import { parseSubmitLiveSessionFeedbackDto } from '@iconicedu/api/modules/live-sessions/dto/submit-live-session-feedback.dto';
import { parseReportLiveSessionQualityEventDto } from '@iconicedu/api/modules/live-sessions/dto/report-live-session-quality-event.dto';
import { parseLogLiveSessionAuditEventDto } from '@iconicedu/api/modules/live-sessions/dto/log-live-session-audit-event.dto';
import { extractOptionalBearerToken } from '@iconicedu/api/lib/http/authenticated-request';

type IpAddressRequest = {
  ip?: string;
  socket?: { remoteAddress?: string };
};

// Relies on `app.set('trust proxy', 1)` in main.ts — with that set, Express
// computes `req.ip` from X-Forwarded-For itself, honoring only the one
// trusted hop (the platform's edge proxy) and ignoring any extra, client-
// injected entries. Do NOT parse X-Forwarded-For manually here — the first
// entry in that header is client-supplied and trivially spoofable, which
// previously let anyone defeat the rate limit below by sending a different
// one on every request.
function resolveClientIp(req: IpAddressRequest): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// Public join routes verify passcodes or bearer identity in the service.
// Share information is authenticated and additionally requires classroom access.
@Controller('live-sessions')
export class LiveSessionsPublicController {
  constructor(private readonly liveSessionsService: LiveSessionsService) {}

  @Post(':sessionId/member-access')
  @UseGuards(AuthGuard)
  @Header('Cache-Control', 'no-store')
  memberAccess(
    @Req() req: { headers: { authorization?: string } },
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
  ) {
    return this.liveSessionsService.memberAccess(
      extractBearerToken(req.headers.authorization),
      sessionId,
      parseJoinLiveSessionDto(body),
    );
  }

  @Post(':sessionId/invite-link')
  @UseGuards(AuthGuard)
  @Header('Cache-Control', 'no-store')
  inviteLink(
    @Req() req: { headers: { authorization?: string } },
    @Param('sessionId') sessionId: string,
  ) {
    return this.liveSessionsService.createInvitation(
      extractBearerToken(req.headers.authorization),
      sessionId,
    );
  }

  @Post(':sessionId/browser-handoff')
  @UseGuards(AuthGuard)
  @Header('Cache-Control', 'no-store')
  browserHandoff(
    @Req() req: { headers: { authorization?: string } },
    @Param('sessionId') sessionId: string,
  ) {
    return this.liveSessionsService.createBrowserHandoff(
      extractBearerToken(req.headers.authorization),
      sessionId,
    );
  }

  @Post(':sessionId/link-info')
  @Header('Cache-Control', 'no-store')
  linkInfo(
    @Req() req: IpAddressRequest & { headers: { authorization?: string } },
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
  ) {
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('Invalid meeting link');
    const input = body as Record<string, unknown>;
    if (
      typeof input.token !== 'string' ||
      !/^[\w-]{32}$/.test(input.token) ||
      typeof input.handoff !== 'boolean' ||
      (input.handoff &&
        (typeof input.redemptionKey !== 'string' ||
          !/^[\w-]{32}$/.test(input.redemptionKey)))
    )
      throw new BadRequestException('Invalid meeting link');
    return this.liveSessionsService.getLinkInfo(
      sessionId,
      input.token,
      input.handoff,
      extractOptionalBearerToken(req.headers.authorization),
      resolveClientIp(req),
      typeof input.redemptionKey === 'string' ? input.redemptionKey : '',
    );
  }

  @Post(':sessionId/admission-status')
  @Header('Cache-Control', 'no-store')
  admissionStatus(@Param('sessionId') sessionId: string, @Body() body: unknown) {
    const input = body as { token?: unknown; cancel?: unknown } | null;
    if (
      !input ||
      typeof input.token !== 'string' ||
      (input.cancel !== undefined && typeof input.cancel !== 'boolean')
    )
      throw new BadRequestException('Invalid admission token');
    return this.liveSessionsService.admissionStatus(
      sessionId,
      input.token,
      input.cancel === true,
    );
  }

  @Post(':sessionId/waiting-room')
  @Header('Cache-Control', 'no-store')
  waitingRoom(
    @Req() req: { headers: { authorization?: string } },
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
  ) {
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('Invalid waiting room request');
    const input = body as Record<string, unknown>;
    if (
      input.linkToken !== undefined &&
      (typeof input.linkToken !== 'string' || !/^[\w-]{32}$/.test(input.linkToken))
    )
      throw new BadRequestException('Invalid meeting link');
    if (
      input.id !== undefined &&
      (typeof input.id !== 'string' ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          input.id,
        ) ||
        typeof input.approved !== 'boolean')
    )
      throw new BadRequestException('Invalid admission decision');
    return this.liveSessionsService.moderateAdmissions(
      sessionId,
      extractOptionalBearerToken(req.headers.authorization),
      input.linkToken as string | undefined,
      typeof input.id === 'string'
        ? { id: input.id, approved: input.approved as boolean }
        : undefined,
    );
  }

  @Post(':sessionId/share-info')
  @UseGuards(AuthGuard)
  @Header('Cache-Control', 'no-store')
  shareInfo(
    @Req() req: { headers: { authorization?: string } },
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
  ) {
    return this.liveSessionsService.getShareInfo(
      extractBearerToken(req.headers.authorization),
      sessionId,
      parseJoinLiveSessionDto(body),
    );
  }

  @Post(':sessionId/guest-join')
  @Header('Cache-Control', 'no-store')
  async guestJoin(
    @Req() req: IpAddressRequest & { headers: { authorization?: string } },
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response?: { status: (code: number) => unknown },
  ) {
    try {
      return await this.liveSessionsService.guestJoinLiveSession(
        sessionId,
        resolveClientIp(req),
        parseGuestJoinLiveSessionDto(body),
        extractOptionalBearerToken(req.headers.authorization),
      );
    } catch (error) {
      // Waiting is a successful asynchronous admission request, not an observed failure.
      // Keep the capability out of exception analytics and error logs.
      if (error instanceof HttpException && error.getStatus() === 409) {
        const value = error.getResponse() as { admission?: unknown };
        if (value.admission) {
          response?.status(202);
          return { admission: value.admission };
        }
      }
      throw error;
    }
  }

  // Backs the /live/:sessionId landing page. Signing in is optional — pass a
  // bearer token to additionally learn whether the caller is the session's
  // host or resolve their own participant name (see getPublicLiveSessionInfo).
  @Get(':sessionId/public-info')
  @Header('Cache-Control', 'no-store')
  publicInfo(
    @Req() req: { headers: { authorization?: string } },
    @Param('sessionId') sessionId: string,
  ) {
    return this.liveSessionsService.getPublicLiveSessionInfo(
      sessionId,
      extractOptionalBearerToken(req.headers.authorization),
    );
  }

  // Anyone who was in the session (host, member, or anonymous guest) can
  // leave a post-session rating — see submitLiveSessionFeedback for how an
  // optional bearer token attributes it to a profile.
  @Post(':sessionId/feedback')
  submitFeedback(
    @Req() req: IpAddressRequest & { headers: { authorization?: string } },
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
  ) {
    return this.liveSessionsService.submitLiveSessionFeedback(
      sessionId,
      resolveClientIp(req),
      extractOptionalBearerToken(req.headers.authorization),
      parseSubmitLiveSessionFeedbackDto(body),
    );
  }

  // Fire-and-forget telemetry from the Zoom embed's network-quality-change /
  // connection-change listeners — see reportLiveSessionQualityEvent for why
  // this stays public-but-auth-aware rather than requiring a member token.
  @Post(':sessionId/quality-events')
  reportQualityEvent(
    @Req() req: IpAddressRequest & { headers: { authorization?: string } },
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
  ) {
    return this.liveSessionsService.reportLiveSessionQualityEvent(
      sessionId,
      resolveClientIp(req),
      extractOptionalBearerToken(req.headers.authorization),
      parseReportLiveSessionQualityEventDto(body),
    );
  }

  // Stub audit trail — see logLiveSessionAuditEvent's doc comment.
  @Post(':sessionId/audit-events')
  logAuditEvent(
    @Req() req: IpAddressRequest & { headers: { authorization?: string } },
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
  ) {
    return this.liveSessionsService.logLiveSessionAuditEvent(
      sessionId,
      resolveClientIp(req),
      extractOptionalBearerToken(req.headers.authorization),
      parseLogLiveSessionAuditEventDto(body),
    );
  }
}
