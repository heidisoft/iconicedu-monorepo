import { createHash, randomUUID } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type {
  AccountRow,
  FamilyLinkInviteRole,
  FamilyLinkInviteRow,
  FamilyLinkInviteVM,
  FamilyRelation,
} from '@iconicedu/shared-types';
import { getProfileByAccountId, upsertProfileForAccount } from '@iconicedu/web/lib/profile/queries/profiles.query';
import { pickRandomThemeKey } from '@iconicedu/web/lib/profile/constants/theme';
import {
  getAccountByEmail,
  insertInvitedAccount,
} from '@iconicedu/web/lib/accounts/queries/accounts.query';

export const FAMILY_INVITE_EXPIRATION_DAYS = 7;

type EnsureFamilyOptions = {
  supabase: SupabaseClient;
  guardianAccountId: string;
  orgId: string;
};

type CreateFamilyInviteOptions = EnsureFamilyOptions & {
  invitedRole: FamilyLinkInviteRole;
  invitedEmail: string;
  invitedPhoneE164?: string | null;
  createdByAccountId: string;
  expiresInDays?: number;
  maxUses?: number;
};

export const getFamilyInviteAdminClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    throw new Error('Missing Supabase service role configuration.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
};

const createFamilyInvitationHash = () => {
  const inviteCode = randomUUID();
  const inviteCodeHash = createHash('sha256').update(inviteCode).digest('hex');
  return inviteCodeHash;
};

type InvitedAccountKind = 'child' | 'guardian';

const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() ?? '';

async function ensureInvitedAccountForRole(options: {
  adminClient: SupabaseClient;
  orgId: string;
  invitedEmail: string;
  createdByAccountId: string;
  kind: InvitedAccountKind;
}): Promise<AccountRow> {
  const normalizedEmail = normalizeEmail(options.invitedEmail);
  if (!normalizedEmail) {
    throw new Error('Invited email is required.');
  }

  const { data: existingAccount, error: existingAccountError } = await getAccountByEmail(
    options.adminClient,
    options.orgId,
    normalizedEmail,
  );
  if (existingAccountError) {
    throw existingAccountError;
  }
  const displayName =
    options.kind === 'child' ? 'Invited child' : 'Invited guardian';
  const uiThemeKey = options.kind === 'guardian' ? pickRandomThemeKey() : 'teal';
  if (existingAccount) {
    await upsertProfileForAccount(options.adminClient, {
      orgId: options.orgId,
      accountId: existingAccount.id,
      kind: options.kind,
      displayName,
      avatarSource: 'seed',
      avatarUrl: null,
      avatarSeed: existingAccount.id,
      timezone: 'UTC',
      locale: 'en-US',
      status: 'invited',
      uiThemeKey,
    });
    return existingAccount;
  }

  const { data: insertedAccount, error: insertedError } = await insertInvitedAccount(
    options.adminClient,
    {
      orgId: options.orgId,
      email: normalizedEmail,
      createdBy: options.createdByAccountId,
    },
  );

  if (insertedError || !insertedAccount) {
    throw insertedError ?? new Error('Unable to create invited account.');
  }

  await upsertProfileForAccount(options.adminClient, {
    orgId: options.orgId,
    accountId: insertedAccount.id,
    kind: options.kind,
    displayName,
    avatarSource: 'seed',
    avatarUrl: null,
    avatarSeed: insertedAccount.id,
    timezone: 'UTC',
    locale: 'en-US',
    status: 'invited',
    uiThemeKey,
  });

  return insertedAccount;
}

