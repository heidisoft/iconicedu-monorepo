## Summary

<!-- What does this PR do? 1–3 bullet points. Focus on the "why", not just the "what". -->

-
-

## Related issue

<!-- Use "Closes: #123" when merging this PR should close the issue. -->

Refs:

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behavior change)
- [ ] Documentation
- [ ] Chore (deps, config, tooling)
- [ ] Performance
- [ ] Build / CI

## Affected areas

- [ ] `apps/web`
- [ ] `apps/mobile`
- [ ] `apps/api`
- [ ] `packages/ui-web`
- [ ] `packages/ui-native`
- [ ] `packages/shared-types`
- [ ] `supabase/migrations`

## Architecture and rollout

<!-- Note API/contracts, migrations/RLS, env vars, feature flags, rollout, rollback, security, and known limitations. Use "None" where appropriate. -->

- API / shared contract:
- Migration / RLS:
- Environment variables:
- Feature flag / rollout:
- Rollback:
- Security / privacy:

## Screenshots / recordings

<!-- For any UI change, include a screenshot or screen recording. Delete this section if not applicable. -->

## Test plan

<!-- How did you test this? What should reviewers try? -->

- [ ] Tested locally
- [ ]

## Accessibility

<!-- Keyboard, screen reader/labels, focus, contrast, reduced motion, and platform-specific checks. -->

- [ ] Not applicable
- [ ] Verified relevant accessibility behavior

## Checklist

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build:packages` passes
- [ ] PR title follows Conventional Commits (`feat(web): add ...`)
- [ ] Architecture boundaries are preserved (frontend table access goes through `apps/api`)
- [ ] New behavior has automated tests or the omission is explained
- [ ] New migrations tested with `supabase db reset` (if applicable)
- [ ] `.env.*.example` updated for any new env vars
- [ ] Documentation updated for changed behavior, commands, or operations
- [ ] New web user-facing behavior is flagged off by default (or exemption is documented)
- [ ] No secrets or credentials committed
