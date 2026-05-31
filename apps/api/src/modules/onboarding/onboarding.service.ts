import { createHash, randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AccountRow,
  ClassRequestIntent,
  OrgRow,
  ProfileRow,
  RoleKey,
  UserRoleRow,
} from '@iconicedu/shared-types';
import {
  CLASS_REQUEST_INTENT_LABELS,
  isClassRequestIntent,
  STANDARD_SUBJECT_OPTIONS,
} from '@iconicedu/shared-types';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { NotificationPreferencesService } from '@iconicedu/api/modules/notification-preferences/notification-preferences.service';

type RoleChoice = 'parent' | 'educator' | 'student' | 'staff';
type RoleStatus = NonNullable<AccountRow['role_status']>;
type AuthOnboardingState = {
  primaryRole: AccountRow['primary_role'] | null;
  roleStatus: RoleStatus;
  onboardingCompletedAt: string | null;
  requiresRoleSelection: boolean;
  destination: string | null;
};

type StudentAccessCodeRow = {
  id: string;
  org_id: string;
  family_id: string | null;
  guardian_account_id: string | null;
  status: string;
  expires_at: string | null;
  max_uses: number;
  uses: number;
};

type MobileClassRequestInput = {
  requestIntent: ClassRequestIntent;
  subjects: string[];
  learningGoals: string;
  specialRequirements: string | null;
};

const ORG_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INVALID_SUBJECT_KEY_CHARS = /[^a-z0-9-]+/g;
const MULTI_HYPHENS = /-{2,}/g;
const EDGE_HYPHENS = /^-+|-+$/g;
const FEED_MESSAGE_UI_THEME_KEY = 'feed';
const CLASS_REQUEST_CHANNEL_PURPOSE = 'chass-requests';
const MOBILE_ALLOWED_ROLES = new Set([
  'educator',
  'guardian',
  'child',
  'staff',
  'admin',
  'system',
]);

function parseRole(value: unknown): RoleChoice | null {
  return value === 'parent' ||
    value === 'educator' ||
    value === 'student' ||
    value === 'staff'
    ? value
    : null;
}

function normalizeRoleStatus(value: AccountRow['role_status'] | undefined): RoleStatus {
  return value === 'active' || value === 'pending' || value === 'blocked'
    ? value
    : 'unassigned';
}

function parseMobileClassRequest(body: {
  requestIntent?: unknown;
  subjects?: unknown;
  learningGoals?: unknown;
  specialRequirements?: unknown;
}): MobileClassRequestInput {
  if (!isClassRequestIntent(body.requestIntent)) {
    throw new BadRequestException('Select a valid class request type.');
  }
  const subjects = Array.isArray(body.subjects)
    ? body.subjects
        .filter((subject): subject is string => typeof subject === 'string')
        .map((subject) => subject.trim())
        .filter(Boolean)
    : [];
  if (!subjects.length) throw new BadRequestException('Select at least one subject.');
  const allowedSubjects = new Set<string>(STANDARD_SUBJECT_OPTIONS);
  if (subjects.some((subject) => !allowedSubjects.has(subject))) {
    throw new BadRequestException('Invalid subject selection.');
  }
  return {
    requestIntent: body.requestIntent,
    subjects,
    learningGoals:
      typeof body.learningGoals === 'string' ? body.learningGoals.trim() : '',
    specialRequirements:
      typeof body.specialRequirements === 'string' && body.specialRequirements.trim()
        ? body.specialRequirements.trim()
        : null,
  };
}

function buildAuthOnboardingState(
  account: AccountRow,
  roleRows: UserRoleRow[],
): AuthOnboardingState {
  const primaryRole = account.primary_role ?? null;
  const roleStatus = normalizeRoleStatus(account.role_status);
  const onboardingCompletedAt = account.onboarding_completed_at ?? null;
  const hasAnyRole =
    roleRows.length > 0 ||
    primaryRole === 'guardian' ||
    primaryRole === 'educator' ||
    primaryRole === 'child' ||
    primaryRole === 'staff' ||
    primaryRole === 'admin' ||
    primaryRole === 'owner';

  const requiresRoleSelection =
    !hasAnyRole || !primaryRole || !onboardingCompletedAt || roleStatus === 'unassigned';

  if (requiresRoleSelection) {
    return {
      primaryRole,
      roleStatus,
      onboardingCompletedAt,
      requiresRoleSelection: true,
      destination: null,
    };
  }

  if (roleStatus === 'pending' || roleStatus === 'blocked') {
    return {
      primaryRole,
      roleStatus,
      onboardingCompletedAt,
      requiresRoleSelection: false,
      destination: '/login/pending-access',
    };
  }

  return {
    primaryRole,
    roleStatus,
    onboardingCompletedAt,
    requiresRoleSelection: false,
    destination: '/dashboard',
  };
}

function normalizeSubjectLabel(subject: string) {
  return subject.trim().replace(/\s+/g, ' ');
}

function normalizeSubjectKey(subject: string) {
  return normalizeSubjectLabel(subject)
    .toLowerCase()
    .replace(INVALID_SUBJECT_KEY_CHARS, '-')
    .replace(MULTI_HYPHENS, '-')
    .replace(EDGE_HYPHENS, '');
}

