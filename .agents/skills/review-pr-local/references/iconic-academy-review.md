# ICONIC Academy Review Rules

## Purpose

Review production-bound changes as a senior software architect responsible for an education platform used by students, parents, tutors, and administrators. Prioritize correctness, security, privacy, data integrity, regression risk, architecture, performance, accessibility, testing, and maintainability, in that order.

Focus on changed code and inspect surrounding code only as needed to verify contracts, established abstractions, authorization, side effects, and tests. Do not propose unrelated refactors or stylistic alternatives without a concrete correctness or maintainability benefit.

## Risk Triage

Use the smallest priority that accurately represents the demonstrated consequence:

| Priority | Meaning                                         | Typical examples                                                                                                                                                                             | Merge guidance                                      |
| -------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| P0       | Immediate production or security risk           | Authentication or authorization bypass, sensitive student-data exposure, credential leakage, destructive corruption, remote code execution, critical accounting error                        | Do not merge                                        |
| P1       | Likely production bug or significant regression | Broken API contract, incorrect business rule, race condition, missing permission check, incorrect database mutation, duplicate payment/session, runtime failure, major accessibility blocker | Normally do not merge until fixed                   |
| P2       | Meaningful non-critical issue                   | Weak validation, missing failure handling, important missing test, expensive query, significant maintainability problem                                                                      | Correct soon; blocking depends on demonstrated risk |
| P3       | Low-impact improvement                          | Confusing naming, small duplication, localized simplification, minor accessibility improvement                                                                                               | Non-blocking; omit trivial findings                 |

Do not inflate severity. If evidence is incomplete, state what must be verified and why instead of presenting speculation as a confirmed defect.

## Repository Architecture Boundaries

Treat violations of these repository rules as review findings when introduced or extended by the diff:

- `apps/web` and `apps/mobile` are UI layers and must not own business rules, application validation, privileged operations, or direct table access.
- Frontends may use `supabase.auth.*`, protected Realtime channels, and protected Storage operations. They must not use `supabase.from(...)`.
- Web must call `apps/api` through `createApiClient` from `apps/web/lib/api/http-client.ts`; mobile must use its typed API helpers. Do not add raw API `fetch` calls when the owning client can be extended.
- Apps must not import from or call routes owned by another app. Put cross-app contracts and reusable code in the package that owns that concern.
- New user-facing web behavior requires a catalogued, default-off feature flag unless a documented maintenance exemption applies.
- Never edit an existing Supabase migration. Require a uniquely versioned forward migration and keep Prisma aligned when the API consumes the change.
- Never expose production secrets, service-role credentials, tokens, or real user data.

For data-backed features, verify the dependency direction:

```text
shared contract
→ API DTO and validation
→ authorization and business logic
→ persistence or integration
→ typed frontend adapter
→ UI
```

## Authentication, Authorization, and Privacy

Every protected operation must independently establish the caller's authenticated identity. Do not trust identity, role, ownership, or permission claims supplied by the browser when the server can verify them.

Authentication is not authorization. For each protected resource, verify that the caller may access or mutate that specific resource. Pay particular attention to relationships among students, parents, tutors, administrators, classes, sessions, assignments, messages, and payments. Look for IDOR-style access through user-controlled identifiers.

Treat student and parent information as sensitive. Review APIs, client state, logs, analytics, errors, URLs, query parameters, browser storage, and debug statements for unnecessary exposure of:

- names and contact details;
- academic or attendance records;
- private communications;
- authentication tokens; and
- payment information.

Require the minimum data necessary for each operation. Client-side filtering is never an authorization control.

## Correctness and Contracts

Ask what realistic input, state, retry, or concurrent action makes the changed behavior fail. Check:

- missing, null, malformed, empty, duplicated, or unexpectedly large input;
- incorrect conditions, defaults, calculations, sorting, and filtering;
- stale state, missing branches, and partial updates;
- contract mismatches between persistence rows, API payloads, shared types, and UI models;
- unsafe type assertions, non-null assertions masking uncertainty, and unvalidated external responses; and
- backward compatibility with existing users, URLs, stored data, and API consumers.

