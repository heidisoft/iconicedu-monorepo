import type React from 'react';
import type { ChildProfileVM, UserProfileVM } from '@iconicedu/shared-types/vm/profile';
import type { ChannelVM } from '@iconicedu/shared-types/vm/channel';
import type { UserAccountVM } from '@iconicedu/shared-types/vm/account';
import type { LearningSpaceVM } from '@iconicedu/shared-types/vm/learning-space';
import type { FamilyLinkVM, FamilyVM } from '@iconicedu/shared-types/vm/family';
import type { UUID } from '@iconicedu/shared-types/shared/shared';

export type SidebarIconKey =
  | 'home'
  | 'class-schedule'
  | 'notifications'
  | 'languages'
  | 'chef-hat'
  | 'earth'
  | 'square-pi'
  | 'life-buoy'
  | 'send';

export type SidebarIconComponent = React.ComponentType<{ className?: string }>;

export type SidebarNavItemData = {
  title: string;
  url: string;
  icon: SidebarIconKey;

  count?: number;

  isActive?: boolean;

  badge?: string;
  color?: string;
};

export type SidebarNavItem = Omit<SidebarNavItemData, 'icon'> & {
  icon: SidebarIconComponent;
};

export type SidebarSecondaryItemData = {
  title: string;
  url: string;
  icon: SidebarIconKey;

  isActive?: boolean;
};

export type SidebarSecondaryItem = Omit<SidebarSecondaryItemData, 'icon'> & {
  icon: SidebarIconComponent;
};

export type SidebarChildVM = ChildProfileVM;

export interface SidebarUserVM {
  profile: UserProfileVM;
  availablePersonas?: Array<{
    profileId: UUID;
    kind: UserProfileVM['kind'];
    label: string;
    displayName?: string | null;
    isActive: boolean;
  }> | null;
  familySwitchOptions?: Array<{
    profileId: UUID;
    kind: 'guardian' | 'child';
    label: string;
    displayName?: string | null;
    isActive: boolean;
    isParentOption?: boolean;
  }> | null;
  isViewingAsChild?: boolean;
  viewingAsProfileId?: UUID | null;
  addablePersonas?: Array<{
    kind: UserProfileVM['kind'];
    label: string;
  }> | null;
  account?: UserAccountVM | null;
  families?: FamilyVM[] | null;
  familyLinks?: FamilyLinkVM[] | null;
  linkedProfiles?: UserProfileVM[] | null;
  linkedAccounts?: UserAccountVM[] | null;
}

export interface SidebarPrimaryNavVM {
  navMain: SidebarNavItemData[];
  navSecondary: SidebarSecondaryItemData[];
}

export interface SidebarCollectionsVM {
  learningSpaces: LearningSpaceVM[];
  directMessages: ChannelVM[];
  classRequestChannels?: ChannelVM[];
  alertChannels?: ChannelVM[];
}

export interface SidebarOrganizationSwitchItemVM {
  id: UUID;
  name: string;
  slug: string;
  url: string;
  isCurrent: boolean;
}

export interface SidebarLeftDataVM {
  user: SidebarUserVM;

  navigation: SidebarPrimaryNavVM;

  collections: SidebarCollectionsVM;

  organizations?: SidebarOrganizationSwitchItemVM[];
}
