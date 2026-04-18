import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { ProfilesController } from '@iconicedu/api/modules/profiles/profiles.controller';
import { ProfilesService } from '@iconicedu/api/modules/profiles/profiles.service';

@Module({
  imports: [AuthModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}
