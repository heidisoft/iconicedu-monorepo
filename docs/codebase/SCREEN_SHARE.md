# Development Goal: Collaborative Screen Annotation Using Konva + Supabase Realtime

## 1. Goal

Build a production-ready collaborative annotation system that overlays Zoom Video SDK screen sharing and replaces Zoom's built-in annotation functionality.

The solution must:

- Use **Konva / react-konva** for rendering annotations.
- Render as a transparent layer directly over the Zoom screen-share surface.
- Synchronize annotations between tutor and students using **Supabase Realtime Broadcast**.
- Use **Supabase Presence** only for participant presence and slowly changing state.
- Persist annotation state only where useful; realtime drawing must not require a database write for every pointer movement.
- Match the functionality users expect from Zoom annotation.
- Work correctly at different screen sizes, resolutions, aspect ratios, browser zoom levels and device pixel ratios.
- Support mouse, trackpad, touch and stylus input.
- Be architected independently of Zoom so the same annotation engine can eventually annotate PDFs, images, whiteboards or other shared content.
- Be optimized first for 1:1 tutoring while supporting group classes without architectural changes.

---

# 2. Core Architecture

Implement annotation as a separate presentation layer.

```text
Class Session
│
├── Zoom Video SDK
│      │
│      └── Screen Share
│
├── SharedContentSurface
│      │
│      ├── ZoomScreenShareRenderer
│      │
│      └── AnnotationOverlay
│             │
│             └── Konva Stage
│                   │
│                   ├── RemotePointerLayer
│                   ├── AnnotationLayer
│                   ├── TemporaryDrawingLayer
│                   ├── SelectionLayer
│                   └── UI/SpotlightLayer
│
├── Annotation Engine
│      ├── Tool Controller
│      ├── Coordinate System
│      ├── Object Store
│      ├── History Manager
│      ├── Permission Engine
│      ├── Realtime Sync
│      └── Persistence Manager
│
└── Supabase
       ├── Broadcast
       ├── Presence
       ├── Postgres
       └── Storage
```

The Zoom Video SDK must only be responsible for:

- video
- audio
- participant session
- screen sharing

Our annotation engine must own all annotation behavior.

Do not call Zoom's annotation API for normal annotation.

---

# 3. Screen Share Integration

Create:

```text
<SharedContentSurface>
    <ZoomShareSurface />
    <AnnotationOverlay />
</SharedContentSurface>
```

DOM structure should conceptually resemble:

```tsx
<div className="relative overflow-hidden">
  <ZoomScreenShare />

  <AnnotationOverlay className="absolute inset-0" />
</div>
```

The annotation surface must always align with the **actual displayed shared-content rectangle**, not merely the surrounding container.

This is important when the shared display is letterboxed.

For example:

```text
Browser container
┌───────────────────────────────┐
│                               │
│ ┌───────────────────────────┐ │
│ │       shared screen       │ │
│ │                           │ │
│ └───────────────────────────┘ │
│                               │
└───────────────────────────────┘
```

Annotations must align with the inner screen-share rectangle.

---

# 4. Coordinate System

Never synchronize raw screen pixels.

Internally store annotation coordinates in normalized content coordinates.

```ts
type NormalizedPoint = {
  x: number; // 0–1
  y: number; // 0–1
};
```

Example:

```ts
{
  x: 0.4375,
  y: 0.6812
}
```

Convert during rendering:

```ts
renderX = x * contentWidth;
renderY = y * contentHeight;
```

The same drawing must therefore appear correctly when:

```text
Tutor:
2560 × 1440

Student:
1366 × 768

Tablet:
1024 × 768
```

The coordinate transformation system must account for:

- screen-share source aspect ratio
- viewer aspect ratio
- letterboxing
- container resizing
- browser zoom
- CSS transforms
- fullscreen
- picture-in-picture layouts
- devicePixelRatio
- orientation changes
- responsive layout changes

Create a dedicated:

```ts
AnnotationCoordinateService;
```

with functions similar to:

```ts
clientToNormalized();
normalizedToStage();
stageToNormalized();
getContentBounds();
```

All tools must use this service rather than performing coordinate calculations independently.

---

# 5. Annotation Tools — Zoom Feature Parity

Implement a unified tool model.

```ts
type AnnotationTool =
  | 'cursor'
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'vanishingPen'
  | 'line'
  | 'arrow'
  | 'doubleArrow'
  | 'rectangle'
  | 'rectangleFilled'
  | 'rectangleHighlight'
  | 'ellipse'
  | 'ellipseFilled'
  | 'ellipseHighlight'
  | 'diamond'
  | 'text'
  | 'eraser'
  | 'spotlight'
  | 'pointerArrow'
  | 'stampCheck'
  | 'stampX'
  | 'stampStar'
  | 'stampHeart'
  | 'stampQuestion';
```

