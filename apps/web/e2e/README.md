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

The combined classroom runner, source-page live matrix and native tablet commands
are documented in [Native classroom testing](../../../docs/getting-started/native-classroom.md#complete-classroom-regression-suite).
Run `pnpm test:e2e:classroom ui web` from the repository root for the deterministic
browser suite. Live source journeys use `classroom-live-journeys.spec.ts` and require
the private configuration template in `ops/classroom-e2e.example.json`; they never
substitute fixture results for successful Zoom media verification.

## Specs

- `e2e/marketing-smoke.spec.ts`: public landing page smoke test.
- `e2e/sidebar-learning-spaces.spec.ts`: student sidebar classes header visibility (requires auth).
- `e2e/supervised-readonly.spec.ts`: supervised view controls disabled + thread open behavior (requires auth).

- `e2e/live-session-setup.spec.ts`: deterministic host/member/guest setup,
  passcode correction, refresh recovery, feedback, source/homepage navigation,
  the ready-to-join dialog, cancellation, clipboard copying and new-tab behavior.
  Uses production setup components at `/visual-test/live-session-setup`, synthetic
  API responses, denied media preview and an injected meeting renderer. No live
  Zoom credentials or database writes are required; live Zoom behavior is outside
  this spec. The fixture is unavailable in production.

Run the setup regression suite against the development server:

```bash
pnpm --filter web exec playwright test e2e/live-session-setup.spec.ts
```

`classroom-meeting-settings.spec.ts` covers modular meeting options, automatic
recording with stop locking, hidden collaboration controls, read-only messages,
flag-off behavior and failed-save retry. It uses `/visual-test/meeting-settings`,
which is unavailable in production, with synthetic API responses and a synthetic
recording client. No real meeting, account or hardware is required.

- `e2e/screen-annotations.spec.ts`: real Konva drawing, text editing, shape tools,
  formatting, pointer mode and aspect-fit resizing at `/visual-test/screen-annotations`.
  Uses a deterministic injected annotation engine; no Zoom credentials are required.
  The fixture is unavailable in production.

### Native Classroom whiteboard

`classroom-whiteboard.spec.ts` runs the real Excalidraw UI against local API/Supabase, including two-context collaboration. Start API on 3001, web on 3000 and local Supabase, apply migrations, then run `PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm --filter web exec playwright test classroom-whiteboard.spec.ts --workers=1`. The helper creates and cleans synthetic organizations in the local database container; no production URL is supported. This suite uses a development-only class entry and does not require Zoom credentials.

### Meeting links and admission

`meeting-link-admission.spec.ts` exercises the production link bootstrap, preview,
refresh recovery, identity transfer, waiting-room UI and local API/PostgreSQL
admission checks. Its helper creates isolated synthetic organizations and removes
them after each test. Start local Supabase and API, apply all forward migrations,
and start web before running:

```bash
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm --filter web exec playwright test e2e/meeting-link-admission.spec.ts --workers=1 --timeout=60000
```

The meeting renderer is injected; the API signs credentials normally, but tests
never connect to Zoom. Live multi-user Zoom host/manager changes and physical
phone audio routing/background interruptions require separate integration/device
validation. The fixture is unavailable in production.

`meeting-roles-audio.spec.ts` covers explicit host claiming, co-host assignment and
revocation, disabled co-host controls, and speaker testing when microphone access
is denied. Its development-only fixture uses production lifecycle helpers and
People controls with a synthetic Zoom client. It verifies application behavior;
it does not validate Zoom's remote role propagation.

### iPad and Android tablet regression

Install WebKit as well as Chromium, then run the tablet suite against local API,
Supabase and the web development server:

```bash
pnpm --filter web exec playwright install webkit chromium
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm --filter web exec playwright test --config=playwright.tablet.config.ts --workers=1 --timeout=60000
```

The suite runs link/admission and host/co-host tests under iPad WebKit and Android
tablet Chromium profiles. It also covers portrait/landscape, narrow split-view
widths, foreground/device-list refresh, offline/online transitions and identity
recovery after the **Rejoin class** action. These are browser automation profiles,
not physical tablet or Expo browser-surface tests.
