# Architecture Diagrams

## Purpose

Provide a compact, current visual index of repository topology and ownership boundaries.

## Intended Audience

Engineers onboarding to the system or reviewing cross-cutting changes.

## Last Updated

2026-08-14

## Related Docs

- [Architecture Overview](overview.md)
- [Control Flows](swimlanes.md)
- [Feature Diagrams](feature-diagrams.md)
- [Event Pipeline Scalability](event-pipeline-scalability.md)

## System Context

```mermaid
flowchart TB
  People[Guardians · educators · students · staff]
  Web[apps/web<br/>Next.js frontend]
  Mobile[apps/mobile<br/>Expo frontend]
  API[apps/api<br/>NestJS business and data API]
  DB[(Supabase PostgreSQL + RLS)]
  Auth[Supabase Auth]
  RT[Supabase Realtime]
  Storage[Supabase Storage]
  Edge[Supabase Edge Functions + pg_cron]
  Push[Expo Push / APNs / FCM]
  WebHost[Vercel]
  APIHost[Railway]

  People --> Web
  People --> Mobile
  Web -->|typed bearer HTTP| API
  Mobile -->|typed bearer HTTP| API
  API -->|Prisma| DB
  Web --> Auth
  Mobile --> Auth
  Web --> RT
  Mobile --> RT
  Web --> Storage
  Mobile --> Storage
  Edge -->|internal authenticated dispatch| API
  API --> Push
  WebHost -.hosts.-> Web
  APIHost -.hosts.-> API
```

Frontend direct access to Supabase is restricted to Auth, Realtime, and Storage. All table reads and writes go through `apps/api`.

## Workspace Dependencies

```mermaid
flowchart LR
  Shared[packages/shared-types]
  Utils[packages/utils]
  UIWeb[packages/ui-web]
  UINative[packages/ui-native]
  Web[apps/web]
  Mobile[apps/mobile]
  API[apps/api]

  Shared --> UIWeb
  Shared --> UINative
  Shared --> Web
  Shared --> Mobile
  Shared --> API
  Utils --> Web
  Utils --> Mobile
  Utils --> API
  UIWeb --> Web
  UINative --> Mobile
```

No app imports another app. A reusable cross-app contract moves downward into a package; it is not copied or imported across app boundaries.

## Data-Backed Feature Slice

```mermaid
flowchart LR
  Migration[New Supabase migration] --> Prisma[Prisma schema mirror]
  Prisma --> Service[API controller + service]
  Contract[Shared VM / payload] --> Service
  Service --> WebAdapter[Web createApiClient adapter]
  Service --> MobileAdapter[Mobile typed API adapter]
  Contract --> WebUI[Web/shared web UI]
  Contract --> MobileUI[Mobile/shared native UI]
  WebAdapter --> WebUI
  MobileAdapter --> MobileUI
  Tests[Unit · integration · E2E] -.verify.-> Service
  Tests -.verify.-> WebUI
  Tests -.verify.-> MobileUI
```

Not every feature touches every node. The sequence shows ownership when a node is needed.

## Request Lifecycle

```mermaid
sequenceDiagram
  participant Client as Web or Mobile
  participant HTTP as Typed API client
  participant Guard as NestJS auth/validation
  participant Service as Domain service
  participant Prisma as PrismaService
  participant DB as Supabase Postgres

  Client->>HTTP: Request typed resource
  HTTP->>Guard: HTTP + Bearer session
  Guard->>Guard: Authenticate, validate, authorize
  Guard->>Service: Validated identity + DTO
  Service->>Prisma: Domain query or transaction
  Prisma->>DB: SQL
  DB-->>Prisma: Result
  Prisma-->>Service: Typed model
  Service-->>HTTP: Shared response contract
  HTTP-->>Client: Typed state
```

## Event And Notification Pipeline

```mermaid
flowchart LR
  Mutation[API domain mutation] -->|same transaction| Outbox[(event_outbox)]
  Outbox --> Generate[event generation]
  Generate --> Events[(activity_events)]
  Events --> Project[activity projection]
  Events --> Prepare[notification preparation]
  Project --> Feed[(activity_feed_items)]
  Prepare --> Deliver[notification delivery]
  Deliver --> Expo[Expo Push]
  Expo --> Device[APNs / FCM device]
  Jobs[(event_pipeline_jobs)] --> Generate
  Jobs --> Project
  Jobs --> Prepare
  Jobs --> Deliver
  Logs[(event_pipeline_logs)] -.records.-> Jobs
```

See the [activity feed contract](activity-feed.md) and [event pipeline scalability assessment](event-pipeline-scalability.md) before changing producers, jobs, retries, or dispatchers.

## Pull Request Delivery Path

```mermaid
flowchart LR
  Branch[Conventional branch] --> Commit[Conventional commits]
  Commit --> PR[Conventional PR title]
  PR --> Quality[Format · lint · typecheck]
  PR --> Test[Test]
  Quality --> Build[Build]
  Test --> Build
  Build --> Preview[Supabase · Railway · Vercel preview]
  Preview --> Review[Review + smoke test]
  Review --> Squash[Squash merge to main]
  Squash --> Production[Protected production configuration]
```

The exact checks and preview behavior live in the [development workflow](../getting-started/development-workflow.md) and [deployment guide](../operations/deployment.md).

## Diagram Maintenance

- Keep architecture boundaries here; keep detailed product-domain models in [feature-diagrams.md](feature-diagrams.md).
- Update a diagram in the same PR that changes the represented behavior.
- Prefer one responsibility per diagram and link to code or runbooks for operational detail.
- Treat these diagrams as explanatory; migrations, source code, and workflow configuration remain the exact source of truth.
