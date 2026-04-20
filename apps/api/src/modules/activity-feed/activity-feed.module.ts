import { Module } from '@nestjs/common';
import { AuthModule } from '@iconicedu/api/modules/auth/auth.module';
import { ActivityFeedController } from '@iconicedu/api/modules/activity-feed/activity-feed.controller';
import { ActivityFeedService } from '@iconicedu/api/modules/activity-feed/activity-feed.service';
import { ActivityFeedQueryService } from '@iconicedu/api/modules/activity-feed/activity-feed-query.service';

@Module({
  imports: [AuthModule],
  controllers: [ActivityFeedController],
  providers: [ActivityFeedService, ActivityFeedQueryService],
})
export class ActivityFeedModule {}
