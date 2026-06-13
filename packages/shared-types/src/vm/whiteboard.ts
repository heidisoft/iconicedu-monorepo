export type WhiteboardParticipantRole = 'presenter' | 'viewer';

export type WhiteboardPanelMode = 'video' | 'split' | 'board';

export interface WhiteboardSessionVM {
  id: string;
  liveSessionId: string;
  orgId: string;
  channelId: string;
  snapshot: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
