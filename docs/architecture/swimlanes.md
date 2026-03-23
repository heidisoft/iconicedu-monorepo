# Architecture Control Flow — Swimlane Diagram

## Purpose

Reference swimlane view of the most important cross-system request and data flows.

## Intended Audience

Engineers tracing behavior across web, mobile, API, and Supabase boundaries.

## Last Updated

2026-03-23

## Related Docs

- [Documentation Hub](../README.md)
- [Architecture Overview](overview.md)
- [Diagrams](diagrams.md)

Six major flows across the Web (Next.js), Mobile (Expo), API (NestJS), Supabase Auth, and PostgreSQL layers.

```mermaid
sequenceDiagram
    participant U as User
    participant WB as Web Browser
    participant M as Mobile App (Expo)
    participant NX as Next.js Server
    participant API as NestJS API
    participant SBA as Supabase Auth
    participant DB as PostgreSQL (Supabase)

    rect rgb(230, 240, 255)
        Note over U,DB: ── WEB AUTH FLOW ──────────────────────────────────────────────────
        U->>WB: Click login (OAuth / Magic Link)
        WB->>SBA: Initiate OAuth or send OTP email
        SBA-->>WB: Redirect to /auth/callback?code=…
        WB->>NX: GET /auth/callback
        NX->>SBA: exchangeCodeForSession(code)
        SBA-->>NX: Session JWT
        NX->>NX: Set session cookie (Supabase SSR)
        NX->>DB: POST /api/accounts/activate → create account row
        DB-->>NX: Account confirmed
        NX-->>WB: Redirect → /{orgSlug}/dashboard
    end

    rect rgb(230, 255, 240)
        Note over U,DB: ── MOBILE AUTH FLOW ────────────────────────────────────────────────
        U->>M: Enter email OTP or tap Google sign-in
        M->>SBA: signInWithOtp() or signInWithGoogle() (implicit flow)
        SBA-->>M: Session JWT (via URL hash)
        M->>M: Persist session in expo-secure-store
        M->>DB: checkOrgAssignment() + activateAccount()
        DB-->>M: org_id confirmed, account active
        M->>M: Expo Router → redirect to /(app)/(tabs)
    end

    rect rgb(255, 245, 220)
        Note over U,DB: ── WEB PROTECTED ROUTE (SSR READ) ──────────────────────────────────
        U->>WB: Navigate to /{orgSlug}/inbox
        WB->>NX: GET /{orgSlug}/inbox (cookie attached)
        NX->>SBA: auth.getUser() ← reads session cookie
        SBA-->>NX: authUser
        NX->>DB: buildOrgBySlug() · getOrCreateAccount()
        DB-->>NX: org row · account row · role_status
        alt role_status = pending / blocked
            NX-->>WB: redirect → /login/pending-access
        end
        par Sidebar data fetched in parallel
            NX->>DB: buildLearningSpacesByOrg()
            NX->>DB: buildDirectMessageChannels()
            NX->>DB: resolveSupportChannelId()
        end
        DB-->>NX: raw DB rows (snake_case)
        NX->>NX: mappers(rows) → ViewModels (shared-types)<br/>LearningSpaceVM[] · ChannelVM[]
        NX->>DB: Page-level query e.g. buildChannelMessages()
        DB-->>NX: raw DB rows
        NX->>NX: mappers(rows) → MessageVM[] (shared-types)
        NX-->>WB: Rendered HTML (typed VMs passed to ui-web components)
    end

    rect rgb(255, 230, 230)
        Note over U,DB: ── WEB MUTATION (Server Action) ─────────────────────────────────────
        U->>WB: Send message / submit form
        WB->>NX: Invoke 'use server' action
        NX->>SBA: requireAuthedUser() → validate session cookie
        SBA-->>NX: authUser
        NX->>NX: Validate orgId · senderProfileId ownership
        NX->>DB: supabase.insert(messages) + supabase.insert(message_text)
        DB-->>NX: MessageRow
        NX->>NX: mapMessageRowToVM(row) → MessageVM (shared-types)
        NX-->>WB: Return MessageVM to client component
    end

    rect rgb(240, 230, 255)
        Note over U,DB: ── NESTJS API REQUEST (from Mobile or Web Client) ───────────────────
        M->>API: HTTP request + Authorization: Bearer <JWT>**
        API->>API: Global ValidationPipe — whitelist DTO, strip extra fields
        API->>API: AuthGuard — jwt.decode(token) → attach req.user {id, role}
        API->>API: Controller routes to Service method
        API->>DB: PrismaService.findMany() / create() / update()
        DB-->>API: Prisma model result
        API-->>M: JSON response
    end

    rect rgb(220, 255, 255)
        Note over U,DB: ── MOBILE DATA FETCH + REALTIME ─────────────────────────────────────
        M->>M: Screen renders → useMessages(channelId) hook
        M->>M: React Query: check cache (staleTime: 1 min)
        M->>DB: fetchChannelMessages() via Supabase client
        DB-->>M: Message rows + sender profiles + reactions
        M->>M: Render message list
        DB-)M: Supabase Realtime: postgres_changes (INSERT/UPDATE/DELETE)
        M->>M: queryClient.invalidateQueries([messages, channelId])
        M->>DB: Re-fetch messages
        DB-->>M: Updated rows → optimistic UI reconciled
    end
```

