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

export type ChannelCapabilityVM =
  | 'has_schedule'
  | 'has_homework'
  | 'has_summaries'
  | 'calls.audio'
  | 'calls.video'
  | 'calls.recording'
  | 'calls.transcript'
  | 'calls.summary'
  | 'calls.ai_summary'
  | 'calls.attendance';

export type ChannelCallImplementationVM = 'managed' | 'external';
export type ManagedChannelCallProviderVM = 'daily' | 'zoom' | 'custom-sdk';
export type ExternalChannelCallProviderVM = 'zoom' | 'google-meet' | 'teams' | 'external';
export type ChannelCallProviderVM =
  | ManagedChannelCallProviderVM
  | ExternalChannelCallProviderVM;
export type ChannelCallModeVM = 'audio' | 'video';
export type ChannelCallJoinPolicyVM = 'members' | 'hosts-only' | 'invite-only';
export type ChannelCallSessionSourceVM = 'manual' | 'scheduled' | 'ad_hoc';
export type ChannelCallSessionStatusVM =
  | 'idle'
  | 'starting'
  | 'live'
  | 'ending'
  | 'ended'
  | 'processing'
  | 'failed';
export type ChannelCallArtifactKindVM =
  | 'recording'
  | 'transcript'
  | 'summary'
  | 'ai-summary'
  | 'attendance';
export type ChannelCallArtifactStatusVM =
  | 'not-requested'
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed';
export type ChannelCallArtifactVisibilityVM = 'channel' | 'hosts' | 'private';
export type ChannelCallAttendanceDispositionVM = 'present' | 'late' | 'absent' | 'unknown';

export interface ChannelCallAccessVM {
  joinUrl?: string | null;
  hostUrl?: string | null;
  roomName?: string | null;
  roomUrl?: string | null;
  meetingId?: string | null;
  meetingCode?: string | null;
  passcode?: string | null;
  passcodeRequired?: boolean;
  platformLabel?: string | null;
  providerLabel?: string | null;
}

export interface ChannelCallProviderOptionVM {
  implementation: ChannelCallImplementationVM;
  provider: ChannelCallProviderVM;
  enabled?: boolean;
  isDefault?: boolean;
  isBackup?: boolean;
  access?: ChannelCallAccessVM | null;
}

export interface ChannelCallPolicyVM {
  defaultMode: ChannelCallModeVM;
  joinPolicy?: ChannelCallJoinPolicyVM;
  autoCreateRoom?: boolean;
  allowScreenshare?: boolean;
  allowChatWhileInCall?: boolean;
  allowRaiseHand?: boolean;
  hostControlsEnabled?: boolean;
  endWhenEmpty?: boolean;
  maxParticipants?: number | null;
  retentionDays?: number | null;
}

export interface ChannelCallArtifactVM {
  id: UUID;
  implementation?: ChannelCallImplementationVM;
  kind: ChannelCallArtifactKindVM;
  provider: ChannelCallProviderVM;
  status: ChannelCallArtifactStatusVM;
  createdAt: ISODateTime;
  updatedAt?: ISODateTime | null;
  createdBy?: UUID | null;
  publishedToChannel?: boolean;
  visibility?: ChannelCallArtifactVisibilityVM | null;
  url?: string | null;
  storagePath?: string | null;
  name?: string | null;
  mimeType?: string | null;
  durationSeconds?: number | null;
  languageCode?: string | null;
  lastFailureReason?: string | null;
}

export interface ChannelCallAttendanceEntryVM {
  profileId: UUID;
  joinedAt?: ISODateTime | null;
  leftAt?: ISODateTime | null;
  durationSeconds?: number | null;
  disposition?: ChannelCallAttendanceDispositionVM | null;
}

export interface ChannelCallAttendanceVM {
  status: ChannelCallArtifactStatusVM;
  capturedAt?: ISODateTime | null;
  totalParticipants?: number | null;
  entries?: ChannelCallAttendanceEntryVM[] | null;
  lastFailureReason?: string | null;
}

export interface ChannelCallSessionVM {
  id: UUID;
  implementation: ChannelCallImplementationVM;
  provider: ChannelCallProviderVM;
  mode: ChannelCallModeVM;
  source?: ChannelCallSessionSourceVM;
  status: ChannelCallSessionStatusVM;
  startedAt?: ISODateTime | null;
  endedAt?: ISODateTime | null;
  startedBy?: UUID | null;
  endedBy?: UUID | null;
  endedReason?: string | null;
  access?: ChannelCallAccessVM | null;
  participantCount?: number | null;
  activeParticipantIds?: UUID[] | null;
  lastHeartbeatAt?: ISODateTime | null;
  artifacts?: ChannelCallArtifactVM[] | null;
  attendance?: ChannelCallAttendanceVM | null;
}

export interface ChannelCallsConfigVM {
  implementation: ChannelCallImplementationVM;
  provider: ChannelCallProviderVM;
  defaultProvider?: ChannelCallProviderVM | null;
  fallbackProvider?: ChannelCallProviderVM | null;
  policy: ChannelCallPolicyVM;
  access?: ChannelCallAccessVM | null;
  providers?: ChannelCallProviderOptionVM[] | null;
  activeSession?: ChannelCallSessionVM | null;
  latestSession?: ChannelCallSessionVM | null;
}

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
  calls?: ChannelCallsConfigVM | null;
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
