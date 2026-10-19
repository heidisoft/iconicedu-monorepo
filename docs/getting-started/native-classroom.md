# Native classroom development and verification

## Purpose

Build and verify the app-owned classroom on iPad/iPhone and Android phones/tablets. Ordinary external Zoom links continue to open the external meeting application. Native Video SDK sessions and ordinary Zoom meetings are separate products.

## Build configuration

Use Node and pnpm versions pinned by the repository. The mobile app includes `@zoom/react-native-videosdk` 2.6.1, whose native dependencies use Zoom Video SDK 2.6.0. Android requires API 28 (Android 9) or newer. The iOS application and broadcast extension target iOS/iPadOS 15.1 or newer. Fire OS/Silk compatibility must be checked on the specific tablet; Android ancestry alone does not establish SDK support.

```bash
pnpm install --frozen-lockfile
pnpm --filter @iconicedu/utils build
pnpm --filter mobile canvas:build
pnpm --filter mobile native:prebuild
cd apps/mobile/ios
pod install
```

The Expo plugin at `apps/mobile/plugins/with-native-classroom.js` generates native host controls, Android foreground services and the iOS `ClassroomBroadcast` ReplayKit extension. Re-running prebuild must preserve one extension and one source reference for each native bridge. Commit the generated native project changes together with the plugin/templates because this repository tracks native projects.

Register the App Group `group.com.heidisoft.iconicedu.classroom` for the main application and the extension `com.heidisoft.iconicedu.classroom-broadcast` in Apple Developer signing configuration. EAS extension metadata is supplied by the plugin. Full-device sharing requires the user's system broadcast approval; the app cannot suppress this approval. Android also requires system MediaProjection approval and displays foreground notifications for active meeting audio/sharing.

SDK keys and secrets belong only in `apps/api`; never add them to Expo public environment variables. The API's existing Zoom SDK configuration is described in [deployment](../operations/deployment.md). Native clients use the same authenticated join/admission endpoints as web. For a given class occurrence, both clients join the same persisted live-session record and pass the API-issued Zoom `sessionName` verbatim. Host and participant credentials resolve the same provider topic, with the provider session ID supporting older records; a database ID or displayed class title is never substituted for a missing Zoom topic. Participant tokens share the same SDK application, topic and session key while preserving individual identities and roles. The application passcode is an API admission credential, not a Zoom transport session password.

A new store/development binary is required for native dependency, entitlement, extension and service changes. The app uses Expo fingerprint runtime versions so an OTA update cannot deliver native SDK JavaScript to an incompatible older binary. Older binaries retain personal browser handoffs. A tablet below Android 9 cannot install the new native build and must retain an existing supported meeting route.

## Internal tablet builds

Use the existing `preview` EAS profile for standalone internal builds. It uses internal distribution, the preview environment and the preview update channel; it does not require a running Metro server. Set `EXPO_PUBLIC_API_URL` to the HTTPS test API in the EAS preview environment, and configure the matching non-production Supabase authentication values there. Verify these destinations before building. Zoom SDK secrets remain in the test API environment.