## Flow Descriptions

### 1. Web Auth Flow

Browser triggers OAuth or Magic Link → Supabase issues tokens and redirects to `/auth/callback` → Next.js exchanges the auth code for a session via `exchangeCodeForSession` → sets a server-side cookie (Supabase SSR pattern) → calls `/api/accounts/activate` to create or activate the account row in Postgres → redirects the user to `/{orgSlug}/dashboard`.

Key files: [apps/web/app/(auth)/auth/callback/page.tsx](<../../apps/web/app/(auth)/auth/callback/page.tsx>) · [apps/web/app/api/accounts/activate/route.ts](../../apps/web/app/api/accounts/activate/route.ts) · [apps/web/lib/supabase/server.ts](../../apps/web/lib/supabase/server.ts)

---

### 2. Mobile Auth Flow

`AuthProvider` in Expo calls `signInWithOtp` (email code) or `signInWithGoogle` (implicit OAuth flow — no PKCE to avoid React Native race conditions) → Supabase returns a session JWT via URL hash → session is stored in `expo-secure-store` → `checkOrgAssignment` validates the user has an assigned org → `activateAccount` marks the account active → Expo Router redirects to `/(app)/(tabs)`.

Key files: [apps/mobile/src/providers/auth-provider.tsx](../../apps/mobile/src/providers/auth-provider.tsx) · [apps/mobile/src/lib/supabase/client.ts](../../apps/mobile/src/lib/supabase/client.ts)

---

### 3. Web Protected Route (SSR Read)

Every request to `/{orgSlug}/*` passes through `[orgSlug]/layout.tsx`:

1. `createSupabaseServerClient()` reads the session cookie
2. `requireAuthedUser()` calls `auth.getUser()` — redirects to `/login` if unauthenticated
3. Validates org slug, fetches account, checks `role_status` (pending/blocked → redirect)
4. Fetches sidebar data in **parallel**: `buildLearningSpacesByOrg`, `buildDirectMessageChannels`, `resolveSupportChannelId`
5. Raw DB rows (snake_case) are transformed via **mapper functions** into typed **ViewModels** (`LearningSpaceVM[]`, `ChannelVM[]`) defined in `packages/shared-types`
6. Page Server Component runs its own `buildX()` queries and maps rows → VMs
7. Typed VMs are passed as props to `packages/ui-web` components for rendering

Key files: [apps/web/app/(app)/[orgSlug]/layout.tsx](<../../apps/web/app/(app)/[orgSlug]/layout.tsx>) · [apps/web/lib/sidebar/buildSidebarBaseData.ts](../../apps/web/lib/sidebar/buildSidebarBaseData.ts) · [apps/web/lib/auth/requireAuthedUser.ts](../../apps/web/lib/auth/requireAuthedUser.ts)

---

### 4. Web Mutation (Server Action)

Client components invoke `'use server'` functions in `app/actions/`. Each action:

