/** Provider-independent policy snapshotted when a Classroom meeting starts. */
export interface LiveSessionSettingsVM {
  recording: { enabled: boolean; autoStart: boolean; allowStop: boolean };
  whiteboard: { enabled: boolean };
  invite: { enabled: boolean };
  participants: { visible: boolean };
  messages: { visible: boolean; enabled: boolean };
}

/** Defaults preserve existing meetings; automatic recording requires opt-in. */
export const DEFAULT_LIVE_SESSION_SETTINGS: LiveSessionSettingsVM = {
  recording: { enabled: true, autoStart: false, allowStop: true },
  whiteboard: { enabled: true },
  invite: { enabled: true },
  participants: { visible: true },
  messages: { visible: true, enabled: true },
};

export type ClassroomMeetingSettingsVM = {
  enabled: boolean;
  settings: LiveSessionSettingsVM;
};
