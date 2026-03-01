import type {
  ConnectionVM,
  EntityRefVM,
  ISODateTime,
  ThemeKey,
  UUID,
  IdsBaseVM,
} from '@iconicedu/shared-types/shared/shared';
import type { UserProfileVM } from '@iconicedu/shared-types/vm/profile';
import type { ChannelReadStateVM, MessageVM } from '@iconicedu/shared-types/vm/message';
import type { MessagesRightPanelIntentKey } from '@iconicedu/shared-types/vm/message';

export type ChannelKind = 'channel' | 'dm' | 'group_dm';
export type ChannelPurpose = 'learning-space' | 'general' | 'support' | 'announcements';
export type ChannelVisibility = 'private' | 'public';
export type ChannelStatus = 'active' | 'archived';

export type ChannelTopicIconKey = string;

export type ChannelHeaderIconKey =
  | 'saved'
  | 'next-session'
  | 'last-seen'
  | 'info'
  | 'homework'
  | 'session-summary';

export type ChannelHeaderActionKey = 'info' | 'saved' | 'custom';

export interface ChannelHeaderActionVM {
  key: ChannelHeaderActionKey;
  label: string;
  iconKey?: string | null;
  intentKey?: MessagesRightPanelIntentKey | null;
  hidden?: boolean | null;
}

export interface ChannelPostingPolicyVM {
  kind: 'everyone' | 'members-only' | 'staff-only' | 'read-only' | 'owners_only';
  allowThreads?: boolean;
  allowReactions?: boolean;
}

export interface HeaderQuickMetaAction {
  key: ChannelHeaderIconKey;
  label: string;
  tooltip?: string | null;
  isPrimary?: boolean;
}

export type ChannelQuickActionKey =
  | 'join'
  | 'homework'
  | 'session-summary'
  | 'saved'
  | 'more'
  | 'custom';

export interface ChannelQuickActionVM {
  key: ChannelQuickActionKey;
  label: string;
  iconKey?: string | null;
  url?: string | null;
  hidden?: boolean | null;
  isPrimary?: boolean | null;
}

export type ChannelMediaType = 'image';

export interface ChannelMediaItemVM {
  ids: Omit<IdsBaseVM, 'channelId'> & {
    channelId: UUID;
  };

  messageId?: UUID | null;
  senderId?: UUID | null;

  type: ChannelMediaType;

  url: string;
  storagePath?: string;
  name?: string | null;

  width?: number | null;
  height?: number | null;

  createdAt: ISODateTime;
}

export type ChannelFileKind = 'file' | 'design-file';

export interface ChannelFileItemVM {
  ids: Omit<IdsBaseVM, 'channelId'> & {
    channelId: UUID;
  };

  messageId?: UUID | null;
  senderId?: UUID | null;

  kind: ChannelFileKind;

  url: string;
  storagePath?: string;
  name: string;

  mimeType?: string | null;
  size?: number | null;

  tool?: string | null;

  createdAt: ISODateTime;
}

export type ChannelCapabilityVM = 'has_schedule' | 'has_homework' | 'has_summaries';

export interface ChannelCapabilityRecordVM {
  ids: Omit<IdsBaseVM, 'channelId'> & {
    channelId: UUID;
  };
  capability: ChannelCapabilityVM;
  createdAt: ISODateTime;
  updatedAt?: ISODateTime | null;
}

export interface ChannelContextVM {
  primaryEntity?: EntityRefVM | null;
  capabilities?: ChannelCapabilityVM[] | null;
}

export interface ChannelBasicsVM {
  kind: ChannelKind;

  topic: string;
  iconKey?: ChannelTopicIconKey | null;
  description?: string | null;

  visibility: ChannelVisibility;
  purpose: ChannelPurpose;
}

export interface ChannelLifecycleVM {
  status: ChannelStatus;
  createdBy: UUID;
  createdAt: ISODateTime;
  archivedAt?: ISODateTime | null;
}

export interface ChannelDmVM {
  dmKey?: string | null;
}

export interface ChannelUiDefaultsVM {
  defaultRightPanelOpen?: boolean;
  defaultRightPanelKey?: MessagesRightPanelIntentKey;
  themeKey?: ThemeKey | null;
  infoPanel?: {
    showHeader?: boolean;
    showDetails?: boolean;
    showMedia?: boolean;
    showMembers?: boolean;
    showQuickActions?: boolean;
    showHiddenQuickActions?: boolean;
  } | null;
  headerQuickMetaActions?: HeaderQuickMetaAction[] | null;
  headerActions?: ChannelHeaderActionVM[] | null;
  quickActions?: ChannelQuickActionVM[] | null;
}

export interface ChannelCollectionsVM {
  participants: UserProfileVM[];

  messages: ConnectionVM<MessageVM>;
  media: ConnectionVM<ChannelMediaItemVM>;
  files: ConnectionVM<ChannelFileItemVM>;

  readState?: ChannelReadStateVM;
}

export interface ChannelVM {
  ids: IdsBaseVM;

  basics: ChannelBasicsVM;

  lifecycle: ChannelLifecycleVM;

  postingPolicy: ChannelPostingPolicyVM;

  dm?: ChannelDmVM;

  context?: ChannelContextVM | null;

  collections: ChannelCollectionsVM;

  ui?: ChannelUiDefaultsVM;
}

export interface ChannelMiniVM {
  ids: IdsBaseVM;

  basics: Pick<ChannelBasicsVM, 'kind' | 'purpose' | 'topic' | 'iconKey' | 'visibility'>;

  lifecycle: Pick<ChannelLifecycleVM, 'status'>;

  dm?: ChannelDmVM;

  context?: ChannelContextVM | null;

  participants: UserProfileVM[];
}
