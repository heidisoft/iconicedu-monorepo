import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { AssessmentItemsService } from './assessment-items.service';
import { AssessmentItemsController } from './assessment-items.controller';

@Module({
  imports: [AuthModule],
  providers: [AssessmentItemsService],
  controllers: [AssessmentItemsController],
  exports: [AssessmentItemsService],
})
export class AssessmentItemsModule {}
