import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { PushTokensController } from '@iconicedu/api/modules/push-tokens/push-tokens.controller';
import { PushTokensService } from '@iconicedu/api/modules/push-tokens/push-tokens.service';

@Module({
  imports: [AuthModule],
  controllers: [PushTokensController],
  providers: [PushTokensService],
})
export class PushTokensModule {}
