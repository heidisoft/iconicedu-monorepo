import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { SchedulesController } from '@iconicedu/api/modules/schedules/schedules.controller';
import { SchedulesService } from '@iconicedu/api/modules/schedules/schedules.service';

@Module({
  imports: [AuthModule],
  controllers: [SchedulesController],
  providers: [SchedulesService],
})
export class SchedulesModule {}
