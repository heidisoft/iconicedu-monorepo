import * as React from 'react';
import { ArrowRight, Info, User, X } from 'lucide-react';

import type {
  EducatorProfileVM,
  GradeLevelOption,
  StaffProfileVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import { Avatar, AvatarFallback, AvatarImage } from '@iconicedu/ui-web/ui/avatar';
import { BorderBeam } from '@iconicedu/ui-web/ui/border-beam';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@iconicedu/ui-web/ui/alert-dialog';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Input } from '@iconicedu/ui-web/ui/input';
import { Label } from '@iconicedu/ui-web/ui/label';
import { Separator } from '@iconicedu/ui-web/ui/separator';
import { Textarea } from '@iconicedu/ui-web/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@iconicedu/ui-web/ui/tooltip';
import { UserSettingsTabSection } from '@iconicedu/ui-web/components/sidebar/user-settings/components/user-settings-tab-section';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web/ui/select';
import { ChevronIcon } from '@iconicedu/ui-web/components/sidebar/user-settings/components/chevron-icon';
import { useSequentialHighlight } from '@iconicedu/ui-web/components/sidebar/user-settings/hooks/use-sequential-highlight';
import { resolveProfileDisplayNameForSave } from '@iconicedu/ui-web/components/sidebar/user-settings/profile-tab.utils';
import { getProfileFullName } from '@iconicedu/ui-web/lib/display-name';

type ProfileTabProps = {
  profile: UserProfileVM;
  profileBlock: UserProfileVM['profile'];
  staffProfile: StaffProfileVM | null;
  staffSpecialties?: string[];
  expandProfileDetails?: boolean;
  scrollToRequired?: boolean;
  scrollToken?: number;
  onPrimaryActionComplete?: () => void;
  onProfileSave?: (input: ProfileSaveInput) => Promise<void> | void;
  onAvatarUpload?: (input: ProfileAvatarInput) => Promise<void> | void;
  onAvatarRemove?: (input: ProfileAvatarRemoveInput) => Promise<void> | void;
  showProfileTaskToast?: boolean;
};

export type ProfileSaveInput = {
  profileId: string;
  orgId: string;
  displayName: string | null;
  firstName: string;
  lastName: string;
  bio?: string | null;
};

export type ProfileAvatarInput = {
  profileId: string;
  orgId: string;
  file: File;
};

export type ProfileAvatarRemoveInput = {
  profileId: string;
  orgId: string;
};

export function ProfileTab({
  profile,
  profileBlock,
  staffProfile,
  staffSpecialties = [],
  expandProfileDetails = false,
  scrollToRequired = false,
  scrollToken = 0,
  onPrimaryActionComplete,
  onProfileSave,
  onAvatarUpload,
  onAvatarRemove,
  showProfileTaskToast,
}: ProfileTabProps) {
  const [profileDetailsOpen, setProfileDetailsOpen] =
    React.useState(expandProfileDetails);
  const shouldHighlightRequired = expandProfileDetails;
  const [firstNameValue, setFirstNameValue] = React.useState(
    profileBlock.firstName ?? '',
  );
  const [lastNameValue, setLastNameValue] = React.useState(profileBlock.lastName ?? '');
  const sequentialProfileHighlight = useSequentialHighlight<'first' | 'last'>({
    order: ['first', 'last'],
    satisfied: {
      first: Boolean(firstNameValue.trim()),
      last: Boolean(lastNameValue.trim()),
    },
    enabled: shouldHighlightRequired,
  });
  const showFirstNameBeam = sequentialProfileHighlight.isActive('first');
  const showLastNameBeam = sequentialProfileHighlight.isActive('last');
  const [isFirstFocused, setIsFirstFocused] = React.useState(false);
  const [isLastFocused, setIsLastFocused] = React.useState(false);
  const showToast = showProfileTaskToast ?? expandProfileDetails;
  const [isProfileToastDismissed, setIsProfileToastDismissed] = React.useState(false);
  const [displayNameValue, setDisplayNameValue] = React.useState(
    profileBlock.displayName ?? '',
  );
  const [bioValue, setBioValue] = React.useState(profileBlock.bio ?? '');
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [showRequiredErrors, setShowRequiredErrors] = React.useState(false);
  const [showProfileActionBeam, setShowProfileActionBeam] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const [avatarUploadError, setAvatarUploadError] = React.useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = React.useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = React.useState(false);
  const [avatarRemoved, setAvatarRemoved] = React.useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement | null>(null);
  const toggleSelection = React.useCallback(
    (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
      setter((prev) =>
        prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
      );
    },
    [],
  );
  const firstNameRef = React.useRef<HTMLInputElement | null>(null);
  const lastNameRef = React.useRef<HTMLInputElement | null>(null);
  const requiredProfileFieldsMissing = !firstNameValue.trim() || !lastNameValue.trim();
  const isPrimaryDisabled = shouldHighlightRequired && requiredProfileFieldsMissing;
  const firstNameHintMessage =
    profile.kind === 'educator'
      ? 'Enter your own first and last name so families know who you are (not your child’s).'
      : undefined;

  React.useEffect(() => {
    if (expandProfileDetails) {
      setProfileDetailsOpen(true);
    }
  }, [expandProfileDetails]);

  React.useEffect(() => {
    if (!shouldHighlightRequired) {
      setShowProfileActionBeam(false);
      return;
    }

    const isReady = Boolean(firstNameValue.trim() && lastNameValue.trim());
    setShowProfileActionBeam(Boolean(isReady && !isSaving));
  }, [firstNameValue, lastNameValue, shouldHighlightRequired, isSaving]);

  const hasFocusedProfileDetailRef = React.useRef(false);

  React.useEffect(() => {
    if (!expandProfileDetails) {
      hasFocusedProfileDetailRef.current = false;
      return;
    }
    if (hasFocusedProfileDetailRef.current) {
      return;
    }
    hasFocusedProfileDetailRef.current = true;
    const target = !firstNameValue.trim() ? firstNameRef.current : lastNameRef.current;
    if (target) {
      requestAnimationFrame(() => target.focus());
    }
  }, [expandProfileDetails, firstNameValue]);

  React.useEffect(() => {
    if (!scrollToRequired) {
      return;
    }
    const target = !firstNameValue.trim()
      ? firstNameRef.current
      : !lastNameValue.trim()
        ? lastNameRef.current
        : firstNameRef.current;
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [firstNameValue, lastNameValue, scrollToRequired, scrollToken]);

  React.useEffect(() => {
    setFirstNameValue(profileBlock.firstName ?? '');
    setLastNameValue(profileBlock.lastName ?? '');
    setDisplayNameValue(profileBlock.displayName ?? '');
    setBioValue(profileBlock.bio ?? '');
    setAvatarPreview(null);
    setAvatarRemoved(false);
  }, [
    profileBlock.firstName,
    profileBlock.lastName,
    profileBlock.displayName,
    profileBlock.bio,
  ]);

  const handleProfileSave = React.useCallback(
    async (afterSave?: () => void) => {
      setSaveError(null);

      const trimmedFirstName = firstNameValue.trim();
      const trimmedLastName = lastNameValue.trim();
      const trimmedDisplayName = displayNameValue.trim();
      const trimmedBio = bioValue.trim();

      if (!trimmedFirstName || !trimmedLastName) {
        setShowRequiredErrors(true);
        setSaveError('First and last name are required.');
        return;
      }

      setShowRequiredErrors(false);

      if (!onProfileSave) {
        afterSave?.();
        return;
      }

      setIsSaving(true);
      try {
        const resolvedDisplayName = resolveProfileDisplayNameForSave({
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          displayName: trimmedDisplayName,
          isOnboarding: expandProfileDetails,
        });

        await onProfileSave({
          profileId: profile.ids.id,
          orgId: profile.ids.orgId,
          displayName: resolvedDisplayName,
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          bio: trimmedBio || null,
        });
        afterSave?.();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to save profile.';
        setSaveError(message);
        throw error;
      } finally {
        setIsSaving(false);
        setShowProfileActionBeam(false);
      }
    },
    [
      bioValue,
      displayNameValue,
      firstNameValue,
      lastNameValue,
      onProfileSave,
      profile.ids.id,
      profile.ids.orgId,
    ],
  );

  React.useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  React.useEffect(() => {
    if (profileBlock.avatar.url) {
      setAvatarRemoved(false);
    }
  }, [profileBlock.avatar.url]);

  const handleAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setAvatarUploadError(null);

      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }

      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
      setAvatarRemoved(false);

      if (!onAvatarUpload) {
        return;
      }

      setIsUploadingAvatar(true);
      try {
        await onAvatarUpload({
          profileId: profile.ids.id,
          orgId: profile.ids.orgId,
          file,
        });
      } catch (error) {
        setAvatarUploadError(
          error instanceof Error ? error.message : 'Unable to upload photo.',
        );
      } finally {
        setIsUploadingAvatar(false);
        event.target.value = '';
      }
    },
    [avatarPreview, onAvatarUpload, profile.ids.id, profile.ids.orgId],
  );

  const handleAvatarRemove = React.useCallback(async () => {
    setAvatarUploadError(null);
    setAvatarRemoved(true);
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
    }
    if (!onAvatarRemove) {
      return;
    }
    try {
      setIsRemovingAvatar(true);
      await onAvatarRemove({
        profileId: profile.ids.id,
        orgId: profile.ids.orgId,
      });
    } catch (error) {
      setAvatarUploadError(
        error instanceof Error ? error.message : 'Unable to remove avatar.',
      );
    } finally {
      setIsRemovingAvatar(false);
    }
  }, [avatarPreview, onAvatarRemove, profile.ids.id, profile.ids.orgId]);

  const handleConfirmAvatarRemove = React.useCallback(async () => {
    await handleAvatarRemove();
    setIsRemoveDialogOpen(false);
  }, [handleAvatarRemove]);

  const avatarUrl = avatarRemoved
    ? null
    : (avatarPreview ?? profileBlock.avatar.url ?? null);
  const hasAvatar = Boolean(profileBlock.avatar.url ?? avatarPreview) && !avatarRemoved;
  const fallbackName = getProfileFullName(profileBlock);
  const avatarInitials = fallbackName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 1)
    .toUpperCase();
  const avatarThemeKey = profile.ui?.themeKey ?? 'teal';

  return (
    <div className="space-y-8 w-full">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">Profile</h3>
            <p className="text-sm text-muted-foreground">
              Update your display name, profile photo, and bio.
            </p>
          </div>
        </div>
        <div className="space-y-1 w-full">
          <UserSettingsTabSection
            icon={<User className="h-5 w-5" />}
            title="Profile details"
            subtitle={getProfileFullName(profileBlock)}
            open={expandProfileDetails ? true : profileDetailsOpen}
            onOpenChange={(nextOpen) => {
              if (expandProfileDetails) return;
              setProfileDetailsOpen(nextOpen);
            }}
            showSeparator={false}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 flex items-center gap-3">
                <Avatar
                  key={`${avatarUrl ?? 'fallback'}-${avatarRemoved ? 'removed' : 'active'}`}
                  className={cn('size-12 border theme-border', `theme-${avatarThemeKey}`)}
                >
                  {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
                  <AvatarFallback className="theme-bg theme-fg font-semibold">
                    {avatarInitials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium">Profile photo</div>
                  <div className="text-xs text-muted-foreground">JPG, PNG up to 5MB.</div>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={handleAvatarClick}
                  disabled={isUploadingAvatar}
                >
                  {isUploadingAvatar ? 'Uploading...' : 'Change'}
                </Button>
                {hasAvatar ? (
                  <AlertDialog
                    open={isRemoveDialogOpen}
                    onOpenChange={setIsRemoveDialogOpen}
                  >
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" disabled={isRemovingAvatar}>
                        {isRemovingAvatar ? 'Removing...' : 'Remove'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove profile photo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will reset your avatar to the default initials.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel asChild>
                          <Button type="button" variant="outline">
                            Cancel
                          </Button>
                        </AlertDialogCancel>
                        <AlertDialogAction asChild>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={handleConfirmAvatarRemove}
                            disabled={isRemovingAvatar}
                          >
                            Remove
                          </Button>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </div>
              {avatarUploadError ? (
                <div className="sm:col-span-2 text-xs text-destructive">
                  {avatarUploadError}
                </div>
              ) : null}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="settings-display-name">Display name</Label>
                <Input
                  id="settings-display-name"
                  value={displayNameValue}
                  onChange={(event) => {
                    setDisplayNameValue(event.target.value);
                  }}
                  placeholder="Enter a display name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-first-name">
                  <div className="flex items-center gap-1">
                    <span>
                      First name <span className="text-destructive">*</span>
                    </span>
                    {firstNameHintMessage ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Onboarding hint"
                          >
                            <Info className="size-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs text-muted-foreground">
                          {firstNameHintMessage}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                </Label>
                <div className="relative rounded-full">
                  {showFirstNameBeam && !firstNameValue.trim() ? (
                    <BorderBeam
                      size={52}
                      initialOffset={8}
                      borderWidth={2}
                      className="from-transparent via-amber-700 to-transparent"
                      transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                    />
                  ) : null}
                  <Input
                    id="settings-first-name"
                    ref={firstNameRef}
                    value={firstNameValue}
                    required
                    className="relative"
                    placeholder="Enter your first name"
                    onFocus={() => setIsFirstFocused(true)}
                    onBlur={() => setIsFirstFocused(false)}
                    onChange={(event) => {
                      setFirstNameValue(event.target.value);
                      if (showRequiredErrors && event.target.value.trim()) {
                        setShowRequiredErrors(false);
                      }
                    }}
                  />
                </div>
                {showRequiredErrors && !firstNameValue.trim() ? (
                  <p className="text-xs text-destructive">First name is required.</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-last-name">
                  Last name <span className="text-destructive">*</span>
                </Label>
                <div className="relative rounded-full">
                  {showLastNameBeam && !lastNameValue.trim() ? (
                    <BorderBeam
                      size={52}
                      initialOffset={8}
                      borderWidth={2}
                      className="from-transparent via-amber-700 to-transparent"
                      transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                    />
                  ) : null}
                  <Input
                    id="settings-last-name"
                    ref={lastNameRef}
                    value={lastNameValue}
                    required
                    className="relative"
                    placeholder="Enter your last name"
                    onFocus={() => setIsLastFocused(true)}
                    onBlur={() => {
                      setIsLastFocused(false);
                    }}
                    onChange={(event) => {
                      setLastNameValue(event.target.value);
                      if (showRequiredErrors && event.target.value.trim()) {
                        setShowRequiredErrors(false);
                      }
                    }}
                  />
                </div>
                {showRequiredErrors && !lastNameValue.trim() ? (
                  <p className="text-xs text-destructive">Last name is required.</p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="settings-bio">About me</Label>
                  <span className="text-xs text-muted-foreground">Optional</span>
                </div>
                <Textarea
                  id="settings-bio"
                  value={bioValue}
                  onChange={(event) => setBioValue(event.target.value)}
                  rows={4}
                  placeholder="Share a short bio to help others know you."
                />
              </div>
              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {saveError ? (
                    <span className="text-destructive">{saveError}</span>
                  ) : null}
                </div>
                <div className="relative inline-flex rounded-full">
                  {showProfileActionBeam ? (
                    <BorderBeam
                      size={26}
                      initialOffset={8}
                      borderWidth={2}
                      className="from-transparent via-amber-700 to-transparent"
                      transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                    />
                  ) : null}
                  <Button
                    size="sm"
                    className="relative"
                    onClick={() => handleProfileSave(onPrimaryActionComplete)}
                    disabled={isSaving || isPrimaryDisabled}
                  >
                    {isSaving ? (
                      'Saving...'
                    ) : (
                      <span className="inline-flex items-center gap-2">Save</span>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </UserSettingsTabSection>
        </div>
      </div>
    </div>
  );
}
