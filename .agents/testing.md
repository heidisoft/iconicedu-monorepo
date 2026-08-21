# Testing

Full conventions: [docs/codebase/TESTING.md](../docs/codebase/TESTING.md).

- Co-locate tests next to source: `*.test.ts(x)` (web, mobile) or `*.spec.ts` (API) — not a separate `tests/` tree.
- Run the smallest useful loop while iterating, then `pnpm test:affected` before handoff; `pnpm run ci` for cross-cutting changes.
- See root [AGENTS.md](../AGENTS.md) "Non-Negotiable Repository Rules" for the test-coverage requirement.
