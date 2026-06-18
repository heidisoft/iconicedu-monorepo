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

@Controller('assessment-deliveries')
export class AssessmentDeliveriesController {
  constructor(private readonly service: AssessmentDeliveriesService) {}

  @Get()
  @UseGuards(AuthGuard)
  listDeliveries(
    @Query('orgId') orgId: string,
    @Query('search') search?: string,
    @Query('accessType') accessType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
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
  getDelivery(@Param('id') id: string, @Query('orgId') orgId: string) {
    return this.service.getDelivery(id, orgId);
  }

  @Post()
  @UseGuards(AuthGuard)
  createDelivery(
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
    return this.service.createDelivery(body.orgId, req.user.id, body);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  updateDelivery(
    @Param('id') id: string,
    @Body() body: { orgId: string } & Record<string, unknown>,
  ) {
    return this.service.updateDelivery(id, body.orgId, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  deleteDelivery(@Param('id') id: string, @Query('orgId') orgId: string) {
    return this.service.deleteDelivery(id, orgId);
  }

  @Post(':id/generate-token')
  @UseGuards(AuthGuard)
  generateToken(@Param('id') id: string, @Query('orgId') orgId: string) {
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
  getResults(@Param('id') id: string) {
    return this.service.getDeliveryResults(id);
  }

  @Get(':id/skill-breakdown')
  @UseGuards(AuthGuard)
  getSkillBreakdown(@Param('id') id: string) {
    return this.service.getDeliverySkillBreakdown(id);
  }
}
