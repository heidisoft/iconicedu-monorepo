# Database Guide

Overview of the IconicEdu database schema, migration workflow, and Supabase conventions.

The source of truth for the live schema is `supabase/migrations/`. The Prisma schema (`apps/api/prisma/schema.prisma`) mirrors it for the NestJS ORM layer.

---

## Table of Contents

- [Schema Overview](#schema-overview)
- [Key Relationships](#key-relationships)
- [Row Level Security](#row-level-security)
- [Migration Workflow](#migration-workflow)
- [Prisma and Supabase](#prisma-and-supabase)
- [Realtime](#realtime)
- [Storage](#storage)

---

## Schema Overview

### Identity and access

| Table           | Purpose                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| `organisations` | Top-level tenant. Every user belongs to one org.                                                               |
| `accounts`      | Platform account per user. Has `status` (active/invited/suspended/deleted), `role`, and links to `auth.users`. |
| `profiles`      | Display identity. An account can have multiple profiles (e.g. a guardian acting as both parent and advisor).   |

### Messaging

| Table             | Purpose                                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `channels`        | A conversation container. `type` discriminates DM, group channel, or learning space.                                                           |
| `channel_members` | Who belongs to which channel.                                                                                                                  |
| `messages`        | Message records. `type` discriminates the payload type (text, file, audio, etc.). No `content` column — payloads live in type-specific tables. |
| `message_text`    | Payload for `type = 'text'`. Stores the `payload` JSONB field.                                                                                 |
| `message_file`    | Payload for `type = 'file'`.                                                                                                                   |
| `message_audio`   | Payload for `type = 'audio-recording'`.                                                                                                        |
| `threads`         | Thread container tied to a parent message.                                                                                                     |
| `reactions`       | Per-message emoji reactions with profile ownership.                                                                                            |

### Education

| Table                  | Purpose                                     |
| ---------------------- | ------------------------------------------- |
| `classes`              | A class or course.                          |
| `class_enrolments`     | Student and educator membership in a class. |
| `sessions`             | Scheduled class sessions.                   |
| `assignments`          | Homework assignments for a class.           |
| `homework_submissions` | Student submissions against an assignment.  |

### Family and social

| Table                 | Purpose                                                  |
| --------------------- | -------------------------------------------------------- |
| `family_links`        | Guardian → child relationship.                           |
| `family_link_invites` | Invite flow for linking a guardian to a child's account. |

---

## Key Relationships

```
organisations
  └─ accounts (many)
       └─ profiles (many per account)

channels
  ├─ channel_members ──→ profiles
  └─ messages
       ├─ message_text     (type = 'text')
       ├─ message_file     (type = 'file')
       ├─ message_audio    (type = 'audio-recording')
       ├─ reactions
       └─ threads
            └─ messages (replies, same table, thread_id FK)

classes
  ├─ class_enrolments ──→ profiles
  ├─ sessions
  └─ assignments
       └─ homework_submissions ──→ profiles
```

---

## Row Level Security

RLS is enabled on **every table**. There is no open access — all queries are filtered by the authenticated user's identity and role.

### Core pattern

Policies use `auth.uid()` to identify the current user and join through `accounts` or `profiles` to enforce role-based visibility:

```sql
-- Example: users can only read messages in channels they are members of
CREATE POLICY "channel_members_can_read_messages"
  ON public.messages FOR SELECT
  USING (
    channel_id IN (
      SELECT channel_id FROM public.channel_members
      WHERE profile_id IN (
        SELECT id FROM public.profiles
        WHERE account_id IN (
          SELECT id FROM public.accounts WHERE auth_user_id = auth.uid()
        )
      )
    )
  );
```

### Role-based policies

The `accounts.role` field drives additional visibility:

| Role       | Typical access                              |
| ---------- | ------------------------------------------- |
| `guardian` | Own data + children's data via family links |
| `educator` | Own data + enrolled students' data          |
| `student`  | Own data                                    |
| `advisor`  | Assigned families' data                     |
| `staff`    | Broad read access for admin operations      |

### Service role bypass

The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely. It is only used server-side (NestJS API, Next.js Server Actions). Never pass it to client-side code or mobile apps.

### Testing RLS

Use the Supabase dashboard → Authentication → Policies to verify policies. For automated testing, use the local Supabase instance with `supabase db reset` and write SQL tests against specific user identities.

---

## Migration Workflow

### Directory structure

```
supabase/migrations/
├── 20260102000100_vm_schema.sql           # Core schema
├── 20260102000200_001_helpers.sql
├── 20260102000201_002_rls_policies.sql
├── 20260102000202_003_constraints_indexes.sql
├── 20260102000203_004_triggers_audit.sql
├── ...
└── 20260222200000_023_channel_ui_defaults_json.sql
```

Files are applied in **alphabetical (timestamp) order**. The prefix timestamp determines the sequence.

### Creating a migration

```bash
# Creates supabase/migrations/<timestamp>_<name>.sql
supabase migration new <descriptive-name>
```

Use a short, descriptive name in snake_case. Examples:

- `add_avatar_url_to_profiles`
- `add_rls_policy_for_advisor_channels`
- `drop_deprecated_content_column`

### Writing migrations

Follow these conventions:

```sql
-- Use IF NOT EXISTS / IF EXISTS guards for safety
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Add RLS policy in the same migration as the column
CREATE POLICY "users_can_read_own_avatar_url"
  ON public.profiles FOR SELECT
  USING (account_id IN (
    SELECT id FROM public.accounts WHERE auth_user_id = auth.uid()
  ));

-- Add indexes for foreign keys and filtered columns
CREATE INDEX IF NOT EXISTS idx_profiles_account_id
  ON public.profiles (account_id);

-- Comment non-obvious columns
COMMENT ON COLUMN public.profiles.avatar_url IS
  'URL to the profile picture stored in Supabase Storage avatars bucket';
```

### Testing migrations

Always test against a fresh local database before committing:

```bash
# Full reset — drops DB, recreates, applies all migrations in order
supabase db reset

# Verify in local Studio
open http://localhost:54323
```

For incremental testing (applying only new migrations):

```bash
supabase migration up
```

### Applying to production

```bash
supabase link --project-ref <production-ref>
supabase db push
```

`db push` applies only the migrations that have not yet been applied to the target project.

### Rollbacks

Supabase migrations are forward-only. To "roll back", write a new migration that reverses the change:

```sql
-- If you added a column and need to remove it:
ALTER TABLE public.profiles DROP COLUMN IF EXISTS avatar_url;
```

---

## Prisma and Supabase

The NestJS API uses Prisma as a type-safe ORM layer on top of the same Supabase Postgres database.

**Supabase migrations** (`supabase/migrations/`) are the source of truth for the schema.
**Prisma schema** (`apps/api/prisma/schema.prisma`) reflects the tables the API needs to query.

When you add a Supabase migration that the API needs access to:

1. Add the new table/column to `apps/api/prisma/schema.prisma`
2. Regenerate the Prisma client: `pnpm --filter api db:generate`
3. Commit both the `.sql` migration file and the Prisma schema change together

Do not run `prisma migrate dev` against the Supabase database — it creates its own `_prisma_migrations` table that conflicts with Supabase's migration tracking. Use `prisma generate` (generates TypeScript types) and `prisma db pull` (introspects the live schema) only.

---

## Realtime

Supabase Realtime is used in the mobile app for live message updates. It is enabled selectively:

```sql
-- In supabase/migrations/20260201000200_enable_messages_realtime.sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
```

Only tables explicitly added to the `supabase_realtime` publication receive change events. Do not add tables with sensitive data (e.g. `accounts`, `family_links`) to Realtime unless you have confirmed the RLS policies are sufficient.

Mobile subscription pattern — see `apps/mobile/src/hooks/use-messages.ts`.

---

## Storage

Supabase Storage is used for:

| Bucket     | Contents                      | Access                           |
| ---------- | ----------------------------- | -------------------------------- |
| `avatars`  | Profile pictures              | Public read, authenticated write |
| `homework` | Student homework file uploads | Private, owner + educator        |

Storage policies mirror the RLS logic but apply to file paths. See `supabase/migrations/*_storage_avatar_policies*.sql` for examples.

File uploads from the mobile app use the Supabase Storage JS client. Direct browser uploads from web use signed URLs generated server-side to avoid exposing the service role key.