## Pen

Support:

- freehand drawing
- smoothing
- pressure when available
- configurable width
- configurable color
- rounded line caps
- rounded joins
- mouse
- touch
- Apple Pencil/stylus

Konva can represent freehand drawing as vector lines, which also makes undo/redo and backend persistence straightforward.

Use pointer events rather than separate mouse/touch implementations whenever possible.

---

# 6. Highlighter

Highlighter must behave differently from the pen.

Properties:

```text
semi-transparent
wide stroke
rounded edges
does not obscure underlying screen content
```

Suggested defaults:

```ts
opacity: 0.25;
width: 18;
```

Allow:

```text
Thin
Medium
Thick
```

Do not implement highlighting merely by choosing a transparent pen color. Treat it as its own tool.

---

# 7. Straight Line

Drag from point A to point B.

Support:

- live preview
- line width
- color
- selection
- resize
- movement
- delete
- undo
- redo

---

# 8. Arrow

Support:

```text
single arrow
double-headed arrow
```

Drag to define:

```text
start
end
```

Use Konva Arrow where appropriate.

Arrowheads should scale with stroke width.

---

# 9. Rectangle

Support three variants.

### Outline

```text
□
```

### Filled

```text
■
```

### Semi-transparent highlight

```text
▧
```

The semi-transparent version is useful for visually highlighting part of shared content without obscuring it.

---

# 10. Ellipse / Circle

Provide the same variants:

```text
outline
filled
semi-transparent
```

Shift modifier should constrain to a perfect circle on desktop.

---

# 11. Diamond

Implement a resizable diamond shape.

Useful for parity with Zoom's extended annotation tools.

---

# 12. Text Tool

Click anywhere on shared content and create an editable text object.

Support:

- text color
- font size
- bold
- italic
- text alignment where practical
- multiline text
- editing existing text
- move
- resize
- delete

Expected flow:

```text
Select Text
    ↓
Click screen
    ↓
HTML textarea positioned over canvas
    ↓
Type
    ↓
Enter / click outside
    ↓
Create Konva.Text
```

Do not attempt to perform rich text editing directly inside canvas.

Use an HTML textarea/input positioned over the corresponding Konva coordinates.

---

# 13. Eraser

Support two modes.

### Object Eraser

Click/touch an annotation and delete the entire object.

This should be the default because it produces deterministic collaborative behavior.

### Stroke Eraser

Optional advanced mode allowing portions of pen/highlighter paths to be erased.

Do not implement the collaborative version simply using:

```ts
globalCompositeOperation = 'destination-out';
```

unless the resulting state can be represented deterministically for remote users.

Prefer vector path splitting where feasible.

---

# 14. Select Tool

The sharer/tutor must have Zoom-style selection functionality.

Users can:

- click object
- drag selection rectangle
- select multiple objects
- move selected objects
- resize
- rotate where appropriate
- delete
- duplicate
- modify formatting
- change layer ordering if enabled

Use:

```text
Konva.Transformer
```

for interactive object manipulation.

Selection must respect permissions.

A student must not automatically be able to manipulate another student's annotations.

---

# 15. Spotlight

Implement Zoom-style temporary spotlight.

When enabled:

```text
Tutor cursor
      ↓
visible red/colored spotlight
      ↓
all participants see movement
```

Do NOT persist spotlight position.

Broadcast pointer position at a throttled rate.

Example:

```text
20–30 updates/sec
```

Interpolate remote movement for visual smoothness.

Spotlight events should expire quickly if updates stop.

---

# 16. Pointer Arrow

Implement Zoom-style pointer arrow.

When clicked:

```text
↓
place temporary arrow
↓
show participant's name
```

Placing another pointer arrow from the same participant removes/replaces their previous pointer arrow.

Example:

```text
      ↓
   Heshan
```

This is not the same as a permanent Arrow drawing.

---

# 17. Vanishing Pen

Implement temporary drawing.

Tutor draws normally.

After approximately:

```text
2–5 seconds
```

the mark fades and disappears.

Recommended lifecycle:

```text
draw
 ↓
remain visible
 ↓
fade opacity
 ↓
remove
```

Do not write vanishing strokes to persistent storage.

Synchronize:

```ts
createdAt;
expiresAt;
```

so all clients remove the object consistently.

---

# 18. Stamps

Implement Zoom-style stamps.

Minimum:

