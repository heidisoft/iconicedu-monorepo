create table public.org_subject_catalog (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  subject text not null,
  subject_key text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  constraint org_subject_catalog_subject_not_blank check (btrim(subject) <> ''),
  constraint org_subject_catalog_org_id_subject_key_key unique (org_id, subject_key)
);

create index org_subject_catalog_org_active_sort_idx
  on public.org_subject_catalog (org_id, is_active, sort_order, subject);

alter table public.org_subject_catalog enable row level security;

create policy "org members can read subject catalog"
  on public.org_subject_catalog
  for select
  using (
    deleted_at is null
    and public.is_org_member(org_id)
  );

create policy "org admins manage subject catalog"
  on public.org_subject_catalog
  for all
  using (
    deleted_at is null
    and public.is_org_admin(org_id)
  )
  with check (
    deleted_at is null
    and public.is_org_admin(org_id)
  );

create trigger set_updated_at_org_subject_catalog
  before update on public.org_subject_catalog
  for each row execute procedure public.set_updated_at();

with default_subjects(subject, sort_order) as (
  values
    ('Math', 10),
    ('English Language Arts', 20),
    ('Science', 30),
    ('Social Studies', 40),
    ('Computer Science', 50),
    ('Test Prep', 60),
    ('Study Skills', 70),
    ('Languages', 80),
    ('Arts', 90)
)
insert into public.org_subject_catalog (
  org_id,
  subject,
  subject_key,
  is_active,
  sort_order,
  created_at,
  updated_at
)
select
  orgs.id,
  defaults.subject,
  lower(regexp_replace(btrim(defaults.subject), '\s+', ' ', 'g')),
  true,
  defaults.sort_order,
  now(),
  now()
from public.orgs
cross join default_subjects as defaults
on conflict (org_id, subject_key) do update
set
  subject = excluded.subject,
  is_active = true,
  deleted_at = null,
  deleted_by = null,
  updated_at = now();

with discovered_subjects as (
  select
    org_id,
    regexp_replace(btrim(subject), '\s+', ' ', 'g') as subject,
    lower(regexp_replace(btrim(subject), '\s+', ' ', 'g')) as subject_key
  from (
    select org_id, subject
    from public.learning_spaces
    where deleted_at is null
      and subject is not null
      and btrim(subject) <> ''

    union all

    select org_id, subject
    from public.educator_profile_subjects
    where deleted_at is null
      and subject is not null
      and btrim(subject) <> ''
  ) as sources
),
deduped_subjects as (
  select distinct org_id, subject, subject_key
  from discovered_subjects
),
missing_subjects as (
  select
    discovered.org_id,
    discovered.subject,
    discovered.subject_key,
    row_number() over (
      partition by discovered.org_id
      order by discovered.subject
    ) as row_num
  from deduped_subjects as discovered
  left join public.org_subject_catalog existing
    on existing.org_id = discovered.org_id
   and existing.subject_key = discovered.subject_key
  where existing.id is null
),
org_offsets as (
  select org_id, coalesce(max(sort_order), 0) as max_sort_order
  from public.org_subject_catalog
  group by org_id
)
insert into public.org_subject_catalog (
  org_id,
  subject,
  subject_key,
  is_active,
  sort_order,
  created_at,
  updated_at
)
select
  missing.org_id,
  missing.subject,
  missing.subject_key,
  true,
  coalesce(offsets.max_sort_order, 0) + (missing.row_num * 10),
  now(),
  now()
from missing_subjects as missing
left join org_offsets as offsets
  on offsets.org_id = missing.org_id;
