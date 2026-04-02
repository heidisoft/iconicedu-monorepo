import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AccountRow,
  ProfileRow,
  SidebarLeftDataVM,
  SidebarOrganizationSwitchItemVM,
  UserAccountVM,
  UserOnboardingStatusVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import type { FamilyLinkInviteRow } from '@iconicedu/shared-types';

import { acceptFamilyInvite } from '@iconicedu/web/lib/family/queries/invite.query';
import { buildSidebarUser } from '@iconicedu/web/lib/sidebar/user/buildSidebarUser';
import {
  getAccountById,
  getAccountsByAuthUserId,
} from '@iconicedu/web/lib/accounts/queries/accounts.query';
import { determineOnboardingStep } from '@iconicedu/web/lib/onboarding/determineOnboardingStep';
import {
  getUserOnboardingStatusByProfileId,
  upsertUserOnboardingStatus,
} from '@iconicedu/web/lib/onboarding/queries/status.query';
import { mapUserOnboardingStatusRowToVM } from '@iconicedu/web/lib/onboarding/mappers';
import { buildDirectMessageChannelsWithMessages } from '@iconicedu/web/lib/channels/builders/channel.builder';
import { getOrgsByIds } from '@iconicedu/web/lib/org/queries/org.query';
import { reportWebObservedError } from '@iconicedu/web/lib/analytics/report-error';

export async function loadSidebarContext(
  supabase: SupabaseClient,
  input: {
    authUser: {
      id: string;
      email?: string | null;
      user_metadata?: Record<string, unknown>;
      app_metadata?: Record<string, unknown>;
    };
    account: { id: string; org_id: string };
    baseSidebarData: Omit<SidebarLeftDataVM, 'user'>;
    familyInvite?: FamilyLinkInviteRow | null;
    profileKindOverride?: UserProfileVM['kind'];
    effectiveProfileRow?: ProfileRow | null;
    familySwitchOptions?: SidebarLeftDataVM['user']['familySwitchOptions'];
    isViewingAsChild?: boolean;
    viewingAsProfileId?: string | null;
  },
): Promise<{
  sidebarData: SidebarLeftDataVM;
  accountVM: UserAccountVM;
  profileVM: UserProfileVM;
  onboardingStatus: UserOnboardingStatusVM | null;
}> {
  await autoAcceptPendingInvites(supabase, input.account.id);

  const { accountVM, profileVM, availablePersonas, addablePersonas } =
    await buildSidebarUser(
      supabase,
      input.authUser,
      input.account,
      input.familyInvite ?? null,
      input.profileKindOverride,
      input.effectiveProfileRow ?? null,
    );

  const directMessages =
    profileVM.kind === 'guardian'
      ? await resolveGuardianDirectMessages(supabase, input, profileVM)
      : input.baseSidebarData.collections.directMessages.filter((channel) =>
          channel.collections.participants.some(
            (participant) => participant.ids.id === profileVM.ids.id,
          ),
        );
  const baseAlertChannels = input.baseSidebarData.collections.alertChannels ?? [];
  const nonDmAlertChannels = baseAlertChannels.filter(
    (channel) => channel.basics.kind !== 'dm' && channel.basics.kind !== 'group_dm',
  );
  const alertChannels = Array.from(
    new Map(
      [...nonDmAlertChannels, ...directMessages].map((channel) => [
        channel.ids.id,
        channel,
      ]),
    ).values(),
  );
  const organizations = await resolveSidebarOrganizations(
    supabase,
    input.authUser.id,
    input.account.org_id,
  );

  const computedStep = determineOnboardingStep(profileVM, accountVM);
  const statusResponse = await getUserOnboardingStatusByProfileId(
    supabase,
    profileVM.ids.id,
  );

  let onboardingStatus: UserOnboardingStatusVM | null = null;
  if (statusResponse.data) {
    onboardingStatus = mapUserOnboardingStatusRowToVM(statusResponse.data);
  }

  const shouldSyncOnboardingStatus =
    (computedStep &&
      (!onboardingStatus ||
        onboardingStatus.currentStep !== computedStep ||
        onboardingStatus.completed)) ||
    (!computedStep && onboardingStatus && !onboardingStatus.completed);

  if (shouldSyncOnboardingStatus) {
    const { data } = await upsertUserOnboardingStatus(supabase, {
      profileId: profileVM.ids.id,
      orgId: profileVM.ids.orgId,
      currentStep: computedStep,
      lastCompletedStep: onboardingStatus?.currentStep ?? null,
      completed: !computedStep,
    });

    if (data) {
      onboardingStatus = mapUserOnboardingStatusRowToVM(data);
    }
  }

  return {
    sidebarData: {
      ...input.baseSidebarData,
      user: {
        profile: profileVM,
        account: accountVM,
        availablePersonas,
        familySwitchOptions: input.familySwitchOptions ?? null,
        isViewingAsChild: Boolean(input.isViewingAsChild),
        viewingAsProfileId: input.viewingAsProfileId ?? null,
        addablePersonas,
      },
      collections: {
        ...input.baseSidebarData.collections,
        directMessages,
        alertChannels,
      },
      organizations,
    },
    accountVM,
    profileVM,
    onboardingStatus,
  };
}

