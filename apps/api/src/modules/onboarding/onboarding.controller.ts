import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';
import { OnboardingService } from '@iconicedu/api/modules/onboarding/onboarding.service';

@Controller()
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('onboarding/status')
  @UseGuards(AuthGuard)
  status(@Req() req: AuthenticatedRequest) {
    return this.onboardingService.getStatus(
      extractBearerToken(req.headers.authorization),
    );
  }

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

  @Post('onboarding/class-request')
  @UseGuards(AuthGuard)
  classRequest(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      requestIntent?: unknown;
      studentProfileIds?: unknown;
      subjects?: unknown;
      otherSubject?: unknown;
      learningGoals?: unknown;
      specialRequirements?: unknown;
    },
  ) {
    return this.onboardingService.submitClassRequest(
      extractBearerToken(req.headers.authorization),
      body,
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
