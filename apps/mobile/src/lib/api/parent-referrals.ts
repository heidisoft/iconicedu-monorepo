import type {
  ParentReferralLanding,
  ParentReferralLink,
  ParentReferralOffer,
} from '@iconicedu/shared-types';
import { apiGet, apiPost, apiPublicGet } from './http-client';
export const fetchParentReferralOffer = () =>
  apiGet<ParentReferralOffer>('/referrals/offer');
export const prepareParentReferralLink = (orgId: string) =>
  apiPost<ParentReferralLink>('/referrals/link', { orgId });

export const resolveParentReferral = (code: string) =>
  apiPublicGet<ParentReferralLanding>(`/referrals/links/${encodeURIComponent(code)}`);