1. Re-creates the server Supabase client (reads fresh session cookie)
2. Calls `requireAuthedUser()` to validate auth
3. Checks ownership (orgId, profileId) before writing
4. Writes directly to Supabase (insert + payload table, with manual rollback on error)
5. Maps the returned row to a VM via `shared-types` mappers and returns it to the client

Key files: [apps/web/app/actions/messages.ts](../../apps/web/app/actions/messages.ts) · [apps/web/lib/auth/admin-actions.ts](../../apps/web/lib/auth/admin-actions.ts)

---

### 5. NestJS API Request

The NestJS API (`apps/api`) handles HTTP requests from Mobile (and optionally Web clients) carrying `Authorization: Bearer <JWT>`:

1. **Global `ValidationPipe`** — whitelists DTO fields, strips unknowns, coerces types; throws `400` on violation
2. **`AuthGuard`** — `jwt.decode(token)` extracts `sub` (user UUID) and `user_metadata.app_role`; attaches `req.user`; throws `401` if missing or malformed
3. **Controller** delegates to **Service** which calls **`PrismaService`** for DB access
4. Response serialized as JSON

Modules: `AuthModule` · `UsersModule` · `ChannelsModule` · `ClassesModule`

Key files: [apps/api/src/main.ts](../../apps/api/src/main.ts) · [apps/api/src/modules/auth/auth.guard.ts](../../apps/api/src/modules/auth/auth.guard.ts) · [apps/api/src/prisma/prisma.service.ts](../../apps/api/src/prisma/prisma.service.ts)

---

### 6. Mobile Data Fetch + Realtime

Screens consume custom React Query hooks (`useMessages`, `useChannels`, `useAccount`):

- Queries are **`enabled: !!user`** to prevent execution before auth loads
- Default `staleTime: 1 min`, `gcTime: 5 min`, `retry: 2`
- Supabase client fetches rows directly (no NestJS hop for reads)
- A **Supabase Realtime** subscription on `postgres_changes` fires `queryClient.invalidateQueries()` on `INSERT`/`UPDATE`/`DELETE` events → triggers a background re-fetch
- Mutations (e.g. reactions) use **optimistic updates** with cache rollback on error

Key files: [apps/mobile/src/lib/api/queries.ts](../../apps/mobile/src/lib/api/queries.ts) · [apps/mobile/src/providers/query-provider.tsx](../../apps/mobile/src/providers/query-provider.tsx)

---

## Data Contract: Row → ViewModel Pipeline

All data flowing from Postgres to UI passes through the `packages/shared-types` transform pipeline:

```
PostgreSQL row (snake_case)
  └─▶  apps/web/lib/<entity>/queries/     raw Supabase query
  └─▶  apps/web/lib/<entity>/mappers/     row → VM translation
  └─▶  apps/web/lib/<entity>/builders/    compose/aggregate multiple VMs
  └─▶  packages/shared-types/src/vm/      typed ViewModel (camelCase)
  └─▶  packages/ui-web/src/components/    component receives typed VM prop
```

VMs are the single source of truth for UI data contracts — shared between `apps/web`, `apps/mobile`, and `packages/ui-web`. API payloads (in `packages/shared-types/src/payloads/`) are kept separate from VMs.

---

## Class Diagrams

Five class diagrams covering each app and the shared-types package. Each diagram is intentionally scoped — showing the most structurally significant classes, methods, and relationships rather than every field.

---

### 1. `apps/api` — NestJS Module & Class Structure

Shows the NestJS dependency-injection graph, guard chain, and Prisma data models.

