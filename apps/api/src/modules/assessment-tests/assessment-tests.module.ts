import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { AssessmentTestsService } from './assessment-tests.service';
import { AssessmentTestsController } from './assessment-tests.controller';

@Module({
  imports: [AuthModule],
  providers: [AssessmentTestsService],
  controllers: [AssessmentTestsController],
  exports: [AssessmentTestsService],
})
export class AssessmentTestsModule {}
