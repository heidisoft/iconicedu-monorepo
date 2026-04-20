import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { ReactionsController } from '@iconicedu/api/modules/reactions/reactions.controller';
import { ReactionsService } from '@iconicedu/api/modules/reactions/reactions.service';

@Module({
  imports: [AuthModule],
  controllers: [ReactionsController],
  providers: [ReactionsService],
})
export class ReactionsModule {}
