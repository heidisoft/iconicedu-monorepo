# reminders-dispatch (Supabase Edge Function)

Calls the internal app endpoint:

- `POST /internal/reminders/dispatch`

Scheduler source of truth:

- `public.configure_edge_function_cron('<project-url>')` in `supabase/migrations/20260417000000_edge_function_cron.sql`
- Preview branches run this automatically from `.github/workflows/ci.yml`

## Required environment variables

- `REMINDERS_DISPATCH_URL`
- `INTERNAL_REMINDERS_TOKEN`

Recommended values for the API-owned pipeline:

- `REMINDERS_DISPATCH_URL=https://<your-api-domain>/internal/reminders/dispatch`
- `INTERNAL_REMINDERS_TOKEN=<same-value-as-INTERNAL_REMINDERS_TOKEN_API in apps/api>`

## Optional environment variables

- `REMINDERS_DISPATCH_LIMIT` (default handled by API)
- `REMINDERS_DISPATCH_LEASE_SECONDS` (default handled by API)
- `REMINDERS_DISPATCH_LEASE_OWNER` (default: `supabase-edge-cron`)

## Deploy

```bash
supabase functions deploy reminders-dispatch
```

## Configure cron

After migrations are applied to an environment, configure its cron jobs with that environment's own project URL:

```sql
select public.configure_edge_function_cron('https://<project-ref>.supabase.co');
```
