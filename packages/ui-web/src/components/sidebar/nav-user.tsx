'use client';

import * as React from 'react';
import {
  BadgeCheck,
  Bell,
  CalendarDays,
  ChevronsUpDown,
  Clock3,
  Lightbulb,
  LogOut,
  Smile,
  SlidersHorizontal,
  User,
  Users,
} from 'lucide-react';

import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';
import type {
  ChildProfileSaveInput,
  ChildProfileVM,
  EducatorAvailabilityInput,
  EducatorProfileSaveInput,
  FamilyLinkInviteRole,
  FamilyLinkInviteVM,
  StaffProfileSaveInput,
  ThemeKey,
  UserOnboardingStatusVM,
  UserAccountVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@iconicedu/ui-web/ui/dropdown-menu';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@iconicedu/ui-web/ui/dialog';
import { Input } from '@iconicedu/ui-web/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web/ui/select';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@iconicedu/ui-web/ui/sidebar';
import {
  ONBOARDING_STEP_TO_TAB,
  UserSettingsDialog,
  type UserSettingsTab,
} from '@iconicedu/ui-web/components/sidebar/user-settings-dialog';
import type {
  ProfileAvatarInput,
  ProfileAvatarRemoveInput,
  ProfileSaveInput,
} from '@iconicedu/ui-web/components/sidebar/user-settings/profile-tab';
import {
  computeStatusExpiresAt,
  STATUS_CLEAR_AFTER_OPTIONS,
  STATUS_EMOJI_OPTIONS,
  STATUS_PRESETS,
  type StatusClearAfterOption,
} from '@iconicedu/ui-web/components/sidebar/nav-user-status.utils';

export function NavUser({
  profile,
  account,
  onLogout,
  onOnboardingComplete,
  onboardingStatus,
  onProfileSave,
  onChildProfileSave,
  onAccountUpdate,
  onPrefsSave,
  onLocationSave,
  onAvatarUpload,
  onAvatarRemove,
  onNotificationPreferenceSave,
  onFamilyInviteCreate,
  onFamilyInviteRemove,
  onChildThemeSave,
  onChildProfileCreate,
  onFamilyMemberRemove,
  onEducatorProfileSave,
  onEducatorAvailabilitySave,
  onStaffProfileSave,
  onStatusOverrideSave,
}: {
  profile: UserProfileVM;
  account?: UserAccountVM | null;
  onLogout?: () => Promise<void> | void;
  onboardingStatus?: UserOnboardingStatusVM | null;
  onProfileSave?: (input: ProfileSaveInput) => Promise<void> | void;
  onChildProfileSave?: (input: ChildProfileSaveInput) => Promise<void> | void;
  onAccountUpdate?: (input: {
    accountId: string;
    orgId: string;
    phoneE164?: string | null;
    whatsappE164?: string | null;
    phoneVerified?: boolean;
    whatsappVerified?: boolean;
    preferredContactChannels?: string[] | null;
  }) => Promise<void> | void;
  onPrefsSave?: (input: {
    profileId: string;
    orgId: string;
    timezone?: string;
    locale?: string | null;
    languagesSpoken?: string[] | null;
    themeKey?: string | null;
  }) => Promise<void> | void;
  onLocationSave?: (input: {
    profileId: string;
    orgId: string;
    city: string;
    region: string;
    postalCode: string;
    countryCode?: string | null;
    countryName?: string | null;
  }) => Promise<void> | void;
  onAvatarUpload?: (input: ProfileAvatarInput) => Promise<void> | void;
  onAvatarRemove?: (input: ProfileAvatarRemoveInput) => Promise<void> | void;
  onNotificationPreferenceSave?: (input: {
    profileId: string;
    orgId: string;
    prefKey: string;
    channels: string[];
    muted?: boolean | null;
  }) => Promise<void> | void;
  onChildThemeSave?: (input: {
    profileId: string;
    orgId: string;
    themeKey: ThemeKey;
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
  }) => Promise<ChildProfileVM> | void;
  onFamilyMemberRemove?: (input: { childAccountId: string }) => Promise<void> | void;
  onEducatorProfileSave?: (input: EducatorProfileSaveInput) => Promise<void> | void;
  onEducatorAvailabilitySave?: (input: EducatorAvailabilityInput) => Promise<void> | void;
  onStaffProfileSave?: (input: StaffProfileSaveInput) => Promise<void> | void;
  onStatusOverrideSave?: (input: {
    status?: 'online' | 'away' | 'offline';
    stateText?: string | null;
    stateEmoji?: string | null;
    stateExpiresAt?: string | null;
    clearState?: boolean;
  }) => Promise<void> | void;
  onOnboardingComplete?: () => void;
}) {
  const { isMobile } = useSidebar();
  const profileDisplayName = getProfileDisplayName(profile.profile);
  const secondaryLabel =
    account?.contacts.email ?? profile.prefs.locale ?? profile.prefs.timezone ?? '';
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsTab, setSettingsTab] = React.useState<UserSettingsTab>('account');
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false);
  const [statusText, setStatusText] = React.useState('');
  const [statusEmoji, setStatusEmoji] = React.useState('');
  const [statusClearAfter, setStatusClearAfter] = React.useState<StatusClearAfterOption>('never');
  const [statusSaveError, setStatusSaveError] = React.useState<string | null>(null);
  const [isSavingStatus, setIsSavingStatus] = React.useState(false);

  const openSettings = React.useCallback((tab: UserSettingsTab) => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  const handleLogout = React.useCallback(async () => {
    if (!onLogout) {
      return;
    }
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  }, [onLogout]);

  React.useEffect(() => {
    const step =
      onboardingStatus?.currentStep as keyof typeof ONBOARDING_STEP_TO_TAB | undefined;
    if (!step) {
      return;
    }
    const targetTab = ONBOARDING_STEP_TO_TAB[step];
    if (targetTab) {
      setSettingsTab(targetTab);
    }
    setSettingsOpen(true);
  }, [onboardingStatus]);

  React.useEffect(() => {
    if (!statusDialogOpen) {
      return;
    }
    setStatusText(profile.presence?.state?.text?.trim() ?? '');
    setStatusEmoji(profile.presence?.state?.emoji?.trim() ?? '');
    setStatusClearAfter(profile.presence?.state?.expiresAt ? 'today' : 'never');
    setStatusSaveError(null);
  }, [statusDialogOpen, profile.presence?.state?.emoji, profile.presence?.state?.expiresAt, profile.presence?.state?.text]);

  const openStatusDialog = React.useCallback(() => {
    setStatusDialogOpen(true);
  }, []);

  const handleSaveStatus = React.useCallback(async () => {
    if (!onStatusOverrideSave) {
      setStatusDialogOpen(false);
      return;
    }
    const nextText = statusText.trim();
    const nextEmoji = statusEmoji.trim();
    const hasStatus = !!nextText || !!nextEmoji;
    setIsSavingStatus(true);
    setStatusSaveError(null);
    try {
      if (!hasStatus) {
        await onStatusOverrideSave({ clearState: true });
      } else {
        await onStatusOverrideSave({
          stateText: nextText || null,
          stateEmoji: nextEmoji || null,
          stateExpiresAt: computeStatusExpiresAt(statusClearAfter),
        });
      }
      setStatusDialogOpen(false);
    } catch (error) {
      setStatusSaveError(error instanceof Error ? error.message : 'Unable to save status');
    } finally {
      setIsSavingStatus(false);
    }
  }, [onStatusOverrideSave, statusClearAfter, statusEmoji, statusText]);

  const handleClearStatus = React.useCallback(async () => {
    if (!onStatusOverrideSave) {
      setStatusDialogOpen(false);
      return;
    }
    setIsSavingStatus(true);
    setStatusSaveError(null);
    try {
      await onStatusOverrideSave({ clearState: true });
      setStatusDialogOpen(false);
    } catch (error) {
      setStatusSaveError(error instanceof Error ? error.message : 'Unable to clear status');
    } finally {
      setIsSavingStatus(false);
    }
  }, [onStatusOverrideSave]);

  const currentStatusSummary = [
    profile.presence?.state?.emoji?.trim(),
    profile.presence?.state?.text?.trim(),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <AvatarWithStatus
                name={profileDisplayName}
                avatar={profile.profile.avatar}
                presence={profile.presence}
                themeKey={profile.ui?.themeKey}
                sizeClassName="h-8 w-8 rounded-full"
                fallbackClassName="rounded-full"
                initialsLength={2}
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {profileDisplayName}
                </span>
                {secondaryLabel ? (
                  <span className="truncate text-xs">{secondaryLabel}</span>
                ) : null}
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-xl"
            side={'bottom'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <AvatarWithStatus
                  name={profileDisplayName}
                  avatar={profile.profile.avatar}
                  presence={profile.presence}
                  themeKey={profile.ui?.themeKey}
                  sizeClassName="h-8 w-8 rounded-full"
                  fallbackClassName="rounded-full"
                  initialsLength={2}
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {profileDisplayName}
                  </span>
                  {secondaryLabel ? (
                    <span className="truncate text-xs">{secondaryLabel}</span>
                  ) : null}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={openStatusDialog}>
                <Smile />
                {currentStatusSummary || 'Set a status'}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => openSettings('account')}>
                <BadgeCheck />
                Account
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => openSettings('profile')}>
                <User />
                Profile
              </DropdownMenuItem>
              {profile.kind === 'educator' ? (
                <DropdownMenuItem onSelect={() => openSettings('educator-profile')}>
                  <Lightbulb />
                  Educator profile
                </DropdownMenuItem>
              ) : null}
              {profile.kind === 'educator' ? (
                <DropdownMenuItem onSelect={() => openSettings('educator-availability')}>
                  <CalendarDays />
                  Availability
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => openSettings('preferences')}>
                <SlidersHorizontal />
                Preferences
              </DropdownMenuItem>
              {profile.kind === 'guardian' ? (
                <DropdownMenuItem onSelect={() => openSettings('family')}>
                  <Users />
                  Family
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => openSettings('notifications')}>
                <Bell />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout} disabled={isLoggingOut}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  <UserSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        activeTab={settingsTab}
        onTabChange={setSettingsTab}
        profile={profile}
        account={account}
        onLogout={onLogout}
        onProfileSave={onProfileSave}
        onChildProfileSave={onChildProfileSave}
        onAccountUpdate={onAccountUpdate}
        onPrefsSave={onPrefsSave}
        onChildThemeSave={onChildThemeSave}
        onLocationSave={onLocationSave}
        onAvatarUpload={onAvatarUpload}
        onAvatarRemove={onAvatarRemove}
        onNotificationPreferenceSave={onNotificationPreferenceSave}
        onFamilyInviteCreate={onFamilyInviteCreate}
        onFamilyInviteRemove={onFamilyInviteRemove}
        onChildProfileCreate={onChildProfileCreate}
        onFamilyMemberRemove={onFamilyMemberRemove}
        onEducatorProfileSave={onEducatorProfileSave}
        onEducatorAvailabilitySave={onEducatorAvailabilitySave}
        onStaffProfileSave={onStaffProfileSave}
        onboardingStep={onboardingStatus?.currentStep ?? null}
        onOnboardingComplete={onOnboardingComplete}
      />
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Set a status</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Select
                value={statusEmoji || '__none__'}
                onValueChange={(value) => setStatusEmoji(value === '__none__' ? '' : value)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="Emoji" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {STATUS_EMOJI_OPTIONS.map((emoji) => (
                    <SelectItem key={emoji} value={emoji}>
                      {emoji}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="What's your status?"
                value={statusText}
                maxLength={80}
                onChange={(event) => setStatusText(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              {STATUS_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="hover:bg-accent w-full rounded-md px-2 py-1.5 text-left text-sm"
                  onClick={() => {
                    setStatusEmoji(preset.emoji);
                    setStatusText(preset.text);
                    setStatusClearAfter(preset.clearAfter);
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <span>{preset.emoji}</span>
                    <span>{preset.label}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                <Clock3 className="size-3" />
                Clear after
              </p>
              <Select
                value={statusClearAfter}
                onValueChange={(value) => setStatusClearAfter(value as StatusClearAfterOption)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_CLEAR_AFTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {statusSaveError ? (
              <p className="text-destructive text-xs">{statusSaveError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={handleClearStatus} disabled={isSavingStatus}>
              Clear
            </Button>
            <Button onClick={handleSaveStatus} disabled={isSavingStatus}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
