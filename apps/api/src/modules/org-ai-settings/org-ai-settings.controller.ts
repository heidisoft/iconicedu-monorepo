import { Body, Controller, Get, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { UpdateOrgAiSettingsInput } from '@iconicedu/shared-types';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { OrgAiSettingsService } from '@iconicedu/api/lib/ai/org-ai-settings.service';
import type { AuthenticatedRequest } from '@iconicedu/api/lib/http/authenticated-request';

@Controller('org-ai-settings')
export class OrgAiSettingsController {
  constructor(private readonly orgAiSettingsService: OrgAiSettingsService) {}

  @Get()
  @UseGuards(AuthGuard)
  getSettings(@Req() req: AuthenticatedRequest, @Query('orgId') orgId: string) {
    return this.orgAiSettingsService.getAdminView(req.user.id, orgId);
  }

  @Put()
  @UseGuards(AuthGuard)
  updateSettings(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateOrgAiSettingsInput,
  ) {
    return this.orgAiSettingsService.updateSettings(req.user.id, body.orgId, body);
  }
}
