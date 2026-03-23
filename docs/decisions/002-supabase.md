# ADR-002 — Supabase as Database and Auth Platform

**Date:** 2026-01-01
**Status:** Accepted

---

## Context

The platform requires:

- A relational database with complex joins (users, classes, messages, threads, reactions)
- Row-level security to enforce multi-role data visibility (guardian, educator, student, advisor, staff)
- Authentication with email OTP and Google OAuth
- Real-time updates for the messaging features
- File storage for homework uploads and profile avatars
- Fast iteration speed — the platform is early-stage

Key constraints:

- The data model involves children's data — access control must be enforced at the database level, not just application code
- Multi-role visibility rules are complex (guardians see their children's data via `family_links`; advisors see assigned families)
- The team is small; a managed service reduces operational burden

## Decision

Use **Supabase** as the all-in-one backend platform:

- **PostgreSQL** for the relational database
- **Row Level Security (RLS)** for enforcing access control at the database level
- **Supabase Auth** for authentication (email OTP + OAuth providers)
- **Supabase Realtime** for WebSocket-based live updates
- **Supabase Storage** for file uploads

All database schema changes are managed via migration files in `supabase/migrations/`.

## Alternatives considered

| Option                             | Why rejected                                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Firebase (Firestore)               | NoSQL — poor fit for the relational data model (classes, enrolments, threads, reactions). No SQL joins.                |
| PlanetScale + Auth0                | Two separate managed services; more complexity and cost. No built-in RLS equivalent.                                   |
| Self-hosted Postgres + custom auth | High operational overhead for a small team. Auth is hard to get right, especially for a platform with children's data. |
| Prisma + custom Postgres           | Prisma doesn't support RLS natively; would require application-level access control that could be bypassed.            |
| Hasura                             | GraphQL is a mismatch with the current team's patterns; more complex to reason about permissions.                      |

## Consequences

### Positive

- RLS policies enforce access control at the DB level — a compromised API key cannot bypass row-level restrictions
- Single platform handles auth, database, real-time, and storage — less infrastructure to manage
- Supabase JS client works identically on web and mobile
- `supabase/migrations/` provides a full audit trail of schema evolution
- Local development is excellent via `supabase start` (Docker-based local stack)
- Supabase dashboard makes it easy to inspect data, run queries, and manage users

### Negative / trade-offs

- RLS policies can be complex and are easy to get wrong — require careful testing
- Supabase's hosted Postgres is not as configurable as bare Postgres for advanced use cases
- Real-time is broadcast-based — fine for messaging, but limited for complex filtered subscriptions
- Service role key must be kept strictly server-side; accidental client-side exposure bypasses all RLS

### Risks

- Vendor lock-in to Supabase APIs (mitigated: the underlying Postgres is standard SQL, and Supabase is self-hostable)
- RLS policy bugs could expose cross-user data — all policies must be reviewed and tested
- Supabase pricing changes could affect cost at scale

## References

- `supabase/migrations/` — all schema migrations
- `docs/architecture/database.md` — migration workflow and RLS patterns
