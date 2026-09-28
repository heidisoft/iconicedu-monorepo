do $$
begin
  if not exists (select 1 from pg_type where typname = 'ai_provider') then
    create type public.ai_provider as enum ('anthropic', 'openai');
  end if;
end $$;

-- One row per org: the provider/key/model backing every AI-assist call for
-- that org, and the switch that turns AI message features (refine +
-- suggested replies) on/off independently of the per-profile PostHog
-- rollout flags. api_key_ciphertext holds an AES-256-GCM envelope encrypted
-- app-side (apps/api and apps/web each have a small secret-cipher.ts) —
-- Postgres never sees the plaintext key. api_key_last_four is stored only
-- for display in the admin settings UI ("•••• 7f3a") without ever returning
-- the real key to a client.
create table public.org_ai_provider_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  provider public.ai_provider not null default 'anthropic',
  model text,
  api_key_ciphertext text,
  api_key_last_four text,
  messaging_features_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint org_ai_provider_settings_org_id_key unique (org_id)
);

alter table public.org_ai_provider_settings enable row level security;

create policy "org admins manage ai provider settings"
  on public.org_ai_provider_settings
  for all
  to authenticated
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

create trigger set_updated_at_org_ai_provider_settings
  before update on public.org_ai_provider_settings
  for each row execute procedure public.set_updated_at();
