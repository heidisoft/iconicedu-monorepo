# Zoom Video SDK Integration

## Purpose

Deep-dive reference for the Zoom Video SDK live-session provider: architecture,
the decisions behind it, verified SDK API behavior (including real gaps and
undocumented quirks in the installed package version), current feature
coverage, and known limitations. Written so another engineer or AI agent can
pick up this feature without re-deriving everything from scratch — a lot of
this took hours of API verification against the installed package to get
right.

## Intended Audience

Engineers and AI assistants working on live-sessions, video, or classroom
features. Read this before touching
`apps/web/components/live-sessions/zoom-video-session-embed.tsx` or
`packages/live-sessions-core/src/providers/zoom-video-sdk-provider.ts`.

## Last Updated

2026-10-02

## Related Docs

- [Documentation Hub](../README.md)
- [External Integrations](INTEGRATIONS.md) — one-line inventory row for Zoom
- [Architecture Overview](ARCHITECTURE.md)
- [ADR-004: API-first frontend boundary](../decisions/004-api-first-frontend-boundary.md)

---

## 1. Why this exists, and why it's built this way

Live sessions support multiple video providers through a clean adapter
interface (`LiveSessionProviderAdapter` in
`packages/live-sessions-core/src/types.ts`). Daily.co was the original (and
still default) provider. Zoom was added as an **additional** selectable
provider per channel (`channel_live_session_config.provider`), not a
wholesale replacement.

The critical distinction that shaped everything: this uses **Zoom Video
SDK**, not Zoom Meeting SDK, on **pay-as-you-go billing** (per
participant-minute). Video SDK has **no Zoom-hosted join URL** — there is
nothing to put in an iframe `src`. You get an SDK Key/Secret, mint a
short-lived JWT per participant, and build **100% of the meeting UI yourself**
(video tiles, mute/camera/leave controls, chat, whiteboard surface,
annotation toolbar — all of it) using `@zoom/videosdk` as a raw audio/video
engine. This is why `zoom-video-session-embed.tsx` is ~3,100 lines — it is
not a wrapper around a Zoom-provided widget, it's a full custom video-call
UI built on the app's own `@iconicedu/ui-web` design system.

Earlier in this project a Zoom pre-built UI toolkit
(`@zoom/videosdk-ui-toolkit`) was tried and deliberately abandoned in favor
of the hand-built approach, specifically to keep the look consistent with the
rest of the app (no hardcoded Zoom branding/colors) and to get full control
over host/participant permission UX.

### Why one join flow for members and anonymous guests

Classic Zoom-style "open a link, type a passcode, get in" was a requirement,
including for people with **no account at all**. Rather than branching
"authenticated member" vs "anonymous guest" into two flows, a signed-in
non-member who 403s on the normal join call is redirected to the same public
guest-join page (`apps/web/app/(public)/live/[sessionId]/page.tsx`). One flow,
not two. Guests get a synthetic `user_identity` and are tracked only via
`channel_live_session_participant_events` (nullable `profile_id`) — they
never get a `channel_live_session_participants` row (that table's
`profile_id` is `NOT NULL`), so **guests appear in the raw event timeline but
not in profile-keyed attendance reports**. This is an accepted, documented
limitation, not an oversight.

---

## 2. Architecture map

