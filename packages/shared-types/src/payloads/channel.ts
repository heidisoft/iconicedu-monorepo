import type { ChannelCapabilityVM, ChannelBasicsVM, ChannelLifecycleVM, ChannelPostingPolicyVM } from '@iconicedu/shared-types/vm/channel';
import type { ChannelUiDefaultsVM } from '@iconicedu/shared-types/vm/channel';

export type ChannelParticipantPayload = {
  profileId: string;
  roleInChannel?: string | null;
};

export type ChannelCreatePayload = {
  basics: ChannelBasicsVM;
  ui?: ChannelUiDefaultsVM | null;
  postingPolicy: ChannelPostingPolicyVM;
  lifecycle?: Pick<ChannelLifecycleVM, 'status'> | null;
  participants: ChannelParticipantPayload[];
  capabilities?: ChannelCapabilityVM[] | null;
};
