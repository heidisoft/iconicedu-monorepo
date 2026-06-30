import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AssessmentSessionsService } from './assessment-sessions.service';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import type { AuthenticatedRequest } from '@iconicedu/api/lib/http/authenticated-request';
import { AuthService } from '@iconicedu/api/modules/auth/auth.service';
import type { JwtPayload } from 'jsonwebtoken';

type OptionalAuthRequest = Request & {
  headers: { authorization?: string };
  user?: { id?: string };
};

@Controller('assessment-sessions')
export class AssessmentSessionsController {
  constructor(
    private readonly service: AssessmentSessionsService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  startSession(
    @Req() req: OptionalAuthRequest,
    @Body()
    body: {
      deliveryId: string;
      profileId?: string;
      anonName?: string;
      anonEmail?: string;
      accessToken?: string;
    },
  ) {
    return this.service.startSession({
      ...body,
      actorAccountId: this.getOptionalAuthUserId(req),
    });
  }

  @Get('my')
  @UseGuards(AuthGuard)
  getMySessions(@Req() req: AuthenticatedRequest) {
    return this.service.getMySessions(req.user.id);
  }

  @Get(':id')
  getSession(@Param('id') id: string) {
    return this.service.getSession(id);
  }

  @Put(':id/response')
  saveResponse(
    @Param('id') sessionId: string,
    @Body()
    body: {
      itemId: string;
      responseData: unknown;
      isFlagged?: boolean;
      timeSpentSeconds?: number;
    },
  ) {
    return this.service.saveResponse(sessionId, body);
  }

  @Post(':id/submit')
  submitSession(@Param('id') sessionId: string) {
    return this.service.submitSession(sessionId);
  }

  private getOptionalAuthUserId(req: OptionalAuthRequest): string | undefined {
    const authHeader = req.headers.authorization?.trim();
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      return undefined;
    }

    const decoded = this.authService.decodeToken(authHeader.slice('Bearer '.length));
    return decoded && typeof decoded === 'object'
      ? ((decoded as JwtPayload).sub as string | undefined)
      : undefined;
  }
}
