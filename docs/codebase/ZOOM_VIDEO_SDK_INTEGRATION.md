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

2026-10-03

## Related Docs

- [Documentation Hub](../README.md)
- [External Integrations](INTEGRATIONS.md) — one-line inventory row for Zoom
- [Architecture Overview](ARCHITECTURE.md)
- [ADR-005: Zoom Video SDK as a live-session video provider](../decisions/005-zoom-video-sdk-live-sessions.md) — why Zoom/Video SDK/hand-built UI were chosen, alternatives considered, and accepted trade-offs
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
annotation toggle — all of it) using `@zoom/videosdk` as a raw audio/video
engine. It is not a wrapper around a Zoom-provided widget; it is a custom
video-call UI built on the app's own `@iconicedu/ui-web` design system. The
session shell coordinates SDK state, while reusable meeting UI lives in the
adjacent `zoom-video/` component directory.

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

## Service selection

Use the service that owns the feature; an enabled subscription does not mean the application invokes it.

| Feature                                  | Owning Zoom service and API                                                                                                                                  | Current integration                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Video, audio, chat, screen sharing       | Video SDK Session; `@zoom/videosdk` media/chat clients, API-side Video SDK JWT signing                                                                       | Implemented; sessions start through SDK join, without a Meetings REST create call                                                                                    |
| Whiteboard and screen-share annotation   | Video SDK `getWhiteboardClient()` and media-stream annotation APIs                                                                                           | Implemented; interactive Whiteboard account/device access must still pass SDK capability checks                                                                      |
| Start/stop cloud recording               | Video SDK Cloud Recording; `getRecordingClient().startCloudRecording()/stopCloudRecording()`                                                                 | Implemented; host and account capability checks                                                                                                                      |
| Live captions and translation            | Developer Live Translation and Transcription; `getLiveTranscriptionClient()`                                                                                 | Captions implemented; translation language selection is not implemented. Caption visibility is local; `disableCaptions` is host-only and changes session-wide access |
| Recording transcript and AI summary      | Video SDK Cloud Recording Transcript / AI Summary; host JWT `cloud_recording_transcript_option` (`1` transcript, `2` transcript plus summary)                | Not requested by current JWTs; retrieval and completion-webhook handling are not implemented                                                                         |
| Recording files and generated artifacts  | Video SDK REST `GET /videosdk/sessions/{sessionId}/recordings` and `session.recording_transcript_completed` / `session.recording_summary_completed` webhooks | Any implementation belongs in `apps/api`, using Video SDK REST authentication and the actual Zoom session ID, not the app's session name or a Zoom Meetings ID       |
| SIP/H.323 room devices                   | Video SDK Cloud Room Connector                                                                                                                               | Not currently integrated; unrelated to browser whiteboard mounting                                                                                                   |
| Provider quality telemetry subscriptions | Video SDK Quality of Service Subscription                                                                                                                    | Not currently consumed; UI network-quality events and our API quality reports are separate from QSS ingestion                                                        |
| Synchronized customer/agent web browsing | Cobrowse SDK                                                                                                                                                 | Not integrated; do not substitute its annotation APIs for Video SDK screen-share annotation                                                                          |
| Standalone media transcription           | Scribe API                                                                                                                                                   | Not integrated; use Video SDK LTT for existing live-session captions                                                                                                 |
| Standalone AI workloads                  | Zoom AI Services APIs                                                                                                                                        | Not integrated; separate service clients/authentication are needed when an AI workload is added                                                                      |

