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
  id: '2026-11-25-mobile-onboarding-updates',
  title: "What's new in ICONIC Academy",
  items: [
    'Set up your profile with a display name and easier birth year and grade selection.',
    'Find your country, region, and time zone with searchable options during setup.',
    'App updates download quietly and apply the next time the app starts, without interrupting your current work.',
  ],
};
