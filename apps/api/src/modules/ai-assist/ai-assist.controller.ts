import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type {
  AiAssistEligibilityInput,
  AiRefineDraftInput,
  AiSuggestedRepliesInput,
} from '@iconicedu/shared-types';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { AiAssistService } from '@iconicedu/api/modules/ai-assist/ai-assist.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

@Controller('ai-assist')
export class AiAssistController {
  constructor(private readonly aiAssistService: AiAssistService) {}

  @Post('refine')
  @UseGuards(AuthGuard)
  refine(@Req() req: AuthenticatedRequest, @Body() body: AiRefineDraftInput) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.aiAssistService.refineDraft(req.user.id, accessToken, body);
  }

  @Post('suggested-replies')
  @UseGuards(AuthGuard)
  suggestedReplies(
    @Req() req: AuthenticatedRequest,
    @Body() body: AiSuggestedRepliesInput,
  ) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.aiAssistService.suggestReplies(req.user.id, accessToken, body);
  }

  /** Lets clients gate the composer affordances on the same server-computed truth `refine`/`suggested-replies` enforce, rather than evaluating flags client-side against a different identity. */
  @Get('eligibility')
  @UseGuards(AuthGuard)
  eligibility(
    @Req() req: AuthenticatedRequest,
    @Query() query: AiAssistEligibilityInput,
  ) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.aiAssistService.getEligibility(req.user.id, accessToken, query);
  }
}
