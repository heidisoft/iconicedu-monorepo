-- Issue #264 (Experimental — AI-assisted communication). Server-side-only
-- usage ledger for the two AI-assist capabilities (refine, suggested
-- replies), used purely to enforce a per-profile daily rate/cost cap.
-- Deliberately holds no message content — only who called which capability
-- and when — per the issue's "never put content ... in logs, analytics,
-- traces" requirement (this table is bookkeeping, not an audit log of text).
--
-- No RLS policies are granted here on purpose: only apps/api's service-role
-- client ever reads/writes this table, so leaving it RLS-enabled with zero
-- policies denies every client-role access path by default.

create table public.ai_assist_usage (
  id uuid primary key default uuid_generate_v7(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('refine', 'suggested_replies')),
  created_at timestamptz not null default now()
);

create index ai_assist_usage_profile_kind_created_idx
  on public.ai_assist_usage (profile_id, kind, created_at desc);

alter table public.ai_assist_usage enable row level security;
