import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { ThreadsController } from '@iconicedu/api/modules/threads/threads.controller';
import { ThreadsService } from '@iconicedu/api/modules/threads/threads.service';

@Module({
  imports: [AuthModule],
  controllers: [ThreadsController],
  providers: [ThreadsService],
  exports: [ThreadsService],
})
export class ThreadsModule {}
