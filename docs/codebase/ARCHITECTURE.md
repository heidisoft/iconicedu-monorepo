# Architecture

## Core Sections (Required)

### 1) Architectural Style

- Primary style: **API-first, multi-frontend monorepo** — two thin frontend clients (web, mobile) that hold no business logic, talking to one backend (`apps/api`) that owns all data access; feature-based module organization within each app rather than strict horizontal layering.
- Why this classification: enforced explicitly as ADR-004 ("API-First Frontend Data Boundary") and the "Web And Mobile Are Frontend-Only" hard rule in `AGENTS.md`; verified in practice — `apps/api` modules mix direct Prisma (`PrismaService`) and Supabase-client (`createSupabaseServiceClient`/`createSupabaseSessionClient`) access, while `apps/web`/`apps/mobile` route table-backed reads/writes through typed HTTP clients.
- Primary constraints: (1) Row Level Security enabled on every Postgres table as defense-in-depth even though API authorization is the primary boundary (`supabase/migrations/`); (2) Supabase migrations are the schema source of truth, Prisma schema is a mirror, never the reverse (`apps/api/prisma/schema.prisma`); (3) new user-facing web features must ship behind a PostHog-backed feature flag defaulting off (`apps/web/flags.ts`, `scripts/check-feature-flag-gating.mjs`).

### 2) System Flow

```text
Web/Mobile UI (Server Component or screen)
  -> typed HTTP client (createApiClient / apiGet|apiPost|...) with Supabase bearer session attached
  -> NestJS controller (@UseGuards(AuthGuard)) in apps/api/src/modules/<feature>
  -> service layer (Prisma or Supabase service/session client)
  -> Supabase Postgres (RLS enabled, service-role bypasses when the API acts on the platform's behalf)
  -> shared VM/response type from @iconicedu/shared-types
  -> UI renders VM; Realtime subscription (mobile) or refetch reconciles cache
```

### 3) Layer/Module Responsibilities

