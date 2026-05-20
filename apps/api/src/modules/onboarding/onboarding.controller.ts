import { Body, Controller, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';
import { OnboardingService } from '@iconicedu/api/modules/onboarding/onboarding.service';

@Controller()
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('onboarding/role')
  @UseGuards(AuthGuard)
  role(
    @Req() req: AuthenticatedRequest,
    @Query('org') orgSlug: string | undefined,
    @Body() body: { role?: unknown; staffAccessCode?: unknown },
  ) {
    return this.onboardingService.completeRole(
      extractBearerToken(req.headers.authorization),
      body,
      orgSlug,
    );
  }

  @Post('onboarding/student')
  @UseGuards(AuthGuard)
  student(
    @Req() req: AuthenticatedRequest,
    @Query('org') orgSlug: string | undefined,
    @Body() body: { inviteCode?: unknown },
  ) {
    return this.onboardingService.completeStudent(
      extractBearerToken(req.headers.authorization),
      body,
      orgSlug,
    );
  }

  @Post('orgs/bootstrap')
  @UseGuards(AuthGuard)
  bootstrapOrg(
    @Req() req: AuthenticatedRequest,
    @Body() body: { name?: unknown; slug?: unknown },
  ) {
    return this.onboardingService.bootstrapOrg(
      extractBearerToken(req.headers.authorization),
      body,
    );
  }
}
