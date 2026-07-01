import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { AssessmentDeliveriesService } from './assessment-deliveries.service';
import { AssessmentDeliveriesController } from './assessment-deliveries.controller';

@Module({
  imports: [AuthModule],
  providers: [AssessmentDeliveriesService],
  controllers: [AssessmentDeliveriesController],
  exports: [AssessmentDeliveriesService],
})
export class AssessmentDeliveriesModule {}
