# Architecture Decision Records

## Purpose

Canonical index for major architectural decisions in the repository.

## Intended Audience

Engineers who need rationale for technical choices or need to record a new decision.

## Last Updated

2026-08-14

## Related Docs

- [Documentation Hub](../README.md)
- [Architecture Overview](../architecture/overview.md)

An Architecture Decision Record (ADR) documents a significant architectural choice: the context that led to it, the decision made, and the consequences.

ADRs are written when a decision is made and are **never deleted** — if a decision is reversed, a new ADR is written that supersedes the old one. This gives future contributors (and your future self) a record of why things are the way they are.

## Index

| ADR                                       | Title                                  | Status   |
| ----------------------------------------- | -------------------------------------- | -------- |
| [001](001-monorepo-turborepo-pnpm.md)     | Monorepo with Turborepo and pnpm       | Accepted |
| [002](002-supabase.md)                    | Supabase as database and auth platform | Accepted |
| [003](003-expo-react-native.md)           | Expo for cross-platform mobile         | Accepted |
| [004](004-api-first-frontend-boundary.md) | API-first frontend data boundary       | Accepted |

## Creating a new ADR

Copy `template.md` and name the file `NNN-short-title.md` where `NNN` is the next available number.

```bash
cp docs/decisions/template.md docs/decisions/004-my-decision.md
```

Fill in all sections. Status options:

- **Proposed** — under discussion, not yet decided
- **Accepted** — decision made, in effect
- **Deprecated** — no longer current, but not reversed
- **Superseded by [NNN]** — reversed by a later ADR
