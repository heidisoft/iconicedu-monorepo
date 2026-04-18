import { Injectable } from '@nestjs/common';

import { projectActivityEvents } from '@iconicedu/api/lib/activity-feed/projector/project-activity-events';
import { dispatchDueNotificationJobs } from '@iconicedu/api/lib/notifications/dispatch-jobs';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';

@Injectable()
export class NotificationEngineService {
  async projectActivityEvents(input: { eventIds?: string[]; limit?: number }) {
    const supabase = createSupabaseServiceClient();
    return projectActivityEvents(supabase, input);
  }

  async dispatchDueNotificationJobs(input: {
    leaseOwner: string;
    limit?: number;
    leaseSeconds?: number;
  }) {
    const supabase = createSupabaseServiceClient();
    return dispatchDueNotificationJobs({
      supabase,
      leaseOwner: input.leaseOwner,
      limit: input.limit,
      leaseSeconds: input.leaseSeconds,
    });
  }
}
