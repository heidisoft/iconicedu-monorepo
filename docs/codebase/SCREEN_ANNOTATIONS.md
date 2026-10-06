# Collaborative Screen Annotations

## Purpose

Describe the web annotation overlay, synchronization and authorization used with Zoom screen sharing.

## Intended Audience

Engineers maintaining live sessions and operators enabling the feature.

## Related Docs

- [Zoom Video SDK integration](ZOOM_VIDEO_SDK_INTEGRATION.md)
- [Architecture](ARCHITECTURE.md)
- [Development workflow](../getting-started/development-workflow.md)

## Rollout

`screen-share-annotations` is catalogued in shared feature flags and `apps/web/flags.ts`, with a default of OFF. Enable it for the signed-in Supabase user IDs participating in the pilot; both the public live-session page and API evaluate the flag against that identity. Apply `20261006143000_screen_annotations.sql` before enabling it. Disabling the flag prevents API reads/writes and hides the overlay on the next page load. No new environment variables are required.

Zoom's built-in annotation API is no longer called by the meeting renderer. Zoom continues to own audio, video and screen-sharing render targets. Anonymous passcode guests can join the meeting, but annotations require a signed-in account with channel membership (or the session starter). A Zoom host role supplied by a client does not grant annotation permissions.

## Content Alignment

`SharedContentSurface` in `packages/ui-web` gives both the Zoom renderer and overlay the same aspect-fitted content rectangle. It observes the container's CSS size and removes letterboxing. `AnnotationCoordinateService` converts client coordinates using the content's current bounding rectangle, which accounts for browser zoom and axis-aligned CSS scaling. Konva controls its own backing-store pixel ratio; coordinates never include device pixels. Arbitrarily rotated/skewed parent CSS transforms are not supported.

Coordinates and path simplification live in `packages/utils`, while shared object, operation and event contracts live in `packages/shared-types`. The drawing engine has no Zoom imports and can render over other content surfaces.

## Tools And Interaction

The compact toolbar provides pointer, pen, highlighter, text, object eraser and undo/redo. Its advanced selector includes selection, lines, arrows, double arrows, outline/filled/highlight rectangles and ellipses, diamonds, stamps, spotlight, named pointers and vanishing pen. Formatting stores color, width, opacity, font size, bold and italic on each object. Highlighter and highlight shapes default to 25% opacity; highlighter defaults to width 18.

Selection supports marquee, multiple objects, drag, resize, rotation, deletion, duplication and formatting through a Konva Transformer. Text uses an HTML textarea: Enter commits, Shift+Enter inserts a newline and Escape cancels. Mouse, touch and stylus share pointer handlers. Optional pressure changes completed pen stroke width; stored points retain pressure. A second touch cancels drawing, and large touch contacts are ignored. Stroke erasing and optional layer reordering are not implemented; the eraser deletes entire vector objects.

The toolbar can dock on any edge or float; drag it by its handle. Position is saved only in local browser storage. PNG export composites the displayed Zoom canvas/video with annotations, subject to the browser's canvas security restrictions.

While an annotation tool is active, V selects, P draws, H highlights, T edits text and E erases. Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z redoes, Delete/Backspace removes the selection and Escape cancels. Pointer mode leaves the shared surface and application shortcuts alone.

## Authorization And State

The session starter is the annotation moderator. Other channel members edit and erase their own objects only after the tutor enables student drawing. Moderators can edit all objects, clear their own/student/all annotations and change student permissions. The API verifies the bearer token and feature flag; service-only database functions independently resolve membership, bind ownership and enforce capabilities.

Each active presenter key has a distinct annotation session UUID. Share changes/end close the tutor's current annotation session, retaining its final snapshot. Each completed operation updates the current snapshot under a database row lock and increments its revision. Object versions prevent stale edits or undo from overriding tutor moderation. Deletes remain tombstones. Receipts make retries with the same event ID idempotent. Local undo/redo history is bounded to 100 operations and does not survive a page reload.

Snapshots include a schema version. They persist after each completed operation rather than after each pointer movement, so late joiners and reconnecting viewers can recover through the API immediately. A missed Broadcast revision triggers an authoritative reload; a ten-second background reconciliation also repairs missed messages and refreshes participant identities. The snapshot retains at most 2,000 objects including tombstones, each path has at most 5,000 points, and the snapshot has an 8 MB limit. Restart screen sharing to open a fresh session when capacity is reached.

## Realtime Protocol

All channels use `private: true`:

- `annotation:room:{roomId}` is receive-only for browser clients. The database sends committed operations with `realtime.send` in the same transaction as snapshot/receipt updates. Large clear operations send an invalidation instead of exceeding Broadcast payload limits.
- `annotation:room:{roomId}:user:{authUserId}` carries that user's previews and Presence. Topic authorization binds publishing to the authenticated user. Other class participants subscribe to these topics, and receivers derive names/roles from the authorized participant list rather than trusting payload roles.

Drawings appear locally before server acknowledgement. Start packets contain the initial object, subsequent packets contain buffered point deltas at 40 ms intervals, and finish packets remove previews after the completed object is committed. Sequence buffers handle reordering and duplicates, including points arriving before start. Preview buffers, processed event IDs and histories are bounded. Permanent mutations always go through the API; receiving a client preview cannot change a snapshot or permissions.

Spotlight and named pointers publish at up to 25 Hz; remote Konva nodes interpolate movement. Named arrows replace that participant's previous pointer. Spotlight expires after 1.5 seconds without movement, named pointers after five seconds, and abandoned previews after three seconds. Vanishing pen synchronizes an expiry, fades over its final second and disappears after approximately four seconds. None of these ephemeral objects are persisted. Presence carries only identity and slowly changing capability state.

Changing student permissions immediately cancels local student input and filters student previews. Realtime authorization is evaluated when joining a channel, so receivers also enforce the latest snapshot permissions; the API/database check every permanent write. Restrictive policies protect the annotation namespace even if broader permissive Realtime policies exist elsewhere.

## Verification

Unit tests cover coordinate transforms, simplification, sequence buffering, tombstones, flag gating, payload validation, idempotent retries, undo/redo, preview spoofing and revision-gap recovery. `supabase/tests/screen_annotations.test.sql` checks database permissions, ownership, stale versions and private-topic authorization. The Playwright fixture at `/visual-test/screen-annotations` exercises real Konva rendering without Zoom credentials or database writes and is unavailable in production.

Run the focused checks:

```bash
pnpm --filter web test components/screen-annotations
pnpm --filter api exec jest --runInBand screen-annotations
pnpm --filter @iconicedu/utils test
supabase test db supabase/tests/screen_annotations.test.sql
node supabase/tests/screen_annotations.broadcast.mjs
pnpm --filter web test:e2e screen-annotations.spec.ts
```

The local Broadcast integration check creates synthetic users and verifies private preview delivery, rejection of forged state messages and transactionally broadcast commits, then removes its fixtures.

The browser fixture verifies overlay tools, not the live Zoom SDK or network latency. A signed-in tutor/student pilot on a real shared screen is still required before production rollout; the 60 FPS and typical 150 ms latency goals are targets, not measured guarantees.
