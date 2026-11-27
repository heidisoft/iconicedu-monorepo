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
the address or regional fields. Main and child profiles retain grouped settings rows.
Each editable row opens its own input or selection sheet directly; section-level
Edit text is removed. The display name below the avatar opens only Display Name.
Photo uses a camera action below the avatar and the native source chooser.
Names, bio, city, free-text region, postal code and spoken languages open focused
text editors with Save and a left-side close action. Birth year, grade, country,
region, timezone, locale and theme open selection lists with the current value
selected. Accent Color opens the avatar color choices. Each change requires
confirmation before the existing authorized, audited API write. Theme mode remains
a device preference and requires confirmation before changing locally.
Closing an editor discards unsaved input; cancelling confirmation retains it for
correction. Failed saves keep the editor open for retry. Read-only guardians see
the values without edit actions. Add child retains inline entry.
Country changes first select the country, then collect the address fields required
for that country in a local draft. Confirmation saves the complete valid address;
cancelling preserves the previous address. When no country is set, tapping an
address row starts this country/address flow. Existing addresses allow individual
city, region and postal-code editing while preserving the other address values.
Profile and child-profile inputs share onboarding sizing, padding, theme colors
and focus borders. No section editor is shown between a settings row and its
individual field input or picker, except the dependent address setup after changing
country.
Every save and removal requires a mobile confirmation. The photo camera action sits
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
Each selection requires confirmation; accent changes are audited by the API.

Parent homepage tiles offer **Refer another parent** and **Add another child**
as the first tile inside the Overview row. A vertical, paged carousel shows one
suggestion at a time; the next control and screen-reader adjustment actions also
switch suggestions. They are hidden from other roles and while viewing as a child.
Add Child opens the existing managed-child form. Referral details opens a reward
explainer followed by native sharing of a personal website invitation. New parents
can sign up on the web with automatic attribution, or enter a referring parent’s
name during onboarding. The $20 discount is confirmed and fulfilled manually in
Stripe. See [Parent Referrals](parent-referrals.md) for rollout and review details.

The close button dismisses only the active suggestion and reveals the next
remaining suggestion, wrapping to the first when the last is removed. The stack
hides only after all eligible suggestions are dismissed. Dismissals are device-local
AsyncStorage preferences scoped by organization, guardian account and stable
suggestion ID. They survive app restarts without changing profile or family data.
Legacy whole-stack dismissal records are superseded by these per-suggestion keys,
so they do not hide unrelated suggestions. A failed save keeps the active
suggestion visible and offers a retry.

The same parent Overview suggestion stack also offers **Request a class** when a
child profile is available. It uses a flat mint surface with a dark variant, and
opens the existing first-time Explore Classes sheet. Student and subject selection,
request validation, the authenticated onboarding class-request endpoint and the
resulting request conversation are shared with the original homepage CTA. Parents
can request another class even when they already have active subjects. The slide
is independent of the referral flag; parent-role and child-view restrictions still
apply to the entire stack. Per-suggestion dismissals remain respected.

Add child and Request a class homepage suggestions first open introductory native
sheets matching the referral explainer: colored hero, required information, next
steps and a fixed continue action. Add child also links to Invite by email. Closing
an intro creates no profile or request. Continuing closes the intro before opening
the existing form; iOS waits for native dismissal before presenting another sheet.
Child creation retains its final confirmation. Class requests retain the existing
Explore Classes form and request-conversation behavior.

The suggestion carousel gives one gentle upward peek and a soft spring return,
after 2.2 seconds on its first visible,
laid-out homepage presentation with multiple slides. A parent/device-scoped local
preference remembers the introduction (version 2 for the peek animation). The hint
briefly reveals the next tile while keeping the current tile selected. Animation
runs on the native driver and resets immediately on user interaction. Manual interaction cancels it; it does not
repeat or run while the homepage is unfocused or the app is backgrounded. Reduce
Motion and screen-reader users keep manual controls. The carousel keeps its
existing height, paging, navigation controls and dismissal preference.

Explore Classes uses a native page sheet with a left-side close action, a mint
header, larger text and a fixed Submit request button above the safe area and
keyboard. Students and Subjects open searchable multi-select sheets rather than
chips. Done applies a local selection draft; Cancel/native Back preserves the
previous choices. Multiple students/subjects and the custom Other subject remain
supported. Learning goals and special requirements are optional text areas. No
request is written until Submit request; duplicate submissions are guarded, failed
requests retain the draft for retry, and successful submission opens the same
request conversation. The homepage empty state and suggestion intro share this
single form component.

A permanent **More for your family** tile sits after the other Overview metrics for
parents outside child view. It opens an action list linking to the same referral,
Add child and class-request introductions, including dismissed suggestions.
Referral actions remain behind `enable-parent-referrals`; class requests require a
child profile. This tile is independent of suggestion dismissal preferences.

After a suggestion dismissal is saved, the active suggestion gently shrinks and
fades out before revealing the next remaining suggestion in the first slot.
The carousel container and Overview scroll position stay fixed; only the active
slide animates and is removed. Each slide owns its dismissal animation value so
a late native animation completion cannot make a remaining slide transparent. The native pager is recreated when its remaining
slide IDs change so deleting the last page cannot leave an empty scroll offset. The permanent action tile receives a brief outline
without scrolling away from the remaining suggestions. Screen-reader users get
an announcement of where the action remains available. Reduce Motion skips the
exit animation and uses a static outline. A storage failure leaves the suggestion visible and
does not trigger the transition. Native sheets finish dismissing before their
selected action opens another introduction.
