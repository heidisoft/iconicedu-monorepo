import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { SpacesController } from '@iconicedu/api/modules/spaces/spaces.controller';
import { SpacesService } from '@iconicedu/api/modules/spaces/spaces.service';

@Module({
  imports: [AuthModule],
  controllers: [SpacesController],
  providers: [SpacesService],
})
export class SpacesModule {}
