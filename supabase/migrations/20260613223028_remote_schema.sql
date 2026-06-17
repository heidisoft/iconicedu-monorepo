drop trigger if exists "objects_delete_delete_prefix" on "storage"."objects";

drop trigger if exists "objects_insert_create_prefix" on "storage"."objects";

drop trigger if exists "objects_update_create_prefix" on "storage"."objects";

drop trigger if exists "prefixes_create_hierarchy" on "storage"."prefixes";

drop trigger if exists "prefixes_delete_hierarchy" on "storage"."prefixes";

-- storage.protect_delete() only exists in managed Supabase (cloud), not local Docker.
-- Skip these triggers locally to allow db reset to succeed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'storage' AND p.proname = 'protect_delete'
  ) THEN
    CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
    CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
  END IF;
END $$;
