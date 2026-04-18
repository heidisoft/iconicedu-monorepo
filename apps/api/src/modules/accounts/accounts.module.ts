import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { AccountsController } from '@iconicedu/api/modules/accounts/accounts.controller';
import { AccountsService } from '@iconicedu/api/modules/accounts/accounts.service';

@Module({
  imports: [AuthModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
