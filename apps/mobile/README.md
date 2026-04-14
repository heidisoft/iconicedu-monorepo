# Mobile Development Workflow

This app is developed with local development builds, not Expo Go. The
`pnpm dev:mobile` command guides you through the full setup.

## Quick start

```sh
pnpm dev:mobile
```

This interactive launcher:

1. Detects whether native projects (`ios/`, `android/`) are already generated.
2. Asks whether to run `expo prebuild` and build the native app — with guidance
   on when this is required.
3. Starts the Metro bundler and displays a QR code for connecting your dev
   client.

On a fresh clone or new machine, always say **yes** to the native build prompt.
For normal day-to-day JS work, say no and Metro starts immediately.

## Environment matrix

| Mode                 | Command                         | What it runs/builds                         | Distribution           | Intended use                                         |
| -------------------- | ------------------------------- | ------------------------------------------- | ---------------------- | ---------------------------------------------------- |
| Local interactive    | `pnpm dev:mobile`               | Guided: prebuild → run:ios/android → Metro  | Local only             | Default daily driver — first run or after JS changes |
| Local Metro only     | `pnpm --filter mobile start`    | Metro for dev client (no native build step) | Local only             | Already have the dev client installed, just start JS |
| Local native iOS     | `pnpm mobile:ios`               | Local native app via `expo run:ios`         | Local only             | iOS simulator and native parity checks               |
| Local native Android | `pnpm mobile:android`           | Local native app via `expo run:android`     | Local only             | Fast Android-native iteration                        |
| EAS development      | `pnpm mobile:eas:build:dev`     | Dev client build via EAS                    | Internal install       | Real-device native testing against local Metro       |
| EAS preview          | `pnpm mobile:eas:build:preview` | Internal release-like build                 | Internal distribution  | QA and stakeholder testing without Metro             |
| EAS production       | `pnpm mobile:eas:build:prod`    | Store build                                 | App Store / Play Store | Release artifacts                                    |
| Submit               | `pnpm mobile:eas:submit`        | Submits built artifacts                     | Store submission flow  | Publish previously built production artifacts        |

`development` is an internal dev client build that connects to local Metro. `preview` is an internal installable QA or stakeholder build. `production` is the store-release build path defined by the current EAS profiles in `apps/mobile/eas.json`.

## Standard workflow

### First run (or after native changes)

```sh
pnpm dev:mobile
# → "Rebuild native projects? [y/N]"  — enter y
# → Select platform: 1 (iOS) or 2 (Android)
# → expo prebuild runs, then expo run:ios / expo run:android
# → Metro starts automatically; Simulator/Emulator opens with the dev client
```

### Subsequent JS-only runs

```sh
pnpm dev:mobile
# → "Rebuild native projects? [y/N]"  — press Enter (defaults to N)
# → Metro starts immediately; scan QR code or press i / a
```

Or start Metro directly without the prompt:

```sh
pnpm --filter mobile start
```

### EAS development builds (real-device)

Use EAS when you need to test on a physical device end-to-end (auth,
notifications, storage, deep linking, file uploads, audio, and other
native-dependent behavior).

1. Build a dev client:

```sh
pnpm mobile:eas:build:dev
# Or per platform:
pnpm --filter mobile eas:build:dev:ios
pnpm --filter mobile eas:build:dev:android
```

2. Install the build on the device.
3. Start Metro:

```sh
pnpm --filter mobile start
```

4. Open the installed development build and connect it to the local Metro server.

## QA and stakeholder builds

Use the `preview` EAS profile for internal builds that should feel closer to release behavior and should not depend on a local Metro server.

```sh
pnpm --filter mobile eas:build:preview
```

Use `development` for engineer iteration and `preview` for installable QA builds.

### Preview build testing accounts

For shared preview or stage testing, use:

- `iconicedudev@gmail.com`
- Password: `Iconic@2026`

If the target preview environment includes the seeded role data, these aliases are available for role-specific testing:

