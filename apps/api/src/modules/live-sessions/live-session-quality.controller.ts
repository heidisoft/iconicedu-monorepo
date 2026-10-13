import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';
import { LiveSessionQualityService } from './live-session-quality.service';

@Controller('live-sessions')
@UseGuards(AuthGuard)
export class LiveSessionQualityController {
  constructor(private readonly quality: LiveSessionQualityService) {}
  @Get(':sessionId/quality-events')
  @Header('Cache-Control', 'no-store')
  list(
    @Req() req: AuthenticatedRequest,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Query('orgId', new ParseUUIDPipe()) orgId: string,
  ) {
    return this.quality.list(
      extractBearerToken(req.headers.authorization),
      orgId,
      sessionId,
    );
  }
}