Sources: [Video SDK authorization](https://developers.zoom.us/docs/video-sdk/auth/), [cloud recording and generated artifacts](https://developers.zoom.us/docs/build/cloud-recording/), [live transcription and translation](https://developers.zoom.us/docs/video-sdk/web/transcription-translation/), [Whiteboard](https://developers.zoom.us/docs/video-sdk/web/whiteboard/), [Cobrowse](https://developers.zoom.us/docs/cobrowse-sdk/), and [AI Services](https://developers.zoom.us/docs/ai-services/).

Recording transcript/summary generation must be selected deliberately before session startup. Service availability alone does not enable it, and generating these artifacts incurs usage charges. The current participant-event webhook normalizer does not ingest recording artifacts. Do not treat ignored completion events or a stopped recording indicator as proof that an artifact has been saved in the application.

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
    zoom-video-session-embed.tsx    session orchestrator: SDK event wiring,
                                    media targets, and meeting state
    zoom-video/                     focused gallery, tile, header, panel,
                                    toolbar, feedback, and notice components
    daily-live-session-embed.tsx    sibling Daily embed (older, simpler —
                                    worth comparing when deciding whether a
                                    Zoom feature belongs here too)
    live-session-setup.tsx          public setup composition root; owns navigation
    use-live-session-setup.ts        SDK-free join, recovery and device state
    live-session-join-form.tsx       controlled anonymous identity/passcode form
    zoom-meeting-renderer.tsx        single browser-only dynamic SDK boundary
    use-live-session-navigation.ts  Home/Messages join URL normalization
    live-session-host.tsx           branches on provider to pick an embed
  lib/live-sessions/
    browser-session.ts              tab-scoped refresh recovery; cleared on
                                    deliberate leave and bounded by token TTL
    zoom-session-lifecycle.ts       SDK acquisition, compatibility checks,
                                    init/join, normalized failures, and
                                    Strict Mode-safe teardown
    service.ts                      resolveLiveSessionJoinAccess (host
                                    determination lives here),
                                    processLiveSessionProviderWebhook
    public-api.ts                   typed public API adapters (guest-join,
                                    feedback, quality-events, audit-events)
  lib/admin/
    live-session-attendance.ts      admin dashboard queries, including
                                    getAdminLiveSessionQualityEvents
  app/(public)/live/[sessionId]/    auth-aware public setup (host/member/guest)
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

### Public `/live` setup and return navigation

`apps/api` verifies the optional bearer token before returning participant identity.
The verified session starter and active classroom members with an educator profile receive host-role credentials through both `public-info` and authenticated `guest-join`. Signing in alone does not grant host access; students, guests and teachers outside the classroom remain participants. The same database authorization controls screen annotation moderation, and host joins receive teacher whiteboard grants. On join, the client uses Zoom’s `isOriginalHost()` and `reclaimHost()` to acquire the host role if another participant currently holds it. Zoom permits one current host, so the latest authorized host to join takes control.

Hosts receive fresh host-role credentials through `public-info`; non-hosts receive
only their own display name. Non-host token issuance still requires the session
passcode, including signed-in participants. `guest-join` overrides a submitted
name with the verified identity and scopes profile attribution to the session's
organization. Signed-in visitors without an org profile retain a guest Zoom
identity and never receive host privileges.

The Server Component forwards that contract into `LiveSessionSetup`:

1. Hosts go directly to device preview. Signed-in participants with a shared
   passcode automatically request participant credentials, then preview devices.
   Without a passcode they enter only the passcode. Anonymous visitors enter
   their name and, if missing from the link, the passcode.
2. `useLiveSessionSetup` owns recovery, credential requests, errors and device
   preferences. It has no router or Zoom imports. The form owns input presentation;
   `DevicePreviewStep` owns its browser media stream and stops it before joining.
   Permission denial or unavailable media APIs default both devices off.
3. `ZoomMeetingRenderer` is the sole dynamic browser-only SDK import used by
   setup and the provider container. The setup component accepts a renderer prop
   for tests; production uses the real meeting orchestrator.
4. Home and Messages use `useLiveSessionNavigation` to show the existing
   “Session ready to join” dialog for both relative and same-origin absolute
   Zoom URLs. Its Open Zoom action opens a new tab and captures the source
   pathname, query and anchor in `returnTo`. Copy link and the in-meeting share
   dialog omit `returnTo`, so recipients of shared links return home. Cancelling
   the dialog leaves the source page open. External providers keep their dialog,
   and other internal app routes retain normal navigation.
5. After leaving and completing or skipping feedback, setup clears recovery and
   replaces the meeting route with the captured source. Direct/shared URLs without
   a source return to `/`. Both the server and client reject external destinations,
   protocol-relative links, backslashes/control characters and another `/live`
   route. Refresh preserves the source in the URL and device preferences in
   tab-scoped storage. Expired or malformed recovery cannot skip setup. Recovery also binds to the
   authenticated user and host/participant role, so a later sign-in cannot reuse
   someone else’s credentials, even when display names match.

Dependency direction is route → setup → hook/form/preview/renderer. Presentational
components communicate via typed props and callbacks; the hook uses the typed
public API client. API contracts live in `packages/shared-types`. The duplicated
host and guest wrappers were removed. The Zoom orchestrator remains responsible
for live SDK events and media cleanup; it does not decide a return destination.

`flag-exempt: maintenance fixes to existing authenticated join, recovery and leave
navigation; no new meeting capability or rollout is introduced.`

Unit coverage is co-located with the route, setup, navigation, HTTP adapters,
device preview and API identity service. `e2e/live-session-setup.spec.ts` exercises
the production setup through a development-only fixture, with synthetic credential
responses and an injected meeting renderer. It verifies signed-in/anonymous joins,
permission-denied preview, refresh recovery, passcode correction, source/homepage
navigation, feedback completion, the ready-to-join dialog, cancellation, clipboard
copying and opening a new tab with the captured source. It does not verify live Zoom connectivity,
host recording, whiteboard or annotation. Test fixtures return 404 in production.

## 3. Key decision points (with rationale)

| Decision                       | What was chosen                                                                                                                                     | Why                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider auth model            | Custom HS256 JWT signed with the Video SDK Key/Secret, **not** OAuth                                                                                | Video SDK's join auth is unrelated to Zoom's Server-to-Server OAuth (that's reserved, unimplemented, for optional future REST calls like recording retrieval)                                                                                                                                                                |
| Host determination             | `profile.kind === 'educator'` OR org staff role (owner/admin/staff) — see `resolveLiveSessionJoinAccess` in `apps/web/lib/live-sessions/service.ts` | **Previously** host was `profile.id === started_by_profile_id` — whoever happened to call join first. A student joining early could outrank the teacher. Fixed 2026-10-02; `hasOrgStaffRole` was made an exported function in `join.ts` specifically to be reusable here                                                     |
| Default screen-share privilege | `SharePrivilege.MultipleShare` (anyone can share, teacher can restrict via Settings → Advanced)                                                     | Matches "student can share, teacher can restrict" requirement without a backend policy table — this is a **client/session-scoped** Zoom setting, not persisted to the database. It resets every new session instance                                                                                                         |
| Local share preview element    | Select `<video>` or `<canvas>` with `stream.isStartShareScreenWithVideoElement()`                                                                   | Zoom requires `<video>` on WebCodecs-capable paths and `<canvas>` on other paths. Passing one element unconditionally can publish a share while leaving the presenter with a blank main stage. Keep both mounted at non-zero dimensions and let the installed SDK choose.                                                    |
| Raise hand / reactions         | Built on the generic `CommandChannel` (`client.getCommandClient().send()`), not a dedicated API                                                     | **Confirmed: no native raise-hand or reaction-send API exists in this installed SDK version.** `reaction.sendEmojiReactionRequest` appears only in exception-code doc comments, not in any exported type — do not assume it exists without re-checking `node_modules/@zoom/videosdk/dist/types/*.d.ts` after any SDK upgrade |
| Whiteboard permission locking  | Not implemented — flagged as currently impossible                                                                                                   | `setWhiteboardPermission()` / `lockWhiteboardPermission()` / `getWhiteboardPermission()` are **commented out** in `whiteboard.d.ts` in the installed SDK version, despite the `WhiteboardSharePermissionCode` enum existing. Re-check after an SDK bump — this may become available                                          |
| Annotation tool coverage       | Single pencil start/stop toggle; SDK Pen selected after a confirmed start                                                                           | `AnnotationToolType` actually also has `Spotlight` (laser pointer), `Line`, `Rectangle`/`Ellipse`/`Diamond` (+ fill variants), and stamp shapes — these are real, unused, easy wins if asked for. No `Text` or equation tool exists anywhere in the SDK (whiteboard or annotation)                                           |
| Multi-participant UI           | Keep every remote SDK participant in an ID-keyed collection and give each participant a stable video render target                                  | The gallery grows automatically from one full-stage tile to a responsive grid; screen sharing switches the same participant collection into a scrollable filmstrip. `peer-share-state-change` (concurrent multi-share) and `SubsessionClient` (breakout rooms) remain separate, currently unused capabilities.               |
| Audit logging                  | New `channel_live_session_audit_events` table, logged from the **client** after the action already happened                                         | Fire-and-forget by design — a failed audit write must never block or roll back a privileged action. Currently a stub: only `mute_participant`, `end_session_for_all`, `recording_started` are logged, and there is no admin UI reading this table yet                                                                        |
| Connection-quality monitoring  | Self-reported only (`payload.userId === selfUserIdRef.current` before reporting to the backend)                                                     | Avoids every observer separately reporting the same remote peer's perceived quality, which would duplicate/conflict. Each client reports its _own_ degraded transitions only                                                                                                                                                 |

---

## 4. Zoom Video SDK: verified API quirks (don't re-derive these)

These were confirmed by grepping the **installed** `node_modules/@zoom/videosdk/dist/types/*.d.ts`, not by trusting the public docs site — the docs and the installed package have at least one confirmed mismatch (see below). **Always re-verify against the installed package after any `@zoom/videosdk` version bump; do not trust prior knowledge of "what Zoom's API looks like."**

- **Doc vs. package mismatch (caught once already):** the official share-browser-options doc page describes `ScreenShareOption.controls.systemAudio`. This field **does not exist** in the installed package. The real field is `hideShareAudioOption?: boolean`.
- `SharePrivilege` is a 3-value enum (`Unlocked=0`, `Locked=1`, `MultipleShare=3`), set via `stream.setSharePrivilege()` / read via `getSharePrivilege()`, synced via the `'share-privilege-change'` event. An earlier implementation wrongly used a binary `lockShare(boolean)` — that method exists but is the _wrong_ API for this; it's a different, simpler toggle meant for a different use case.
- `stream.getActiveCamera()/getActiveMicrophone()/getActiveSpeaker()` can return `''` or the literal string `'default'`, neither of which matches a real `deviceId` — always fall back to the first listed device.
- `stream.mirrorVideo(mirrored: boolean)` is the SDK's own mirror API — use it instead of a CSS transform; it only affects local rendering, never the transmitted track.
- `client.leave(end?: boolean)` — passing `true` ends the session for every participant, not just the caller. Easy to miss since the no-argument form is far more commonly shown in examples.
- `'passively-stop-share'` event payload is the **bare `PassiveStopShareReason` enum value**, not wrapped in an object: `PrivilegeChange | StopScreenCapture`. Needed to keep `isSharingScreen` in sync when the user stops sharing via the browser's native "Stop sharing" bar instead of our own button.
- Video SDK 2.5 supports concurrent presenters. Keep `SharePrivilege.MultipleShare` plus `simultaneousShareView: true`, derive the current presenters from `getShareUserList()` on `peer-share-state-change`, and switch the full-size received surface with `switchShareView(userId)`. The meeting UI intentionally uses presenter tabs instead of shrinking up to four shared screens into an unreadable grid, especially on mobile.
- `'network-quality-change'` fires per-user, per-direction: `{ userId, type: 'uplink'|'downlink', level: 0-5 }` (0-1 bad, 2 normal, 3-5 good). Uplink and downlink must be tracked **separately** — merging into a single "worst-ever" value without separately-updatable slots means a later improvement on one direction gets permanently masked by an old bad reading on the other.
- `'connection-change'` is about **your own** connection (`ConnectionState`: `Connected | Reconnecting | Closed | Fail`), not a specific remote peer's.
- `'annotation-privilege-change'` fires for **viewers only** — a presenter disabling "viewer can annotate" should not affect their own annotation rights; gate any reaction to this event on "am I currently the presenter."
- `CommandChannel.send(text, target?)` — `target` can be a `userId`, `{ userKey | userGuid }`, or `{ scope: 'currentSession' | 'all' }` (the latter reaches breakout rooms too). Omitting `target` broadcasts to the current session.
- `RecordingClient.canStartRecording()` must be checked before `startCloudRecording()` — it covers the case where cloud recording isn't enabled for the account/session. `startCloudRecording()` resolves to `'' | Error` rather than rejecting on failure — check the resolved value, don't rely solely on a try/catch or the `'recording-change'` event.
- Annotation and whiteboard commands may resolve Zoom failure objects rather than reject. Check both JavaScript errors and `ExecutedFailure` results before marking collaboration active; annotation tool setup is checked too. Unsupported whiteboard viewers use Zoom’s compatible screen-share stream rather than attempting to open an interactive whiteboard.
- Keep presenter annotation active while local screen sharing is active, even if Zoom has not selected an `activeShareUserId`. Clear annotation state only once both local and remote sharing have ended.
- Reference implementation: [Zoom Video SDK Web Whiteboard sample](https://github.com/zoom/videosdk-web-whiteboard/blob/16040c18857d929e432e512adcb2e11819583e07/src/main.ts). The integration follows its initialization, visible empty mounting surface, presenter/viewer start and stop, late-join, PDF export, and leave cleanup sequence. Use `whiteboard-status-change` to determine loading readiness as specified in [Zoom's whiteboard guide](https://developers.zoom.us/docs/video-sdk/web/whiteboard/); a resolved start command must not force `InProgress` or the presenting banner. API-side JWT signing uses host role `1` and participant role `0` per [Zoom's authorization contract](https://developers.zoom.us/docs/video-sdk/auth/); the sample token helper's CLI role descriptions are reversed and should not be copied.
- `WhiteboardClient.canStartWhiteboard()` is the single authoritative start-gate (folds in permissions, current sharing state, and whiteboard status) — a `false` result used to be a silent no-op before this was wired up to show an error.
- `canStartWhiteboard()` may still return `true` before `startWhiteboardScreen()` fails with `get confId or mmrToken failed`. The embedded board can also raise this credential error asynchronously after the start command resolves. Handle this specific runtime failure while a board is active, clear the presenting state and blank surface, stop the board best effort, and show the in-meeting notice. Ignore late status events from the failed attempt until a new start. The error alone does not distinguish account access from provider or network failures; users can rejoin and retry.
- `LiveTranscriptionClient` (captions) is a complete, fully real API (`startLiveTranscription`, `disableCaptions`, `lockTranscriptionLanguage`, `getFullTranscriptionHistory`, etc.) that was entirely unused until the current captions stub.
- `SubsessionClient` is Zoom's name for **breakout rooms** (`createSubsessions`, `assignUserToSubsession`, `closeAllSubsessions`, `askForHelp`, `broadcast`, ...) — fully real, fully unused.

---

## 5. Non-obvious bugs fixed this cycle (read before touching layout/CSS)

- **Keep SDK lifecycle outside the meeting UI:** client acquisition,
  compatibility validation, maintained `init()` options, `join()` result
  handling, error normalization, whiteboard cleanup, leave/destroy, and the
  Strict Mode disposal delay live in `zoom-session-lifecycle.ts`. UI event
  subscriptions remain in the embed because they update component state.
  Add lifecycle behavior and tests in the adapter instead of rebuilding this
  sequence inside the component.
- **Refresh recovery is tab-scoped, not a permanent remembered join:** once
  the participant confirms Join, `browser-session.ts` stores the device
  preferences (and, for a guest, the short-lived join result) in
  `sessionStorage`. Refreshing the same tab therefore reconnects directly
  instead of reopening passcode/device setup. Guest recovery never outlives
  the token's `expiresAt`; member recovery has a 12-hour ceiling. Deliberate
  Leave/End clears the marker before feedback is shown. Do not move this to
  `localStorage`: reopening a browser later should not unexpectedly join a
  call, and a guest credential should remain as short-lived as possible.
- **Post-call feedback is a page state, not a meeting modal:** leaving first
  disconnects from Zoom and clears recovery, then replaces the meeting with a
  full-screen feedback view. The recording state remains visibly indicated,
  but it no longer opens a blocking in-call consent dialog.
- **React Strict Mode can race SDK teardown against the next join:** Zoom's
  `createClient()` returns a singleton. React's development-only effect
  setup/cleanup/setup probe used to call `leave()`/`destroyClient()` during the
  probe cleanup, so the second setup attempted `join()` while Zoom was still
  in `LEAVING_MEETING` and failed with `OPERATION_CANCELLED` error 3. Unmount
  cleanup is now deferred by one event-loop turn and cancelled if the same
  client is immediately reacquired; explicit Leave/End actions still dispose
  synchronously. Replayed setup also shares the in-flight initialization and
  join promise for identical session credentials, so it cannot concurrently
  initialize or join the singleton twice. Failed joins release that promise
  so retries can proceed. Do not replace the scheduled cleanup with a direct dispose
  without re-testing under React Strict Mode.
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
annotation (single pencil toggle), whiteboard (start/view/stop/export-to-PDF, no
permission locking — see §4), chat, raise hand, reactions, network-quality +
connection-state indicators, "leave vs. end-for-everyone" with confirmation,
captions (stub), recording status/disclosure (automatic recording is currently
disabled), post-call feedback/rating, guest passcode join, connection-quality
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

Waiting room / admit-participant flow (the installed `@zoom/videosdk` client
exposes no admission, approve, reject, or approve-all API; implement an
application-level pre-join gate if this becomes a product requirement),
remove/kick a participant
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

---

## 9. SDK upgrade checklist

Treat every `@zoom/videosdk` version change as an integration upgrade, not a
routine dependency bump. Before merging:

1. Read the Zoom Video SDK web release notes for every version crossed and
   inspect the installed `node_modules/@zoom/videosdk/dist/types/*.d.ts` files
   for changed event payloads, return unions, and renamed enums.
2. Re-verify the lifecycle contract in `zoom-video-session-embed.tsx`:
   `checkSystemRequirements()` runs before `init()`, init keeps
   `patchJsMedia`, `stayAwake`, and `leaveOnPageUnload` enabled, every `on()`
   has a matching `off()`, and leave/unmount ends with `destroyClient()`.
3. Exercise connection transitions (`Connected`, `Reconnecting`, `Closed`,
   and `Fail`) and device permission/media-failure events. A terminal state
   must never leave a frozen call UI on screen.
4. Manually test Chrome, Safari, and Firefox at desktop and narrow mobile
   widths: pre-join preview, mic/camera, screen sharing, tile overlays,
   participant state, reconnect, leave, and host end-for-everyone. Confirm the
   persistent control bar does not obscure the active tile or shared content.
5. Re-test the known doc/package mismatches in §4 and remove a workaround only
   when the installed types and real browser behavior both confirm the new
   contract.
6. Run focused web tests plus `pnpm lint:affected`,
   `pnpm typecheck:affected`, and `pnpm test:affected`. For a major SDK bump,
   also run the full `pnpm run ci` and record browser evidence in the PR.

The custom UI intentionally follows the UI Toolkit's interaction contract
(persistent controls, participant/media state visibility, explicit
connection recovery, and deterministic cleanup) while using IconicEdu design
tokens. Any future visual redesign must preserve those behaviors.

Camera renderer stability is owned by `zoom-video-media.ts`. Attachments are
serialized per DOM surface. Repeated media-state updates retain the existing
player, quality changes reuse that player, and detachment targets the specific
player rather than every view of a participant. Keep the camera-off avatar
visible before removing the stopped renderer. Unit tests cover duplicate events,
quality changes, retry and stop/start races; `zoom-media-stability.spec.ts` checks
unaffected player identity in Chromium using the development-only `/visual-test/zoom-media`
fixture. The synthetic renderer does not verify live Zoom frame delivery.

Camera tiles keep a persistent avatar overlay until a video player is attached
and the browser has a paint opportunity. Camera-on fades the overlay out over
200 ms; camera-off covers the stopped surface immediately. Reduced-motion users
get an immediate transition. This avoids exposing an empty attachment surface,
but does not claim first-frame readiness from Zoom's attachment promise.

### Classroom meeting modules and creation policy

`classroom-meeting-settings` is a catalogued, default-off rollout flag. The API
checks it before accepting settings writes and when starting a new meeting, using
the manager who saved the policy as the rollout identity. The Classroom creation
and edit forms load settings from `GET /classroom-meeting-settings` and send writes
through the typed API client to `PUT /classroom-meeting-settings`. The API verifies
manager roles, the caller's own account/profile, and the Classroom's organization.
The flag-off path preserves legacy meeting behavior.

Classroom defaults live in `channels.live_session_config.settings`; each new
meeting snapshots its effective policy in `channel_live_sessions.app_metadata.meetingSettings`.
Existing meetings retain their snapshot, even after a Classroom edit or flag
change. Meetings without a snapshot use the documented defaults below. No Prisma
model change is needed because these are existing JSON fields. Apply the forward
migration `20261006060000_preserve_classroom_meeting_settings.sql` so older provider
and mode saves preserve the API-owned policy.

| Classroom option       | Default | Meeting behavior                                                                                                                    |
| ---------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Recording              | On      | Hosts may start cloud recording when Zoom permits it.                                                                               |
| Start Recording        | Off     | Automatically attempts recording once when the host connects.                                                                       |
| Disable Stop Recording | Off     | Disables the in-app stop action while recording is active.                                                                          |
| Whiteboard             | On      | Enables the whiteboard module and its controls.                                                                                     |
| Shared Invite          | On      | Enables sharing; when off, participant credential issuance requires authenticated Classroom membership in addition to the passcode. |
| Show Participants      | On      | Shows the participant list and management panel; video tiles remain visible.                                                        |
| Messages               | On      | Shows the in-call messages module.                                                                                                  |
| Enable Messages        | On      | Enables sending; turning it off leaves a read-only panel and applies Zoom's `ChatPrivilege.NoOne` from the host.                    |

Turning Recording off clears automatic start and stop locking. Hiding Messages
also disables sending. These dependencies are validated in the API. Cloud recording
still requires the Zoom account capability. Stop locking controls the application
UI; it does not revoke the Zoom host's provider privileges or prevent ending a call.

| Module                           | Ownership and dependencies                                                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `use-zoom-recording-feature.ts`  | Recording SDK subscription, confirmed status, policy-controlled start/stop through `zoom-recording-control.tsx`; generic More controls only receive actions and errors. |
| `use-zoom-messages-feature.ts`   | Chat SDK subscription, unread count, drafts, sending guards and retry errors; `zoom-chat-panel.tsx` renders the panel.                                                  |
| `use-zoom-whiteboard-feature.ts` | Whiteboard surface, SDK events, late-join recovery, start/stop/export and credential failures.                                                                          |
| `zoom-video-media.ts`            | Per-surface camera attachment lifecycle and renderer stability.                                                                                                         |
| `meeting-feature-settings.tsx`   | Controlled, SDK-free option editor with independent recording, collaboration and visibility groups.                                                                     |
| `zoom-video-session-embed.tsx`   | Connection and media composition root; supplies immutable policy and composes feature modules and existing presentation components.                                     |

Each SDK feature removes its own event subscriptions on disconnect. Whiteboard
work waiting for a drawing surface is cancelled when its connection changes.
Messages preserve an unsent draft when sending fails. Automatic recording reports
failure without falsely showing an active recording; hosts can retry manually.

Classroom CRUD predates the frontend/API boundary migration; new meeting-option
writes go exclusively through `apps/api`. If options fail after a Classroom was
created, the create response carries its id. The form retries as an update to that
same Classroom. This is a recoverable two-step save, not a database transaction.

Tests cover API validation, manager/tenant boundaries, flag-off writes, disabled
modules, recording start and stop locking, whiteboard cleanup, and draft recovery.
`classroom-meeting-settings.spec.ts` exercises the real option editor, typed HTTP
client and recording control with synthetic API/SDK responses; it does not verify
live Zoom account capability. To roll back the rollout, disable the flag for new
meetings; existing snapshots remain effective until their meeting ends.

## Application whiteboard provider

The `classroom-whiteboard` rollout selects the native Excalidraw board by default; Classroom settings can retain Zoom Whiteboard. Canvas, persistence and collaboration ownership, security, and tests are documented in [Classroom Whiteboard](CLASSROOM_WHITEBOARD.md). The existing Zoom whiteboard hook remains the Zoom provider, and screen-share annotation still uses Zoom.

## Picture-in-picture

The Video SDK meeting can move into a resizable, always-on-top Document Picture-in-Picture window in supported desktop browsers, including Chrome and Edge. The portal root moves between documents; video players, screen-share canvases, the whiteboard and local input keep their identity and state. Microphone, camera, raised hand, captions, chat, participants and leave controls use the same live call handlers. Theme styles follow the floating window, and menus and dialogs use its document. Starting a new screen share requires returning to the main call; an existing share can be stopped from the floating window.

More controls offers Picture-in-picture and Settings. The floating window gear also opens Settings, which combines video and audio options with picture-in-picture preferences under the Advanced tab. Automatic opening defaults to tab switching; screen sharing, both, or neither can also be selected. Existing saved preferences are preserved. This preference is local to the browser. Automatic tab switching registers the `enterpictureinpicture` media-session action; Chrome decides whether the call qualifies and the user must allow Automatic picture-in-picture in browser site settings. A plain `visibilitychange` does not grant permission to open a window. When screen sharing starts and the preference includes sharing, the application attempts automatic opening; if browser activation rules prevent it, an Open floating call prompt provides a user-initiated path. Unsupported browsers keep the call in the main tab.

The original tab displays Bring call back here while the floating call is active. Back to call and closing the floating window restore the same call without leaving it. Chrome may close an automatically opened window when the tab becomes visible; the call returns without a notification. Disconnecting, leaving or unmounting closes the floating window and cleans up media-session handlers and observers.

`flag-exempt: maintenance correction of the existing Video SDK picture-in-picture action and lifecycle.` This replaces the previous single-video move and browser-blocked visibility trigger. It does not alter other providers' embedded calls. Google Meet's PiP features and browser permissions are documented in [Google Meet Help](https://support.google.com/meet/answer/13665919?hl=en); browser automatic entry is documented by [Chrome](https://developer.chrome.com/blog/automatic-picture-in-picture).

Tests cover DOM identity, existing input, live control handlers, cross-window menus, browser-close restoration, duplicate/denied requests, preferences, disconnection and pending-open cleanup. The browser suite exercises the native Document Picture-in-Picture API and its control events, and simulates automatic browser entry with a real second document. Browser-managed automatic permission and live Zoom media need a manual supported-browser check.

## Focused content fullscreen

Each camera tile and active shared screen or whiteboard has a bottom-right View fullscreen action. The exit action stays in the same bottom-right position while fullscreen. It requests browser fullscreen on the existing content container, so participant tiles, call navigation and side panels stay outside the fullscreen surface. Media and canvas nodes remain mounted, preserving playback, annotations and board state. Video labels and badges, share switchers and application whiteboard toolbars are hidden while focused. Exit fullscreen and the browser Escape action restore the regular call layout. Ending the focused share or whiteboard also exits fullscreen. Unsupported windows, including browser-restricted picture-in-picture windows, offer a disabled control explaining that the user should return to the main call.

`flag-exempt: user explicitly requested call and annotation UI without feature flags.`

### Screen-share annotation toolbar appearance

The screen-share annotation toolbar matches the whiteboard’s compact controls: 32 px icon buttons, 16 px icons, lightly rounded corners, theme card colors and a subtle border and shadow. Primary controls use icons with accessible labels and hover titles; grouped tool panels retain visible labels. The horizontal toolbar scrolls on narrow shared surfaces, and tool panels render outside the scrolling strip. Existing annotation tools, permissions, docking and formatting remain available.

Annotation panels use compact theme surfaces and aligned controls. Format groups color, stroke, text and pen settings; Shapes groups lines, outlines, fills and highlights; More groups selection, board clearing, and sharing/view controls. Color swatches indicate the current choice, and panels scroll within the shared surface when space is limited.

New whiteboards and screen-share annotation sessions allow authorized participants to annotate by default. Presenters can disable this with **Allow participants to annotate**. Existing saved restrictions remain unchanged. Screen-share defaults require migration `20261007233000_enable_participant_annotations_by_default.sql`; membership checks and presenter-only moderation remain enforced.

### Screen-share annotation synchronization

Annotation overlays use one room per live session and presenter share ID. Switching views, resizing or remounting an overlay only detaches its subscriptions; it does not close the shared room. Actual SDK peer-share stop, passive local stop, explicit Stop sharing and presenter leave close the corresponding room. Duplicate stop notifications share one close request. Viewers arriving before a presenter initializes the room retry promptly, then use Realtime broadcasts for live previews and committed drawings, with periodic snapshot recovery. The local two-browser collaboration test covers drawing in both directions, live previews, canvas rendering and restoring the presenter view without losing marks.

### Call speaking indicators and automatic PiP

Speaking indicators track the complete SDK active-speaker list and the local audio-level event, clear stale activity, and suppress speaking badges for muted microphones. Gallery, shared-screen filmstrip and participant list use the same activity set. In video tiles, the microphone circle beside the name crossfades into three audio bars over 150ms while speaking, with a responsive 0.5-second wave in the middle bar while the two outer bars stay steady. Speech activity remains visible for 1.8 seconds after the last detected speech, independently for each participant; silence does not restart that hold, and departing or muted participants stop showing activity. The indicator stays in place and returns to the microphone when idle; muted microphones never animate. Reduced-motion preferences disable the wave and crossfade. The speaking outline also transitions smoothly. The shared `SpeakingAudioIcon` in `packages/ui-web` is used by Zoom tiles, the participant list and live microphone control (including PiP), and by Daily participant tiles, the participant list, microphone controls and device preview. The list replaces its microphone icon in place rather than adding a second speaking badge. Daily uses the shared 1.8-second speech hold; Zoom uses that same duration in its SDK activity hook. Screen-share annotation launchers remain visible during initialization or reconnection; drawing stays disabled until the server grants access. Their visibility no longer depends on the optional meeting token prop.

Tab-switch PiP registers the browser media-session handler, keeps conferencing playback state current and attempts automatic opening on visibility changes. Browser permission still controls whether a window may open. If denied, the main call offers a manual floating-call action and explains how to allow Automatic picture-in-picture in site settings; a successful request clears the prompt. The Never preference disables automatic tab-switch attempts.

### Shared-link guest annotation access

Meeting admission now issues an opaque, four-hour screen-annotation credential after passcode and invitation checks. It is kept with the existing tab-scoped join credentials and forwarded to the annotation overlay. Only its SHA-256 hash is stored. The API verifies its meeting scope, expiry and active session on every read/write; guests always receive the participant role, and the existing transaction enforces ownership and presenter moderation. Migration `20261008120000_screen_annotation_guest_access.sql` is required before deploying the API.

Guests do not need an IconicEdu account session. Saved marks synchronize through 500 ms API snapshot polling; signed-in participants retain private Realtime commits and live stroke previews. Participant pointer positions and names synchronize through the API for guests and signed-in users. Guest live stroke previews and vanishing marks are not yet transported through the capability path. Expired credentials require rejoining the meeting. Existing authenticated annotation endpoints remain protected.

### Annotation and application-whiteboard content in cloud recording

`flag-exempt: maintenance correction of existing recording and collaboration; user requested no feature flags.` The browser installs `meeting-share-processor.js` into Zoom’s outgoing share pipeline before sharing. It composites the presenter’s annotation canvas (including received participant marks/previews, temporary pointers and text editing) into the encoded share frames. Source metadata uses Zoom command-channel sender IDs, so receiving clients can suppress duplicate annotation canvases without trusting an ID in a message body. The local annotation room stays mounted while another presenter is selected.

When the host opens the application whiteboard during recording, or starts/resumes recording with that board open, the app first publishes a Zoom share stream. Browser sharing confirmation is required; the picker prefers the meeting tab and excludes system audio to avoid duplicating meeting audio. The processor replaces the underlying captured frame with the themed whiteboard canvas layers and active text editor. Pending whiteboard frames are blank, and capture is stopped before removing the processor to avoid exposing the underlying display. Closing the board ends that publication. Stopping required whiteboard capture pauses recording; the host can prepare content again with **Resume recording**. Unsupported processing and capture failures are reported rather than treating missing canvas content as recorded.

The existing Zoom cloud recording remains the recording output. The account must enable a recording layout that includes shared screens (for example, gallery with shared screen); the browser SDK does not configure those account settings. This records the published shared view and meeting audio, not every participant’s independent viewport or private UI. The existing Zoom-native whiteboard remains owned by the SDK. Guest marks arrive according to the guest annotation synchronization path described above. Browser pixel and lifecycle tests verify composition and preparation, but a completed cloud MP4 must also be checked in a real Zoom test session to validate the account layout and platform behavior. See [Zoom share processing](https://developers.zoom.us/docs/video-sdk/web/raw-data-share/) and [cloud recording layouts](https://developers.zoom.us/docs/video-sdk/web/recording/).

### Meeting notification appearance

Floating meeting notices, fullscreen and more-controls errors, and picture-in-picture prompts share the themed `NotificationCard` from `packages/ui-web`: a compact content-sized surface with a subtle shadow, theme-colored background, softly rounded corners, optional title and supporting text, compact actions and a neutral dismiss icon. Text and actions wrap independently on narrow screens. Errors retain alert semantics; informational notices retain status semantics. Existing dismissal and action behavior is unchanged.

### Whiteboard presentation lifetime

Saved classroom board content does not imply an active presentation. The API records the presenting teacher's grant identity and live session when presentation starts, and reports `presentationActive` separately from document revisions. Automatic opening requires that exact teacher grant to have an unexpired heartbeat in the same meeting. Legacy presentation flags and flags from earlier meetings do not reopen the board. After an unexpected disconnect, presentation expires within the existing 15-second presence window plus the polling interval; saved drawings remain available.

### Annotation interaction and participant colors

Screen sharing keeps Konva's native shape primitives and transformer; the whiteboard keeps Excalidraw's native drawing tools and style controls. Participant rosters receive deterministic distinct default colors, including a fallback for meetings larger than the preset palette. Explicit color choices remain local user preferences. Screen-share pointer previews carry the sender's validated color rather than inheriting the viewer's color. Whiteboard defaults use Excalidraw's `currentItemStrokeColor` app state.

The screen-share pen launcher is circular when collapsed and expands with a short native browser width animation. Reduced-motion preferences disable expansion and cursor tween animations. Shift constrains rectangles, ellipses and diamonds to equal pixel dimensions, and lines/arrows to 45-degree increments; endpoints remain inside shared content. Pointer release captures the final endpoint and discards accidental tiny shapes. The mark count remains available to assistive technology without a visible top-right badge.

Konva does not provide a built-in avatar cursor. Excalidraw's collaborator API supports avatar metadata, but its native canvas cursor uses a username label. No custom avatar cursor is added. References: [Konva React drawing example](https://konvajs.org/docs/react/Free_Drawing.html) and [Excalidraw scene API](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api).

The annotation toolbar keeps its rounded pill outline in both collapsed and expanded states, with matching rounded hover and selected backgrounds on its icon buttons. Dropdown triggers use a wider pill to contain both the tool icon and chevron. Vanishing pen sits beside Pen in the main toolbar and shares the whiteboard laser-style icon. The whiteboard drawing bar and board-details bar use the same rounded surfaces, 32px round icon controls, and 44px-wide dropdown pills. Whiteboard button hover and selected colors are supplied by the shared themed `toolbar` button variant, and the native dropdown panels retain their keyboard and fullscreen behavior. Annotator names are hidden by default and can be enabled locally through **More → Show annotator names**; this controls pointer name badges as well as author hover labels. When enabled, screen-share annotation names use Konva's native `Label`, `Tag`, and `Text` primitives for a readable colored badge beside both spotlight and named pointers. Pen, shape, text, selection, and eraser movement publish pointer positions through the existing authenticated preview channel. Toolbar interactions do not publish cursor updates. Guest capabilities exchange ephemeral pointer presence through the API, and signed-in views merge those updates with realtime previews. Pointer publication is coalesced to at most four requests per second per active client, with one request in flight. Guests poll every 500 ms and signed-in clients every second; pointer records expire after three seconds. Names and room ownership come from the verified meeting identity, with no client database access. The service-only `screen_annotation_pointers` table is scoped to annotation rooms and is deleted with its room.

Screen-share drawing uses React input batching and Konva's automatic canvas drawing rather than an additional animation-frame scheduler. Pointer moves preserve browser-coalesced handwriting samples, and captured drags clamp to the shared-content edge. Drawing mode uses `touch-action: none` so browser pan gestures do not interrupt strokes. Cancellation and tool changes release only the active pointer capture; unrelated pointer cancellation does not discard a stroke. Completed preview packets keep their own sequence number while saves are pending. Acknowledged commit deltas remain visible while the client refreshes a missing revision. For video streams that already composite annotations into recording pixels, only the saved-mark layer is hidden locally; live drafts, selection controls, and pointer labels remain visible immediately.

Whiteboard laser movements use Excalidraw's native collaborator laser renderer.
A separate capability-authenticated transport shares bounded scene-coordinate
samples with signed-in participants and shared-link guests. Presence expires after
three seconds, is scoped to the current board and live session, and respects
participant annotation permissions. Laser trails never change the saved board or
its revision. Apply migration `20261010160000_whiteboard_laser_presence.sql` before
deploying the API endpoints.
