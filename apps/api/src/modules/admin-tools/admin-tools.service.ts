import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AdminToolsDispatchRequest,
  AdminToolsDispatchResponse,
} from '@iconicedu/shared-types';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { EventPipelineService } from '@iconicedu/api/modules/events/event-pipeline.service';
import { RemindersService } from '@iconicedu/api/modules/reminders/reminders.service';

@Injectable()
export class AdminToolsService {
  constructor(
    private readonly events: EventPipelineService,
    private readonly reminders: RemindersService,
  ) {}

  async dispatch(
    token: string,
    input: AdminToolsDispatchRequest,
  ): Promise<AdminToolsDispatchResponse> {
    // Verify with Supabase; a decoded JWT alone is insufficient for privileged tools.
    const { data: auth, error: authError } =
      await createSupabaseSessionClient(token).auth.getUser(token);
    if (authError || !auth.user) throw new UnauthorizedException('Unauthorized');
    const supabase = createSupabaseServiceClient();
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('auth_user_id', auth.user.id)
      .eq('org_id', input.orgId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();
    if (accountError) throw new InternalServerErrorException(accountError.message);
    if (!account) throw new ForbiddenException('Forbidden');
    const adminRoles = ['owner', 'admin', 'staff'];
    const { data: role, error } = await supabase
      .from('user_roles')
      .select('role_key')
      .eq('org_id', input.orgId)
      .eq('account_id', account.id)
      .in('role_key', adminRoles)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<{ role_key: string }>();
    if (error) throw new InternalServerErrorException(error.message);
    if (!role) throw new ForbiddenException('Forbidden');

    const startedAt = Date.now();
    const options = {
      orgId: input.orgId,
      limit: input.limit,
      leaseSeconds: input.leaseSeconds,
      leaseOwner: input.leaseOwner ?? `admin-tools:${input.kind}`,
    };
    let result: Record<string, unknown>;
    switch (input.kind) {
      case 'events-dispatch':
        result = await this.events.dispatchDueJobs(options);
        break;
      case 'push-notifications-dispatch':
        result = await this.events.dispatchDueJobs({ ...options, pushOnly: true });
        break;
      case 'schedule-reconciliation-dispatch':
        result = await this.events.dispatchDueJobs({ ...options, reconcileOnly: true });
        break;
      case 'reminders-dispatch':
        result = await this.reminders.dispatchDueReminderJobs(options);
        break;
      case 'session-completions-dispatch':
        result = await this.reminders.dispatchDueCompletionCheckJobs(options);
        break;
      case 'reminder-jobs-reset':
        result = await this.reminders.resetAndReconcileOrgReminderJobs(input.orgId);
        break;
      case 'channel-read-state-repair': {
        const response = await supabase.rpc('recompute_all_channel_unread_for_org', {
          p_org_id: input.orgId,
        });
        if (response.error)
          throw new InternalServerErrorException(response.error.message);
        result = { repairedChannels: response.data ?? 0 };
        break;
      }
    }
    const hasFailures =
      Number(result.failed ?? 0) > 0 || Number(result.deadLettered ?? 0) > 0;
    return {
      success: !hasFailures,
      status: 200,
      ...(hasFailures
        ? { message: 'Run completed with job failures. See the results for details.' }
        : {}),
      data: {
        kind: input.kind,
        orgId: input.orgId,
        durationMs: Date.now() - startedAt,
        result,
      },
    };
  }
}
