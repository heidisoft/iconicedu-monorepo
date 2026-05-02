import { Module } from '@nestjs/common';

import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { RemindersController } from '@iconicedu/api/modules/reminders/reminders.controller';
import { RemindersService } from '@iconicedu/api/modules/reminders/reminders.service';

@Module({
  imports: [AuthModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
