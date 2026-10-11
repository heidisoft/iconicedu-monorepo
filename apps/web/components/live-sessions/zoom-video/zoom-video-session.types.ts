import type { SharePrivilege } from '@zoom/videosdk';

export type MediaDeviceOption = { label: string; deviceId: string };
export type ChatMessageItem = {
  id: string;
  senderUserId: number;
  senderName: string;
  message: string;
  timestamp: number;
};
export type SidePanel = 'chat' | 'users' | null;
export type AudioProcessingMode = 'original' | 'noiseSuppression';
export type BackgroundPreset = 'none' | 'blur' | 'classroom' | 'study';
export type NetworkLevel = 'bad' | 'normal' | 'good';
export type FloatingReaction = {
  id: string;
  emoji: string;
  origin: { x: number; y: number };
  dx: number;
  rotate: number;
  durationMs: number;
};
export type CommandChannelPayload =
  | { type: 'raise-hand'; raised: boolean }
  | { type: 'raise-hand-state-request' }
  | { type: 'reaction'; emoji: string };
export type RemoteParticipant = {
  userId: number;
  displayName: string;
  avatar?: string;
  muted: boolean;
  bVideoOn: boolean;
  isHost: boolean;
};

export type DeviceSettingsModel = {
  cameras: MediaDeviceOption[];
  microphones: MediaDeviceOption[];
  speakers: MediaDeviceOption[];
  activeCameraId: string | null;
  activeMicrophoneId: string | null;
  activeSpeakerId: string | null;
  audioProcessingMode: AudioProcessingMode;
  backgroundPreset: BackgroundPreset;
  isMirrored: boolean;
  hardwareAcceleration: { encode: boolean; decode: boolean };
  sharePrivilege: SharePrivilege;
};
