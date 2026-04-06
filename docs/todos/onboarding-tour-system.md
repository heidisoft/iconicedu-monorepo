# Onboarding Tour System

**Status:** Planned  
**Audience:** Engineers

---

## Overview

First-time users (educators, guardians, students, staff) need guided tours of the product. Tours are **goal-based** — each step asks the user to complete a real action (send a message, view the schedule, open an event) rather than just highlight UI. Completion state persists in the existing `user_onboarding_status.progress` JSONB column so tours don't repeat once done.

---

## Libraries

| Platform | Package                                                       | Notes                                                                              |
| -------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Web      | [`react-joyride`](https://react-joyride.com/)                 | Controlled mode, targets `data-tour` attrs, works with RSC layouts                 |
| Mobile   | [`rn-tourguide`](https://github.com/xcarpentier/rn-tourguide) | Expo-compatible, custom NativeWind tooltip, wraps screens with `TourGuideProvider` |

---

## Role → Tour Mapping

| Role       | Web tours                                  | Mobile tours                                        |
| ---------- | ------------------------------------------ | --------------------------------------------------- |
| `staff`    | `web:admin-overview`, `web:class-schedule` | —                                                   |
| `educator` | `web:class-schedule`, `web:inbox`          | `mobile:home`, `mobile:schedule`, `mobile:messages` |
| `guardian` | `web:inbox`, `web:class-schedule`          | `mobile:home`, `mobile:schedule`                    |
| `student`  | —                                          | `mobile:home`, `mobile:messages`                    |

---

## Goal-Based Steps

### `web:admin-overview` (staff only)

| Step ID           | Goal                               | Completion trigger |
| ----------------- | ---------------------------------- | ------------------ |
| `explore-users`   | Navigate to `/admin/users`         | Route change       |
| `view-classrooms` | Navigate to `/admin/classrooms`    | Route change       |
| `check-reports`   | Navigate to `/admin/reports`       | Route change       |
| `review-logs`     | Navigate to `/admin/activity/logs` | Route change       |

### `web:class-schedule` (staff + educator + guardian)

| Step ID         | Goal                                      | Completion trigger                  |
| --------------- | ----------------------------------------- | ----------------------------------- |
| `find-upcoming` | Scroll to next event on `/class-schedule` | Intersection observer on event card |
| `open-session`  | Click any event card                      | Navigation to event detail          |

### `web:inbox` (educator + guardian)

| Step ID             | Goal                                                      | Completion trigger            |
| ------------------- | --------------------------------------------------------- | ----------------------------- |
| `open-notification` | Click any item in `/inbox`                                | Item click handler            |
| `send-dm`           | Send a message to your tutor in `/dm/[channelId]`         | Message send mutation success |
| `post-to-channel`   | Post first message to a class channel in `/s/[channelId]` | Message send mutation success |

### `mobile:home`

| Step ID        | Goal                               | Completion trigger |
| -------------- | ---------------------------------- | ------------------ |
| `see-upcoming` | Scroll home screen schedule card   | Scroll event       |
| `tap-session`  | Tap a session to open detail sheet | Navigation         |

### `mobile:schedule`

| Step ID       | Goal                               | Completion trigger |
| ------------- | ---------------------------------- | ------------------ |
| `view-weekly` | Land on schedule tab               | Tab focus          |
| `tap-session` | Tap a session to open event detail | Navigation         |

### `mobile:messages`

| Step ID           | Goal                                  | Completion trigger            |
| ----------------- | ------------------------------------- | ----------------------------- |
| `send-dm`         | Send a message to your tutor          | Message send mutation success |
| `post-to-channel` | Post first message to a class channel | Message send mutation success |

---

## Completion State Schema

Stored in `user_onboarding_status.progress` (JSONB, no migration required):

```json
{
  "completedTours": ["web:admin-overview"],
  "tourStepProgress": {
    "web:inbox": ["open-notification", "send-dm"]
  },
  "tourVersions": {
    "web:inbox": "1.0"
  }
}
```

---

## Completion Detection

For action goals, hook into existing events rather than requiring the user to click "Next":

```ts
// Web — after message send mutation succeeds
onMessageSent(() => markTourStepComplete('web:inbox', 'send-dm'));

// Mobile — same pattern via React Query mutation onSuccess
mutateAsync(payload, {
  onSuccess: () => markTourStepComplete('mobile:messages', 'send-dm'),
});
```

---

## New Files

```
packages/shared-types/src/shared/tour.ts          # TourId type + TOUR_VERSIONS map
packages/ui-web/src/components/tour/
  tour-provider.tsx                               # Joyride instance + context
  tour-step-content.tsx                           # shadcn Card tooltip
apps/web/lib/tours/
  tour-steps.ts                                   # step definitions (targets, content)
  use-tour.ts                                     # hook: shouldShow, markComplete
apps/mobile/src/tours/
  tour-steps.ts
  use-tour.ts
apps/mobile/src/components/tour/
  TourTooltip.tsx                                 # NativeWind tooltip
```

---

## `data-tour` Attribute Placement (Web)

| Attribute                           | Element                           |
| ----------------------------------- | --------------------------------- |
| `data-tour="admin-users-link"`      | Sidebar admin users nav item      |
| `data-tour="admin-classrooms-link"` | Sidebar admin classrooms nav item |
| `data-tour="schedule-event-card"`   | First `EventCard` in week view    |
| `data-tour="inbox-item"`            | First inbox notification row      |
| `data-tour="dm-compose"`            | DM message input                  |
| `data-tour="channel-compose"`       | Class channel message input       |

---

## Versioning / Re-showing

Bump `TOUR_VERSIONS[tourId]` in `packages/shared-types/src/shared/tour.ts` when steps change meaningfully. On load, compare `progress.tourVersions[id]` against the current version constant — if the stored version is older, re-show the tour.

---

## Existing Infrastructure to Reuse

| Asset                               | Path                                                       |
| ----------------------------------- | ---------------------------------------------------------- |
| `UserOnboardingStatusRow`           | `packages/shared-types/src/rows/user-onboarding-status.ts` |
| `UserOnboardingStatusVM`            | `packages/shared-types/src/vm/onboarding.ts`               |
| `OnboardingStep` type               | `packages/shared-types/src/shared/shared.ts:65`            |
| `progress: Record<string, unknown>` | Already on the DB row — absorbs new keys without migration |

---

## Verification Checklist

- [ ] Sign in as each role; confirm correct tour(s) auto-start on first visit
- [ ] Complete each goal action; confirm the step advances automatically without clicking "Next"
- [ ] Reload; confirm tours do not re-show after completion
- [ ] Bump a `TOUR_VERSIONS` constant; confirm only that tour re-shows
