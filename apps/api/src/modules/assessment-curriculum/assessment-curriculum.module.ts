import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { AssessmentCurriculumService } from './assessment-curriculum.service';
import { AssessmentCurriculumController } from './assessment-curriculum.controller';

@Module({
  imports: [AuthModule],
  providers: [AssessmentCurriculumService],
  controllers: [AssessmentCurriculumController],
  exports: [AssessmentCurriculumService],
})
export class AssessmentCurriculumModule {}
