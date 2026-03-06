import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@iconicedu/api/prisma/prisma.module';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { UsersModule } from '@iconicedu/api/modules/users/users.module';
import { ChannelsModule } from '@iconicedu/api/modules/channels/channels.module';
import { ClassesModule } from '@iconicedu/api/modules/classes/classes.module';
import { RemindersModule } from '@iconicedu/api/modules/reminders/reminders.module';
import { AnalyticsModule } from '@iconicedu/api/analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AnalyticsModule,
    AuthModule,
    UsersModule,
    ChannelsModule,
    ClassesModule,
    RemindersModule,
  ],
})
export class AppModule {}
