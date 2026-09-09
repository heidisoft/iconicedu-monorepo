import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { EventsModule } from '@iconicedu/api/modules/events/events.module';
import { RemindersModule } from '@iconicedu/api/modules/reminders/reminders.module';
import { AdminToolsController } from './admin-tools.controller';
import { AdminToolsService } from './admin-tools.service';

@Module({
  imports: [AuthModule, EventsModule, RemindersModule],
  controllers: [AdminToolsController],
  providers: [AdminToolsService],
})
export class AdminToolsModule {}
