export type ParentReferralOffer = {
  rewardLabel: string;
  explanation: string;
  steps: string[];
};
export type ParentReferralLink = ParentReferralOffer & { url: string };
export type ParentReferralLanding = ParentReferralOffer & {
  orgSlug: string;
  referrerName: string;
};
export type ParentReferralInput = { referralCode?: string; referrerName?: string };

export type ParentReferralSignupResult = {
  referralStatus?: 'pending_review' | 'already_recorded' | 'not_eligible';
};
