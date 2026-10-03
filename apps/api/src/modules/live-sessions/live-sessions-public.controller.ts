import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';

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

// No AuthGuard anywhere in this controller — every route here is intentionally
// public, gated by a session passcode rather than a bearer token. Kept
// separate from LiveSessionsController so that's obvious at a glance rather
// than relying on a missing @UseGuards being noticed in review.
@Controller('live-sessions')
export class LiveSessionsPublicController {
  constructor(private readonly liveSessionsService: LiveSessionsService) {}

  @Post(':sessionId/guest-join')
  guestJoin(
    @Req() req: IpAddressRequest,
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
  ) {
    return this.liveSessionsService.guestJoinLiveSession(
      sessionId,
      resolveClientIp(req),
      parseGuestJoinLiveSessionDto(body),
    );
  }

  // Backs the /live/:sessionId landing page. Signing in is optional — pass a
  // bearer token to additionally learn whether the caller is the session's
  // host, which carries a one-click host join (see getPublicLiveSessionInfo).
  @Get(':sessionId/public-info')
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
