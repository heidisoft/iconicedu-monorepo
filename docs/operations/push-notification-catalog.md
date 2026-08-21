# Push Notification Catalog

## Purpose

Quick reference for every push notification the app sends: what text goes out, how it looks on device, timing/suppression rules, and where tapping navigates.

## Last Updated

2026-05-10

## Related Docs

- [Push Notifications](push-notifications.md)

---

## Notification Tile Anatomy

The Expo message sent to APNs / FCM has this structure:

```
{
  title:     "..."           ← bold first line on both platforms
  body:      "..."           ← second line; OS may truncate
  badge:     <unread count>  ← app icon badge (iOS + Android)
  channelId: "default"       ← Android 8+ notification channel
  sound:     "default"       ← device default sound
  data: {
    prefKey, activityFeedItemId,
    channelId, threadId,
    scopeKind, scopeId, channelRouteKind,
    senderName, senderAvatarUrl, preview, orgId
  }
}
```

**iOS** — standard system notification: app icon + app name, bold title, body text, badge on icon. No rich media / thumbnail currently wired up.

**Android** — uses the `"default"` notification channel: bold title, expandable body on long-press, badge on supported launchers.

---

## Notification Catalog

### Messaging & Files

> On tap → DM, channel, or space screen. Thread replies include `?threadId=` so the correct thread opens.

| Event                         | Title                                      | Body                            |
| ----------------------------- | ------------------------------------------ | ------------------------------- |
| `message.posted` (DM)         | `{sender} sent you a direct message`       | Message preview (max 160 chars) |
| `message.posted` (channel)    | `{sender} in {channelName}`                | Message preview                 |
| `message.mentioned`           | `{sender} mentioned you in {channel}`      | Message preview                 |
| `message.thread_reply.posted` | `{sender} replied to a thread`             | Message preview                 |
| `file.uploaded`               | `{sender} shared a file`                   | File name or preview            |
| `image.uploaded`              | `{sender} shared an image with you`        | Preview                         |
| `audio.uploaded`              | `{sender} shared audio`                    | Preview                         |
| `reaction.added`              | `{sender} reacted {emoji} to your message` | Same as title                   |

### Class & Session

> On tap → class space if `channelId` is present, otherwise Schedule tab.

| Event                           | Title                                             | Body                                                                       |
| ------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| `class.session.scheduled`       | `{classTitle} session scheduled`                  | Payload summary or schedule fallback                                       |
| `class.sessions.scheduled`      | `{classTitle} sessions scheduled`                 | Payload summary                                                            |
| `session.started` ⚡            | `{classTitle} is live now`                        | Join-now fallback or payload summary                                       |
| `session.reminder.sent`         | `{classTitle}`                                    | `Class session starts today/tomorrow at {time}` (recipient timezone-aware) |
| `session.feedback_request.sent` | `Share feedback for {classTitle}`                 | `Tell us how the session went`                                             |
| `class.session.rescheduled`     | `{classTitle} rescheduled`                        | `{oldDateTime} was moved to {newDateTime}`                                 |
| `class.session.canceled`        | `{classTitle} canceled`                           | `{sessionDateTime} was canceled` (+ optional reason)                       |
| `session.completed`             | `{audienceLabel} is complete` (role-personalised) | Generic completion text                                                    |

### Payment & System

> On tap → Inbox tab.

| Event                       | Title                                | Body                |
| --------------------------- | ------------------------------------ | ------------------- |
| `payment.reminder.sent` ⚡  | Payload title or `Payment reminder`  | Payload description |
| `payments.reminder.sent` ⚡ | Payload title or `Payment reminders` | Payload description |
| `system.notice` ⚡          | Payload title or `System notice`     | Payload message     |

⚡ = **Critical** — always immediate, bypasses all presence suppression.

---

## Timing & Suppression

| Condition                                                                         | Behaviour                                          |
| --------------------------------------------------------------------------------- | -------------------------------------------------- |
| Event is ⚡ critical                                                              | Sent immediately (0 s delay). Presence is ignored. |
| Standard message / reaction / file events                                         | 60 s delay when presence suppression applies       |
| All other non-critical events                                                     | 120 s delay when presence suppression applies      |
| User is online / in-class / teaching                                              | Non-critical delivery delayed until offline        |
| Channel recently read (read timestamp ≥ event timestamp)                          | Notification delayed                               |
| `notification_preferences.muted = true` for the pref key or master `__push__` key | Suppressed entirely                                |

---

## Tap Routing

Mobile resolves the destination from `prefKey` in `notification.data`:

| `prefKey` group                             | Destination                                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `message.*`, `file.*`, `image.*`, `audio.*` | `/(app)/dm/:id`, `/(app)/channel/:id`, or `/(app)/spaces/:id` based on `channelRouteKind`. Thread replies append `?threadId=`. |
| `reaction.added`                            | Same channel routing logic as messages                                                                                         |
| `class.session.*`, `session.*`              | `/(app)/spaces/:id` if `channelId` present, else `/(app)/(tabs)/schedule`                                                      |
| `payment.*`, `system.notice`, unknown       | `/(app)/(tabs)/inbox`                                                                                                          |

On tap the app also marks the `activityFeedItemId` (carried in `notification.data`) as read — async, non-blocking.

---

## Key Source Files

| File                                                                                     | Purpose                                       |
| ---------------------------------------------------------------------------------------- | --------------------------------------------- |
| [push-copy.ts](../../apps/api/src/lib/notifications/push-copy.ts)                        | Title / body template builder                 |
| [push-provider.ts](../../apps/api/src/lib/notifications/providers/push-provider.ts)      | Expo send, badge resolution, error handling   |
| [policy-config.ts](../../apps/api/src/lib/notifications/policy-config.ts)                | Timing, suppression, and critical-flag config |
| [notification-config.ts](../../apps/mobile/src/lib/notifications/notification-config.ts) | Mobile tap-routing registry                   |
| [use-notification-handler.ts](../../apps/mobile/src/hooks/use-notification-handler.ts)   | Foreground display settings + tap handler     |