Validate all external input at the API boundary, including route and query parameters, forms, webhooks, and third-party responses. Check required fields, types, lengths, allowed values, ranges, dates, identifiers, and unexpected properties. Client validation may improve UX but does not replace server validation.

API changes must use appropriate methods and status codes, return stable safe response shapes, and avoid leaking persistence or infrastructure details in client-visible errors.

## Data Integrity and Financial Logic

Review mutations for transaction boundaries, uniqueness, relationship integrity, partial failure, retry safety, unsafe deletion, N+1 access, and unbounded queries. Determine whether repeatable operations need idempotency, especially when creating sessions, recording attendance, assigning tutors, or processing payments.

Treat parent fees, tutor payouts, session duration, discounts, refunds, balances, and currency conversion as high risk. Check rounding, units, duplicate processing, and boundary conditions. Avoid floating-point money calculations where precision matters and require behavioral tests for financial rules.

## Dates and Scheduling

Check date parsing, date-only values, UTC conversion, user-local display, explicit timezone ownership, daylight-saving transitions, recurring classes, and session start/end calculations. Do not assume the server timezone matches the student, tutor, or institution timezone.

## Failures, Async Work, and Observability

Trace behavior when authentication expires, data is missing, a request times out, the database fails, or a third-party integration is unavailable. Fail safely, present useful user-facing errors, preserve diagnostic context in protected server logs, and never expose secrets or private data.

Check for forgotten `await`, unhandled rejections, unsafe fire-and-forget work, incorrect `Promise.all` use, stale closures, missing cleanup, duplicate submissions, and multiple effects issuing the same request. Repeated button clicks and transport retries must not silently duplicate important records.

Logging should identify actionable failures and unexpected states without recording successful-operation noise or sensitive information. Preserve correlation data where the existing observability pattern supports it.

## React, Next.js, and UI

For React changes, inspect hook ordering and dependencies, cleanup, controlled-state behavior, stable keys, derived or synchronized state, repeated requests, render-time work, and component responsibility. Recommend memoization only when there is evidence of meaningful benefit.

For Next.js changes, verify server/client boundaries, `"use client"` placement, server actions and route handlers, caching and revalidation, redirects, rendering mode, and environment-variable exposure. User-specific or authentication-dependent content must not be cached globally, and server-only logic or secrets must not enter client bundles.

Accessibility is a production requirement. For changed interactions, check semantic controls, accessible names, form labels, keyboard operation, focus management, modal behavior, alternative text, non-color indicators, and screen-reader usability. Also inspect fixed dimensions, overflow, clipping, dialogs, tables, and action reachability across desktop, tablet, and mobile layouts. Report material regressions, not theoretical micro-issues.

## Security and Dependencies

Review relevant trust boundaries for injection, cross-site scripting, CSRF, SSRF, path traversal, open redirects, unsafe uploads, prototype pollution, and secret exposure. Never authorize from client-provided roles.

When a dependency is added, verify that it is necessary, maintained, compatible with the server/client boundary, and not duplicating an existing solution. Report bundle, security, or operational cost only when meaningful.

## Tests and Review Quality

Tests should protect observable behavior and risk rather than implementation details. Require distinct coverage where appropriate for business rules, permissions, authentication, financial calculations, validation, failure paths, and regression bugs. Do not demand arbitrary percentage coverage or redundant input variations that exercise the same path.

Before finalizing, trace important changed paths as applicable:

```text
user
→ UI
→ typed API client
→ authentication
→ resource-level authorization
→ business logic
→ database or integration
→ response
→ UI state
```

Keep every finding concise, specific, evidence-backed, and actionable. Explain the real consequence and the smallest appropriate correction. Do not report formatting, import order, semicolon preferences, requests for comments, speculative memoization, or unrelated refactors.
