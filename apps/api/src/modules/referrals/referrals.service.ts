import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  ParentReferralInput,
  ParentReferralLanding,
  ParentReferralLink,
  ParentReferralOffer,
} from '@iconicedu/shared-types';
import { platformFeatureFlagKeys } from '@iconicedu/shared-types';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { evaluateApiBooleanFlag } from '@iconicedu/api/lib/flags/posthog-openfeature';

const CODE = /^[a-f0-9]{48}$/;
export function normalizeReferralInput(input: ParentReferralInput) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new BadRequestException('Invalid referral details.');
  const code = input.referralCode;
  const name = input.referrerName;
  if (code !== undefined && (typeof code !== 'string' || !CODE.test(code)))
    throw new BadRequestException('Invalid referral link.');
  if (
    name !== undefined &&
    (typeof name !== 'string' ||
      name.trim().length > 100 ||
      [...name].some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ))
  )
    throw new BadRequestException('Enter a valid referring parent name.');
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  if (normalizedName && normalizedName.length < 2)
    throw new BadRequestException('Enter the referring parent’s full name.');
  return { code: code ?? null, name: normalizedName || null };
}
export const PARENT_REFERRAL_OFFER: ParentReferralOffer = {
  rewardLabel: '$20 off',
  explanation:
    'Receive $20 off for each new parent you bring to ICONIC Academy. Our team confirms the referral and arranges your discount.',
  steps: [
    'Share your personal invitation link.',
    'The new parent signs up in the app or on our website. Your name is attached automatically.',
    'We confirm the new parent’s referral and arrange your $20 discount.',
  ],
};
@Injectable()
export class ReferralsService {
  private async enabled() {
    if (
      !(await evaluateApiBooleanFlag({
        flagKey: platformFeatureFlagKeys.enableParentReferrals,
        distinctId: 'anonymous',
        allowLocalOverride: false,
      }))
    )
      throw new NotFoundException('Parent referrals are not available yet.');
  }
  async offer() {
    await this.enabled();
    return PARENT_REFERRAL_OFFER;
  }
  async link(token: string, orgId: unknown): Promise<ParentReferralLink> {
    if (
      typeof orgId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId)
    )
      throw new BadRequestException('Invalid organization.');
    await this.enabled();
    const {
      data: { user },
      error,
    } = await createSupabaseSessionClient(token).auth.getUser();
    if (error || !user) throw new ForbiddenException();
    let origin: URL;
    try {
      origin = new URL(process.env.WEB_URL?.trim() || 'http://localhost:3000');
      if (
        origin.username ||
        origin.password ||
        !['http:', 'https:'].includes(origin.protocol) ||
        (process.env.NODE_ENV === 'production' &&
          (origin.protocol !== 'https:' ||
            ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)))
      )
        throw new Error();
    } catch {
      throw new ServiceUnavailableException('Referral sharing is not configured.');
    }
    const result = await createSupabaseServiceClient().rpc('get_parent_referral_link', {
      actor_auth_id: user.id,
      target_org_id: orgId,
    });
    if (result.error?.code === '42501')
      throw new ForbiddenException('Only parent accounts can share referrals.');
    if (result.error || !CODE.test(result.data?.code ?? ''))
      throw new ServiceUnavailableException(
        'Unable to prepare your invitation. Please try again.',
      );
    return {
      ...PARENT_REFERRAL_OFFER,
      url: new URL(`/r/${result.data.code}`, origin.origin).toString(),
    };
  }
  async resolve(code: string): Promise<ParentReferralLanding> {
    await this.enabled();
    if (!CODE.test(code))
      throw new NotFoundException('This referral link is unavailable.');
    const { data, error } = await createSupabaseServiceClient().rpc(
      'resolve_parent_referral',
      { code_value: code },
    );
    if (error)
      throw new ServiceUnavailableException('Unable to check this referral link.');
    if (!data) throw new NotFoundException('This referral link is unavailable.');
    return { ...PARENT_REFERRAL_OFFER, ...data };
  }
  async record(actorId: string, orgId: string, input: ParentReferralInput) {
    const { code, name } = normalizeReferralInput(input);
    if (!code && !name) return;
    await this.enabled();
    const { error } = await createSupabaseServiceClient().rpc('record_parent_referral', {
      actor_auth_id: actorId,
      target_org_id: orgId,
      code_value: code,
      name_value: name,
    });
    if (error?.code === '22023')
      throw new BadRequestException(
        'This referral link cannot be used. Clear the referral or use the parent’s name.',
      );
    if (error)
      throw new ServiceUnavailableException(
        'Unable to record your referral. Please try again.',
      );
  }
  /** Replayed signup requests may acknowledge an existing claim, never create another reward. */
  async hasMatchingSignupReferral(
    accountId: string,
    orgId: string,
    input: ParentReferralInput,
  ): Promise<boolean> {
    await this.enabled();
    const { code, name } = normalizeReferralInput(input);
    const service = createSupabaseServiceClient();
    const claim = await service
      .from('parent_referrals')
      .select('referrer_account_id, claimed_referrer_name, attribution_source')
      .eq('org_id', orgId)
      .eq('referred_account_id', accountId)
      .maybeSingle();
    if (claim.error)
      throw new ServiceUnavailableException(
        'Unable to check your referral. Please try again.',
      );
    if (!claim.data) return false;
    if (!code)
      return (
        claim.data.attribution_source === 'name' &&
        claim.data.claimed_referrer_name === name
      );
    const link = await service
      .from('parent_referral_links')
      .select('referrer_account_id')
      .eq('org_id', orgId)
      .eq('code', code)
      .maybeSingle();
    if (link.error)
      throw new ServiceUnavailableException(
        'Unable to check your referral. Please try again.',
      );
    return Boolean(
      link.data &&
      claim.data.attribution_source === 'link' &&
      link.data.referrer_account_id === claim.data.referrer_account_id,
    );
  }
  async review(
    token: string,
    id: string,
    input: { status?: unknown; note?: unknown; referrerAccountId?: unknown },
  ) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      !uuid.test(id) ||
      !input ||
      !['approved', 'rejected', 'fulfilled'].includes(String(input.status)) ||
      typeof input.note !== 'string' ||
      input.note.trim().length < 3 ||
      input.note.length > 1000 ||
      (input.referrerAccountId !== undefined &&
        (typeof input.referrerAccountId !== 'string' ||
          !uuid.test(input.referrerAccountId)))
    )
      throw new BadRequestException(
        'Enter valid review details and a confirmation note.',
      );
    const {
      data: { user },
      error,
    } = await createSupabaseSessionClient(token).auth.getUser();
    if (error || !user) throw new ForbiddenException();
    await this.enabled();
    const result = await createSupabaseServiceClient().rpc('review_parent_referral', {
      reviewer_auth_id: user.id,
      referral_id_value: id,
      status_value: input.status,
      note_value: input.note.trim(),
      referrer_id_value: input.referrerAccountId ?? null,
    });
    if (result.error?.code === '42501')
      throw new ForbiddenException('Only authorized staff can review referrals.');
    if (result.error?.code === '22023')
      throw new BadRequestException(
        'Confirm the parent account, approve the referral, and provide a Stripe confirmation note before fulfilment.',
      );
    if (result.error)
      throw new ServiceUnavailableException('Unable to update the referral.');
    return { success: true };
  }
  async list(token: string, orgId: string) {
    await this.enabled();
    const session = createSupabaseSessionClient(token);
    const {
      data: { user },
      error,
    } = await session.auth.getUser();
    if (error || !user) throw new ForbiddenException();
    const account = await session
      .from('accounts')
      .select('id, primary_role')
      .eq('auth_user_id', user.id)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'active')
      .single();
    if (
      account.error ||
      !['staff', 'admin', 'owner'].includes(account.data?.primary_role ?? '')
    )
      throw new ForbiddenException();
    const result = await createSupabaseServiceClient()
      .from('parent_referrals')
      .select(
        'id, org_id, referred_account_id, referrer_account_id, claimed_referrer_name, attribution_source, status, reward_label, review_note, created_at',
      )
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (result.error) throw new ServiceUnavailableException('Unable to load referrals.');
    return result.data;
  }
}
