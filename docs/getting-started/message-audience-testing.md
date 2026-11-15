# Channel Message Audience E2E Testing

This guide verifies staff identity labels and restricted audiences in ordinary channels and learning-space classrooms. Direct messages and support-channel behavior must remain unchanged.

## What the suite proves

The test matrix covers:

- a public staff welcome visible to every channel member;
- parent-only, tutor-only, and named-recipient messages;
- immutable audiences resolved to explicit profile IDs at send time;
- thread replies inheriting the parent message audience;
- edits retaining the original audience;
- deleting a reply, a root message without replies, and a root message with replies;
- hidden content staying absent from channel history, search, pins, saved items, files, unread counts, notifications, and reconnects;
- a clear `Staff` sender badge on web and mobile, including DMs;
- no audience selector in DMs, group DMs, support channels, or non-staff composers.

## Test data

Use one synthetic organization and a dedicated synthetic classroom. Never use an active lesson or real family data. Create these active channel members:

| Persona          | Profile kind                                        | Purpose                                             |
| ---------------- | --------------------------------------------------- | --------------------------------------------------- |
| Staff sender     | `staff` with an organization staff/admin/owner role | Sends all audience variants                         |
| Parent A         | `guardian`                                          | Included in parent messages                         |
| Student A        | `child`                                             | Confirms parent-only exclusion                      |
| Tutor A          | `educator`                                          | Included in tutor messages                          |
| Unrelated parent | `guardian`                                          | Confirms named-recipient and cross-family exclusion |

Enable `enable-channel-communications` for the staff profile. Keep the flag off for one separate staff profile to verify the dark rollout. Enable the existing edit, reply, search, pinning, drafts, and send-reliability flags when exercising those capabilities.

Apply all migrations and start the local stack:

```bash
supabase start
supabase db reset
pnpm --filter api db:generate
pnpm dev:api
pnpm dev:web
```

## Automated web suite

Create Playwright storage states for the synthetic staff, parent, and tutor. Storage-state files contain reusable sessions and must remain outside the repository.

```bash
export PLAYWRIGHT_SKIP_WEBSERVER=1
export PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000
export PLAYWRIGHT_MESSAGE_AUDIENCE_PATH=/YOUR_ORG/s/YOUR_CLASSROOM_CHANNEL_ID
export PLAYWRIGHT_STAFF_AUTH_STATE=/private/path/staff.json
export PLAYWRIGHT_PARENT_AUTH_STATE=/private/path/parent.json
export PLAYWRIGHT_TUTOR_AUTH_STATE=/private/path/tutor.json

pnpm --filter web exec playwright test \
  e2e/channel-message-audiences.spec.ts \
  --workers=1 --retries=0
```

The suite uses three independent browser contexts. It sends a public welcome, parent-only payment message, private thread reply, and tutor-only handover; it then verifies visibility from each persona and deletes the tutor message.

## Automated mobile smoke suite

Install a development build, sign in as the synthetic staff user, and expose the classroom through the app's channel deep link. Run:

```bash
cd apps/mobile
maestro test \
  -e APP_ID=YOUR_DEVELOPMENT_APP_ID \
  -e CLASSROOM_DEEP_LINK=YOUR_APP_SCHEME://channel/YOUR_CLASSROOM_CHANNEL_ID \
  .maestro/message-audiences.yaml
```

This smoke flow verifies that the staff audience picker appears and can send parent and tutor messages. Run the web multi-persona suite for authoritative cross-user privacy checks because one Maestro device holds one signed-in persona.

## Manual web and mobile parity matrix

Repeat each row once on web and once on mobile. Refresh or force-close and reopen after every restricted send.

| Scenario                 | Staff                                                 | Intended recipient                          | Excluded recipient                  |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------- | ----------------------------------- |
| Everyone                 | Message and `Staff` badge visible                     | Visible                                     | Visible                             |
| Parents                  | Private label lists the sender and selected guardians | Visible                                     | Tutor and student cannot find it    |
| Tutors                   | Private label lists the sender and selected educators | Visible                                     | Parents and student cannot find it  |
| Named person             | Named preview matches the selection                   | Visible                                     | Every other member cannot find it   |
| Private thread reply     | Composer says it inherits the audience                | Visible in the correct thread               | Absent from channel and thread APIs |
| Edit                     | `Edited` appears; audience does not change            | Updated text visible                        | Still absent                        |
| Delete reply             | Reply disappears; root remains                        | Thread counts update                        | No deleted preview leaks            |
| Delete root with replies | Deleted placeholder retains thread continuity         | Remaining permitted replies stay accessible | Thread metadata remains absent      |

## Security and secondary-view checks

For each restricted message, verify the excluded account cannot retrieve the message through:

1. channel pagination and direct refresh;
2. thread loading and reply counts;
3. message search, saved messages, and pinned messages;
4. channel files and attachment URLs;
5. Realtime events after reconnect;
6. inbox/activity feed, push, email, and unread counters;
7. a forged API request containing a cross-organization or non-member profile ID.

The API must reject audience requests from non-staff, requests for DMs/group DMs, empty effective audiences, disabled-flag callers, and recipients without active channel membership. A thread reply with an audience payload must be rejected; the server and database copy the parent audience.

## Focused verification

```bash
pnpm --filter api test -- --runInBand src/modules/messages/message-audience.spec.ts
pnpm --filter @iconicedu/ui-web test -- message-input.test.tsx
pnpm --filter mobile test -- --runInBand src/__tests__/message-input.test.tsx
pnpm lint:affected
pnpm typecheck:affected
pnpm test:affected
pnpm run ci
```

When schema or RLS behavior changes, also run `supabase db reset`. Record every command actually run in the PR; do not report manual device or delivery-provider checks as automated results.

## Cleanup

Delete the synthetic messages and revoke the synthetic storage states after the run. Remove the synthetic classroom when it is no longer shared by another test. Do not reuse payment links, real email addresses, or production notification endpoints.
