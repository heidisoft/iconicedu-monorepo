import { Module } from '@nestjs/common';

import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { RemindersController } from '@iconicedu/api/modules/reminders/reminders.controller';
import { ReminderReconcileService } from '@iconicedu/api/modules/reminders/reminder-reconcile.service';
import { ReminderReconcileWorkerService } from '@iconicedu/api/modules/reminders/reminder-reconcile-worker.service';
import { RemindersService } from '@iconicedu/api/modules/reminders/reminders.service';

@Module({
  imports: [AuthModule],
  controllers: [RemindersController],
  providers: [RemindersService, ReminderReconcileService, ReminderReconcileWorkerService],
  exports: [RemindersService, ReminderReconcileService],
})
export class RemindersModule {}