```text
✓ Check
✕ X
★ Star
♥ Heart
? Question
➜ Arrow
```

Treat stamps as vector annotation objects.

Additional education stamps may later include:

```text
Correct
Try Again
Great Job
Important
Homework
```

but Zoom parity comes first.

---

# 19. Formatting Controls

Create a common formatting popover.

### Colors

Provide standard presets plus customizable color.

Suggested defaults:

```text
Black
Red
Orange
Yellow
Green
Blue
Purple
White
```

### Stroke width

At minimum:

```text
Thin
Medium
Thick
```

Internally use numeric values.

Example:

```ts
1;
3;
6;
10;
18;
```

### Opacity

Expose where appropriate.

Especially:

```text
highlighter
filled highlight shapes
```

### Text

Support:

```text
size
color
bold
italic
```

Store formatting on each annotation object rather than relying on global toolbar state.

---

# 20. Annotation Object Model

Every permanent annotation must have a consistent representation.

Example:

```ts
interface AnnotationObject {
  id: string;

  roomId: string;
  shareSessionId: string;

  type: AnnotationType;

  creatorId: string;
  creatorName: string;
  creatorRole: 'educator' | 'student' | 'staff';

  geometry: AnnotationGeometry;

  style: AnnotationStyle;

  createdAt: number;
  updatedAt: number;

  version: number;

  locked?: boolean;
  deleted?: boolean;
}
```

Example pen object:

```ts
{
  id: 'ann_abc123',
  type: 'pen',

  creatorId: 'teacher-123',

  geometry: {
    points: [
      [0.12, 0.33],
      [0.13, 0.34],
      [0.14, 0.36]
    ]
  },

  style: {
    color: '#ff0000',
    width: 4,
    opacity: 1
  }
}
```

---

# 21. Layers

Do not render everything in one Konva layer.

Use separate layers.

```text
Konva Stage
│
├── PersistentAnnotationLayer
│
├── ActiveDrawingLayer
│
├── RemotePointerLayer
│
├── SelectionLayer
└── SpotlightLayer
```

This reduces redraw work.

Pointer/spotlight updates must not force thousands of permanent annotations to redraw.

---

# 22. Realtime Architecture

Use a private Supabase Realtime channel per active class/share session.

Example:

```text
annotation:class:{classId}:share:{shareSessionId}
```

Example:

```text
annotation:class:a83f:share:592c
```

Supabase recommends Broadcast for high-frequency events and collaborative applications.

Use:

### Broadcast

For:

```text
drawing points
cursor position
spotlight position
object preview
object creation
object update
object deletion
undo/redo commands
clear operations
tool activity
```

### Presence

Only for:

```text
who is connected
participant role
annotation capability
current annotation enabled state
```

Do not use Presence for cursor movement; Supabase specifically warns that rapid Presence updates can flood a channel.

---

# 23. Realtime Events

Define a strict event protocol.

```ts
type AnnotationRealtimeEvent =
  | StrokeStartEvent
  | StrokePointsEvent
  | StrokeEndEvent
  | ObjectCreateEvent
  | ObjectUpdateEvent
  | ObjectDeleteEvent
  | PointerMoveEvent
  | SpotlightMoveEvent
  | UndoEvent
  | RedoEvent
  | ClearEvent
  | PermissionChangedEvent
  | SnapshotRequestEvent
  | SnapshotResponseEvent;
```

Examples:

```text
annotation.stroke.start
annotation.stroke.points
annotation.stroke.end

annotation.object.create
annotation.object.update
annotation.object.delete

annotation.pointer.move
annotation.spotlight.move

annotation.history.undo
annotation.history.redo

annotation.clear.mine
annotation.clear.others
annotation.clear.all

annotation.permissions.update
```

---

# 24. Optimize Drawing Traffic

Never broadcast the entire pen object on every pointer event.

Instead:

```text
pointerdown
    ↓
stroke.start

pointermove
    ↓
buffer points

every ~30–50 ms
    ↓
stroke.points

pointerup
    ↓
stroke.end
```

Batch multiple points together.

Example:

```ts
{
  event: 'annotation.stroke.points',

  annotationId: 'abc',

  seq: 14,

  points: [
    [0.344, 0.281],
    [0.347, 0.284],
    [0.351, 0.289]
  ]
}
```

Each packet should contain a sequence number.

---

# 25. Realtime Reliability

Realtime drawing should remain responsive even with:

```text
latency
packet reordering
temporary disconnect
duplicate messages
```

Every event should contain:

```ts
{
  (eventId, annotationId, clientId, userId, sequence, timestamp);
}
```

