# Classroom whiteboard

The application whiteboard uses Excalidraw as a canvas engine under native Classroom controls. Video, canvas, persistence and collaboration are independently replaceable. Zoom Whiteboard remains available through its existing SDK adapter.

## Appearance

The board uses theme colors, subtle dotted paper and crisp, lightly rounded controls. Drawing tools form a vertical floating rail on the left, with the laser pointer first. The board title, save status and participant initials occupy a separate top-right overlay. Board details wrap and truncate long titles on narrow displays; the tool rail scrolls when the available height is short. Desktop buttons remain 32 px, with 44 px touch targets. Menus and the native contextual style panel remain available in fullscreen. The style panel sits beside the rail; on mobile it uses the existing bottom panel. Tool selection uses a soft primary tint. Theme changes do not rewrite saved drawings.

## Meeting drawing and annotation tools

The compact toolbar keeps the common drawing tools directly available. Shapes includes Line, Arrow, Rectangle, Ellipse, Diamond and Frame. Arrow style options include endpoint arrowheads and elbow connectors; selecting objects exposes native grouping, alignment, duplication and layer controls.

Drawing tools map directly to the installed Excalidraw tool types. The native laser pointer comes first, followed by Select and draws transient local trails without adding document elements. Custom highlighter, sticky note, stamp, lasso and pixel eraser tools are not included.

The laser is explicitly local: it does not broadcast attention to other participants or persist marks. Shared laser/cursor transport, smart shape recognition and rich text lists/emphasis are not implemented. View offers no grid, dots or lines, plus engine-native snap to grid; when snapping is enabled the engine also displays its alignment grid. These preferences affect the local viewport only. Board options exports SVG or PNG. PNG uses a white paper background for portability; it does not change saved board colors. Pages remain removed.

## Contextual tool options

Selecting a drawing tool shows the engine's themed style panel underneath the floating toolbar. Selecting existing objects exposes their styles too. The panel shows relevant controls such as stroke and background colors, fill, line width, opacity, text formatting and arrow settings. Ordinary tool changes preserve style choices. Styles are stored on drawing elements and use the existing autosave, collaboration and undo paths. Mobile uses a scrollable bottom panel with a Show/Hide tool options button.

## Infinite canvas

One continuous workspace replaces page navigation. Scroll to pan, use Space + drag or the Pan tool, and Ctrl/Command + scroll to zoom. View → Fit content brings the drawings back into view. Touch users can pan and pinch to zoom. Panning changes only the local viewport; drawings retain their world coordinates.

The API projects older multi-page documents into one canvas, arranging subsequent pages vertically with a gap and preserving geometry, deletions, groups and bindings. IDs from later pages are namespaced to keep duplicated scenes distinct. The next atomic save persists this layout. Legacy page aliases translate queued drawing edits; obsolete page-management requests ask the client to rejoin. The `pages[0]` field remains an internal compatibility partition, not a user-facing page.

## Rollout and provider selection

`classroom-whiteboard` is catalogued in `apps/web/flags.ts` with a false default. API evaluation uses the meeting starter's profile, so all participants receive the same provider choice. Existing local/preview API flag behavior enables flags automatically; production requires an explicit rollout. When enabled, an unspecified provider selects Excalidraw. Classroom meeting options expose Excalidraw and Zoom when both the meeting-settings and whiteboard flags are enabled. `whiteboard.enabled: false` disables board access. Explicit Zoom selection or flag OFF uses the existing Zoom provider.

The server issues `whiteboard` access alongside authorized host/guest meeting credentials. Guest passcodes and authenticated host checks remain owned by the existing meeting service. The browser cannot grant teacher privileges by setting a name or choosing a provider. Rollback is to disable the flag or select Zoom for new meetings. Already-issued grants expire after four hours; rejoin to renew them. Ending a meeting immediately prevents further board reads and writes. Teacher presentation opens the board for peers and late joiners through shared application state; students can hide their own view without changing the teacher presentation.

## Ownership and security

Boards have their own UUID and an organization, channel and class-occurrence key. Scheduled keys combine the application schedule ID and occurrence timestamp, preserving work if the video room is replaced. Ad-hoc meetings have an independent application session scope. Zoom provider session IDs are never persistence identifiers.

`20261006120000_classroom_whiteboards.sql` creates `classroom_whiteboards`, `classroom_whiteboard_access` and the atomic compare-and-swap function. Both tables enable RLS and deny all table access to anonymous/authenticated frontend roles. Only `apps/api` accesses them. Prisma models mirror the schema. No new environment variable is required. The API JSON parser accepts up to 2 MB so valid whiteboard batches above the default 100 KB parser limit can reach the stricter 1 MB operation validator.

An opaque random capability is scoped to exactly one board and authorized meeting, a teacher/student role, and an expiry. Only its SHA-256 hash is stored. Capabilities travel in Authorization headers, never URLs. Each API request checks the capability, meeting activity and whiteboard setting. Teacher-only board clearing and student locks are checked in the API on every mutation and conflict retry. A teacher is the verified meeting host; other joiners are students. Invite disabling continues to enforce Classroom membership before guest credentials are issued.