```
packages/live-sessions-core/src/
  types.ts                         LiveSessionProviderAdapter interface
  join.ts                          createOrJoinLiveSession, access control,
                                    verifyChannelMembership, hasOrgStaffRole
  providers/
    index.ts                       provider registry (daily | zoom)
    daily-provider.ts               Daily adapter
    zoom-video-sdk-provider.ts      Zoom adapter — JWT minting, passcode,
                                    webhook normalization

apps/web/
  components/live-sessions/
    zoom-video-session-embed.tsx    THE component — ~3,100 lines, all client
                                    UI: tiles, toolbar, settings, chat,
                                    participants, whiteboard, annotation,
                                    recording, captions, reactions, quality
                                    monitoring reporting
    daily-live-session-embed.tsx    sibling Daily embed (older, simpler —
                                    worth comparing when deciding whether a
                                    Zoom feature belongs here too)
    host-live-session-join.tsx       host-side join wrapper (passes onLeave)
    live-session-host.tsx           branches on provider to pick an embed
  lib/live-sessions/
    service.ts                      resolveLiveSessionJoinAccess (host
                                    determination lives here),
                                    processLiveSessionProviderWebhook
    public-api.ts                   client-side fetch helpers (guest-join,
                                    feedback, quality-events, audit-events)
  lib/admin/
    live-session-attendance.ts      admin dashboard queries, including
                                    getAdminLiveSessionQualityEvents
  app/(public)/live/[sessionId]/    guest landing page (passcode entry)
  app/(app)/[orgSlug]/admin/attendance/sessions/[sessionId]/
    live-session-attendance-detail.tsx   renders the "Connection quality
                                        issues" card

apps/api/src/modules/live-sessions/
  live-sessions.service.ts          joinLiveSession, guestJoinLiveSession,
                                    submitLiveSessionFeedback,
                                    reportLiveSessionQualityEvent,
                                    logLiveSessionAuditEvent (all with
                                    process-local rate limiting)
  live-sessions-public.controller.ts   no-auth-required routes (guest-join,
                                       public-info, feedback, quality-events,
                                       audit-events) — auth-aware via an
                                       OPTIONAL bearer token, not auth-gated
  dto/                               one parse function per endpoint,
                                    hand-rolled validation (no class-validator
                                    in this module)

apps/web/app/api/webhooks/live-sessions/[provider]/route.ts
                                    shared webhook endpoint for both
                                    providers; handles Zoom's one-time
                                    endpoint.url_validation handshake

supabase/migrations/
  20260302000100_020_channel_live_sessions.sql           core tables
  20260303000100_023_live_session_attendance_reporting.sql attendance cols
  20261001000000_channel_live_session_feedback.sql        post-call rating
  20261002000000_channel_live_session_quality_and_audit_events.sql
                                    FR-043/FR-044 tables (see §6)
```

---

## 3. Key decision points (with rationale)