Make event processing idempotent.

Ignore already-processed:

```text
eventId
```

Handle out-of-order stroke packets through:

```text
sequence
```

---

# 26. Local-First Drawing

A user's own annotations must appear immediately.

Do NOT:

```text
draw
→ send to server
→ wait
→ receive
→ render
```

Use:

```text
draw locally
       +
broadcast
       ↓
remote clients render
```

The local user should feel essentially zero annotation latency.

---

# 27. Late Joiners

Broadcast alone is insufficient because participants joining after annotations were created need the current state.

Maintain an authoritative annotation snapshot.

When a participant joins:

```text
Join channel
     ↓
Load snapshot
     ↓
Apply realtime events newer than snapshot
     ↓
Ready
```

Snapshots can be stored in Supabase/Postgres.

---

# 28. Persistence Strategy

Do NOT persist every cursor point individually as a database row.

Use three data categories.

### Ephemeral

Never persist:

```text
cursor
spotlight
active drawing preview
vanishing pen
selection handles
```

### Session State

Persist while the class is active:

```text
annotations
ownership
permissions
history checkpoint
```

### Optional Class History

If enabled, persist:

```text
final annotation snapshot
screenshots
exports
```

---

# 29. Suggested Database Tables

## annotation_sessions

```text
id
class_id
zoom_session_id
share_session_id
sharer_user_id
status
created_at
ended_at
```

## annotation_snapshots

```text
id
annotation_session_id
version
snapshot_json
created_at
```

## annotation_permissions

```text
annotation_session_id
user_id
can_annotate
can_save
can_clear_others
updated_at
```

Avoid creating one database row per mouse movement.

---

# 30. Snapshotting

Periodically create state snapshots.

Possible trigger:

```text
every 30–60 seconds
OR
after N completed annotation operations
```

Also snapshot:

```text
screen share stops
class ends
presenter changes
```

Snapshot format:

```ts
{
  schemaVersion: 1,
  revision: 328,
  objects: [...]
}
```

Snapshots must be versioned to allow schema migrations.

---

# 31. Permissions

Support Zoom-equivalent annotation control.

### Tutor / Presenter

Can:

```text
annotate
select own objects
select all objects
move objects
erase
undo
redo
clear mine
clear student annotations
clear all
enable/disable student annotation
show/hide annotator names
save/export
```

### Student

When annotation permission is enabled:

```text
annotate
edit own objects
erase own objects
undo own actions
redo own actions
clear own annotations
```

Student must NOT be able to:

```text
clear tutor annotations
clear another student's annotations
modify another user's annotation
change annotation permission
```

unless explicitly enabled by a future policy.

---

# 32. Enable / Disable Participant Annotation

Tutor gets:

```text
Allow students to annotate
ON / OFF
```

Changes must propagate immediately.

When disabled:

- active student drawing ends safely
- student annotation toolbar becomes read-only/hidden
- existing student annotations remain unless explicitly cleared
- student can still see tutor annotations
- tutor retains annotation capability

---

# 33. Annotator Names

Support:

```text
Show names of annotators
```

When enabled, briefly display:

```text
Senya
```

near the annotation being created.

Name fades after a configurable period.

Do not permanently embed names into annotation geometry.

---

# 34. Clear Controls

Implement:

```text
Clear My Annotations
Clear Students' Annotations
Clear All Annotations
```

This matches Zoom's distinction between clearing mine, others/viewers and everything.

All clear operations must be authorization checked server-side where appropriate.

---

# 35. Undo / Redo

Undo/redo must operate against semantic actions.

Example:

```text
create rectangle
move rectangle
change color
delete rectangle
```

Each is an operation.

Use a command/history model rather than simply retaining canvas screenshots.

Suggested command:

```ts
interface AnnotationCommand {
  id: string;
  userId: string;

  type: 'create' | 'update' | 'delete' | 'clear';

  before?: AnnotationObject;
  after?: AnnotationObject;

  timestamp: number;
}
```

Student undo applies to their actions.

Tutor can undo their own normal actions.

Global moderation operations should be handled explicitly.

---

# 36. Presenter Change

Handle screen-share changes correctly.

If:

```text
Tutor A stops sharing
Student B begins sharing
```

start a new:

```text
shareSessionId
```

Do not accidentally overlay previous annotations onto the new screen.

Optionally ask:

```text
Clear annotations
Keep previous annotation session
```

but previous coordinates must never automatically apply to unrelated shared content.

---

# 37. Screen Share Pause

If Zoom screen share pauses:

- preserve annotations
- disable or optionally continue annotation based on UX decision
- maintain geometry
- reconnect to same share session when share resumes

