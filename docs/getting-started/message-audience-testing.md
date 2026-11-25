# Channel Message Audience E2E Testing

This guide verifies staff identity labels and restricted audiences in ordinary channels and learning-space classrooms. Every channel member who can post can choose a message audience. Direct messages and support-channel behavior remain unchanged.

## What the suite proves

The coverage and manual parity matrix below covers:

- a public staff welcome visible to every channel member;
- parent-only, tutor-only, and named-recipient messages;
- immutable audiences resolved to explicit profile IDs at send time;
- thread replies inheriting the parent message audience;
- edits retaining the original audience;
- deleting a reply, a root message without replies, and a root message with replies;
- hidden content staying absent from channel history, search, pins, saved items, files, unread counts, notifications, and reconnects;
- a clear `Staff` sender badge on web and mobile, including DMs;
- audience selection for staff, parents, students, and tutors who can post;
- no audience selector in DMs, group DMs, or support channels.

## Test data

Use one synthetic organization and a dedicated synthetic classroom. Never use an active lesson or real family data. Create these active channel members:

| Persona          | Profile kind                                        | Purpose                                             |
| ---------------- | --------------------------------------------------- | --------------------------------------------------- |
| Staff sender     | `staff` with an organization staff/admin/owner role | Sends staff-authored audience variants              |
| Parent A         | `guardian`                                          | Receives parent messages and sends a tutor message  |
| Student A        | `child`                                             | Confirms parent-only exclusion                      |
| Tutor A          | `educator`                                          | Included in tutor messages                          |
| Unrelated parent | `guardian`                                          | Confirms named-recipient and cross-family exclusion |

Enable `enable-channel-communications` for every test sender. Keep the flag off for one separate profile to verify the dark rollout. Enable the existing edit, reply, search, pinning, drafts, and send-reliability flags when exercising those capabilities.

Apply all migrations and start the local stack:

```bash
supabase start
supabase db reset
pnpm --filter api db:generate
pnpm dev:api
pnpm dev:web
```

## Self-contained local role matrix

```bash
supabase start
pnpm build:packages
pnpm --filter web exec playwright install chromium
pnpm --filter web test:e2e:audiences
```

This command starts owned API/web processes on loopback ports 3101/3100. It refuses occupied ports or hosted Supabase URLs. It does not reset an existing database: apply the branch migrations first. Each scenario creates a fresh synthetic organization and nine disposable password-authenticated users, with separate child fixtures for family setup, then removes its own fixtures afterward. The runner stops only its own servers. No storage-state files or existing accounts are required. Do not run another Next.js development server in this workspace while the suite uses its build directory.

`message-audience-roles.local.spec.ts` runs six sender roles: owner, admin, staff, parent (`guardian`), student (`child`), and tutor (`educator`). For each sender it sends to everyone and individually to every other member, including a second parent. It verifies authenticated history for every member, a same-organization nonmember, and a different-organization account; restricted sends must increment only the selected recipient's unread count. Six browser workflows select a named person, verify the recipient/excluded account after reload, check the picker resets, then send to everyone. The regression workflow covers inherited private thread and quoted replies, edit privacy, retry deduplication, deletion, forged sender identities, invalid/nonmember/cross-organization recipients, and attempted reply audience expansion.

Runtime unit tests also verify that presence updates and participant reordering do not repeatedly unsubscribe/rejoin live channels; membership, identity, and channel changes still clean up and reconnect.

The GitHub **Message Audience E2E** workflow runs these cases against disposable local Supabase on pull requests and manual dispatch. It also runs API, mobile, and shared web audience unit tests. Local artifacts are private temporary files; do not commit or publish raw logs, traces, or sessions. Live push/email-provider delivery and native multi-device UI remain outside this browser/API suite.

## Existing externally configured web smoke suite

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

The suite uses three independent browser contexts. It sends a public welcome, parent-only payment message, private thread reply, and tutor-only handover from staff. It then sends a tutor-only message from the parent account, verifies visibility from every persona, and deletes the staff-authored tutor message.

## Automated mobile smoke suite

Install a development build, sign in as the synthetic staff user, and expose the classroom through the app's channel deep link. Run:

```bash
cd apps/mobile
maestro test \
  -e APP_ID=YOUR_DEVELOPMENT_APP_ID \
  -e CLASSROOM_DEEP_LINK=YOUR_APP_SCHEME://channel/YOUR_CLASSROOM_CHANNEL_ID \
  .maestro/message-audiences.yaml
```

This smoke flow can run under any channel member account. It verifies that the audience picker appears and can send parent and tutor messages. Run the web multi-persona suite for authoritative cross-user privacy checks because one Maestro device holds one signed-in persona.

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

The API accepts audience requests from any channel member who can post. It must reject requests for DMs/group DMs, empty effective audiences, disabled-flag callers, and recipients without active channel membership. A thread reply with explicit recipients must be rejected; the server and database copy the parent audience.

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