```bash
cd apps/mobile
eas device:create
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

Register each test iPad before creating the iOS build so its provisioning profile includes the device. Android internal builds install as APKs. Install the resulting builds on the test tablets, sign in with non-production accounts, and run the live scenarios below with a second participant. The release-style preview builds exclude the development fixtures; run deterministic fixture flows using the development profile instead.

## Classroom boundaries

- Signed-in identity and enrolled-student selection come from the API. Guest names, invitation capabilities and identity-bound admission retry tokens recover from encrypted device-only storage; passcodes and SDK JWTs are never persisted. Expired/revoked invitation responses clear the stored capability so Retry can use the normal join flow. Plain-link guests can enter a name and passcode; invited guests bypass passcode entry after API verification. Session buttons, meeting cards, classroom URLs in message text and OS-delivered invitations/personal handoffs use the same native entry handler. Binaries without the native SDK retain browser access. Native join links carry a meeting identifier; SDK credentials are renewed when Join is pressed. Preview remains an explicit step.
- One SDK provider owns the application lifecycle. Route cleanup removes subscriptions and leaves the active session; joining never automatically reclaims host. Eligible teachers/staff claim host explicitly with confirmation. Co-host assignment does not replace the host. First joins reconcile the SDK’s actual session state if an iOS join event is missed. Recording and existing-share status load after entering the classroom. A failed join returns to preview after a 30-second join deadline and at most five seconds of SDK cleanup, with Retry available.
- The app-owned whiteboard uses a bundled offline Excalidraw canvas with the same scene contract and educational assets as web. API capabilities stay in native code and never enter the WebView. Latin drawing fonts are bundled offline; CJK glyphs use device fallback fonts. The API checks editing and presentation permissions. Save retries retain operation IDs, and pending drawings are recovered locally for the same authorized board. PNG exports use the native share sheet.
- Screen annotations use the same API rooms and normalized object coordinates as web. Native overlays fit the received content rectangle rather than the surrounding letterbox. A composited share from web already contains its annotations and must not receive duplicate permanent overlays.
- Sharing follows web's share privilege. Hosts choose host-only, one presenter, or simultaneous presenters; native bridges Zoom multi-share because the React Native wrapper only exposes locking. Viewers see every presenter, the newest share takes the stage, and a stopped share falls back to a remaining presenter.
- Recording state includes web's automatic pause, resumed from the same record control. When the Zoom account requires recording consent, participants answer in the app: declining traditional consent leaves the class, declining individual consent stays unrecorded. A mobile host with messages disabled turns chat off for everyone through the SDK chat privilege, as web does.
- The ended screen states why the session closed (left, ended by host, removed, network). SDK errors use actionable copy, and camera/microphone access revoked mid-class offers Settings. Quality events use web's vocabulary: `good`/`bad` network transitions and `reconnecting`/`fail` connection states.
- Background photos are downscaled copies of `apps/web/public/live-session-backgrounds` in `apps/mobile/assets/live-session-backgrounds` (longest side 1920px), named by the shared `buildMeetingBackgroundCatalog`. Add or remove a photo in both directories and register it in `src/lib/classroom/background-catalog.ts`. The chosen effect is remembered locally and applied after joining; camera-library photos are not remembered.
- Recording a visible app-owned whiteboard publishes its canvas through Zoom's native view-sharing API. Screen sharing composites saved annotation objects into outgoing frames: Android uses Zoom share preprocessing and iOS uses the ReplayKit extension. UI controls and selection handles are excluded from the annotation overlay. Native publishers announce composition only after outgoing frames are composed; web and native expire silent announcements after six seconds. Recording start/resume requires all active screen presenters to publish composed content, and loss of content pauses recording (or stops it if pause fails). Stale annotation overlays stop screen sharing rather than continuing with missing annotations. Signed-device verification of the actual cloud video remains required; component tests and simulator builds cannot certify recorded pixels.
- Whiteboard toolbar More contains save/reconnect status, participant initials, PNG/SVG exports, and user-accessible download/discard of pending edits. Discard requires confirmation and reloads the saved scene before removing the local queue. The educational library groups assets by category and reports empty search results.
- Invite opens a native sheet with separate copy actions for the join link and passcode, plus the operating-system invitation share chooser. Chat keeps the full received in-call history for parity with web; leaving clears the meeting state.
- Native sheets, focused video, whiteboards, settings, reaction trajectories and control-pop animations respect the system reduced-motion preference. Canvas tools and meeting actions use semantic Lucide icons with accessible labels and selected/disabled state.

## Device, sharing and follow controls

Audio settings and Video settings are available directly from the call bar. Each opens its matching settings tab without changing microphone or camera state. Original sound explains speech versus music mode and recommends headphones when noise suppression is disabled. Poor-connection help offers a camera-off action; it leaves the microphone state unchanged.

While publishing a screen or whiteboard, a persistent notice identifies the outbound content and exposes Stop sharing. Expanded whiteboards retain this action. Stopping whiteboard publishing first stops outbound SDK media, then ends the app board presentation; if the latter fails, the classroom reports that the board remains open so the host can retry. Stop failures keep the action available and repeated taps cannot issue concurrent stops.

The whiteboard uses the same rounded toolbar, tool order, icons and labeled menus on web and mobile. The icon-only Focus tutor button centers the tutor’s current writing location (or viewport) once; it does not continuously follow their movements. Its tooltip or native long-press hint explains the action. Each board initially fits saved content or centers the blank scene, and makes one initial tutor focus when a live tutor view is available. More contains save status, participants, export and editing permissions. Mobile keeps Focus tutor and More visible while drawing tools scroll, preserving 44-point touch targets. Local drawing/text editing interrupts camera movement and reduced-motion preferences disable interpolation. Writing focus is ephemeral, API-validated, and independent of editing authorization. Whiteboards and screen annotations default to the laser pointer. Both drawing style strips have Close and Show controls; screen annotation shapes support a separate fill color, including transparent fill.

These controls follow the discoverability principles in [Meet's device controls](https://support.google.com/meet/answer/10409699), [Meet's presentation guidance](https://support.google.com/meet/answer/9308856) and [Zoom's participant-follow controls](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0061925). Web captions retain a polite, atomic live region while enabled, including between caption messages, for screen-reader announcements.

## 1-1 lesson experience

The in-class screen follows web's call layout rather than a scrolling page: a header with the class title, attendee count, timer and recording badge; a stage that the gallery or shared content fills; and pinned controls. Chat ("In-call Messages", with "You" and web's relative times), People and the Zoom-hosted whiteboard open as sheets. Joining plays web's two-note chime, rendered natively as a system sound on iOS and on the call-signalling stream on Android so it never changes the call's audio routing or focus. After leaving, people rate the session with web's five labelled choices and can Submit or Skip.

The phone call bar uses icon controls ordered microphone, camera, whiteboard, screen share, More, and leave. Whiteboard controls stay beside camera and microphone. More opens a compact bottom sheet (bounded in width on tablets, dismissible by tapping outside) with labeled action rows for chat, collaboration tools, reactions and host controls. Audio and video are tabs inside the single Settings entry, rather than separate meeting menu actions. Camera switching, mirroring and self-view preferences live in the Video tab; share policy and automatic floating calls live in Meeting settings. Audio settings contain device routes, microphone activity and microphone/speaker tests. Chat accounts for the iOS sheet inset so the keyboard leaves the composer and Send action visible. Chat preserves unsent drafts on failure, prevents duplicate sends while a request is pending and keeps newly typed text after the previous message sends. Recording status is accessible to screen readers and stays visible in expanded whiteboards. Web and native preview show a single Settings entry instead of a separate device-test shortcut. Closing native settings stops active audio tests even if cleanup reports an error.

The whiteboard fills the available drawing area without a title/header. The board occupies the same presentation area as a shared screen, with a participant filmstrip and the call controls available. In landscape, the presentation fills the left side and a scrollable participant rail sits on the right; portrait keeps the rail below. Both presentations offer a direct full-screen expansion control. Floating controls return to video or open board/library/export options. Expanding the board uses the full screen. Starting a board presents it to everyone; Return to video only hides it on this device. Only the participant who started the whiteboard can stop its presentation for everyone. Hiding it locally leaves sharing active. Student drawing still follows the teacher’s editing permission, with view-only guidance in board options. Disabled participant screen annotations also explain the host’s permission setting. A new presentation automatically opens for connected participants, including when started on mobile. Presentation polling continues while drawing or retrying unsaved strokes so a remote stop closes the board promptly. Older save responses cannot reopen a stopped presentation. A new SDK screen share replaces the local whiteboard view, and stopping an expanded screen share returns to the call.

On iPhone/iPad, Share screen opens a native sheet with Apple's visible broadcast button. Tap it, then choose Start Broadcast in the system dialog. The app confirms sharing from SDK share events, not from opening the picker. Missing broadcast extensions or App Group entitlements produce an actionable error. This native control requires a new signed native build; an OTA update alone cannot add it. Device signing must include the classroom App Group for both targets, and receiving the broadcast must be verified in a live call on physical hardware.

## Platform media controls

Native settings enumerate SDK cameras and OS communication audio routes. On iOS/iPadOS, choosing a headset selects its input and associated communication route; speaker override and system default remain available. Android 12+ exposes available communication devices; older Android versions offer speaker or the OS-selected connected route. Bluetooth and USB availability depends on the tablet and attached hardware. Device lists refresh while settings are open, and disconnected-device selections fail without silently switching cameras.

Floating calls use a dedicated AVKit video-call content source on iOS/iPadOS 16+ and Android activity picture-in-picture on supported devices. The application does not invoke the SDK sample's hard-coded CallKit identity. Automatic entry defaults off and is stored as a local preference. Shared screens take priority over the focused participant, then remote video; leaving clears subscriptions and disables automatic entry. Picture-in-picture is suspended while the whiteboard is open or has pending drawings, preserving unsaved edits. The floating surface contains call video, rather than the full interactive classroom UI. Android users restore the meeting with system controls; iPad camera/background behavior still needs physical-device verification.

Native classrooms do not use CallKit; adding it is a product decision because CallKit apps are restricted on some App Store storefronts. Instead, iOS observes audio-session interruptions (phone calls, Siri, including iPad call banners that keep the app in the foreground), shows that class audio is paused, and restores Zoom's audio session environment when the interruption ends. Outside picture-in-picture, the camera is turned off when the app moves to the background, so others see the avatar instead of a frozen frame, and turned back on when the app returns; a camera that was already off stays off. Android audio-focus behavior during phone calls is left to the Zoom SDK and needs physical-device verification.

## Automated verification

### Web/native compatibility contract

Compare native changes against the owning web flow, rather than copying web-only browser APIs into mobile. The same API contracts govern both clients.

| Capability                              | Web reference                                             | Native implementation / verification                                                                                                                                                                                   |
| --------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity, preview and explicit join     | `live-session-setup.tsx`, `device-preview-step.tsx`       | `native-classroom-entry.tsx`, `native-device-preview.tsx`; API identity, responsive tablet columns, adjacent settings/audio-check icons and tablet lifecycle flow                                                      |
| Admission and host/co-host permissions  | `meeting-waiting-room.tsx`, `zoom-participants-panel.tsx` | Same API admission endpoints; controller tests and moderation/student tablet flows                                                                                                                                     |
| Primary controls and More               | `zoom-meeting-controls.tsx`, `zoom-more-controls.tsx`     | `native-meeting-toolbar.tsx`, `native-meeting-dock.tsx`; pinned round controls, expandable secondary actions and web's single adaptive Leave / End class / Leave or end class control and dialogs                      |
| Chat, reactions, captions and recording | Web Zoom session hooks                                    | Native SDK adapter and controller; unread counts, deduplicated chat, chat privilege, hand/reaction dock with tile badges, timer, paused recording and consent; live media/recording checks required                    |
| Whiteboard and educational assets       | Web Excalidraw canvas                                     | Bundled Excalidraw canvas and shared asset registry; native persistence and PNG export flows; ephemeral lasers use the same API presence endpoint as web                                                               |
| Annotation editing                      | `components/screen-annotations`                           | Shared API objects; normalized native SVG shapes, selection, movement, resize, rotation, styles, versioned undo/redo and native export                                                                                 |
| Temporary annotation tools              | Web annotation presence transport                         | Same pointer/laser endpoints; temporary strokes never enter saved drawing history                                                                                                                                      |
| Focus and speaking                      | `focused-fullscreen.tsx`, `use-speaking-participants.ts`  | `native-participant-gallery.tsx`; full-stage gallery (one fills, two stack or sit side by side, 2×2 beyond), share filmstrip, (You) labels, hide self-view, focused video/share dialog and SDK-derived speaker borders |
| Floating call                           | `use-meeting-picture-in-picture.ts`                       | AVKit on iOS/iPadOS 16+; Android activity PiP with explicit/automatic entry, compact controls and restoration                                                                                                          |
| Screen sharing                          | Browser screen capture                                    | Native OS-approved ReplayKit/MediaProjection; verify on physical tablets                                                                                                                                               |
| Device settings                         | Browser device selectors and processing options           | Native audio route/camera selectors with disconnect refresh, mirroring, host sharing restrictions, original audio and background effects; hardware-specific verification required                                      |

This table maps implementations and tests; it does not certify full feature parity. Native picture-in-picture and hardware device selection are implemented; actual media and connected hardware still require physical-device verification. Preview and settings share the web hierarchy, with native touch targets and OS media permissions. Platform-only browser acceleration settings do not map directly to native SDK controls.

Run focused tests and then the repository's full CI command:

```bash
pnpm --filter mobile test --runInBand src/lib/classroom src/components/classroom src/lib/messages/open-live-session.test.ts
pnpm run ci
```

The tests cover short-code resolution, API-derived identity, parent selection, admission approval, guest invitation/name recovery, optional-auth HTTP transport, device refresh/selection, PiP configuration ordering and cleanup, SDK event mapping, preview/join lifecycle, duplicate joins, permission boundaries, cleanup, web-compatible commands and whiteboard recovery. Native compilation is a separate check; TypeScript/Jest cannot prove a native binary links or loads.

For deterministic tablet UI tests, install a development binary and Maestro. Start the dedicated Metro instance with non-production API/Supabase configuration:

```bash
pnpm --filter mobile canvas:build
pnpm --filter mobile exec expo start --dev-client --port 8085 --lan
maestro --device YOUR_DEVICE_ID test apps/mobile/.maestro/classroom-ui.yaml apps/mobile/.maestro/classroom-join-failure.yaml apps/mobile/.maestro/classroom-moderation.yaml apps/mobile/.maestro/classroom-student.yaml apps/mobile/.maestro/classroom-link-entry.yaml apps/mobile/.maestro/classroom-export.yaml apps/mobile/.maestro/classroom-annotations.yaml
node apps/mobile/scripts/verify-classroom-export.mjs ios YOUR_DEVICE_ID
```

The simulator bootstrap opens the development client at `http://127.0.0.1:8085`. On physical tablets, open the development client using the reachable LAN address before running the live flows. Android emulators can use `adb reverse tcp:8085 tcp:8085`. The fixture routes are unavailable in release builds. The link-entry flow renders the real native entry and preview components with synthetic API responses; the Android PiP flow verifies actual OS transitions and restoration without claiming live media transport. Run `classroom-picture-in-picture.yaml` separately on Android after the common flows. It initializes the actual native SDK and uses deterministic meeting/API adapters for UI scenarios. These flows do **not** prove live Zoom connectivity or media transmission.

