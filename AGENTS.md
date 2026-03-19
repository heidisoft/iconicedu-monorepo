# AGENTS.md - IconicEdu Monorepo Architecture Guide

**Last Updated:** 2026-03-13
**Purpose:** Comprehensive guide for AI agents and developers to understand the IconicEdu codebase architecture, domain models, and TypeScript interfaces.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Tech Stack](#tech-stack)
4. [Domain Model](#domain-model)
5. [Type System Architecture](#type-system-architecture)
6. [Key TypeScript Interfaces](#key-typescript-interfaces)
7. [Architecture Patterns](#architecture-patterns)
8. [Key Directories & Files](#key-directories--files)
9. [Data Flow](#data-flow)
10. [Development Guidelines](#development-guidelines)

---

## 📝 Project Overview

**IconicEdu** is a communication-first education platform that connects guardians, educators, children, advisors, and staff through:

- Modern chat & messaging with channels and threads
- Learning spaces (one-on-one, small group, large class)
- Class scheduling and calendar management
- Homework workflows and progress tracking
- Parent advisor support
- Multi-role dashboards
- Cross-platform support (Web, Mobile, API)

The platform emphasizes real-time communication, collaboration, and educational progress tracking.

---

## 🏗️ Monorepo Structure

```
iconicedu-monorepo/
├── apps/
│   ├── web/           # Next.js 15 web application (App Router)
│   ├── mobile/        # Expo/React Native mobile app
│   └── api/           # NestJS backend API
│
├── packages/
│   ├── shared-types/  # Shared TypeScript types (rows, VMs, payloads)
│   ├── ui-web/        # Web UI component library (React + Tailwind)
│   ├── ui-native/     # Native UI component library (React Native + NativeWind)
│   ├── utils/         # Shared utility functions
│   ├── config-eslint/ # Shared ESLint configuration
│   └── config-tsconfig/ # Shared TypeScript configuration
│
├── supabase/          # Database schema, migrations, RLS policies
├── turbo.json         # Turborepo configuration
├── pnpm-workspace.yaml # pnpm workspace configuration
└── package.json       # Root package.json
```

### Apps Overview

#### 1. **web** (Next.js 15)

- **Location:** `/apps/web/`
- **Framework:** Next.js 15 with App Router
- **Styling:** Tailwind CSS
- **Key Features:**
  - Server-side rendering
  - Supabase SSR authentication
  - Real-time messaging with Supabase Realtime
  - React Query for data fetching
  - Route groups: `(app)`, `(auth)`, `(marketing)`

#### 2. **mobile** (Expo/React Native)

- **Location:** `/apps/mobile/`
- **Framework:** Expo with React Native
- **Styling:** NativeWind (Tailwind for React Native)
- **Key Features:**
  - Cross-platform (iOS & Android)
  - Shared UI components with web via `ui-native`
  - Native navigation

#### 3. **api** (NestJS)

- **Location:** `/apps/api/`
- **Framework:** NestJS 10
- **Database:** Prisma ORM with Supabase Postgres
- **Key Features:**
  - RESTful API
  - Swagger documentation
  - JWT authentication
  - Modular architecture

### Packages Overview

#### 1. **shared-types**

- **Location:** `/packages/shared-types/`
- **Purpose:** Centralized TypeScript type definitions
- **Structure:**
  - `rows/` - Database row types (direct table mappings)
  - `vm/` - View Model types (business logic layer)
  - `payloads/` - Data transfer objects
  - `shared/` - Shared utility types

#### 2. **ui-web** & **ui-native**

- **Location:** `/packages/ui-web/`, `/packages/ui-native/`
- **Purpose:** Platform-specific UI component libraries
- **Key Components:**
  - Message components (text, image, file, etc.)
  - Form components
  - Layout components
  - Panels and sidebars

---

## 🛠️ Tech Stack

### Frontend

| Technology          | Purpose                    | Location                              |
| ------------------- | -------------------------- | ------------------------------------- |
| **Next.js 15**      | Web framework (App Router) | `apps/web/`                           |
| **Expo**            | Mobile framework           | `apps/mobile/`                        |
| **React 19**        | UI library                 | All frontend                          |
| **Tailwind CSS**    | Web styling                | `apps/web/`, `packages/ui-web/`       |
| **NativeWind**      | Mobile styling             | `apps/mobile/`, `packages/ui-native/` |
| **React Query**     | Data fetching & caching    | `apps/web/`                           |
| **Supabase Client** | Auth, Realtime, Storage    | Frontend apps                         |

### Backend

| Technology            | Purpose                 | Location    |
| --------------------- | ----------------------- | ----------- |
| **NestJS 10**         | API framework           | `apps/api/` |
| **Prisma**            | ORM                     | `apps/api/` |
| **Supabase Postgres** | Database                | Cloud/Local |
| **Supabase Auth**     | Authentication          | Cloud/Local |
| **Supabase Storage**  | File storage            | Cloud/Local |
| **Supabase Realtime** | Real-time subscriptions | Cloud/Local |

### Package Management

| Technology          | Purpose                      |
| ------------------- | ---------------------------- |
| **pnpm 9.12.0**     | Package manager              |
| **Turborepo**       | Monorepo build orchestration |
| **TypeScript 5.9**  | Type system                  |
| **Node.js 20.18.1** | Runtime                      |

---

## 🎯 Domain Model

The IconicEdu platform is built around these core domain entities:

### 1. **User Profiles**

User profiles are polymorphic, with a base profile and role-specific extensions:

- **ProfileRow** (base)
  - `id`, `org_id`, `account_id`
  - `kind`: `'educator' | 'guardian' | 'child' | 'staff' | 'system'`
  - Common fields: `display_name`, `first_name`, `last_name`, `bio`, `avatar_*`, `timezone`, etc.

- **EducatorProfileRow**
  - Extends profile with educator-specific fields
  - `headline`, `education`, `experience_years`, `certifications`
  - `average_rating`, `total_reviews`
  - Related: subjects, grade levels, curriculum tags, badges

- **GuardianProfileRow**
  - Extends profile with guardian-specific fields
  - `joined_date`, `session_notes_visibility`
  - Related: family links to children

- **ChildProfileRow**
  - Extends profile with child-specific fields
  - `birth_year`, `school_name`, `school_year`
  - `interests`, `strengths`, `learning_preferences`, `motivation_styles`

- **StaffProfileRow**
  - Extends profile with staff-specific fields
  - `department`, `job_title`, `working_hours_schedule`

### 2. **Messages**

Messages are the core communication primitive:

- **MessageRow** (base message)
  - `id`, `org_id`, `channel_id`, `sender_profile_id`
  - `type`: Discriminator for message payload type
  - `visibility_type`: `'all' | 'sender-only' | 'recipient-only' | 'specific-users'`
  - `is_edited`, `is_saved`, `is_hidden`
  - `thread_id`, `thread_parent_id`: Threading support

- **Message Type Extensions** (separate tables)
  - `MessageTextRow`: Plain text messages
  - `MessageImageRow`: Image attachments
  - `MessageFileRow`: File attachments
  - `MessageDesignFileUpdateRow`: Design file updates (Figma, Sketch, etc.)
  - `MessagePaymentReminderRow`: Payment reminders
  - `MessageEventReminderRow`: Event/calendar reminders
  - `MessageFeedbackRequestRow`: Feedback requests
  - `MessageLessonAssignmentRow`: Homework assignments
  - `MessageProgressUpdateRow`: Student progress updates
  - `MessageSessionBookingRow`: Session scheduling
  - `MessageSessionCompleteRow`: Session completion
  - `MessageSessionSummaryRow`: Session summaries
  - `MessageHomeworkSubmissionRow`: Homework submissions
  - `MessageLinkPreviewRow`: Link previews with metadata
  - `MessageAudioRecordingRow`: Voice messages

- **Message Social Features**
  - `MessageReactionRow`: Emoji reactions (per user)
  - `MessageReactionCountRow`: Aggregated reaction counts
  - `ThreadRow`: Thread metadata
  - `ThreadParticipantRow`: Thread participation tracking
  - `ThreadReadStateRow`: Thread read status per user

### 3. **Channels**

Channels are communication spaces:

- **ChannelRow**
  - `id`, `org_id`
  - `kind`: Channel type
  - `topic`, `description`, `icon_key`
  - `visibility`: Public/private
  - `purpose`: Channel purpose/category
  - `dm_key`: Direct message identifier (for DMs)
  - `posting_policy_kind`: Who can post
  - `allow_threads`, `allow_reactions`: Feature flags
  - `primary_entity_kind`, `primary_entity_id`: Linked entity (e.g., learning space)

- **ChannelMemberRow**
  - Channel membership tracking
  - `role_in_channel`: Member role in this channel

- **ChannelReadStateRow**
  - Read status per user per channel
  - `last_read_message_id`, `last_read_at`, `unread_count`

- **ChannelFileRow** & **ChannelMediaRow**
  - File and media attachments in channels

### 4. **Learning Spaces**

Learning spaces are educational contexts:

- **LearningSpaceRow**
  - `id`, `org_id`
  - `kind`: `'one_on_one' | 'small_group' | 'large_class'`
  - `status`: `'active' | 'archived' | 'completed' | 'paused'`
  - `title`, `subject`, `description`, `icon_key`

- **LearningSpaceParticipantRow**
  - Links profiles to learning spaces

- **LearningSpaceChannelRow**
  - Links channels to learning spaces
  - `is_primary`: Designates the primary channel

- **LearningSpaceLinkRow**
  - External links/resources for the learning space

### 5. **Organizations & Families**

- **OrgRow**: Multi-tenancy support
- **FamilyRow**: Family grouping
- **FamilyLinkRow**: Links guardians to children
- **FamilyLinkInviteRow**: Pending family invitations

### 6. **Scheduling**

- **ClassScheduleRow**: Class scheduling information
- **EducatorAvailabilityRow**: Educator availability settings

### 7. **Activity & Presence**

- **ActivityFeedRow**: Activity feed events
- **ProfilePresenceRow**: User presence status (online/offline/etc.)

---

## 🏛️ Type System Architecture

The type system is organized into **three layers**, creating a clear separation of concerns:

### Layer 1: **Row Types** (`packages/shared-types/src/rows/`)

**Purpose:** Direct database table mappings
**Naming Convention:** `{Entity}Row`
**Usage:** Database queries, ORM results, Supabase responses

**Characteristics:**

- 1:1 mapping with database tables
- All fields nullable as they come from the database
- UUID and ISODateTime string types
- Audit fields: `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`
- Used in Supabase queries and Prisma schemas

**Example:**

```typescript
export interface MessageRow {
  id: UUID;
  org_id: UUID;
  channel_id: UUID;
  sender_profile_id: UUID;
  type: string;
  created_at: ISODateTime;
  visibility_type: string;
  thread_id?: UUID | null;
  thread_parent_id?: UUID | null;
  // ... audit fields
}
```

### Layer 2: **View Model Types** (`packages/shared-types/src/vm/`)

**Purpose:** Business logic layer for UI consumption
**Naming Convention:** `{Entity}VM`
**Usage:** React components, API responses, UI state

**Characteristics:**

- Structured for UI consumption (grouped fields)
- Denormalized (includes related entities)
- Type-safe discriminated unions
- Non-nullable where business logic requires
- Includes computed/derived fields
- Optimized for component props

**Example:**

```typescript
export interface MessageVM {
  ids: IdsBaseVM; // { id, orgId }

  core: MessageCoreVM; // type, sender, createdAt, visibility

  social: MessageSocialVM; // reactions, thread

  state?: MessageStateVM; // isEdited, editedAt, isSaved, isHidden

  // Type-specific fields based on message type
  content?: { text?: string };
  attachment?: AttachmentVM;
  payment?: PaymentDetailsVM;
  // ... etc
}
```

**Discriminated Union Pattern:**

```typescript
export type MessageVM =
  | TextMessageVM
  | ImageMessageVM
  | FileMessageVM
  | DesignFileUpdateMessageVM
  | PaymentReminderMessageVM
  // ... 15 message types total

// Type narrowing via discriminator
function renderMessage(message: MessageVM) {
  switch (message.core.type) {
    case 'text':
      return <TextMessage message={message} />; // Type is narrowed to TextMessageVM
    case 'image':
      return <ImageMessage message={message} />; // Type is narrowed to ImageMessageVM
    // ...
  }
}
```

### Layer 3: **Payload Types** (`packages/shared-types/src/payloads/`)

**Purpose:** Data transfer objects for mutations
**Naming Convention:** `{Action}{Entity}Payload` or `{Entity}SaveInput`
**Usage:** Form submissions, API mutations, create/update operations

**Characteristics:**

- Optimized for input (creation/updates)
- Only includes fields that can be set by user
- Validation-ready
- Optional fields marked appropriately

**Example:**

```typescript
export type EducatorProfileSaveInput = {
  profileId: UUID;
  orgId: UUID;
  headline?: string | null;
  subjects?: string[] | null;
  gradeLevels?: EducatorGradeEntry[] | null;
  // ... only settable fields
};
```

### Layer 4: **Shared Types** (`packages/shared-types/src/shared/`)

**Purpose:** Common utility types used across all layers
**Examples:**

- `UUID`, `ISODateTime`, `IANATimezone`
- `ConnectionVM<T>`: Pagination wrapper
- `IdsBaseVM`: Common ID fields
- Enums: `AccountStatus`, `ThemeKey`, `FamilyRelation`, etc.

---

## 🔑 Key TypeScript Interfaces

### Core Entities

#### User Profile (Polymorphic)

```typescript
// Base profile (all users have this)
export interface BaseUserProfileVM {
  ids: Omit<IdsBaseVM, 'accountId'> & { accountId: UUID };
  profile: UserProfileBlockVM; // displayName, email, bio, avatar
  prefs: UserPrefsVM; // timezone, locale, languages
  presence?: PresenceVM | null; // online status
  status?: AccountStatus; // active, invited, suspended, deleted
  location?: UserLocationVM; // address info
  internal?: UserInternalVM; // internal notes, lead source
  meta: UserMetaVM; // createdAt, updatedAt
  ui?: UserUiVM; // theme preferences
}

// Educator-specific
export interface EducatorProfileVM extends BaseUserProfileVM {
  kind: 'educator';
  headline?: string | null;
  subjects?: string[] | null;
  gradesSupported?: GradeLevel[] | null;
  education?: string | null;
  experienceYears?: number | null;
  certifications?: Array<{ name: string; issuer?: string; year?: number }> | null;
  joinedDate: ISODateTime;
  ageGroupsComfortableWith?: string[] | null;
  identityVerificationStatus?: 'unverified' | 'pending' | 'verified' | null;
  curriculumTags?: string[] | null;
  badges?: string[] | null;
  availability?: EducatorAvailabilityVM | null;
  averageRating?: number | null;
  totalReviews?: number | null;
  featuredVideoIntroUrl?: string | null;
}

// Union type for all profiles
export type UserProfileVM =
  | EducatorProfileVM
  | GuardianProfileVM
  | ChildProfileVM
  | StaffProfileVM
  | SystemProfileVM;
```

#### Messages (Discriminated Union)

```typescript
// Base structure (all messages)
interface BaseMessageVM {
  ids: IdsBaseVM;
  core: MessageCoreVM; // type, sender, createdAt, visibility
  social: MessageSocialVM; // reactions, thread
  state?: MessageStateVM; // isEdited, isSaved, isHidden
}

// Specific message types
export interface TextMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'text' };
  content: { text: string };
}

export interface ImageMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'image' };
  content?: { text?: string };
  attachment: ImageAttachmentVM;
}

export interface PaymentReminderMessageVM extends BaseMessageVM {
  core: MessageCoreVM & { type: 'payment-reminder' };
  content: { text: string };
  payment: {
    amount: number;
    currency: string;
    dueAt: ISODateTime;
    status: 'pending' | 'paid' | 'overdue';
    invoiceId?: string;
    description?: string;
  };
}

// ... 15 total message types
```

#### Channels

```typescript
export interface ChannelVM {
  ids: IdsBaseVM;

  basics: {
    kind: ChannelKindVM;
    topic: string;
    description?: string | null;
    iconKey?: string | null;
  };

  settings: {
    visibility: 'public' | 'private';
    purpose: string;
    postingPolicy?: string | null;
    allowThreads: boolean;
    allowReactions: boolean;
  };

  entity?: {
    kind: string;
    id: UUID;
  } | null;

  members?: ConnectionVM<ChannelMemberVM>;

  readState?: ChannelReadStateVM;

  lifecycle: {
    createdAt: ISODateTime;
    createdByProfileId: UUID;
    archivedAt?: ISODateTime | null;
  };
}
```

#### Learning Spaces

```typescript
export interface LearningSpaceVM {
  ids: IdsBaseVM;

  basics: {
    kind: 'one_on_one' | 'small_group' | 'large_class';
    status: 'active' | 'archived' | 'completed' | 'paused';
    title: string;
    iconKey: string | null;
    subject?: string | null;
    description?: string | null;
  };

  channels: {
    primaryChannel: ChannelVM;
    relatedChannels?: ChannelVM[];
  };

  schedule?: {
    scheduleSeries?: ClassScheduleVM | null;
  };

  resources?: {
    links?: LearningSpaceLinkVM[] | null;
  };

  lifecycle: {
    createdAt: ISODateTime;
    createdBy: UUID;
    archivedAt?: ISODateTime | null;
  };

  participants: UserProfileVM[];
}
```

#### Threads

```typescript
export interface ThreadVM {
  ids: IdsBaseVM;

  parent: {
    messageId: UUID;
    snippet?: string | null;
    authorId?: UUID | null;
    authorName?: string | null;
  };

  stats: {
    messageCount: number;
    lastReplyAt: ISODateTime;
  };

  participants: UserProfileVM[];

  readState?: ThreadReadStateVM;
}
```

### Shared Utility Types

```typescript
// Pagination wrapper
export interface ConnectionVM<T> {
  items: T[];
  nextCursor?: string | null;
  total?: number | null;
}

// Common IDs
export interface IdsBaseVM {
  id: UUID;
  orgId: UUID;
}

// Entity references (for polymorphic associations)
export type EntityRefVM =
  | { kind: 'learning_space'; id: UUID }
  | { kind: 'session'; id: UUID }
  | { kind: 'homework'; id: UUID }
  | { kind: 'message'; id: UUID }
  | { kind: 'user'; id: UUID };
// ... etc
```

---

## 🏗️ Architecture Patterns

### 1. **Builder Pattern**

Location: `/apps/web/lib/messages/builders/`

The builder pattern transforms database rows into view models:

```typescript
// message.builder.ts
export function buildMessageVM(
  messageRow: MessageRow,
  sender: UserProfileVM,
  payloadRow: MessagePayloadRow,
  reactions: ReactionVM[],
  thread?: ThreadVM,
): MessageVM {
  const core: MessageCoreVM = {
    type: messageRow.type as MessageTypeVM,
    sender,
    createdAt: messageRow.created_at,
    visibility: buildVisibility(messageRow),
  };

  const social: MessageSocialVM = {
    reactions,
    thread,
  };

  // Type-specific construction based on messageRow.type
  switch (messageRow.type) {
    case 'text':
      return {
        ids: { id: messageRow.id, orgId: messageRow.org_id },
        core: { ...core, type: 'text' },
        social,
        content: { text: payloadRow.text },
      };
    // ... handle all message types
  }
}
```

### 2. **Mapper Pattern**

Location: `/apps/web/lib/messages/mappers/`

Mappers convert between row types and view models:

```typescript
// message.mapper.ts
export class MessageMapper {
  static toVM(messageRow: MessageRow, options: MessageMapperOptions): MessageVM {
    // Fetch related data
    const sender = this.getSenderProfile(messageRow.sender_profile_id);
    const payload = this.getPayload(messageRow.id, messageRow.type);
    const reactions = this.getReactions(messageRow.id);
    const thread = messageRow.thread_id
      ? this.getThread(messageRow.thread_id)
      : undefined;

    // Build the VM
    return buildMessageVM(messageRow, sender, payload, reactions, thread);
  }
}
```

### 3. **Query Pattern**

Location: `/apps/web/lib/messages/queries/`

Centralized database queries using Supabase:

```typescript
// messages.query.ts
export async function getChannelMessages(
  supabase: SupabaseClient,
  channelId: string,
  options?: PaginationOptions,
) {
  const query = supabase
    .from('messages')
    .select(
      `
      *,
      sender:profiles!sender_profile_id(*),
      reactions:message_reactions(*)
    `,
    )
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 50);

  const { data, error } = await query;

  if (error) throw error;

  return data.map((row) => MessageMapper.toVM(row));
}
```

### 4. **Realtime Client Pattern**

Location: `/apps/web/lib/messages/realtime/`

Supabase Realtime subscription management:

```typescript
// supabase-messages-realtime-client.ts
export class SupabaseMessagesRealtimeClient {
  private channel: RealtimeChannel;

  constructor(
    private supabase: SupabaseClient,
    private channelId: string,
    private handlers: MessageRealtimeHandlers,
  ) {}

  subscribe() {
    this.channel = this.supabase
      .channel(`channel:${this.channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${this.channelId}`,
        },
        (payload) => this.handlers.onMessageInsert(payload.new),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${this.channelId}`,
        },
        (payload) => this.handlers.onMessageUpdate(payload.new),
      )
      .subscribe();
  }

  unsubscribe() {
    this.channel.unsubscribe();
  }
}
```

### 5. **Server Actions Pattern** (Next.js)

Location: `/apps/web/app/actions/`

Next.js server actions for mutations:

```typescript
// messages.ts
'use server';

import { createServerClient } from '@/lib/supabase/server';

export async function sendMessage(
  channelId: string,
  content: string,
  type: MessageTypeVM = 'text',
) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      channel_id: channelId,
      sender_profile_id: user.id,
      type,
      visibility_type: 'all',
    })
    .select()
    .single();

  if (error) throw error;

  // Insert type-specific payload
  await supabase.from('message_text').insert({
    message_id: data.id,
    org_id: data.org_id,
    payload: { text: content },
  });

  return data;
}
```

### 6. **Utility Functions Pattern**

Location: `/packages/ui-web/src/components/messages/*.utils.ts`

Pure utility functions for business logic:

```typescript
// message-list.utils.ts
export function groupMessagesByDate(messages: MessageVM[]): GroupedMessages {
  const groups = new Map<string, MessageVM[]>();

  messages.forEach((message) => {
    const dateKey = format(new Date(message.core.createdAt), 'yyyy-MM-dd');
    const group = groups.get(dateKey) ?? [];
    group.push(message);
    groups.set(dateKey, group);
  });

  return Array.from(groups.entries()).map(([date, messages]) => ({
    date,
    messages,
  }));
}

export function shouldShowDateDivider(current: MessageVM, previous?: MessageVM): boolean {
  if (!previous) return true;

  const currentDate = new Date(current.core.createdAt);
  const previousDate = new Date(previous.core.createdAt);

  return !isSameDay(currentDate, previousDate);
}
```

---

## 📂 Key Directories & Files

### Web App (`apps/web/`)

```
apps/web/
├── app/
│   ├── (app)/              # Authenticated app routes
│   │   └── [orgSlug]/      # Organization-scoped routes
│   ├── (auth)/             # Authentication routes (login, signup)
│   ├── (marketing)/        # Public marketing pages
│   ├── actions/            # Next.js server actions
│   ├── api/                # API routes
│   └── layout.tsx          # Root layout
│
├── lib/
│   ├── messages/           # Message domain logic
│   │   ├── builders/       # Row → VM builders
│   │   ├── mappers/        # Data mappers
│   │   ├── queries/        # Database queries
│   │   └── realtime/       # Realtime subscriptions
│   │
│   ├── sidebar/            # Sidebar logic
│   ├── supabase/           # Supabase clients (server, client)
│   └── utils/              # Utility functions
│
└── components/             # Page-specific components
```

### Shared Types (`packages/shared-types/`)

```
packages/shared-types/
├── src/
│   ├── rows/               # Database row types
│   │   ├── message.ts
│   │   ├── profile.ts
│   │   ├── channel.ts
│   │   ├── learning-space.ts
│   │   └── index.ts
│   │
│   ├── vm/                 # View model types
│   │   ├── message.ts
│   │   ├── profile.ts
│   │   ├── channel.ts
│   │   ├── learning-space.ts
│   │   └── index.ts
│   │
│   ├── payloads/           # Payload/input types
│   │   ├── learning-space.ts
│   │   └── channel.ts
│   │
│   ├── shared/             # Shared utility types
│   │   ├── shared.ts       # UUID, ISODateTime, ConnectionVM, etc.
│   │   ├── grades.ts       # Grade level types
│   │   ├── availability.ts
│   │   └── messages-realtime.ts
│   │
│   └── index.ts            # Re-exports all types
│
├── package.json
└── tsconfig.json
```

### UI Web (`packages/ui-web/`)

```
packages/ui-web/
├── src/
│   ├── components/
│   │   ├── messages/
│   │   │   ├── message-types/      # Message component renderers
│   │   │   │   ├── text-message.tsx
│   │   │   │   ├── image-message.tsx
│   │   │   │   ├── payment-reminder-message.tsx
│   │   │   │   └── ... (15 message types)
│   │   │   │
│   │   │   ├── panels/
│   │   │   │   └── thread-panel.tsx
│   │   │   │
│   │   │   ├── message-list.tsx
│   │   │   ├── message-list.utils.ts
│   │   │   ├── thread-reply.utils.ts
│   │   │   └── ...
│   │   │
│   │   ├── forms/
│   │   ├── layout/
│   │   └── ...
│   │
│   └── hooks/
│       └── use-messages.ts
│
├── package.json
└── tsconfig.json
```

### API (`apps/api/`)

```
apps/api/
├── src/
│   ├── modules/            # NestJS modules
│   │   ├── auth/
│   │   ├── messages/
│   │   ├── profiles/
│   │   └── ...
│   │
│   ├── prisma/             # Prisma schema & client
│   │   └── schema.prisma
│   │
│   ├── app.module.ts
│   └── main.ts
│
├── package.json
└── tsconfig.json
```

---

## 🔄 Data Flow

### Example: Sending a Text Message

```
1. User types message in UI
   ↓
2. Component calls server action
   └─> sendMessage(channelId, content, 'text')

3. Server action (Next.js)
   ├─> Authenticate user
   ├─> Insert into 'messages' table
   ├─> Insert into 'message_text' table (payload)
   └─> Return new message row

4. Supabase Realtime broadcasts INSERT event
   ↓
5. All subscribed clients receive event
   └─> SupabaseMessagesRealtimeClient.onMessageInsert()

6. Client updates React Query cache
   └─> useMessages hook triggers re-render

7. UI displays new message
   └─> MessageList → TextMessage component
```

### Example: Loading Channel Messages

```
1. User navigates to channel page
   ↓
2. useMessages hook triggers
   └─> React Query: queryFn = getChannelMessages(channelId)

3. getChannelMessages executes
   ├─> Supabase query with joins
   ├─> Returns MessageRow[]
   └─> Maps to MessageVM[] via MessageMapper

4. React Query caches result
   ↓
5. Component receives MessageVM[]
   └─> Renders MessageList
       └─> Maps over messages
           └─> Renders appropriate message type component
               (TextMessage, ImageMessage, etc.)
```

### Type Flow Example

```
Database Row (PostgreSQL)
  ↓ Supabase Client
MessageRow (from query)
  ↓ MessageMapper.toVM()
  ├─> Fetch sender ProfileRow → map to UserProfileVM
  ├─> Fetch payload row → extract content
  ├─> Fetch reactions → map to ReactionVM[]
  └─> Build MessageVM
      ↓
MessageVM (for component)
  ↓ Pattern matching on message.core.type
TextMessageVM | ImageMessageVM | ... (narrowed type)
  ↓ Component prop
<TextMessage message={message} />
```

---

## 💡 Development Guidelines

### Working with Types

1. **Always import from `@iconicedu/shared-types`**

   ```typescript
   import type { MessageVM, UserProfileVM } from '@iconicedu/shared-types';
   ```

2. **Use Row types for database operations**

   ```typescript
   const { data } = await supabase.from('messages').select('*').single();
   // data is MessageRow
   ```

3. **Use VM types for components**

   ```typescript
   interface MessageListProps {
     messages: MessageVM[]; // NOT MessageRow[]
   }
   ```

4. **Use Payload types for mutations**

   ```typescript
   function updateEducatorProfile(input: EducatorProfileSaveInput) {
     // ...
   }
   ```

5. **Leverage discriminated unions**
   ```typescript
   function renderMessage(message: MessageVM) {
     // Type narrows based on message.core.type
     switch (message.core.type) {
       case 'text':
         // TypeScript knows message is TextMessageVM
         return <TextMessage message={message} />;
       case 'image':
         // TypeScript knows message is ImageMessageVM
         return <ImageMessage message={message} />;
     }
   }
   ```

### Naming Conventions

- **Row types:** `{Entity}Row` (e.g., `MessageRow`, `ProfileRow`)
- **View Models:** `{Entity}VM` (e.g., `MessageVM`, `UserProfileVM`)
- **Payloads:** `{Action}{Entity}Payload` or `{Entity}SaveInput`
- **Enums:** `{Entity}{Property}VM` (e.g., `MessageTypeVM`, `LearningSpaceKindVM`)
- **Builders:** `build{Entity}VM()` (e.g., `buildMessageVM()`)
- **Mappers:** `{Entity}Mapper` class with static methods
- **Queries:** `get{Entity}()`, `list{Entity}()`, `update{Entity}()`

### Code Organization

1. **Colocate related code**
   - Builders, mappers, queries for a domain entity should be in the same directory
   - Tests should be next to the implementation file (`.test.ts`)

2. **Separate concerns**
   - Database queries in `/lib/{domain}/queries/`
   - Business logic in `/lib/{domain}/builders/` and `/lib/{domain}/mappers/`
   - UI components in `/packages/ui-web/src/components/`
   - For web UI pages, place reusable/visual components in `packages/ui-web` and import them into `apps/web`; avoid app-local one-off UI when those styles must be generated by the shared UI build
   - Utilities in `*.utils.ts` files

3. **Use barrel exports**
   - Each package should have an `index.ts` that re-exports public API
   - Consumers import from package root: `import { MessageVM } from '@iconicedu/shared-types'`

### Time & Timezone Formatting

- For user-visible dates/times, do not use direct `toLocaleString` or ad-hoc `Intl.DateTimeFormat` formatting in feature code.
- Use shared timezone-aware helpers so output is consistently viewer-timezone adjusted.
- Prefer `@iconicedu/utils` (`formatDateTime`, `formatDate`, `formatTime`, `resolveViewerTimezone`) or `packages/ui-web/src/lib/schedule-display-timezone.ts` helpers (`resolveScheduleDisplayTimeZone`, `formatScheduleDisplayValue`, `formatScheduleDisplayTimeWithZone`).

### Animation Guidelines

1. **Use smooth animations for user interactions (Web + Mobile)**
   - For both `apps/web` and `apps/mobile`, transitions and action feedback should use smooth, subtle animations.
   - Apply this to UI state changes such as expand/collapse, modal/sheet open-close, hover/press feedback, loading/saving states, and route/screen transitions where appropriate.

2. **Keep motion practical and accessible**
   - Prefer short, non-distracting timings and easing.
   - Avoid abrupt jumps when content appears/disappears.
   - Respect reduced-motion preferences when platform support is available.

### Vendor-Agnostic Code

**Write code that is not tightly coupled to a single vendor or SDK.**

- Isolate third-party integrations (Supabase, AI providers, analytics, storage) behind a thin wrapper in `lib/`, `queries/`, or a dedicated adapter file. Feature code must not import vendor SDKs directly.
- When two equivalent approaches exist, prefer the one that relies on standard web/Node/React APIs over a proprietary vendor extension.
- Use standard TypeScript interfaces for data contracts between layers — never leak vendor-specific types (e.g. `SupabaseClient`, SDK response shapes) beyond the integration boundary.
- AI/LLM integrations: abstract the provider behind a service interface so the underlying model or SDK can be swapped without touching calling code.

### Testing Requirements

**CRITICAL: Every time a file is modified, unit tests MUST be updated or created.**

- When creating a new file, add corresponding test file (`.test.ts` or `.test.tsx`)
- When modifying existing code, update existing tests to reflect changes
- When adding new functions or components, add new test cases
- Follow existing test patterns in the codebase
- Ensure tests cover edge cases and error conditions
- Run tests before committing changes: `pnpm test`
- Run the same file-scoped quality gates that pre-commit will run for touched files before handing work off:
  - `pnpm exec eslint --fix --max-warnings=0 <touched-files>`
  - `pnpm exec prettier --write <touched-files-matching-lint-staged>`
  - If the change is meant to be committed immediately, run `pnpm lint-staged` after staging to verify the actual hook path
- Treat ESLint warnings as failures, especially unused imports/variables in tests, because the repo enforces `--max-warnings=0` in `lint-staged`

**Test Coverage Standards:**

- All utility functions must have unit tests
- All builders and mappers must have unit tests
- All React components should have basic rendering tests
- All server actions should have integration tests
- Aim for meaningful test coverage, not just high percentages

### Testing Patterns

1. **Test builders and mappers**

   ```typescript
   describe('buildMessageVM', () => {
     it('should build a text message VM', () => {
       const messageRow = createMockMessageRow({ type: 'text' });
       const sender = createMockUserProfile();
       const payload = { text: 'Hello' };

       const vm = buildMessageVM(messageRow, sender, payload, [], undefined);

       expect(vm.core.type).toBe('text');
       expect(vm.content.text).toBe('Hello');
     });
   });
   ```

2. **Test utilities**

   ```typescript
   describe('groupMessagesByDate', () => {
     it('should group messages by date', () => {
       const messages = [
         createMockMessage({ createdAt: '2024-01-01T10:00:00Z' }),
         createMockMessage({ createdAt: '2024-01-01T11:00:00Z' }),
         createMockMessage({ createdAt: '2024-01-02T10:00:00Z' }),
       ];

       const grouped = groupMessagesByDate(messages);

       expect(grouped).toHaveLength(2);
       expect(grouped[0].date).toBe('2024-01-01');
       expect(grouped[0].messages).toHaveLength(2);
     });
   });
   ```

### Performance Considerations

1. **Use React Query for caching**
   - Leverage stale-while-revalidate
   - Invalidate caches on mutations

2. **Optimize Supabase queries**
   - Use `.select()` to limit columns
   - Use `.limit()` for pagination
   - Use indexes for frequently queried fields

3. **Lazy load components**
   - Use `React.lazy()` for message type components
   - Use `next/dynamic` for heavy components

4. **Memoize expensive computations**
   ```typescript
   const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages]);
   ```

---

## 🎓 Learning the Codebase

### Entry Points for AI Agents

1. **Start with types**: `/packages/shared-types/src/`
   - Understand the domain model first
   - Review row types, then VM types
   - Study discriminated unions

2. **Examine a complete feature**: Messages
   - Types: `/packages/shared-types/src/rows/message.ts` and `/packages/shared-types/src/vm/message.ts`
   - Queries: `/apps/web/lib/messages/queries/`
   - Builders: `/apps/web/lib/messages/builders/`
   - Components: `/packages/ui-web/src/components/messages/`
   - Actions: `/apps/web/app/actions/messages.ts`

3. **Follow the data flow**
   - Start with a UI component
   - Trace back to the React Query hook
   - Find the query function
   - Examine the mapper/builder
   - Check the database schema

4. **Study patterns**
   - Read the builder pattern in `message.builder.ts`
   - Understand the mapper pattern in `message.mapper.ts`
   - Review the realtime client pattern
   - Examine server actions

### Common Tasks

#### Adding a New Message Type

1. **Define row type** in `/packages/shared-types/src/rows/message.ts`

   ```typescript
   export interface MessageNewTypeRow {
     message_id: UUID;
     org_id: UUID;
     payload: Record<string, unknown>;
     // ... audit fields
   }
   ```

2. **Define VM type** in `/packages/shared-types/src/vm/message.ts`

   ```typescript
   export interface NewTypeMessageVM extends BaseMessageVM {
     core: MessageCoreVM & { type: 'new-type' };
     content: { text: string };
     newField: SomeType;
   }
   ```

3. **Update discriminated union**

   ```typescript
   export type MessageVM =
     | TextMessageVM
     | ImageMessageVM
     | NewTypeMessageVM  // Add here
     | ...
   ```

4. **Create React component** in `/packages/ui-web/src/components/messages/message-types/`

   ```typescript
   export function NewTypeMessage({ message }: { message: NewTypeMessageVM }) {
     // Render implementation
   }
   ```

5. **Update message renderer**

   ```typescript
   function renderMessage(message: MessageVM) {
     switch (message.core.type) {
       // ...
       case 'new-type':
         return <NewTypeMessage message={message} />;
     }
   }
   ```

6. **Update builder** in `/apps/web/lib/messages/builders/message.builder.ts`

7. **Add database table** via Supabase migration

---

## 📚 Additional Resources

- **README.md**: Setup and getting started
- **Database Schema**: `/supabase/schema.sql`
- **Turbo Configuration**: `/turbo.json`
- **TypeScript Configuration**: `/tsconfig.base.json`
- **Package Workspace**: `/pnpm-workspace.yaml`

---

## 🤖 AI Agent Quick Reference

### Quick Type Lookups

**Find a type definition:**

```bash
grep -r "export interface MessageVM" packages/shared-types/src/
```

**Find all message types:**

```bash
grep "export interface.*MessageVM" packages/shared-types/src/vm/message.ts
```

**Find components using a type:**

```bash
grep -r "MessageVM" packages/ui-web/src/components/
```

### Common Patterns to Recognize

1. **Pattern: `{Entity}Row`** → Database layer
2. **Pattern: `{Entity}VM`** → UI/business logic layer
3. **Pattern: `build{Entity}VM()`** → Row-to-VM transformation
4. **Pattern: `{Entity}Mapper`** → Orchestrates mapping with data fetching
5. **Pattern: `get{Entity}()` or `list{Entity}()`** → Data fetching
6. **Pattern: `use{Entity}()`** → React hook with React Query

### Type Narrowing Examples

```typescript
// Profile kind narrowing
function handleProfile(profile: UserProfileVM) {
  switch (profile.kind) {
    case 'educator':
      // profile is EducatorProfileVM
      console.log(profile.subjects);
      break;
    case 'child':
      // profile is ChildProfileVM
      console.log(profile.gradeLevel);
      break;
  }
}

// Message type narrowing
function handleMessage(message: MessageVM) {
  if (message.core.type === 'payment-reminder') {
    // message is PaymentReminderMessageVM
    console.log(message.payment.amount);
  }
}
```

---

## 📱 Mobile App — Testing Guide

**Last Updated:** 2026-02-22

### Framework & Setup

- **Runner:** `jest-expo` — version must match Expo SDK (SDK 54 → `jest-expo@54`)
- **Library:** `@testing-library/react-native`
- **Config:** `apps/mobile/jest.config.js`
- **Test location:** `apps/mobile/src/__tests__/`
- **Pattern:** `**/__tests__/**/*.test.{ts,tsx}`

### Rule: Write Tests for Every Touched File

When modifying any source file in `apps/mobile/src/` or `apps/mobile/app/`, add or update its test. Current coverage:

| Source file                                 | Test file                              |
| ------------------------------------------- | -------------------------------------- |
| `src/components/messages/message-item.tsx`  | `src/__tests__/message-item.test.tsx`  |
| `src/components/messages/message-list.tsx`  | `src/__tests__/message-list.test.tsx`  |
| `src/components/messages/message-input.tsx` | `src/__tests__/message-input.test.tsx` |
| `src/lib/dummy-messages.ts`                 | `src/__tests__/dummy-messages.test.ts` |
| `src/providers/auth-provider.tsx`           | `src/__tests__/auth-provider.test.tsx` |

### Imports

```ts
// Colors — use lightColors (exported name is `lightColors`, not LIGHT)
import { lightColors } from '@/lib/theme';

// Shared types
import type { MessageVM } from '@iconicedu/shared-types';

// Components
import { render, screen, fireEvent } from '@testing-library/react-native';
```

### Mocking Patterns

**Supabase client:**

```ts
jest.mock('../lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
    }),
  },
}));
```

**Theme provider (when component calls `useTheme`):**

```ts
jest.mock('../providers/theme-provider', () => ({
  useTheme: () => ({ colors: require('../lib/theme').lightColors }),
}));
```

**Expo Router:**

```ts
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ channelId: 'demo-ch', topic: 'Test' }),
}));
```

### Building test MessageVM objects

```ts
function makeSender(id: string, name = 'Sender') {
  return {
    kind: 'educator',
    ids: { id, orgId: 'org-1', accountId: `acc-${id}` },
    profile: {
      displayName: name,
      avatar: { source: 'seed' as const, seed: id, url: null, updatedAt: '' },
    },
    prefs: {},
    meta: { createdAt: '', updatedAt: '' },
  } as unknown as MessageVM['core']['sender'];
}

