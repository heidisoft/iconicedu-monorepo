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
import { AssessmentItemsService } from './assessment-items.service';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import type { AuthenticatedRequest } from '@iconicedu/api/lib/http/authenticated-request';

@Controller('assessment-items')
export class AssessmentItemsController {
  constructor(private readonly service: AssessmentItemsService) {}

  @Get()
  @UseGuards(AuthGuard)
  listItems(
    @Query('orgId') orgId: string,
    @Query('skillId') skillId?: string,
    @Query('subjectIds') subjectIds?: string,
    @Query('grades') grades?: string,
    @Query('types') types?: string,
    @Query('difficulties') difficulties?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listItems(orgId, {
      skillId,
      subjectIds: subjectIds ? subjectIds.split(',').filter(Boolean) : undefined,
      grades: grades ? grades.split(',').map(Number).filter(Boolean) : undefined,
      types: types ? types.split(',').filter(Boolean) : undefined,
      difficulties: difficulties
        ? difficulties.split(',').map(Number).filter(Boolean)
        : undefined,
      search,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
    });
  }

  @Get('skill/:skillId/coverage')
  @UseGuards(AuthGuard)
  getSkillCoverage(@Param('skillId') skillId: string) {
    return this.service.getSkillCoverage(skillId);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  getItem(@Param('id') id: string, @Query('orgId') orgId: string) {
    return this.service.getItem(id, orgId);
  }

  @Post()
  @UseGuards(AuthGuard)
  createItem(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      orgId: string;
      skillId: string;
      title: string;
      type: string;
      content: Record<string, unknown>;
      explanation?: string;
      difficulty: number;
      estimatedTimeSeconds?: number;
    },
  ) {
    return this.service.createItem(body.orgId, req.user.id, body);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  updateItem(
    @Param('id') id: string,
    @Body()
    body: {
      orgId: string;
      skillId?: string;
      title?: string;
      content?: Record<string, unknown>;
      explanation?: string;
      difficulty?: number;
      estimatedTimeSeconds?: number;
    },
  ) {
    return this.service.updateItem(id, body.orgId, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  deleteItem(@Param('id') id: string, @Query('orgId') orgId: string) {
    return this.service.deleteItem(id, orgId);
  }
}
