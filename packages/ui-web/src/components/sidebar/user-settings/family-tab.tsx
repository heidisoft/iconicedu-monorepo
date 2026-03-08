'use client';

import * as React from 'react';
import { Plus, ShieldAlert, UserPlus } from 'lucide-react';

import type { ChildProfileVM, ThemeKey, UserProfileVM } from '@iconicedu/shared-types';
import { normalizeCountryCode, optionsForCountry } from '@iconicedu/shared-types';
import { Avatar, AvatarFallback, AvatarImage } from '@iconicedu/ui-web/ui/avatar';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { BorderBeam } from '@iconicedu/ui-web/ui/border-beam';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@iconicedu/ui-web/ui/dialog';
import { UserSettingsTabSection } from '@iconicedu/ui-web/components/sidebar/user-settings/components/user-settings-tab-section';
import { useSequentialHighlight } from '@iconicedu/ui-web/components/sidebar/user-settings/hooks/use-sequential-highlight';
import { Input } from '@iconicedu/ui-web/ui/input';
import { Label } from '@iconicedu/ui-web/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web/ui/select';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@iconicedu/ui-web/ui/tooltip';

import type { FamilyLinkInviteRole, FamilyLinkInviteVM } from '@iconicedu/shared-types';
import type { ProfileSaveInput } from '@iconicedu/ui-web/components/sidebar/user-settings/profile-tab';
import { BIRTH_YEAR_OPTIONS } from '@iconicedu/ui-web/components/sidebar/user-settings/student-profile-tab';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@iconicedu/ui-web/ui/alert-dialog';

type FamilyMemberItem = {
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
};

type EditableChildData = Record<string, { displayName: string; themeKey: ThemeKey }>;

type ChildRegistrationField = 'firstName' | 'lastName' | 'grade' | 'birthYear';
const CHILD_REGISTRATION_FIELDS: ChildRegistrationField[] = [
  'firstName',
  'lastName',
  'grade',
  'birthYear',
];

type FamilyTabProps = {
  orgId: string;
  guardianAccountId: string;
  timezone?: string | null;
  location?: {
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    countryCode?: string | null;
    countryName?: string | null;
  } | null;
  familyMembers: FamilyMemberItem[];
  profileThemes: Record<string, ThemeKey>;
  profileThemeOptions: Array<{ value: string; label: string }>;
  setProfileThemes: React.Dispatch<React.SetStateAction<Record<string, ThemeKey>>>;
  showOnboardingToast?: boolean;
  initialInvites?: FamilyLinkInviteVM[];
  onInviteCreate?: (input: {
    invitedRole: FamilyLinkInviteRole;
    invitedEmail: string;
    targetAccountId?: string;
  }) => Promise<FamilyLinkInviteVM> | void;
  onInviteRemove?: (input: { inviteId: string }) => Promise<void> | void;
  onProfileSave?: (input: ProfileSaveInput) => Promise<void> | void;
  onChildThemeSave?: (input: {
    profileId: string;
    orgId: string;
    themeKey: ThemeKey;
  }) => Promise<void> | void;
  guardianThemeKey?: ThemeKey | null;
  onChildProfileCreate?: (input: {
    orgId: string;
    displayName: string;
    firstName: string;
    lastName: string;
    gradeLevel: string;
    birthYear: number;
    email?: string;
    timezone?: string | null;
    city?: string | null;
    region?: string | null;
    countryCode?: string | null;
    countryName?: string | null;
    postalCode?: string | null;
    themeKey?: ThemeKey | null;
  }) => Promise<ChildProfileVM> | void;
  onFamilyMemberRemove?: (input: { childAccountId: string }) => Promise<void> | void;
  guardianEmail?: string | null;
};

export function buildCollapsedChildSectionState(
  previous: Record<string, boolean>,
  childProfileId: string,
): Record<string, boolean> {
  return {
    ...previous,
    [childProfileId]: false,
  };
}

export function buildChildInviteDraft(email?: string | null): {
  role: FamilyLinkInviteRole;
  email: string;
} {
  return {
    role: 'child',
    email: email?.trim() ?? '',
  };
}

export function buildChildDisplayName(firstName: string, lastName: string): string {
  const first = firstName.trim();
  const lastInitial = lastName.trim().charAt(0).toUpperCase();

  if (!first) {
    return '';
  }

  if (!lastInitial) {
    return first;
  }

  return `${first} ${lastInitial}`;
}

