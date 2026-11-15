import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { RemindersModule } from '@iconicedu/api/modules/reminders/reminders.module';
import { AdminLearningSpacesController } from '@iconicedu/api/modules/spaces/admin-learning-spaces.controller';
import { LearningSpaceLifecycleService } from '@iconicedu/api/modules/spaces/learning-space-lifecycle.service';
import { SpacesController } from '@iconicedu/api/modules/spaces/spaces.controller';
import { SpacesService } from '@iconicedu/api/modules/spaces/spaces.service';

@Module({
  imports: [AuthModule, RemindersModule],
  controllers: [SpacesController, AdminLearningSpacesController],
  providers: [SpacesService, LearningSpaceLifecycleService],
})
export class SpacesModule {}
