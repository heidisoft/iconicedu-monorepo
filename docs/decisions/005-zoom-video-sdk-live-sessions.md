# ADR-005 — Zoom Video SDK as a Live-Session Video Provider

**Date:** 2026-10-03
**Status:** Accepted

---

## Context

Live sessions already supported multiple video providers through a clean
adapter interface (`LiveSessionProviderAdapter` in
`packages/live-sessions-core/src/types.ts`), with Daily.co as the sole
implementation. The business wanted to offer Zoom as an additional provider
option, billed **pay-as-you-go per participant-minute** rather than per
licensed meeting seat, while keeping the in-app experience visually and
behaviorally consistent with the rest of the product (shadcn/`@iconicedu/ui-web`
design system, no Zoom branding).

Zoom offers two distinct SDK families with materially different shapes:

- **Meeting SDK** produces a Zoom-hosted `joinUrl` — the natural fit is an
  iframe embed or opening a Zoom-hosted page, billed per licensed meeting.
- **Video SDK** has **no Zoom-hosted join URL at all**. A short-lived JWT is
  minted per participant against an SDK Key/Secret, and the consuming app
  builds **100% of the call UI itself** (tiles, controls, chat, etc.) on top
  of Zoom's raw audio/video engine, billed pay-as-you-go per
  participant-minute.

A further choice within Video SDK was whether to use Zoom's own pre-built UI
(`@zoom/videosdk-ui-toolkit`) or build a fully custom interface on the raw
`@zoom/videosdk` client.

Separately, the product needed a classic "share a link, enter a passcode"
join path usable by people with no account at all (not just authenticated
channel members), matching how Zoom meetings are commonly shared.

## Decision

Add Zoom as an **additional** `LiveSessionProviderAdapter`
(`packages/live-sessions-core/src/providers/zoom-video-sdk-provider.ts`),
selectable per channel via `channel_live_session_config.provider` — Daily.co
remains the default and is not being replaced or migrated.

Specifically:

- Use **Zoom Video SDK**, not Meeting SDK, authenticated with a custom HS256
  JWT signed with a Video SDK Key/Secret (unrelated to Zoom's
  Server-to-Server OAuth, which is reserved for optional future REST calls
  such as recording retrieval).
- Build the **entire call UI by hand** on the raw `@zoom/videosdk` client
  (`apps/web/components/live-sessions/zoom-video-session-embed.tsx`) using
  `@iconicedu/ui-web` components, rather than Zoom's pre-built
  `@zoom/videosdk-ui-toolkit`, which was tried first and dropped.
- Serve **one join flow** for authenticated channel members and fully
  anonymous passcode guests, rather than two separate code paths: a signed-in
  non-member who 403s on the normal join call is redirected to the same
  public guest-join page a true anonymous guest would use
  (`apps/web/app/(public)/live/[sessionId]/page.tsx`).
- Route the one-time Zoom webhook `endpoint.url_validation` handshake and all
  participant-event webhooks through the existing shared
  `apps/web/app/api/webhooks/live-sessions/[provider]/route.ts`, so
  attendance tracking requires no changes beyond provider-specific
  normalization.

## Alternatives considered

| Option                                                  | Why rejected                                                                                                                                                                                         |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zoom Meeting SDK                                        | Licensed-per-meeting billing, not pay-as-you-go per participant-minute; its `joinUrl` model is built for iframe embedding or a Zoom-hosted page, not for deep custom host/participant permission UX. |
| Zoom Video SDK + `@zoom/videosdk-ui-toolkit`            | Tried first. Zoom's own branding/visual language didn't match the app's design system, and the toolkit didn't expose the exact host/participant permission controls the product needed.              |
| Replace Daily.co with Zoom                              | No existing Daily limitation forced a migration; the adapter interface already supported adding a second provider cleanly, so replacing a working provider carried migration risk for no benefit.    |
| Build fully custom WebRTC infrastructure                | Far larger engineering investment (signaling, TURN/STUN, media servers) than adopting a managed SDK for a feature that isn't the product's core differentiator.                                      |
| Separate flows for member join vs. anonymous guest join | Would have doubled the join/landing-page logic to maintain; unifying them (redirect-on-403) was simpler and matches how Zoom's own passcode sharing behaves from a user's perspective.               |

## Consequences

### Positive

- Pay-as-you-go billing avoids paying for idle licensed seats.
- Full control over the call UI means visual and interaction consistency
  with the rest of the app, and bespoke host-moderation UX (screen-share
  privilege, remote mute, raise hand/reactions, end-for-everyone, etc.) that
  a pre-built toolkit wouldn't have allowed.
- Reuses the existing provider-adapter architecture end-to-end — attendance
  tracking, webhook processing, and the join/access-control pipeline needed
  no structural changes to support a second provider.
- One unified join flow means guests and members share a single, simpler
  code path instead of two parallel ones.

### Negative / trade-offs

- Building the call UI by hand means IconicEdu owns the maintenance of
  everything Zoom's own UI toolkit would otherwise have covered — the embed
  component is ~3,100 lines and growing (mute, camera, chat, whiteboard,
  annotation, recording, captions, reactions, connection-quality reporting).
- Several expected features have **no first-party Video SDK API** in the
  currently installed version and had to be built on the generic
  `CommandChannel` instead: raise hand, emoji reactions. Others are entirely
  unsupported by the SDK: forcing off a remote participant's camera, native
  polls/quizzes.
- Whiteboard permission-locking (teacher-restrict-editing) is currently
  **blocked by the SDK itself** — `setWhiteboardPermission`/
  `lockWhiteboardPermission` are commented out in the installed package's
  type definitions despite the underlying enum existing.
- Guest joins (no account) are tracked only via
  `channel_live_session_participant_events` (nullable `profile_id`) and never
  get a `channel_live_session_participants` row, so guest attendance doesn't
  appear in profile-keyed attendance reports — an accepted limitation, not an
  oversight.
- The current data model assumes exactly one `otherParticipant` (1:1
  tutoring); true multi-participant gallery/group-call support
  (`SubsessionClient` breakout rooms, `peer-share-state-change` concurrent
  multi-share) would need real architectural work, not incremental changes.

### Risks

- `@zoom/videosdk` has at least one confirmed mismatch between its public
  documentation and the installed package's actual types
  (`ScreenShareOption.controls.systemAudio` is documented but does not
  exist; the real field is `hideShareAudioOption`). Any future SDK version
  bump must re-verify API usage against the installed package's
  `node_modules/@zoom/videosdk/dist/types/*.d.ts` rather than trusting prior
  knowledge or the docs site.
- The whiteboard permission-locking gap (above) could resolve itself on a
  future SDK upgrade, or could remain blocked indefinitely — there's no
  public timeline from Zoom.
- As more teacher-moderation features are added (mute/remove/end-class/
  recording-start today), the stub audit log
  (`channel_live_session_audit_events`) has no admin UI reading it yet — a
  real incident would currently need a manual database query to investigate.

## References

- `packages/live-sessions-core/src/providers/zoom-video-sdk-provider.ts`
- `apps/web/components/live-sessions/zoom-video-session-embed.tsx`
- [Zoom Video SDK Integration](../codebase/ZOOM_VIDEO_SDK_INTEGRATION.md) — full architecture map, verified API quirks, and current feature-coverage snapshot
- [External Integrations](../codebase/INTEGRATIONS.md)
- [ADR-004: API-first frontend data boundary](004-api-first-frontend-boundary.md) — join-access JWTs are minted server-side only, consistent with this boundary
