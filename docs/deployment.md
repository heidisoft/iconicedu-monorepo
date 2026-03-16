# Deployment Guide

How to deploy each app in the IconicEdu monorepo to production.

---

## Table of Contents

- [Web — Vercel](#web--vercel)
- [Mobile — EAS Build and Submit](#mobile--eas-build-and-submit)
- [API — NestJS](#api--nestjs)
- [Database — Supabase](#database--supabase)
- [Environment Variables Reference](#environment-variables-reference)

---

## Web — Vercel

The Next.js web app is designed to deploy on [Vercel](https://vercel.com). It uses the App Router and Supabase SSR, both of which work natively on Vercel's edge/serverless runtime.

### First-time setup

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Set the **Root directory** to `apps/web`
4. Set the **Framework preset** to `Next.js`
5. Add environment variables (see below)
6. Deploy

### Environment variables (Vercel dashboard)

| Variable                        | Where to find it                    |
| ------------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase dashboard → Settings → API |

### Deploying

Every push to `main` triggers an automatic production deployment. PRs get preview deployments automatically.

To deploy manually:

```bash
# From repo root
pnpm --filter web build   # verify locally first
# then push to main or use Vercel CLI:
vercel --prod
```

### Custom domain

Set up in Vercel dashboard → Project → Settings → Domains.

---

## Mobile — EAS Build and Submit

The Expo mobile app is built and distributed via [EAS (Expo Application Services)](https://expo.dev/eas).

### Prerequisites

```bash
npm install -g eas-cli
eas login
```

### Build profiles

Three profiles are configured in `apps/mobile/eas.json`:

| Profile       | Use for                        | Distribution                           |
| ------------- | ------------------------------ | -------------------------------------- |
| `development` | Local testing with dev client  | Internal                               |
| `preview`     | Stakeholder testing            | Internal (TestFlight / internal track) |
| `production`  | App Store / Play Store release | Store                                  |

### Development build

A development build includes the Expo dev client, which lets you run the app with `expo start` against a physical device — unlike Expo Go, it supports custom native modules.

```bash
pnpm mobile:eas:build:dev
```

Install the resulting build on your device, then start the dev server:

```bash
pnpm dev:mobile
```

### Preview build

For stakeholder testing or QA. Distributed via TestFlight (iOS) or an internal Google Play track.

```bash
pnpm mobile:eas:build:preview
```

### Production build

```bash
# Both platforms
pnpm mobile:eas:build:prod

# iOS only
pnpm mobile:eas:build:ios

# Android only
pnpm mobile:eas:build:android
```

### Submit to stores

```bash
# Submit both
pnpm mobile:eas:submit

# iOS to App Store Connect
pnpm mobile:eas:submit:ios

# Android to Play Store
pnpm mobile:eas:submit:android
```

### OTA updates (EAS Update)

For JavaScript-only changes (no native code changes), you can push an over-the-air update without a full store release:

```bash
pnpm mobile:eas:update
```

### Environment variables in EAS

Mobile env vars (`EXPO_PUBLIC_*`) are set in `apps/mobile/eas.json` under the `env` key per profile, or in the EAS dashboard:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

Do not commit actual values — use EAS Secrets for production credentials.

---

## API — NestJS

The NestJS API is a standard Node.js HTTP server and can be deployed to any platform that runs Docker or Node.js.

### Build

```bash
pnpm --filter api build
# Output: apps/api/dist/
```

### Run in production

```bash
node apps/api/dist/main.js
```

### Recommended platforms

| Platform                                       | Notes                                           |
| ---------------------------------------------- | ----------------------------------------------- |
| [Railway](https://railway.app)                 | Simple, good for early-stage; auto-detects Node |
| [Render](https://render.com)                   | Free tier available; deploy from GitHub         |
| [Fly.io](https://fly.io)                       | More control; good if you need edge regions     |
| [AWS ECS / App Runner](https://aws.amazon.com) | For scale                                       |

### Docker (recommended for consistency)

Create `apps/api/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json .
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

### Environment variables

| Variable                    | Description                                   |
| --------------------------- | --------------------------------------------- |
| `DATABASE_URL`              | Supabase Postgres connection string (pooled)  |
| `DIRECT_URL`                | Non-pooled URL for Prisma migrations          |
| `SUPABASE_URL`              | Supabase project URL                          |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS)               |
| `JWT_SECRET`                | From Supabase → Settings → API → JWT Settings |
| `PORT`                      | HTTP port (default `3001`)                    |

### Prisma in production

Run migrations before starting the server. Never run `prisma migrate dev` in production — use `prisma migrate deploy`:

```bash
npx prisma migrate deploy
node dist/main.js
```

---

## Database — Supabase

The database is fully managed by Supabase. Schema changes are applied via migration files in `supabase/migrations/`.

### Applying migrations to production

```bash
# Link to the production project (one-time)
supabase link --project-ref <production-project-ref>

# Push pending migrations
supabase db push
```

Always test migrations locally first:

```bash
supabase db reset   # wipe + reapply all migrations locally
```

### Branching (preview environments)

Supabase supports database branching for preview deployments. Each Vercel preview can have its own Supabase branch. See [Supabase Branching docs](https://supabase.com/docs/guides/platform/branching) for setup.

### Backups

Supabase automatically takes daily backups on paid plans. For additional safety, schedule periodic `pg_dump` exports via a cron job or Supabase's scheduled functions.

---

## Environment Variables Reference

| Variable                        | Web         | Mobile | API | Notes                      |
| ------------------------------- | ----------- | ------ | --- | -------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | ✅          | —      | —   | Public, browser-safe       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅          | —      | —   | Public, browser-safe       |
| `SUPABASE_SERVICE_ROLE_KEY`     | ✅ (server) | —      | ✅  | Never expose client-side   |
| `EXPO_PUBLIC_SUPABASE_URL`      | —           | ✅     | —   | Inlined at build time      |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | —           | ✅     | —   | Inlined at build time      |
| `DATABASE_URL`                  | —           | —      | ✅  | Pooled Postgres URL        |
| `DIRECT_URL`                    | —           | —      | ✅  | Non-pooled, for migrations |
| `SUPABASE_URL`                  | —           | —      | ✅  |                            |
| `JWT_SECRET`                    | —           | —      | ✅  | From Supabase JWT settings |