export function resolveFamilyInviteErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const normalized = raw.trim().toLowerCase();

  if (normalized.includes('already been registered')) {
    return 'This email already has an account. Ask them to sign in from your organization login page with this same email, then retry the invite only if needed.';
  }

  if (raw.trim()) {
    return raw.trim();
  }

  return 'Unable to send invite right now. Please try again.';
}

export function FamilyTab({
  familyMembers,
  profileThemes,
  profileThemeOptions,
  setProfileThemes,
  showOnboardingToast = false,
  initialInvites = [],
  onInviteCreate,
  onInviteRemove,
  onProfileSave,
  onChildThemeSave,
  onChildProfileCreate,
  timezone,
  location,
  orgId,
  guardianAccountId: _guardianAccountId,
  guardianEmail,
  onFamilyMemberRemove,
  guardianThemeKey,
}: FamilyTabProps) {
  const getNextChildThemeKey = React.useCallback((): ThemeKey => {
    if (!profileThemeOptions.length) {
      return 'teal';
    }
    const baseKey = guardianThemeKey ?? 'teal';
    let baseIndex = profileThemeOptions.findIndex((option) => option.value === baseKey);
    if (baseIndex === -1) {
      baseIndex = profileThemeOptions.findIndex((option) => option.value === 'teal');
      if (baseIndex === -1) {
        baseIndex = 0;
      }
    }
    const childCount = familyMembers.length;
    const index = (baseIndex + childCount) % profileThemeOptions.length;
    const value = profileThemeOptions[index]?.value;
    return (value ?? 'teal') as ThemeKey;
  }, [familyMembers, guardianThemeKey, profileThemeOptions]);
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [inviteRole, setInviteRole] = React.useState<FamilyLinkInviteRole>('child');
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteTargetAccountId, setInviteTargetAccountId] = React.useState<string | null>(
    null,
  );
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [invites, setInvites] = React.useState<FamilyLinkInviteVM[]>(initialInvites);
  const [isInviteSaving, setIsInviteSaving] = React.useState(false);
  const [removingInviteIds, setRemovingInviteIds] = React.useState<
    Record<string, boolean>
  >({});
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [newChildFirstName, setNewChildFirstName] = React.useState('');
  const [newChildLastName, setNewChildLastName] = React.useState('');
  const [newChildGrade, setNewChildGrade] = React.useState('');
  const [newChildBirthYear, setNewChildBirthYear] = React.useState('');
  const newChildFirstNameRef = React.useRef<HTMLInputElement | null>(null);
  const familyCountryCode = React.useMemo(
    () => normalizeCountryCode(location?.countryCode),
    [location?.countryCode],
  );
  const gradeOptions = React.useMemo(
    () => optionsForCountry(familyCountryCode),
    [familyCountryCode],
  );
  const [newChildEmail, setNewChildEmail] = React.useState('');
  const [newChildEmailError, setNewChildEmailError] = React.useState<string | null>(null);
  const [isCreatingChild, setIsCreatingChild] = React.useState(false);
  const [memberToRemove, setMemberToRemove] = React.useState<FamilyMemberItem | null>(
    null,
  );
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = React.useState(false);
  const [removingMemberIds, setRemovingMemberIds] = React.useState<
    Record<string, boolean>
  >({});
  const [expandedChildSections, setExpandedChildSections] = React.useState<
    Record<string, boolean>
  >({});
  React.useEffect(() => {
    if (familyMembers.length <= 1 && !isDialogOpen) {
      setIsDialogOpen(true);
    }
  }, [familyMembers.length, isDialogOpen]);

  React.useEffect(() => {
    if (!isDialogOpen) {
      return;
    }
    requestAnimationFrame(() => {
      newChildFirstNameRef.current?.focus();
    });
  }, [isDialogOpen]);
  const INVITE_REMOVE_ERROR = 'Unable to remove invite right now. Please try again.';

  const normalizedGuardianEmail = React.useMemo(
    () => guardianEmail?.trim().toLowerCase() ?? '',
    [guardianEmail],
  );

  const validateChildEmail = React.useCallback(
    (value: string) => {
      const trimmed = value.trim();
      const normalizedChildEmail = trimmed.toLowerCase();
      if (normalizedChildEmail && normalizedGuardianEmail) {
        if (normalizedChildEmail === normalizedGuardianEmail) {
          setNewChildEmailError('Child email cannot match the guardian email.');
          return false;
        }
      }
      setNewChildEmailError(null);
      return true;
    },
    [normalizedGuardianEmail],
  );

  const handleSectionToggle = React.useCallback((memberId: string, nextOpen: boolean) => {
    setExpandedChildSections((prev) => ({ ...prev, [memberId]: nextOpen }));
  }, []);

  const handleInviteSave = React.useCallback(async () => {
    if (isInviteSaving) {
      return;
    }
    if (!onInviteCreate) {
      const message = 'Unable to send invite.';
      setInviteError(message);
      toast.error(message);
      return;
    }
    const trimmedEmail = inviteEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setInviteError('Enter a valid email address.');
      toast.error('Enter a valid email address.');
      return;
    }
    setIsInviteSaving(true);
    try {
      const invite = await onInviteCreate({
        invitedRole: inviteRole,
        invitedEmail: trimmedEmail,
        targetAccountId: inviteTargetAccountId ?? undefined,
      });
      if (!invite) {
        throw new Error('Unable to send invite.');
      }
      setInvites((prev) => [...prev, invite]);
      setInviteEmail('');
      setInviteTargetAccountId(null);
      setInviteRole('child');
      setInviteError(null);
      setIsInviteOpen(false);
      toast.success('Invitation sent');
    } catch (error) {
      console.error(error);
      const message = resolveFamilyInviteErrorMessage(error);
      setInviteError(message);
      toast.error(message);
    } finally {
      setIsInviteSaving(false);
    }
  }, [inviteEmail, inviteRole, inviteTargetAccountId, isInviteSaving, onInviteCreate]);

  const prepareInviteForEmail = React.useCallback(
    (email: string, role: FamilyLinkInviteRole, targetAccountId?: string | null) => {
      setInviteRole(role);
      setInviteEmail(email);
      setInviteTargetAccountId(targetAccountId ?? null);
      setInviteError(null);
      setIsInviteOpen(true);
    },
    [],
  );

  const openChildInviteWithoutEmail = React.useCallback(
    (targetAccountId?: string | null) => {
      const draft = buildChildInviteDraft('');
      setInviteRole(draft.role);
      setInviteEmail(draft.email);
      setInviteTargetAccountId(targetAccountId ?? null);
      setIsInviteOpen(true);
    },
    [],
  );

  const handleRemoveInvite = React.useCallback(
    async (id: string) => {
      if (removingInviteIds[id]) {
        return;
      }
      if (!onInviteRemove) {
        toast.error(INVITE_REMOVE_ERROR);
        return;
      }
      setRemovingInviteIds((prev) => ({ ...prev, [id]: true }));
      try {
        await onInviteRemove({ inviteId: id });
        setInvites((prev) => prev.filter((invite) => invite.id !== id));
        toast.success('Invite removed');
      } catch (error) {
        console.error(error);
        toast.error(INVITE_REMOVE_ERROR);
      } finally {
        setRemovingInviteIds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [onInviteRemove, removingInviteIds],
  );

  const inviteRoles: FamilyLinkInviteRole[] = ['guardian', 'child'];
  const [editableChildData, setEditableChildData] = React.useState<EditableChildData>(
    () =>
      Object.fromEntries(
        familyMembers.map((member) => {
          const theme = profileThemes[member.id] ?? member.themeKey ?? 'teal';
          return [member.id, { displayName: member.name, themeKey: theme }];
        }),
      ),
  );

  React.useEffect(() => {
    setEditableChildData(
      Object.fromEntries(
        familyMembers.map((member) => {
          const theme = profileThemes[member.id] ?? member.themeKey ?? 'teal';
          return [member.id, { displayName: member.name, themeKey: theme }];
        }),
      ),
    );
  }, [familyMembers, profileThemes]);

  const handleDialogReset = React.useCallback(() => {
    setNewChildFirstName('');
    setNewChildLastName('');
    setNewChildGrade('');
    setNewChildBirthYear('');
    setNewChildEmail('');
    setNewChildEmailError(null);
  }, []);

  const canSubmitChild =
    newChildFirstName.trim() &&
    newChildLastName.trim() &&
    newChildGrade &&
    newChildBirthYear;

  const shouldHighlightOnboardingFields = Boolean(showOnboardingToast && isDialogOpen);
  const sequentialChildHighlight = useSequentialHighlight<ChildRegistrationField>({
    order: CHILD_REGISTRATION_FIELDS,
    satisfied: {
      firstName: Boolean(newChildFirstName.trim()),
      lastName: Boolean(newChildLastName.trim()),
      grade: Boolean(newChildGrade),
      birthYear: Boolean(newChildBirthYear),
    },
    enabled: shouldHighlightOnboardingFields,
  });
  const showFirstNameBeam = sequentialChildHighlight.isActive('firstName');
  const showLastNameBeam = sequentialChildHighlight.isActive('lastName');
  const showGradeBeam = sequentialChildHighlight.isActive('grade');
  const showBirthYearBeam = sequentialChildHighlight.isActive('birthYear');
  const showDialogBeam = shouldHighlightOnboardingFields;
  const showCreateActionBeam = Boolean(
    showDialogBeam && canSubmitChild && !isCreatingChild,
  );
  const showPostOnboardingTooltips = !showOnboardingToast;

  const handleChildCreate = React.useCallback(async () => {
    if (!onChildProfileCreate) {
      toast.error('Child creation is not configured.');
      return;
    }
    if (!canSubmitChild) {
      toast.error('Please fill all required child fields.');
      return;
    }
    if (newChildEmail.trim() && newChildEmailError) {
      toast.error(newChildEmailError);
      return;
    }
    setIsCreatingChild(true);
    try {
      const displayNameValue = buildChildDisplayName(newChildFirstName, newChildLastName);
      const createdChild = await onChildProfileCreate({
        orgId,
        displayName: displayNameValue,
        firstName: newChildFirstName.trim(),
        lastName: newChildLastName.trim(),
        gradeLevel: newChildGrade,
        birthYear: Number(newChildBirthYear),
        email: newChildEmail.trim() || undefined,
        timezone,
        city: location?.city ?? null,
        region: location?.region ?? null,
        countryCode: location?.countryCode ?? null,
        countryName: location?.countryName ?? null,
        postalCode: location?.postalCode ?? null,
        themeKey: getNextChildThemeKey(),
      });
      toast.success('Child profile submitted');
      handleDialogReset();
      if (createdChild?.ids?.id) {
        setExpandedChildSections((prev) =>
          buildCollapsedChildSectionState(prev, createdChild.ids.id),
        );
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Unable to create child profile');
    } finally {
      setIsCreatingChild(false);
    }
  }, [
    canSubmitChild,
    handleDialogReset,
    location?.city,
    location?.countryCode,
    location?.countryName,
    location?.region,
    location?.postalCode,
    newChildBirthYear,
    newChildEmail,
    newChildEmailError,
    newChildFirstName,
    newChildGrade,
    newChildLastName,
    onChildProfileCreate,
    setIsDialogOpen,
    timezone,
    orgId,
    getNextChildThemeKey,
  ]);

  const handleDisplayNameSave = React.useCallback(
    async (member: FamilyMemberItem) => {
      if (!onProfileSave || !member.isChild) {
        return;
      }
      const childData = editableChildData[member.id];
      const nextValue = childData?.displayName.trim() ?? '';
      if (!nextValue || nextValue === member.name) {
        return;
      }

      const promise = Promise.resolve(
        onProfileSave({
          profileId: member.profileId,
          orgId: member.orgId,
          displayName: nextValue,
          firstName: member.firstName ?? '',
          lastName: member.lastName ?? '',
          bio: member.bio ?? undefined,
        }),
      );

      toast.promise(promise, {
        loading: 'Saving display name...',
        success: 'Display name saved',
        error: 'Unable to save display name',
      });
    },
    [editableChildData, onProfileSave],
  );

  const handleAccentChange = React.useCallback(
    (member: FamilyMemberItem, theme: string) => {
      if (!onChildThemeSave || !member.isChild) {
        return;
      }
      const promise = Promise.resolve(
        onChildThemeSave({
          profileId: member.profileId,
          orgId: member.orgId,
          themeKey: theme as ThemeKey,
        }),
      );
      toast.promise(promise, {
        loading: 'Saving accent color...',
        success: 'Accent color saved',
        error: 'Unable to save accent color',
      });
    },
    [onChildThemeSave],
  );

  const handleFamilyMemberRemove = React.useCallback(
    async (member?: FamilyMemberItem | null) => {
      if (!member || !onFamilyMemberRemove || !member.accountId) {
        return;
      }
      setRemovingMemberIds((prev) => ({ ...prev, [member.id]: true }));
      try {
        await onFamilyMemberRemove({ childAccountId: member.accountId });
        toast.success('Family member removed');
      } catch (error) {
        console.error(error);
        toast.error('Unable to remove family member');
      } finally {
        setRemovingMemberIds((prev) => {
          const next = { ...prev };
          delete next[member.id];
          return next;
        });
        setMemberToRemove(null);
      }
    },
    [onFamilyMemberRemove],
  );

  const handleConfirmRemove = React.useCallback(async () => {
    if (!memberToRemove) {
      return;
    }
    await handleFamilyMemberRemove(memberToRemove);
    setIsRemoveDialogOpen(false);
  }, [handleFamilyMemberRemove, memberToRemove]);

  return (
    <div className="space-y-8 w-full">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">Parental controls</h3>
            <p className="text-sm text-muted-foreground">
              Parents can link accounts to set limits, manage permissions, and keep the
              family safe across classes.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Family members</h3>
          <div className="flex items-center gap-2">
            <Dialog
              open={isDialogOpen}
              onOpenChange={(nextOpen) => {
                setIsDialogOpen(nextOpen);
                if (!nextOpen) {
                  handleDialogReset();
                }
              }}
            >
              {showPostOnboardingTooltips ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <div className="relative inline-flex rounded-full">
                        {showOnboardingToast ? (
                          <BorderBeam
                            size={26}
                            initialOffset={8}
                            borderWidth={2}
                            className="from-transparent via-amber-700 to-transparent"
                            transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                          />
                        ) : null}
                        <Button variant="ghost" size="sm" className="relative z-10">
                          <Plus className="size-4" />
                          Add
                        </Button>
                      </div>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs text-muted-foreground">
                    Add more kids to keep their learning profiles aligned and monitored in
                    one place.
                  </TooltipContent>
                </Tooltip>
              ) : (
                <DialogTrigger asChild>
                  <div className="relative inline-flex rounded-full">
                    {showOnboardingToast ? (
                      <BorderBeam
                        size={26}
                        initialOffset={8}
                        borderWidth={2}
                        className="from-transparent via-amber-700 to-transparent"
                        transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                      />
                    ) : null}
                    <Button variant="ghost" size="sm" className="relative z-10">
                      <Plus className="size-4" />
                      Add
                    </Button>
                  </div>
                </DialogTrigger>
              )}
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add a child profile</DialogTitle>
                  <DialogDescription>
                    Required fields are marked with an asterisk. Timezone and location are
                    inherited from your profile.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new-first-name">First name *</Label>
                      <div className="relative rounded-full overflow-hidden">
                        {showFirstNameBeam ? (
                          <BorderBeam
                            size={52}
                            initialOffset={8}
                            borderWidth={2}
                            className="from-transparent via-amber-700 to-transparent"
                            transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                          />
                        ) : null}
                        <Input
                          id="new-first-name"
                          value={newChildFirstName}
                          onChange={(event) => setNewChildFirstName(event.target.value)}
                          placeholder="Child first name"
                          ref={newChildFirstNameRef}
                          className="relative z-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-last-name">Last name *</Label>
                      <div className="relative rounded-full overflow-hidden">
                        {showLastNameBeam ? (
                          <BorderBeam
                            size={52}
                            initialOffset={8}
                            borderWidth={2}
                            className="from-transparent via-amber-700 to-transparent"
                            transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                          />
                        ) : null}
                        <Input
                          id="new-last-name"
                          value={newChildLastName}
                          onChange={(event) => setNewChildLastName(event.target.value)}
                          placeholder="Child last name"
                          className="relative z-10"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new-grade">Grade level *</Label>
                      <div className="relative w-full rounded-full overflow-hidden">
                        {showGradeBeam ? (
                          <BorderBeam
                            size={52}
                            initialOffset={8}
                            borderWidth={2}
                            className="from-transparent via-amber-700 to-transparent"
                            transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                          />
                        ) : null}
                        <Select
                          value={newChildGrade}
                          onValueChange={(value) => setNewChildGrade(value)}
                          required
                        >
                          <SelectTrigger id="new-grade" className="relative z-10 w-full">
                            <SelectValue placeholder="Select grade" />
                          </SelectTrigger>
                          <SelectContent>
                            {gradeOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-birth-year">Birth year *</Label>
                      <div className="relative w-full rounded-full overflow-hidden">
                        {showBirthYearBeam ? (
                          <BorderBeam
                            size={52}
                            initialOffset={8}
                            borderWidth={2}
                            className="from-transparent via-amber-700 to-transparent"
                            transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                          />
                        ) : null}
                        <Select
                          value={newChildBirthYear}
                          onValueChange={(value) => setNewChildBirthYear(value)}
                          required
                        >
                          <SelectTrigger
                            id="new-birth-year"
                            className="relative z-10 w-full"
                          >
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent>
                            {BIRTH_YEAR_OPTIONS.map((year: number) => (
                              <SelectItem key={year} value={String(year)}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="new-email">Email</Label>
                      <span className="text-xs text-muted-foreground">Optional</span>
                    </div>
                    <Input
                      id="new-email"
                      type="email"
                      value={newChildEmail}
                      onChange={(event) => {
                        setNewChildEmail(event.target.value);
                        validateChildEmail(event.target.value);
                      }}
                      placeholder="child@example.com (optional)"
                    />
                    {newChildEmailError ? (
                      <p className="text-xs text-destructive">{newChildEmailError}</p>
                    ) : null}
                    {newChildEmail.trim() ? (
                      <div className="space-y-1 text-xs text-foreground border p-2 rounded-xl">
                        <p className="text-[11px]">
                          <ShieldAlert className="inline-block mr-1 w-3 h-3" />
                          If the student is 13 years or older, they can have their own
                          account, communicate directly with the teacher to ask questions,
                          and stay more engaged in their learning—while parents continue
                          to monitor everything.
                        </p>
                        <p className="text-[11px]">
                          If a student is under 13 but shows the maturity to handle things
                          independently, parents may enable supervised direct
                          communication with the teacher, while continuing to monitor all
                          activity.
                        </p>
                        <Button
                          variant="outline"
                          size="xs"
                          className="px-2 text-xs mt-1 font-medium text-primary underline-offset-4 hover:underline"
                          onClick={() =>
                            prepareInviteForEmail(newChildEmail.trim(), 'child')
                          }
                          type="button"
                        >
                          Click here to send them an invite to get started
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Timezone: {timezone ?? 'inherited'}, Location: {location?.city ?? '—'}
                    {location?.region ? `, ${location.region}` : ''}{' '}
                    {location?.countryName ? `(${location.countryName})` : ''}
                  </div>
                </div>
                <DialogFooter className="mt-4 flex justify-end gap-2">
                  {showPostOnboardingTooltips ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DialogClose asChild>
                          <Button size="sm" variant="ghost">
                            Cancel
                          </Button>
                        </DialogClose>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs text-muted-foreground">
                        Click here to return to the dashboard once you’re done.
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <DialogClose asChild>
                      <Button size="sm" variant="ghost">
                        Cancel
                      </Button>
                    </DialogClose>
                  )}
                  <div className="relative inline-flex rounded-full">
                    {showCreateActionBeam ? (
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
                      onClick={handleChildCreate}
                      disabled={isCreatingChild}
                      className="relative z-10"
                    >
                      {isCreatingChild ? 'Creating…' : 'Create child profile'}
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <UserPlus className="size-4" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a family member</DialogTitle>
                  <DialogDescription>
                    Add the child email, then send invite to create account.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Who are you inviting?</Label>
                    <div className="flex flex-col gap-2">
                      {inviteRoles.map((option) => (
                        <label
                          key={option}
                          className="flex cursor-pointer items-center gap-3 rounded-3xl border px-4 py-2 transition hover:border-foreground"
                        >
                          <input
                            type="radio"
                            name="family-invite-role"
                            value={option}
                            checked={inviteRole === option}
                            onChange={() => setInviteRole(option as 'guardian' | 'child')}
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="text-sm font-medium">
                            {option === 'guardian' ? 'Guardian' : 'Child'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => {
                        setInviteEmail(event.target.value);
                        if (inviteError) {
                          setInviteError(null);
                        }
                      }}
                      placeholder="guardian@example.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Add the child email, then send invite to create account.
                    </p>
                    {inviteError ? (
                      <p className="text-xs text-destructive">{inviteError}</p>
                    ) : null}
                  </div>
                </div>
                <DialogFooter className="mt-4 flex justify-end gap-2">
                  {showPostOnboardingTooltips ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DialogClose asChild>
                          <Button type="button" size="sm" variant="ghost">
                            Cancel
                          </Button>
                        </DialogClose>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs text-muted-foreground">
                        Click here to return to the family dashboard at any time.
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <DialogClose asChild>
                      <Button type="button" size="sm" variant="ghost">
                        Cancel
                      </Button>
                    </DialogClose>
                  )}
                  <Button size="sm" onClick={handleInviteSave} disabled={isInviteSaving}>
                    {isInviteSaving ? 'Sending...' : 'Send invite'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="space-y-1">
          {familyMembers.length ? (
            familyMembers.map((member, index) => {
              const initials = member.name
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 1)
                .toUpperCase();
              const isSelf = !member.canRemove;
              const editable = editableChildData[member.id];
              const themeValue =
                editable?.themeKey ??
                profileThemes[member.id] ??
                member.themeKey ??
                'teal';
              const themeClass = `theme-${themeValue}`;
              const avatarIcon = (
                <Avatar className={`size-10 border theme-border ${themeClass}`}>
                  <AvatarImage src={member.avatar?.url ?? undefined} />
                  <AvatarFallback className="theme-bg theme-fg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              );
              const memberNameParts = [member.firstName, member.lastName]
                .filter(Boolean)
                .map((part) => part?.trim())
                .filter(Boolean);
              const memberDescriptionParts = [
                memberNameParts.length ? memberNameParts.join(' ') : undefined,
                member.email,
              ].filter(Boolean);
              const subtitle = memberDescriptionParts.length
                ? memberDescriptionParts.join(' · ')
                : 'Invitation sent';
              const displayNameValue = editable?.displayName ?? member.name;
              const isChildMember = Boolean(member.isChild);
              return (
                <UserSettingsTabSection
                  key={member.id}
                  icon={avatarIcon}
                  title={member.name}
                  subtitle={subtitle}
                  badgeIcon={<Badge variant="secondary">{member.roleLabel}</Badge>}
                  showSeparator={
                    index < familyMembers.length - 1 || Boolean(invites.length)
                  }
                  open={
                    Object.prototype.hasOwnProperty.call(expandedChildSections, member.id)
                      ? expandedChildSections[member.id]
                      : undefined
                  }
                  onOpenChange={
                    isChildMember
                      ? (nextOpen) => handleSectionToggle(member.id, nextOpen)
                      : undefined
                  }
                >
                  {isSelf ? null : (
                    <div className="space-y-4">
                      {isChildMember ? (
                        <>
                          <div className="space-y-2">
                            <Label>Display name</Label>
                            <Input
                              value={displayNameValue}
                              onChange={(event) => {
                                const next = event.target.value;
                                setEditableChildData((prev) => ({
                                  ...prev,
                                  [member.id]: {
                                    displayName: next,
                                    themeKey: prev[member.id]?.themeKey ?? themeValue,
                                  },
                                }));
                              }}
                              onBlur={() => {
                                void handleDisplayNameSave(member);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  (event.target as HTMLInputElement).blur();
                                }
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Accent color</Label>
                            <Select
                              value={themeValue}
                              onValueChange={(value) => {
                                setProfileThemes((prev) => ({
                                  ...prev,
                                  [member.id]: value as ThemeKey,
                                }));
                                setEditableChildData((prev) => ({
                                  ...prev,
                                  [member.id]: {
                                    displayName:
                                      prev[member.id]?.displayName ?? displayNameValue,
                                    themeKey: value as ThemeKey,
                                  },
                                }));
                                handleAccentChange(member, value);
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select color" />
                              </SelectTrigger>
                              <SelectContent>
                                {profileThemeOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <span
                                      className={`flex items-center gap-2 theme-${option.value}`}
                                    >
                                      <span className="theme-swatch h-3.5 w-3.5 rounded-full" />
                                      {option.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      ) : null}
                      {isChildMember && member.email && !member.hasAuthAccount ? (
                        <div className="space-y-1 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/5 px-3 py-2 text-xs text-muted-foreground">
                          <p>
                            We have {member.email} on file, but they still need to create
                            a login.
                          </p>
                          <p>
                            Keep this email current so the invite links the login to this
                            child profile correctly.
                          </p>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="px-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
                            onClick={() =>
                              prepareInviteForEmail(
                                member.email!,
                                'child',
                                member.accountId ?? null,
                              )
                            }
                          >
                            Send invite to create account
                          </Button>
                        </div>
                      ) : null}
                      {isChildMember && !member.email && !member.hasAuthAccount ? (
                        <div className="space-y-1 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                          <p>This child profile does not have an email yet.</p>
                          <p>
                            Add the child&apos;s email first, then send an invite so their
                            login links to this profile correctly.
                          </p>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="px-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
                            onClick={() =>
                              openChildInviteWithoutEmail(member.accountId ?? null)
                            }
                          >
                            Add email and send invite
                          </Button>
                        </div>
                      ) : null}
                      <div className="flex justify-end">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setMemberToRemove(member);
                            setIsRemoveDialogOpen(true);
                          }}
                          disabled={Boolean(removingMemberIds[member.id])}
                        >
                          {removingMemberIds[member.id]
                            ? 'Removing...'
                            : 'Remove from family'}
                        </Button>
                      </div>
                    </div>
                  )}
                </UserSettingsTabSection>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">No family members added yet.</p>
          )}
          {invites.length ? (
            <>
              {invites.map((invite, index) => {
                const statusLabel =
                  invite.status.charAt(0).toUpperCase() + invite.status.slice(1);
                const subtitleParts = [
                  invite.invitedEmail ?? 'Invitation sent',
                  invite.invitedPhoneE164,
                  statusLabel,
                ].filter(Boolean);
                const isRemoving = Boolean(removingInviteIds[invite.id]);
                return (
                  <UserSettingsTabSection
                    key={invite.id}
                    icon={
                      <Avatar className="size-10 border theme-border theme-slate">
                        <AvatarFallback>
                          {invite.invitedRole === 'child' ? 'CH' : 'GD'}
                        </AvatarFallback>
                      </Avatar>
                    }
                    title={
                      invite.invitedRole === 'child'
                        ? 'Invited child'
                        : 'Invited guardian'
                    }
                    subtitle={subtitleParts.join(' · ')}
                    badgeIcon={<Badge variant="secondary">{statusLabel}</Badge>}
                    showSeparator={index < invites.length - 1}
                  >
                    <div className="flex justify-end gap-2">
                      {invite.status === 'pending' && invite.invitedEmail
                        ? (() => {
                            const pendingEmail = invite.invitedEmail;
                            return (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  prepareInviteForEmail(pendingEmail, invite.invitedRole)
                                }
                              >
                                Resend invite
                              </Button>
                            );
                          })()
                        : null}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveInvite(invite.id)}
                        disabled={isRemoving}
                      >
                        {isRemoving ? 'Removing...' : 'Remove from family'}
                      </Button>
                    </div>
                  </UserSettingsTabSection>
                );
              })}
            </>
          ) : null}
          <AlertDialog
            open={isRemoveDialogOpen}
            onOpenChange={(open) => {
              setIsRemoveDialogOpen(open);
              if (!open) {
                setMemberToRemove(null);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove from family?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will unlink {memberToRemove?.name ?? 'the family member'} from your
                  account. Their data and child profile will remain, but they will no
                  longer be directly associated with this guardian.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex justify-end gap-2">
                <AlertDialogCancel asChild>
                  <Button size="sm" variant="ghost">
                    Cancel
                  </Button>
                </AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={Boolean(
                      memberToRemove && removingMemberIds[memberToRemove.id],
                    )}
                    onClick={() => handleConfirmRemove()}
                  >
                    {memberToRemove && removingMemberIds[memberToRemove.id]
                      ? 'Removing...'
                      : 'Confirm remove'}
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
