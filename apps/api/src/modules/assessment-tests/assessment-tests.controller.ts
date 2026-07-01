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
import { AssessmentTestsService } from './assessment-tests.service';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import type { AuthenticatedRequest } from '@iconicedu/api/lib/http/authenticated-request';
import {
  requireAssessmentOrgManager,
  requireAssessmentSectionManager,
  requireAssessmentSkillPoolManager,
  requireAssessmentTestManager,
} from '@iconicedu/api/modules/assessments/assessment-access';

@Controller('assessment-tests')
export class AssessmentTestsController {
  constructor(private readonly service: AssessmentTestsService) {}

  @Get()
  @UseGuards(AuthGuard)
  async listTests(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('search') search?: string,
    @Query('mode') mode?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await requireAssessmentOrgManager(req.user.id, orgId);
    return this.service.listTests(orgId, {
      search: search || undefined,
      mode: mode || undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async getTest(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('orgId') orgId: string,
  ) {
    await requireAssessmentOrgManager(req.user.id, orgId);
    return this.service.getTest(id, orgId);
  }

  @Post()
  @UseGuards(AuthGuard)
  async createTest(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      orgId: string;
      title: string;
      description?: string;
      instructions?: string;
      mode?: string;
      timeLimitMinutes?: number;
      passingScorePercent?: number;
      shuffleSections?: boolean;
      showResultsImmediately?: boolean;
      showCorrectAnswers?: boolean;
      adaptiveConfig?: Record<string, unknown>;
    },
  ) {
    await requireAssessmentOrgManager(req.user.id, body.orgId);
    return this.service.createTest(body.orgId, req.user.id, body);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  async updateTest(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { orgId: string } & Record<string, unknown>,
  ) {
    await requireAssessmentOrgManager(req.user.id, body.orgId);
    return this.service.updateTest(id, body.orgId, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async deleteTest(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('orgId') orgId: string,
  ) {
    await requireAssessmentOrgManager(req.user.id, orgId);
    return this.service.deleteTest(id, orgId);
  }

  // Sections
  @Post(':id/sections')
  @UseGuards(AuthGuard)
  async addSection(
    @Req() req: AuthenticatedRequest,
    @Param('id') testId: string,
    @Body()
    body: {
      title?: string;
      orderPosition?: number;
      shuffleItems?: boolean;
      itemsToShow?: number;
    },
  ) {
    await requireAssessmentTestManager(req.user.id, testId);
    return this.service.addSection(testId, body);
  }

  @Delete('sections/:sectionId')
  @UseGuards(AuthGuard)
  async deleteSection(
    @Req() req: AuthenticatedRequest,
    @Param('sectionId') sectionId: string,
  ) {
    await requireAssessmentSectionManager(req.user.id, sectionId);
    return this.service.deleteSection(sectionId);
  }

  @Post('sections/:sectionId/items')
  @UseGuards(AuthGuard)
  async addItemToSection(
    @Req() req: AuthenticatedRequest,
    @Param('sectionId') sectionId: string,
    @Body() body: { itemId: string; orderPosition?: number; points?: number },
  ) {
    const actor = await requireAssessmentSectionManager(req.user.id, sectionId);
    return this.service.addItemToSection(sectionId, body, actor.orgId);
  }

  @Delete('sections/:sectionId/items/:itemId')
  @UseGuards(AuthGuard)
  async removeItemFromSection(
    @Req() req: AuthenticatedRequest,
    @Param('sectionId') sectionId: string,
    @Param('itemId') itemId: string,
  ) {
    await requireAssessmentSectionManager(req.user.id, sectionId);
    return this.service.removeItemFromSection(sectionId, itemId);
  }

  @Put('sections/:sectionId/items/reorder')
  @UseGuards(AuthGuard)
  async reorderSectionItems(
    @Req() req: AuthenticatedRequest,
    @Param('sectionId') sectionId: string,
    @Body() body: { items: { itemId: string; orderPosition: number }[] },
  ) {
    await requireAssessmentSectionManager(req.user.id, sectionId);
    return this.service.reorderSectionItems(sectionId, body.items);
  }

  // Skill pools (adaptive)
  @Post(':id/skill-pools')
  @UseGuards(AuthGuard)
  async addSkillPool(
    @Req() req: AuthenticatedRequest,
    @Param('id') testId: string,
    @Body()
    body: {
      skillId: string;
      targetItems?: number;
      minItems?: number;
      maxItems?: number;
      startDifficulty?: number;
      orderPosition?: number;
    },
  ) {
    const actor = await requireAssessmentTestManager(req.user.id, testId);
    return this.service.addSkillPool(testId, body, actor.orgId);
  }

  @Put('skill-pools/:poolId')
  @UseGuards(AuthGuard)
  async updateSkillPool(
    @Req() req: AuthenticatedRequest,
    @Param('poolId') poolId: string,
    @Body()
    body: {
      targetItems?: number;
      minItems?: number;
      maxItems?: number;
      startDifficulty?: number;
      orderPosition?: number;
    },
  ) {
    await requireAssessmentSkillPoolManager(req.user.id, poolId);
    return this.service.updateSkillPool(poolId, body);
  }

  @Delete('skill-pools/:poolId')
  @UseGuards(AuthGuard)
  async removeSkillPool(
    @Req() req: AuthenticatedRequest,
    @Param('poolId') poolId: string,
  ) {
    await requireAssessmentSkillPoolManager(req.user.id, poolId);
    return this.service.removeSkillPool(poolId);
  }
}
