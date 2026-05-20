import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AccountRow,
  AvatarSource,
  ChildProfileGradeLevelRow,
  ChildProfileRow,
  ChildProfileVM,
  GradeLevel,
  ProfileRow,
  ThemeKey,
  UserProfileVM,
} from '@iconicedu/shared-types';
import { parseGradeLevel } from '@iconicedu/shared-types';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { NotificationPreferencesService } from '@iconicedu/api/modules/notification-preferences/notification-preferences.service';

type SupabaseClientLike = ReturnType<typeof createSupabaseServiceClient>;

type CreateChildProfileInput = {
  orgId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  birthYear: number;
  email?: string | null;
  timezone?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  postalCode?: string | null;
  themeKey?: string | null;
};

type CreationCleanupContext = {
  serviceClient: SupabaseClientLike;
  orgId: string;
  guardianAccountId: string;
  childAccountId: string;
  accountCreated: boolean;
  profileCreated: boolean;
  profileId: string | null;
  childProfileCreated: boolean;
  childGradeCreated: boolean;
  familyLinkCreated: boolean;
  familyId: string | null;
};

const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() ?? null;

function buildChildDisplayName(firstName: string, lastName: string) {
  const first = firstName.trim();
  const last = lastName.trim();
  if (first && last) return `${first} ${last.charAt(0).toUpperCase()}.`;
  return first || last;
}

function resolveAvatarSource(value?: string | null): AvatarSource {
  return value === 'upload' || value === 'external' ? value : 'seed';
}

function resolveThemeKey(value?: string | null): ThemeKey | null {
  const allowed = new Set<ThemeKey>([
    'slate',
    'gray',
    'zinc',
    'neutral',
    'stone',
    'amber',
    'blue',
    'cyan',
    'emerald',
    'fuchsia',
    'green',
    'indigo',
    'lime',
    'orange',
    'pink',
    'purple',
    'red',
    'rose',
    'sky',
    'teal',
    'violet',
    'yellow',
  ]);
  return allowed.has(value as ThemeKey) ? (value as ThemeKey) : null;
}

