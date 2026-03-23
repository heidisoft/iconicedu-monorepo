# ADR-003 — Expo for Cross-Platform Mobile

**Date:** 2026-01-01
**Status:** Accepted

---

## Context

The platform requires a mobile app for iOS and Android. The web app is already React-based (Next.js), so a React-adjacent mobile solution was preferred to maximise code and knowledge sharing.

Key requirements:

- iOS and Android from a single codebase
- OTA (over-the-air) updates for JS-only changes
- Push notifications
- Secure credential storage for auth tokens
- File uploads (homework, avatars)
- Real-time WebSocket connections
- Fast iteration with hot reload during development

## Decision

Use **Expo** (managed workflow with EAS) built on **React Native**.

- **Expo SDK 54** with React Native 0.81.5
- **Expo Router** (file-based routing, mirrors Next.js App Router conventions)
- **EAS Build** for producing iOS and Android binaries
- **EAS Update** for over-the-air JS updates
- **NativeWind v4** for Tailwind-based styling (mirrors web Tailwind usage)
- **React Query** for data fetching (mirrors web usage)

## Alternatives considered

| Option                      | Why rejected                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Bare React Native (no Expo) | More native configuration overhead; Expo managed workflow eliminates most of it. EAS Build provides CI/CD.  |
| Flutter                     | Different language (Dart); no code/knowledge sharing with the existing React web codebase.                  |
| React Native + Expo Go only | Expo Go doesn't support all native modules (e.g. `expo-secure-store`). EAS Development builds are required. |
| Capacitor / Ionic           | Web-based rendering; worse performance for a real-time messaging app.                                       |
| PWA (Progressive Web App)   | Poor native feel; no access to native APIs (secure storage, push notifications); App Store presence harder. |

## Consequences

### Positive

- Single codebase for iOS and Android
- Expo Router conventions closely mirror Next.js App Router — lower context-switching between web and mobile code
- NativeWind + React Query on mobile means the same patterns used on web
- `expo-secure-store` provides secure keychain storage for auth tokens
- EAS Build removes the need to maintain macOS CI machines for iOS builds
- OTA updates (EAS Update) mean JS fixes can ship without an App Store review cycle
- Supabase JS client works on mobile identically to web

### Negative / trade-offs

- Expo managed workflow abstracts native code — if a native module is unavailable in Expo, a custom dev client build is needed
- `node-linker=hoisted` required in `.npmrc` for pnpm + Expo/jest-expo compatibility
- React Native version is pinned by Expo SDK — cannot upgrade RN independently
- `pnpm overrides` needed to pin `react` to exactly `19.1.0` for renderer compatibility
- NativeWind v4 requires explicit type casts for `className` prop on standard RN components

### Risks

- Expo SDK upgrades (e.g. SDK 54 → 55) require coordinated updates of all bundled native modules
- EAS Build is a paid service at scale (free tier has limited builds per month)
- OTA updates can be misused to ship significant changes without App Store review — must be used responsibly

## References

- `apps/mobile/package.json` — exact SDK and dependency versions
- `docs/getting-started/setup.md#mobile-setup` — local development setup
- `docs/operations/deployment.md#mobile--eas-build-and-submit` — EAS build and release process
- [Expo SDK 54 release notes](https://expo.dev/changelog/sdk-54)
