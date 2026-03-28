import type { IdsBaseVM, ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';
import type { ChannelVM } from '@iconicedu/shared-types/vm/channel';
import type { ClassScheduleVM } from '@iconicedu/shared-types/vm/class-schedule';
import type { UserProfileVM } from '@iconicedu/shared-types/vm/profile';

export type LearningSpaceKindVM = 'one_on_one' | 'small_group' | 'large_class';
export type LearningSpaceStatusVM = 'active' | 'archived' | 'completed' | 'paused';

export interface LearningSpaceBasicsVM {
  kind: LearningSpaceKindVM;
  status: LearningSpaceStatusVM;

  title: string;
  iconKey: string | null;

  subject?: string | null;
  description?: string | null;
}

export interface LearningSpaceChannelsVM {
  primaryChannel: ChannelVM;
  relatedChannels?: ChannelVM[];
}

export interface LearningSpaceScheduleVM {
  scheduleSeries?: ClassScheduleVM | null;
}

export interface LearningSpaceLifecycleVM {
  createdAt: ISODateTime;
  createdBy: UUID;
  archivedAt?: ISODateTime | null;
}

export interface LearningSpaceVM {
  ids: IdsBaseVM;
  basics: LearningSpaceBasicsVM;

  channels: LearningSpaceChannelsVM;

  schedule?: LearningSpaceScheduleVM;

  lifecycle: LearningSpaceLifecycleVM;

  participants: UserProfileVM[];
}
