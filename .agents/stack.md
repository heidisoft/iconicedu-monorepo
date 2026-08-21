# Stack And Toolchain

Full detail: [docs/codebase/STACK.md](../docs/codebase/STACK.md).

- pnpm/Turborepo TypeScript monorepo: Next.js 15 (web), NestJS 11 + Prisma 7 (api), Expo 55 + React Native 0.83 (mobile), Supabase (Postgres/Auth/RLS/Realtime/Storage).
- `package.json` is authoritative for exact versions and the Node/pnpm engine range — verify there before relying on this file.
- Use `pnpm setup:local` for first-time setup; see [docs/getting-started/setup.md](../docs/getting-started/setup.md).
