# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added

- Conventional Commit validation for local commits and pull request titles
- A single `pnpm setup:local` onboarding path with environment synchronization
- API-first architecture and contributor workflow diagrams
- PR template, issue templates, and GitHub Actions CI workflow
- `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`
- `docs/getting-started/setup.md` — full local environment setup guide with Supabase instructions
- `CONTRIBUTING.md` — branch naming, commit conventions, PR process
- `docs/standards/best-practices.md` — TypeScript, monorepo, web, mobile, and database conventions
- `docs/operations/deployment.md` — Vercel (web), EAS (mobile), and API deployment guides
- `docs/architecture/database.md` — schema overview, migration workflow, RLS patterns
- `docs/architecture/overview.md` — high-level system architecture and data flow
- `docs/architecture/packages.md` — documentation for each shared package
- `docs/decisions/` — Architecture Decision Records
- `.env.*.example` files for all apps
- `.editorconfig` for consistent editor settings
- `.github/CODEOWNERS` for automatic reviewer assignment
- Facebook Messenger-style animated emoji picker in mobile message actions
- Save, Copy text, Forward, Hide, and Delete actions in mobile message actions sheet
- Account status set to `active` after successful mobile login (OTP and Google)
- Avatar images shown for DM participants in the messages list
- Last message preview text in the messages/channels list
- Inline thread replies for right-aligned (own) messages pushed to right with 25% left margin
- Parent message excluded from thread replies list

### Changed

- Contributor, setup, architecture, testing, security, and deployment documentation reviewed and aligned with current repository automation
- Branch protection now requires one approval and resolved review conversations
- `README.md` rewritten as a lean hub document with accurate versions and quick-start
- Expo SDK upgraded to 55 (React Native 0.83.2, React 19.2.4)
- Mobile auth migrated to `expo-secure-store` for token persistence

### Fixed

- `fetchChannels` broken join on non-existent `content` column replaced with `fetchLastMessages` helper
- Thread replies duplicating the parent message (added `.neq('id', parentMessageId)` filter)
- Mobile inline thread alignment for own messages
- Restored the API-role grants required by existing PostgREST callers on newly provisioned
  databases, then hardened the final state by removing all direct `anon` table and sequence access,
  cross-tenant assessment read policies, token-enumeration access, and automatic future
  grants for `anon` and `authenticated`
- Added a Supabase access-control CI guard for RLS, anonymous grants and policies, default
  privileges, and public view security
- Enabled ordered deployment of all pending immutable migrations with Supabase
  `--include-all`

---

## [0.1.0] — 2026-01-01

### Added

- Initial monorepo setup with Turborepo, pnpm workspaces
- `apps/web` — Next.js 15 web application with Supabase SSR
- `apps/mobile` — Expo 54 mobile application with Expo Router
- `apps/api` — NestJS 11 API with Prisma 7
- `packages/ui-web` — Web UI component library (shadcn/Radix + Tailwind)
- `packages/ui-native` — Native UI component library (NativeWind v4)
- `packages/shared-types` — Shared VMs, rows, payloads, and enums
- `packages/utils` — Shared utility functions
- Supabase schema with RLS for all tables
- Multi-role model: guardians, educators, children, advisors, staff
- Real-time messaging (channels, DMs, spaces, threads)
- Scheduling and session management
- Homework submission workflow
- Progress tracking and reporting
