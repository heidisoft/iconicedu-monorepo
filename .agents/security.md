# Security And Data Access

Hard rules (frontend Supabase boundary, migrations, secrets) live in root [AGENTS.md](../AGENTS.md) "Architecture Boundaries" and "Non-Negotiable Repository Rules" — read those first, they are non-negotiable.

- Known/tracked security gaps (validation, RLS, dependency scanning): [docs/codebase/CONCERNS.md](../docs/codebase/CONCERNS.md) "Security Concerns" — check before assuming a gap is new.
- RLS and migration constraints: [docs/codebase/ARCHITECTURE.md](../docs/codebase/ARCHITECTURE.md) "Architectural Style" section.
