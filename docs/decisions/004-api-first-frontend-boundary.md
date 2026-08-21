# ADR-004 — API-First Frontend Data Boundary

**Date:** 2026-08-14
**Status:** Accepted

## Context

IconicEdu has two frontend applications and handles tenant-scoped education data, including information about children. Allowing each frontend to implement table queries, validation, authorization, and business rules independently creates drift and makes security review difficult.

Supabase Auth, Realtime, and Storage have client-specific SDK behavior that is useful in frontend apps. General table access does not need to bypass the shared application boundary.

## Decision

`apps/api` is the only owner of table reads and writes, application validation, business logic, and privileged credentials.

- Web calls `apps/api` with `createApiClient` from `apps/web/lib/api/http-client.ts`.
- Mobile calls `apps/api` with the typed helpers in `apps/mobile/src/lib/api/http-client.ts`.
- Cross-app VMs and payloads live in `packages/shared-types`.
- Web and mobile may use Supabase directly only for Auth, Realtime subscriptions, and Storage operations protected by the relevant policies.
- Neither frontend imports the other frontend or calls its routes.

New features follow contract → API → frontend ordering. Existing frontend table access is migration debt and is not a precedent for new work.

## Consequences

### Positive

- One place owns authorization, validation, business rules, and transaction boundaries.
- Web and mobile behavior stays consistent.
- API contracts can be tested independently of UI rendering.
- Privileged credentials remain outside frontend applications.
- Vendor-specific persistence code is isolated behind an HTTP contract.

### Negative / trade-offs

- A small feature may require API work before UI work.
- Realtime notifications often require a subsequent API refetch for canonical data.
- Existing direct table access must be migrated incrementally.
- API availability and latency affect both frontend applications.

## Compliance

Reviews and repository guards should reject new `supabase.from(...)` use in `apps/web` and `apps/mobile`. Exceptions require a new architectural decision; a PR comment or local convenience is not sufficient.

## References

- [`AGENTS.md`](../../AGENTS.md)
- [Architecture Overview](../codebase/ARCHITECTURE.md)
- [Development Workflow](../getting-started/development-workflow.md)