function makeMsg(id: string, senderId: string, createdAt: string): MessageVM {
  return {
    ids: { id, orgId: 'org-1' },
    core: {
      type: 'text',
      sender: makeSender(senderId),
      createdAt,
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: {},
    content: { text: `msg-${id}` },
  } as unknown as MessageVM;
}
```

### Running tests

```bash
# All mobile tests
pnpm --filter mobile test

# Watch mode
pnpm --filter mobile exec jest --watch

# Single file
pnpm --filter mobile exec jest src/__tests__/message-list.test.tsx
```

### Key Mobile Architecture Notes

#### Demo mode (messages)

- Channel IDs starting with `demo-` bypass Supabase — no network calls.
- Demo screens keep local `useState` initialized from `DEMO_MESSAGE_MAP`.
- New demo messages are built with `DEMO_RILEY_PROFILE` as sender.
- `DEMO_PROFILE_ID` identifies the viewer's own messages for "isOwn" detection.
- Both `dm/[channelId].tsx` and `channel/[channelId].tsx` share the same pattern.

#### Message list ordering

- `buildListData(messages)` produces date separators + messages in **oldest-first** order.
- `MessageList` reverses the array before passing to the inverted `FlatList` so `data[0]` = newest renders at the bottom (closest to the input bar).
- `isGroupStart` is computed per message by walking `data[index + 1]` (the older message visually above it).
- A new group starts when: sender changes OR time gap > 5 minutes.
- Own messages participate in grouping the same as others (no special treatment).

#### Login eligibility

- All user kinds (`educator`, `guardian`, `child`, `staff`, `admin`, `system`) are allowed on mobile.
- The `MOBILE_ALLOWED_ROLES` set in `src/lib/api/queries.ts` controls this.
- Unknown/null roles pass through so the profile wizard can collect the role.

---

**End of AGENTS.md**

_This document should be updated as the architecture evolves. Last updated: 2026-03-01_

## Feature Toggle Policy (Web)

- All new user-facing features in `apps/web` must ship behind a feature toggle and default to OFF.
- Use the Vercel Flags SDK catalog in `apps/web/flags.ts` as the source of truth.
- Do not introduce ad-hoc rollout checks when a feature flag is required.
- Rollout lifecycle must be documented per feature:
  - `introduce` (flag OFF)
  - `enable gradually`
  - `remove stale flag + dead code`
- Exemptions are allowed only for maintenance/refactor changes and must include `flag-exempt: <reason>` in PR body or commit message.

### Feature Flag Checklist

1. Add a stable key in `apps/web/flags.ts` (`feature-area-action`).
2. Keep `defaultValue: false` and provide explicit `decide()` behavior.
3. Gate both server behavior and UI behavior with the flag.
4. Add/update tests for catalog metadata and OFF/ON behavior.
5. Define removal criteria and remove the flag after full rollout.
