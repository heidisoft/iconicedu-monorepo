# Mobile App — Manual QA Test Plan

> Last updated: 2026-05-05  
> Covers: Expo 55 / SDK 55, React Native 0.83.2, Expo Router v7

Check off each item as it is verified. Mark with **FAIL** and a note if something is broken.

---

## 1. Authentication

### 1.1 OTP Login

- [ ] Email input accepts a valid email address
- [ ] Empty / invalid email shows inline validation error
- [ ] "Send code" button sends OTP email and transitions to OTP screen
- [ ] 6-digit code auto-verifies on last digit entry
- [ ] Manual "Verify" button also works after entering 6 digits
- [ ] Invalid code shows error message
- [ ] "Resend code" link sends a new OTP
- [ ] Session expiry message is shown after returning to login with an expired session
- [ ] Successful OTP routes to Profile Setup if onboarding is incomplete
- [ ] Successful OTP routes directly to Home if onboarding is already complete

### 1.2 Google OAuth

- [ ] "Continue with Google" button opens the OAuth flow
- [ ] Successful Google auth routes to app / profile setup
- [ ] Cancelled Google auth returns to login screen cleanly

### 1.3 Profile Setup (New Users)

- [ ] Name step saves first/last name and advances
- [ ] Phone number step is optional and advances
- [ ] Timezone picker shows 25+ options and persists selection
- [ ] Country picker shows countries with flags and persists selection
- [ ] Grade level step shows all grade options (Pre-K through Grade 6+)
- [ ] Educator-specific availability step appears for educator role
- [ ] Back navigation between steps works
- [ ] Completing all steps routes to Home

### 1.4 Session Persistence

- [ ] Closing and reopening the app keeps the user logged in
- [ ] Token refresh happens silently in the background
- [ ] Sign-out clears credentials and returns to Login screen

---

## 2. Bottom Tab Navigation

- [ ] Home tab loads without errors
- [ ] Messages tab shows channel list
- [ ] Notifications (Inbox) tab shows activity feed
- [ ] Account tab shows profile and settings
- [ ] Unread badge appears on Messages tab when there are unread channels
- [ ] Unread badge appears on Notifications tab when there are unread activities
- [ ] Badges clear after viewing the relevant screen / marking as read

---

## 3. Home Screen

- [ ] Upcoming sessions are listed in chronological order
- [ ] Ongoing sessions are visually distinguished
- [ ] Past sessions are shown separately (or collapsed)
- [ ] Pull-to-refresh updates the session list
- [ ] Learning spaces quick-access row loads
- [ ] Support channel link is visible in the footer
- [ ] Family switcher (parent/guardian only) appears and works — see §10

---

## 4. Messages Screen

### 4.1 Channel List

- [ ] All, Direct Messages, Channels, and Supervised DMs tabs render
- [ ] Each row shows: avatar, name, last message preview, timestamp, unread badge
- [ ] Last message preview correctly labels rich content types (image, file, audio-recording, assignment, homework, session-booking, etc.)
- [ ] "Today" / "Yesterday" / absolute date timestamps display correctly
- [ ] Unread count badge disappears after opening the channel
- [ ] Pull-to-refresh updates the list

### 4.2 Supervised DMs Tab (Guardian only)

- [ ] Only shows DMs where the child has access but the guardian does not
- [ ] Child's name is shown in the channel preview
- [ ] Supervised indicator is visible

---

## 5. Channel / Direct Message Conversation

### 5.1 Message List

- [ ] Messages load and display in correct chronological order
- [ ] Sender name and avatar are shown for each message
- [ ] Timestamps are accurate
- [ ] Date separator appears between messages on different days
- [ ] Deleted messages show a placeholder (not the original content)
- [ ] Rich attachments render: images, files, PDFs, audio recordings
- [ ] Lesson/homework/event/session-booking attachment cards display
- [ ] Scroll-to-bottom button appears when scrolled up
- [ ] Pull-to-refresh loads older messages

### 5.2 Sending Messages

