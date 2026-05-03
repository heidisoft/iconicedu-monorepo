import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { RemindersModule } from '@iconicedu/api/modules/reminders/reminders.module';
import { SchedulesController } from '@iconicedu/api/modules/schedules/schedules.controller';
import { SchedulesService } from '@iconicedu/api/modules/schedules/schedules.service';

@Module({
  imports: [AuthModule, RemindersModule],
  controllers: [SchedulesController],
  providers: [SchedulesService],
})
export class SchedulesModule {}