- `iconicedudev@gmail.com` — owner coverage
- `iconicedudev+guardian1@gmail.com` — guardian flows
- `iconicedudev+educator1@gmail.com` — educator flows
- `iconicedudev+educator2@gmail.com` — secondary educator scenarios
- `iconicedudev+staff1@gmail.com` — staff-only flows
- `iconicedudev+guardian2@gmail.com` — second guardian household coverage

For local Supabase resets, the same aliases come from `supabase/seed.sql`, but the local password is `Seed123!`, not `Iconic@2026`.

### Creating preview builds

Local:

```sh
pnpm mobile:eas:build:preview
```

GitHub Actions builds:

1. Wait for the PR preview environment to finish provisioning.
2. Open `Actions`, choose the branch in `Use workflow from`, and run `Create EAS Build`.
3. Choose `ios`, `android`, or `all`.
4. Choose the EAS profile: `development`, `preview`, or `production`.
5. Enter the PR number when building a branch other than `main`.
6. Install the build from the Expo link posted back to the PR.

### Preview environment wiring

PR-based preview EAS builds currently inject:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_ENV=preview`

If the build also needs to point at preview web or preview API hosts, provide these before the build:

- `EXPO_PUBLIC_WEB_URL`
- `EXPO_PUBLIC_API_URL`

Use the PR preview comment as the source of truth for:

- Vercel preview web URL
- Railway preview API URL
- Supabase preview branch / Studio link

## Rebuild rules

Rebuild the native app or dev client when any of these change:

- Expo plugins in `app.json`
- Native package dependencies
- Notification, deep link, scheme, bundle identifier, package name, permission, splash, or icon config
- Anything that requires `expo prebuild`
- Generated native code in `ios/` or `android/`

Do not rebuild for normal JS-only work such as:

- Screen code
- React logic
- Styling
- Most API changes
- Most routing changes

## Prebuild guidance

Use `expo prebuild` only when native configuration has changed.

```sh
pnpm --filter mobile prebuild
```

Use a clean prebuild only when you need to fully regenerate native projects:

```sh
pnpm --filter mobile prebuild:clean
```

Do not clean or prebuild on every run. It slows iteration down and creates unnecessary native churn.

## Local Supabase URL rewriting

When `EXPO_PUBLIC_APP_ENV=local`, the Supabase client automatically replaces
the hostname in `EXPO_PUBLIC_SUPABASE_URL` with the Metro bundler's IP at
runtime. This means you never need to manually change `127.0.0.1`:

| Context          | Metro host  | Effective Supabase URL     |
| ---------------- | ----------- | -------------------------- |
| iOS Simulator    | 127.0.0.1   | `http://127.0.0.1:54321`   |
| Android Emulator | 10.0.2.2    | `http://10.0.2.2:54321`    |
| Physical device  | 192.168.x.y | `http://192.168.x.y:54321` |

Keep `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` in your local `.env`.
The rewrite only activates when `EXPO_PUBLIC_APP_ENV=local` — EAS builds and
cloud Supabase projects are unaffected.

## Environment expectations

The `development` EAS profile is configured as a dev client and includes:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_APP_ENV=development`
- `EXPO_PUBLIC_API_URL` for the NestJS API (`apps/api`, default local dev `http://localhost:3001`)
- `EXPO_PUBLIC_WEB_URL` for web-hosted pages opened from mobile (`apps/web`, default local dev `http://localhost:3000`)

The `preview` profile is for installable internal QA builds. The `production` profile is reserved for release builds.

## Working assumptions

- Use Expo managed plus prebuild rather than ejecting unless the app repeatedly hits hard plugin or prebuild limits.
- Keep Expo Go out of the primary development workflow for this app.
- Rebuild dev clients only for native changes. Use Metro refresh for JS-only changes.
- Mobile must not depend on `apps/web` API routes. If a server endpoint is required, route it through `apps/api`.
