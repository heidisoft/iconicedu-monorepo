export const PARENT_REFERRAL_COOKIE = 'iconic-parent-referral';
export const PARENT_REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
export const isParentReferralCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{48}$/.test(value);
/** A cancellation tombstone also blocks an already-issued callback URL from restoring attribution. */
export const PARENT_REFERRAL_CANCELLED_COOKIE = 'iconic-parent-referral-cancelled';
