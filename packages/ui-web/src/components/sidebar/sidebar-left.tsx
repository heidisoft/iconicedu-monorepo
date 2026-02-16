'use client';

import * as React from 'react';
import {
  Calendar,
  ChefHat,
  Earth,
  Home,
  Inbox,
  Languages,
  LifeBuoy,
  MessageSquarePlus,
  MoreHorizontal,
  Send,
  SquarePi,
  Settings,
  UserPlus,
} from 'lucide-react';

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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@iconicedu/ui-web/ui/dropdown-menu';
import { NavMain } from '@iconicedu/ui-web/components/sidebar/nav-main';
import { NavDirectMessages } from '@iconicedu/ui-web/components/sidebar/nav-direct-messages';
import { NavSupervisedDirectMessages } from '@iconicedu/ui-web/components/sidebar/nav-supervised-direct-messages';
import { NavAdmin } from '@iconicedu/ui-web/components/sidebar/nav-admin';
import type { AdminMenuSection } from '@iconicedu/shared-types';
import { SiteLogoWithName } from '@iconicedu/ui-web/components/site-logo-wt-name';
import { Empty } from '@iconicedu/ui-web/ui/empty';
import { EmptyContent } from '@iconicedu/ui-web/ui/empty';
import { ThemedIconBadge } from '@iconicedu/ui-web/components/shared/themed-icon';
import { getLearningSpaceIcon } from '@iconicedu/ui-web/lib/icons';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import type {
  ChildProfileSaveInput,
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
  getDirectMessageItemUnreadCount,
  getLearningSpaceItemUnreadCountForUser,
  getLearningSpaceUnreadCount,
} from '@iconicedu/ui-web/components/sidebar/sidebar-unread';

const ICONS = {
  home: Home,
  'class-schedule': Calendar,
  inbox: Inbox,
  languages: Languages,
  'chef-hat': ChefHat,
  earth: Earth,
  'square-pi': SquarePi,
  'life-buoy': LifeBuoy,
  send: Send,
} as const;

