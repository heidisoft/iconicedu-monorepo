import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AssessmentSessionsService } from './assessment-sessions.service';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import type { AuthenticatedRequest } from '@iconicedu/api/lib/http/authenticated-request';

@Controller('assessment-sessions')
export class AssessmentSessionsController {
  constructor(private readonly service: AssessmentSessionsService) {}

  @Post()
  startSession(
    @Req() req: Request & { user?: { id?: string } },
    @Body()
    body: {
      deliveryId: string;
      profileId?: string;
      anonName?: string;
      anonEmail?: string;
    },
  ) {
    return this.service.startSession(body);
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
}
