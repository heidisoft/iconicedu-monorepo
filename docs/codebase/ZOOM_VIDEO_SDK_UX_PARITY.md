# Zoom Video SDK UX Parity

## Purpose

Define the durable UX parity targets for the custom Zoom Video SDK meeting
experience. The visual direction is based on the complete 12-image
[Quickmeet Video Conferencing reference](https://dribbble.com/shots/23433042-Quickmeet-Video-Conferencing),
adapted to IconicEdu theme tokens, Shadcn components, accessibility rules, and
Zoom Video SDK capabilities.

This document is a design and maintenance reference. Planned implementation
work should still be tracked as GitHub issues.

## Intended Audience

Engineers and designers maintaining the web live-session experience.

## Last Updated

2026-10-04

## Related Docs

- [Documentation Hub](../README.md)
- [Zoom Video SDK Integration](ZOOM_VIDEO_SDK_INTEGRATION.md)
- [Web Playwright Guide](../../apps/web/e2e/README.md)

## Priority 0: Screen Sharing

Completed items are marked with `[x]`. `[blocked]` means the installed provider
API cannot implement the behavior. Unmarked items remain parity targets.

1. [x] **Support both desktop sharing compositions.**
   - Without a sidebar: shared content occupies the primary left stage and a
     vertical participant filmstrip occupies the right rail.
   - With People or Messages open: shared content moves above a horizontal
     participant filmstrip while the panel occupies the right column.
   - Do not hide the filmstrip merely because a sidebar is open.

2. [x] **Match the thumbnail rail geometry.**
   - Use compact landscape thumbnails with consistent width, height, radius,
     spacing, and visible tile surfaces.
   - Align the vertical rail with the top and bottom of the presentation area.
   - Keep all participant media render targets mounted while layouts change.

3. [x] **Give shared content a distinct presentation surface.**
   - Preserve the source aspect ratio and use `object-contain` rather than
     stretching or cropping the presentation.
   - Use consistent rounded corners and intentional letterboxing.
   - In light mode, separate the page, presentation, rail, tile, and panel
     surfaces with theme tokens rather than hard-coded colors.

4. [x] **Keep local-share state synchronized with the layout.**
   - Activate the presentation composition as soon as local sharing starts;
     do not wait for Zoom's delayed active-share participant event.
   - Reattach enabled camera streams when tiles move between gallery and
     filmstrip containers.

## Priority 1: Gallery And Tiles

5. [x] **Add stable large-meeting gallery behavior.**
   - Avoid placing every attendee into one continuously expanding grid.
   - Use pagination or an active/recent-speaker selection strategy with a
     stable maximum number of visible tiles.
   - Keep the attendee count independent from the number of rendered tiles.

6. [x] **Provide tile variants by context.**
   - Gallery tiles and filmstrip thumbnails must not share identical metadata
     sizing.
   - Filmstrip names and media indicators should be substantially more compact.
   - Keep the name, microphone state, camera state, and raised-hand state
     readable without obscuring video.

7. [x] **Add active-speaker feedback.**
   - Show a clear audio-level or speaking indicator on the active tile and in
     the participant list.
   - Do not confuse speaking state with static microphone-on state.

8. [x] **Use participant avatars where available.**
   - Prefer a profile or SDK avatar when the camera is off.
   - Use initials as the fallback.
   - Maintain sufficient camera-off contrast in both light and dark modes.

9. [x] **Define multi-device tile rules.**
   - Camera tiles use a stable 16:9 frame on every device and crop camera
     media with `object-cover`, so responsive columns never expose the tile
     background beside a narrower video stream.
   - Screen-share filmstrip thumbnails remain landscape on every device.
   - Shared content is not forced to 16:9: follow Zoom's reported source
     dimensions and use `object-contain` so screens, windows, and slides are
     never cropped or distorted.

## Priority 1: People And Messages

10. [x] **Implement the complete People panel composition.**
    - Match the reference panel width, header scale, row density, corner radius,
      dock alignment, and speech-bubble tail.
    - Retain the required microphone, camera, hand, host, and overflow states
      without overcrowding each row.

11. [blocked] **Add Waiting Room behavior when the provider supports it.**
    - Provide In Meeting and Waiting Room tabs with separate counts.
    - Support approve, reject, and approve-all actions.
    - Confirm Zoom Video SDK admission APIs before presenting these controls;
      do not build nonfunctional UI.
    - The installed `@zoom/videosdk` client exposes no waiting-room admission,
      approve, reject, or approve-all API. Keep these controls absent until the
      provider adds support; use an application-level pre-join gate if this
      workflow becomes a product requirement.

12. [x] **Match the in-call message panel.**
    - Use the title “In-call Messages.”
    - Display sender, relative timestamp, and readable transcript content.
    - Keep the composer fixed to the bottom of the panel.
    - Match the People panel's dimensions, tail, and close behavior.

13. [x] **Match panel motion and stage reflow.**
    - Panels should visually originate from their bottom dock controls.
    - Opening a panel recomposes the gallery or presentation instead of
      covering it.
    - Closing reverses the same transition and restores the previous layout.
    - Respect reduced-motion preferences.

## Priority 2: Meeting Controls And Header

14. [x] **Keep the three-part desktop control layout.**
    - Left: meeting utilities and time.
    - Center: microphone, camera, share, hand, more, and leave controls.
    - Right: People and Messages controls with counts.
    - Prevent count pills and icons from overlapping at every breakpoint.

15. [x] **Align the header with the active media composition.**
    - Meeting title, separator, attendee count, and recording badge align with
      the gallery or presentation boundaries.
    - Typography and spacing remain stable when a panel opens.

16. [x] **Strengthen toolbar active states.**
    - Use IconicEdu theme colors while matching the reference's contrast and
      visual weight.
    - Destructive states remain distinct from selected or active states.
    - Use accessible Shadcn button sizes and focus treatments.

17. [x] **Keep recording state truthful.**
    - Display the recording indicator in the header. Its inactive label is
      RECORDING with a neutral dot; active recording shows a red dot. Keep the
      accessible status explicit when recording is inactive.
    - Change its label and visual state only when Zoom reports recording,
      paused, or stopped status.
    - Host start/stop controls live in More (desktop menu or mobile sheet), use
      the SDK cloud-recording client, and are available without a feature flag.
    - Cloud recording must be enabled on the Zoom account/session. Unsupported
      sessions disable Start; SDK failures leave the confirmed indicator intact.
    - Both active and paused recordings can be stopped. Guests see the shared
      recording indicator without recording controls.

18. **Add the reference utility entry points where they fit the product.**
    - Invite/copy meeting link lives immediately to the left of More in the toolbar.
      Join link and passcode each have a copy button; Copy invitation copies both
      details together.
    - Meeting agenda.
    - Keep these separate from annotation and SDK media controls.

## Priority 2: Invitations And Admission

19. **Add an invite popover.**
    - Support copy-link behavior.
    - Add email invitation only when backed by an API workflow.
    - Anchor the popover to the relevant utility control.

20. **Add admission-request messaging when supported.**
    - Use the standard meeting notice/card pattern.
    - Provide explicit Allow and Reject actions.
    - Keep the notification clear of the toolbar, side panels, and tile
      metadata.

## Priority 3: Product-Scope Decisions

21. **Decide whether meeting agenda belongs inside the SDK experience.**
    - The reference includes agenda completion, edit metadata, and host actions.
    - If adopted, implement it as a separate application feature rather than
      embedding business logic in the Video SDK component.

22. [x] **Keep persistent application navigation outside the meeting embed.**
    - Today's meetings, direct-message previews, settings, and support belong
      to the surrounding application shell.
    - The meeting embed must not take ownership of unrelated application data.

23. [x] **Keep direct messages separate from in-call chat.**
    - New-chat search and private conversations are product messaging features.
    - Zoom in-session chat should remain session-scoped.

24. **Decide the post-call scope.**
    - The reference includes meeting duration, attendee count, quality rating,
      recording information, next meeting, and rejoin.
    - IconicEdu currently needs a simpler feedback flow; add summary details
      only when backed by reliable session data.

Emoji reactions start at the center of the sender's visible participant tile
in both gallery and screen-share layouts, then pop, drift upward, and fade.
The latest emoji also appears temporarily beside the sender in the participants
list, including participants whose tiles are hidden. Raised hands remain visible
on both tiles and the participants list until lowered. Command-channel sender IDs
are normalized from Zoom strings to numeric participant IDs.

Gallery tiles maintain 16:9 proportions and fit within both the available width
and height of their grid cell, including a single participant and an open sidebar.

Annotation uses one floating pencil toggle to start or stop drawing with Zoom's
Pen tool; no custom tool palette is shown. Start, stop, and pen-selection failures
leave the toggle truthful and display a message. Whiteboard start/view/stop/export
also check SDK failure objects. Interactive whiteboard requires a supported
platform and Zoom account permissions; unsupported viewers use the SDK sharing
stream. See [Zoom's whiteboard documentation](https://developers.zoom.us/docs/video-sdk/web/whiteboard/).

## Responsive Requirements

- Desktop uses the complete three-zone toolbar and adaptive gallery/share
  compositions.
- Tablet preserves the shared content as the primary surface and uses a
  horizontal, scrollable participant rail that does not overlap controls.
- Mobile shows essential controls by default and exposes secondary actions
  through More.
- Mobile panels use an accessible sheet or drawer rather than shrinking media
  into an unusable column.
- Respect safe-area insets, orientation changes, keyboard appearance, reduced
  motion, and touch targets of at least 44 CSS pixels.

## Verification

Every parity change should include focused component tests and responsive
Playwright coverage for at least:

- one participant, camera on and camera off;
- four-person gallery;
- gallery with People and Messages panels;
- local and remote screen sharing;
- screen sharing with a panel open;
- phone portrait, tablet portrait, tablet landscape, and desktop;
- light and dark themes;
- recording stopped, active, and paused; and
- raised hand, unread message count, and active-speaker states.

Visual comparisons must verify spacing, bounds, overlap, truncation, focus
visibility, and transitions—not only that controls exist.