For live tests, sign a non-production account into the app, configure the test API with valid Zoom Video SDK credentials (the existing web SDK credentials can be reused), and start a dedicated classroom. Keep a second web/native participant connected for moderation and collaboration checks:

```bash
maestro --device YOUR_DEVICE_ID test -e SESSION_ID=YOUR_TEST_SESSION_ID -e DISPLAY_NAME="Native test teacher" apps/mobile/.maestro/classroom-live.yaml
maestro --device YOUR_DEVICE_ID test -e SESSION_ID=YOUR_TEST_SESSION_ID -e PEER_NAME="Native test student" apps/mobile/.maestro/classroom-live-host.yaml
```

Keep account passwords, JWTs and invitation capabilities out of flow files, CLI arguments, screenshots and test artifacts. Meeting identifiers and synthetic display names are sufficient after signing in.

## Physical-device release checks

Before enabling native classroom use for teachers, verify the following on a real iPad and representative Android tablets, with a web participant in the same session:

| Scenario                | Required observation                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preview and permissions | Camera preview appears before joining; denied permissions remain recoverable; no repeated name/password entry.                                           |
| Audio self-check        | Microphone recording/activity and speaker playback use the selected route; tests stop before joining or leaving.                                         |
| Collaboration           | Drawing, editing permissions, educational assets, presentation changes and screen annotations agree between native and web participants.                 |
| Screen broadcasting     | OS approval appears; another participant receives the screen; cancellation, stopping and leaving remove the broadcast/notification.                      |
| Host/co-host            | Joining leaves the existing host in place; explicit claim, assignment, revocation and end-for-all affect the intended participants.                      |
| Recording               | The indicator follows provider state; existing recording is observed; the final recording includes media and explicitly broadcast classroom content.     |
| Recovery                | Background/foreground, lock/unlock, Bluetooth changes, incoming calls, Wi-Fi/mobile-data switching and process restart preserve a recoverable join path. |
| Device limits           | Portrait/landscape, split-screen and touch/stylus work on each supported tablet without hiding controls or losing unsaved changes.                       |