export async function ensureFamilyForGuardian(options: EnsureFamilyOptions) {
  const { supabase, guardianAccountId, orgId } = options;

  const { data: existingLink } = await supabase
    .from('family_links')
    .select('family_id')
    .eq('guardian_account_id', guardianAccountId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle<{ family_id: string }>();

  if (existingLink?.family_id) {
    return existingLink.family_id;
  }

  const { data: existingFamily } = await supabase
    .from('families')
    .select('id')
    .eq('org_id', orgId)
    .eq('created_by', guardianAccountId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingFamily?.id) {
    return existingFamily.id;
  }

  const profileResponse = await getProfileByAccountId(supabase, guardianAccountId);
  const lastName = profileResponse.data?.last_name?.trim();
  const label = lastName ? `${lastName}'s Family` : 'Family';

  const { data: familyData, error } = await supabase
    .from('families')
    .insert({
      org_id: orgId,
      display_name: label,
      created_by: guardianAccountId,
    })
    .select('id')
    .single<{ id: string }>();

  if (error || !familyData) {
    throw error ?? new Error('Unable to create family record.');
  }

  return familyData.id;
}

export async function createFamilyInvite(options: CreateFamilyInviteOptions) {
  const normalizedEmail = normalizeEmail(options.invitedEmail);
  const invitedKind: InvitedAccountKind =
    options.invitedRole === 'child' ? 'child' : 'guardian';
  const adminClient = getFamilyInviteAdminClient();

  const invitedAccount = await ensureInvitedAccountForRole({
    adminClient,
    orgId: options.orgId,
    invitedEmail: normalizedEmail,
    createdByAccountId: options.createdByAccountId,
    kind: invitedKind,
  });

  const familyId = await ensureFamilyForGuardian({
    supabase: options.supabase,
    guardianAccountId: options.guardianAccountId,
    orgId: options.orgId,
  });

  if (!invitedAccount.auth_user_id) {
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      normalizedEmail,
    );

    if (inviteError) {
      throw inviteError;
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(
    expiresAt.getDate() + (options.expiresInDays ?? FAMILY_INVITE_EXPIRATION_DAYS),
  );

  const inviteCodeHash = createFamilyInvitationHash();

  const { data, error } = await options.supabase
    .from('family_link_invites')
    .insert({
      org_id: options.orgId,
      family_id: familyId,
      invited_role: options.invitedRole,
      invited_email: normalizedEmail,
      invited_phone_e164: options.invitedPhoneE164 ?? null,
      invite_code_hash: inviteCodeHash,
      created_by_account_id: options.createdByAccountId,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
      max_uses: options.maxUses ?? 1,
      uses: 0,
      created_by: options.createdByAccountId,
      updated_by: options.createdByAccountId,
    })
    .select('*')
    .single<FamilyLinkInviteRow>();

  if (error || !data) {
    throw error ?? new Error('Unable to record invite.');
  }

  return data;
}

export function mapFamilyLinkInviteRowToVM(row: FamilyLinkInviteRow): FamilyLinkInviteVM {
  return {
    id: row.id,
    orgId: row.org_id,
    familyId: row.family_id,
    invitedRole: row.invited_role,
    invitedEmail: row.invited_email ?? null,
    invitedPhoneE164: row.invited_phone_e164 ?? null,
    status: row.status,
    expiresAt: row.expires_at ?? null,
    acceptedByAccountId: row.accepted_by_account_id ?? null,
    acceptedAt: row.accepted_at ?? null,
    maxUses: row.max_uses,
    uses: row.uses,
    createdByAccountId: row.created_by_account_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function deleteFamilyInvite(options: {
  supabase: SupabaseClient;
  inviteId: string;
  guardianAccountId: string;
  orgId: string;
}) {
  const { data, error } = await options.supabase
    .from('family_link_invites')
    .delete()
    .eq('id', options.inviteId)
    .eq('org_id', options.orgId)
    .eq('created_by_account_id', options.guardianAccountId);

  if (error) {
    throw error;
  }

  return data;
}

export async function findFamilyInviteForAccount(options: {
  supabase: SupabaseClient;
  orgId: string;
  accountId: string;
  email?: string | null;
}) {
  const normalizedEmail = options.email?.trim().toLowerCase();
  let query = options.supabase
    .from('family_link_invites')
    .select('*')
    .eq('org_id', options.orgId)
    .is('deleted_at', null)
    .in('status', ['pending', 'accepted'])
    .limit(1);

  if (normalizedEmail) {
    query = query.or(
      `accepted_by_account_id.eq.${options.accountId},invited_email.eq.${normalizedEmail}`,
    );
  } else {
    query = query.eq('accepted_by_account_id', options.accountId);
  }

  const { data } = await query.maybeSingle<FamilyLinkInviteRow>();
  return data ?? null;
}

export type AcceptFamilyInviteOptions = {
  inviteId: string;
  account: AccountRow;
  relation?: FamilyRelation;
  permissionsScope?: string[] | null;
  adminClient?: SupabaseClient;
};

export async function acceptFamilyInvite(options: AcceptFamilyInviteOptions) {
  const adminClient = options.adminClient ?? getFamilyInviteAdminClient();

  const { data: inviteRow, error: inviteError } = await adminClient
    .from('family_link_invites')
    .select('*')
    .eq('id', options.inviteId)
    .eq('org_id', options.account.org_id)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle<FamilyLinkInviteRow>();

  if (inviteError) {
    throw inviteError;
  }

  if (!inviteRow) {
    throw new Error('Invite not found.');
  }

  const normalizedEmail = options.account.email?.trim().toLowerCase();
  const normalizedPhone = options.account.phone_e164?.trim();
  const inviteEmail = inviteRow.invited_email?.trim().toLowerCase() ?? null;
  const invitePhone = inviteRow.invited_phone_e164?.trim() ?? null;
  const emailMatch = normalizedEmail && inviteEmail && normalizedEmail === inviteEmail;
  const phoneMatch = normalizedPhone && invitePhone && normalizedPhone === invitePhone;

  if (!emailMatch && !phoneMatch) {
    throw new Error('This invite is not associated with your account.');
  }

  const now = new Date().toISOString();
  const { error: updateError } = await adminClient
    .from('family_link_invites')
    .update({
      status: 'accepted',
      accepted_by_account_id: options.account.id,
      accepted_at: now,
      updated_at: now,
      updated_by: options.account.id,
    })
    .eq('id', inviteRow.id)
    .eq('status', 'pending');

  if (updateError) {
    throw updateError;
  }

  if (inviteRow.invited_role === 'child') {
    const { error: linkError } = await adminClient
      .from('family_links')
      .upsert(
        {
          org_id: inviteRow.org_id,
          family_id: inviteRow.family_id,
          guardian_account_id: inviteRow.created_by_account_id,
          child_account_id: options.account.id,
          relation: options.relation ?? 'guardian',
          permissions_scope: options.permissionsScope ?? null,
          created_by: options.account.id,
          updated_by: options.account.id,
        },
        { onConflict: 'org_id,family_id,guardian_account_id,child_account_id' },
      );

    if (linkError) {
      throw linkError;
    }
  }

  const { data: refreshedInvite, error: refreshedError } = await adminClient
    .from('family_link_invites')
    .select('*')
    .eq('id', inviteRow.id)
    .maybeSingle<FamilyLinkInviteRow>();

  if (refreshedError || !refreshedInvite) {
    throw refreshedError ?? new Error('Unable to load invite after acceptance.');
  }

  return mapFamilyLinkInviteRowToVM(refreshedInvite);
}
