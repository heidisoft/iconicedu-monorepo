<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into the IconicEdu Android app. The PostHog Android SDK (`posthog-android:3.+`) was added to the native Android layer of the Expo/React Native app. The SDK is initialized in `MainApplication.kt` with API credentials read from `local.properties` (gitignored) via `BuildConfig` fields, so secrets never appear in source code. Autocapture is enabled for application lifecycle events, screen views, and deep links. Event planning covers the full authentication funnel from OTP request through verification, along with Google sign-in, login errors, and onboarding completion.

| Event Name                                                      | Description                                      | File                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `app launched` (autocaptured as `Application Opened`)           | App opened from closed state or foreground       | `apps/mobile/android/app/src/main/java/com/iconicedu/mobile/MainApplication.kt` |
| `app backgrounded` (autocaptured as `Application Backgrounded`) | App sent to background                           | `apps/mobile/android/app/src/main/java/com/iconicedu/mobile/MainApplication.kt` |
| `app installed` (autocaptured as `Application Installed`)       | First-time app install                           | `apps/mobile/android/app/src/main/java/com/iconicedu/mobile/MainApplication.kt` |
| `app updated` (autocaptured as `Application Updated`)           | App updated to new version                       | `apps/mobile/android/app/src/main/java/com/iconicedu/mobile/MainApplication.kt` |
| `login otp requested`                                           | User submitted email to receive OTP sign-in code | `apps/mobile/app/(auth)/login.tsx`                                              |
| `login google started`                                          | User tapped "Continue with Google"               | `apps/mobile/app/(auth)/login.tsx`                                              |
| `login error`                                                   | Login failed — no account found or sign-in error | `apps/mobile/app/(auth)/login.tsx`                                              |
| `otp verified`                                                  | User successfully verified 6-digit OTP code      | `apps/mobile/app/(auth)/otp.tsx`                                                |
| `otp verification failed`                                       | OTP verification failed (wrong code or expired)  | `apps/mobile/app/(auth)/otp.tsx`                                                |
| `otp resent`                                                    | User requested a new OTP code                    | `apps/mobile/app/(auth)/otp.tsx`                                                |
| `onboarding completed`                                          | User finished the full profile setup flow        | `apps/mobile/app/(auth)/profile-setup.tsx`                                      |

## Files modified

- `apps/mobile/android/app/build.gradle` — added `local.properties` reader, `buildFeatures { buildConfig true }`, `POSTHOG_API_KEY` / `POSTHOG_HOST` `BuildConfig` fields, and `implementation("com.posthog:posthog-android:3.+")` dependency
- `apps/mobile/android/app/src/main/java/com/iconicedu/mobile/MainApplication.kt` — imported `PostHogAndroid` / `PostHogAndroidConfig` and added `PostHogAndroid.setup()` call in `onCreate()` with lifecycle, screen view, and deep link autocapture enabled
- `apps/mobile/android/local.properties` — created with `posthog.apiKey` and `posthog.host` (gitignored)

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard**: [Analytics basics](https://us.posthog.com/project/275837/dashboard/1336969)
- **Insight**: [Daily Active Users (App Opened)](https://us.posthog.com/project/275837/insights/BIk0E9zz)
- **Insight**: [Login Funnel: OTP Request to Verified](https://us.posthog.com/project/275837/insights/1bSqQCof)
- **Insight**: [Authentication Method Breakdown](https://us.posthog.com/project/275837/insights/yquTUiO7)
- **Insight**: [App Installs and Updates](https://us.posthog.com/project/275837/insights/R1VxF5OW)
- **Insight**: [Login & OTP Errors](https://us.posthog.com/project/275837/insights/z5yj9Q6Q)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
