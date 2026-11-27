# Parent referrals

The parent homepage shows a flat pink referral slide and a separate yellow Add
Child slide in one dismissible, vertical carousel at the start of Overview. Both
have dark-theme variants. Dismissal is a device-local preference scoped to the
organization and guardian account; it does not change profile data.

## Sharing and signup

Tapping the referral slide opens an explainer before sharing. It explains the
**$20 off for each new parent referred**, the signup steps, and team confirmation.
Only tapping **Share invitation** creates/retrieves the parent’s personal HTTPS
link and opens the native share sheet. Cancelling does not count as a referral.
The recipient does not receive a separate discount under this offer.

The shared address is `<WEB_URL origin>/r/<opaque code>`. Codes contain no account
IDs or email addresses. The landing page leads with family learning benefits,
then offers **Open app and continue**, country-neutral iPhone/Android store links,
and **Continue on the web**. Downloading the app is optional.

On an installed app, `iconicedu://r/<code>` opens a native invitation screen. The
new parent checks the inviting parent’s name and explicitly accepts before the
app stores the code in encrypted SecureStore for up to 30 days. It is bound to the
first authenticated user and cannot transfer to another signed-in account. Email
verification and Apple/Google authentication do not need the code in their URLs.
Parent onboarding sends the code to `POST /onboarding/role`; the API resolves the
organization from the invitation and records the same audited `pending_review`
reward used by web signup. Transient lookup/write failures preserve the code for
retry. Existing onboarded accounts cannot claim a new reward, while retries of
an already recorded matching claim return `already_recorded` without another write.

For a new installation, return to the original invitation and tap **Open app and
continue** after installing. The landing page also provides a code copy action;
the app’s welcome screen has **Have an invitation?** for pasting a link or code.
This is an explicit fallback, not a claim of automatic deferred attribution across
an App Store installation. No clipboard is read automatically. The web signup
path remains available if a store does not distribute the app in that country.

The **Continue on the web** button sets an HttpOnly, SameSite=Lax first-party attribution cookie
for 30 days, then redirects to the referring parent’s organization signup page.
OAuth/email callback URLs also carry the opaque code for browser transitions.
The code grants no account access. The API validates the code, authenticated new
parent, organization, and referral eligibility before recording attribution.

Web parent role onboarding also includes **Who referred you? (optional)**. A link
attaches the referring parent automatically. Without a link, the entered name is
stored for staff review; it is not automatically matched to an account. A linked
referral can be removed before continuing. The field is absent for other roles.
Existing onboarded accounts cannot claim referrals retroactively.

## Stripe fulfilment and audit

Stripe integration is intentionally manual. Signup creates a `pending_review`
record with the `$20 off` offer snapshot. It does not issue a Stripe coupon,
credit, payment, or discount automatically, and it does not depend on a payment
webhook. The 30-day cookie lifetime is an attribution window, not a discount expiry.
No monetary currency conversion is performed.

Authorized active staff/admin/owner accounts can:

- List their organization’s latest 100 referrals with
  `GET /referrals/review?orgId=<organization UUID>`.
- Review a referral with `PUT /referrals/<referral UUID>/review`, providing
  `status` (`approved`, `rejected`, or `fulfilled`) and a confirmation `note`.
- Resolve a name-only referral by supplying the verified `referrerAccountId`
  before approval. It must be a parent account in the same organization.
- Apply the agreed discount manually in Stripe after approval, then mark the
  referral `fulfilled` with the Stripe confirmation/reference in the note.
  Fulfilment requires prior approval, and repeated fulfilment is idempotent.

Review endpoints require a normal authenticated session. The API verifies the user
rather than trusting client-supplied actor IDs or role claims. Referrals are unique
per new parent within an organization. Self-referrals by account and cross-org
attribution are rejected. Creation and every review change produce append-only
`parent_referral_events` with actor identity and before/after snapshots. Referrals
and audit records cannot be read or written directly by frontend clients.

## Rollout

1. Apply `20261126220000_parent_referrals.sql` before deploying the API and web app.
2. Keep the existing API `WEB_URL` set to the public HTTPS web origin. No new
   required environment variables are introduced.
