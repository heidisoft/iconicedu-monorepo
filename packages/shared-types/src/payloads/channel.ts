import type {
  ChannelCapabilityVM,
  ChannelBasicsVM,
  ChannelLifecycleVM,
  ChannelLiveSessionConfigVM,
  ChannelPostingPolicyVM,
  ChannelUiDefaultsVM,
} from '@iconicedu/shared-types/vm/channel';

export type ChannelParticipantPayload = {
  profileId: string;
  roleInChannel?: string | null;
};

export type ChannelCreatePayload = {
  basics: ChannelBasicsVM;
  ui?: ChannelUiDefaultsVM | null;
  liveSession?: ChannelLiveSessionConfigVM | null;
  postingPolicy: ChannelPostingPolicyVM;
  lifecycle?: Pick<ChannelLifecycleVM, 'status'> | null;
  participants: ChannelParticipantPayload[];
  capabilities?: ChannelCapabilityVM[] | null;
};
