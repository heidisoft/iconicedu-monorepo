# Web E2E Tests (Playwright)

Playwright covers browser-level behavior in `apps/web`. The root [setup guide](../../../docs/getting-started/setup.md) must be complete first.

## Install Browsers

```bash
pnpm install
pnpm --filter web exec playwright install --with-deps
```

## Run

```bash
pnpm --filter web test:e2e
```

By default Playwright starts the web development server and targets `http://127.0.0.1:3000`. Start local Supabase and the API separately for scenarios that depend on authenticated or table-backed behavior.

Useful modes:

```bash
pnpm --filter web test:e2e:headed
pnpm --filter web test:e2e:ui
```

## Optional env vars

- `PLAYWRIGHT_BASE_URL` (default: `http://127.0.0.1:3000`)
- `PLAYWRIGHT_SKIP_WEBSERVER=1` (if web app already running)
- `PLAYWRIGHT_AUTH_STATE` (path to Playwright storage state JSON for authenticated tests)
- `PLAYWRIGHT_ORG_SLUG` (for org-scoped sidebar tests)
- `PLAYWRIGHT_SUPERVISED_PATH` (full app path for supervised conversation test, e.g. `/iconic-academy/dm/<channelId>`)

Do not commit an authenticated storage-state file. It contains reusable session data.

## Specs

- `e2e/marketing-smoke.spec.ts`: public landing page smoke test.
- `e2e/sidebar-learning-spaces.spec.ts`: student sidebar classes header visibility (requires auth).
- `e2e/supervised-readonly.spec.ts`: supervised view controls disabled + thread open behavior (requires auth).
