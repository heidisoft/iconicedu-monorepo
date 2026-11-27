# Mobile profile and family management

Mobile account settings are available to every profile role. Profile owns names,
photo and bio; the existing Location, Preferences and Contact & Security screens
own address, regional, appearance and account-visibility settings. These preferences never change authorization or
account lifecycle state. Account information and mobile profile previews honor the
visibility preferences; operational roles remain available to permission checks.
The language/region code is a stored profile preference, not an app translation
selector.

Account → Family lets guardians add children, view linked child details, and edit
names, presentation preferences, birth year and grade. A family link with a null
`permissions_scope` retains full guardian management access. Explicit scopes are
restrictive: `edit_profile` permits edits, `manage_children` permits edits and
removal, and other scopes permit viewing only. The API and database enforce these
checks; hiding a control is not authorization.

Family retains both **Invite child by email** and **Add new child**. The managed
profile flow mirrors the web: first name, last name, grade and birth year are
required; email is optional; display name starts as first name plus last initial;
timezone and location are inherited from the parent. Add Child uses editable fields within the existing Identity, Learning Details, and Contact
sections, with the avatar above. Names and optional email are entered inline; birth
year and grade reuse the onboarding selectors and input styling. A blank display name defaults to the first name and
last initial. Fields remain local until the final Add child confirmation creates
the child. The new child opens in the normal sectioned profile view. Photos and
other settings can then be edited through the same controls as the main profile.

The separate email invitation flow uses `family_link_invites` and the existing
web authentication callback with `org` and `intent=get-started`. Invitations expire
after seven days. The guardian can review and cancel pending invitations in Family.
A managed child's Sign-in section can invite that existing profile, including
assigning an email when absent. An existing account's names, accent, status and
preferences are preserved. Managed creation rejects an email that already belongs
to an account and directs the parent to the invitation flow instead.

`POST /family-child-invites` resolves guardian, organization and child role on the
server. Only management-permitted links may assign a managed child's email. The
API limits each guardian to ten invitations per hour and rejects duplicate pending
invitations. `WEB_URL` is the existing deployed web base URL used for the email
callback, including in PR previews; invitation delivery fails safely before any
mutation if that URL is invalid. Local development defaults to
`http://localhost:3000`; production requires an HTTPS web URL. New recipients use
Supabase invitation email; existing auth users receive a sign-in link. Delivery
failure revokes the pending record so it can be retried. Newly invited placeholder
accounts/profiles are retained for retry and audit, rather than deleting auth users.
No invitation code hash or authentication identifier is returned to the mobile UI.

Acceptance requires a verified recipient identity, an unexpired invitation and a
remaining use. Creating the family link and consuming the invitation are atomic.
The web acceptance helper also rejects a concurrently revoked invitation. Cancelling
an invitation on either surface never deletes an authentication account.

