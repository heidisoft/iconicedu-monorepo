import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AssessmentDeliveriesService } from './assessment-deliveries.service';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import type { AuthenticatedRequest } from '@iconicedu/api/lib/http/authenticated-request';
import { requireAssessmentOrgManager } from '@iconicedu/api/modules/assessments/assessment-access';

@Controller('assessment-deliveries')
export class AssessmentDeliveriesController {
  constructor(private readonly service: AssessmentDeliveriesService) {}

  @Get()
  @UseGuards(AuthGuard)
  async listDeliveries(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('search') search?: string,
    @Query('accessType') accessType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await requireAssessmentOrgManager(req.user.id, orgId);
    return this.service.listDeliveries(orgId, {
      search: search || undefined,
      accessType: accessType || undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('by-token/:token')
  getDeliveryByToken(@Param('token') token: string) {
    return this.service.getDeliveryByToken(token);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async getDelivery(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('orgId') orgId: string,
  ) {
    await requireAssessmentOrgManager(req.user.id, orgId);
    return this.service.getDelivery(id, orgId);
  }

  @Post()
  @UseGuards(AuthGuard)
  async createDelivery(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      orgId: string;
      testId: string;
      title: string;
      accessType?: string;
      channelId?: string;
      startsAt?: string;
      endsAt?: string;
      maxAttempts?: number;
      collectNameEmail?: boolean;
      allowResume?: boolean;
    },
  ) {
    await requireAssessmentOrgManager(req.user.id, body.orgId);
    return this.service.createDelivery(body.orgId, req.user.id, body);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  async updateDelivery(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { orgId: string } & Record<string, unknown>,
  ) {
    await requireAssessmentOrgManager(req.user.id, body.orgId);
    return this.service.updateDelivery(id, body.orgId, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async deleteDelivery(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('orgId') orgId: string,
  ) {
    await requireAssessmentOrgManager(req.user.id, orgId);
    return this.service.deleteDelivery(id, orgId);
  }

  @Post(':id/generate-token')
  @UseGuards(AuthGuard)
  async generateToken(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('orgId') orgId: string,
  ) {
    await requireAssessmentOrgManager(req.user.id, orgId);
    return this.service.generateToken(id, orgId);
  }

  @Post(':id/participants')
  @UseGuards(AuthGuard)
  addParticipants(
    @Param('id') deliveryId: string,
    @Body() body: { profileIds: string[] },
  ) {
    return this.service.addParticipants(deliveryId, body.profileIds);
  }

  @Get(':id/results')
  @UseGuards(AuthGuard)
  async getResults(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('orgId') orgId: string,
  ) {
    await requireAssessmentOrgManager(req.user.id, orgId);
    return this.service.getDeliveryResults(id, orgId);
  }

  @Get(':id/skill-breakdown')
  @UseGuards(AuthGuard)
  async getSkillBreakdown(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('orgId') orgId: string,
  ) {
    await requireAssessmentOrgManager(req.user.id, orgId);
    return this.service.getDeliverySkillBreakdown(id, orgId);
  }
}
