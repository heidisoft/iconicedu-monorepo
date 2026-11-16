---
goal: Add staff identity labels and staff-controlled audiences to non-DM channel messages
version: 1.0
date_created: 2026-11-14
last_updated: 2026-11-15
owner: ICONIC Academy Engineering
status: 'Completed'
tags: [feature, messaging, privacy, web, mobile]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Implement Slack-style channel messages and threads with explicit staff identity and server-enforced recipient audiences while preserving direct-message behavior.

## 1. Requirements & Constraints

- **REQ-001**: Show a visible `Staff` badge beside staff senders on web and mobile messages, including direct messages.
- **REQ-002**: Permit authorised staff to select Everyone, Parents, Tutors, or named channel members for new messages in non-DM channels.
- **REQ-003**: Show the effective named audience before sending and on every restricted message.
- **REQ-004**: Inherit the parent message audience for every thread reply and prevent replies or edits from widening it.
- **REQ-005**: Preserve current direct-message behavior and current support-channel audience behavior.
- **REQ-006**: Preserve existing edit and delete permissions while ensuring visibility filtering applies to messages, replies, search, files, notifications, pins, and unread state.
- **SEC-001**: Validate sender authority, organization, channel type, active membership, and every selected recipient in the API.
- **SEC-002**: Enforce message visibility in database RLS and server-side query filters; UI filtering is insufficient.
- **CON-001**: Add forward-only Supabase migrations and keep existing migrations unchanged.
- **CON-002**: Add new web behavior behind a catalogued feature flag that defaults off.
- **GUD-001**: Use typed API clients and shared contracts; do not add frontend table access.
- **PAT-001**: Implement contract, API, web, mobile, tests, and documentation in that order.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Establish secure audience contracts and server enforcement.

| Task     | Description                                                                              | Completed | Date       |
| -------- | ---------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-001 | Add shared audience inputs and recipient summaries to message contracts.                 | ✅        | 2026-11-15 |
| TASK-002 | Validate non-DM staff audience requests and inherit thread-parent visibility in the API. | ✅        | 2026-11-15 |
| TASK-003 | Add forward database integrity enforcement for restricted channel messages and replies.  | ✅        | 2026-11-15 |

### Implementation Phase 2

- GOAL-002: Add consistent web and mobile interaction and labeling.

| Task     | Description                                                                                                            | Completed | Date       |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-004 | Replace icon-only staff indicators with accessible text badges on web and mobile.                                      | ✅        | 2026-11-15 |
| TASK-005 | Add a web non-DM staff audience picker, named-recipient preview, restricted-message label, and inherited thread label. | ✅        | 2026-11-15 |
| TASK-006 | Add equivalent mobile channel audience selection and labels while leaving DM composers unchanged.                      | ✅        | 2026-11-15 |

### Implementation Phase 3

- GOAL-003: Verify privacy behavior and document end-to-end operation.

| Task     | Description                                                                          | Completed | Date       |
| -------- | ------------------------------------------------------------------------------------ | --------- | ---------- |
| TASK-007 | Add API authorization, UI, thread, edit, delete, and attachment regression coverage. | ✅        | 2026-11-15 |
| TASK-008 | Add Playwright and Maestro coverage plus a complete local and CI E2E testing guide.  | ✅        | 2026-11-15 |
| TASK-009 | Run affected checks, commit, push, and create the pull request.                      | ✅        | 2026-11-15 |

## 3. Alternatives

- **ALT-001**: Separate private direct messages were rejected because the requested workflow keeps onboarding context inside the classroom.
- **ALT-002**: Dynamic role audiences were rejected because later membership changes could reveal historical private messages; role choices resolve to immutable profile IDs at send time.

## 4. Dependencies

- **DEP-001**: Existing `specific-users` message visibility columns, mapper, RLS predicates, and activity audience filtering.
- **DEP-002**: Existing channel participant profile kinds (`guardian`, `educator`, `child`, `staff`).
- **DEP-003**: Existing Playwright web and Maestro mobile E2E infrastructure.

## 5. Files

- **FILE-001**: `packages/shared-types/src/shared/messages-realtime.ts` and message VMs for audience contracts.
- **FILE-002**: `apps/api/src/modules/messages/` for authorization, inheritance, and persistence.
- **FILE-003**: `packages/ui-web/src/components/messages/` for web staff and audience UI.
- **FILE-004**: `apps/mobile/src/components/messages/` and channel routes for mobile parity.
- **FILE-005**: `supabase/migrations/` and `supabase/tests/` for database enforcement.
- **FILE-006**: `apps/web/e2e/`, `apps/mobile/.maestro/`, and canonical testing documentation.

## 6. Testing

- **TEST-001**: API rejects non-staff, DM, cross-organization, non-member, empty, and forged audience requests.
- **TEST-002**: Parent and tutor audience sends resolve to explicit members and remain private across list, thread, search, notification, and file paths.
- **TEST-003**: Replies inherit audience; edits preserve it; deletion removes content without exposing retained thread metadata.
- **TEST-004**: Web and mobile show staff and audience labels and never render audience selection in DMs.
- **TEST-005**: E2E covers public welcome, parent-only message, tutor-only message, named audience, private reply, edit, delete, reconnect, and unauthorized visibility.

## 7. Risks & Assumptions

- **RISK-001**: A secondary query or notification projection could leak restricted content; tests must enumerate all message projections.
- **RISK-002**: Existing support-channel rules may conflict with general audience selection; support channels remain on their dedicated workflow.
- **ASSUMPTION-001**: Parent maps to `guardian`, tutor maps to `educator`, and staff maps to verified organization staff privileges.

## 8. Related Specifications / Further Reading

[Root agent instructions](../AGENTS.md)
[Architecture overview](../docs/codebase/ARCHITECTURE.md)
[Testing guide](../docs/codebase/TESTING.md)
