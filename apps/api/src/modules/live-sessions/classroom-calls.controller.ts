import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';
import { ClassroomCallsService } from './classroom-calls.service';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseClassroomPresence(body: unknown) {
  const b = body as Record<string, unknown> | null;
  if (
    !b ||
    typeof b.connectionId !== 'string' ||
    !uuid.test(b.connectionId) ||
    typeof b.active !== 'boolean' ||
    !Array.isArray(b.profileIds) ||
    b.profileIds.length > 12 ||
    b.profileIds.some((p) => typeof p !== 'string' || !uuid.test(p))
  )
    throw new BadRequestException('Invalid class presence');
  return {
    connectionId: b.connectionId,
    active: b.active,
    profileIds: b.profileIds as string[],
  };
}
@Controller('classroom-calls')
@UseGuards(AuthGuard)
export class ClassroomCallsController {
  constructor(private readonly calls: ClassroomCallsService) {}
  @Get('incoming')
  @Header('Cache-Control', 'no-store')
  incoming(@Req() req: AuthenticatedRequest) {
    return this.calls.incoming(extractBearerToken(req.headers.authorization));
  }
  @Get(':callId/detail')
  @Header('Cache-Control', 'no-store')
  detail(@Req() req: AuthenticatedRequest, @Param('callId', ParseUUIDPipe) id: string) {
    return this.calls.detail(extractBearerToken(req.headers.authorization), id);
  }
  @Post(':callId/join')
  joinMissed(
    @Req() req: AuthenticatedRequest,
    @Param('callId', ParseUUIDPipe) id: string,
  ) {
    return this.calls.joinMissed(extractBearerToken(req.headers.authorization), id);
  }
  @Post(':callId/message-tutor')
  messageTutor(
    @Req() req: AuthenticatedRequest,
    @Param('callId', ParseUUIDPipe) id: string,
  ) {
    return this.calls.messageTutor(extractBearerToken(req.headers.authorization), id);
  }
  @Get(':sessionId/roster')
  @Header('Cache-Control', 'no-store')
  roster(@Req() req: AuthenticatedRequest, @Param('sessionId') id: string) {
    return this.calls.roster(extractBearerToken(req.headers.authorization), id);
  }
  @Post(':sessionId/presence')
  presence(
    @Req() req: AuthenticatedRequest,
    @Param('sessionId') id: string,
    @Body() body: unknown,
  ) {
    const b = parseClassroomPresence(body);
    return this.calls.presence(
      extractBearerToken(req.headers.authorization),
      id,
      b.connectionId,
      b.profileIds,
      b.active,
    );
  }
  @Post(':sessionId/ring/:profileId')
  ring(
    @Req() req: AuthenticatedRequest,
    @Param('sessionId') id: string,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ) {
    return this.calls.ring(extractBearerToken(req.headers.authorization), id, profileId);
  }
  @Post(':callId/respond')
  respond(
    @Req() req: AuthenticatedRequest,
    @Param('callId', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const action = (body as { action?: unknown } | null)?.action;
    if (action !== 'accepted' && action !== 'declined' && action !== 'cancelled')
      throw new BadRequestException('Invalid call response');
    return this.calls.respond(extractBearerToken(req.headers.authorization), id, action);
  }
}