```mermaid
classDiagram
    class AppModule {
        <<NestModule>>
        +imports: PrismaModule
        +imports: AuthModule
        +imports: UsersModule
        +imports: ChannelsModule
        +imports: ClassesModule
    }

    class PrismaModule {
        <<NestModule, Global>>
        +providers: PrismaService
        +exports: PrismaService
    }

    class PrismaService {
        <<Injectable>>
        +onModuleInit() Promise~void~
        +onModuleDestroy() Promise~void~
    }
    PrismaService --|> PrismaClient : extends

    class AuthService {
        <<Injectable>>
        +decodeToken(token: string) JwtPayload
    }

    class AuthGuard {
        <<Injectable, Guard>>
        -authService: AuthService
        +canActivate(ctx: ExecutionContext) Promise~boolean~
    }
    AuthGuard ..|> CanActivate : implements
    AuthGuard --> AuthService : uses

    class UsersController {
        <<Controller /users>>
        -usersService: UsersService
        +getMe(req) Profile
    }
    class UsersService {
        <<Injectable>>
        -prisma: PrismaService
        +findCurrentUser(id: string) Promise~Profile~
    }
    UsersController --> AuthGuard : @UseGuards
    UsersController --> UsersService : injects
    UsersService --> PrismaService : injects

    class ChannelsController {
        <<Controller /channels>>
        -channelsService: ChannelsService
        +listChannels(req) Channel[]
    }
    class ChannelsService {
        <<Injectable>>
        -prisma: PrismaService
        +listChannelsForUser(userId: string) Promise~Channel[]~
    }
    ChannelsController --> AuthGuard : @UseGuards
    ChannelsController --> ChannelsService : injects
    ChannelsService --> PrismaService : injects

    class ClassesController {
        <<Controller /classes>>
        -classesService: ClassesService
        +listClasses() Class[]
    }
    class ClassesService {
        <<Injectable>>
        -prisma: PrismaService
        +listClasses() Promise~Class[]~
    }
    ClassesController --> ClassesService : injects
    ClassesService --> PrismaService : injects

    class Profile {
        <<PrismaModel: profiles>>
        +id: String
        +fullName: String
        +appRole: String
        +createdAt: DateTime
    }
    class Channel {
        <<PrismaModel: channels>>
        +id: String
        +name: String
        +type: String
        +classId: String
        +createdAt: DateTime
    }
    class Message {
        <<PrismaModel: messages>>
        +id: String
        +channelId: String
        +userId: String
        +content: String
        +createdAt: DateTime
    }
    class Class {
        <<PrismaModel: classes>>
        +id: String
        +name: String
        +subject: String
        +createdAt: DateTime
    }

    Channel --> Class : classId FK
    Message --> Channel : channelId FK
    Message --> Profile : userId FK

    UsersService ..> Profile : queries
    ChannelsService ..> Channel : queries
    ClassesService ..> Class : queries

    AppModule --> PrismaModule
    AppModule --> AuthModule
    AppModule --> UsersModule
    AppModule --> ChannelsModule
    AppModule --> ClassesModule
```

---

### 2. `packages/shared-types` — User & Account Domain

Shows the `UserProfileVM` inheritance hierarchy and the account/family/role types.