- [ ] Text message sends successfully and appears in the list
- [ ] Pending indicator shows while the message is in flight
- [ ] Failed-send state is shown on network error
- [ ] File attachment picker opens and allows file selection
- [ ] Single file upload completes and renders in message list
- [ ] Multiple file upload completes
- [ ] Typing indicator is broadcast to the other participant while typing
- [ ] Typing indicator clears after ~4 seconds of no input

### 5.3 Receiving Real-Time Messages

- [ ] New message from the other participant appears without refresh
- [ ] Typing indicator ("X is typing...") shows when remote user is typing
- [ ] Typing indicator disappears correctly when they stop
- [ ] Reactions added by remote user update in real-time

### 5.4 Message Actions

- [ ] Long-press (or action button) opens the message actions sheet
- [ ] Emoji reaction can be toggled on/off
- [ ] Delete option removes the message (shows placeholder)
- [ ] Reply/thread option opens thread view (if implemented)

### 5.5 DM-Specific

- [ ] Participant online status is shown in the conversation header
- [ ] "Last seen" timestamp updates
- [ ] Supervised conversations show read-only notice and disable input

### 5.6 Channel Info Sheet

- [ ] Member list loads
- [ ] Channel name and description display correctly
- [ ] Per-channel notification preference is accessible

---

## 6. Notifications Settings

> Key file: [apps/mobile/app/(app)/settings/notifications.tsx](<../../apps/mobile/app/(app)/settings/notifications.tsx>)
> Key hook: [apps/mobile/src/hooks/use-push-toggle.ts](../../apps/mobile/src/hooks/use-push-toggle.ts)

### 6.1 Master Push Toggle

- [ ] Toggle correctly reflects current OS permission status on load
- [ ] **Enabled → Disabled**: toggling off revokes the push token in the database; device stops receiving push notifications
- [ ] **Disabled → Enabled** (permission previously granted): toggling on re-registers the push token; device resumes push notifications
- [ ] **Permission denied (blocked in OS)**: toggle is disabled and a message explains that the user must go to system settings
- [ ] iOS message for blocked permission is displayed correctly
- [ ] Android message for blocked permission is displayed correctly
- [ ] Loading/spinner state is visible while the toggle operation is in flight
- [ ] Rapid taps are debounced (only one operation fires)
- [ ] Returning from iOS Settings after granting permission refreshes the toggle state automatically (AppState listener)
- [ ] Error toast/message appears if the toggle operation fails

### 6.2 Per-Category Notification Preferences

- [ ] All notification categories load (with labels)
- [ ] Loading skeleton is shown before preferences arrive
- [ ] Each category toggle correctly mutes / unmutes that category
- [ ] Muted categories are visually distinct from active ones
- [ ] Preference persists after navigating away and back

---

## 7. Inbox / Activity Feed

- [ ] Activity feed loads with items grouped by date
- [ ] "All" and "Unread" tabs switch the view correctly
- [ ] "Mark all as read" button clears unread states
- [ ] Activity items show correct metadata (sender, content preview, timestamp)
- [ ] Tapping an activity item navigates to the relevant screen
- [ ] Pull-to-refresh loads new activities

---

## 8. Account & Profile Settings

### 8.1 Account Screen

- [ ] User avatar, display name, and email are shown
- [ ] Settings menu items are all tappable and navigate correctly:
  - [ ] Edit Profile
  - [ ] Notifications
  - [ ] Privacy & Security
  - [ ] Appearance
  - [ ] Help & Support
- [ ] Sign Out button works and returns to Login

### 8.2 Edit Profile Screen

- [ ] Avatar is displayed with correct color (theme_key > seed palette)
- [ ] Display name is editable and saves correctly
- [ ] Role badge is shown

### 8.3 Account Info Screen

- [ ] Email shows verified/unverified badge
- [ ] Phone number displays if set
- [ ] Payment / subscription info renders (if applicable)

### 8.4 Appearance Screen

- [ ] System / Light / Dark mode options are presented
- [ ] Selecting a mode applies the theme immediately
- [ ] Selected mode persists after closing and reopening the app
- [ ] Timezone can be updated from this screen

---

