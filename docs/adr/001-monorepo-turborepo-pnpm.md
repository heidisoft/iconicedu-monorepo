# ADR-001 — Monorepo with Turborepo and pnpm

**Date:** 2026-01-01
**Status:** Accepted

---

## Context

IconicEdu consists of three apps (web, mobile, API) that share types, UI components, and utilities. We needed to decide whether to use separate repositories or a monorepo, and if a monorepo, which tooling to use.

Key requirements:
- Shared TypeScript types between all apps, with a single source of truth
- Shared UI components (separate libraries for web and native)
- Incremental builds — don't rebuild everything on every change
- Local package linking without publishing to npm
- Works with Expo and React Native (which have specific module resolution requirements)

## Decision

Use a **pnpm monorepo** with **Turborepo** for task orchestration.

- `pnpm` workspaces for local package linking
- `.npmrc` sets `node-linker=hoisted` for Expo/jest-expo compatibility
- `turbo.json` defines the task pipeline (`build → lint/typecheck/test`)
- All apps and packages live under `apps/` and `packages/`

## Alternatives considered

| Option | Why rejected |
|---|---|
| Separate repos | No shared types without npm publishing; version drift between apps; slow to make cross-cutting changes |
| Nx | More opinionated and complex; Turborepo is simpler for this scale |
| Yarn workspaces + Lerna | pnpm is faster, has better disk efficiency, and has first-class workspace support |
| npm workspaces | No Turborepo-equivalent caching; slower install times |

## Consequences

### Positive

- Single `pnpm install` at root links all packages
- `@iconicedu/shared-types` changes are instantly visible across all apps
- Turborepo caches build outputs — `pnpm build:packages` is nearly instant if nothing changed
- CI runs the entire pipeline with a single `pnpm ci` command
- TypeScript path aliases work across the monorepo via `tsconfig.base.json`

### Negative / trade-offs

- `node-linker=hoisted` deviates from pnpm's default isolated installs — phantom dependencies are possible
- `pnpm install` is slower than a single-app install (more packages)
- Developers must remember to scope commands with `--filter` when adding packages

### Risks

- Expo SDK upgrades can be disruptive when versions of React Native and React are pinned globally (via `pnpm overrides`)
- Large monorepos can have slow `pnpm install` times; mitigated by Turborepo caching
