export type ReleaseNotes = {
  id: string;
  title: string;
  items: string[];
};

export const currentReleaseNotes: ReleaseNotes = {
  id: '2026-09-05-session-completions',
  title: "What's new",
  items: [
    'Review recently completed classes from Home or Notifications.',
    'Confirm a class, report an issue, or undo your response when needed.',
    'Share a rating after confirming a completed class.',
  ],
};
