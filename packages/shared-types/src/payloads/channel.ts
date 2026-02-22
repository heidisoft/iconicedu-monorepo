import type { ChannelCapabilityVM, ChannelBasicsVM, ChannelLifecycleVM, ChannelPostingPolicyVM } from '@iconicedu/shared-types/vm/channel';
import type { ThemeKey } from '@iconicedu/shared-types/shared/shared';

export type ChannelParticipantPayload = {
  profileId: string;
  roleInChannel?: string | null;
};

export type ChannelCreatePayload = {
  basics: ChannelBasicsVM;
  ui?: {
    themeKey?: ThemeKey | null;
  } | null;
  postingPolicy: ChannelPostingPolicyVM;
  lifecycle?: Pick<ChannelLifecycleVM, 'status'> | null;
  participants: ChannelParticipantPayload[];
  capabilities?: ChannelCapabilityVM[] | null;
};
