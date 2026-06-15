-- This migration syncs storage trigger changes that were applied on the hosted
-- Supabase project. Both storage.prefixes and storage.protect_delete() were
-- introduced in a newer Supabase Storage version that older / preview
-- environments may not have yet. Every statement is guarded accordingly.

DO $$
BEGIN
  -- Drop old prefix-management triggers from storage.objects (if they exist)
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects'
      AND t.tgname = 'objects_delete_delete_prefix'
  ) THEN
    DROP TRIGGER "objects_delete_delete_prefix" ON "storage"."objects";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects'
      AND t.tgname = 'objects_insert_create_prefix'
  ) THEN
    DROP TRIGGER "objects_insert_create_prefix" ON "storage"."objects";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects'
      AND t.tgname = 'objects_update_create_prefix'
  ) THEN
    DROP TRIGGER "objects_update_create_prefix" ON "storage"."objects";
  END IF;

  -- Drop hierarchy triggers from storage.prefixes (table may not exist yet)
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'storage' AND tablename = 'prefixes'
  ) THEN
    DROP TRIGGER IF EXISTS "prefixes_create_hierarchy" ON "storage"."prefixes";
    DROP TRIGGER IF EXISTS "prefixes_delete_hierarchy" ON "storage"."prefixes";
  END IF;

  -- Create protect-delete triggers only if the backing function exists
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'storage' AND p.proname = 'protect_delete'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'storage' AND c.relname = 'buckets'
        AND t.tgname = 'protect_buckets_delete'
    ) THEN
      CREATE TRIGGER protect_buckets_delete
        BEFORE DELETE ON storage.buckets
        FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'storage' AND c.relname = 'objects'
        AND t.tgname = 'protect_objects_delete'
    ) THEN
      CREATE TRIGGER protect_objects_delete
        BEFORE DELETE ON storage.objects
        FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
    END IF;
  END IF;
END $$;
