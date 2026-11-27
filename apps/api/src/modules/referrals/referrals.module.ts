import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
@Module({
  imports: [AuthModule],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