Canvas inputs are bounded: 5,000 elements on new boards and 8 MB per document. Existing larger boards retain their content and can edit or clear it. Images, files, links, iframes and embeddable content are not accepted. Validation belongs in the API, not the presentation layer. Application assets consist of neutral line, text and rectangle primitives.

## Modules

- `packages/shared-types/src/vm/whiteboard.ts`: application document, page, element, operation, capability and presence contracts.
- `apps/api/src/modules/whiteboards`: capability issuance, operation validation, role policy, persistence service and HTTP controller.
- `apps/web/components/whiteboard/canvas/whiteboard-engine.ts`: engine interface; `excalidraw-engine.ts` owns all canvas conversion and API calls.
- `assets/registry.ts`: searchable educational assets; coordinate plane, number line and graph paper, plus structured bar-chart construction. Register a new asset pack without changing the canvas engine.
- `collaboration/provider.ts`: injectable collaboration interface and HTTP implementation. It does not import React, Zoom or Supabase.
- `persistence/autosave-queue.ts`: serial debounced incremental writes, retry IDs and refresh recovery drafts.
- `use-whiteboard.ts`: local board orchestration and pending-element overlays.
- `classroom-whiteboard.tsx` and `components/`: native toolbar, infinite canvas, library, presence, student lock and destructive-action confirmation.
- `use-native-whiteboard-feature.ts`: synchronizes teacher presentation, peer views and late joins through the same collaboration interface.
- `use-meeting-whiteboard.ts`: meeting boundary chooses the application board or `useZoomWhiteboardFeature`; the native board does not import Zoom.

## Collaboration, persistence and history

The canvas paints local strokes independently. Native React controls update at most ten times per second; no global classroom store receives pointer updates. Autosave batches incremental element updates after 400 ms and serializes writes. Failed operations retain stable IDs, retry every two seconds and stay in per-capability session storage across refresh. The UI shows saved, saving, reconnecting or unsaved state. Closing the tab before a successful save cannot guarantee recovery; keep it open until Saved. Session storage is cleared when pending operations succeed. Failed work can be downloaded as a recovery JSON document; discarding pending changes requires confirmation and restores the saved board.

The API atomically compares board revisions before writing. On conflict it reloads and reapplies the operation up to five times. Per-element version and deterministic nonce ordering merge disjoint work and reject older updates; element deletions and retired page IDs remain tombstones. The latest 256 operation IDs deduplicate write retries. Same-element concurrent edits resolve by that deterministic order; this is not a character-level text CRDT.

HTTP collaboration polls every 1.5 seconds with only one request in flight. Unchanged reads omit the document and return presence/permissions. Reconnect reloads authoritative state and overlays pending elements. Presence expires after 15 seconds without a successful read. Supabase Realtime is intentionally not required: shared-link guests need no Supabase identity and no client broadcast can bypass a teacher lock. A future Realtime invalidation adapter can implement the same interface and call refresh, with appropriate RLS; authoritative writes still pass through the API.

Canvas initialization and remote updates use Excalidraw `CaptureUpdateAction.NEVER`. Application history records local changed element IDs only, preserving unrelated remote additions during undo. Redo and undo create new element versions so peers converge. Teacher board clearing is an API-authorized operation outside local drawing undo history. Viewport and selection remain local. Native keyboard handling supports undo/redo, Delete and P while typing inputs retain their shortcuts. Excalidraw supplies selection, shape, text and viewport interactions. SVG exports the whole board; native PDF export is not provided. Zoom retains its own PDF export.

## Verification

Unit/component tests cover document operations, input validation, locks, capability failures, CAS conflicts/replays, educational assets, canvas conversion, local history, autosave/recovery and collaboration cleanup. Tests are co-located.

`apps/web/e2e/classroom-whiteboard.spec.ts` exercises the production board UI and Excalidraw canvas against the running real API and local Supabase database. Two independent browser contexts verify collaboration and student locks without mocked persistence or transport. The development-only `/visual-test/whiteboard` route provides class entry without requiring a paid Zoom connection; it returns 404 in production. Synthetic test records are created in a fresh organization and removed afterwards. The helper targets only `supabase_db_iconicedu-monorepo`; it never reads existing users or accepts a production database URL.

Run local Supabase with migrations, API on port 3001 and web on port 3000, then:

```bash
supabase test db supabase/tests/classroom_whiteboards.test.sql
pnpm --filter api test --runInBand whiteboard
pnpm --filter web exec vitest run components/whiteboard
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm --filter web exec playwright test classroom-whiteboard.spec.ts --workers=1
pnpm lint:affected
pnpm typecheck:affected
pnpm test:affected
pnpm run ci
```

Provider selection has tests for OFF, ON and explicit Zoom behavior. These browser tests verify the board and class entry boundary, not live Zoom audio/video or hosted Zoom Whiteboard behavior. Real provider credentials are still needed for that separate smoke test.

## Extension points

A new canvas engine implements `WhiteboardEngine` and its scene codec; engine payloads remain opaque to UI components and asset packs. A different database implements `WhiteboardRepository`. A push transport implements `WhiteboardCollaborationProvider`. Backend-loaded Math/Science/ELA assets can populate `WhiteboardAssetRegistry` using the same neutral primitives. No speculative empty provider or asset modules are included.