Profile retains its photo, identity and about layout. Location edits remain on
Location → Address; regional edits remain on Preferences → Regional; accent color
is part of Preferences → Appearance. The Account section displaying Role and Status is omitted from mobile profile
and Contact & Security screens for every role. Child details use the main account’s Personal (Profile, Location) and Account
(Preferences) groups. Each opens the existing screen with the selected child’s
profile ID. Identity, About, and child Learning Details live on the separate
Profile screen; invitations and removal remain on the child overview. They do not duplicate
the address or regional fields. Profile and child details retain read-only,
grouped settings rows. Each section
has its own top-right Edit action, opening a native sheet with Cancel and Save.
Only fields in that section are validated and written; cancelling discards the
local draft. Profile and child-profile text inputs use shared sizing, padding, theme
colors, and focus borders, following the onboarding style. Creation and edit sheets use the
same card insets so the fields retain matching proportions. Name placeholders are
short labels with normal text weight and spacing. In saved-profile section editors, text fields display their current values as tappable rows.
Names, address text, bio and spoken languages open focused native sheets. Close or
native Back discards the field edit; Done updates only the section draft. Country,
region, birth year, grade, timezone and language/region retain their existing selection
sheets. Accent colors also open in a separate sheet, with the current avatar color
selected. The section Save still requires confirmation before persistence. This
applies to main and child profiles; Add child keeps inline inputs for first-time entry.
Name field editors support keyboard Done;
email fields keep email keyboards and disable autocorrection. Address, birth-year,
grade, and regional selectors are disabled during confirmation and saving, including
for accessibility actions. Regional editors use searchable timezone and language/region pickers, and allow
editing spoken languages. The Location and Preferences screens share these section
editors while retaining their existing data rows.
Every save and removal requires a mobile confirmation. The photo Edit action sits
directly below the avatar and opens native Take Photo / Choose from Album choices.
Camera permission is requested only when taking a picture; denied access provides
a Settings action where needed. Selection opens a local preview; cancelling the
chooser or system picker preserves the current photo. Photo selection remains
local until confirmation. Uploads use a new object under
`public-avatars/{orgId}/{profileId}/`, are resized to JPEG, and are limited to 5 MB
by the storage bucket. Existing images may remain available through their public
URLs. Only assign photos suitable for a public avatar.

Removal soft deletes the child profile and family links. An active schedule
participant or learning-space participant row blocks removal, even for historical
classes whose assignments have not been archived. Another guardian's active link
also blocks removal. Direct guardians to Account → Live Support with the child's
name and class details. Do not manually delete class participation to bypass this
check. Assignment writes and removal lock the profile to prevent concurrent
enrollment from assigning a removed child.

`profile_change_events` records actor account, entity, timestamp and before/after
snapshots for profile, child detail, grade, family-link and invitation writes,
including account creation and email assignment. Triggers write
history in the same transaction as each mutation. This contains personal data:
only organization administrators may read history; authenticated users cannot
insert, update or delete events. Service-originated changes attribute the actor
through server-owned audit fields. Profile settings and child-detail edits use a
single database transaction; child creation uses the existing API's compensating
cleanup on failure, whose writes are also audited. Never copy audit snapshots
into application logs or support messages.

Apply `20261126170000_profile_family_settings.sql`,
`20261126190000_profile_section_updates.sql` and
`20261126210000_mobile_family_child_invitations.sql` before deploying the API and mobile
changes. The migration is additive; rolling back the clients/API leaves
preferences and history intact. Prisma generation is required after updating the
schema. Validate with the focused API/mobile profile tests and
`supabase test db supabase/tests/profile_family_settings.test.sql supabase/tests/family_child_invitations.test.sql`
against a local database initialized from migrations.

The mobile Address country picker uses bundled English country names for all
252 supported countries and territories. It does not depend on the device’s
`Intl.DisplayNames` support; selection still stores the country code.

Main and child profile detail screens omit the account role/status visibility
section. Contact & Security also omits the Role/Status account card and its Edit action.

In Appearance, Theme opens a native sheet listing System, Light, and Dark. Accent
choices show circular initial avatars using the same colors as profile avatars.
Both selections remain drafts until the section’s confirmed Save action.

Parent homepage tiles offer **Refer another parent** and **Add another child**
as the first tile inside the Overview row. A vertical, paged carousel shows one
suggestion at a time; the next control and screen-reader adjustment actions also
switch suggestions. They are hidden from other roles and while viewing as a child.
Add Child opens the existing managed-child form. Referral details opens a reward
explainer followed by native sharing of a personal website invitation. New parents
can sign up on the web with automatic attribution, or enter a referring parent’s
name during onboarding. The $20 discount is confirmed and fulfilled manually in
Stripe. See [Parent Referrals](parent-referrals.md) for rollout and review details.

The close button dismisses the entire suggestions tile. Dismissals are device-local presentation
preferences in AsyncStorage, scoped by organization, guardian account, carousel ID
and version. They survive app restarts without changing profile or family data.
A failed save keeps the tile visible and offers a retry.
