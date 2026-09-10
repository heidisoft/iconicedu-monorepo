# Supabase Attack Protection with Cloudflare Turnstile

## Purpose

Runbook for the bot-protection layer on the passwordless auth endpoints:
Cloudflare Turnstile (managed / invisible) in front of Supabase Auth's
`signInWithOtp` / `signUp` / `resend`.

## Intended Audience

Engineers rolling out, operating, or rolling back auth CAPTCHA.

## Last Updated

2026-09-09

## Related Docs

- [Documentation Hub](../README.md)
- [Deployment](deployment.md)

## How it works

- Supabase Attack Protection is a **project-wide** switch. Once enabled, every
  `signInWithOtp` / `signUp` / `resend` from **any** client (web + mobile) must
  include a valid `options.captchaToken` or Supabase returns HTTP 400.
  `verifyOtp` and OAuth are **not** gated.
- Both apps gate the widget on a site-key env var
  (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `EXPO_PUBLIC_TURNSTILE_SITE_KEY`). When the
  var is unset, no widget renders and no token is sent — correct while the
  Supabase switch is off (local dev, CI, pre-rollout).
- Web: `@marsidev/react-turnstile` in
  `apps/web/app/(auth)/shared/turnstile-field.tsx`, wired through
  `auth-entry-form.tsx` and `code-entry-client.tsx`.
- Mobile: the widget runs in a `react-native-webview` page
  (`apps/mobile/src/components/auth/turnstile-webview.tsx`), surfaced by
  `useTurnstile()` and wired into `login.tsx` / `otp.tsx`.
- Turnstile tokens are single-use (~300s TTL). Every send / resend path resets
  the widget for a fresh token afterwards.

## Cloudflare setup

1. Cloudflare dashboard → **Turnstile** → **Add widget**. Widget mode:
   **Managed**.
2. Hostnames: the web production and preview domains, `localhost`, and the
   mobile WebView origin (`app.iconicedu.com`, or whatever
   `EXPO_PUBLIC_TURNSTILE_WIDGET_ORIGIN` is set to). The WebView page runs as
   this origin and Turnstile validates it against this list.
3. Copy the **site key** → app env vars (below). Copy the **secret key** → Supabase
   only (never in the repo or app bundles).

### Test keys

Cloudflare's always-pass dummy pair, safe for local + CI (works on any host):

- site key: `1x00000000000000000000AA`
- secret key: `1x0000000000000000000000000000000AA`

Other dummy keys (always-block, force-challenge) are in the
[Cloudflare docs](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

## App configuration

CI is the delivery mechanism. Add **one** GitHub Actions secret,
`EXPO_PUBLIC_TURNSTILE_SITE_KEY` (the public site key), and the pipelines fan it
out to both platforms:

| Consumer                | Workflow / file                                                       | Variable it sets                             |
| ----------------------- | --------------------------------------------------------------------- | -------------------------------------------- |
| Mobile production OTA   | `.github/workflows/eas-update.yml` → `eas env:create production`      | `EXPO_PUBLIC_TURNSTILE_SITE_KEY` (plaintext) |
| Mobile preview builds   | `.github/workflows/eas-preview-build.yml`, `native-preview-build.yml` | `EXPO_PUBLIC_TURNSTILE_SITE_KEY`             |
| Web production (Vercel) | `ops/env/production.env.json` → `vercel` group                        | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`             |
| Web preview (Vercel)    | `.github/workflows/ci.yml` per-branch Vercel env sync                 | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`             |

All four paths are **optional** — an unset secret is skipped, so nothing breaks
before it is added.

| Also set                 | Variable                              | Value                                                |
| ------------------------ | ------------------------------------- | ---------------------------------------------------- |
| `apps/mobile` (optional) | `EXPO_PUBLIC_TURNSTILE_WIDGET_ORIGIN` | registered host, default `https://app.iconicedu.com` |
| Supabase (local)         | `SUPABASE_AUTH_CAPTCHA_SECRET`        | secret key                                           |
| Supabase (hosted)        | Attack Protection secret field        | secret key                                           |

`EXPO_PUBLIC_*` is inlined at bundle time, so an `eas update` built with the var
set carries the key to existing installs on the same `runtimeVersion`.

### Adding the GitHub secret

1. GitHub → the repo → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret**.
3. Name: `EXPO_PUBLIC_TURNSTILE_SITE_KEY`. Value: the Cloudflare **site** key
   (the widget's secret key never goes here — it goes to Supabase).
4. **Add secret**.
5. Re-run the pipelines so the value propagates:
   - `.github/workflows/eas-update.yml` (`workflow_dispatch`) → syncs EAS
     production env, then publishes the OTA update.
   - a merge to `main` (or re-run the `ci.yml` production job) → renders
     `ops/env/production.env.json` and pushes `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
     to Vercel production.
   - the next preview build / branch deploy picks it up automatically.

If the value ever needs to differ per environment, use GitHub **Environments**
(`production` / `preview`) instead of a repo-wide secret and give each its own
`EXPO_PUBLIC_TURNSTILE_SITE_KEY`.

## Enabling it

### Local

1. In `supabase/config.toml`, uncomment the `[auth.captcha]` block (provider
   `turnstile`, `secret = "env(SUPABASE_AUTH_CAPTCHA_SECRET)"`).
2. Export `SUPABASE_AUTH_CAPTCHA_SECRET=1x0000000000000000000000000000000AA`
   before `supabase start` (or put it in `supabase/.env`).
3. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in `apps/web/.env.local` and
   `EXPO_PUBLIC_TURNSTILE_SITE_KEY` in `apps/mobile/.env` to the dummy site key.
4. `supabase stop && supabase start`.

### Production rollout (no auth outage)

1. **Merge** the app changes with the `EXPO_PUBLIC_TURNSTILE_SITE_KEY` secret
   **not yet added** — widgets don't render, no token sent, Supabase switch off.
2. **Add the GitHub secret and let CI deploy both clients while the switch is
   still off** (see "Adding the GitHub secret" above). Run `eas-update.yml` for
   the mobile OTA and merge to `main` (or re-run `ci.yml` production) for the
   Vercel web sync. Store submission is only needed if the shipped binary lacks
   the `react-native-webview` pod. Supabase ignores the token while disabled, so
   old and new clients both keep working during propagation.
3. **Wait for OTA adoption.** Watch PostHog `LOGIN_OTP_REQUESTED` for traffic
   from clients still on a pre-Turnstile `updateId` / `runtimeVersion`
   (`getMobileBuildInfo`). Proceed when that share is negligible. Web propagates
   on next page load.
4. **Flip Supabase → Authentication → Attack Protection → CAPTCHA on**, provider
   Turnstile, paste the secret key. Verify web + mobile + local OTP send _and_
   resend. Watch `LOGIN_ERROR` / `OTP_VERIFICATION_FAILED`.

## Rollback

Turn the Supabase Attack Protection switch **off** in the dashboard. Instant, no
redeploy. Clients keep sending tokens harmlessly until the app change is reverted
at leisure.

## Notes

- The CAPTCHA-gated endpoints are only hit by **logged-out** users. A user with a
  persisted session never calls them, so a not-yet-updated install keeps working
  until that device signs out.
- No CSP is set on the web app today. If one is added it must allow
  `https://challenges.cloudflare.com` for `script-src` and `frame-src`.
