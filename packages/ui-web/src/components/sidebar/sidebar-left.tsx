'use client';

import * as React from 'react';
import {
  Bell,
  Building2,
  Calendar,
  Check,
  ChefHat,
  ChevronDown,
  Earth,
  Home,
  Languages,
  LifeBuoy,
  MoreHorizontal,
  Send,
  Sparkle,
  SquarePi,
  UserPlus,
} from 'lucide-react';

// eslint-disable-next-line no-restricted-imports
import { ClassRequestAction } from '../class-request/class-request-action';
import { NavLearningSpaces } from '@iconicedu/ui-web/components/sidebar/nav-learning-spaces';
import { NavSecondary } from '@iconicedu/ui-web/components/sidebar/nav-secondary';
import { NavUser } from '@iconicedu/ui-web/components/sidebar/nav-user';
import type {
  ProfileAvatarInput,
  ProfileAvatarRemoveInput,
  ProfileSaveInput,
} from '@iconicedu/ui-web/components/sidebar/user-settings/profile-tab';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@iconicedu/ui-web/ui/sidebar';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@iconicedu/ui-web/ui/dropdown-menu';
import { NavMain } from '@iconicedu/ui-web/components/sidebar/nav-main';
import { NavDirectMessages } from '@iconicedu/ui-web/components/sidebar/nav-direct-messages';
import { NavSupervisedDirectMessages } from '@iconicedu/ui-web/components/sidebar/nav-supervised-direct-messages';
import { NavAdmin } from '@iconicedu/ui-web/components/sidebar/nav-admin';
import type { AdminMenuSection } from '@iconicedu/shared-types';
import { SiteLogoWithName } from '@iconicedu/ui-web/components/branding/site-logo-wt-name';
import { Empty } from '@iconicedu/ui-web/ui/empty';
import { EmptyContent } from '@iconicedu/ui-web/ui/empty';
import { ThemedIconBadge } from '@iconicedu/ui-web/components/shared/themed-icon';
import { getLearningSpaceIcon } from '@iconicedu/ui-web/lib/icons';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import type {
  ChildProfileSaveInput,
  ChannelVM,
  ChildProfileVM,
  EducatorAvailabilityInput,
  EducatorProfileSaveInput,
  FamilyLinkInviteRole,
  FamilyLinkInviteVM,
  LearningSpaceVM,
  SidebarLeftDataVM,
  SidebarNavItem,
  SidebarSecondaryItem,
  StaffProfileSaveInput,
  ThemeKey,
  UserOnboardingStatusVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import {
  getLearningSpaceItemUnreadCountForUser,
  getLearningSpaceUnreadCount,
} from '@iconicedu/ui-web/components/sidebar/sidebar-unread';

const ICONS = {
  home: Home,
  'class-schedule': Calendar,
  notifications: Bell,
  languages: Languages,
  'chef-hat': ChefHat,
  earth: Earth,
  'square-pi': SquarePi,
  'life-buoy': LifeBuoy,
  send: Send,
} as const;

function resolveDashboardBasePath(activePath?: string | null): string {
  const firstSegment = activePath?.split('/').filter(Boolean)[0];
  if (!firstSegment) {
    return '/';
  }
  return `/${firstSegment}`;
}

function normalizeDashboardUrl(url: string, dashboardBasePath: string): string {
  if (url === '/dashboard') {
    return dashboardBasePath;
  }
  if (url.startsWith('/dashboard/')) {
    return `${dashboardBasePath}${url.slice('/dashboard'.length)}`;
  }
  return url;
}

function resolveAlertChannelLabel(
  channel: ChannelVM,
  currentUserAccountId: string,
): string {
  if (channel.basics.kind !== 'dm' && channel.basics.kind !== 'group_dm') {
    return channel.basics.topic;
  }

  const participantNames = channel.collections.participants
    .filter(
      (participant: UserProfileVM) => participant.ids.accountId !== currentUserAccountId,
    )
    .map((participant: UserProfileVM) =>
      getProfileDisplayName(participant.profile, 'User'),
    )
    .filter((name: string) => Boolean(name));

  if (participantNames.length === 0) {
    return channel.basics.topic;
  }

  if (channel.basics.kind === 'dm') {
    return `Direct messages with ${participantNames[0]}`;
  }

  if (participantNames.length === 1) {
    return `Direct messages with ${participantNames[0]}`;
  }

  if (participantNames.length === 2) {
    return `Direct messages with ${participantNames[0]}, ${participantNames[1]}`;
  }

  return `Direct messages with ${participantNames[0]}, ${participantNames[1]} and ${
    participantNames.length - 2
  } others`;
}

export function SidebarLeft({
  data,
  subjectOptions,
  activePath,
  onLogout,
  onboardingStatus,
  onOnboardingComplete,
  onProfileSave,
  onChildProfileSave,
  onAccountUpdate,
  onPrefsSave,
  onLocationSave,
  onAvatarUpload,
  onAvatarRemove,
  onNotificationPreferenceSave,
  onNotificationPreferenceScopeDelete,
  onFamilyInviteCreate,
  onFamilyInviteRemove,
  onChildThemeSave,
  onChildProfileCreate,
  onFamilyMemberRemove,
  onEducatorProfileSave,
  onEducatorAvailabilitySave,
  onStaffProfileSave,
  onStatusOverrideSave,
  onPersonaSwitch,
  onPersonaAdd,
  isPersonaSwitchEnabled,
  isPersonaAddEnabled,
  adminSections,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  data: SidebarLeftDataVM;
  subjectOptions?: string[];
  activePath?: string | null;
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
  onChildThemeSave?: (input: {
    profileId: string;
    orgId: string;
    themeKey: ThemeKey;
  }) => Promise<void> | void;
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
    scopeKind?: 'channel' | 'learning_space';
    scopeId?: string;
  }) => Promise<void> | void;
  onNotificationPreferenceScopeDelete?: (input: {
    profileId: string;
    orgId: string;
    prefKey: string;
    scopeKind: 'channel' | 'learning_space';
    scopeId: string;
  }) => Promise<void> | void;
  onFamilyInviteCreate?: (input: {
    invitedRole: FamilyLinkInviteRole;
    invitedEmail: string;
    targetAccountId?: string;
  }) => Promise<FamilyLinkInviteVM> | void;
  onFamilyInviteRemove?: (input: { inviteId: string }) => Promise<void> | void;
  onFamilyMemberRemove?: (input: { childAccountId: string }) => Promise<void> | void;
  onEducatorProfileSave?: (input: EducatorProfileSaveInput) => Promise<void> | void;
  onEducatorAvailabilitySave?: (input: EducatorAvailabilityInput) => Promise<void> | void;
  adminSections?: AdminMenuSection[] | null;
  onStaffProfileSave?: (input: StaffProfileSaveInput) => Promise<void> | void;
  onStatusOverrideSave?: (input: {
    status?: 'online' | 'away' | 'offline';
    stateText?: string | null;
    stateEmoji?: string | null;
    stateExpiresAt?: string | null;
    clearState?: boolean;
  }) => Promise<void> | void;
  onPersonaSwitch?: (input: { profileId: string }) => Promise<void> | void;
  onPersonaAdd?: (input: {
    kind: 'educator' | 'guardian' | 'child' | 'staff';
  }) => Promise<void> | void;
  isPersonaSwitchEnabled?: boolean;
  isPersonaAddEnabled?: boolean;
  onOnboardingComplete?: () => void;
}) {
  const dashboardBasePath = React.useMemo(
    () => resolveDashboardBasePath(activePath),
    [activePath],
  );
  const userProfile = data.user.profile;
  const navMain: SidebarNavItem[] = data.navigation.navMain
    .filter((item) => item.title !== 'Class Requests' || userProfile.kind === 'guardian')
    .map((item) => ({
      ...item,
      url: normalizeDashboardUrl(item.url, dashboardBasePath),
      icon: ICONS[item.icon],
      isActive:
        normalizeDashboardUrl(item.url, dashboardBasePath) === dashboardBasePath
          ? activePath === dashboardBasePath
          : (activePath?.startsWith(normalizeDashboardUrl(item.url, dashboardBasePath)) ??
            false),
    }));
  const navSecondary: SidebarSecondaryItem[] = data.navigation.navSecondary.map(
    (item) => ({
      ...item,
      url: normalizeDashboardUrl(item.url, dashboardBasePath),
      icon: ICONS[item.icon],
      isActive: activePath
        ? activePath.startsWith(normalizeDashboardUrl(item.url, dashboardBasePath))
        : false,
    }),
  );
  const normalizedAdminSections = React.useMemo(
    () =>
      (adminSections ?? []).map((section) => ({
        ...section,
        links: section.links.map((link) => ({
          ...link,
          url: normalizeDashboardUrl(link.url, dashboardBasePath),
        })),
      })),
    [adminSections, dashboardBasePath],
  );
  const children = React.useMemo<ChildProfileVM[]>(
    () => (userProfile.kind === 'guardian' ? (userProfile.children?.items ?? []) : []),
    [userProfile],
  );
  const learningSpacesByChild: Array<{
    child: ChildProfileVM;
    learningSpaces: LearningSpaceVM[];
  }> = children.map((child) => ({
    child,
    learningSpaces: data.collections.learningSpaces.filter((space) =>
      space.channels.primaryChannel.collections.participants.some(
        (participant: UserProfileVM) =>
          participant.ids.accountId === child.ids.accountId ||
          participant.ids.id === child.ids.id,
      ),
    ),
  }));
  const educatorLearningSpaces =
    userProfile.kind === 'educator'
      ? data.collections.learningSpaces.filter((space) =>
          space.channels.primaryChannel.collections.participants.some(
            (participant: UserProfileVM) =>
              participant.ids.accountId === userProfile.ids.accountId ||
              participant.ids.id === userProfile.ids.id,
          ),
        )
      : [];
  const studentLearningSpaces =
    userProfile.kind === 'child'
      ? data.collections.learningSpaces.filter((space) =>
          space.channels.primaryChannel.collections.participants.some(
            (participant: UserProfileVM) =>
              participant.ids.accountId === userProfile.ids.accountId ||
              participant.ids.id === userProfile.ids.id,
          ),
        )
      : [];
  const shouldShowLearningSpaces =
    userProfile.kind === 'guardian' ||
    (userProfile.kind === 'educator' && educatorLearningSpaces.length > 0) ||
    userProfile.kind === 'child';
  const flatLearningSpaces =
    userProfile.kind === 'educator' ? educatorLearningSpaces : studentLearningSpaces;
  const visibleLearningSpaces =
    userProfile.kind === 'guardian'
      ? learningSpacesByChild.flatMap((entry) => entry.learningSpaces)
      : flatLearningSpaces;
  const shouldShowLearningSpacesLabel =
    userProfile.kind === 'guardian' ||
    userProfile.kind === 'educator' ||
    (userProfile.kind === 'child' && studentLearningSpaces.length > 0);
  const currentUserRef = {
    accountId: data.user.profile.ids.accountId,
    profileId: data.user.profile.ids.id,
  };
  const orgSlug = dashboardBasePath.replace(/^\//, '') || '';
  const canRequestClasses =
    userProfile.kind === 'guardian' || userProfile.kind === 'child';
  const requestRole =
    userProfile.kind === 'guardian'
      ? 'parents'
      : userProfile.kind === 'child'
        ? 'students'
        : 'other';
  const requestableStudents =
    userProfile.kind === 'guardian'
      ? children.map((child) => ({
          profileId: child.ids.id,
          displayName: getProfileDisplayName(child.profile),
        }))
      : userProfile.kind === 'child'
        ? [
            {
              profileId: userProfile.ids.id,
              displayName: getProfileDisplayName(userProfile.profile),
            },
          ]
        : [];
  const openFamilySettings = React.useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('iconicedu:open-user-settings', {
        detail: { tab: 'family' },
      }),
    );
  }, []);
  const ownDirectMessages =
    userProfile.kind === 'guardian'
      ? data.collections.directMessages.filter((dm) =>
          dm.collections.participants.some(
            (participant: UserProfileVM) =>
              participant.ids.accountId === userProfile.ids.accountId,
          ),
        )
      : data.collections.directMessages;
  const supervisedDirectMessagesByChild = React.useMemo(
    () =>
      userProfile.kind === 'guardian'
        ? children
            .map((child) => ({
              child,
              dms: data.collections.directMessages.filter((dm) => {
                const hasChild = dm.collections.participants.some(
                  (participant: UserProfileVM) =>
                    participant.ids.accountId === child.ids.accountId,
                );
                const hasGuardian = dm.collections.participants.some(
                  (participant: UserProfileVM) =>
                    participant.ids.accountId === userProfile.ids.accountId,
                );
                return hasChild && !hasGuardian;
              }),
            }))
            .filter(({ dms }) => dms.length > 0)
        : [],
    [children, data.collections.directMessages, userProfile],
  );
  const alertChannels: ChannelVM[] = React.useMemo(
    () => data.collections.alertChannels ?? data.collections.directMessages,
    [data.collections.alertChannels, data.collections.directMessages],
  );
  const hasDirectMessages = ownDirectMessages.length > 0;
  const hasSupervisedDirectMessages = supervisedDirectMessagesByChild.length > 0;
  const totalLearningSpacesUnread = getLearningSpaceUnreadCount(
    visibleLearningSpaces,
    currentUserRef,
  );
  const [guardianLearningSpaceOpenState, setGuardianLearningSpaceOpenState] =
    React.useState<Record<string, boolean>>({});
  const [guardianSupervisedDmOpenState, setGuardianSupervisedDmOpenState] =
    React.useState<Record<string, boolean>>({});
  const guardianLearningSpaceChildAccountIds = React.useMemo(
    () => children.map((child) => child.ids.accountId),
    [children],
  );
  const guardianLearningSpaceChildAccountIdsKey = React.useMemo(
    () => guardianLearningSpaceChildAccountIds.join('|'),
    [guardianLearningSpaceChildAccountIds],
  );
  const guardianSupervisedChildAccountIds = React.useMemo(
    () => supervisedDirectMessagesByChild.map(({ child }) => child.ids.accountId),
    [supervisedDirectMessagesByChild],
  );
  const guardianSupervisedChildAccountIdsKey = React.useMemo(
    () => guardianSupervisedChildAccountIds.join('|'),
    [guardianSupervisedChildAccountIds],
  );

  React.useEffect(() => {
    if (userProfile.kind !== 'guardian') {
      return;
    }
    setGuardianLearningSpaceOpenState((prev) => {
      const next: Record<string, boolean> = {};
      guardianLearningSpaceChildAccountIds.forEach((accountId) => {
        next[accountId] = prev[accountId] ?? true;
      });
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key) => prev[key] === next[key])
      ) {
        return prev;
      }
      return next;
    });
  }, [
    userProfile.kind,
    guardianLearningSpaceChildAccountIds,
    guardianLearningSpaceChildAccountIdsKey,
  ]);

  React.useEffect(() => {
    if (userProfile.kind !== 'guardian') {
      return;
    }
    setGuardianSupervisedDmOpenState((prev) => {
      const next: Record<string, boolean> = {};
      guardianSupervisedChildAccountIds.forEach((accountId) => {
        next[accountId] = prev[accountId] ?? true;
      });
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key) => prev[key] === next[key])
      ) {
        return prev;
      }
      return next;
    });
  }, [
    userProfile.kind,
    guardianSupervisedChildAccountIds,
    guardianSupervisedChildAccountIdsKey,
  ]);

  const activeLearningSpaceId = React.useMemo(() => {
    if (!activePath) return null;
    const pathSegments = activePath.split('/').filter(Boolean);
    if (pathSegments[1] === 'spaces') {
      return pathSegments[2] ?? null;
    }
    return null;
  }, [activePath]);
  const activeDirectMessageId = React.useMemo(() => {
    if (!activePath) return null;
    const pathSegments = activePath.split('/').filter(Boolean);
    if (pathSegments[1] === 'dm') {
      return pathSegments[2] ?? null;
    }
    return null;
  }, [activePath]);
  const { isMobile } = useSidebar();
  const organizations = data.organizations ?? [];
  const currentOrganization =
    organizations.find((org) => org.isCurrent) ?? organizations[0] ?? null;

  return (
    <Sidebar variant="inset" {...props} collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="bg-transparent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
              size="lg"
            >
              <SiteLogoWithName />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      {organizations.length > 1 && currentOrganization ? (
        <>
          <SidebarSeparator className="mx-2" />
          <SidebarGroup className="pt-1 pb-0 group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel className="px-2 py-1 text-[10px] uppercase tracking-wide">
              Organization
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="hover:bg-sidebar-accent/60 mt-1 h-9 w-full justify-between rounded-lg px-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Building2 className="size-4 shrink-0" />
                      <span className="truncate text-sm">{currentOrganization.name}</span>
                    </span>
                    <ChevronDown className="text-muted-foreground size-4 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side={isMobile ? 'bottom' : 'right'}>
                  {organizations.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      onSelect={() => {
                        if (org.isCurrent || typeof window === 'undefined') {
                          return;
                        }
                        window.location.assign(org.url);
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Building2 className="text-muted-foreground size-4 shrink-0" />
                        <span className="truncate">{org.name}</span>
                      </span>
                      {org.isCurrent ? <Check className="ml-auto size-4" /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator className="mx-2 mt-2 group-data-[collapsible=icon]:hidden" />
        </>
      ) : null}
      <SidebarContent>
        <NavMain items={navMain} />
        {userProfile.kind === 'staff' && (adminSections?.length ?? 0) > 0 ? (
          <>
            <SidebarSeparator className="mx-2" />
            <NavAdmin
              className="mt-1 space-y-1"
              sections={normalizedAdminSections}
              activePath={activePath ?? undefined}
            />
          </>
        ) : null}
        {shouldShowLearningSpaces ? (
          <>
            <SidebarSeparator className="mx-2 group-data-[collapsible=icon]:hidden" />
            <SidebarGroup className="pb-0">
              {shouldShowLearningSpacesLabel ? (
                <SidebarGroupLabel asChild className="uppercase">
                  <span className="inline-flex items-center gap-2">
                    <span>Classrooms</span>
                    {totalLearningSpacesUnread > 0 ? (
                      <Badge className="h-4 px-1.5 text-[10px] bg-rose-500 text-white">
                        {totalLearningSpacesUnread}
                      </Badge>
                    ) : null}
                  </span>
                </SidebarGroupLabel>
              ) : null}
              {userProfile.kind === 'guardian' ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarGroupAction title="Class actions">
                      <MoreHorizontal />
                      <span className="sr-only">Class actions</span>
                    </SidebarGroupAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-56"
                    side={isMobile ? 'bottom' : 'right'}
                    align={isMobile ? 'end' : 'start'}
                  >
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        openFamilySettings();
                      }}
                    >
                      <UserPlus className="text-muted-foreground" />
                      <span>Add child</span>
                    </DropdownMenuItem>
                    <ClassRequestAction
                      orgSlug={orgSlug}
                      fallbackHref={`${dashboardBasePath}/spaces`}
                      canRequestClasses={canRequestClasses}
                      requestRole={requestRole}
                      requestableStudents={requestableStudents}
                      subjectOptions={subjectOptions}
                      renderTrigger={({ canRequestClasses, fallbackHref, openDialog }) =>
                        canRequestClasses ? (
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault();
                              openDialog();
                            }}
                          >
                            <Sparkle className="text-muted-foreground" />
                            <span>Explore Classes</span>
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onSelect={() => {
                              if (typeof window !== 'undefined') {
                                window.location.assign(fallbackHref);
                              }
                            }}
                          >
                            <Sparkle className="text-muted-foreground" />
                            <span>Explore Classes</span>
                          </DropdownMenuItem>
                        )
                      }
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              <SidebarGroupContent />
            </SidebarGroup>
            {userProfile.kind === 'guardian' ? (
              learningSpacesByChild.length === 0 ? (
                <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                  <SidebarGroupContent>
                    <Empty>
                      <EmptyContent>
                        <div className="flex">
                          <Button size="lg">
                            <UserPlus /> Add a Child
                          </Button>
                        </div>
                      </EmptyContent>
                    </Empty>
                  </SidebarGroupContent>
                </SidebarGroup>
              ) : (
                learningSpacesByChild.map(({ child, learningSpaces }) => {
                  return (
                    <NavLearningSpaces
                      key={child.ids.accountId}
                      title={getProfileDisplayName(child.profile)}
                      participant={child}
                      learningSpaces={learningSpaces}
                      isOpen={guardianLearningSpaceOpenState[child.ids.accountId] ?? true}
                      onOpenChange={(open) =>
                        setGuardianLearningSpaceOpenState((prev) => ({
                          ...prev,
                          [child.ids.accountId]: open,
                        }))
                      }
                      activeChannelId={activeLearningSpaceId}
                      isMobile={isMobile}
                      currentUser={currentUserRef}
                      dashboardBasePath={dashboardBasePath}
                      classRequestAction={{
                        orgSlug,
                        fallbackHref: `${dashboardBasePath}/spaces`,
                        canRequestClasses,
                        requestRole,
                        requestableStudents,
                        subjectOptions,
                      }}
                    />
                  );
                })
              )
            ) : (
              <SidebarGroup className="py-0 group-data-[collapsible=icon]:hidden">
                <SidebarMenu>
                  {flatLearningSpaces.map((space) => {
                    const channel = space.channels.primaryChannel;
                    const iconKey =
                      space.basics.iconKey ?? channel.basics.iconKey ?? null;
                    const Icon = getLearningSpaceIcon(iconKey, Languages);
                    const isActive = activeLearningSpaceId === channel.ids.id;
                    const unreadCount = getLearningSpaceItemUnreadCountForUser(
                      space,
                      currentUserRef,
                    );

                    return (
                      <SidebarMenuItem key={space.ids.id} className="py-0.5">
                        <SidebarMenuButton
                          asChild
                          tooltip={space.basics.title}
                          isActive={isActive}
                          className="px-2.5"
                        >
                          <a href={`${dashboardBasePath}/spaces/${channel.ids.id}`}>
                            <ThemedIconBadge
                              icon={Icon}
                              themeKey={channel.ui?.themeKey ?? null}
                              size="md"
                              className="shrink-0 rounded-full"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">
                                {space.basics.title}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {space.basics.subject ?? 'General'}
                              </div>
                            </div>
                            {unreadCount > 0 ? (
                              <Badge className="ml-auto h-5 px-1.5 text-[10px]">
                                {unreadCount}
                              </Badge>
                            ) : null}
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            )}
          </>
        ) : null}
        {hasDirectMessages ? (
          <>
            <SidebarSeparator className="mx-2" />
            <NavDirectMessages
              dms={ownDirectMessages}
              currentUserId={data.user.profile.ids.accountId}
              activeChannelId={activeDirectMessageId ?? null}
              dashboardBasePath={dashboardBasePath}
            />
          </>
        ) : null}
        {hasSupervisedDirectMessages ? (
          <>
            <SidebarSeparator className="mx-2 group-data-[collapsible=icon]:hidden" />
            <SidebarGroup className="pb-0">
              <SidebarGroupLabel asChild className="uppercase">
                <span className="inline-flex items-center gap-2">
                  <span>Supervised DMs</span>
                </span>
              </SidebarGroupLabel>
              <SidebarGroupContent />
            </SidebarGroup>
            {supervisedDirectMessagesByChild.map(({ child, dms }) => (
              <NavSupervisedDirectMessages
                key={child.ids.accountId}
                child={child}
                dms={dms}
                isOpen={guardianSupervisedDmOpenState[child.ids.accountId] ?? true}
                onOpenChange={(open) =>
                  setGuardianSupervisedDmOpenState((prev) => ({
                    ...prev,
                    [child.ids.accountId]: open,
                  }))
                }
                activeChannelId={activeDirectMessageId ?? null}
                dashboardBasePath={dashboardBasePath}
              />
            ))}
          </>
        ) : null}
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          profile={data.user.profile}
          account={data.user.account}
          onLogout={onLogout}
          onboardingStatus={onboardingStatus}
          onOnboardingComplete={onOnboardingComplete}
          onProfileSave={onProfileSave}
          onChildProfileSave={onChildProfileSave}
          onAccountUpdate={onAccountUpdate}
          onPrefsSave={onPrefsSave}
          onLocationSave={onLocationSave}
          onAvatarUpload={onAvatarUpload}
          onAvatarRemove={onAvatarRemove}
          onNotificationPreferenceSave={onNotificationPreferenceSave}
          onNotificationPreferenceScopeDelete={onNotificationPreferenceScopeDelete}
          availableAlertChannels={Array.from(
            new Map(alertChannels.map((channel) => [channel.ids.id, channel])).values(),
          ).map((channel) => ({
            id: channel.ids.id,
            label: resolveAlertChannelLabel(channel, data.user.profile.ids.accountId),
            kind: channel.basics.kind,
          }))}
          availableAlertLearningSpaces={data.collections.learningSpaces.map((space) => ({
            id: space.ids.id,
            label: space.basics.title,
          }))}
          onFamilyInviteCreate={onFamilyInviteCreate}
          onFamilyInviteRemove={onFamilyInviteRemove}
          onChildThemeSave={onChildThemeSave}
          onChildProfileCreate={onChildProfileCreate}
          onFamilyMemberRemove={onFamilyMemberRemove}
          onEducatorProfileSave={onEducatorProfileSave}
          onEducatorAvailabilitySave={onEducatorAvailabilitySave}
          onStaffProfileSave={onStaffProfileSave}
          onStatusOverrideSave={onStatusOverrideSave}
          availablePersonas={data.user.availablePersonas ?? null}
          addablePersonas={data.user.addablePersonas ?? null}
          onPersonaSwitch={onPersonaSwitch}
          onPersonaAdd={onPersonaAdd}
          isPersonaSwitchEnabled={isPersonaSwitchEnabled}
          isPersonaAddEnabled={isPersonaAddEnabled}
          subjectOptions={subjectOptions}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
