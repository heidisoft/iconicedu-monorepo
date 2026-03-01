import type {
  ChannelCapabilityVM,
  ChannelBasicsVM,
  ChannelCallAccessVM,
  ChannelCallModeVM,
  ChannelCallProviderVM,
  ChannelCallsConfigVM,
  ChannelLifecycleVM,
  ChannelPostingPolicyVM,
} from '@iconicedu/shared-types/vm/channel';
import type { ChannelUiDefaultsVM } from '@iconicedu/shared-types/vm/channel';

export type ChannelParticipantPayload = {
  profileId: string;
  roleInChannel?: string | null;
};

export type ChannelCallExternalProviderPayload = Extract<
  ChannelCallProviderVM,
  'zoom' | 'google-meet' | 'teams' | 'external'
>;

export type ChannelCallPayload =
  | {
      kind: 'none';
    }
  | {
      kind: 'daily';
      mode: ChannelCallModeVM;
      roomName?: string | null;
      access?: ChannelCallAccessVM | null;
    }
  | {
      kind: 'external';
      provider: ChannelCallExternalProviderPayload;
      mode: ChannelCallModeVM;
      joinUrl: string;
      hostUrl?: string | null;
      meetingCode?: string | null;
      passcode?: string | null;
      passcodeRequired?: boolean;
      platformLabel?: string | null;
    };

export type ChannelCreatePayload = {
  basics: ChannelBasicsVM;
  ui?: ChannelUiDefaultsVM | null;
  postingPolicy: ChannelPostingPolicyVM;
  lifecycle?: Pick<ChannelLifecycleVM, 'status'> | null;
  participants: ChannelParticipantPayload[];
  capabilities?: ChannelCapabilityVM[] | null;
  calls?: ChannelCallsConfigVM | null;
  call?: ChannelCallPayload | null;
};