```mermaid
classDiagram
    class IdsBaseVM {
        <<interface>>
        +id: UUID
        +orgId: UUID
    }

    class AvatarVM {
        <<interface>>
        +source: seed|upload|external
        +url?: string
        +seed?: string
    }

    class PresenceVM {
        <<interface>>
        +liveStatus: online|in_class|teaching|busy|away|offline
        +displayStatus?: online|idle|busy|away|offline
        +lastSeenAt?: ISODateTime
        +presenceLoaded?: boolean
    }

    class UserProfileBlockVM {
        <<interface>>
        +displayName: string
        +firstName?: string
        +lastName?: string
        +bio?: string
        +avatar: AvatarVM
    }
    UserProfileBlockVM --> AvatarVM

    class BaseUserProfileVM {
        <<interface>>
        +ids: IdsBaseVM + accountId
        +profile: UserProfileBlockVM
        +prefs: UserPrefsVM
        +presence?: PresenceVM
        +location?: UserLocationVM
        +meta: UserMetaVM
        +ui?: UserUiVM
    }
    BaseUserProfileVM --> UserProfileBlockVM
    BaseUserProfileVM --> PresenceVM

    class EducatorProfileVM {
        <<interface>>
        +kind: educator
        +subjects?: string[]
        +gradesSupported?: GradeLevel[]
        +experienceYears?: number
        +availability?: EducatorAvailabilityVM
        +averageRating?: number
        +badges?: string[]
    }
    EducatorProfileVM --|> BaseUserProfileVM

    class GuardianProfileVM {
        <<interface>>
        +kind: guardian
        +children?: ConnectionVM~ChildProfileVM~
        +familyInvites?: FamilyLinkInviteVM[]
        +sessionNotesVisibility?: private|shared
    }
    GuardianProfileVM --|> BaseUserProfileVM
    GuardianProfileVM "1" --> "0..*" ChildProfileVM : children

    class ChildProfileVM {
        <<interface>>
        +kind: child
        +gradeLevel?: GradeLevel
        +birthYear?: number
        +interests?: string[]
        +learningPreferences?: string[]
        +motivationStyles?: string[]
    }
    ChildProfileVM --|> BaseUserProfileVM

    class StaffProfileVM {
        <<interface>>
        +kind: staff
        +jobTitle?: string
        +department?: string
        +permissionsScope?: limited|standard|elevated
        +weeklyAvailability?: DayAvailability
    }
    StaffProfileVM --|> BaseUserProfileVM

    class SystemProfileVM {
        <<interface>>
        +kind: system
    }
    SystemProfileVM --|> BaseUserProfileVM

    class UserAccountVM {
        <<interface>>
        +ids: IdsBaseVM
        +contacts: UserContactVM
        +access?: AccountAccessVM
        +lifecycle: AccountLifecycleVM
    }

    class UserRoleVM {
        <<interface>>
        +ids: IdsBaseVM
        +roleKey: owner|admin|educator|guardian|child|staff
        +audit: RoleAuditVM
    }
    UserAccountVM --> UserRoleVM : via access.userRoles

    class FamilyVM {
        <<interface>>
        +ids: IdsBaseVM
        +displayName: string
    }

    class FamilyLinkVM {
        <<interface>>
        +ids: IdsBaseVM + familyId
        +accounts: guardianAccountId + childAccountId
        +relation: guardian|legal_guardian|caregiver|relative|other
    }
    FamilyLinkVM --> FamilyVM

    class UserOnboardingStatusVM {
        <<interface>>
        +id: UUID
        +profileId: UUID
        +currentStep?: OnboardingStep
        +lastCompletedStep?: OnboardingStep
        +completed: boolean
    }
```

---

### 3. `packages/shared-types` — Content & Messaging Domain

Shows the `MessageVM` discriminated union, attachment hierarchy, and the `ChannelVM` → `LearningSpaceVM` composition chain.

