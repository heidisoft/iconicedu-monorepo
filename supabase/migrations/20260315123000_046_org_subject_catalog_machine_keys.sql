update public.org_subject_catalog
set subject_key = regexp_replace(
  regexp_replace(
    regexp_replace(lower(btrim(subject_key)), '[^a-z0-9]+', '-', 'g'),
    '-{2,}',
    '-',
    'g'
  ),
  '(^-+|-+$)',
  '',
  'g'
)
where subject_key is not null;

alter table public.org_subject_catalog
  add constraint org_subject_catalog_subject_key_machine_name
  check (subject_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
