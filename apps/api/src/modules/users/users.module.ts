import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { UsersService } from '@iconicedu/api/modules/users/users.service';
import { UsersController } from '@iconicedu/api/modules/users/users.controller';

@Module({
  imports: [AuthModule],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
