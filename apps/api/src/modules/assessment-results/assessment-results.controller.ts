import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AssessmentResultsService } from './assessment-results.service';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';

@Controller('assessment-results')
export class AssessmentResultsController {
  constructor(private readonly service: AssessmentResultsService) {}

  @Get('session/:sessionId')
  getResult(@Param('sessionId') sessionId: string) {
    return this.service.getResult(sessionId);
  }

  @Get('session/:sessionId/reports/:type')
  getReport(
    @Param('sessionId') sessionId: string,
    @Param('type') type: 'parent' | 'tutor' | 'learning-plan',
  ) {
    return this.service.getReport(sessionId, type);
  }

  @Post('session/:sessionId/compute')
  computeResult(@Param('sessionId') sessionId: string) {
    return this.service.computeResult(sessionId);
  }

  @Put('session/:sessionId/grade/:itemId')
  @UseGuards(AuthGuard)
  gradeItem(
    @Param('sessionId') sessionId: string,
    @Param('itemId') itemId: string,
    @Body() body: { score: number },
  ) {
    return this.service.gradeItem(sessionId, itemId, body.score);
  }
}
