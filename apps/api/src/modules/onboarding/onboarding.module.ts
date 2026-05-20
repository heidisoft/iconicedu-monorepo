import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { NotificationPreferencesModule } from '@iconicedu/api/modules/notification-preferences/notification-preferences.module';
import { OnboardingController } from '@iconicedu/api/modules/onboarding/onboarding.controller';
import { OnboardingService } from '@iconicedu/api/modules/onboarding/onboarding.service';

@Module({
  imports: [AuthModule, NotificationPreferencesModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
