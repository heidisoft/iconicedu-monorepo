# Architecture

Full detail: [docs/codebase/ARCHITECTURE.md](../docs/codebase/ARCHITECTURE.md) (style, system flow, layer ownership, reused patterns) and [docs/codebase/STRUCTURE.md](../docs/codebase/STRUCTURE.md) (directory map, module boundaries, entry points).

- Hard boundary rules (frontend-only web/mobile, API clients, package ownership) are non-negotiable — see root [AGENTS.md](../AGENTS.md) "Architecture Boundaries" before proposing anything that crosses them.
- ADR-004 (`docs/decisions/004-api-first-frontend-boundary.md`) is the accepted decision record behind the frontend boundary.
