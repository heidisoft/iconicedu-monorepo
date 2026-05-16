import { Module } from '@nestjs/common';

import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { RemindersController } from '@iconicedu/api/modules/reminders/reminders.controller';
import { ReminderReconcileService } from '@iconicedu/api/modules/reminders/reminder-reconcile.service';
import { RemindersService } from '@iconicedu/api/modules/reminders/reminders.service';
import { CompletionCheckDispatcherService } from '@iconicedu/api/modules/reminders/completion-check-dispatcher.service';

@Module({
  imports: [AuthModule],
  controllers: [RemindersController],
  providers: [
    RemindersService,
    ReminderReconcileService,
    CompletionCheckDispatcherService,
  ],
  exports: [RemindersService, ReminderReconcileService, CompletionCheckDispatcherService],
})
export class RemindersModule {}
