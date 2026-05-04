import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '@iconicedu/api/prisma/prisma.module';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { UsersModule } from '@iconicedu/api/modules/users/users.module';
import { ChannelsModule } from '@iconicedu/api/modules/channels/channels.module';
import { ClassesModule } from '@iconicedu/api/modules/classes/classes.module';
import { MessagesModule } from '@iconicedu/api/modules/messages/messages.module';
import { RemindersModule } from '@iconicedu/api/modules/reminders/reminders.module';
import { AnalyticsModule } from '@iconicedu/api/analytics/analytics.module';
import { ActivityFeedModule } from '@iconicedu/api/modules/activity-feed/activity-feed.module';
import { ReactionsModule } from '@iconicedu/api/modules/reactions/reactions.module';
import { PushTokensModule } from '@iconicedu/api/modules/push-tokens/push-tokens.module';
import { ThreadsModule } from '@iconicedu/api/modules/threads/threads.module';
import { ProfilesModule } from '@iconicedu/api/modules/profiles/profiles.module';
import { AccountsModule } from '@iconicedu/api/modules/accounts/accounts.module';
import { NotificationPreferencesModule } from '@iconicedu/api/modules/notification-preferences/notification-preferences.module';
import { EventsModule } from '@iconicedu/api/modules/events/events.module';
import { PresenceModule } from '@iconicedu/api/modules/presence/presence.module';
import { SpacesModule } from '@iconicedu/api/modules/spaces/spaces.module';
import { SchedulesModule } from '@iconicedu/api/modules/schedules/schedules.module';
import { GlobalExceptionFilter } from '@iconicedu/api/observability/global-exception.filter';
import { RequestLoggingInterceptor } from '@iconicedu/api/observability/request-logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AnalyticsModule,
    AuthModule,
    UsersModule,
    ChannelsModule,
    ClassesModule,
    MessagesModule,
    ActivityFeedModule,
    RemindersModule,
    ReactionsModule,
    PushTokensModule,
    ThreadsModule,
    ProfilesModule,
    AccountsModule,
    NotificationPreferencesModule,
    EventsModule,
    PresenceModule,
    SpacesModule,
    SchedulesModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
})
export class AppModule {}
