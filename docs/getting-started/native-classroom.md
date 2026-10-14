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

SDK keys and secrets belong only in `apps/api`; never add them to Expo public environment variables. The API's existing Zoom SDK configuration is described in [deployment](../operations/deployment.md). Native clients use the same authenticated join/admission endpoints as web. The application passcode is an API admission credential, not a Zoom transport session password.

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

- Signed-in identity and enrolled-student selection come from the API. Guest names, invitation capabilities and identity-bound admission retry tokens recover from encrypted device-only storage; passcodes and SDK JWTs are never persisted. Expired/revoked invitation responses clear the stored capability so Retry can use the normal join flow. Plain-link guests can enter a name and passcode; invited guests bypass passcode entry after API verification. In-app browser handoffs retain their browser route; OS-delivered personal handoffs redeem through the same API before native preview. Native join links carry a meeting identifier; SDK credentials are renewed when Join is pressed. Preview remains an explicit step.
- One SDK provider owns the application lifecycle. Route cleanup removes subscriptions and leaves the active session; joining never automatically reclaims host. Eligible teachers/staff claim host explicitly with confirmation. Co-host assignment does not replace the host.
- The app-owned whiteboard uses a bundled offline Excalidraw canvas with the same scene contract and educational assets as web. API capabilities stay in native code and never enter the WebView. Latin drawing fonts are bundled offline; CJK glyphs use device fallback fonts. The API checks editing and presentation permissions. Save retries retain operation IDs, and pending drawings are recovered locally for the same authorized board. PNG exports use the native share sheet.
- Screen annotations use the same API rooms and normalized object coordinates as web. Native overlays fit the received content rectangle rather than the surrounding letterbox. A composited share from web already contains its annotations and must not receive duplicate permanent overlays.
- Sharing follows web's share privilege. Hosts choose host-only, one presenter, or simultaneous presenters; native bridges Zoom multi-share because the React Native wrapper only exposes locking. Viewers see every presenter, the newest share takes the stage, and a stopped share falls back to a remaining presenter.
- Recording state includes web's automatic pause, resumed from the same record control. When the Zoom account requires recording consent, participants answer in the app: declining traditional consent leaves the class, declining individual consent stays unrecorded. A mobile host with messages disabled turns chat off for everyone through the SDK chat privilege, as web does.
- The ended screen states why the session closed (left, ended by host, removed, network). SDK errors use actionable copy, and camera/microphone access revoked mid-class offers Settings. Quality events use web's vocabulary: `good`/`bad` network transitions and `reconnecting`/`fail` connection states.
- Background photos are downscaled copies of `apps/web/public/live-session-backgrounds` in `apps/mobile/assets/live-session-backgrounds` (longest side 1920px), named by the shared `buildMeetingBackgroundCatalog`. Add or remove a photo in both directories and register it in `src/lib/classroom/background-catalog.ts`. The chosen effect is remembered locally and applied after joining; camera-library photos are not remembered.
- Cloud recording records SDK media. To include the app-owned board or other native UI, the presenter must approve device screen broadcasting. Drawing on the board alone does not silently start an operating-system broadcast.

## Platform media controls

Native settings enumerate SDK cameras and OS communication audio routes. On iOS/iPadOS, choosing a headset selects its input and associated communication route; speaker override and system default remain available. Android 12+ exposes available communication devices; older Android versions offer speaker or the OS-selected connected route. Bluetooth and USB availability depends on the tablet and attached hardware. Device lists refresh while settings are open, and disconnected-device selections fail without silently switching cameras.

Floating calls use a dedicated AVKit video-call content source on iOS/iPadOS 16+ and Android activity picture-in-picture on supported devices. The application does not invoke the SDK sample's hard-coded CallKit identity. Automatic entry defaults off and is stored as a local preference. Shared screens take priority over the focused participant, then remote video; leaving clears subscriptions and disables automatic entry. Picture-in-picture is suspended while the whiteboard is open or has pending drawings, preserving unsaved edits. The floating surface contains call video, rather than the full interactive classroom UI. Android users restore the meeting with system controls; iPad camera/background behavior still needs physical-device verification.

## Automated verification

### Web/native compatibility contract

Compare native changes against the owning web flow, rather than copying web-only browser APIs into mobile. The same API contracts govern both clients.

| Capability                              | Web reference                                             | Native implementation / verification                                                                                                                                                                |
| --------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity, preview and explicit join     | `live-session-setup.tsx`, `device-preview-step.tsx`       | `native-classroom-entry.tsx`, `native-device-preview.tsx`; API identity, responsive tablet columns, adjacent settings/audio-check icons and tablet lifecycle flow                                   |
| Admission and host/co-host permissions  | `meeting-waiting-room.tsx`, `zoom-participants-panel.tsx` | Same API admission endpoints; controller tests and moderation/student tablet flows                                                                                                                  |
| Primary controls and More               | `zoom-meeting-controls.tsx`, `zoom-more-controls.tsx`     | `native-meeting-toolbar.tsx`; accessible round controls and expandable secondary actions                                                                                                            |
| Chat, reactions, captions and recording | Web Zoom session hooks                                    | Native SDK adapter and controller; unread counts, deduplicated chat, chat privilege, hand/reaction dock with tile badges, timer, paused recording and consent; live media/recording checks required |
| Whiteboard and educational assets       | Web Excalidraw canvas                                     | Bundled Excalidraw canvas and shared asset registry; native persistence and PNG export flows; ephemeral lasers use the same API presence endpoint as web                                            |
| Annotation editing                      | `components/screen-annotations`                           | Shared API objects; normalized native SVG shapes, selection, movement, resize, rotation, styles, versioned undo/redo and native export                                                              |
| Temporary annotation tools              | Web annotation presence transport                         | Same pointer/laser endpoints; temporary strokes never enter saved drawing history                                                                                                                   |
| Focus and speaking                      | `focused-fullscreen.tsx`, `use-speaking-participants.ts`  | Native focused video/share dialog, four-person gallery pages, SDK-derived speaker borders and avatar fallbacks                                                                                      |
| Floating call                           | `use-meeting-picture-in-picture.ts`                       | AVKit on iOS/iPadOS 16+; Android activity PiP with explicit/automatic entry, compact controls and restoration                                                                                       |
| Screen sharing                          | Browser screen capture                                    | Native OS-approved ReplayKit/MediaProjection; verify on physical tablets                                                                                                                            |
| Device settings                         | Browser device selectors and processing options           | Native audio route/camera selectors with disconnect refresh, mirroring, host sharing restrictions, original audio and background effects; hardware-specific verification required                   |

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
