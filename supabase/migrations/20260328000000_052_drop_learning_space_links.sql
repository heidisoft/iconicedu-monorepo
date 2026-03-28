drop policy if exists "org members can read learning space links"
  on public.learning_space_links;
drop policy if exists "org members can write learning space links"
  on public.learning_space_links;
drop policy if exists "learning space links select by participant or manager"
  on public.learning_space_links;
drop policy if exists "learning space links all by manager"
  on public.learning_space_links;

drop trigger if exists set_updated_at_learning_space_links
  on public.learning_space_links;
drop trigger if exists set_created_by_learning_space_links
  on public.learning_space_links;
drop trigger if exists set_updated_by_learning_space_links
  on public.learning_space_links;

drop table if exists public.learning_space_links;
drop type if exists public.learning_space_link_status;
