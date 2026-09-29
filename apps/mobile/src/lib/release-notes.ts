export type ReleaseNotes = {
  id: string;
  title: string;
  items: string[];
  /**
   * Set when the release note describes AI-assist composer features
   * (refine / suggested replies) that are still gated per-profile by
   * `AiAssistService.getEligibility` (profile kind + PostHog rollout + the
   * org having AI configured at all — see org-ai-settings.service.ts).
   * `_layout.tsx` only shows a note with this set once the same
   * server-derived eligibility says at least one capability is enabled,
   * so nobody sees an announcement for a feature they don't have.
   */
  requiresAiAssistEligibility?: boolean;
};

export const currentReleaseNotes: ReleaseNotes = {
  id: '2026-09-29-ai-messaging',
  title: 'Write messages faster with AI',
  items: [
    '"Refine with AI" rewrites your draft — clearer, shorter, warmer, more professional, or translated — right from the composer.',
    'AI-suggested replies offer 2–3 quick options above the composer for messages you receive.',
    'Nothing is ever sent automatically — you always review and edit before sending.',
  ],
  requiresAiAssistEligibility: true,
};
