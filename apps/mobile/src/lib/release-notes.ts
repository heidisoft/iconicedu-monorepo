export type ReleaseNotes = {
  id: string;
  title: string;
  items: string[];
};

export const currentReleaseNotes: ReleaseNotes = {
  id: '2026-06-13-whats-new-screen',
  title: "What's new",
  items: ['Bug fixes.', 'Update to the join meeting flow.'],
};
