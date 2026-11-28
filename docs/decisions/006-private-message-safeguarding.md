# ADR-006 — Safeguarding rules for private channel messages

**Date:** 2026-11-27
**Status:** Proposed

---

## Context

Channel members can send a message to a chosen audience instead of everyone in the channel (`visibility_type = 'specific-users'`). Until now any member who could post could address any other member. Restricted messages were also hidden from staff unless they were in the audience: `20261117000000_channel_message_audience_privacy_hardening.sql` deliberately limited staff observers to restricted messages addressed to them.

Classroom channels mix children, their guardians, tutors, and staff. With open targeting, a tutor could message a student privately with no guardian or staff visibility, a student could message another family's parent, and the organization had no way to review a private conversation after a complaint.

## Decision

1. **Who may address whom privately** (single source of truth: `packages/utils/src/message-audience-policy.ts`, enforced in `apps/api`):

   | Sender                | May address privately                    |
   | --------------------- | ---------------------------------------- |
   | Staff / admin / owner | Anyone                                   |
   | Tutor                 | Staff, tutors, parents, students (see 2) |
   | Parent                | Staff, tutors                            |
   | Student               | Nobody — students only post to everyone  |

   Students can still reply inside a private thread they are already part of; replies inherit the parent audience.

   Pickers offer whole groups (parents, tutors, students) and any single parent, tutor, or student by name, but offer staff (owners, admins, and staff) only as a single **Staff** option. Choosing it addresses every staff member in the channel, so families and tutors can raise a concern with the staff team and those staff are notified. Staff who are not channel members are not notified, but can still read the message through staff review (rule 3).

2. **Guardian auto-include.** When a student is in the audience, their guardians who are members of the channel are added automatically. A tutor cannot send to a student who has no guardian in the channel. Staff are exempt from that requirement because of rule 3.

3. **Staff review, read-only.** Owners, admins, and staff can read every restricted message, with its content, attachments, reactions, and threads, in channels they can already see (as members or staff observers). They cannot reply, quote, react, or create threads on messages whose audience they are not part of. They do not receive unread counts or notifications for those messages. Support channels keep their own audience model.

The rules ship behind the existing `enable-channel-communications` rollout flag, which already gates audience selection. The API also uses that flag to gate staff review. The database read policies apply unconditionally once migrated.

## Alternatives considered

| Option                           | Why rejected                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| Keep any-member-to-any-member    | Allows unsupervised adult–child private messaging; no organizational oversight.                   |
| Staff-only private messages      | Pushes legitimate parent ↔ tutor conversations to off-platform channels with no oversight at all. |
| Auto-add staff to every audience | Inflates audiences, notifies staff on every private message, and changes the stored audience.     |
| Staff can read and reply         | Staff would join conversations unannounced; read-only review is sufficient for safeguarding.      |

## Consequences

### Positive

- Adults cannot hold private conversations with children that a guardian and staff cannot see.
- The organization can review any private conversation after a concern is raised.
- The same policy module drives API enforcement and both frontends' pickers.

### Negative / trade-offs

- Reverses the staff-observer privacy hardening of 2026-11-17 for restricted messages.
- Parents cannot privately message other parents in a channel.
- A tutor cannot privately reach a student whose guardian is not in the channel.

### Risks

- Staff review becomes visible through Realtime and any remaining direct table reads as soon as the migration is applied, independent of the API flag.
- Picker filtering on the clients uses profile kind only; owners and admins whose profile kind is not `staff` see a narrower picker than the API would allow.

## References

- `supabase/migrations/20261127200000_staff_review_restricted_messages.sql`
- `supabase/tests/staff_review_restricted_messages.test.sql`
- `apps/api/src/lib/messages/message-audience-policy.ts`
- [Channel Message Audience E2E Testing](../getting-started/message-audience-testing.md)
