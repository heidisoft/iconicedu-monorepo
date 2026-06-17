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

@Controller('assessment-curriculum')
export class AssessmentCurriculumController {
  constructor(private readonly service: AssessmentCurriculumService) {}

  // Subjects
  @Get('subjects')
  @UseGuards(AuthGuard)
  listSubjects(@Query('orgId') orgId: string) {
    return this.service.listSubjects(orgId);
  }

  @Post('subjects')
  @UseGuards(AuthGuard)
  createSubject(
    @Req() req: AuthenticatedRequest,
    @Body() body: { orgId: string; name: string; icon?: string; color?: string },
  ) {
    return this.service.createSubject(body.orgId, req.user.id, body);
  }

  @Put('subjects/:id')
  @UseGuards(AuthGuard)
  updateSubject(
    @Param('id') id: string,
    @Body() body: { orgId: string; name?: string; icon?: string; color?: string },
  ) {
    return this.service.updateSubject(id, body.orgId, body);
  }

  @Delete('subjects/:id')
  @UseGuards(AuthGuard)
  deleteSubject(@Param('id') id: string, @Query('orgId') orgId: string) {
    return this.service.deleteSubject(id, orgId);
  }

  @Get('subjects/:id/tree')
  @UseGuards(AuthGuard)
  getSubjectTree(@Param('id') id: string, @Query('orgId') orgId: string) {
    return this.service.getSubjectTree(id, orgId);
  }

  // Domains
  @Get('domains')
  @UseGuards(AuthGuard)
  listDomains(@Query('orgId') orgId: string, @Query('subjectId') subjectId?: string) {
    return this.service.listDomains(orgId, subjectId);
  }

  @Post('domains')
  @UseGuards(AuthGuard)
  createDomain(
    @Body()
    body: {
      orgId: string;
      subjectId: string;
      name: string;
      grade: number;
      description?: string;
    },
  ) {
    return this.service.createDomain(body.orgId, body);
  }

  @Put('domains/:id')
  @UseGuards(AuthGuard)
  updateDomain(
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
    return this.service.updateDomain(id, body.orgId, body);
  }

  @Delete('domains/:id')
  @UseGuards(AuthGuard)
  deleteDomain(@Param('id') id: string, @Query('orgId') orgId: string) {
    return this.service.deleteDomain(id, orgId);
  }

  // Skills
  @Get('skills')
  @UseGuards(AuthGuard)
  listSkills(
    @Query('orgId') orgId: string,
    @Query('domainId') domainId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('grade') grade?: string,
    @Query('standard') standard?: string,
  ) {
    return this.service.listSkills(orgId, {
      domainId,
      subjectId,
      grade: grade ? Number(grade) : undefined,
      standard,
    });
  }

  @Get('skills/:id')
  @UseGuards(AuthGuard)
  getSkill(@Param('id') id: string, @Query('orgId') orgId: string) {
    return this.service.getSkill(id, orgId);
  }

  @Post('skills')
  @UseGuards(AuthGuard)
  createSkill(
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
    return this.service.createSkill(body.orgId, body);
  }

  @Put('skills/:id')
  @UseGuards(AuthGuard)
  updateSkill(
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
    return this.service.updateSkill(id, body.orgId, body);
  }

  @Delete('skills/:id')
  @UseGuards(AuthGuard)
  deleteSkill(@Param('id') id: string, @Query('orgId') orgId: string) {
    return this.service.deleteSkill(id, orgId);
  }

  @Get('skills/:id/prerequisites')
  @UseGuards(AuthGuard)
  getPrerequisites(@Param('id') id: string) {
    return this.service.getPrerequisitesForSkill(id);
  }
}