| Decision                       | What was chosen                                                                                                                                     | Why                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider auth model            | Custom HS256 JWT signed with the Video SDK Key/Secret, **not** OAuth                                                                                | Video SDK's join auth is unrelated to Zoom's Server-to-Server OAuth (that's reserved, unimplemented, for optional future REST calls like recording retrieval)                                                                                                                                                                       |
| Host determination             | `profile.kind === 'educator'` OR org staff role (owner/admin/staff) — see `resolveLiveSessionJoinAccess` in `apps/web/lib/live-sessions/service.ts` | **Previously** host was `profile.id === started_by_profile_id` — whoever happened to call join first. A student joining early could outrank the teacher. Fixed 2026-10-02; `hasOrgStaffRole` was made an exported function in `join.ts` specifically to be reusable here                                                            |
| Default screen-share privilege | `SharePrivilege.MultipleShare` (anyone can share, teacher can restrict via Settings → Advanced)                                                     | Matches "student can share, teacher can restrict" requirement without a backend policy table — this is a **client/session-scoped** Zoom setting, not persisted to the database. It resets every new session instance                                                                                                                |
| Local share preview element    | Always `<video>`, never `<canvas>`, chosen unconditionally                                                                                          | A real observed SDK console warning ("Use Video element instead of Canvas element when WebCodecs enabled") on WebCodecs-capable browsers; `<video>` was confirmed to work in both cases. `stream.isStartShareScreenWithVideoElement()` exists but was deliberately left unused — don't "improve" this without re-testing both paths |
| Raise hand / reactions         | Built on the generic `CommandChannel` (`client.getCommandClient().send()`), not a dedicated API                                                     | **Confirmed: no native raise-hand or reaction-send API exists in this installed SDK version.** `reaction.sendEmojiReactionRequest` appears only in exception-code doc comments, not in any exported type — do not assume it exists without re-checking `node_modules/@zoom/videosdk/dist/types/*.d.ts` after any SDK upgrade        |
| Whiteboard permission locking  | Not implemented — flagged as currently impossible                                                                                                   | `setWhiteboardPermission()` / `lockWhiteboardPermission()` / `getWhiteboardPermission()` are **commented out** in `whiteboard.d.ts` in the installed SDK version, despite the `WhiteboardSharePermissionCode` enum existing. Re-check after an SDK bump — this may become available                                                 |
| Annotation tool coverage       | Only Pen/Highlighter/Arrow/Eraser exposed in the UI                                                                                                 | `AnnotationToolType` actually also has `Spotlight` (laser pointer), `Line`, `Rectangle`/`Ellipse`/`Diamond` (+ fill variants), and stamp shapes — these are real, unused, easy wins if asked for. No `Text` or equation tool exists anywhere in the SDK (whiteboard or annotation)                                                  |
| Multi-participant UI           | Data model assumes exactly one `otherParticipant` (1:1 tutoring)                                                                                    | `peer-share-state-change` (concurrent multi-share) and `SubsessionClient` (breakout rooms) are real, fully unused APIs — building true group/gallery support is a bigger, deliberate scope decision, not a bug                                                                                                                      |
| Audit logging                  | New `channel_live_session_audit_events` table, logged from the **client** after the action already happened                                         | Fire-and-forget by design — a failed audit write must never block or roll back a privileged action. Currently a stub: only `mute_participant`, `end_session_for_all`, `recording_started` are logged, and there is no admin UI reading this table yet                                                                               |
| Connection-quality monitoring  | Self-reported only (`payload.userId === selfUserIdRef.current` before reporting to the backend)                                                     | Avoids every observer separately reporting the same remote peer's perceived quality, which would duplicate/conflict. Each client reports its _own_ degraded transitions only                                                                                                                                                        |

---

## 4. Zoom Video SDK: verified API quirks (don't re-derive these)

These were confirmed by grepping the **installed** `node_modules/@zoom/videosdk/dist/types/*.d.ts`, not by trusting the public docs site — the docs and the installed package have at least one confirmed mismatch (see below). **Always re-verify against the installed package after any `@zoom/videosdk` version bump; do not trust prior knowledge of "what Zoom's API looks like."**

- **Doc vs. package mismatch (caught once already):** the official share-browser-options doc page describes `ScreenShareOption.controls.systemAudio`. This field **does not exist** in the installed package. The real field is `hideShareAudioOption?: boolean`.
- `SharePrivilege` is a 3-value enum (`Unlocked=0`, `Locked=1`, `MultipleShare=3`), set via `stream.setSharePrivilege()` / read via `getSharePrivilege()`, synced via the `'share-privilege-change'` event. An earlier implementation wrongly used a binary `lockShare(boolean)` — that method exists but is the _wrong_ API for this; it's a different, simpler toggle meant for a different use case.
- `stream.getActiveCamera()/getActiveMicrophone()/getActiveSpeaker()` can return `''` or the literal string `'default'`, neither of which matches a real `deviceId` — always fall back to the first listed device.
- `stream.mirrorVideo(mirrored: boolean)` is the SDK's own mirror API — use it instead of a CSS transform; it only affects local rendering, never the transmitted track.
- `client.leave(end?: boolean)` — passing `true` ends the session for every participant, not just the caller. Easy to miss since the no-argument form is far more commonly shown in examples.
- `'passively-stop-share'` event payload is the **bare `PassiveStopShareReason` enum value**, not wrapped in an object: `PrivilegeChange | StopScreenCapture`. Needed to keep `isSharingScreen` in sync when the user stops sharing via the browser's native "Stop sharing" bar instead of our own button.
- `'network-quality-change'` fires per-user, per-direction: `{ userId, type: 'uplink'|'downlink', level: 0-5 }` (0-1 bad, 2 normal, 3-5 good). Uplink and downlink must be tracked **separately** — merging into a single "worst-ever" value without separately-updatable slots means a later improvement on one direction gets permanently masked by an old bad reading on the other.
- `'connection-change'` is about **your own** connection (`ConnectionState`: `Connected | Reconnecting | Closed | Fail`), not a specific remote peer's.
- `'annotation-privilege-change'` fires for **viewers only** — a presenter disabling "viewer can annotate" should not affect their own annotation rights; gate any reaction to this event on "am I currently the presenter."
- `CommandChannel.send(text, target?)` — `target` can be a `userId`, `{ userKey | userGuid }`, or `{ scope: 'currentSession' | 'all' }` (the latter reaches breakout rooms too). Omitting `target` broadcasts to the current session.
- `RecordingClient.canStartRecording()` must be checked before `startCloudRecording()` — it covers the case where cloud recording isn't enabled for the account/session. `startCloudRecording()` resolves to `'' | Error` rather than rejecting on failure — check the resolved value, don't rely solely on a try/catch or the `'recording-change'` event.
- `WhiteboardClient.canStartWhiteboard()` is the single authoritative start-gate (folds in permissions, current sharing state, and whiteboard status) — a `false` result used to be a silent no-op before this was wired up to show an error.
- `LiveTranscriptionClient` (captions) is a complete, fully real API (`startLiveTranscription`, `disableCaptions`, `lockTranscriptionLanguage`, `getFullTranscriptionHistory`, etc.) that was entirely unused until the current captions stub.
- `SubsessionClient` is Zoom's name for **breakout rooms** (`createSubsessions`, `assignUserToSubsession`, `closeAllSubsessions`, `askForHelp`, `broadcast`, ...) — fully real, fully unused.

---

## 5. Non-obvious bugs fixed this cycle (read before touching layout/CSS)

- **Tailwind arbitrary value silently drops a whole declaration:** `bottom-[max(1rem,env(safe-area-inset-bottom))]` (nested function calls with a comma inside Tailwind's bracket syntax) silently failed to compile and dropped the entire `bottom` rule across multiple Tailwind/PostCSS versions — this was the root cause of a recurring "control bar isn't at the bottom" complaint across several review cycles. **Fixed by moving to inline `style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}`.** If a Tailwind arbitrary value involving nested `()`/commas silently has no effect, suspect the parser, not your class name.
- **Gallery/side-by-side tiles invisible:** the `sideBySide` grid had no explicit `grid-rows-*`, so its row defaulted to `auto` (indefinite height) — every tile's `h-full` then resolved against an indefinite height and collapsed to zero. Fixed with `grid-rows-2 sm:grid-rows-1` (Tailwind's numeric `grid-rows-N` emits `repeat(N, minmax(0,1fr))`, which is a _definite_ track size, unlike the default).
- **Full-screen portal stuck after leaving:** Next.js App Router's `router.push()` runs inside a transition that can keep the old page's DOM (including a `fixed inset-0 z-40` full-screen embed) mounted and visible on top of the destination page until the transition settles, or indefinitely if the embed doesn't unmount cleanly. Fixed with a `hasLeft` state that makes the component `return null` immediately on leave, independent of the parent's navigation timing.
- **No hardcoded hues:** `text-amber-500` / `text-emerald-500` were used for the network-quality icon and raise-hand badge in an early pass of this work and then corrected to the project's real semantic tokens (`text-warning`, `text-success`, `bg-warning` / `text-warning-foreground`) — see `palette-refresh-tokens.md`. If you see a raw Tailwind color name in this file, it's probably a bug, not a style choice.
- **Camera tiles rendering at the wrong size (letterboxed/floating badges):** `attachVideo()`'s returned `<video-player>` custom element **must be a descendant of a `<video-player-container>`** (Zoom's own custom element) — this is explicitly documented on `attachVideo`/`attachShareView` in `media.d.ts` but is easy to miss. Appending it straight into a plain `<div>` (what `attachCameraTile` used to do) means the player never gets the SDK's internal sizing logic applied, so it can render smaller than its actual container — visible as a blank gap above/around the real video image, with anything positioned via `absolute` relative to the _intended_ tile (e.g. the corner status badges) appearing to float in empty space rather than over the video. `attachCameraTile` now creates/reuses a `<video-player-container class="block h-full w-full">` wrapper and appends the `<video-player>` into _that_, not directly into the ref'd div. Custom elements also default to `display: inline` with zero intrinsic size — don't forget to size the container explicitly. Note this requirement is specific to `attachVideo()`/`attachShareView()`; the older `startShareView(canvas, userId)` / `startShareScreen(videoOrCanvas, options)` share APIs take a plain `<canvas>`/`<video>` directly and have no such requirement.

