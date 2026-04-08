# Mobile Development Workflow

This app should be developed with native Expo builds, not Expo Go.

## Environment matrix

| Mode                 | Command                         | What it runs/builds                     | Distribution           | Intended use                                      |
| -------------------- | ------------------------------- | --------------------------------------- | ---------------------- | ------------------------------------------------- |
| Local Metro          | `pnpm dev:mobile`               | Expo dev server                         | Local only             | Day-to-day JS work and simulator/emulator startup |
| Local native iOS     | `pnpm mobile:ios`               | Local native app via `expo run:ios`     | Local only             | iOS simulator and native parity checks            |
| Local native Android | `pnpm mobile:android`           | Local native app via `expo run:android` | Local only             | Fast Android-native iteration                     |
| EAS development      | `pnpm mobile:eas:build:dev`     | Dev client build                        | Internal install       | Real-device native testing against local Metro    |
| EAS preview          | `pnpm mobile:eas:build:preview` | Internal release-like build             | Internal distribution  | QA and stakeholder testing without Metro          |
| EAS production       | `pnpm mobile:eas:build:prod`    | Store build                             | App Store / Play Store | Release artifacts                                 |
| Submit               | `pnpm mobile:eas:submit`        | Submits built artifacts                 | Store submission flow  | Publish previously built production artifacts     |

`development` is an internal dev client build that connects to local Metro. `preview` is an internal installable QA or stakeholder build. `production` is the store-release build path defined by the current EAS profiles in `apps/mobile/eas.json`.

## Two-lane workflow

### Lane 1: local native iteration

Use this for the default day-to-day loop when you are working on screens, navigation, React logic, styling, and most API changes.

1. Start Metro:

```sh
pnpm --filter mobile dev
```

2. Run a local native build:

```sh
pnpm --filter mobile dev:android
pnpm --filter mobile dev:ios
```

You can also use the existing aliases:

```sh
pnpm --filter mobile android
pnpm --filter mobile ios
```

Use Android as the fastest local loop when speed matters. Use iOS for parity checks and final device validation on a Mac.

### Lane 2: EAS development builds

Use this for full real-device testing when Expo Go is too limited, when native modules matter, or when you need to validate the app on a physical device end to end.

1. Build a dev client:

```sh
pnpm --filter mobile eas:build:dev
```

Or per platform:

```sh
pnpm --filter mobile eas:build:dev:android
pnpm --filter mobile eas:build:dev:ios
```

2. Install the build on the device.
3. Start Metro for the dev client:

```sh
pnpm --filter mobile dev:device
```

4. Open the installed development build and connect it to the local Metro server.

This is the standard path for testing auth, notifications, storage, deep linking, file uploads, audio, and other native-dependent behavior.

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

GitHub Actions for PR previews:

1. Wait for the PR preview environment to finish provisioning.
2. Open `Actions` and run `Create EAS Build`.
3. Enter the PR number for non-`main` branches.
4. Choose `ios`, `android`, or `all`.
5. Install the build from the Expo link posted back to the PR.

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