## 9. Learning Spaces

- [ ] Spaces list screen loads with all accessible spaces
- [ ] Each space card shows title and subject
- [ ] Tapping a space navigates to its channel list
- [ ] Channels within a space load with correct subject badges
- [ ] Unread counts are shown per channel
- [ ] Sessions tab within a space channel shows upcoming / past sessions

---

## 10. Family / Parental Controls

- [ ] Family switcher appears on Home and Account screens for parent/guardian accounts
- [ ] Switching to a child profile updates the view to show the child's context
- [ ] Unread counts per child profile are shown in the switcher
- [ ] Switching back to the parent profile restores the parent view
- [ ] A child's DMs are not visible when viewing another child's profile
- [ ] Supervised DMs show read-only notice; input is disabled
- [ ] Family settings screen lists all linked children
- [ ] Empty state is shown if no children are linked

---

## 11. Presence & Real-Time Features

- [ ] Online status indicator (green dot) shows for users who are currently active
- [ ] Offline users do not show the green dot
- [ ] "Last seen" timestamp is accurate
- [ ] Typing indicator timeout fires correctly (~4 seconds of inactivity)
- [ ] Typing throttle prevents spamming the server (max 1 broadcast per ~1.5 seconds)
- [ ] After a connection drop, real-time subscriptions recover and messages continue to appear

---

## 12. Theme & Appearance

- [ ] Light mode renders all screens without colour clashes
- [ ] Dark mode renders all screens without colour clashes
- [ ] System mode follows the device's dark/light setting
- [ ] Avatar colours match the user's assigned theme key (16 colour options)
- [ ] Seed-based avatar colour fallback is consistent per user
- [ ] Switching theme does not lose any in-progress data

---

## 13. Accessibility

- [ ] All interactive elements have accessible labels
- [ ] Buttons meet minimum touch target size
- [ ] Screen reader (VoiceOver / TalkBack) announces tab bar items correctly
- [ ] Switches announce their on/off state
- [ ] Notification toggle is accessible via screen reader
- [ ] Safe area is respected (content not hidden behind notch or home indicator)

---

## 14. Performance & Edge Cases

- [ ] App launches cold in under 3 seconds on a mid-range device
- [ ] Long channel/DM lists scroll smoothly (no frame drops)
- [ ] Large file attachment uploads do not freeze the UI
- [ ] Switching between tabs is instant (no full reload)
- [ ] App recovers gracefully from airplane mode → reconnect
- [ ] All screens show loading skeletons while data is fetching
- [ ] All screens show appropriate empty states when no data exists
- [ ] Error states display user-friendly messages (not raw error objects)

---

## 15. Automated Test Coverage Reference

The following automated tests already exist; run `pnpm test:mobile` from the repository root to verify:

| Test file                                | What it covers                                  |
| ---------------------------------------- | ----------------------------------------------- |
| `notifications-screen.test.tsx`          | Notifications settings UI rendering             |
| `use-push-toggle.test.ts`                | Push toggle hook (permission states, token ops) |
| `message-list.test.tsx`                  | Message list building and rendering             |
| `message-input.test.tsx`                 | Message input component                         |
| `message-item.test.tsx`                  | Individual message row                          |
| `typing-indicator.test.tsx`              | Typing indicator display                        |
| `auth-provider.test.tsx`                 | Auth flow                                       |
| `app-providers.test.tsx`                 | Provider integration                            |
| `analytics-provider.test.tsx`            | Analytics event tracking                        |
| `family-view-provider.test.tsx`          | Family switching logic                          |
| `use-activity-feed.test.ts`              | Activity feed hook                              |
| `use-supervised-direct-messages.test.ts` | Supervised DM filtering                         |
| `use-space-sessions.test.ts`             | Space session queries                           |
| `use-upcoming-sessions.test.ts`          | Upcoming sessions fetching                      |
| `use-tablet.test.ts`                     | Responsive layout detection                     |

---

## Sign-off

| Role | Name | Date | Status |
| ---- | ---- | ---- | ------ |
| QA   |      |      |        |
| Dev  |      |      |        |