export function SidebarLeft({
  data,
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
  onFamilyInviteCreate,
  onFamilyInviteRemove,
  onChildThemeSave,
  onChildProfileCreate,
  onFamilyMemberRemove,
  onEducatorProfileSave,
  onEducatorAvailabilitySave,
  onStaffProfileSave,
  onStatusOverrideSave,
  adminSections,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  data: SidebarLeftDataVM;
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
  }) => Promise<void> | void;
  onFamilyInviteCreate?: (input: {
    invitedRole: FamilyLinkInviteRole;
    invitedEmail: string;
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
  onOnboardingComplete?: () => void;
}) {
  const navMain: SidebarNavItem[] = data.navigation.navMain.map((item) => ({
    ...item,
    icon: ICONS[item.icon],
    isActive:
      item.url === '/d'
        ? activePath === item.url
        : (activePath?.startsWith(item.url) ?? false),
  }));
  const navSecondary: SidebarSecondaryItem[] = data.navigation.navSecondary.map(
    (item) => ({
      ...item,
      icon: ICONS[item.icon],
      isActive: activePath ? activePath.startsWith(item.url) : false,
    }),
  );
  const userProfile = data.user.profile;
  const children: ChildProfileVM[] =
    userProfile.kind === 'guardian' ? (userProfile.children?.items ?? []) : [];
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
    userProfile.kind === 'educator' ||
    userProfile.kind === 'child';
  const flatLearningSpaces =
    userProfile.kind === 'educator' ? educatorLearningSpaces : studentLearningSpaces;
  const visibleLearningSpaces =
    userProfile.kind === 'guardian'
      ? learningSpacesByChild.flatMap((entry) => entry.learningSpaces)
      : flatLearningSpaces;
  const currentUserRef = {
    accountId: data.user.profile.ids.accountId,
    profileId: data.user.profile.ids.id,
  };
  const ownDirectMessages =
    userProfile.kind === 'guardian'
      ? data.collections.directMessages.filter((dm) =>
          dm.collections.participants.some(
            (participant: UserProfileVM) =>
              participant.ids.accountId === userProfile.ids.accountId,
          ),
        )
      : data.collections.directMessages;
  const supervisedDirectMessagesByChild =
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
      : [];
  const hasDirectMessages = ownDirectMessages.length > 0;
  const hasSupervisedDirectMessages = supervisedDirectMessagesByChild.length > 0;
  const supervisedUnreadCount = supervisedDirectMessagesByChild.reduce((total, group) => {
    return (
      total +
      group.dms.reduce((dmTotal, dm) => {
        return dmTotal + getDirectMessageItemUnreadCount(dm, group.child.ids.accountId);
      }, 0)
    );
  }, 0);
  const totalLearningSpacesUnread = getLearningSpaceUnreadCount(
    visibleLearningSpaces,
    currentUserRef,
  );
  const [guardianLearningSpaceOpenState, setGuardianLearningSpaceOpenState] = React.useState<
    Record<string, boolean>
  >({});
  const [guardianSupervisedDmOpenState, setGuardianSupervisedDmOpenState] = React.useState<
    Record<string, boolean>
  >({});
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
  }, [userProfile.kind, guardianLearningSpaceChildAccountIds, guardianLearningSpaceChildAccountIdsKey]);

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
  }, [userProfile.kind, guardianSupervisedChildAccountIds, guardianSupervisedChildAccountIdsKey]);

  const activeLearningSpaceId = React.useMemo(() => {
    if (!activePath) return null;
    if (activePath.startsWith('/d/spaces/')) {
      return activePath.split('/').pop() ?? null;
    }
    return null;
  }, [activePath]);
  const activeDirectMessageId = React.useMemo(() => {
    if (!activePath) return null;
    if (activePath.startsWith('/d/dm/')) {
      return activePath.split('/').pop() ?? null;
    }
    return null;
  }, [activePath]);
  const { isMobile } = useSidebar();
  return (
    <Sidebar variant="inset" {...props} collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="bg-transparent" size="lg">
              <SiteLogoWithName />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        {userProfile.kind === 'staff' && (adminSections?.length ?? 0) > 0 ? (
          <>
            <SidebarSeparator className="mx-2" />
            <NavAdmin
              className="mt-1 space-y-1"
              sections={adminSections ?? []}
              activePath={activePath ?? undefined}
            />
          </>
        ) : null}
        {shouldShowLearningSpaces ? (
          <>
            <SidebarSeparator className="mx-2 group-data-[collapsible=icon]:hidden" />
            <SidebarGroup className="pb-0">
              <SidebarGroupLabel asChild className="uppercase">
                <span className="inline-flex items-center gap-2">
                  <span>Learning spaces</span>
                  {totalLearningSpacesUnread > 0 ? (
                    <Badge className="h-4 px-1.5 text-[10px] bg-rose-500 text-white">
                      {totalLearningSpacesUnread}
                    </Badge>
                  ) : null}
                </span>
              </SidebarGroupLabel>
              {userProfile.kind === 'guardian' ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarGroupAction title="Learning space actions">
                      <MoreHorizontal />
                      <span className="sr-only">Learning space actions</span>
                    </SidebarGroupAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-56"
                    side={isMobile ? 'bottom' : 'right'}
                    align={isMobile ? 'end' : 'start'}
                  >
                    <DropdownMenuItem>
                      <UserPlus className="text-muted-foreground" />
                      <span>Add child</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <MessageSquarePlus className="text-muted-foreground" />
                      <span>Request tutoring</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Settings className="text-muted-foreground" />
                      <span>Manage learning spaces</span>
                    </DropdownMenuItem>
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
                    />
                  );
                })
              )
            ) : (
              <SidebarGroup className="py-0 group-data-[collapsible=icon]:hidden">
                <SidebarMenu>
                  {flatLearningSpaces.map((space) => {
                    const channel = space.channels.primaryChannel;
                    const iconKey = space.basics.iconKey ?? channel.basics.iconKey ?? null;
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
                          <a href={`/d/spaces/${channel.ids.id}`}>
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
                  {supervisedUnreadCount > 0 ? (
                    <Badge className="h-4 px-1.5 text-[10px] bg-rose-500 text-white">
                      {supervisedUnreadCount}
                    </Badge>
                  ) : null}
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
          onFamilyInviteCreate={onFamilyInviteCreate}
          onFamilyInviteRemove={onFamilyInviteRemove}
          onChildThemeSave={onChildThemeSave}
          onChildProfileCreate={onChildProfileCreate}
          onFamilyMemberRemove={onFamilyMemberRemove}
          onEducatorProfileSave={onEducatorProfileSave}
          onEducatorAvailabilitySave={onEducatorAvailabilitySave}
          onStaffProfileSave={onStaffProfileSave}
          onStatusOverrideSave={onStatusOverrideSave}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
