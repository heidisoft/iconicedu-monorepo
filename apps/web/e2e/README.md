# Web E2E Tests (Playwright)

## Install

```bash
pnpm --filter web install
pnpm --filter web exec playwright install
```

## Run

```bash
pnpm --filter web test:e2e
```

## Optional env vars

- `PLAYWRIGHT_BASE_URL` (default: `http://127.0.0.1:3000`)
- `PLAYWRIGHT_SKIP_WEBSERVER=1` (if web app already running)
- `PLAYWRIGHT_AUTH_STATE` (path to Playwright storage state JSON for authenticated tests)
- `PLAYWRIGHT_ORG_SLUG` (for org-scoped sidebar tests)
- `PLAYWRIGHT_SUPERVISED_PATH` (full app path for supervised conversation test, e.g. `/iconic-academy/dm/<channelId>`)

## Specs

- `e2e/marketing-smoke.spec.ts`: public landing page smoke test.
- `e2e/sidebar-learning-spaces.spec.ts`: student sidebar learning spaces header visibility (requires auth).
- `e2e/supervised-readonly.spec.ts`: supervised view controls disabled + thread open behavior (requires auth).