---

## 6. Current feature coverage (snapshot — re-verify before trusting)

This is a point-in-time snapshot from an FR-by-FR audit against 50 functional
requirements plus a feature-priority table. **Treat this section as likely
stale** the moment new work lands — confirm against the actual code
(`grep`, don't assume) before recommending anything from this table.

### Implemented

Camera/mic + pre-call device selection, screen share (teacher + student,
host-configurable 3-way privilege), participant list (read-only + host mute
action), host/co-host-adjacent host-fix (educator/staff always host),
annotation (subset of tools), whiteboard (start/view/stop/export-to-PDF, no
permission locking — see §4), chat, raise hand, reactions, network-quality +
connection-state indicators, "leave vs. end-for-everyone" with confirmation,
captions (stub), recording (auto-starts for host, `canStartRecording()`
gated), post-call feedback/rating, guest passcode join, connection-quality
reporting to a new admin-visible table, audit-event logging (stub, no UI),
webhook-driven attendance tracking, admin attendance dashboard.

### Partial / stubbed

- Audit log: writes rows, nothing reads them in any UI yet.
- Captions: on/off only, no language selection, no translation.
- Screen-share policy: client/session-scoped only, no backend academy-level
  policy table (`channel_live_session_config` does not have a share-privilege
  column).
- Recording: no backend authorization policy by academy; whoever Zoom
  considers host can record.

### Not implemented (confirmed real gaps, not yet asked for)

Waiting room / admit-participant flow, remove/kick a participant
(`client.removeUser()` is real and unused), co-host promotion
(`client.makeManager()`/`makeHost()` real and unused), disable a remote
participant's camera (no such API exists in Video SDK at all — audio has
`muteAudio(userId)`, video has no equivalent "force off"), polls/quizzes (no
native SDK support), breakout rooms (`SubsessionClient`, real and unused),
guardian-facing session views, staff live-ops dashboard (today's admin
dashboard is post-hoc attendance history, not a live "which rooms are active
right now" view), lesson notes/homework fields, reschedule-cascades-to-room
automation.

---

## 7. Environment/testing gotchas specific to this feature

- `packages/ui-web/vitest.config.ts` hardcodes `pool: 'vmThreads'`, which
  breaks under Node 20 (this repo targets Node 24) with
  `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING` in some sandboxes — an environment
  artifact, not a code bug. Use `--pool=forks` to get real signal if you hit
  this.
- jsdom defines `window.scrollTo` but it **throws** "Not implemented" when
  called — `if (!window.scrollTo)` guards never catch this since the property
  already exists. framer-motion's keyframes resolver calls it during
  exit-animation measurement; left unhandled this silently aborts
  AnimatePresence exit callbacks. Already patched in
  `packages/ui-web/src/vitest.setup.ts` with an unconditional override — don't
  revert it.
- jsdom's `getBoundingClientRect` always returns a zero-size rect — also
  patched in the same setup file with a plausible non-zero stub, needed for
  any `height: 'auto'` framer-motion animation under test.
- The embed is portaled to `document.body` via `createPortal` — if you add a
  new absolutely-positioned overlay, confirm its nearest `position: relative`
  ancestor is the stage div (`relative min-h-0 flex-1 overflow-hidden
bg-muted`), not assume React tree nesting implies DOM nesting; `tsc` will
  catch unbalanced JSX but never catches "wrong parent for `absolute`."

---

## 8. If you're picking this up next

- Don't trust this document's API claims blindly either — re-grep
  `node_modules/@zoom/videosdk/dist/types/*.d.ts` for anything load-bearing
  before writing code against it, especially after any `package.json` bump
  of `@zoom/videosdk`.
- The highest-value, lowest-effort next additions (APIs already confirmed to
  exist, just unused): remove/kick a participant, co-host promotion, a
  waiting-room gate built in front of `getJoinAccess`.
- The whiteboard permission-locking gap (§3, §4) may simply disappear on the
  next SDK upgrade — check `whiteboard.d.ts` for un-commented
  `setWhiteboardPermission`/`lockWhiteboardPermission` before assuming it's
  still unavailable.
- Multi-participant (>2) support is a real architectural gap, not a small
  tweak — `otherParticipant` is singular throughout the component. Scope that
  properly before starting rather than bolting arrays onto the existing
  single-peer assumptions.
