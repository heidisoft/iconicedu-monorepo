create extension if not exists "pg_cron" with schema "pg_catalog";

create schema if not exists "pgmq";

create extension if not exists "pgmq" with schema "pgmq";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.account_created_by_current(_account_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.accounts a
    where a.id = _account_id
      and a.created_by = public.current_account_id()
      and a.deleted_at is null
  );
$function$
;

CREATE OR REPLACE FUNCTION public.current_org_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.org_id
  from public.accounts a
  where a.auth_user_id = auth.uid()
    and a.deleted_at is null
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION public.current_profile_kind()
 RETURNS public.profile_kind
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.kind
  from public.profiles p
  join public.accounts a on a.id = p.account_id
  where a.auth_user_id = auth.uid()
    and p.deleted_at is null
    and a.deleted_at is null
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION public.profile_account_id(_profile_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.account_id
  from public.profiles p
  where p.id = _profile_id
    and p.deleted_at is null
  limit 1
$function$
;

