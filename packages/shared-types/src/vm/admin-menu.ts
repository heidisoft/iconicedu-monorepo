'use strict';

export type AdminMenuIconKey =
  | 'users'
  | 'learning_spaces'
  | 'class_schedules'
  | 'channels'
  | 'activity'
  | 'moderation'
  | 'system';

export interface AdminMenuLinkVM {
  title: string;
  url: string;
}

export interface AdminMenuSectionVM {
  title: string;
  iconKey: AdminMenuIconKey;
  links: AdminMenuLinkVM[];
}

export type AdminMenuLink = AdminMenuLinkVM;
export type AdminMenuSection = AdminMenuSectionVM;