async function resolveSidebarOrganizations(
  supabase: SupabaseClient,
  authUserId: string,
  currentOrgId: string,
): Promise<SidebarOrganizationSwitchItemVM[]> {
  const accountsResponse = await getAccountsByAuthUserId(supabase, authUserId);
  if (!accountsResponse.data?.length) {
    return [];
  }

  const uniqueOrgIds = Array.from(
    new Set(accountsResponse.data.map((account) => account.org_id).filter(Boolean)),
  );
  if (!uniqueOrgIds.length) {
    return [];
  }

  const orgsResponse = await getOrgsByIds(supabase, uniqueOrgIds);
  const orgById = new Map((orgsResponse.data ?? []).map((org) => [org.id, org]));

  const dedupedByOrg = new Map<string, SidebarOrganizationSwitchItemVM>();
  for (const account of accountsResponse.data) {
    const org = orgById.get(account.org_id);
    if (!org || dedupedByOrg.has(org.id)) {
      continue;
    }
    dedupedByOrg.set(org.id, {
      id: org.id,
      name: org.name,
      slug: org.slug,
      url: `/${org.slug}`,
      isCurrent: org.id === currentOrgId,
    });
  }

  return Array.from(dedupedByOrg.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

async function resolveGuardianDirectMessages(
  supabase: SupabaseClient,
  input: {
    account: { id: string; org_id: string };
    baseSidebarData: Omit<SidebarLeftDataVM, 'user'>;
  },
  profileVM: Extract<UserProfileVM, { kind: 'guardian' }>,
) {
  const guardianChannels = input.baseSidebarData.collections.directMessages.filter(
    (channel) =>
      channel.collections.participants.some(
        (participant) => participant.ids.id === profileVM.ids.id,
      ),
  );

  const childAccountIds = (profileVM.children?.items ?? [])
    .map((child) => child.ids.accountId)
    .filter(Boolean);

  if (!childAccountIds.length) {
    return guardianChannels;
  }

  const childChannelLists = await Promise.all(
    childAccountIds.map((accountId) =>
      buildDirectMessageChannelsWithMessages(supabase, input.account.org_id, {
        accountId,
      }),
    ),
  );

  const merged = new Map<string, (typeof guardianChannels)[number]>();
  [...guardianChannels, ...childChannelLists.flat()].forEach((channel) => {
    const existing = merged.get(channel.ids.id);
    if (!existing) {
      merged.set(channel.ids.id, channel);
      return;
    }
    const existingUnread = Math.max(0, existing.collections.readState?.unreadCount ?? 0);
    const nextUnread = Math.max(0, channel.collections.readState?.unreadCount ?? 0);
    if (nextUnread > existingUnread) {
      merged.set(channel.ids.id, channel);
    }
  });

  return Array.from(merged.values());
}

async function autoAcceptPendingInvites(supabase: SupabaseClient, accountId: string) {
  const accountResponse = await getAccountById(supabase, accountId);
  const account = accountResponse.data as AccountRow | null;
  if (!account) {
    return;
  }

  const { data: pendingInvitesResponse, error } = await supabase
    .from('family_link_invites')
    .select('id, invited_email, invited_phone_e164')
    .eq('org_id', account.org_id)
    .eq('status', 'pending')
    .is('deleted_at', null);

  if (error || !pendingInvitesResponse) {
    return;
  }

  const normalizedEmail = account.email?.trim().toLowerCase();
  const normalizedPhone = account.phone_e164?.trim();

  const matches = pendingInvitesResponse.filter((invite) => {
    const inviteEmail = invite.invited_email?.trim().toLowerCase() ?? null;
    const invitePhone = invite.invited_phone_e164?.trim() ?? null;
    return (
      (normalizedEmail && inviteEmail && inviteEmail === normalizedEmail) ||
      (normalizedPhone && invitePhone && invitePhone === normalizedPhone)
    );
  });

  for (const invite of matches) {
    try {
      await acceptFamilyInvite({
        inviteId: invite.id,
        account,
        relation: 'guardian',
      });
    } catch (error) {
      reportWebObservedError({
        error,
        source: 'web.sidebar.auto_accept_family_invite',
        message: 'Failed to auto-accept family invite during sidebar load',
        context: {
          inviteId: invite.id,
          accountId,
          orgId: account.org_id,
        },
      });
    }
  }
}
