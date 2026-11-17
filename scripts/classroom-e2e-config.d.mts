export type ClassroomJourney = {
  source: 'home' | 'classroom' | 'sessions';
  existingSession: boolean;
  scheduled: boolean;
  webPath: string;
  joinSelector: string;
  nativePath: string;
  nativeJoinLabel: string;
  displayName: string;
};
export const entrySources: string[];
export function readClassroomE2EConfig(path: string): {
  dedicatedTestEnvironment: true;
  webOrigin: string;
  journeys: ClassroomJourney[];
};
