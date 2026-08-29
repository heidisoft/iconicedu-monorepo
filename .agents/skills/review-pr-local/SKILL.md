---
name: review-pr-local
description: Apply ICONIC Academy architecture, security, privacy, accessibility, and domain rules when the core review-pr skill reviews a pull request in this repository.
---

# ICONIC Academy PR Review

Supplement the core `review-pr` skill with repository-specific review priorities. Do not change its `review.json` schema, annotated-diff contract, required comment labels, evidence rules, suggestion-block constraints, verdict values, or validator requirements.

Before reviewing, read the repository-root `AGENTS.md` and the topic guidance relevant to the diff under `.agents/`. Always read [references/iconic-academy-review.md](references/iconic-academy-review.md) for the domain risk model.

## Priority Mapping

Keep the core label at the start of every inline comment, then append the ICONIC priority:

- `🚨 [CRITICAL] [P0]` — immediate security, privacy, destructive-data, or production risk.
- `⚠️ [IMPORTANT] [P1]` — likely production bug or significant regression.
- `💡 [SUGGESTION] [P2]` — meaningful non-critical correction.
- `🧹 [NIT] [P3]` — low-impact improvement; report sparingly and include the suggestion block required by the core skill.

P0 and P1 findings normally require `"verdict": "REJECT"`. P2 and P3 findings do not automatically block merging. Keep the core skill's required `Found: X critical, Y important, Z suggestions` summary; the P marker adds ICONIC prioritization without replacing those categories.

Use the same `[P0]` through `[P3]` markers for findings that can only appear in the top-level review body.

## Lead-Review Target

Optimize for a concise first pass that a lead developer can consume in 5–10 minutes:

1. Establish the PR's intent, affected users, trust boundaries, and data mutations.
2. Trace the highest-risk changed path from UI through API, authorization, business logic, and persistence.
3. Check realistic failure paths, changed tests, and changed comments.
4. Report only actionable findings, ordered P0 through P3; prefer three high-value findings over many minor observations.

The time target is for reviewer consumption, not a cutoff. Do not skip the complete diff audit, the core pre-verdict audit, or `review.json` validation.