If source resolution changes:

- recompute transform
- keep normalized objects unchanged

---

# 38. Save / Export

Match Zoom's Save behavior.

Provide:

```text
Save PNG
Save PDF
```

PNG should combine:

```text
current visible shared screen
+
visible annotation layer
```

PDF can initially create one-page output for current screen.

Future PDF/page workflows may support multiple pages.

Also provide:

```text
Annotations Only
```

as an optional export.

Do not depend on Zoom's annotation export.

---

# 39. Toolbar UX

Primary toolbar:

```text
┌─────────────────────────────────────────────────────────────┐
│ Mouse │ Select │ Draw │ Text │ Stamp │ Spotlight │ Eraser │
│       │        │      │      │       │           │        │
│ Undo │ Redo │ Clear │ Format │ Save │ More              │
└─────────────────────────────────────────────────────────────┘
```

"Draw" opens:

```text
Pen
Highlighter
Line
Arrow
Double Arrow
Rectangle
Rectangle Highlight
Ellipse
Ellipse Highlight
Diamond
Vanishing Pen
```

"Stamp" opens:

```text
Arrow
Check
X
Star
Heart
Question
```

---

# 40. Compact Tutor UX

Avoid making the tutoring interface look like Photoshop.

Default visible toolbar should expose:

```text
Pointer
Pen
Highlighter
Shape
Text
Eraser
Undo
More
```

Advanced tools appear in popovers.

Desktop toolbar should be draggable and dockable.

Support:

```text
top
bottom
left
right
floating
```

Store toolbar position locally per user.

---

# 41. Keyboard Shortcuts

At minimum:

```text
V  Cursor/Select
P  Pen
H  Highlighter
T  Text
E  Eraser

Cmd/Ctrl + Z
Undo

Cmd/Ctrl + Shift + Z
Redo

Delete / Backspace
Delete selected object

Escape
cancel current operation
```

Do not interfere with shortcuts intended for the shared application when annotation mode isn't active.

---

# 42. Pointer Event Handling

Use:

```text
PointerEvent
```

rather than implementing three unrelated input systems.

Support:

```text
mouse
touch
stylus
```

Detect:

```ts
event.pointerType;
```

Where supported, capture:

```text
pressure
tiltX
tiltY
```

Pressure-sensitive pen width can be an optional preference.

---

# 43. Touch UX

On tablets:

One-finger behavior when annotation enabled:

```text
draw
```

Two-finger behavior:

```text
do not draw
allow browser/app gesture where appropriate
```

Prevent accidental annotations caused by palm touches where reasonable.

Buttons must meet touch-target accessibility requirements.

---

# 44. Performance Targets

Annotation must remain smooth under ordinary tutoring conditions.

Target:

```text
local input rendering: ~60 FPS
remote visible latency: <150 ms typical
pointer update: 20–30 Hz
```

Avoid React state updates on every pointer pixel.

Use:

```text
refs
batched point buffers
Konva imperative updates where justified
```

Commit completed objects into application state.

Konva itself notes that large numbers of free-drawing lines require additional optimization, so the implementation must account for long sessions rather than treating every pointer event as a React render.

---

# 45. Annotation Simplification

Freehand drawing creates large point arrays.

Apply path simplification after stroke completion.

Potential algorithm:

```text
Ramer-Douglas-Peucker
```

Do not simplify aggressively while the stroke is still being drawn.

Goal:

```text
reduce point count
without visible geometry degradation
```

---

# 46. Konva Rendering Optimization

Use:

```text
multiple Layers
batchDraw()
listening={false}
```

where appropriate.

Remote cursors should exist on a different layer from permanent drawings.

For large histories:

- consider caching completed groups
- disable hit detection for non-interactive objects
- periodically compact/snapshot state
- remove expired objects immediately

---

# 47. Conflict Handling

Two participants may modify state simultaneously.

Use object version numbers.

Example:

```ts
{
  id: 'annotation123',
  version: 8
}
```

Updates contain:

```ts
baseVersion: 8;
nextVersion: 9;
```

For classroom annotation, avoid implementing a complex CRDT unless actual requirements demand it.

Most objects have a single owner, dramatically reducing conflicts.

Tutor moderation commands take precedence.

---

# 48. Security

Never trust client-side roles.

Supabase authorization must validate class participation.

Realtime channel:

```text
private
```

RLS/policies must ensure:

```text
only participants of class X
can access annotation channel X
```

Students must not be able to construct a client request that:

```text
clears everyone's annotations
enables annotation
modifies tutor objects
```
