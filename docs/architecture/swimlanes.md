# Architecture Control Flows

## Purpose

Show the required cross-system paths for authentication, data access, mutations, Realtime, and files.

## Intended Audience

Engineers tracing or designing behavior across web, mobile, API, and Supabase.

## Last Updated

2026-08-14

## Related Docs

- [Architecture Overview](overview.md)
- [Database Guide](database.md)
- [Feature Diagrams](feature-diagrams.md)
- [Best Practices](../standards/best-practices.md)

## Boundary Summary

`apps/web` and `apps/mobile` are frontend-only. They use Supabase directly for Auth, Realtime, and Storage. Every table read or write, validation rule, privileged action, and business decision goes through `apps/api`.

```mermaid
flowchart LR
  Web[Next.js web] -->|Bearer HTTP| API[NestJS API]
  Mobile[Expo mobile] -->|Bearer HTTP| API
  API -->|Prisma| DB[(Supabase Postgres)]
  Web -->|Auth / Realtime / Storage| Supabase[Supabase services]
  Mobile -->|Auth / Realtime / Storage| Supabase
  Supabase --> DB
```

## Authentication And Account Activation

```mermaid
sequenceDiagram
  actor User
  participant Client as Web or Mobile
  participant Auth as Supabase Auth
  participant API as apps/api
  participant DB as PostgreSQL

  User->>Client: Submit OTP, OAuth, or supported credentials
  Client->>Auth: Supabase Auth SDK request
  Auth-->>Client: Authenticated session
  Client->>API: POST /accounts/activate + Bearer session
  API->>API: Validate request and authenticated identity
  API->>DB: Create or activate account through Prisma
  DB-->>API: Account state
  API-->>Client: Shared account/onboarding response
  Client-->>User: Route to the appropriate experience
```

Web stores the Supabase session through the SSR cookie integration. Mobile persists its session through the app's secure-storage adapter. Neither client activates an account by writing a table directly.

## Authenticated Read

```mermaid
sequenceDiagram
  actor User
  participant UI as Web Server Component or Mobile Screen
  participant Client as Typed API client
  participant API as NestJS controller/service
  participant DB as PostgreSQL

  User->>UI: Open a protected view
  UI->>Client: Request typed resource
  Client->>API: GET endpoint + Bearer session
  API->>API: Authenticate, authorize, validate query
  API->>DB: Prisma read
  DB-->>API: Database result
  API->>API: Map to shared VM/response contract
  API-->>Client: JSON response
  Client-->>UI: Typed data
  UI-->>User: Render state
```

- Web creates the client with `createApiClient(supabase)`.
- Mobile uses `apiGet` and stable React Query keys.
- UI components consume shared VMs or purpose-built response types, never raw database rows.
- API authorization is required even though database RLS remains enabled as defense in depth.

## Validated Mutation And Domain Event

```mermaid
sequenceDiagram
  actor User
  participant UI as Web or Mobile UI
  participant API as NestJS API
  participant DB as PostgreSQL
  participant Outbox as Event outbox
  participant Worker as Edge dispatcher / API worker

  User->>UI: Submit an action
  UI->>API: POST/PUT/DELETE + payload + Bearer session
  API->>API: Authenticate, validate DTO, authorize tenant/resource
  API->>DB: Prisma transaction
  API->>Outbox: Record canonical domain event in transaction
  DB-->>API: Committed result
  API-->>UI: Shared response VM
  Outbox-->>Worker: Poll/dispatch queued work
  Worker->>DB: Project activity, reminders, or notifications
```

Mutations must be retry-safe where the product can submit them more than once. Event producers write the outbox through the approved event helper and do not write derived activity-feed tables directly.

## Realtime Invalidation And Refetch

```mermaid
sequenceDiagram
  participant API as apps/api
  participant DB as PostgreSQL
  participant RT as Supabase Realtime
  participant Client as Web or Mobile client

  API->>DB: Commit table change
  DB-->>RT: postgres_changes event
  RT-->>Client: RLS-filtered change notification
  Client->>Client: Invalidate/update the relevant cache key
  Client->>API: Refetch canonical data when needed
  API->>DB: Authorized Prisma read
  DB-->>API: Current state
  API-->>Client: Typed response
```

Realtime is a notification channel, not a license for frontend table queries. Always unsubscribe during component cleanup and use targeted cache invalidation to avoid unnecessary refetches.

## Storage Upload Or Download

```mermaid
sequenceDiagram
  actor User
  participant Client as Web or Mobile
  participant Storage as Supabase Storage
  participant API as apps/api

  User->>Client: Select or request a file
  Client->>Storage: Upload/download with authenticated session
  Storage->>Storage: Enforce bucket policy and object path rules
  Storage-->>Client: Object result
  opt Metadata or business workflow required
    Client->>API: Submit object reference and domain payload
    API-->>Client: Validated resource response
  end
```

Direct Storage access is permitted only under RLS-backed bucket policies. Elevated file operations and all table metadata changes belong in the API.

## Shared Contract Pipeline

```text
Supabase migration
  -> apps/api/prisma/schema.prisma
  -> API controller DTO + service
  -> packages/shared-types VM/payload when shared across apps
  -> web/mobile typed API adapter
  -> app or shared UI component
```

For a new data-backed feature, review and test every affected step. Cross-app types belong in `packages/shared-types`; app-specific transport details stay in the owning app.
