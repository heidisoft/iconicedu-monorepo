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

@Controller('assessment-tests')
export class AssessmentTestsController {
  constructor(private readonly service: AssessmentTestsService) {}

  @Get()
  @UseGuards(AuthGuard)
  listTests(
    @Query('orgId') orgId: string,
    @Query('search') search?: string,
    @Query('mode') mode?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listTests(orgId, {
      search: search || undefined,
      mode: mode || undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  getTest(@Param('id') id: string, @Query('orgId') orgId: string) {
    return this.service.getTest(id, orgId);
  }

  @Post()
  @UseGuards(AuthGuard)
  createTest(
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
    return this.service.createTest(body.orgId, req.user.id, body);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  updateTest(
    @Param('id') id: string,
    @Body() body: { orgId: string } & Record<string, unknown>,
  ) {
    return this.service.updateTest(id, body.orgId, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  deleteTest(@Param('id') id: string, @Query('orgId') orgId: string) {
    return this.service.deleteTest(id, orgId);
  }

  // Sections
  @Post(':id/sections')
  @UseGuards(AuthGuard)
  addSection(
    @Param('id') testId: string,
    @Body()
    body: {
      title?: string;
      orderPosition?: number;
      shuffleItems?: boolean;
      itemsToShow?: number;
    },
  ) {
    return this.service.addSection(testId, body);
  }

  @Delete('sections/:sectionId')
  @UseGuards(AuthGuard)
  deleteSection(@Param('sectionId') sectionId: string) {
    return this.service.deleteSection(sectionId);
  }

  @Post('sections/:sectionId/items')
  @UseGuards(AuthGuard)
  addItemToSection(
    @Param('sectionId') sectionId: string,
    @Body() body: { itemId: string; orderPosition?: number; points?: number },
  ) {
    return this.service.addItemToSection(sectionId, body);
  }

  @Delete('sections/:sectionId/items/:itemId')
  @UseGuards(AuthGuard)
  removeItemFromSection(
    @Param('sectionId') sectionId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.removeItemFromSection(sectionId, itemId);
  }

  @Put('sections/:sectionId/items/reorder')
  @UseGuards(AuthGuard)
  reorderSectionItems(
    @Param('sectionId') sectionId: string,
    @Body() body: { items: { itemId: string; orderPosition: number }[] },
  ) {
    return this.service.reorderSectionItems(sectionId, body.items);
  }

  // Skill pools (adaptive)
  @Post(':id/skill-pools')
  @UseGuards(AuthGuard)
  addSkillPool(
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
    return this.service.addSkillPool(testId, body);
  }

  @Put('skill-pools/:poolId')
  @UseGuards(AuthGuard)
  updateSkillPool(
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
    return this.service.updateSkillPool(poolId, body);
  }

  @Delete('skill-pools/:poolId')
  @UseGuards(AuthGuard)
  removeSkillPool(@Param('poolId') poolId: string) {
    return this.service.removeSkillPool(poolId);
  }
}
