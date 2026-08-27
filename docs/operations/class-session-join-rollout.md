# Class-Session Join Rollout (`enable-any-visible-class-session-join`)

## Purpose

Rollout and rollback runbook for the role-independent class-session Join
behaviour introduced by issue #195.

## Intended Audience

Engineers and operators rolling this behaviour out or turning it off.

## Last Updated

2026-08-27

## Related Docs

- [Documentation Hub](../README.md)
- [Architecture](../codebase/ARCHITECTURE.md)
- [Deployment](deployment.md)

## What Changes

The product invariant is:

> Anyone who is allowed to see a Join button must be able to use it to join that
> class.

Before this change, three separate client-side rules broke that invariant:

- web and mobile dashboards hid Join on every `next-week` card;
- the web and mobile classroom Sessions tabs enabled Join on only the earliest
  upcoming occurrence and left the rest visible but permanently disabled; and
- a staff observer could see an organization-wide session whose join endpoint
  would then reject them for not being a `channel_members` row.

With the flag on:

- every occurrence the API marks eligible renders an **enabled** Join;
- an occurrence the API marks ineligible renders **no** Join at all — a visible
  but permanently disabled Join is no longer a valid state; and
- clicking a future occurrence creates or reuses the room for **that exact
  occurrence**, never a generic channel-scoped huddle.

## Ownership

Join authorization, occurrence identity, and lifecycle checks are owned by
`apps/api` (`src/modules/live-sessions`). Clients never decide eligibility from
the viewer's role.

| Concern                                    | Owner                                                         |
| ------------------------------------------ | ------------------------------------------------------------- |
| Occurrence identity + recurrence expansion | `packages/utils/src/class-schedule-occurrences.ts`            |
| Occurrence resolution + scope key          | `apps/api/src/lib/live-sessions/scope.ts`                     |
| Authorization, eligibility, join           | `apps/api/src/modules/live-sessions/live-sessions.service.ts` |
| Shared contract                            | `packages/shared-types` (`ClassSessionJoinAvailabilityVM`)    |
| Web transport                              | `apps/web/lib/live-sessions/api-client.ts`                    |
| Mobile transport                           | `apps/mobile/src/lib/api/live-sessions/queries.ts`            |

### Who may join

Authorization is role-independent — the same questions are asked of every
viewer. A join is allowed when **any** of these hold, and denied otherwise:

1. the actor's profile (or, for a guardian, a linked child's profile) is a
   member of the occurrence's channel;
2. that same profile set is named on the schedule's
   `class_schedule_participants`; or
3. the actor's profile kind is `staff` or `system`, for an active occurrence in
   their own organization.

Organization isolation, archived-classroom rejection, cancelled/disabled
occurrence rejection, and past-occurrence rejection all remain enforced
server-side and do **not** depend on the flag.

## Flag Wiring

| Surface | Where                                                                          | Default |
| ------- | ------------------------------------------------------------------------------ | ------- |
| Catalog | `packages/shared-types/src/shared/feature-flags.ts`                            | —       |
| Web     | `apps/web/flags.ts` → `enableAnyVisibleClassSessionJoin`                       | `false` |
| Mobile  | `useMobileFeatureFlag(mobileFeatureFlagKeys.enableAnyVisibleClassSessionJoin)` | `false` |
| API     | `evaluateApiBooleanFlag` in `live-sessions.service.ts`                         | `false` |

The API evaluates the same PostHog flag the clients do. This is deliberate: it
keeps a client that is ahead of (or behind) the rollout from rendering an action
the endpoint would reject, and vice versa. With the flag **off**, the API applies
the legacy rule — only an occurrence already within 15 minutes of starting is
joinable — and denies anything earlier with `feature_disabled`.

Mobile's local fallback is `EXPO_PUBLIC_ENABLE_ANY_VISIBLE_CLASS_SESSION_JOIN`,
which is `false` unless explicitly set.

## Rollout

1. Deploy `apps/api`, `apps/web`, and the mobile build. With the flag off,
   behaviour is unchanged on every surface.
2. Create the PostHog flag `enable-any-visible-class-session-join` at 0%.
3. Roll out to internal staff profiles first. Staff are the cohort whose
   authorization actually changed (the observer branch), so they exercise the
   new path most directly.
4. Expand to educators, then students/guardians.
5. Watch for `not_authorized` and `occurrence_not_found` join denials. A rise in
   either means a client is offering a Join the API will not honour — that is
   the invariant this change exists to protect, so treat it as a rollback signal
   rather than a client-side patch.

## Rollback

Set the PostHog flag to 0%. No deploy is required. Every surface returns to the
legacy single-occurrence / no-next-week behaviour, and the API returns to the
15-minute window. Authorization and tenant isolation are unaffected either way.

## After Full Release

Remove, in one change:

- `enableAnyVisibleClassSessionJoin` from `apps/web/flags.ts` and its catalog
  entry;
- the `anyVisibleJoinEnabled` props threaded through `packages/ui-web` and the
  mobile session surfaces;
- `getJoinableSessionId` (`messages-schedule-tab.utils.ts`) and the
  `activeJoinSessionId` memo in `space-sessions-tab.tsx`, along with their
  OFF-branch tests; and
- the `feature_disabled` branch and `LEGACY_EARLY_JOIN_ALLOWANCE_MS` in the API
  service.

## Known Migration Edge

An occurrence that was **rescheduled** by a recurrence override and had a room
created under the _pre-change_ code was keyed by its moved start time, while the
new code keys it by the original occurrence key.
`resolveClassSessionOccurrenceScope` returns both keys in `compatibleScopeKeys`
and the join path checks each, so a room live across the deploy is still reused
rather than duplicated. This compatibility check can be dropped once no
pre-change rooms remain.

## Not Yet Migrated

The provider webhook (`apps/web/app/api/webhooks/live-sessions/[provider]`) and
the attendance report it drives still live in `apps/web/lib/live-sessions`,
because live-session providers are configured against the web origin. Moving
them is a separate change and requires updating provider webhook URLs.