function hashInviteCode(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function isStaffEmailAllowed(email: string | null | undefined): boolean {
  const domains = (process.env.STAFF_EMAIL_DOMAIN_ALLOWLIST ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!domains.length || !email) return false;
  const emailDomain = email.trim().toLowerCase().split('@')[1] ?? '';
  return domains.includes(emailDomain);
}

function isStaffAccessCodeValid(code: string | null | undefined): boolean {
  const expected = process.env.STAFF_ACCESS_CODE?.trim();
  return Boolean(expected) && code?.trim() === expected;
}

function supportUiDefaults() {
  return {
    defaultRightPanelKey: 'channel_info',
    disabledTabs: ['members'],
    messageUiThemeKey: FEED_MESSAGE_UI_THEME_KEY,
    defaultRightPanelOpen: false,
    infoPanel: {
      showHeader: false,
      showDetails: false,
      showMedia: false,
      showMembers: false,
      showQuickActions: false,
      showHiddenQuickActions: false,
    },
  };
}

function hasExpectedSupportUiDefaults(uiDefaults: unknown): boolean {
  if (!uiDefaults || typeof uiDefaults !== 'object') return false;
  const candidate = uiDefaults as {
    defaultRightPanelOpen?: unknown;
    defaultRightPanelKey?: unknown;
    disabledTabs?: unknown;
    infoPanel?: unknown;
    messageUiThemeKey?: unknown;
  };
  const infoPanel =
    candidate.infoPanel && typeof candidate.infoPanel === 'object'
      ? (candidate.infoPanel as Record<string, unknown>)
      : null;

  return (
    candidate.defaultRightPanelOpen === false &&
    candidate.defaultRightPanelKey === 'channel_info' &&
    candidate.messageUiThemeKey === FEED_MESSAGE_UI_THEME_KEY &&
    Array.isArray(candidate.disabledTabs) &&
    candidate.disabledTabs.includes('members') &&
    infoPanel?.showHeader === false &&
    infoPanel?.showDetails === false &&
    infoPanel?.showMedia === false &&
    infoPanel?.showMembers === false &&
    infoPanel?.showQuickActions === false &&
    infoPanel?.showHiddenQuickActions === false
  );
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  async getStatus(accessToken: string) {
    const { user, serviceSupabase } = await this.requireUser(accessToken);

    const { data: accountByAuthId, error: accountError } = await serviceSupabase
      .from('accounts')
      .select('id, org_id, onboarding_completed_at, primary_role, phone_e164')
      .eq('auth_user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle<
        Pick<
          AccountRow,
          'id' | 'org_id' | 'onboarding_completed_at' | 'primary_role' | 'phone_e164'
        >
      >();

    if (accountError) throw new InternalServerErrorException(accountError.message);

    let account = accountByAuthId;

    if (!account && user.email) {
      const normalizedEmail = user.email.trim().toLowerCase();
      const { data: accountByEmail, error: accountByEmailError } = await serviceSupabase
        .from('accounts')
        .select('id, org_id, onboarding_completed_at, primary_role, phone_e164')
        .eq('email', normalizedEmail)
        .is('deleted_at', null)
        .maybeSingle<
          Pick<
            AccountRow,
            'id' | 'org_id' | 'onboarding_completed_at' | 'primary_role' | 'phone_e164'
          >
        >();

      if (accountByEmailError) {
        throw new InternalServerErrorException(accountByEmailError.message);
      }

      if (accountByEmail) {
        const updatedAccount = await this.updateAccountAuthUserId(
          serviceSupabase,
          accountByEmail.id,
          user.id,
        );
        account = updatedAccount
          ? {
              id: updatedAccount.id,
              org_id: updatedAccount.org_id,
              onboarding_completed_at: updatedAccount.onboarding_completed_at ?? null,
              primary_role: updatedAccount.primary_role ?? null,
              phone_e164: updatedAccount.phone_e164 ?? null,
            }
          : accountByEmail;
      }
    }

    if (!account) {
      throw new BadRequestException(
        'No account found for this user. Please contact your administrator.',
      );
    }

    let profileId: string | null = null;
    let profileKind: string | null = null;
    let firstName = '';
    let lastName = '';
    let timezone = '';
    let city = '';
    let region = '';
    let postalCode = '';
    let countryCode = '';

    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select(
        'id, kind, first_name, last_name, timezone, city, region, postal_code, country_code',
      )
      .eq('account_id', account.id)
      .eq('org_id', account.org_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<
        Pick<
          ProfileRow,
          | 'id'
          | 'kind'
          | 'first_name'
          | 'last_name'
          | 'timezone'
          | 'city'
          | 'region'
          | 'postal_code'
          | 'country_code'
        >
      >();

    if (profileError) throw new InternalServerErrorException(profileError.message);

    if (profile) {
      profileId = profile.id;
      profileKind = profile.kind ?? null;
      firstName = profile.first_name ?? '';
      lastName = profile.last_name ?? '';
      timezone = profile.timezone ?? '';
      city = profile.city ?? '';
      region = profile.region ?? '';
      postalCode = profile.postal_code ?? '';
      countryCode = profile.country_code ?? '';
    }

    const kind = profileKind ?? account.primary_role ?? null;
    const hasName = !!firstName.trim() && !!lastName.trim();
    const hasTimezone = !!timezone.trim() && timezone.trim() !== 'UTC';
    const hasLocation = !!city.trim() && !!region.trim();
    const requiresPhone = kind !== 'child';
    const hasPhone = !!account.phone_e164?.trim();

    let hasRoleData = true;
    if (kind === 'child' && profileId) {
      const { data: gradeRows, error: gradeError } = await serviceSupabase
        .from('child_profile_grade_level')
        .select('grade_id')
        .eq('profile_id', profileId)
        .limit(1);
      if (gradeError) throw new InternalServerErrorException(gradeError.message);
      hasRoleData = (gradeRows?.length ?? 0) > 0;
    } else if (kind === 'educator' && profileId) {
      const [subjectRowsResponse, gradeRowsResponse] = await Promise.all([
        serviceSupabase
          .from('educator_profile_subjects')
          .select('subject')
          .eq('profile_id', profileId)
          .limit(1),
        serviceSupabase
          .from('educator_profile_grade_levels')
          .select('grade_id')
          .eq('profile_id', profileId)
          .limit(1),
      ]);
      if (subjectRowsResponse.error) {
        throw new InternalServerErrorException(subjectRowsResponse.error.message);
      }
      if (gradeRowsResponse.error) {
        throw new InternalServerErrorException(gradeRowsResponse.error.message);
      }
      hasRoleData =
        (subjectRowsResponse.data?.length ?? 0) > 0 &&
        (gradeRowsResponse.data?.length ?? 0) > 0;
    }

    let hasAvailability = kind !== 'educator';
    if (kind === 'educator' && profileId) {
      const { data: availabilityRows, error: availabilityError } = await serviceSupabase
        .from('educator_availabilities')
        .select('profile_id')
        .eq('profile_id', profileId)
        .limit(1);
      if (availabilityError) {
        throw new InternalServerErrorException(availabilityError.message);
      }
      hasAvailability = (availabilityRows?.length ?? 0) > 0;
    }

    const isComplete =
      hasName &&
      hasTimezone &&
      hasLocation &&
      (!requiresPhone || hasPhone) &&
      hasRoleData &&
      hasAvailability;

    return {
      isComplete,
      isRoleAllowed: kind === null || MOBILE_ALLOWED_ROLES.has(kind),
      profileId,
      accountId: account.id,
      orgId: account.org_id,
      primaryRole: account.primary_role ?? null,
      profileKind,
      flags: {
        hasName,
        hasTimezone,
        hasLocation,
        hasPhone,
        requiresPhone,
        hasRoleData,
        hasAvailability,
      },
      prefill: {
        firstName,
        lastName,
        phone: account.phone_e164 ?? '',
        timezone,
        city,
        region,
        postalCode,
        countryCode,
      },
    };
  }

  async completeRole(
    accessToken: string,
    body: { role?: unknown; staffAccessCode?: unknown },
    orgSlug?: string | null,
  ) {
    const role = parseRole(body.role);
    if (!role) throw new BadRequestException('Valid role is required');
    if (role === 'student') {
      throw new BadRequestException('Use /api/onboarding/student for student onboarding');
    }

    const { user, serviceSupabase } = await this.requireUser(accessToken);
    const orgId = await this.resolveOrgIdForUser(serviceSupabase, user.id, orgSlug);
    if (!orgId) throw new BadRequestException('No organization found for onboarding');

    const account = await this.getOrCreateAccount(serviceSupabase, {
      orgId,
      authUserId: user.id,
      authEmail: user.email ?? null,
    });

    if (role === 'staff') {
      const staffAccessCode =
        typeof body.staffAccessCode === 'string' ? body.staffAccessCode : null;
      if (
        !isStaffAccessCodeValid(staffAccessCode) &&
        !isStaffEmailAllowed(user.email ?? null)
      ) {
        throw new ForbiddenException(
          'Staff access is restricted. Contact support if you need access.',
        );
      }
    }

    const roleKey = role === 'parent' ? 'guardian' : role;
    const profileKind = roleKey === 'guardian' ? 'guardian' : roleKey;
    const now = new Date().toISOString();
    const roleStatus = role === 'educator' ? 'pending' : 'active';
    const profile = await this.ensureProfile(serviceSupabase, account, profileKind);

    await this.notificationPreferencesService.seedDefaults(accessToken, {
      orgId: account.org_id,
      profileId: profile.id,
    });

    if (roleStatus === 'active') {
      await this.upsertUserRole(serviceSupabase, {
        orgId: account.org_id,
        accountId: account.id,
        roleKey: roleKey as RoleKey,
        assignedBy: user.id,
      });
    }

    const updatedAccount = await this.updateAccountRoleState(serviceSupabase, {
      accountId: account.id,
      orgId: account.org_id,
      primaryRole: roleKey as RoleKey,
      roleStatus,
      onboardingCompletedAt: now,
      updatedBy: user.id,
    });

    const roles = await this.getUserRoles(serviceSupabase, account.id, account.org_id);
    return {
      success: true,
      onboarding: await this.resolveOnboardingDestinations(
        serviceSupabase,
        buildAuthOnboardingState(updatedAccount, roles),
        updatedAccount.org_id,
      ),
    };
  }

  async completeStudent(
    accessToken: string,
    body: { inviteCode?: unknown },
    orgSlug?: string | null,
  ) {
    const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode.trim() : '';
    if (!inviteCode) throw new BadRequestException('Invite code is required');

    const { user, serviceSupabase } = await this.requireUser(accessToken);
    const orgId = await this.resolveOrgIdForUser(serviceSupabase, user.id, orgSlug);
    if (!orgId) throw new BadRequestException('No organization found for onboarding');

    const account = await this.getOrCreateAccount(serviceSupabase, {
      orgId,
      authUserId: user.id,
      authEmail: user.email ?? null,
    });

    const inviteCodeRow = await this.getStudentInviteCode(
      serviceSupabase,
      account.org_id,
      inviteCode,
    );
    this.assertStudentInviteUsable(inviteCodeRow);

    const now = new Date().toISOString();
    if (inviteCodeRow.family_id && inviteCodeRow.guardian_account_id) {
      const { error } = await serviceSupabase.from('family_links').upsert(
        {
          org_id: account.org_id,
          family_id: inviteCodeRow.family_id,
          guardian_account_id: inviteCodeRow.guardian_account_id,
          child_account_id: account.id,
          relation: 'guardian',
          permissions_scope: null,
          created_by: user.id,
          updated_by: user.id,
        },
        { onConflict: 'org_id,family_id,guardian_account_id,child_account_id' },
      );
      if (error) throw new InternalServerErrorException(error.message);
    }

    const profile = await this.ensureProfile(serviceSupabase, account, 'child');
    await this.notificationPreferencesService.seedDefaults(accessToken, {
      orgId: account.org_id,
      profileId: profile.id,
    });

    await this.upsertUserRole(serviceSupabase, {
      orgId: account.org_id,
      accountId: account.id,
      roleKey: 'child',
      assignedBy: user.id,
    });

    const nextUses = inviteCodeRow.uses + 1;
    const usageResponse = await serviceSupabase
      .from('student_access_codes')
      .update({
        uses: nextUses,
        status: nextUses >= inviteCodeRow.max_uses ? 'used' : inviteCodeRow.status,
        updated_at: now,
      })
      .eq('id', inviteCodeRow.id)
      .eq('org_id', account.org_id);
    if (usageResponse.error) {
      throw new InternalServerErrorException(usageResponse.error.message);
    }

    const updatedAccount = await this.updateAccountRoleState(serviceSupabase, {
      accountId: account.id,
      orgId: account.org_id,
      primaryRole: 'child',
      roleStatus: 'active',
      onboardingCompletedAt: now,
      updatedBy: user.id,
    });

    const roles = await this.getUserRoles(serviceSupabase, account.id, account.org_id);
    return {
      success: true,
      onboarding: await this.resolveOnboardingDestinations(
        serviceSupabase,
        buildAuthOnboardingState(updatedAccount, roles),
        updatedAccount.org_id,
      ),
    };
  }

  async submitClassRequest(
    accessToken: string,
    body: {
      requestIntent?: unknown;
      subjects?: unknown;
      learningGoals?: unknown;
      specialRequirements?: unknown;
    },
  ) {
    const input = parseMobileClassRequest(body);
    const { user, serviceSupabase } = await this.requireUser(accessToken);
    const account = await this.getAccountByAuthUserId(serviceSupabase, user.id);
    if (!account?.org_id) throw new BadRequestException('No account found.');
    if (account.primary_role !== 'guardian') {
      throw new ForbiddenException('Only parents can request classes.');
    }

    const guardianProfile = await this.getProfileByAccountId(serviceSupabase, account.id);
    if (!guardianProfile || guardianProfile.kind !== 'guardian') {
      throw new BadRequestException('Parent profile not found.');
    }

    const staffProfiles = await this.listClassRequestStaffProfiles(
      serviceSupabase,
      account.org_id,
    );
    const now = new Date().toISOString();
    const channelId = randomUUID();
    const requesterName =
      guardianProfile.display_name?.trim() ||
      [guardianProfile.first_name, guardianProfile.last_name].filter(Boolean).join(' ') ||
      user.email ||
      'Parent';

    const { error: channelError } = await serviceSupabase.from('channels').insert({
      id: channelId,
      org_id: account.org_id,
      kind: 'channel',
      topic: `Class Requests · ${requesterName}`,
      description: 'Class request from mobile onboarding',
      visibility: 'private',
      purpose: CLASS_REQUEST_CHANNEL_PURPOSE,
      status: 'active',
      posting_policy_kind: 'members-only',
      allow_threads: true,
      allow_reactions: true,
      created_by_profile_id: guardianProfile.id,
      created_at: now,
      created_by: guardianProfile.id,
      updated_at: now,
      updated_by: guardianProfile.id,
    });
    if (channelError) throw new InternalServerErrorException(channelError.message);

    const memberRows = Array.from(
      new Set([guardianProfile.id, ...staffProfiles.map((profile) => profile.id)]),
    ).map((profileId) => ({
      id: randomUUID(),
      org_id: account.org_id,
      channel_id: channelId,
      profile_id: profileId,
      joined_at: now,
      created_at: now,
      created_by: guardianProfile.id,
      updated_at: now,
      updated_by: guardianProfile.id,
    }));
    const { error: memberError } = await serviceSupabase
      .from('channel_members')
      .insert(memberRows);
    if (memberError) throw new InternalServerErrorException(memberError.message);

    const { data: message, error: messageError } = await serviceSupabase
      .from('messages')
      .insert({
        org_id: account.org_id,
        channel_id: channelId,
        sender_profile_id: guardianProfile.id,
        type: 'text',
        created_at: now,
        created_by: guardianProfile.id,
        updated_at: now,
        updated_by: guardianProfile.id,
      })
      .select('id')
      .single<{ id: string }>();
    if (messageError || !message) {
      throw new InternalServerErrorException(
        messageError?.message ?? 'Unable to create class request.',
      );
    }

    const { error: payloadError } = await serviceSupabase.from('message_text').insert({
      message_id: message.id,
      org_id: account.org_id,
      payload: {
        text: [
          'Class Request',
          '',
          `Requested by: ${requesterName}`,
          `Request type: ${CLASS_REQUEST_INTENT_LABELS[input.requestIntent]}`,
          `Subject(s): ${input.subjects.join(', ')}`,
          ...(input.learningGoals ? ['', 'Learning goals:', input.learningGoals] : []),
          '',
          'Special requirements:',
          input.specialRequirements || 'None provided',
        ].join('\n'),
      },
      created_at: now,
      created_by: guardianProfile.id,
      updated_at: now,
      updated_by: guardianProfile.id,
    });
    if (payloadError) throw new InternalServerErrorException(payloadError.message);

    return { success: true, channelId };
  }

  async bootstrapOrg(accessToken: string, body: { name?: unknown; slug?: unknown }) {
    const orgName = typeof body.name === 'string' ? body.name.trim() : '';
    const orgSlugRaw = typeof body.slug === 'string' ? body.slug.trim() : '';
    const orgSlug = orgSlugRaw.toLowerCase();

    if (!orgName) throw new BadRequestException('Organization name is required');
    if (!ORG_SLUG_REGEX.test(orgSlug)) {
      throw new BadRequestException(
        'Slug must use lowercase letters, numbers, and hyphens only.',
      );
    }

    const { user, serviceSupabase } = await this.requireUser(accessToken);
    const existingSlug = await this.getOrgBySlug(serviceSupabase, orgSlug);
    if (existingSlug) throw new ConflictException('Slug is already in use.');

    const { data: org, error: orgInsertError } = await serviceSupabase
      .from('orgs')
      .insert({
        name: orgName,
        slug: orgSlug,
        created_by: user.id,
        updated_by: user.id,
      })
      .select(
        'id, name, slug, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by',
      )
      .single<OrgRow>();
    if (orgInsertError || !org) {
      throw new InternalServerErrorException(
        orgInsertError?.message ?? 'Unable to create organization.',
      );
    }

    const account = await this.getOrCreateAccount(serviceSupabase, {
      orgId: org.id,
      authUserId: user.id,
      authEmail: user.email ?? null,
    });
    await this.upsertUserRole(serviceSupabase, {
      orgId: org.id,
      accountId: account.id,
      roleKey: 'owner',
      assignedBy: user.id,
    });

    const creatorProfile = await this.ensureProfile(serviceSupabase, account, 'staff');
    await this.notificationPreferencesService.seedDefaults(accessToken, {
      orgId: org.id,
      profileId: creatorProfile.id,
    });
    await this.seedDefaultOrgSubjectCatalog(serviceSupabase, org.id, creatorProfile.id);
    await this.ensureSupportChannel(serviceSupabase, org.id, creatorProfile.id);

    const updatedAccount = await this.updateAccountRoleState(serviceSupabase, {
      accountId: account.id,
      orgId: org.id,
      primaryRole: 'owner',
      roleStatus: 'active',
      onboardingCompletedAt: new Date().toISOString(),
      updatedBy: user.id,
    });

    const roles = await this.getUserRoles(serviceSupabase, account.id, org.id);
    return {
      success: true,
      org,
      onboarding: await this.resolveOnboardingDestinations(
        serviceSupabase,
        buildAuthOnboardingState(updatedAccount, roles),
        updatedAccount.org_id,
      ),
    };
  }

  private async requireUser(accessToken: string) {
    const sessionSupabase = createSupabaseSessionClient(accessToken);
    const {
      data: { user },
      error,
    } = await sessionSupabase.auth.getUser();
    if (error) throw new UnauthorizedException(error.message);
    if (!user) throw new UnauthorizedException('Unauthorized');
    return { user, serviceSupabase: createSupabaseServiceClient() };
  }

  private async resolveOrgIdForUser(
    supabase: SupabaseClient,
    authUserId: string,
    orgSlug?: string | null,
  ): Promise<string | null> {
    if (orgSlug) {
      const org = await this.getOrgBySlug(supabase, orgSlug);
      if (org?.id) return org.id;
    }

    const account = await this.getAccountByAuthUserId(supabase, authUserId);
    if (account?.org_id) return account.org_id;

    const defaultOrg = await this.getDefaultOrg(supabase);
    return defaultOrg?.id ?? null;
  }

  private async getOrCreateAccount(
    supabase: SupabaseClient,
    input: { orgId: string; authUserId: string; authEmail?: string | null },
  ): Promise<AccountRow> {
    const accountInOrg = await this.getAccountByAuthUserIdInOrg(
      supabase,
      input.authUserId,
      input.orgId,
    );
    if (accountInOrg) return accountInOrg;

    const normalizedEmail = input.authEmail?.trim().toLowerCase();
    if (normalizedEmail) {
      const invitedAccount = await this.getAccountByEmail(
        supabase,
        input.orgId,
        normalizedEmail,
      );
      if (invitedAccount?.id) {
        const updatedAccount = await this.updateAccountAuthUserId(
          supabase,
          invitedAccount.id,
          input.authUserId,
        );
        if (updatedAccount) return updatedAccount;

        const refreshed = await this.getAccountById(supabase, invitedAccount.id);
        if (refreshed) return refreshed;
      }
    }

    const { data, error } = await supabase
      .from('accounts')
      .insert({
        org_id: input.orgId,
        auth_user_id: input.authUserId,
        email: input.authEmail ?? null,
        preferred_contact_channels: ['email'],
        status: 'active',
      })
      .select('*')
      .single<AccountRow>();
    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message ?? 'Unable to create account',
      );
    }
    return data;
  }

  private async listClassRequestStaffProfiles(
    supabase: SupabaseClient,
    orgId: string,
  ): Promise<ProfileRow[]> {
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id')
      .eq('org_id', orgId)
      .in('primary_role', ['owner', 'admin', 'staff'])
      .is('deleted_at', null)
      .returns<Array<{ id: string }>>();
    if (accountsError) throw new InternalServerErrorException(accountsError.message);

    const accountIds = (accounts ?? []).map((account) => account.id);
    const query = supabase
      .from('profiles')
      .select('*')
      .eq('org_id', orgId)
      .is('deleted_at', null);
    const { data, error } = accountIds.length
      ? await query
          .or(`kind.eq.staff,account_id.in.(${accountIds.join(',')})`)
          .returns<ProfileRow[]>()
      : await query.eq('kind', 'staff').returns<ProfileRow[]>();
    if (error) throw new InternalServerErrorException(error.message);

    return Array.from(
      new Map((data ?? []).map((profile) => [profile.id, profile])).values(),
    );
  }

  private async ensureProfile(
    supabase: SupabaseClient,
    account: AccountRow,
    kind: ProfileRow['kind'],
  ): Promise<ProfileRow> {
    const currentProfile = await this.getProfileByAccountId(supabase, account.id);
    const payload = {
      org_id: account.org_id,
      account_id: account.id,
      kind,
      display_name: currentProfile?.display_name ?? null,
      first_name: null,
      last_name: null,
      avatar_source: currentProfile?.avatar_source ?? 'seed',
      avatar_url: currentProfile?.avatar_url ?? null,
      avatar_seed: currentProfile?.avatar_seed ?? account.id,
      timezone: currentProfile?.timezone ?? 'UTC',
      locale: currentProfile?.locale ?? 'en-US',
      status: currentProfile?.status ?? 'active',
      ui_theme_key: currentProfile?.ui_theme_key ?? 'teal',
    };

    if (currentProfile && currentProfile.kind === kind) return currentProfile;

    if (currentProfile) {
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', currentProfile.id)
        .eq('org_id', account.org_id)
        .is('deleted_at', null)
        .select('*')
        .maybeSingle<ProfileRow>();
      if (error || !data) {
        throw new InternalServerErrorException(
          error?.message ?? 'Unable to update profile.',
        );
      }
      return data;
    }

    const upsertResponse = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'org_id,account_id,kind' })
      .select('*')
      .single<ProfileRow>();
    if (!upsertResponse.error && upsertResponse.data) return upsertResponse.data;
    if (upsertResponse.error?.code !== '42P10') {
      throw new InternalServerErrorException(upsertResponse.error.message);
    }

    const { data, error } = await supabase
      .from('profiles')
      .insert(payload)
      .select('*')
      .single<ProfileRow>();
    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message ?? 'Unable to create profile.',
      );
    }
    return data;
  }

  private async getProfileByAccountId(
    supabase: SupabaseClient,
    accountId: string,
  ): Promise<ProfileRow | null> {
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, org_id, active_profile_id')
      .eq('id', accountId)
      .is('deleted_at', null)
      .maybeSingle<Pick<AccountRow, 'id' | 'org_id' | 'active_profile_id'>>();
    if (accountError) throw new InternalServerErrorException(accountError.message);

    if (account?.active_profile_id) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', account.active_profile_id)
        .eq('account_id', accountId)
        .eq('org_id', account.org_id)
        .is('deleted_at', null)
        .maybeSingle<ProfileRow>();
      if (error) throw new InternalServerErrorException(error.message);
      if (data) return data;
    }

    let query = supabase
      .from('profiles')
      .select('*')
      .eq('account_id', accountId)
      .is('deleted_at', null);
    if (account?.org_id) query = query.eq('org_id', account.org_id);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<ProfileRow>();
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? null;
  }

  private async getStudentInviteCode(
    supabase: SupabaseClient,
    orgId: string,
    inviteCode: string,
  ) {
    const { data, error } = await supabase
      .from('student_access_codes')
      .select(
        'id, org_id, family_id, guardian_account_id, status, expires_at, max_uses, uses',
      )
      .eq('org_id', orgId)
      .eq('code_hash', hashInviteCode(inviteCode))
      .is('deleted_at', null)
      .maybeSingle<StudentAccessCodeRow>();
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  private assertStudentInviteUsable(
    inviteCodeRow: StudentAccessCodeRow | null,
  ): asserts inviteCodeRow is StudentAccessCodeRow {
    if (!inviteCodeRow || inviteCodeRow.status !== 'active') {
      throw new BadRequestException('Invalid invite code');
    }
    if (
      inviteCodeRow.expires_at &&
      new Date(inviteCodeRow.expires_at).getTime() < Date.now()
    ) {
      throw new BadRequestException('Invite code has expired');
    }
    if (inviteCodeRow.uses >= inviteCodeRow.max_uses) {
      throw new BadRequestException('Invite code has already been used');
    }
  }

  private async updateAccountRoleState(
    supabase: SupabaseClient,
    input: {
      accountId: string;
      orgId: string;
      primaryRole: AccountRow['primary_role'] | null;
      roleStatus: RoleStatus;
      onboardingCompletedAt?: string | null;
      updatedBy?: string | null;
    },
  ) {
    const { data, error } = await supabase
      .from('accounts')
      .update({
        primary_role: input.primaryRole,
        role_status: input.roleStatus,
        onboarding_completed_at: input.onboardingCompletedAt ?? null,
        updated_by: input.updatedBy ?? null,
      })
      .eq('id', input.accountId)
      .eq('org_id', input.orgId)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle<AccountRow>();
    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message ?? 'Unable to update account role',
      );
    }
    return data;
  }

  private async upsertUserRole(
    supabase: SupabaseClient,
    input: { orgId: string; accountId: string; roleKey: RoleKey; assignedBy?: string },
  ) {
    const { error } = await supabase.from('user_roles').upsert(
      {
        org_id: input.orgId,
        account_id: input.accountId,
        role_key: input.roleKey,
        assigned_by: input.assignedBy ?? null,
        assigned_at: new Date().toISOString(),
        deleted_at: null,
        deleted_by: null,
      },
      { onConflict: 'org_id,account_id,role_key' },
    );
    if (error) throw new InternalServerErrorException(error.message);
  }

  private async getUserRoles(supabase: SupabaseClient, accountId: string, orgId: string) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('account_id', accountId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .returns<UserRoleRow[]>();
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  private async resolveOnboardingDestinations(
    supabase: SupabaseClient,
    onboarding: AuthOnboardingState,
    orgId: string,
  ) {
    if (onboarding.destination === '/login/pending-access') {
      const loginPath = await this.resolveOrgLoginPath(supabase, orgId);
      return { ...onboarding, destination: `${loginPath}/pending-access` };
    }
    if (onboarding.destination === '/dashboard') {
      return {
        ...onboarding,
        destination: await this.resolveOrgDashboardPath(supabase, orgId),
      };
    }
    return onboarding;
  }

  private async resolveOrgDashboardPath(
    supabase: SupabaseClient,
    orgId: string,
    fallbackPath = '/i/get-started',
  ) {
    const org = await this.getOrgById(supabase, orgId);
    return org?.slug ? `/${org.slug}` : fallbackPath;
  }

  private async resolveOrgLoginPath(
    supabase: SupabaseClient,
    orgId: string,
    fallbackPath = '/i/get-started',
  ) {
    const dashboardPath = await this.resolveOrgDashboardPath(
      supabase,
      orgId,
      fallbackPath,
    );
    if (!dashboardPath.startsWith('/') || dashboardPath === fallbackPath) {
      return fallbackPath;
    }
    return `${dashboardPath}/login`;
  }

  private async seedDefaultOrgSubjectCatalog(
    supabase: SupabaseClient,
    orgId: string,
    actorId: string,
  ) {
    const uniqueSubjects = Array.from(
      new Map(
        STANDARD_SUBJECT_OPTIONS.map((subject) => normalizeSubjectLabel(subject))
          .filter(Boolean)
          .map((subject) => [normalizeSubjectKey(subject), subject]),
      ).values(),
    );
    if (!uniqueSubjects.length) return;

    const { error } = await supabase.from('org_subject_catalog').upsert(
      uniqueSubjects.map((subject, index) => ({
        org_id: orgId,
        subject,
        subject_key: normalizeSubjectKey(subject),
        is_active: true,
        sort_order: (index + 1) * 10,
        created_by: actorId,
        updated_by: actorId,
        deleted_at: null,
        deleted_by: null,
      })),
      { onConflict: 'org_id,subject_key', ignoreDuplicates: false },
    );
    if (error) throw new InternalServerErrorException(error.message);
  }

  private async ensureSupportChannel(
    supabase: SupabaseClient,
    orgId: string,
    creatorProfileId: string,
  ) {
    const existingResponse = await supabase
      .from('channels')
      .select(
        'id, topic, icon_key, ui_theme_key, ui_defaults, visibility, posting_policy_kind, allow_threads, allow_reactions',
      )
      .eq('org_id', orgId)
      .eq('purpose', 'support')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle<{
        id: string;
        topic?: string | null;
        icon_key?: string | null;
        ui_theme_key?: string | null;
        ui_defaults?: unknown;
        visibility?: string | null;
        posting_policy_kind?: string | null;
        allow_threads?: boolean | null;
        allow_reactions?: boolean | null;
      }>();
    if (existingResponse.error) {
      throw new InternalServerErrorException(existingResponse.error.message);
    }

    const defaults = supportUiDefaults();
    if (existingResponse.data?.id) {
      const existing = existingResponse.data;
      const shouldUpdate =
        existing.topic !== 'Live Support' ||
        existing.icon_key !== 'life-buoy' ||
        existing.ui_theme_key !== 'amber' ||
        !hasExpectedSupportUiDefaults(existing.ui_defaults) ||
        existing.visibility !== 'public' ||
        existing.posting_policy_kind !== 'members-only' ||
        existing.allow_threads !== true ||
        existing.allow_reactions !== true;

      if (shouldUpdate) {
        const { error } = await supabase
          .from('channels')
          .update({
            topic: 'Live Support',
            icon_key: 'life-buoy',
            ui_theme_key: 'amber',
            ui_defaults: defaults,
            visibility: 'public',
            posting_policy_kind: 'members-only',
            allow_threads: true,
            allow_reactions: true,
            updated_at: new Date().toISOString(),
            updated_by: creatorProfileId,
          })
          .eq('id', existing.id)
          .eq('org_id', orgId)
          .is('deleted_at', null);
        if (error) throw new InternalServerErrorException(error.message);
      }
      return;
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from('channels').insert({
      id: randomUUID(),
      org_id: orgId,
      kind: 'channel',
      topic: 'Live Support',
      description: 'ICONIC support channel for questions and threaded replies.',
      icon_key: 'life-buoy',
      ui_theme_key: 'amber',
      ui_defaults: defaults,
      visibility: 'public',
      purpose: 'support',
      status: 'active',
      posting_policy_kind: 'members-only',
      allow_threads: true,
      allow_reactions: true,
      created_by_profile_id: creatorProfileId,
      created_at: now,
      created_by: creatorProfileId,
      updated_at: now,
      updated_by: creatorProfileId,
    });
    if (error) throw new InternalServerErrorException(error.message);
  }

  private async getAccountByAuthUserId(supabase: SupabaseClient, authUserId: string) {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('auth_user_id', authUserId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<AccountRow>();
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? null;
  }

  private async getAccountByAuthUserIdInOrg(
    supabase: SupabaseClient,
    authUserId: string,
    orgId: string,
  ) {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('auth_user_id', authUserId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle<AccountRow>();
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? null;
  }

  private async getAccountByEmail(
    supabase: SupabaseClient,
    orgId: string,
    email: string,
  ) {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('org_id', orgId)
      .ilike('email', email)
      .is('deleted_at', null)
      .maybeSingle<AccountRow>();
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? null;
  }

  private async getAccountById(supabase: SupabaseClient, accountId: string) {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .is('deleted_at', null)
      .maybeSingle<AccountRow>();
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? null;
  }

  private async updateAccountAuthUserId(
    supabase: SupabaseClient,
    accountId: string,
    authUserId: string,
  ) {
    const { data, error } = await supabase
      .from('accounts')
      .update({
        auth_user_id: authUserId,
        status: 'active',
        updated_by: authUserId,
      })
      .eq('id', accountId)
      .select('*')
      .single<AccountRow>();
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? null;
  }

  private async getOrgBySlug(supabase: SupabaseClient, slug: string) {
    const { data, error } = await supabase
      .from('orgs')
      .select('*')
      .eq('slug', slug)
      .is('deleted_at', null)
      .maybeSingle<OrgRow>();
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? null;
  }

  private async getOrgById(supabase: SupabaseClient, orgId: string) {
    const { data, error } = await supabase
      .from('orgs')
      .select('*')
      .eq('id', orgId)
      .is('deleted_at', null)
      .maybeSingle<OrgRow>();
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? null;
  }

  private async getDefaultOrg(supabase: SupabaseClient) {
    const { data, error } = await supabase
      .from('orgs')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<OrgRow>();
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? null;
  }
}
