export type ReleaseNotes = {
  id: string;
  title: string;
  items: string[];
};

export const currentReleaseNotes: ReleaseNotes = {
  id: '2026-09-06-fresh-look',
  title: 'A fresh new look',
  items: [
    'Refreshed the whole app with a calmer forest-green and sage colour theme.',
    'Redesigned session cards, home overview tiles and chat bubbles.',
    'Softer, more consistent cards, badges and status pills throughout.',
    'Improved contrast and polish in dark mode.',
  ],
};
