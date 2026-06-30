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
import { AssessmentCurriculumService } from './assessment-curriculum.service';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import type { AuthenticatedRequest } from '@iconicedu/api/lib/http/authenticated-request';
import { requireAssessmentOrgManager } from '@iconicedu/api/modules/assessments/assessment-access';

@Controller('assessment-curriculum')
export class AssessmentCurriculumController {
  constructor(private readonly service: AssessmentCurriculumService) {}

  // Subjects
  @Get('subjects')
  @UseGuards(AuthGuard)
  async listSubjects(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('search') search?: string,
  ) {
    await requireAssessmentOrgManager(req.user.id, orgId);
    return this.service.listSubjects(orgId, search || undefined);
  }

  @Post('subjects')
  @UseGuards(AuthGuard)
  async createSubject(
    @Req() req: AuthenticatedRequest,
    @Body() body: { orgId: string; name: string; icon?: string; color?: string },
  ) {
    await requireAssessmentOrgManager(req.user.id, body.orgId);
    return this.service.createSubject(body.orgId, req.user.id, body);
  }

  @Put('subjects/:id')
  @UseGuards(AuthGuard)
  async updateSubject(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { orgId: string; name?: string; icon?: string; color?: string },
  ) {
    await requireAssessmentOrgManager(req.user.id, body.orgId);
    return this.service.updateSubject(id, body.orgId, body);
  }

  @Delete('subjects/:id')
  @UseGuards(AuthGuard)
  async deleteSubject(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('orgId') orgId: string,
  ) {
    await requireAssessmentOrgManager(req.user.id, orgId);
    return this.service.deleteSubject(id, orgId);
  }

  @Get('subjects/:id/tree')
  @UseGuards(AuthGuard)
  async getSubjectTree(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('orgId') orgId: string,
  ) {
    await requireAssessmentOrgManager(req.user.id, orgId);
    return this.service.getSubjectTree(id, orgId);
  }

  // Domains
  @Get('domains')
  @UseGuards(AuthGuard)
  async listDomains(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('subjectId') subjectId?: string,
  ) {
    await requireAssessmentOrgManager(req.user.id, orgId);
    return this.service.listDomains(orgId, subjectId);
  }

  @Post('domains')
  @UseGuards(AuthGuard)
  async createDomain(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      orgId: string;
      subjectId: string;
      name: string;
      grade: number;
      description?: string;
    },
  ) {
    await requireAssessmentOrgManager(req.user.id, body.orgId);
    return this.service.createDomain(body.orgId, body);
  }

  @Put('domains/:id')
  @UseGuards(AuthGuard)
  async updateDomain(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body()
    body: {
      orgId: string;
      name?: string;
      grade?: number;
      description?: string;
      orderPosition?: number;
    },
  ) {
    await requireAssessmentOrgManager(req.user.id, body.orgId);
    return this.service.updateDomain(id, body.orgId, body);
  }

  @Delete('domains/:id')
  @UseGuards(AuthGuard)
  async deleteDomain(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('orgId') orgId: string,
  ) {
    await requireAssessmentOrgManager(req.user.id, orgId);
    return this.service.deleteDomain(id, orgId);
  }

  // Skills
  @Get('skills')
  @UseGuards(AuthGuard)
  async listSkills(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('domainId') domainId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('grade') grade?: string,
    @Query('standard') standard?: string,
  ) {
    await requireAssessmentOrgManager(req.user.id, orgId);
    return this.service.listSkills(orgId, {
      domainId,
      subjectId,
      grade: grade ? Number(grade) : undefined,
      standard,
    });
  }

  @Get('skills/:id')
  @UseGuards(AuthGuard)
  async getSkill(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('orgId') orgId: string,
  ) {
    await requireAssessmentOrgManager(req.user.id, orgId);
    return this.service.getSkill(id, orgId);
  }

  @Post('skills')
  @UseGuards(AuthGuard)
  async createSkill(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      orgId: string;
      domainId: string;
      name: string;
      description?: string;
      standard?: string;
      difficultyBaseline?: number;
      estimatedTimeSeconds?: number;
    },
  ) {
    await requireAssessmentOrgManager(req.user.id, body.orgId);
    return this.service.createSkill(body.orgId, body);
  }

  @Put('skills/:id')
  @UseGuards(AuthGuard)
  async updateSkill(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body()
    body: {
      orgId: string;
      name?: string;
      description?: string;
      standard?: string;
      difficultyBaseline?: number;
      estimatedTimeSeconds?: number;
      orderPosition?: number;
      prerequisiteIds?: string[];
    },
  ) {
    await requireAssessmentOrgManager(req.user.id, body.orgId);
    return this.service.updateSkill(id, body.orgId, body);
  }

  @Delete('skills/:id')
  @UseGuards(AuthGuard)
  async deleteSkill(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('orgId') orgId: string,
  ) {
    await requireAssessmentOrgManager(req.user.id, orgId);
    return this.service.deleteSkill(id, orgId);
  }

  @Get('skills/:id/prerequisites')
  @UseGuards(AuthGuard)
  getPrerequisites(@Param('id') id: string) {
    return this.service.getPrerequisitesForSkill(id);
  }
}
