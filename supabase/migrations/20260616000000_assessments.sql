-- =============================================================================
-- Assessment Platform
-- =============================================================================
-- Curriculum taxonomy → Item bank → Tests → Deliveries → Sessions → Results
-- Supports static and adaptive test modes with per-skill scoring.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. CURRICULUM TAXONOMY
-- ---------------------------------------------------------------------------

create table if not exists public.assessment_subjects (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  name        text not null,
  icon        text,
  color       text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.assessment_domains (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs(id) on delete cascade,
  subject_id      uuid not null references public.assessment_subjects(id) on delete cascade,
  name            text not null,
  grade           int  not null check (grade between 1 and 12),
  description     text,
  order_position  int  not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.assessment_skills (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.orgs(id) on delete cascade,
  domain_id            uuid not null references public.assessment_domains(id) on delete cascade,
  name                 text not null,
  description          text,
  standard             text,
  difficulty_baseline  int  not null default 3 check (difficulty_baseline between 1 and 5),
  estimated_time_seconds int not null default 90,
  order_position       int  not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.assessment_skill_prerequisites (
  id                   uuid primary key default gen_random_uuid(),
  skill_id             uuid not null references public.assessment_skills(id) on delete cascade,
  prerequisite_skill_id uuid not null references public.assessment_skills(id) on delete cascade,
  unique (skill_id, prerequisite_skill_id),
  check (skill_id <> prerequisite_skill_id)
);

create table if not exists public.assessment_skill_mastery (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  skill_id         uuid not null references public.assessment_skills(id) on delete cascade,
  org_id           uuid not null,
  level            text not null default 'not_started',
  best_percentage  numeric(5,2) not null default 0,
  attempts         int  not null default 0,
  last_assessed_at timestamptz,
  updated_at       timestamptz not null default now(),
  unique (profile_id, skill_id)
);

-- ---------------------------------------------------------------------------
-- 2. ITEM BANK
-- ---------------------------------------------------------------------------

create table if not exists public.assessment_items (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.orgs(id) on delete cascade,
  skill_id               uuid not null references public.assessment_skills(id),
  title                  text not null,
  type                   text not null,
  -- type: multiple_choice | multiple_response | true_false |
  --        short_answer | essay | ordering | matching | gap_match
  content                jsonb not null default '{}',
  -- explanation and any extra metadata beyond skill tagging
  explanation            text,
  difficulty             int  not null default 3 check (difficulty between 1 and 5),
  estimated_time_seconds int,
  created_by             uuid references public.profiles(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);

create index if not exists assessment_items_skill_difficulty
  on public.assessment_items (skill_id, difficulty)
  where deleted_at is null;

create index if not exists assessment_items_org_type
  on public.assessment_items (org_id, type)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3. TESTS
-- ---------------------------------------------------------------------------

create table if not exists public.assessment_tests (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references public.orgs(id) on delete cascade,
  title                     text not null,
  description               text,
  instructions              text,
  mode                      text not null default 'standard',
  -- mode: standard | adaptive
  time_limit_minutes        int,
  passing_score_percent     int,
  shuffle_sections          bool not null default false,
  show_results_immediately  bool not null default true,
  show_correct_answers      bool not null default false,
  adaptive_config           jsonb,
  created_by                uuid references public.profiles(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz
);

-- Sections (static tests)
create table if not exists public.assessment_test_sections (
  id              uuid primary key default gen_random_uuid(),
  test_id         uuid not null references public.assessment_tests(id) on delete cascade,
  title           text,
  order_position  int  not null default 0,
  shuffle_items   bool not null default false,
  items_to_show   int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Items within a section (static)
create table if not exists public.assessment_test_section_items (
  id              uuid primary key default gen_random_uuid(),
  section_id      uuid not null references public.assessment_test_sections(id) on delete cascade,
  item_id         uuid not null references public.assessment_items(id),
  order_position  int  not null default 0,
  points          int  not null default 1,
  unique (section_id, item_id)
);

-- Skill pools (adaptive tests)
create table if not exists public.assessment_test_skill_pools (
  id               uuid primary key default gen_random_uuid(),
  test_id          uuid not null references public.assessment_tests(id) on delete cascade,
  skill_id         uuid not null references public.assessment_skills(id),
  target_items     int  not null default 5,
  min_items        int  not null default 3,
  max_items        int  not null default 8,
  start_difficulty int  not null default 3 check (start_difficulty between 1 and 5),
  order_position   int  not null default 0,
  unique (test_id, skill_id)
);

-- ---------------------------------------------------------------------------
-- 4. DELIVERIES
-- ---------------------------------------------------------------------------

create table if not exists public.assessment_deliveries (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.orgs(id) on delete cascade,
  test_id             uuid not null references public.assessment_tests(id),
  title               text not null,
  access_type         text not null default 'authenticated',
  -- access_type: public | authenticated | class | specific_users
  access_token        text unique,
  channel_id          uuid references public.channels(id),
  starts_at           timestamptz,
  ends_at             timestamptz,
  max_attempts        int  not null default 1,
  collect_name_email  bool not null default false,
  allow_resume        bool not null default true,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index if not exists assessment_deliveries_token
  on public.assessment_deliveries (access_token)
  where access_token is not null and deleted_at is null;

create table if not exists public.assessment_delivery_participants (
  id           uuid primary key default gen_random_uuid(),
  delivery_id  uuid not null references public.assessment_deliveries(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  unique (delivery_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- 5. SESSIONS
-- ---------------------------------------------------------------------------

create table if not exists public.assessment_sessions (
  id               uuid primary key default gen_random_uuid(),
  delivery_id      uuid not null references public.assessment_deliveries(id),
  profile_id       uuid references public.profiles(id),
  anon_name        text,
  anon_email       text,
  status           text not null default 'not_started',
  -- status: not_started | in_progress | completed | abandoned
  attempt_number   int  not null default 1,
  current_item_id  uuid references public.assessment_items(id),
  item_order       jsonb not null default '[]',
  adaptive_state   jsonb,
  started_at       timestamptz,
  submitted_at     timestamptz,
  time_spent_seconds int,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists assessment_sessions_delivery
  on public.assessment_sessions (delivery_id, status);

create index if not exists assessment_sessions_profile
  on public.assessment_sessions (profile_id)
  where profile_id is not null;

-- ---------------------------------------------------------------------------
-- 6. RESPONSES
-- ---------------------------------------------------------------------------

create table if not exists public.assessment_responses (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.assessment_sessions(id) on delete cascade,
  item_id           uuid not null references public.assessment_items(id),
  skill_id          uuid not null,
  difficulty        int  not null,
  response_data     jsonb,
  is_correct        bool,
  is_flagged        bool not null default false,
  auto_score        numeric(8,4),
  manual_score      numeric(8,4),
  max_score         numeric(8,4) not null default 1,
  grader_id         uuid references public.profiles(id),
  graded_at         timestamptz,
  time_spent_seconds int,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (session_id, item_id)
);

create index if not exists assessment_responses_session
  on public.assessment_responses (session_id);

create index if not exists assessment_responses_skill
  on public.assessment_responses (skill_id, session_id);

-- ---------------------------------------------------------------------------
-- 7. SKILL SCORES (per-skill, per-session)
-- ---------------------------------------------------------------------------

create table if not exists public.assessment_skill_scores (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.assessment_sessions(id) on delete cascade,
  delivery_id     uuid not null,
  profile_id      uuid,
  skill_id        uuid not null references public.assessment_skills(id),
  subject         text not null,
  domain          text not null,
  skill_name      text not null,
  standard        text,
  grade           int,
  difficulty_avg  numeric(4,2),
  score           numeric(8,4) not null default 0,
  max_score       numeric(8,4) not null default 0,
  percentage      numeric(5,2) not null default 0,
  items_total     int  not null default 0,
  items_correct   int  not null default 0,
  mastery_level   text not null default 'not_started',
  created_at      timestamptz not null default now(),
  unique (session_id, skill_id)
);

create index if not exists assessment_skill_scores_delivery
  on public.assessment_skill_scores (delivery_id, skill_id);

create index if not exists assessment_skill_scores_profile
  on public.assessment_skill_scores (profile_id, skill_id)
  where profile_id is not null;

-- ---------------------------------------------------------------------------
-- 8. RESULTS (aggregated per session)
-- ---------------------------------------------------------------------------

create table if not exists public.assessment_results (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null unique references public.assessment_sessions(id) on delete cascade,
  delivery_id           uuid not null,
  profile_id            uuid,
  total_score           numeric(8,4) not null default 0,
  max_score             numeric(8,4) not null default 0,
  percentage            numeric(5,2) not null default 0,
  passed                bool,
  needs_manual_grading  bool not null default false,
  feedback_report       jsonb,
  parent_report         jsonb,
  tutor_report          jsonb,
  learning_plan         jsonb,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists assessment_results_delivery
  on public.assessment_results (delivery_id);

create index if not exists assessment_results_profile
  on public.assessment_results (profile_id)
  where profile_id is not null;

-- ---------------------------------------------------------------------------
-- 9. RLS POLICIES
-- ---------------------------------------------------------------------------

alter table public.assessment_subjects          enable row level security;
alter table public.assessment_domains           enable row level security;
alter table public.assessment_skills            enable row level security;
alter table public.assessment_skill_prerequisites enable row level security;
alter table public.assessment_skill_mastery     enable row level security;
alter table public.assessment_items             enable row level security;
alter table public.assessment_tests             enable row level security;
alter table public.assessment_test_sections     enable row level security;
alter table public.assessment_test_section_items enable row level security;
alter table public.assessment_test_skill_pools  enable row level security;
alter table public.assessment_deliveries        enable row level security;
alter table public.assessment_delivery_participants enable row level security;
alter table public.assessment_sessions          enable row level security;
alter table public.assessment_responses         enable row level security;
alter table public.assessment_skill_scores      enable row level security;
alter table public.assessment_results           enable row level security;

-- Curriculum: org members can read; staff/admin/owner can write
create policy "curriculum_read" on public.assessment_subjects
  for select using (
    exists (
      select 1 from public.accounts a
      where a.org_id = assessment_subjects.org_id
        and a.auth_user_id = auth.uid()
        and a.deleted_at is null
    )
  );

create policy "curriculum_write" on public.assessment_subjects
  for all using (
    exists (
      select 1 from public.accounts a
      where a.org_id = assessment_subjects.org_id
        and a.auth_user_id = auth.uid()
        and a.primary_role in ('staff','admin','owner')
        and a.deleted_at is null
    )
  );

create policy "domains_read" on public.assessment_domains
  for select using (
    exists (
      select 1 from public.accounts a
      where a.org_id = assessment_domains.org_id
        and a.auth_user_id = auth.uid()
        and a.deleted_at is null
    )
  );

create policy "domains_write" on public.assessment_domains
  for all using (
    exists (
      select 1 from public.accounts a
      where a.org_id = assessment_domains.org_id
        and a.auth_user_id = auth.uid()
        and a.primary_role in ('staff','admin','owner')
        and a.deleted_at is null
    )
  );

create policy "skills_read" on public.assessment_skills
  for select using (
    exists (
      select 1 from public.accounts a
      join public.assessment_domains d on d.id = assessment_skills.domain_id
      where a.org_id = d.org_id
        and a.auth_user_id = auth.uid()
        and a.deleted_at is null
    )
  );

create policy "skills_write" on public.assessment_skills
  for all using (
    exists (
      select 1 from public.accounts a
      join public.assessment_domains d on d.id = assessment_skills.domain_id
      where a.org_id = d.org_id
        and a.auth_user_id = auth.uid()
        and a.primary_role in ('staff','admin','owner')
        and a.deleted_at is null
    )
  );

create policy "skill_prerequisites_read" on public.assessment_skill_prerequisites
  for select using (true);

create policy "skill_prerequisites_write" on public.assessment_skill_prerequisites
  for all using (auth.role() = 'service_role');

create policy "skill_mastery_own" on public.assessment_skill_mastery
  for select using (
    profile_id in (
      select p.id from public.profiles p
      join public.accounts a on a.id = p.account_id
      where a.auth_user_id = auth.uid()
        and p.deleted_at is null
        and a.deleted_at is null
    )
  );

create policy "skill_mastery_staff" on public.assessment_skill_mastery
  for select using (
    exists (
      select 1 from public.accounts a
      where a.org_id = assessment_skill_mastery.org_id
        and a.auth_user_id = auth.uid()
        and a.primary_role in ('staff','admin','owner')
        and a.deleted_at is null
    )
  );

-- Items, tests, deliveries: org members read; staff/admin/owner write
create policy "items_read" on public.assessment_items
  for select using (
    exists (
      select 1 from public.accounts a
      where a.org_id = assessment_items.org_id
        and a.auth_user_id = auth.uid()
        and a.deleted_at is null
    )
  );

create policy "items_write" on public.assessment_items
  for all using (
    exists (
      select 1 from public.accounts a
      where a.org_id = assessment_items.org_id
        and a.auth_user_id = auth.uid()
        and a.primary_role in ('staff','admin','owner')
        and a.deleted_at is null
    )
  );

create policy "tests_read" on public.assessment_tests
  for select using (
    exists (
      select 1 from public.accounts a
      where a.org_id = assessment_tests.org_id
        and a.auth_user_id = auth.uid()
        and a.deleted_at is null
    )
  );

create policy "tests_write" on public.assessment_tests
  for all using (
    exists (
      select 1 from public.accounts a
      where a.org_id = assessment_tests.org_id
        and a.auth_user_id = auth.uid()
        and a.primary_role in ('staff','admin','owner')
        and a.deleted_at is null
    )
  );

create policy "test_sections_read" on public.assessment_test_sections
  for select using (auth.role() = 'authenticated');

create policy "test_sections_write" on public.assessment_test_sections
  for all using (auth.role() = 'service_role');

create policy "test_section_items_read" on public.assessment_test_section_items
  for select using (auth.role() = 'authenticated');

create policy "test_section_items_write" on public.assessment_test_section_items
  for all using (auth.role() = 'service_role');

create policy "test_skill_pools_read" on public.assessment_test_skill_pools
  for select using (auth.role() = 'authenticated');

create policy "test_skill_pools_write" on public.assessment_test_skill_pools
  for all using (auth.role() = 'service_role');

-- Deliveries: org members or public access_token
create policy "deliveries_read_org" on public.assessment_deliveries
  for select using (
    exists (
      select 1 from public.accounts a
      where a.org_id = assessment_deliveries.org_id
        and a.auth_user_id = auth.uid()
        and a.deleted_at is null
    )
  );

create policy "deliveries_read_public" on public.assessment_deliveries
  for select using (
    access_type = 'public' and access_token is not null and deleted_at is null
  );

create policy "deliveries_write" on public.assessment_deliveries
  for all using (auth.role() = 'service_role');

create policy "delivery_participants_read" on public.assessment_delivery_participants
  for select using (auth.role() in ('authenticated','service_role'));

create policy "delivery_participants_write" on public.assessment_delivery_participants
  for all using (auth.role() = 'service_role');

-- Sessions: own session or staff
create policy "sessions_own" on public.assessment_sessions
  for all using (
    profile_id in (
      select p.id from public.profiles p
      join public.accounts a on a.id = p.account_id
      where a.auth_user_id = auth.uid()
        and p.deleted_at is null and a.deleted_at is null
    )
    or auth.role() = 'service_role'
  );

create policy "sessions_staff" on public.assessment_sessions
  for select using (auth.role() = 'service_role');

create policy "responses_own" on public.assessment_responses
  for all using (
    session_id in (
      select s.id from public.assessment_sessions s
      join public.profiles p on p.id = s.profile_id
      join public.accounts a on a.id = p.account_id
      where a.auth_user_id = auth.uid()
        and p.deleted_at is null and a.deleted_at is null
    )
    or auth.role() = 'service_role'
  );

create policy "skill_scores_own" on public.assessment_skill_scores
  for select using (
    profile_id in (
      select p.id from public.profiles p
      join public.accounts a on a.id = p.account_id
      where a.auth_user_id = auth.uid()
        and p.deleted_at is null and a.deleted_at is null
    )
    or auth.role() = 'service_role'
  );

create policy "results_own" on public.assessment_results
  for select using (
    profile_id in (
      select p.id from public.profiles p
      join public.accounts a on a.id = p.account_id
      where a.auth_user_id = auth.uid()
        and p.deleted_at is null and a.deleted_at is null
    )
    or auth.role() = 'service_role'
  );

-- ---------------------------------------------------------------------------
-- 10. UPDATED_AT TRIGGERS
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger assessment_subjects_updated_at
  before update on public.assessment_subjects
  for each row execute function public.set_updated_at();

create trigger assessment_domains_updated_at
  before update on public.assessment_domains
  for each row execute function public.set_updated_at();

create trigger assessment_skills_updated_at
  before update on public.assessment_skills
  for each row execute function public.set_updated_at();

create trigger assessment_items_updated_at
  before update on public.assessment_items
  for each row execute function public.set_updated_at();

create trigger assessment_tests_updated_at
  before update on public.assessment_tests
  for each row execute function public.set_updated_at();

create trigger assessment_deliveries_updated_at
  before update on public.assessment_deliveries
  for each row execute function public.set_updated_at();

create trigger assessment_sessions_updated_at
  before update on public.assessment_sessions
  for each row execute function public.set_updated_at();

create trigger assessment_responses_updated_at
  before update on public.assessment_responses
  for each row execute function public.set_updated_at();

create trigger assessment_results_updated_at
  before update on public.assessment_results
  for each row execute function public.set_updated_at();
