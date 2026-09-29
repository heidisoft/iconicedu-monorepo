export type ReleaseNotes = {
  id: string;
  title: string;
  items: string[];
};

export const currentReleaseNotes: ReleaseNotes = {
  id: '2026-09-29-ai-messaging',
  title: 'Write messages faster with AI',
  items: [
    '"Refine with AI" rewrites your draft — clearer, shorter, warmer, more professional, or translated — right from the composer.',
    'AI-suggested replies offer 2–3 quick options above the composer for messages you receive.',
    'Nothing is ever sent automatically — you always review and edit before sending.',
  ],
};