A simulator run is useful evidence for navigation, layout and bridge loading. It is not evidence for physical camera, Bluetooth, interruptions, ReplayKit broadcasting or Fire tablet support.

## References

- [Zoom React Native SDK setup](https://developers.zoom.us/docs/video-sdk/react-native/get-started/)
- [Zoom native screen sharing](https://developers.zoom.us/docs/video-sdk/react-native/share/)

## Verified classroom links

Shared HTTPS `/live/<code>#invite=<capability>` links use iOS Universal Links and Android App Links. Installed compatible binaries route to native entry and preview; without the app the existing web route remains available. The OS can honor a user's choice to stay in their browser. Joining always requires the preview's Join action. Signed-in identity, guest recovery and admission still come from `apps/api`.

`app/+native-intent.tsx` handles both cold starts and already-running app links. It saves invitation capabilities in encrypted device storage before navigation. Personal handoffs are redeemed through the API; neither capability is copied into route parameters. Other scheme routes, including authentication callbacks, retain their existing routing. Failed recovery shows a retry instruction instead of silently joining or requiring login.

Deployment configuration lives in `ops/mobile-links.json` and contains only public identifiers:

The configured Apple application identifier uses the verified App ID Prefix `5NVN93C486`. The Android fingerprint is the Google Play app signing certificate; internal EAS builds must register their own signing fingerprint if it differs.

1. Confirm `domains` matches the actual shared-link host and `EXPO_PUBLIC_WEB_URL` in each build. The initial host follows the existing `app.iconicedu.com` web default; confirm it before release.
2. Set `iosApplicationIdentifiers` to the exact application identifier from the signed app's entitlements (`application-identifier`, usually `TEAMID.com.heidisoft.iconicedu`). Do not assume the Team ID and application identifier prefix are always equal.
3. Set `androidCertificateSha256` to the SHA-256 fingerprints of the certificates signing supported builds. Google Play App Signing can use a different certificate from EAS internal builds; register both if both should open links. Do not publish private signing keys or keystores.
4. Deploy web, and confirm `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` return JSON with HTTP 200, without authentication or redirects, on every registered host. Empty identifier arrays deliberately authorize no app until configured.
5. Run native prebuild and produce new signed EAS binaries. Associated domains and Android intent filters cannot be added by an OTA update alone.
6. On real iPad/Android tablets, test links tapped in messages/email with the app closed and open, signed in and signed out; verify invitation recovery, waiting-room approval and preview. Also test expired links and the web fallback without the app. Simulator scheme tests cannot certify OS domain association. The `classroom-deep-links.yaml` development flow covers warm scheme routing and recovery from an invalid link. Cold launches must be checked in a signed internal build: Expo development clients can stop at their server launcher instead of loading the app.

This association metadata is a maintenance exemption from web feature flags: it supports existing classroom URLs and changes no classroom authorization or web join behavior. The metadata routes contain no business logic or credentials.

References: [Expo native intent](https://docs.expo.dev/router/advanced/native-intent/), [iOS Universal Links](https://docs.expo.dev/linking/ios-universal-links/), [Android App Links](https://docs.expo.dev/linking/android-app-links/).

### Network entry regression tests

The native E2E runner also starts `scripts/classroom-link-test-api.mjs` on localhost:8999 and runs `classroom-network-links.yaml`. This uses the real OS link handler, SecureStore, typed HTTP client, entry screen, native SDK preview and native SDK credential rejection. The synthetic HTTP boundary enforces the API requirement that the **first** join already carries a 32-character admission token; waiting-room responses use HTTP 202. Tests cover guest recovery, approval, repeated rejected SDK joins, lost-response handoff retries (including Android transport retries) and expired invitations. It does not substitute for testing live Zoom media or production API/database authorization.

Admission retry tokens are bound to the signed-in account, display name, selected student and invitation. The API still decides whether admission is required and approved. Passcodes and SDK JWTs remain in memory only.

After configuring the public signing identities and deploying web, run `pnpm --filter mobile links:verify`. It refuses empty identity lists, redirects, non-JSON responses and mismatched hosted app/certificate/path associations. Run its offline regression checks with `pnpm --filter mobile test:links:deployment`. Successful hosted metadata verification must be followed by cold/warm HTTPS link tests in signed internal builds on physical iPad and Android tablets.

### Complete classroom regression suite

From the repository root, `pnpm test:e2e:classroom <layer> <platform>` selects an explicit verification layer:

| Layer         | Platform                  | Coverage                                                                                                                                                                                                                                                                   |
| ------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui`          | `web`                     | Preview identity/devices, microphone/camera lifecycle, participants, host/co-host, recording controls/composition, annotation tools, fullscreen and responsive layouts. Uses development-only fixtures and synthetic meeting adapters.                                     |
| `ui`          | `ios` or `android`        | Native preview, join failures, admission/moderation, accountless links, microphone/camera/share transitions, annotation history, whiteboard drawing/text/assets/export and saved recovery. Uses development-only fixtures.                                                 |
| `integration` | `web`                     | Real local API/PostgreSQL admission/recovery and whiteboard/annotation persistence, collaboration and classroom isolation.                                                                                                                                                 |
| `integration` | `ios` or `android`        | Web/native whiteboard and annotation synchronization against real local API/PostgreSQL. Select the installed development client with `NATIVE_SYNC_DEVICE_ID`.                                                                                                              |
| `live`        | `web`, `ios` or `android` | Real signed-in homepage, classroom and session-card entry through preview, media toggles, participants, raised hands, recording, screen capture and whiteboard changes. Requires a dedicated deployed test environment, provisioned classrooms and signed native binaries. |

Stop the web development server before running the production build in `pnpm run ci`, then restart it for device/live checks. Both modes use `apps/web/.next`; building while the development server runs can leave it serving missing chunks.

For UI/integration layers start the required development servers first. Set `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_SKIP_WEBSERVER=1` for an existing web server. Integration requires local Supabase and API with current migrations. Native UI defaults to Metro on 8085 (pass `-e METRO_PORT=8081` to Maestro when using the standard development server) and requires an installed SDK development build; the bootstrap flow deliberately restarts the app. See the cross-client commands below for API/proxy ports. Run device tests serially; never share the same device/proxy between concurrent runs.

Live configuration is local and untracked. Copy `ops/classroom-e2e.example.json` to `.classroom-e2e.local.json`, then replace every route, selector and display name with values for dedicated synthetic test classes. Provision the ten matrix cases independently: homepage and classroom each cover scheduled/unscheduled classes with/without a running meeting; session cards cover scheduled classes with/without a running meeting. The test operator must ensure each initial state and a blank whiteboard before every run. The web suite also checks the join API's `created` response for newly started meetings. Each class must opt into Video SDK, enable whiteboard and recording with stop permitted, and allow the test teacher to host. Existing meetings must have their original host connected or otherwise grant the test account recording permission. Tests end their test meetings; do not point them at ordinary lessons. The native device must already be signed in with the synthetic teacher account. The installed Maestro runner supports Android hardware and emulators, and iOS simulators. Physical iOS calls require a signed device build and an operator for the live checks; passing a physical iPhone identifier to Maestro does not automate it.

The live runner refuses missing matrix rows or unsigned-in web configuration. For web, save synthetic test-account auth to a private file outside the repository (or ignored `.classroom-auth*.json`) using Playwright's storage-state support. Native selectors must identify one Join action on the configured source screen. Configure the source view to show only the selected test class if its accessible Join label is shared by several cards. External Zoom URL classrooms intentionally retain the legacy provider flow and are not native Video SDK test cases.

```bash
CLASSROOM_E2E_CONFIG="$PWD/.classroom-e2e.local.json" \
PLAYWRIGHT_AUTH_STATE=/private/path/test-teacher-auth.json \
pnpm test:e2e:classroom live web

CLASSROOM_E2E_CONFIG="$PWD/.classroom-e2e.local.json" \
NATIVE_SYNC_DEVICE_ID=YOUR_DEVICE_ID \
pnpm test:e2e:classroom live ios
```

Live browser tests disable trace/video/screenshots and retries. Run them headed and grant screen capture when the browser requests it. Native live capture accepts the operating system's broadcast/projection prompt; OS-version variations must be checked on the actual iPad/iPhone/Android device. Keep Maestro failure artifacts private: they can contain invitation URLs from source dialogs. Live screen annotation requires a second participant presenting; the automated web/native API synchronization checks do not certify actual Zoom screen transport. Verify both presenter directions on physical devices using the separate live annotation receiver flow, while the peer shares a synthetic slide. Verify the peer observes microphone/video/hand changes and recording notifications; single-client button state alone is not media delivery evidence. Missing live environment/device results must be reported as unverified, never as passing fixtures.

The suite configuration parser is covered by `pnpm test:e2e:classroom:config` and included in the CI deployment checks. This test infrastructure is a feature-flag maintenance exemption and adds no new classroom authorization or admission behavior.

For live annotation transport, a second signed-in test participant must share a fresh synthetic slide with annotation permission enabled. Run the receiver on web with `CLASSROOM_E2E_ANNOTATION_PATH=/live/TEST_CODE PLAYWRIGHT_AUTH_STATE=/private/path/receiver-auth.json PLAYWRIGHT_BASE_URL=https://YOUR_TEST_WEB PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm --filter web test:e2e classroom-live-annotations.spec.ts --headed --workers=1 --retries=0`. On an Android device or an iOS simulator receiver run `maestro --device YOUR_DEVICE_ID test -e SESSION_ID=TEST_CODE .maestro/classroom-live-annotations.yaml` from `apps/mobile`. Both receivers verify a blank room, drawing, undo/redo and removal of the test mark. Repeat with web presenting to native and native presenting to web, and confirm the presenting peer sees the marks before undoing them. These flows require a running peer and cannot be certified by the single-device UI suite.

The native `classroom-presentation-transition.yaml` UI flow simulates a remote board stop during a failed drawing save, then a peer screen share with full-screen expansion and collapse. It also checks that unsaved edits remain protected when leaving. Meeting media in this flow is synthetic.

### Cross-client collaboration checks

Web and native use the same whiteboard operations, permission state, presentation state and ephemeral laser endpoints. Any authorized participant's Whiteboard action starts presentation when no board is active; opening or hiding an active board changes only their local view. Presentation ownership is enforced by the API. Screen annotation rooms use the Zoom presenter ID as their share key. Mobile hosts initialize the room even while sharing their own screen, and can allow or disable participant annotation from More. Recording controls in More support start, pause, resume and stop according to class policy, prevent repeated pending requests, and surface SDK availability errors; the call header shows REC or PAUSED. Switching the displayed presenter or entering focused view does not end a room; only an actual share-stop event closes that presenter's room. A presenter change resets native annotation state until the new share dimensions arrive.

`native-whiteboard-sync.spec.ts` coordinates Chromium with an installed native simulator. It exercises both Excalidraw UIs against a real local `apps/api` and Supabase database: web-to-native drawing, native-to-web assets, editing permissions, presentation close and presentation started from native. `collaborative-annotations.spec.ts` includes a native interoperability scenario that checks web/native marks and native undo through the real API. Only SDK meeting media is synthetic; these tests do not certify live screen transport or recording composition.

For these optional device tests, run local Supabase, `apps/api` on port 8998, and web on port 3005 with its API URL set to `http://127.0.0.1:8998`. Start the mobile development client on Metro 8085 with `EXPO_PUBLIC_API_URL=http://127.0.0.1:8999`. Port 8999 must be free: each test starts its own localhost bootstrap/proxy, while authorization and persistence remain in `apps/api`. For Android, forward both ports with `adb reverse tcp:8085 tcp:8085` and `adb reverse tcp:8999 tcp:8999`. Do not run these device tests in parallel because they share the proxy port and device UI.

```bash
NATIVE_SYNC_DEVICE_ID=YOUR_SIMULATOR_ID PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3005 pnpm --filter web test:e2e native-whiteboard-sync.spec.ts --workers=1
NATIVE_SYNC_DEVICE_ID=YOUR_SIMULATOR_ID PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3005 pnpm --filter web test:e2e collaborative-annotations.spec.ts --grep "web and native synchronize" --workers=1
```

The tests skip without `NATIVE_SYNC_DEVICE_ID`. Temporary capabilities stay in private local bootstrap files and are removed during cleanup; traces and recordings are disabled for the interoperability scenarios. Native fixture routes are unavailable in release builds and suppress Expo's floating developer button so it cannot intercept canvas gestures. Successful collaboration tests must still be followed by the physical-device screen broadcasting and recording checks above.

### Following the whiteboard viewport

The Focus tutor icon on both platforms centers the current active writing location or
tutor viewport once, including an initial focus on join. Participants then navigate
independently; clicking the icon again requests a fresh location. Missing or expired
tutor updates leave the participant’s viewport unchanged. A one-time focus shares the
scene center and zoom across different screen sizes without changing editing permissions.

Viewport updates use capability-authenticated API endpoints, are scoped to the current
board and live session, and expire after ten seconds. They never change saved drawing
revisions. Apply migration `20261016120000_whiteboard_viewport_presence.sql` before
deploying the API. Web controls remain behind the catalogued, default-off
`enable-classroom-whiteboard` flag.

Any participant can start the whiteboard when no presentation is active. During a
presentation, the web whiteboard button and mobile Whiteboard action offer **Hide
whiteboard for me** or **Show whiteboard**. These only change the local view, including
for the presenter, and do not stop outbound publishing. Only the person who started
the presentation sees **Stop sharing for everyone**; the API enforces the same rule
for students and tutors. Another participant cannot replace an active presentation.
Once sharing stops, all participants return to the call and the saved board is retained.

### Drawing controls on mobile

Screen sharing exposes the same pencil toggle as web. Tap it to show the compact
annotation toolbar: Pan, Laser pointer, Select, Pen, Text, Eraser, Shapes, Highlighter,
Stamps, Attention, Undo, Redo, styles, and additional actions. Shapes, stamps, and
attention tools expand in groups; style and advanced actions stay in an options panel.

The mobile whiteboard orders controls like web: Pan, Laser pointer, Select, Pen, Text,
Eraser, Shapes, Library, Undo, View controls, and More actions. View controls include
grids, snapping, fit, and zoom. More actions contains redo and tutor-only clearing.
The contextual style strip updates stroke width, color, and shape fill. Local undo
and redo preserve other participants’ drawing elements.

Following reads remote viewports independently of publishing the local view, so an
outgoing request failure cannot stop incoming updates. The default tutor selection
uses a currently publishing tutor after reconnects. Whiteboard options report whether
the selected view is following, waiting for updates, or reconnecting.

The mobile screen-annotation bar uses a single pencil/close launcher, a rounded
scrollable icon row, and the same 240 ms width transition as web. System reduced
motion disables that transition. Closing collapses the bar, closes options and stops
drawing; reopening selects the pen. No annotation count is displayed.

Shapes, stamps and attention options use labeled grids. Format and More are separate
panels with explicit close controls. Format includes the web palette, custom color,
width, opacity, text settings, pressure capture and Apply to selected. More includes
duplicate/delete, export, permission-aware clearing, annotator names and toolbar
position. The drag handle and dock selection persist position on the device. Touch
targets remain at least 44 points; selecting an object shows its author where web
uses hover.

Ready-to-join screens provide Back before joining. Mobile uses a fixed, safe-area-aware
“Ready to join?” header with the same centered title and chevron back control as other native pages.
When the preview camera is off, mobile shows a centered initials avatar using the current display name.
Single-participant and shared-device joins render the same native classroom preview and Settings sheet;
the shared-device variation adds student selection. The preview controller may exist before
credentials are issued, but it cannot connect to the SDK until Join obtains real API authorization.
For multiple enrolled students,
web and mobile show Who is joining inside the preview, allow selecting one or more students sharing a device,
and allow a separate display-name edit with Save and Cancel. Changing the selection
resets the displayed name to the selected names joined with an ampersand; the student profile and admission token
remain separate from the editable display name. Mobile does not request admission
until the student is chosen and Join is pressed. People uses avatar rows, host/co-host
labels, microphone/camera indicators, hand state, and permission-gated contextual actions.
Preview and classroom errors use styled, announced alert cards.

A shared sibling connection submits `studentProfileIds`; the legacy `studentProfileId`
remains supported for a single student. The API checks every selected child against
active family links and this class’s enrollment, uses a separate shared SDK identity,
and binds admission approval to the entire canonical set. Shared credentials include
all verified profile IDs, rather than attributing the connection to only one child.
Changing the selection rotates pending admission identity; selection order does not.

Meeting Settings retains Audio, Video, and Meeting tabs. Microphone, audio output, and camera selectors
show the SDK-selected device and refresh as devices connect or disconnect. The styled rows
open an iOS system action sheet (anchored on iPad) or an Android native picker dialog.
These controls do not use a styled JavaScript popup or portal. Android uses the Expo-compatible
`@react-native-picker/picker` package; rebuild the native development client after installing it.
Selection waits for the SDK result, prevents duplicate taps, and keeps failures recoverable
below the selector. iOS lists available microphone inputs and sets the preferred input through
AVAudioSession. Android uses the microphone associated with the selected communication
route, so microphone and output changes are linked and the UI explains this. Bluetooth
routes may couple input and output on either platform. The Audio tab also includes a microphone on/off switch;
volume is adjusted with device buttons. Speaker and microphone tests stop when leaving
the Audio tab or closing Settings.

Video settings presents background effects in a responsive thumbnail grid with short
captions, a selected checkmark, and a separate photo upload button. None and Blur use
icons in the same thumbnail size as the bundled photos; narrow layouts use two columns.

Post-class feedback uses the same themed star-rating treatment as the activity feed,
with a five-point rating, explicit Submit, and an optional Skip action. The card uses
the app’s light/dark surfaces and action colors; rating and navigation controls are
disabled while feedback is being submitted.

The ready-to-join preview omits the camera/audio reminder subtitle on web and mobile.
Whiteboard and screen-share annotation palettes keep their color order fixed and mark
the selected swatch. Closing drawing styles hides the whole picker; pressing the
selected tool toggles it again. Picker visibility survives strokes and scene updates.
Mobile keeps the offline WebView source stable, avoids replaying unchanged scenes,
and uses a transparent canvas over the default dotted paper. The on-canvas fullscreen
control uses the same expand/collapse icons as web; local Hide/Show is available only
through the meeting Whiteboard control. Screen sharing and whiteboard presentation
are mutually exclusive for hosts and participants, including when a board is hidden locally.