```mermaid
classDiagram
    class BaseAttachmentVM {
        <<interface>>
        +type: image|file|design-file
        +url: string
        +name: string
    }
    class ImageAttachmentVM {
        +type: image
        +width?: number
        +height?: number
    }
    class FileAttachmentVM {
        +type: file
        +size?: number
        +mimeType?: string
    }
    class DesignFileAttachmentVM {
        +type: design-file
        +tool: figma|sketch|adobe-xd|canva|other
        +thumbnail?: string
    }
    ImageAttachmentVM --|> BaseAttachmentVM
    FileAttachmentVM --|> BaseAttachmentVM
    DesignFileAttachmentVM --|> BaseAttachmentVM

    class ReactionVM {
        <<interface>>
        +emoji: string
        +count: number
        +reactedByMe?: boolean
    }

    class ThreadVM {
        <<interface>>
        +ids: IdsBaseVM
        +parent: messageId + snippet
        +stats: messageCount + lastReplyAt
        +participants: UserProfileVM[]
        +readState?: ThreadReadStateVM
    }

    class BaseMessageVM {
        <<interface>>
        +ids: IdsBaseVM
        +core: MessageCoreVM
        +social: MessageSocialVM
        +state?: MessageStateVM
    }
    BaseMessageVM --> ReactionVM : via social.reactions
    BaseMessageVM --> ThreadVM : via social.thread

    class TextMessageVM {
        +core.type: text
        +content.text: string
    }
    class ImageMessageVM {
        +core.type: image
        +attachment: ImageAttachmentVM
    }
    class FileMessageVM {
        +core.type: file
        +attachment: FileAttachmentVM
    }
    class PaymentReminderMessageVM {
        +core.type: payment-reminder
        +payment: amount + currency + dueAt + status
    }
    class SessionSummaryMessageVM {
        +core.type: session-summary
        +session: title + summary + highlights + nextSteps
    }
    class LessonAssignmentMessageVM {
        +core.type: lesson-assignment
        +assignment: title + dueAt + subject + attachments
    }

    TextMessageVM --|> BaseMessageVM
    ImageMessageVM --|> BaseMessageVM
    FileMessageVM --|> BaseMessageVM
    PaymentReminderMessageVM --|> BaseMessageVM
    SessionSummaryMessageVM --|> BaseMessageVM
    LessonAssignmentMessageVM --|> BaseMessageVM

    note for BaseMessageVM "Union also includes:\nDesignFileUpdateMessageVM\nEventReminderMessageVM\nFeedbackRequestMessageVM\nProgressUpdateMessageVM\nSessionBookingMessageVM\nSessionCompleteMessageVM\nHomeworkSubmissionMessageVM\nLinkPreviewMessageVM\nAudioRecordingMessageVM"

    class ChannelVM {
        <<interface>>
        +ids: IdsBaseVM
        +basics: ChannelBasicsVM
        +lifecycle: ChannelLifecycleVM
        +postingPolicy: ChannelPostingPolicyVM
        +collections: ChannelCollectionsVM
        +ui?: ChannelUiDefaultsVM
        +dm?: ChannelDmVM
    }
    ChannelVM "1" --> "0..*" BaseMessageVM : collections.messages
    ChannelVM "1" --> "0..*" ReactionVM : via messages
    ChannelVM --> ThreadVM : via messages

    class ClassScheduleVM {
        <<interface>>
        +ids: IdsBaseVM
        +title: string
        +startAt: ISODateTime
        +endAt: ISODateTime
        +status: scheduled|cancelled|completed|rescheduled
        +recurrence?: RecurrenceVM
        +participants: ClassScheduleParticipantVM[]
        +audit: EventAuditInfoVM
    }

    class LearningSpaceVM {
        <<interface>>
        +ids: IdsBaseVM
        +basics: LearningSpaceBasicsVM
        +channels: LearningSpaceChannelsVM
        +schedule?: LearningSpaceScheduleVM
        +resources?: LearningSpaceResourcesVM
        +lifecycle: LearningSpaceLifecycleVM
        +participants: UserProfileVM[]
    }
    LearningSpaceVM "1" --> "1..*" ChannelVM : primaryChannel + relatedChannels
    LearningSpaceVM --> ClassScheduleVM : schedule series

    class SidebarLeftDataVM {
        <<interface>>
        +user: SidebarUserVM
        +navigation: SidebarPrimaryNavVM
        +collections: SidebarCollectionsVM
        +organizations?: SidebarOrganizationSwitchItemVM[]
    }
    SidebarLeftDataVM "1" --> "0..*" LearningSpaceVM : collections.learningSpaces
    SidebarLeftDataVM "1" --> "0..*" ChannelVM : collections.directMessages

    class ActivityFeedVM {
        <<interface>>
        +activeTab: all|classes|payment|system
        +tabs: ActivityFeedTabVM[]
        +sections: ActivityFeedSectionVM[]
        +unreadCount?: number
    }
    ActivityFeedVM "1" --> "0..*" BaseMessageVM : via activity items
```

---

### 4. `apps/mobile` — Provider, Hook & Data Layer

Shows the provider composition tree, React Query hooks with their dependency chain, and the Supabase client integration.

