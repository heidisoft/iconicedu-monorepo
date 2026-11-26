import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  CreateFamilyChildInviteInput,
  FamilyLinkInviteRow,
  FamilyLinkInviteVM,
} from '@iconicedu/shared-types';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { NotificationPreferencesService } from '@iconicedu/api/modules/notification-preferences/notification-preferences.service';

type PreparedInvite = {
  invite: FamilyLinkInviteRow;
  orgSlug: string;
  profileId: string;
  hasAuthAccount: boolean;
  profileCreated: boolean;
  seedDefaults?: boolean;
};
function toVM(row: FamilyLinkInviteRow): FamilyLinkInviteVM {
  return {
    id: row.id,
    orgId: row.org_id,
    familyId: row.family_id,
    invitedRole: row.invited_role,
    invitedEmail: row.invited_email,
    invitedPhoneE164: row.invited_phone_e164,
    status: row.status,
    expiresAt: row.expires_at,
    acceptedByAccountId: row.accepted_by_account_id,
    acceptedAt: row.accepted_at,
    maxUses: row.max_uses,
    uses: row.uses,
    createdByAccountId: row.created_by_account_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class FamilyChildInvitesService {
  constructor(private readonly notifications: NotificationPreferencesService) {}
  private check(error: { code?: string; message?: string } | null) {
    if (!error) return;
    if (error.code === '42501')
      throw new ForbiddenException('You do not have permission to invite this child.');
    if (error.code === '22023')
      throw new BadRequestException('Enter a valid child email different from your own.');
    if (error.code === '23505')
      throw new ConflictException(
        'An invitation is already pending, or this child already has sign-in details.',
      );
    if (error.code === 'P0429')
      throw new HttpException('Please wait before sending more invitations.', 429);
    throw new InternalServerErrorException(
      'Unable to manage this invitation. Please try again.',
    );
  }
  private async actor(token: string) {
    const session = createSupabaseSessionClient(token);
    const {
      data: { user },
      error,
    } = await session.auth.getUser();
    if (error || !user) throw new ForbiddenException();
    const { data: account, error: accountError } = await session
      .from('accounts')
      .select('id, org_id')
      .eq('auth_user_id', user.id)
      .is('deleted_at', null)
      .single();
    if (accountError || !account) throw new ForbiddenException();
    return { account: account as { id: string; org_id: string }, session };
  }
  async list(token: string) {
    const { account, session } = await this.actor(token);
    const { data, error } = await session
      .from('family_link_invites')
      .select('*')
      .eq('org_id', account.org_id)
      .eq('created_by_account_id', account.id)
      .eq('invited_role', 'child')
      .eq('status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    this.check(error);
    return ((data ?? []) as FamilyLinkInviteRow[]).map(toVM);
  }
  async send(
    token: string,
    input: CreateFamilyChildInviteInput,
  ): Promise<FamilyLinkInviteVM> {
    if (
      !input ||
      typeof input.invitedEmail !== 'string' ||
      input.invitedEmail.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.invitedEmail.trim())
    )
      throw new BadRequestException('Enter a valid email address.');
    if (
      input.targetProfileId !== undefined &&
      (typeof input.targetProfileId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          input.targetProfileId,
        ))
    )
      throw new BadRequestException('Invalid child profile.');
    let base: URL;
    try {
      base = new URL(process.env.WEB_URL?.trim() || 'http://localhost:3000');
      if (
        !['http:', 'https:'].includes(base.protocol) ||
        (process.env.NODE_ENV === 'production' &&
          (base.protocol !== 'https:' || base.hostname === 'localhost'))
      )
        throw new Error();
    } catch {
      throw new ServiceUnavailableException(
        'Invitation email is not configured. Contact support.',
      );
    }
    const { account } = await this.actor(token);
    const service = createSupabaseServiceClient();
    const { data, error } = await service.rpc('prepare_family_child_invite', {
      actor_id: account.id,
      invited_email_input: input.invitedEmail.trim().toLowerCase(),
      target_profile_id: input.targetProfileId ?? null,
    });
    this.check(error);
    const prepared = data as PreparedInvite;
    const redirect = new URL('/auth/callback', base);
    redirect.searchParams.set('org', prepared.orgSlug);
    redirect.searchParams.set('intent', 'get-started');
    const email = prepared.invite.invited_email!;
    try {
      if (prepared.profileCreated || prepared.seedDefaults)
        await this.notifications.seedDefaults(token, {
          orgId: account.org_id,
          profileId: prepared.profileId,
        });
      if (prepared.hasAuthAccount) {
        const response = await service.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false, emailRedirectTo: redirect.toString() },
        });
        if (response.error) throw response.error;
      } else {
        const response = await service.auth.admin.inviteUserByEmail(email, {
          redirectTo: redirect.toString(),
        });
        if (response.error) {
          if (
            response.error.code !== 'email_exists' &&
            response.error.code !== 'user_already_exists'
          )
            throw response.error;
          const retry = await service.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: false, emailRedirectTo: redirect.toString() },
          });
          if (retry.error) throw retry.error;
        }
      }
    } catch {
      const { error: revokeError } = await service.rpc('revoke_family_child_invite', {
        actor_id: account.id,
        invite_id: prepared.invite.id,
      });
      if (revokeError)
        throw new ServiceUnavailableException(
          'Email could not be confirmed. Check pending invitations or contact support before retrying.',
        );
      throw new ServiceUnavailableException(
        'Invitation email could not be sent. Please try again.',
      );
    }
    return toVM(prepared.invite);
  }
  async revoke(token: string, id: string) {
    const { account } = await this.actor(token);
    const { error } = await createSupabaseServiceClient().rpc(
      'revoke_family_child_invite',
      { actor_id: account.id, invite_id: id },
    );
    this.check(error);
    return { success: true };
  }
}
