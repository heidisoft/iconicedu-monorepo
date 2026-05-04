# reminders-reconcile-dispatch (Supabase Edge Function)

Thin cron bridge for API-owned reminder reconciliation.

Calls:

- `POST /internal/reminders/reconcile-dispatch`

Required secrets:

- `REMINDERS_RECONCILE_DISPATCH_URL=https://<your-api-domain>/internal/reminders/reconcile-dispatch`
- `INTERNAL_REMINDERS_TOKEN=<same-value-as-INTERNAL_REMINDERS_TOKEN_API>`

Optional:

- `REMINDERS_RECONCILE_DISPATCH_LIMIT=100`
- `REMINDERS_RECONCILE_DISPATCH_LEASE_SECONDS=120`
- `REMINDERS_RECONCILE_DISPATCH_LEASE_OWNER=supabase-edge-cron`

Deploy:

```bash
supabase functions deploy reminders-reconcile-dispatch
```