function formatDisplayName(profileRow: ProfileRow): string {
  const display = profileRow.display_name?.trim() ?? '';
  if (display) return display;
  return buildChildDisplayName(profileRow.first_name ?? '', profileRow.last_name ?? '');
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  async me(accessToken: string) {
    const supabase = createSupabaseSessionClient(accessToken);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw new InternalServerErrorException(userError.message);
    if (!user) return null;

    const { data: account, error } = await supabase
      .from('accounts')
      .select(
        '*, profile:profiles!account_id(id, display_name, first_name, last_name, avatar_seed)',
      )
      .eq('auth_user_id', user.id)
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return account;
  }

  async get(accessToken: string, profileId: string) {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async list(accessToken: string, ids: string[]) {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase.from('profiles').select('*').in('id', ids);
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async byAccount(accessToken: string, accountId: string) {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, org_id, account_id, kind, status, display_name, first_name, last_name, avatar_url, avatar_seed, ui_theme_key, deleted_at',
      )
      .eq('account_id', accountId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async update(
    accessToken: string,
    profileId: string,
    body: {
      displayName?: string;
      timezone?: string;
      location?: string;
      avatarUrl?: string;
    },
  ) {
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('profiles')
      .update({
        display_name: body.displayName,
        timezone: body.timezone,
        location_label: body.location,
        avatar_url: body.avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)
      .select('*')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async activeForAccount(accessToken: string, accountId: string) {
    const supabase = createSupabaseSessionClient(accessToken);
    const serviceSupabase = createSupabaseServiceClient();

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, org_id, active_profile_id')
      .eq('id', accountId)
      .is('deleted_at', null)
      .maybeSingle();
    if (accountError) throw new InternalServerErrorException(accountError.message);
    if (!account) return null;

    if (account.active_profile_id) {
      const { data: activeProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', account.active_profile_id)
        .eq('account_id', accountId)
        .eq('org_id', account.org_id)
        .is('deleted_at', null)
        .maybeSingle();
      if (activeProfile) return activeProfile;
    }

    let fallbackQuery = supabase
      .from('profiles')
      .select('*')
      .eq('account_id', accountId)
      .is('deleted_at', null);
    if (account.org_id) {
      fallbackQuery = fallbackQuery.eq('org_id', account.org_id);
    }
    const { data: fallback, error: fallbackError } = await fallbackQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fallbackError) throw new InternalServerErrorException(fallbackError.message);

    if (fallback && account.id && account.active_profile_id !== fallback.id) {
      await serviceSupabase
        .from('accounts')
        .update({ active_profile_id: fallback.id })
        .eq('id', account.id)
        .is('deleted_at', null);
    }

    return fallback ?? null;
  }

  async byAccountIds(accessToken: string, orgId: string, accountIds: string[]) {
    if (!accountIds.length) return [];
    const supabase = createSupabaseSessionClient(accessToken);
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, org_id, account_id, display_name, first_name, last_name, avatar_url, avatar_seed, kind, status, ui_theme_key',
      )
      .eq('org_id', orgId)
      .in('account_id', accountIds)
      .is('deleted_at', null);
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async createChildProfile(
    accessToken: string,
    input: CreateChildProfileInput,
  ): Promise<ChildProfileVM> {
    const { user, serviceClient } = await this.requireUser(accessToken);
    const guardianAccount = await this.requireGuardianAccount(
      serviceClient,
      user.id,
      input.orgId,
    );
    const cleanupContext: CreationCleanupContext = {
      serviceClient,
      orgId: guardianAccount.org_id,
      guardianAccountId: guardianAccount.id,
      childAccountId: '',
      accountCreated: false,
      profileCreated: false,
      profileId: null,
      childProfileCreated: false,
      childGradeCreated: false,
      familyLinkCreated: false,
      familyId: null,
    };

    try {
      const { account: childAccount, created: accountCreated } =
        await this.createOrLoadChildAccount({
          serviceClient,
          orgId: guardianAccount.org_id,
          email: input.email,
          createdByAccountId: guardianAccount.id,
        });
      cleanupContext.childAccountId = childAccount.id;
      cleanupContext.accountCreated = accountCreated;

      const profileRow = await this.upsertChildBaseProfile(serviceClient, {
        guardianAccount,
        childAccount,
        input,
      });
      cleanupContext.profileId = profileRow.id;
      cleanupContext.profileCreated = Boolean(
        (profileRow as { wasCreated?: boolean }).wasCreated,
      );

      await this.notificationPreferencesService.seedDefaults(accessToken, {
        orgId: guardianAccount.org_id,
        profileId: profileRow.id,
      });

      const familyId = await this.ensureFamilyForGuardian({
        supabase: serviceClient,
        guardianAccountId: guardianAccount.id,
        orgId: guardianAccount.org_id,
      });
      cleanupContext.familyId = familyId;

      const { data: existingFamilyLink, error: existingFamilyLinkError } =
        await serviceClient
          .from('family_links')
          .select('id')
          .eq('org_id', guardianAccount.org_id)
          .eq('family_id', familyId)
          .eq('guardian_account_id', guardianAccount.id)
          .eq('child_account_id', childAccount.id)
          .maybeSingle<{ id: string }>();

      if (existingFamilyLinkError) throw existingFamilyLinkError;

      cleanupContext.familyLinkCreated = !existingFamilyLink;
      const { error: linkError } = await serviceClient.from('family_links').upsert(
        {
          org_id: guardianAccount.org_id,
          family_id: familyId,
          guardian_account_id: guardianAccount.id,
          child_account_id: childAccount.id,
          relation: 'guardian',
          created_by: guardianAccount.id,
          updated_by: guardianAccount.id,
        },
        { onConflict: 'org_id,family_id,guardian_account_id,child_account_id' },
      );
      if (linkError) throw linkError;

      await this.upsertChildProfileDetails(serviceClient, {
        cleanupContext,
        guardianAccount,
        profileRow,
        input,
      });

      const children = await this.loadChildProfiles(
        serviceClient,
        guardianAccount.org_id,
        [childAccount.id],
      );
      if (!children.length) {
        throw new Error('Unable to load child profile');
      }

      return children[0];
    } catch (error) {
      await this.cleanupCreatedRecords(cleanupContext);
      throw error;
    }
  }

  private async requireUser(accessToken: string) {
    const supabase = createSupabaseSessionClient(accessToken);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw new UnauthorizedException(error.message);
    if (!user) throw new UnauthorizedException('Unauthorized');
    return { user, serviceClient: createSupabaseServiceClient() };
  }

  private async requireGuardianAccount(
    serviceClient: SupabaseClientLike,
    authUserId: string,
    orgId: string,
  ) {
    const { data: account, error } = await serviceClient
      .from('accounts')
      .select('*')
      .eq('auth_user_id', authUserId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<AccountRow>();
    if (error) throw new InternalServerErrorException(error.message);
    if (!account) throw new ForbiddenException('Account not found');

    const { data: guardianProfile, error: profileError } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('org_id', orgId)
      .eq('account_id', account.id)
      .eq('kind', 'guardian')
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();
    if (profileError) throw new InternalServerErrorException(profileError.message);
    if (!guardianProfile && account.primary_role !== 'guardian') {
      throw new ForbiddenException('Switch back to Parent to perform this action.');
    }

    return account;
  }

  private async createOrLoadChildAccount(options: {
    serviceClient: SupabaseClientLike;
    orgId: string;
    email?: string | null;
    createdByAccountId: string;
  }): Promise<{ account: AccountRow; created: boolean }> {
    const normalizedEmail = normalizeEmail(options.email);

    if (normalizedEmail) {
      const { data: existingAccount, error } = await options.serviceClient
        .from('accounts')
        .select('*')
        .eq('org_id', options.orgId)
        .ilike('email', normalizedEmail)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle<AccountRow>();
      if (error) throw new InternalServerErrorException(error.message);
      if (existingAccount) return { account: existingAccount, created: false };
    }

    const { data: childAccount, error: accountError } = await options.serviceClient
      .from('accounts')
      .insert({
        org_id: options.orgId,
        email: normalizedEmail,
        preferred_contact_channels: ['email'],
        status: 'active',
        created_by: options.createdByAccountId,
        updated_by: options.createdByAccountId,
      })
      .select('*')
      .single<AccountRow>();

    if (accountError || !childAccount) {
      throw new InternalServerErrorException(
        accountError?.message ?? 'Unable to create child account',
      );
    }

    return { account: childAccount, created: true };
  }

  private async upsertChildBaseProfile(
    serviceClient: SupabaseClientLike,
    input: {
      guardianAccount: AccountRow;
      childAccount: AccountRow;
      input: CreateChildProfileInput;
    },
  ): Promise<ProfileRow & { wasCreated?: boolean }> {
    const displayNameValue = buildChildDisplayName(
      input.input.firstName,
      input.input.lastName,
    );
    const profilePayload = {
      org_id: input.guardianAccount.org_id,
      account_id: input.childAccount.id,
      kind: 'child',
      display_name: displayNameValue,
      first_name: input.input.firstName.trim(),
      last_name: input.input.lastName.trim(),
      avatar_source: 'seed',
      avatar_url: null,
      avatar_seed: input.childAccount.id,
      timezone: input.input.timezone ?? 'UTC',
      locale: 'en-US',
      status: 'active',
      country_code: input.input.countryCode ?? null,
      country_name: input.input.countryName ?? null,
      region: input.input.region ?? null,
      city: input.input.city ?? null,
      postal_code: input.input.postalCode ?? null,
      ui_theme_key: input.input.themeKey ?? null,
      created_by: input.guardianAccount.id,
      updated_by: input.guardianAccount.id,
    };

    const { data: existingProfile, error: existingProfileError } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('org_id', input.guardianAccount.org_id)
      .eq('account_id', input.childAccount.id)
      .maybeSingle<{ id: string }>();
    if (existingProfileError)
      throw new InternalServerErrorException(existingProfileError.message);

    if (existingProfile) {
      const { data, error } = await serviceClient
        .from('profiles')
        .update(profilePayload)
        .eq('id', existingProfile.id)
        .select('*')
        .single<ProfileRow>();
      if (error || !data) {
        throw new InternalServerErrorException(
          error?.message ?? 'Unable to update existing child profile',
        );
      }
      return data;
    }

    const { data, error } = await serviceClient
      .from('profiles')
      .insert(profilePayload)
      .select('*')
      .single<ProfileRow>();
    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message ?? 'Unable to create child profile',
      );
    }
    return { ...data, wasCreated: true };
  }

  private async upsertChildProfileDetails(
    serviceClient: SupabaseClientLike,
    input: {
      cleanupContext: CreationCleanupContext;
      guardianAccount: AccountRow;
      profileRow: ProfileRow;
      input: CreateChildProfileInput;
    },
  ) {
    const childProfilePayload = {
      profile_id: input.profileRow.id,
      org_id: input.guardianAccount.org_id,
      birth_year: input.input.birthYear,
      created_by: input.guardianAccount.id,
      updated_by: input.guardianAccount.id,
    };

    const { data: existingChildProfile, error: existingChildProfileError } =
      await serviceClient
        .from('child_profiles')
        .select('profile_id')
        .eq('org_id', input.guardianAccount.org_id)
        .eq('profile_id', input.profileRow.id)
        .maybeSingle<{ profile_id: string }>();
    if (existingChildProfileError) {
      throw new InternalServerErrorException(existingChildProfileError.message);
    }

    input.cleanupContext.childProfileCreated = !existingChildProfile;
    const childProfileQuery = existingChildProfile
      ? serviceClient.from('child_profiles').update(childProfilePayload).match({
          org_id: input.guardianAccount.org_id,
          profile_id: input.profileRow.id,
        })
      : serviceClient.from('child_profiles').insert(childProfilePayload);
    const childProfileResponse = await childProfileQuery;
    if (childProfileResponse.error) {
      throw new InternalServerErrorException(childProfileResponse.error.message);
    }

    const childGradePayload = {
      org_id: input.guardianAccount.org_id,
      profile_id: input.profileRow.id,
      grade_id: input.input.gradeLevel,
      grade_label: input.input.gradeLevel,
      created_by: input.guardianAccount.id,
      updated_by: input.guardianAccount.id,
    };

    const { data: existingGrade, error: existingGradeError } = await serviceClient
      .from('child_profile_grade_level')
      .select('id')
      .eq('org_id', input.guardianAccount.org_id)
      .eq('profile_id', input.profileRow.id)
      .maybeSingle<{ id: string }>();
    if (existingGradeError) {
      throw new InternalServerErrorException(existingGradeError.message);
    }

    input.cleanupContext.childGradeCreated = !existingGrade;
    const gradeResponse = existingGrade
      ? await serviceClient
          .from('child_profile_grade_level')
          .update(childGradePayload)
          .eq('id', existingGrade.id)
      : await serviceClient.from('child_profile_grade_level').insert(childGradePayload);
    if (gradeResponse.error) {
      throw new InternalServerErrorException(gradeResponse.error.message);
    }
  }

  private async ensureFamilyForGuardian(options: {
    supabase: SupabaseClientLike;
    guardianAccountId: string;
    orgId: string;
  }) {
    const { supabase, guardianAccountId, orgId } = options;
    const { data: existingLink } = await supabase
      .from('family_links')
      .select('family_id')
      .eq('guardian_account_id', guardianAccountId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<{ family_id: string }>();
    if (existingLink?.family_id) return existingLink.family_id;

    const { data: existingFamily } = await supabase
      .from('families')
      .select('id')
      .eq('org_id', orgId)
      .eq('created_by', guardianAccountId)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (existingFamily?.id) return existingFamily.id;

    const { data: guardianProfile } = await supabase
      .from('profiles')
      .select('last_name')
      .eq('account_id', guardianAccountId)
      .eq('org_id', orgId)
      .eq('kind', 'guardian')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<{ last_name?: string | null }>();
    const lastName = guardianProfile?.last_name?.trim();
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
      throw new InternalServerErrorException(
        error?.message ?? 'Unable to create family record.',
      );
    }
    return familyData.id;
  }

  private async loadChildProfiles(
    supabase: SupabaseClientLike,
    orgId: string,
    childAccountIds: string[],
  ): Promise<ChildProfileVM[]> {
    if (!childAccountIds.length) return [];
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('account_id', childAccountIds)
      .eq('org_id', orgId)
      .eq('kind', 'child')
      .is('deleted_at', null)
      .returns<ProfileRow[]>();
    if (profilesError) throw new InternalServerErrorException(profilesError.message);
    if (!profiles?.length) return [];

    const profileIds = profiles.map((row) => row.id);
    const { data: childRows, error: childError } = await supabase
      .from('child_profiles')
      .select('*')
      .in('profile_id', profileIds)
      .returns<ChildProfileRow[]>();
    if (childError) throw new InternalServerErrorException(childError.message);

    const { data: gradeRows, error: gradeError } = await supabase
      .from('child_profile_grade_level')
      .select('*')
      .in('profile_id', profileIds)
      .returns<ChildProfileGradeLevelRow[]>();
    if (gradeError) throw new InternalServerErrorException(gradeError.message);

    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('org_id', orgId)
      .in(
        'id',
        profiles.map((row) => row.account_id),
      )
      .is('deleted_at', null)
      .returns<AccountRow[]>();
    if (accountsError) throw new InternalServerErrorException(accountsError.message);

    const childByProfileId = new Map(
      (childRows ?? []).map((row) => [row.profile_id, row]),
    );
    const gradeByProfileId = new Map(
      (gradeRows ?? []).map((row) => [row.profile_id, row]),
    );
    const accountById = new Map((accounts ?? []).map((account) => [account.id, account]));

    return profiles.map((row) => {
      const child = childByProfileId.get(row.id);
      const grade = gradeByProfileId.get(row.id);
      const gradeLevel: GradeLevel | null = grade
        ? (parseGradeLevel(grade.grade_id) ??
          parseGradeLevel(grade.grade_label ?? grade.grade_id))
        : null;
      const account = accountById.get(row.account_id);
      const baseProfile: Omit<UserProfileVM, 'kind'> = {
        ids: {
          id: row.id,
          orgId: row.org_id,
          accountId: row.account_id,
        },
        profile: {
          displayName: formatDisplayName(row),
          email: account?.email ?? null,
          firstName: row.first_name,
          lastName: row.last_name,
          bio: row.bio,
          avatar: {
            source: resolveAvatarSource(row.avatar_source),
            url: row.avatar_url,
            seed: row.avatar_seed,
            updatedAt: row.avatar_updated_at,
          },
        },
        prefs: {
          timezone: row.timezone ?? 'UTC',
          locale: row.locale,
          languagesSpoken: row.languages_spoken,
          notificationDefaults: null,
          notificationScopedDefaults: null,
        },
        presence: null,
        status: row.status ?? undefined,
        accountEmail: account?.email ?? null,
        location: {
          countryCode: row.country_code,
          countryName: row.country_name,
          region: row.region,
          city: row.city,
          postalCode: row.postal_code,
        },
        meta: {
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        ui: {
          themeKey: resolveThemeKey(row.ui_theme_key ?? null),
        },
      };

      return {
        ...baseProfile,
        kind: 'child',
        accountAuthUserId: account?.auth_user_id ?? null,
        gradeLevel,
        birthYear: child?.birth_year ?? null,
        schoolName: child?.school_name ?? null,
        schoolYear: child?.school_year ?? null,
        interests: child?.interests ?? null,
        strengths: child?.strengths ?? null,
        learningPreferences: child?.learning_preferences ?? null,
        motivationStyles: child?.motivation_styles ?? null,
        confidenceLevel: child?.confidence_level ?? null,
        communicationStyles: child?.communication_styles ?? null,
        accountEmail: account?.email ?? null,
      };
    });
  }

  private async cleanupCreatedRecords(context: CreationCleanupContext) {
    const run = async (fn: () => PromiseLike<unknown>) => {
      try {
        await fn();
      } catch {
        // Cleanup is best-effort; the original creation error is more useful.
      }
    };

    if (context.childGradeCreated && context.profileId) {
      await run(() =>
        context.serviceClient
          .from('child_profile_grade_level')
          .delete()
          .match({ org_id: context.orgId, profile_id: context.profileId }),
      );
    }
    if (context.childProfileCreated && context.profileId) {
      await run(() =>
        context.serviceClient
          .from('child_profiles')
          .delete()
          .match({ org_id: context.orgId, profile_id: context.profileId }),
      );
    }
    if (context.familyLinkCreated && context.familyId) {
      await run(() =>
        context.serviceClient.from('family_links').delete().match({
          org_id: context.orgId,
          family_id: context.familyId,
          guardian_account_id: context.guardianAccountId,
          child_account_id: context.childAccountId,
        }),
      );
    }
    if (context.profileCreated && context.profileId) {
      await run(() =>
        context.serviceClient.from('profiles').delete().eq('id', context.profileId),
      );
    }
    if (context.accountCreated) {
      await run(() =>
        context.serviceClient.from('accounts').delete().eq('id', context.childAccountId),
      );
    }
  }
}
