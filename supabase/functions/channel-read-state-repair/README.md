# channel-read-state-repair (Supabase Edge Function)

Runs nightly unread/read-cursor reconciliation for all orgs by calling:

- `recompute_all_channel_unread_for_org(p_org_id)`

Scheduler source of truth:

- **Supabase Scheduled Functions only**.

## Required environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Deploy

```bash
supabase functions deploy channel-read-state-repair
```

## Example schedule (Supabase Dashboard)

Run nightly (UTC):

- Function: `channel-read-state-repair`
- Cron: `0 3 * * *`