```mermaid
classDiagram
    class AppProviders {
        <<Component, Composition Root>>
        Wraps: ThemeProvider > QueryProvider > AuthProvider
    }

    class ThemeProvider {
        <<Context>>
        -mode: system|light|dark
        -colorScheme: light|dark
        -colors: AppColors
        -loaded: boolean
        +setMode(mode) void
        Storage: expo-secure-store
    }

    class QueryProvider {
        <<Context>>
        -queryClient: QueryClient
        staleTime: 1 min
        gcTime: 5 min
        retry: 2
        refetchOnWindowFocus: false
    }

    class AuthProvider {
        <<Context>>
        -session: Session
        -user: User
        -loading: boolean
        +signInWithOtp(email) Promise
        +verifyOtp(email, token) Promise
        +signInWithGoogle() Promise
        +signOut() Promise
        Storage: expo-secure-store via Supabase adapter
    }

    AppProviders *-- ThemeProvider
    AppProviders *-- QueryProvider
    AppProviders *-- AuthProvider

    class SupabaseClient {
        <<Singleton>>
        flowType: implicit
        persistSession: true
        storage: SecureStoreAdapter
        +auth: GoTrueClient
        +from(table) PostgrestQueryBuilder
        +channel(name) RealtimeChannel
    }

    AuthProvider --> SupabaseClient : auth calls
    AuthProvider ..> queries : activateAccount()

    class RootLayout {
        <<ExpoRouter Layout>>
        Wraps app in AppProviders
        Shows spinner while loading
    }

    class AppLayout {
        <<ExpoRouter Layout, Auth Guard>>
        if no session: redirect /(auth)/login
        if onboarding incomplete: redirect /(auth)/profile-setup
    }

    class TabLayout {
        <<ExpoRouter Layout>>
        Tabs: Home, Messages, Inbox, Account
        Schedule tab: hidden
    }

    RootLayout --> AppProviders
    AppLayout --> AppLayout : reads useAuth
    TabLayout --> AppLayout

    class queries {
        <<Service Module, 1228 lines>>
        +fetchUserAccount() Account
        +fetchProfileByAccountId(id) Profile
        +fetchChannels(orgId) ChannelListItem[]
        +fetchDirectMessages(orgId, profileId) ChannelListItem[]
        +fetchLearningSpaces(orgId) LearningSpaceVM[]
        +fetchChannelMessages(channelId, ...) MessageVM[]
        +fetchThreadMessages(threadId, ...) MessageVM[]
        +sendTextMessage(...) void
        +toggleReaction(msgId, emoji) void
        +activateAccount() void
    }
    queries --> SupabaseClient : DB queries

    class mapRowToMessageVM {
        <<Mapper>>
        +buildSenderProfile(row, orgId) UserProfileVM
        +mapRowToMessageVM(row, payload, reactions, thread) MessageVM
        +getMessagePreview(msg) string
    }

    class useAuth {
        <<Hook, reads AuthProvider>>
        +session: Session
        +user: User
        +loading: boolean
        +signIn/signOut methods
    }
    useAuth --> AuthProvider : useContext

    class useAccount {
        <<Hook, React Query>>
        queryKey: account + userId
        enabled: user exists
        +data: Account + Profile
    }

    class useProfile {
        <<Hook, React Query>>
        queryKey: profile-by-account + accountId
        enabled: accountId exists
        +data: UserProfileVM
    }

    class useChannels {
        <<Hook, React Query>>
        queryKey: channels + orgId
        enabled: orgId exists
        +data: ChannelListItem[]
    }

    class useDirectMessages {
        <<Hook, React Query>>
        queryKey: directMessages + orgId + profileId
        +data: ChannelListItem[]
    }

    class useLearningSpaces {
        <<Hook, React Query>>
        queryKey: learningSpaces + orgId
        +data: LearningSpaceVM[]
    }

    class useMessages {
        <<Hook, React Query + Realtime>>
        queryKey: messages + channelId
        +data: MessageVM[]
        +loadMore() void
        +toggleReaction(msgId, emoji) void
        Realtime: messages INSERT/UPDATE/DELETE
        Realtime: message_reactions changes
    }

    class useTyping {
        <<Hook, Realtime only>>
        -typingUsers: string[]
        +broadcastTyping() void
        Realtime: broadcast typing channel
        Auto-clear after 3000ms
    }

    useAuth --> AuthProvider : useContext
    useAccount --> queries : fetchUserAccount
    useAccount ..> useAuth : enabled by session
    useProfile --> queries : fetchProfileByAccountId
    useProfile ..> useAccount : reads accountId
    useChannels --> queries : fetchChannels
    useChannels ..> useAccount : reads orgId
    useDirectMessages --> queries : fetchDirectMessages
    useLearningSpaces --> queries : fetchLearningSpaces
    useMessages --> queries : fetchChannelMessages
    useMessages --> mapRowToMessageVM : maps rows
    useMessages --> SupabaseClient : Realtime subscriptions
    useTyping --> SupabaseClient : broadcast channel
```

---

### 5. `apps/web` — Auth Service, Supabase Clients & Builder/Mapper Stack

Shows the three Supabase client factories, the `AuthAdminService` class, the auth guard helper, and the layered query/mapper/builder pattern used for all data fetching.

