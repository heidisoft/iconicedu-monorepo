import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type {
  LearningSpaceLifecycleAction,
  LearningSpaceLifecycleResult,
} from '@iconicedu/shared-types';
import { requireAdminAccount } from '@iconicedu/api/lib/auth/require-admin-account';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { ReminderReconcileService } from '@iconicedu/api/modules/reminders/reminder-reconcile.service';

const RPC_BY_ACTION: Record<LearningSpaceLifecycleAction, string> = {
  archive: 'archive_learning_space',
  restore: 'restore_learning_space',
  delete: 'delete_learning_space',
};

/** Keys the RPCs return when the call found the class already in the target state. */
const NO_OP_KEYS = ['already_archived', 'already_active', 'already_deleted'];

type PostgrestErrorLike = { code?: string; message: string };

export function parseLearningSpaceLifecycleInput(
  learningSpaceId: unknown,
  body: unknown,
): { orgId: string; learningSpaceId: string } {
  if (typeof learningSpaceId !== 'string' || !isUUID(learningSpaceId)) {
    throw new BadRequestException('A valid class id is required');
  }
  const orgId =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as { orgId?: unknown }).orgId
      : undefined;
  if (typeof orgId !== 'string' || !isUUID(orgId)) {
    throw new BadRequestException('A valid orgId is required');
  }
  return { orgId, learningSpaceId };
}

/**
 * Admin archive / restore / delete of a class. The cascade (class channels,
 * memberships, tutor DMs, pending reminders) and report protection live in the
 * database; see supabase/migrations/20261113000000_learning_space_archive_cascade.sql
 * and docs/operations/class-archive-lifecycle.md.
 */
@Injectable()
export class LearningSpaceLifecycleService {
  private readonly logger = new Logger(LearningSpaceLifecycleService.name);

  constructor(private readonly reminderReconcile: ReminderReconcileService) {}

  async run(
    action: LearningSpaceLifecycleAction,
    authUserId: string,
    input: { orgId: string; learningSpaceId: string },
  ): Promise<LearningSpaceLifecycleResult> {
    const { accountId } = await requireAdminAccount(authUserId, input.orgId);
    const supabase = createSupabaseServiceClient();
    const actorProfileId = await this.resolveActorProfileId(
      supabase,
      input.orgId,
      accountId,
    );

    const { data, error } = await supabase.rpc(RPC_BY_ACTION[action], {
      p_org_id: input.orgId,
      p_learning_space_id: input.learningSpaceId,
      p_actor_profile_id: actorProfileId,
    });
    if (error) throw mapLifecycleError(error);

    const effects = (data ?? {}) as Record<string, number | boolean | string>;
    const changed = !NO_OP_KEYS.some((key) => effects[key] === true);

    if (action === 'restore' && changed) {
      // Archive canceled the class's pending reminders; regenerate them. A
      // failure here must not undo the restore: the stale-schedule
      // reconciliation job picks the class up later.
      try {
        await this.reminderReconcile.reconcileAllSchedulesForLearningSpace(
          input.orgId,
          input.learningSpaceId,
        );
      } catch (reconcileError) {
        this.logger.warn(
          `Reminder reconcile after class restore failed for ${input.learningSpaceId}: ${
            reconcileError instanceof Error
              ? reconcileError.message
              : String(reconcileError)
          }`,
        );
      }
    }

    return {
      learningSpaceId: input.learningSpaceId,
      action,
      changed,
      restorableUntil:
        typeof effects.restorable_until === 'string' ? effects.restorable_until : null,
      effects,
    };
  }

  private async resolveActorProfileId(
    supabase: ReturnType<typeof createSupabaseServiceClient>,
    orgId: string,
    accountId: string,
  ): Promise<string | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, kind')
      .eq('org_id', orgId)
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .returns<Array<{ id: string; kind: string | null }>>();
    if (error) throw new InternalServerErrorException(error.message);
    const profiles = data ?? [];
    return (
      (profiles.find((profile) => profile.kind === 'staff') ?? profiles[0])?.id ?? null
    );
  }
}

export function mapLifecycleError(error: PostgrestErrorLike): Error {
  switch (error.code) {
    case 'P0002':
      return new NotFoundException('Class not found');
    case '55000':
    case '55006':
      return new ConflictException(error.message);
    case '42501':
      return new ForbiddenException(error.message);
    case '55P03':
      return new ConflictException('The class is busy. Try again in a moment.');
    default:
      return new InternalServerErrorException(error.message);
  }
}
