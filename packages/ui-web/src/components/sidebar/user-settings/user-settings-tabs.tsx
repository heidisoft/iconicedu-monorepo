import * as React from 'react';
import { LogOut } from 'lucide-react';

import type {
  ChildProfileSaveInput,
  ChildProfileVM,
  EducatorAvailabilityInput,
  EducatorProfileSaveInput,
  FamilyLinkInviteRole,
  FamilyLinkInviteVM,
  StaffProfileSaveInput,
  ThemeKey,
  UserAccountVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { Separator } from '@iconicedu/ui-web/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@iconicedu/ui-web/ui/tabs';
import { useSidebar } from '@iconicedu/ui-web/ui/sidebar';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { getProfileDisplayName, getProfileFullName } from '@iconicedu/ui-web/lib/display-name';
import { AccountTab, type AccountSectionKey } from '@iconicedu/ui-web/components/sidebar/user-settings/account-tab';
import { Button } from '@iconicedu/ui-web/ui/button';
import { FamilyTab } from '@iconicedu/ui-web/components/sidebar/user-settings/family-tab';
import { LocationTab } from '@iconicedu/ui-web/components/sidebar/user-settings/location-tab';
import { NotificationsTab } from '@iconicedu/ui-web/components/sidebar/user-settings/notifications-tab';
import { PreferencesTab, type PreferencesSectionKey } from '@iconicedu/ui-web/components/sidebar/user-settings/preferences-tab';
import {
  ProfileTab,
  type ProfileAvatarInput,
  type ProfileAvatarRemoveInput,
  type ProfileSaveInput,
} from '@iconicedu/ui-web/components/sidebar/user-settings/profile-tab';
import { StaffProfileTab } from '@iconicedu/ui-web/components/sidebar/user-settings/staff-profile-tab';
import { StudentProfileTab } from '@iconicedu/ui-web/components/sidebar/user-settings/student-profile-tab';
import { EducatorProfileTab } from '@iconicedu/ui-web/components/sidebar/user-settings/educator-profile-tab';
import { EducatorAvailabilityTab } from '@iconicedu/ui-web/components/sidebar/user-settings/educator-availability-tab';
import {
  OnboardingStep,
  PROFILE_THEME_OPTIONS,
  SETTINGS_TABS,
  type UserSettingsTab,
} from '@iconicedu/ui-web/components/sidebar/user-settings/constants';
import {
  USER_SETTINGS_TAB_TRIGGER_CLASS,
} from '@iconicedu/ui-web/components/sidebar/user-settings/user-settings.theme';
import {
  dedupeChildMembersByEmail,
  filterInvitesWithExistingAccounts,
  formatChildName,
} from '@iconicedu/ui-web/components/sidebar/user-settings/user-settings-tabs.utils';

export type UserSettingsTabsProps = {
  value: UserSettingsTab;
  onValueChange: (tab: UserSettingsTab) => void;
  profile: UserProfileVM;
  account?: UserAccountVM | null;
  onLogout?: () => Promise<void> | void;
  onProfileSave?: (input: ProfileSaveInput) => Promise<void> | void;
  onChildProfileSave?: (input: ChildProfileSaveInput) => Promise<void> | void;
  onAvatarUpload?: (input: ProfileAvatarInput) => Promise<void> | void;
  onAvatarRemove?: (input: ProfileAvatarRemoveInput) => Promise<void> | void;
  onPrefsSave?: (input: {
    profileId: string;
    orgId: string;
    timezone?: string;
    locale?: string | null;
    languagesSpoken?: string[] | null;
    themeKey?: string | null;
  }) => Promise<void> | void;
  onChildThemeSave?: (input: {
    profileId: string;
    orgId: string;
    themeKey: ThemeKey;
  }) => Promise<void> | void;
  onNotificationPreferenceSave?: (input: {
    profileId: string;
    orgId: string;
    prefKey: string;
    channels: string[];
    muted?: boolean | null;
  }) => Promise<void> | void;
  onLocationContinue?: (input: {
    city: string;
    region: string;
    postalCode: string;
    countryCode?: string | null;
    countryName?: string | null;
  }) => Promise<void> | void;
  onAccountUpdate?: (input: {
    accountId: string;
    orgId: string;
    phoneE164?: string | null;
    whatsappE164?: string | null;
    preferredContactChannels?: string[] | null;
  }) => Promise<void> | void;
  onFamilyInviteCreate?: (input: {
    invitedRole: FamilyLinkInviteRole;
    invitedEmail: string;
    targetAccountId?: string;
  }) => Promise<FamilyLinkInviteVM> | void;
  onFamilyInviteRemove?: (input: { inviteId: string }) => Promise<void> | void;
  onChildProfileCreate?: (input: {
    orgId: string;
    displayName: string;
    firstName: string;
    lastName: string;
    gradeLevel: string;
    birthYear: number;
    timezone?: string | null;
    city?: string | null;
    region?: string | null;
    countryCode?: string | null;
    countryName?: string | null;
    postalCode?: string | null;
    themeKey?: ThemeKey | null;
  }) => Promise<ChildProfileVM> | void;
  onFamilyMemberRemove?: (input: { childAccountId: string }) => Promise<void> | void;
  onEducatorProfileSave?: (input: EducatorProfileSaveInput) => Promise<void> | void;
  onEducatorAvailabilitySave?: (input: EducatorAvailabilityInput) => Promise<void> | void;
  onStaffProfileSave?: (input: StaffProfileSaveInput) => Promise<void> | void;
  onboardingStep?: OnboardingStep | null;
  scrollToken?: number;
};

const ONBOARDING_SECTION_CONFIG: Record<
  OnboardingStep,
  { tab: UserSettingsTab; sectionKey?: string }
> = {
  'account-phone': { tab: 'account', sectionKey: 'phone' },
  profile: { tab: 'profile', sectionKey: 'profile-details' },
  'preferences-timezone': { tab: 'preferences', sectionKey: 'timezone' },
  location: { tab: 'location', sectionKey: 'address' },
  family: { tab: 'family', sectionKey: 'family' },
  'student-profile': { tab: 'student-profile', sectionKey: 'student-profile' },
  'educator-profile': { tab: 'educator-profile', sectionKey: 'educator-profile' },
  'staff-profile': { tab: 'staff-profile', sectionKey: 'staff-profile' },
  'educator-availability': { tab: 'educator-availability', sectionKey: 'availability' },
};

export function UserSettingsTabs({
  value,
  onValueChange,
  profile,
  account,
  onLogout,
  onProfileSave,
  onChildProfileSave,
  onAvatarUpload,
  onAvatarRemove,
  onPrefsSave,
  onNotificationPreferenceSave,
  onLocationContinue,
  onAccountUpdate,
  onFamilyInviteCreate,
  onFamilyInviteRemove,
  onChildThemeSave,
  onChildProfileCreate,
  onFamilyMemberRemove,
  onEducatorProfileSave,
  onEducatorAvailabilitySave,
  onStaffProfileSave,
  onboardingStep,
  scrollToken = 0,
}: UserSettingsTabsProps) {
  const { isMobile } = useSidebar();
  const profileBlock = profile.profile;
  const profileFullName = getProfileFullName(profileBlock);
  const prefs = profile.prefs;
  const contacts = account?.contacts;
  const email = contacts?.email ?? '';
  const preferredChannels = contacts?.preferredContactChannels ?? ['email'];
  const location = profile.location;
  const roles = account?.access?.userRoles ?? [];
  const [profileThemes, setProfileThemes] = React.useState<Record<string, ThemeKey>>({});
  const [preferredChannelSelections, setPreferredChannelSelections] =
    React.useState<string[]>(preferredChannels);
  const currentThemeKey = profileThemes[profile.ids.id] ?? profile.ui?.themeKey ?? 'teal';
  const currentThemeLabel =
    PROFILE_THEME_OPTIONS.find((option) => option.value === currentThemeKey)?.label ??
    'Accent color';
  const isGuardianOrAdmin =
    profile.kind === 'guardian' ||
    roles.some((role) => role.roleKey === 'admin' || role.roleKey === 'owner');
  const childProfile = profile.kind === 'child' ? profile : null;
  const educatorProfile = profile.kind === 'educator' ? profile : null;
  const staffProfile = profile.kind === 'staff' ? profile : null;
  const isAccountPhoneOnboarding = onboardingStep === 'account-phone';
  const isProfileOnboarding = onboardingStep === 'profile';
  const isPreferencesTimezoneOnboarding = onboardingStep === 'preferences-timezone';
  const isLocationOnboarding = onboardingStep === 'location';
  const isFamilyOnboarding = onboardingStep === 'family';
  const isStudentProfileOnboarding = onboardingStep === 'student-profile';
  const isEducatorProfileOnboarding = onboardingStep === 'educator-profile';
  const isEducatorAvailabilityOnboarding = onboardingStep === 'educator-availability';
  const isStaffOnboarding = onboardingStep === 'staff-profile';
  const onboardingGuidance = onboardingStep
    ? ONBOARDING_SECTION_CONFIG[onboardingStep]
    : null;
  const accountGuidance =
    onboardingGuidance?.tab === 'account' ? onboardingGuidance : null;
  const profileGuidance =
    onboardingGuidance?.tab === 'profile' ? onboardingGuidance : null;
  const preferencesGuidance =
    onboardingGuidance?.tab === 'preferences' ? onboardingGuidance : null;
  const locationGuidance =
    onboardingGuidance?.tab === 'location' ? onboardingGuidance : null;
  const accountSectionKey = accountGuidance?.sectionKey as AccountSectionKey | undefined;
  const preferencesSectionKey = preferencesGuidance?.sectionKey as
    | PreferencesSectionKey
    | undefined;
  const togglePreferredChannel = React.useCallback(
    (channel: string, enabled: boolean) => {
      const nextChannels = enabled
        ? preferredChannelSelections.includes(channel)
          ? preferredChannelSelections
          : [...preferredChannelSelections, channel]
        : preferredChannelSelections.filter((item) => item !== channel);

      setPreferredChannelSelections(nextChannels);
      if (account?.contacts && onAccountUpdate) {
        const accountId = account.ids.id;
        const orgId = account.ids.orgId;
        void onAccountUpdate({
          accountId,
          orgId,
          preferredContactChannels: nextChannels,
        });
      }
    },
    [account, onAccountUpdate, preferredChannelSelections],
  );
  const [notificationChannels, setNotificationChannels] = React.useState<
    Record<string, string[]>
  >(() => {
    if (!prefs.notificationDefaults) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(prefs.notificationDefaults).map(([key, value]) => [
        key,
        value?.channels ?? [],
      ]),
    );
  });
  const guardianChildren: ChildProfileVM[] =
    profile.kind === 'guardian' ? (profile.children?.items ?? []) : [];
  const familyMembers = React.useMemo(() => {
    const members: Array<{
      id: string;
      profileId: string;
      orgId: string;
      name: string;
      firstName?: string | null;
      lastName?: string | null;
      bio?: string | null;
      email?: string;
      avatar?: UserProfileVM['profile']['avatar'] | null;
      roleLabel: string;
      canRemove: boolean;
      isChild?: boolean;
      themeKey: ThemeKey;
      hasAuthAccount?: boolean;
      accountId?: string;
    }> = [];

    members.push({
      id: profile.ids.id,
      profileId: profile.ids.id,
      orgId: profile.ids.orgId,
      name: profileFullName,
      firstName: profileBlock.firstName ?? undefined,
      lastName: profileBlock.lastName ?? undefined,
      bio: profileBlock.bio ?? undefined,
      email: contacts?.email ?? undefined,
      avatar: profileBlock.avatar,
      roleLabel: 'Myself',
      canRemove: false,
      isChild: false,
      themeKey: profile.ui?.themeKey ?? 'teal',
      accountId: profile.ids.accountId,
    });

    guardianChildren.forEach((childProfile) => {
      members.push({
        id: childProfile.ids.id,
        profileId: childProfile.ids.id,
        orgId: childProfile.ids.orgId,
        name: formatChildName(
          childProfile.profile.firstName,
          childProfile.profile.lastName,
          getProfileDisplayName(childProfile.profile, 'Child'),
        ),
        firstName: childProfile.profile.firstName ?? undefined,
        lastName: childProfile.profile.lastName ?? undefined,
        bio: childProfile.profile.bio ?? undefined,
        email: childProfile.accountEmail ?? undefined,
        avatar: childProfile.profile.avatar ?? null,
        roleLabel: 'Supervised child',
        canRemove: true,
        isChild: true,
        themeKey: childProfile.ui?.themeKey ?? 'teal',
        hasAuthAccount: Boolean(childProfile.accountAuthUserId),
        accountId: childProfile.ids.accountId,
      });
    });

    return dedupeChildMembersByEmail(members);
  }, [
    profile.ids.id,
    profileBlock.avatar,
    profileFullName,
    contacts?.email,
    profile.ui?.themeKey,
    guardianChildren,
  ]);
  const filteredFamilyInvites = React.useMemo(() => {
    if (profile.kind !== 'guardian') {
      return [];
    }
    return filterInvitesWithExistingAccounts(profile.familyInvites ?? [], familyMembers);
  }, [familyMembers, profile]);
  const availableTabs = SETTINGS_TABS.filter((tab) => {
    if (tab.value === 'student-profile') {
      return profile.kind === 'child';
    }
    if (tab.value === 'family') {
      return profile.kind === 'guardian';
    }
    if (tab.value === 'educator-profile') {
      return profile.kind === 'educator';
    }
    if (tab.value === 'educator-availability') {
      return profile.kind === 'educator';
    }
    if (tab.value === 'staff-profile') {
      return profile.kind === 'staff';
    }
    return true;
  });

  const handleLogoutClick = React.useCallback(() => {
    if (!onLogout) {
      return;
    }
    void onLogout();
  }, [onLogout]);

  return (
    <Tabs
      value={value}
      onValueChange={(next: string) => onValueChange(next as UserSettingsTab)}
      orientation={isMobile ? 'horizontal' : 'vertical'}
      className="w-full h-full"
    >
      <div
        className={cn(
          isMobile
            ? 'flex min-h-0 flex-1 flex-col gap-4 w-full'
            : 'grid min-h-0 h-full w-full grid-cols-[180px_1fr] gap-6',
        )}
      >
        <div className="flex flex-col">
          <TabsList
            variant="line"
            className={cn(
              'bg-transparent p-0',
              isMobile
                ? 'w-full flex-nowrap justify-start gap-2 overflow-x-auto sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70'
                : 'w-full flex-col items-stretch',
            )}
          >
            {availableTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={USER_SETTINGS_TAB_TRIGGER_CLASS}
                >
                  <Icon className="size-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {Boolean(onboardingStep) ? (
            <>
              <Separator className="my-2" />
              <div className="px-2">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-foreground transition hover:bg-muted"
                  onClick={handleLogoutClick}
                  disabled={!onLogout}
                >
                  <LogOut className="size-4 flex-none" />
                  Log out
                </button>
              </div>
            </>
          ) : null}
        </div>

        <ScrollArea className={cn('min-h-0 flex-1 w-full min-w-0', isMobile && 'flex-1')}>
          <TabsContent value="profile" className="mt-0 space-y-8 w-full px-1">
            <ProfileTab
              profile={profile}
              profileBlock={profileBlock}
              staffProfile={staffProfile}
              scrollToRequired={value === 'profile' || isProfileOnboarding}
              scrollToken={scrollToken}
              showProfileTaskToast={isProfileOnboarding}
              expandProfileDetails={Boolean(profileGuidance)}
              onProfileSave={onProfileSave}
              onAvatarUpload={onAvatarUpload}
              onAvatarRemove={onAvatarRemove}
            />
          </TabsContent>
          {staffProfile ? (
            <TabsContent value="staff-profile" className="mt-0 space-y-8 w-full px-1">
              <StaffProfileTab
                staffProfile={staffProfile}
                isStaffOnboarding={isStaffOnboarding}
                onSave={onStaffProfileSave}
              />
            </TabsContent>
          ) : null}
          {educatorProfile ? (
            <TabsContent value="educator-profile" className="mt-0 space-y-8 w-full px-1">
              <EducatorProfileTab
                educatorProfile={educatorProfile}
                fallbackCountryCode={profile.location?.countryCode}
                onSave={onEducatorProfileSave}
                isEducatorOnboarding={isEducatorProfileOnboarding}
              />
            </TabsContent>
          ) : null}
          {educatorProfile ? (
            <TabsContent
              value="educator-availability"
              className="mt-0 space-y-8 w-full px-1"
            >
            <EducatorAvailabilityTab
              initialClassTypes={educatorProfile.availability?.classTypes ?? undefined}
              initialWeeklyCommitment={
                educatorProfile.availability?.weeklyCommitment ?? undefined
              }
              initialAvailability={
                educatorProfile.availability?.availability ?? undefined
              }
              onSave={onEducatorAvailabilitySave}
              isEducatorAvailabilityOnboarding={isEducatorAvailabilityOnboarding}
            />
            </TabsContent>
          ) : null}
          {childProfile ? (
            <TabsContent value="student-profile" className="mt-0 space-y-8 w-full px-1">
              <StudentProfileTab
                childProfile={childProfile}
                fallbackCountryCode={profile.location?.countryCode}
                onChildProfileSave={onChildProfileSave}
                onboardingRequired={isStudentProfileOnboarding}
              />
            </TabsContent>
          ) : null}

          <TabsContent value="account" className="mt-0 space-y-8 w-full px-1">
            <AccountTab
              contacts={contacts}
              email={email}
              preferredChannelSelections={preferredChannelSelections}
              togglePreferredChannel={togglePreferredChannel}
              scrollToRequired={value === 'account' || isAccountPhoneOnboarding}
              scrollToken={scrollToken}
              accountId={account?.ids.id}
              orgId={account?.ids.orgId}
              onAccountUpdate={onAccountUpdate}
              onboardingRequiredSection={accountSectionKey}
              lockSections={Boolean(accountGuidance)}
              isChildAccount={profile.kind === 'child'}
            />
          </TabsContent>

          <TabsContent value="preferences" className="mt-0 space-y-8 w-full px-1">
            <PreferencesTab
              currentThemeKey={currentThemeKey}
              currentThemeLabel={currentThemeLabel}
              profileId={profile.ids.id}
              orgId={profile.ids.orgId}
              prefs={prefs}
              profileThemeOptions={PROFILE_THEME_OPTIONS}
              setProfileThemes={setProfileThemes}
              scrollToRequired={
                value === 'preferences' || isPreferencesTimezoneOnboarding
              }
              scrollToken={scrollToken}
              onPrefsSave={onPrefsSave}
              onboardingRequiredSection={preferencesSectionKey}
              lockSections={Boolean(preferencesGuidance)}
            />
          </TabsContent>

          <TabsContent value="location" className="mt-0 space-y-8 w-full px-1">
            <LocationTab
              location={location}
              scrollToRequired={value === 'location' || isLocationOnboarding}
              scrollToken={scrollToken}
              onLocationContinue={onLocationContinue}
              expandLocation={Boolean(locationGuidance)}
            />
          </TabsContent>

          <TabsContent value="family" className="mt-0 space-y-8 w-full px-1">
            <FamilyTab
              familyMembers={familyMembers}
              profileThemes={profileThemes}
              profileThemeOptions={PROFILE_THEME_OPTIONS}
              setProfileThemes={setProfileThemes}
              showOnboardingToast={isFamilyOnboarding}
              initialInvites={filteredFamilyInvites}
              onInviteCreate={onFamilyInviteCreate}
              onInviteRemove={onFamilyInviteRemove}
              onProfileSave={onProfileSave}
              onChildThemeSave={onChildThemeSave}
              timezone={prefs.timezone ?? undefined}
              location={profile.location ?? null}
              orgId={profile.ids.orgId}
              guardianAccountId={profile.ids.accountId}
              guardianEmail={contacts?.email ?? null}
              onChildProfileCreate={onChildProfileCreate}
              onFamilyMemberRemove={onFamilyMemberRemove}
              guardianThemeKey={profile.ui?.themeKey ?? 'teal'}
            />
          </TabsContent>

          <TabsContent value="notifications" className="mt-0 space-y-8 w-full px-1">
            <NotificationsTab
              isGuardianOrAdmin={isGuardianOrAdmin}
              notificationChannels={notificationChannels}
              onNotificationChannelsChange={setNotificationChannels}
              profileId={profile.ids.id}
              orgId={profile.ids.orgId}
              onNotificationPreferenceSave={onNotificationPreferenceSave}
            />
          </TabsContent>
        </ScrollArea>
      </div>
    </Tabs>
  );
}