```mermaid
classDiagram
    class createSupabaseBrowserClient {
        <<Factory, lib/supabase/client.ts>>
        Reads: NEXT_PUBLIC_SUPABASE_URL
        Reads: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
        Returns: SupabaseClient (browser session)
    }

    class createSupabaseServerClient {
        <<Factory, lib/supabase/server.ts>>
        Reads session from: Next.js cookies()
        Returns: SupabaseClient (SSR session)
    }

    class createSupabaseServiceClient {
        <<Factory, lib/supabase/service.ts>>
        Reads: SUPABASE_SERVICE_ROLE_KEY
        persistSession: false
        Returns: SupabaseClient (admin privileges)
    }

    class AuthAdminService {
        <<Class, lib/auth/admin.ts>>
        -client: SupabaseClient (service role)
        +create(options?) AuthAdminService
        +createUser(attrs) Promise
        +updateUser(id, attrs) Promise
        +deleteUser(id) Promise
        +generateLink(params) Promise
        +listMFAFactors(userId) Promise
    }
    AuthAdminService --> createSupabaseServiceClient : uses service client

    class requireAuthedUser {
        <<Function, lib/auth/requireAuthedUser.ts>>
        +requireAuthedUser(supabase) User
        if no session: redirect to /login
    }
    requireAuthedUser --> createSupabaseServerClient : calls auth.getUser()

    class adminActions {
        <<Server Actions, lib/auth/admin-actions.ts>>
        +createUserAction(payload)
        +updateUserAction(id, payload)
        +deleteUserAction(id)
        +generateInviteLinkAction(params)
        Calls revalidatePath after each action
    }
    adminActions --> AuthAdminService : creates instance

    class QueryLayer {
        <<Functions, lib/entity/queries/>>
        +getMessagesByChannelId(supabase, orgId, channelId) MessageRow[]
        +getChannelsByOrgId(supabase, orgId) ChannelRow[]
        +getLearningSpacesByOrgId(supabase, orgId) LearningSpaceRow[]
        +getUserProfileById(supabase, profileId) ProfileRow
    }
    QueryLayer --> createSupabaseServerClient : runs queries

    class MapperLayer {
        <<Functions, lib/entity/mappers/>>
        +mapMessageRowToVM(row, input) MessageVM
        +mapLearningSpaceRowToVM(row, input) LearningSpaceVM
        +mapChannelRowToVM(row, input) ChannelVM
        +mapUserProfileRowToVM(row) UserProfileVM
    }

    class BuilderLayer {
        <<Functions, lib/entity/builders/>>
        +buildSidebarBaseData(supabase, orgId, accountId) SidebarBaseData
        +buildLearningSpacesByOrg(supabase, orgId) LearningSpaceVM[]
        +buildDirectMessageChannels(supabase, orgId) ChannelVM[]
        +buildChannelMessages(supabase, channelId) MessageVM[]
        +buildMessageById(supabase, orgId, messageId) MessageVM
    }
    BuilderLayer --> QueryLayer : orchestrates queries
    BuilderLayer --> MapperLayer : transforms rows to VMs

    class ServerActions {
        <<Server Actions, app/actions/>>
        +sendTextMessageAction(input) MessageVM
        +createChannelAction(payload) ChannelVM
        +updateProfileAction(data) UserProfileVM
        Validates: requireAuthedUser() on every call
        Manual rollback on multi-step insert failure
    }
    ServerActions --> createSupabaseServerClient : validates + writes
    ServerActions --> MapperLayer : maps returned rows

    class OrgSlugLayout {
        <<Next.js Layout, app/(app)/[orgSlug]/layout.tsx>>
        +requireAuthedUser(supabase)
        +buildOrgBySlug(supabase, orgSlug)
        +getOrCreateAccount(supabase, context)
        +validateRoleStatus() redirect if pending/blocked
        +buildSidebarBaseData(supabase, orgId, accountId)
        Renders: SidebarShell + children
    }
    OrgSlugLayout --> requireAuthedUser : guards all routes
    OrgSlugLayout --> BuilderLayer : builds sidebar data
    OrgSlugLayout --> createSupabaseServerClient : session from cookie
```