3. Enable the catalogued `enable-parent-referrals` flag globally so identified
   mobile parents and anonymous web/API evaluations agree. Referrals default off
   in every environment, including local and preview; they do not use the API’s
   usual local/preview bypass. Missing provider configuration or evaluation
   failures keep referrals disabled.
4. Validate the explainer, iOS and Android share sheets, web signup, OAuth/email
   callback attribution, optional manual name, and review/Stripe fulfilment.

Turning the flag off removes the mobile referral slide, disables its explainer
and sharing actions, hides the web signup field, and disables referral landing,
sharing, attribution, and review endpoints. Mobile flag refresh events also close
an open explainer, and a disabled flag cancels pending sharing before the native
share sheet opens. The Add Child slide remains available independently. Existing
family/profile functionality and ordinary signup continue.
Retain additive tables on rollback; schema corrections require a forward migration.

## Verification

Run `pnpm run ci` and the local SQL tests:

```sh
pnpm exec supabase db reset --local
pnpm exec supabase test db supabase/tests/parent_referrals.test.sql
```

Device-level sharing and browser-to-app transitions still require real-device QA.
The implementation does not request contact access or send invitations itself.

## Separate local flag project

For local development, set `POSTHOG_FLAGS_KEY` and `POSTHOG_FLAGS_HOST` in
`apps/api/.env` and `apps/web/.env.local`. Mobile uses
`EXPO_PUBLIC_POSTHOG_FLAGS_KEY` and `EXPO_PUBLIC_POSTHOG_FLAGS_HOST` in
`apps/mobile/.env`. Use the same development PostHog project in all three apps.
These optional settings are ignored in production/release builds and fall back
to the existing PostHog configuration when absent. Restart `pnpm dev` after editing.

Keep `POSTHOG_KEY` and its public equivalents on the analytics project. The mobile
flags client uses isolated memory storage and drops captured events; it does not
record lifecycle events, errors, or session replay. Identity and flag properties
are still sent for targeting. Web and API evaluate flags without capturing events.

The referral landing page leads with the new family’s reasons to join: exploring
classes, managing child profiles and upcoming sessions, and receiving academy
updates and messages. The referring parent’s discount appears as a secondary note;
it does not promise a discount to the new parent or a parent chat feature.

## Verified HTTPS app links

Native configuration accepts only `/r/` links on `www.iconicedu.com` and
`iconicedu.com`. The app config and checked-in iOS entitlements, Xcode signing team,
and Android manifest are synchronized. These changes require rebuilt native apps;
an OTA update cannot add associated domains or intent filters. Until the new app
release is installed, parents can continue using **Open app and continue** with
the existing `iconicedu://` scheme and the separately deployed referral signup flow.

Web serves JSON at `/.well-known/apple-app-site-association` and
`/.well-known/assetlinks.json` while referrals are enabled. The verified public
Apple Team ID and Android release certificate supplied for this application are
versioned in `packages/utils/src/mobile-app-links.ts`. Optional web-only
`APPLE_APP_LINKS_TEAM_ID` and comma-separated `ANDROID_APP_LINKS_SHA256` overrides
support signing changes and certificate rotation; malformed overrides return 404.
They are documented in the web env example, production manifest, and preview setup.
These are public identifiers, not signing keys. Keep the signing private keys out
of this repository.

Deploy the web association files without redirects on both hosts, enable
`enable-parent-referrals` globally for anonymous and identified evaluations, and
publish rebuilt native apps containing the associated domains/intent filters.
Apple/Android cache domain verification; an already-installed older app does not
acquire these entitlements through a JS update. Scheme-based app opening remains
available independently of domain verification. Universal/App Links themselves
are not restricted by country; actual download availability follows each store’s
distribution settings. No US storefront or geographic restriction is added.

Verify cold/warm app opens, email/Apple/Google signup, interruption/restart,
network retry, existing-account login, flag-off behavior, and post-install manual
recovery on real signed iOS and Android builds before rollout. Localhost supports
the web-to-scheme flow; it cannot prove production HTTPS domain verification.

The production Android association trusts the release signing certificate. Use the
existing `iconicedu://` scheme for local debug builds; do not add a debug signing
certificate to the production domain’s trust statements.