| Layer or module                                         | Owns                                                                                             | Must not own                                                                            | Evidence                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/web`, `apps/mobile`                               | Routing, rendering, calling `apps/api`, Supabase Auth/Realtime/Storage SDK use                   | Table queries/mutations, validation, business rules, service-role credentials           | `docs/decisions/004-api-first-frontend-boundary.md`                |
| `apps/api/src/modules/*`                                | Controllers, services, business rules, authorization, per-module DTOs                            | UI concerns                                                                             | `apps/api/src/modules/channels/`, `apps/api/src/modules/messages/` |
| `apps/api/src/lib/supabase/`                            | Supabase service-role and session-scoped client factories                                        | —                                                                                       | `apps/api/src/lib/supabase/service.ts`, `session.ts`               |
| `apps/api/src/observability/`                           | Global exception filter, request logging interceptor, request-context propagation                | Business logic                                                                          | `apps/api/src/observability/global-exception.filter.ts`            |
| `apps/api/src/modules/events/event-pipeline.service.ts` | Leases and dispatches `event_pipeline_jobs` rows (activity generation, notifications, reminders) | —                                                                                       | `apps/api/src/modules/events/event-pipeline.service.ts`            |
| `supabase/functions/*`                                  | pg_cron-triggered thin bridges that call `apps/api` internal endpoints (token-authed)            | Direct table writes bypassing `apps/api` (explicitly forbidden in `reminders-dispatch`) | `supabase/functions/reminders-dispatch/index.ts:4-7`               |
| `packages/shared-types`                                 | Rows (snake_case, DB-facing), VMs (camelCase, UI-facing), payloads, and cross-app contracts      | Executable helpers, app-specific logic, authorization, or I/O                           | `packages/shared-types/src/{rows,vm,payloads}`                     |
| `packages/utils`                                        | Pure, framework-neutral executable helpers, including shared contract conversions                | App-specific policy, authorization, or I/O                                              | `packages/utils/src/message-mappers.ts`                            |

### 4) Reused Patterns

| Pattern                                        | Where found                                                                                                                                            | Why it exists                                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Transactional outbox + polled job queue        | `event_outbox`, `event_pipeline_jobs` tables; `apps/api/src/modules/events/event-pipeline.service.ts`; edge functions polling via pg_cron every minute | At-least-once delivery for domain events (activity feed, notifications, reminders) without a separate message broker                        |
| Guard + request-context middleware for auth    | `apps/api/src/modules/auth/auth.guard.ts`, `apps/api/src/main.ts` (request-context middleware)                                                         | Per-route (not global) auth enforcement; decodes Supabase JWT, attaches `req.user`, propagates request id/role for logging                  |
| Typed HTTP client adapter (thin fetch wrapper) | `apps/web/lib/api/http-client.ts`, `apps/mobile/src/lib/api/http-client.ts`                                                                            | Single place to attach bearer auth and normalize error handling instead of scattered raw `fetch` calls                                      |
| Row → VM mapper layer                          | `packages/utils/src/message-mappers.ts`, `packages/shared-types/src/{rows,vm,payloads}`                                                                | Keeps DB shape (snake_case, nullable) separate from UI-ready shape (camelCase, non-null) without duplicating pure mapping logic across apps |
| API-owned message visibility policy            | `apps/api/src/lib/messages/message-visibility.ts`, enforced by `apps/api/src/modules/messages/messages.service.ts`                                     | Ensures targeted messages are authorized before response mapping or delivery to a frontend                                                  |
| Feature flag gate (server-evaluated)           | `apps/web/flags.ts` (`flag<boolean>({..., decide: evaluateWebBooleanFlag})`), enforced by `scripts/check-feature-flag-gating.mjs`                      | New web UI ships dark by default, evaluated against PostHog per-profile                                                                     |
| Discriminated unions for polymorphic content   | `messages`/`message_text`/`message_file`/`message_audio` tables and their VMs                                                                          | Messages have heterogeneous payload types (text/file/audio) sharing a common envelope                                                       |

### 5) Known Architectural Risks

- **Inconsistent data-access layer inside apps/api**: some services use `PrismaService`, others call the Supabase client directly (`createSupabaseServiceClient`/`createSupabaseSessionClient`), rather than a single uniform ORM boundary — increases the surface area for query-pattern drift between the two access paths (`apps/api/src/modules/channels/channels.service.ts` vs. `apps/api/src/modules/messages/*`).
- **DTO validation gap**: a global `ValidationPipe` is registered and `class-validator`/`class-transformer` are dependencies, but no `class-validator` decorators exist anywhere in `apps/api/src` — validation is instead hand-rolled per-DTO (e.g. `apps/api/src/modules/schedules/dto/replace-schedules.dto.ts`), so the global pipe is effectively inert and validation coverage depends on each module remembering to hand-roll checks. See [CONCERNS.md](CONCERNS.md).
- **Dual data-fetching pattern in `apps/web`**: some Server Components go through `createApiClient` (the documented/enforced path), others (e.g. `apps/web/lib/org/builders/org.builder.ts`) query Supabase directly — both patterns coexist in production code, which is exactly the "migration debt" ADR-004 acknowledges but does not fully track.

### 6) Evidence

- `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- `apps/api/src/modules/auth/auth.guard.ts`, `apps/api/src/modules/events/event-pipeline.service.ts`
- `apps/web/lib/api/http-client.ts`, `apps/mobile/src/lib/api/http-client.ts`
- `docs/decisions/004-api-first-frontend-boundary.md`

## Extended Sections (Optional)

Not populated — the primary flow, layer table, and risks above cover this repo's architecture at the depth needed for onboarding.

### Parent joins for live classes

The live-session API resolves signed-in guardian accounts to active linked children enrolled in the session's class. Public session info returns those student options only to the verified guardian. The web device preview automatically selects a sole eligible student and requires a choice when multiple students are enrolled. Parents with no eligible student cannot join as the account holder.

The join endpoint rechecks the family link and class enrollment before issuing participant credentials with the student's canonical name and profile ID. It also issues whiteboard and annotation capabilities with that name, keeping the meeting and collaboration identity consistent without granting host privileges. Refresh recovery preserves the selected student only for the same authenticated account while that student remains eligible.

The device preview places the name badge and microphone/camera controls on the video tile, matching the in-call layout. An explicit preview name edit is validated by the join API and changes the meeting label, whiteboard capability, and participant annotation capability; it never changes the selected profile or host authorization. Device buttons reflect actual acquired tracks, and retrying a denied device requests permission for that device alone.

Preview settings reuse the call's Settings dialog with Audio, Video, and Advanced tabs. The Settings button matches the round microphone/camera controls beside the name badge. Personal options include input/output devices, audio processing, mirroring, backgrounds, hardware acceleration, and the existing picture-in-picture preference. Switching an enabled device acquires its replacement before stopping the previous track, while selecting a muted device preserves its off state. Selected device IDs are passed to the Zoom SDK's native capture options and retained in the existing per-session refresh recovery. Browser device-change events refresh the available choices.

Background effects in preview initialize the Zoom SDK before starting its native local video track, using the recommended video-player surface and segmentation loaded on demand. Preview and meeting initialization enable native virtual backgrounds without SharedArrayBuffer. Failed background setup restores browser camera capture with feedback. Preview capture is released before joining; media preferences are passed to native meeting capture options and retained for same-session reconnects. Host-only screen-sharing policies remain available inside the meeting.

Meeting background choices are discovered from PNG, JPEG, WebP, AVIF, and SVG files directly in `apps/web/public/live-session-backgrounds`. A lazy bundler context watches directory additions and removals during development without loading image modules into the gallery; the production list is discovered at build time; deploy a new build to publish new images. Settings show a thumbnail gallery alongside No effect and Blur background, with a checkmark and pressed state for the selected option. Filenames become stable image IDs, and only public asset paths are used.

### Sharing live meeting links

Zoom meeting URLs never contain a raw passcode. Plain short links require guests to
enter the separately shared passcode. Copied invitation links append `#invite=<opaque token>`;
`apps/api` validates that capability before issuing participant credentials. Invitations
expire after seven days, stop working when the passcode changes or the session ends,
and cannot bypass disabled guest invitations. Verified signed-in users never need to enter a passcode; invitation
restrictions and guardian enrollment checks still apply. Org staff, admins and owners
may join any classroom in their own org without membership or a passcode, including
when shared invitations are disabled. The verified session starter, classroom educators,
and same-org staff/admins/owners receive signed host credentials. Zoom claims host on join;
authorized participants can use **Claim host** to reclaim it after a transfer. Students and
guests receive participant credentials unless the signed-in student started the session.
Apply migration `20261011230000_live_session_staff_host.sql` for staff host authorization.
Host permissions also govern screen-annotation moderation.

Short meeting links are a core feature and require no feature flag or PostHog evaluation.
Apply migration `20261011150000_live_session_share_codes.sql` before deploying the code.
Links use `/live/a3f8-b2d4-c9e1`: three groups of four hexadecimal characters backed by a
random, unique database code. This is a public locator, not a credential. Resolution
belongs to the API and excludes deleted and non-Zoom sessions; ended sessions show the
ended screen. The canonical UUID is used for subsequent joins, feedback, and collaboration.
Existing UUID links continue working and generate short share links when a code is available.
Guest passcodes in legacy query strings are ignored; previously shared copies cannot be
erased from browser history or third-party logs.

Existing stored Zoom join paths are cleaned by the forward migration. The table is
accessed through Supabase in the API and is not represented in the current Prisma schema.
No new environment variables are required. Public session info uses
`Cache-Control: no-store`. The landing page disables indexing and uses a no-referrer policy.
The feature-flag exemption is explicit user authorization to make short links core behavior.

The authenticated channel join response includes the Zoom passcode separately from its URL.
The “Session ready to join” dialog displays it with a separate copy action, allowing
participants to enter and share the passcode without putting it in a link. Public
session information never returns a guest passcode. Copy link uses the invitation URL
when available; a separate passcode copy action remains available.

All web join dialogs use the same compact shared component with inline link and passcode
rows and accessible copy icons at the right. Both Open and Copy link use the invitation
capability after it resolves; copying is disabled while the invitation is loading. URL-only classroom, homepage and
session entry points resolve passcodes through an authenticated `share-info` API endpoint
that verifies tenant and classroom access. Activity-feed joins use the typed API adapter
provided by the app instead of an obsolete web endpoint. Native session cards, classroom
headers and classroom info sheets display the same separate, selectable passcode section
with its own share action. External provider links without a known passcode omit that section.

Mobile binaries with the native Zoom SDK open app-hosted classrooms in the native preview and meeting route. Older binaries open these meetings with Expo WebBrowser. An authenticated
`browser-handoff` request issues a single-use capability that expires in 60 seconds.
The browser removes it from the fragment and redeems it via a POST body for four-hour,
meeting-only access. This preserves the mobile identity and host authorization without
creating a browser account session or transferring mobile access/refresh tokens.
Invitations never carry the sender's identity. Mobile handoffs and invitation links skip
name and passcode entry, then show the camera and microphone preview. Participants choose
their devices and explicitly press Join session before entering the meeting. Guardian
enrollment and child selection still apply. External providers keep their
existing links. Invalid links show an alert, rather than falling back to anonymous access.
Apply `20261012010000_live_session_browser_links.sql` before deploying. The API owns
hash-only token persistence, expiry, passcode rotation checks and atomic handoff consumption;
RLS and grants deny frontend access. Expired token rows are removed hourly by pg_cron.
The annotation capability retains authorized host moderation without a full app login.

### Meeting admission and recovery

Meeting links use tab-scoped `sessionStorage` to recover invitation access or a
personal mobile identity across preview and meeting refreshes. Capabilities are
removed from the URL before loading meeting media and cleared on explicit leave.
Recovery is optional when browser storage is unavailable. The API revalidates
session status, capability expiration, identity and invitation policy; browser
storage never grants classroom privileges.

Mobile handoff redemption uses a fresh browser-generated retry secret. A locked
PostgreSQL transaction issues one access capability and binds subsequent retries
to that secret for the original 60-second handoff lifetime. A lost response can
be retried without consuming another handoff. A different browser secret cannot
redeem an already-bound handoff. Database rows store hashes only.

The existing `classroom-meeting-settings` flag (default off) gates configuration
of admission modes and co-host controls. Existing meetings default to Open:

- **Open:** valid invitations, passcodes or verified signed-in identities admit
  participants under the existing invitation policy.
- **Trusted:** enrolled classroom participants enter directly; other permitted
  participants wait for teacher or staff approval.
- **Restricted:** participants require approval; authorized teachers, staff and
  the session starter can enter directly.

Disabling shared invitations still blocks nonmembers in every mode. Signed-in
users never enter a passcode. Guardians must select an eligible enrolled child;
that child's enrollment determines trusted admission.

Waiting-room requests are bound to the session, verified identity/selected child,
original display name and current passcode. Provider credentials are withheld
until approval. Requests expire after four hours and cancellation removes a
pending request from the moderator queue. Only API-verified eligible hosts can
list or decide requests; a guest invitation is insufficient. Concurrent decisions
update only requests still waiting, preventing a later decision from overwriting
an earlier one.

Joining never automatically reclaims an active Zoom host. Eligible teachers and
staff explicitly use **Claim host**. With co-host controls enabled, the current
host can grant/revoke Zoom manager privileges through People; co-hosts can mute
participants without replacing the host. Ending the session and assigning
co-hosts remain host-only. Waiting-room approval additionally requires verified
classroom host eligibility, so promoting an anonymous participant does not grant
API classroom privileges.

Native ready dialogs close before launching the meeting browser. On iPad/iOS,
launch waits for the native modal dismissal callback; Android launches after the
hidden state is committed. Joining does not trigger a competing notification
permission prompt. Message meeting buttons use the same personal browser handoff
as the Sessions screen and show an error if opening fails.

Device preview includes a Test audio and video icon beside Settings. It opens a compact dialog with microphone activity, a user-triggered speaker test, camera guidance, and a shortcut to device settings. Closing it keeps the participant in preview.
The meter uses the existing preview stream and releases its audio-analysis
resources without stopping preview tracks. Speaker routing uses browser support;
unsupported selected outputs show guidance to use device audio settings.

Legacy signed-in Zoom meeting URLs resolve access through the API and redirect to
the shared public setup route. They cannot issue provider credentials or bypass
preview and admission. Other meeting providers retain their existing join flow.

The native classroom keeps media in the iOS/Android Zoom Video SDK and uses the same API authorization, admission and collaboration contracts as web. The app-owned whiteboard embeds a bundled offline drawing canvas; capabilities remain in native HTTP adapters. ReplayKit and Android foreground services own device screen broadcasts. SDK secrets remain server-only. See [native classroom development and verification](../getting-started/native-classroom.md).

The browser fallback opens personal handoffs full screen on iPadOS/iOS. Android uses a
separate Custom Tab task with proxy-activity protection and a recents entry so
users can return after switching apps. Default Android browser sharing is disabled;
participants share invitations through meeting controls instead of personal handoffs.
See the [Expo WebBrowser options](https://docs.expo.dev/versions/v55.0.0/sdk/webbrowser/).

On foreground return, page restoration, network recovery or browser device changes,
the meeting refreshes available devices without enabling a camera or microphone.
A failed Zoom connection offers **Rejoin class**, which reloads with existing
tab-scoped recovery, independently of the explicit leave action. Browser suspension
and operating-system audio interruptions do not guarantee continued background media.

Classroom whiteboards under 600 pixels wide hide the Saved/participants bar to prioritize drawing space. The horizontal scrolling toolbar moves to the top, with quick styles below it. Wider boards retain board details and participant controls.

Meeting quality-event reads go through the authenticated API, which requires an owner, admin, or staff account in the session organization. Audit writes require verified meeting-host authorization and attribute the action to that caller. Guest passcode and link throttles count failed verification attempts; successful classroom joins do not consume the shared-IP allowance.
