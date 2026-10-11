## Goal

Implement a production-quality collaborative whiteboard for our tutoring platform using **Excalidraw as the underlying canvas/drawing engine**, but **do not expose the default Excalidraw experience as our product UI**.

The whiteboard should feel like a polished, native part of our tutoring application, with UX inspired by modern collaborative products such as **Zoom Whiteboard, Goodnotes, Notability, and Google Meet**, while retaining our own design system and branding.

This feature is primarily for:

- 1-to-1 tutoring
- small-group tutoring
- Math
- ELA / reading
- Science
- test preparation

The architecture must also be extensible so we can later add our own:

- custom icons
- custom shapes
- math manipulatives
- charts
- graphs
- coordinate planes
- number lines
- geometry tools
- science diagrams
- biology symbols
- chemistry equipment
- physics components
- maps
- educational stickers
- reusable teacher resources
- worksheet templates
- AI-generated educational objects

Do not tightly couple these future assets to Excalidraw internals.

---

# 1. Architecture

Use Excalidraw as the canvas engine, but build an application-level abstraction around it.

The architecture should roughly follow:

```text
Classroom
   |
   +-- Video Session
   |
   +-- Whiteboard
          |
          +-- Toolbar
          +-- Canvas Adapter
          |      |
          |      +-- Excalidraw
          |
          +-- Pages
          +-- Asset Library
          +-- Educational Tools
          +-- Collaboration
          +-- Persistence
          +-- Permissions
```

Create an abstraction such as:

```ts
WhiteboardEngine;
```

or:

```ts
CanvasAdapter;
```

so application features do not directly depend everywhere on Excalidraw APIs.

Example responsibilities:

```ts
interface WhiteboardEngine {
  addElement(...)
  updateElement(...)
  deleteElement(...)
  selectElements(...)
  clearPage(...)
  exportScene(...)
  importScene(...)
  zoomToFit(...)
  setTool(...)
  setViewport(...)
}
```

The implementation can currently use:

```ts
ExcalidrawWhiteboardEngine;
```

This will allow us to replace or extend the canvas engine later without rewriting the classroom application.

---

# 2. Whiteboard ownership

Every scheduled tutoring session must be capable of having its own whiteboard.

Never use one global shared whiteboard for all classes.

Model the relationship approximately as:

```text
learningSpace
   |
   +-- classSession
          |
          +-- videoRoom
          |
          +-- whiteboard
                 |
                 +-- pages
```

Example:

```text
Class Session A
  -> Whiteboard A

Class Session B
  -> Whiteboard B
```

A participant must never receive or modify another class's whiteboard data.

Use the application `classSessionId` / domain ID as the ownership boundary.

Do NOT make the Zoom Video SDK session ID the primary identifier for whiteboard persistence.

Video and whiteboard should be independently replaceable components.

---

# 3. Whiteboard lifecycle

The whiteboard must support:

- create board when necessary
- load existing board
- autosave
- reconnect
- restore board
- leave class
- rejoin class
- resume previous work
- multiple pages per class
- optionally copy a previous board into a new session later

Refreshing the browser must not destroy work.

Closing and reopening the class must restore the persisted board.

---

# 4. Native user experience

Do NOT make the page look like embedded Excalidraw.

Hide or replace unnecessary Excalidraw UI.

Build a native application toolbar.

The primary UX should resemble a modern classroom whiteboard.

Example:

```text
┌───────────────────────────────────────────────────────────┐
│ Math Class                                     Saved ✓    │
├───────────────────────────────────────────────────────────┤
│ ↖  ✏  🖍  T  ─  →  □  ○  🧽 | 📐 📊 🧪 | ↶ ↷          │
├───────────────────────────────────────────────────────────┤
│                                                           │
│                                                           │
│                     WHITEBOARD                            │
│                                                           │
│                                                           │
├───────────────────────────────────────────────────────────┤
│  ‹  Page 1 / 4  ›          + Page              100%      │
└───────────────────────────────────────────────────────────┘
```

Use our application's existing components/design tokens whenever available.

Do not create a second unrelated design system.

The UI should feel native to our application.

---

# 5. Responsive behavior

The whiteboard must work properly on:

- desktop
- laptop
- iPad/tablet
- touch screens

Desktop UX should favor precision.

Tablet UX should favor drawing.

Support:

- mouse
- trackpad
- touch
- Apple Pencil/stylus where browser APIs permit

Toolbar behavior should adapt appropriately to screen size.

Do not simply shrink the desktop toolbar onto mobile/tablet.

---

# 6. Core tools

Implement an initial toolbar with:

### Selection

- select
- move
- resize
- multi-select
- delete

### Drawing

- pen
- highlighter
- eraser

### Text

- text tool

### Basic shapes

- line
- arrow
- rectangle
- ellipse/circle

### Editing

- undo
- redo

### View

- zoom in
- zoom out
- reset zoom
- fit content

Keep the initial toolbar intentionally simple.

Avoid showing advanced Excalidraw features unless needed.

---

# 7. Drawing defaults

The visual output should look more appropriate for education than Excalidraw's default sketch style.

Default to:

- solid strokes
- low/no roughness
- clean white canvas
- clean typography
- accessible contrast

Avoid the strongly hand-drawn Excalidraw aesthetic as the default.

Teachers may still be allowed to select other drawing styles later.

---

# 8. Pages

Do NOT rely solely on one giant infinite canvas.

Add a page abstraction.

Example:

```text
Page 1
Page 2
Page 3
+ Add Page
```

Each page should maintain its own scene/content.

Support:

- create page
- switch page
- duplicate page
- delete page
- reorder pages
- clear page

Require confirmation before destructive actions such as:

- clear page
- delete page

Autosave page changes.

Architecture:

```text
Whiteboard
  |
  +-- Page 1
  +-- Page 2
  +-- Page 3
```

Do not tightly bind application pages to undocumented Excalidraw internals.

---

# 9. Extensible educational asset library

Create a reusable asset/library system.

We need the ability to add our own asset packs without modifying core whiteboard code.

Example structure:

```text
WhiteboardLibrary
   |
   +-- Math
   |
   +-- Science
   |
   +-- ELA
   |
   +-- Charts
   |
   +-- Icons
   |
   +-- Custom
```

An educational asset should follow an application-owned schema such as:

```ts
interface WhiteboardAsset {
  id: string;
  name: string;
  category: string;
  type: string;
  thumbnail?: string;
  tags?: string[];
  payload: unknown;
}
```

Do not expose Excalidraw-specific element structures as the public API of our library.

Use an adapter/converter to create Excalidraw elements.

---

# 10. Math library

Prepare the architecture for custom Math elements including:

- coordinate plane
- graph paper
- number line
- fraction bars
- fraction circles
- multiplication arrays
- ten frames
- place-value blocks
- angle diagrams
- geometric shapes
- ruler
- protractor
- compass
- X/Y axis
- tables
- basic charts

We do not necessarily need to fully implement all of these now.

However, implement at least enough sample custom assets/tools to prove the extensibility model works.

For example:

1. coordinate plane
2. number line
3. graph paper

These should be insertable into the whiteboard through our own library UI.

---

# 11. Science library architecture

Prepare an expandable Science library.

Example categories:

```text
Science
 |
 +-- Biology
 |     +-- cell
 |     +-- nucleus
 |     +-- mitochondria
 |     +-- DNA
 |
 +-- Chemistry
 |     +-- beaker
 |     +-- flask
 |     +-- test tube
 |     +-- burner
 |
 +-- Physics
       +-- battery
       +-- resistor
       +-- bulb
       +-- force arrows
       +-- pulley
```

Assets should eventually be searchable.

Example:

```text
Search: "cell"
```

should return appropriate reusable educational assets.

Build the architecture so these libraries can eventually be loaded from the backend rather than hardcoded.

---

# 12. Charts and diagrams

Prepare an extensible abstraction for educational charts.

Examples:

- bar chart
- line chart
- pie chart
- table
- Venn diagram
- T-chart
- flowchart
- timeline

We should eventually be able to create these from structured data instead of manually drawing each shape.

Example:

```ts
insertChart({
  type: "bar",
  data: [...]
})
```

This feature can initially be a simple proof-of-concept, but the architecture should support more sophisticated charts later.

---

# 13. Asset insertion

When a teacher chooses an educational object from the library:

```text
Library
   -> select item
   -> insert onto canvas
```

the object should appear:

- centered in the current viewport
- selected
- at a sensible default size

It should then support normal manipulation such as:

- move
- scale
- duplicate
- delete

---

# 14. Teacher/student permissions

Prepare role-aware whiteboard permissions.

Example roles:

```text
teacher
student
```

Teacher capabilities:

- draw
- erase
- add pages
- delete pages
- clear page
- insert educational assets
- optionally lock student editing

Student capabilities:

- draw
- annotate
- select their permitted elements
- use tools allowed by teacher

Support a future mode:

```text
Student editing: ON / OFF
```

When OFF:

- student can view board
- student cannot modify it
- teacher remains fully interactive

Permission validation must not exist only in client-side UI.

Server-side authorization must enforce access where appropriate.

---

# 15. Collaboration architecture

Structure the application for real-time teacher/student collaboration.

Do not send the entire board state on every pointer movement if avoidable.

Account for:

- incremental updates
- batching/throttling
- presence
- reconnect
- conflict handling
- offline/reconnecting states
- eventual persistence

The collaboration implementation must be separated from the React presentation layer.

Use abstractions such as:

```ts
WhiteboardCollaborationProvider;
```

Possible responsibilities:

```ts
connect();
disconnect();
publishElements();
subscribeToElements();
publishPresence();
subscribeToPresence();
```

If the project already has a realtime solution, integrate with it rather than adding unnecessary infrastructure.

---

# 16. Presence

Display basic collaboration presence.

Example:

```text
● Ms. Lucie
● Senya
```

Optionally display remote cursors if practical.

Avoid excessive cursor updates that generate unnecessary network traffic.

Throttle appropriately.

---

# 17. Persistence

Persist board state reliably.

Autosave should:

- debounce frequent changes
- avoid unnecessary writes
- show basic status

Example:

```text
Saving...
Saved
Offline
Reconnecting...
```

Do not lose work due to transient network interruptions.

---

# 18. Undo/redo

Verify undo/redo carefully.

It must work correctly for normal local editing.

Collaboration must not cause broken or surprising undo behavior.

Write tests covering this explicitly.

---

# 19. Keyboard shortcuts

Support sensible desktop shortcuts where appropriate:

```text
Cmd/Ctrl + Z -> undo
Cmd/Ctrl + Shift + Z -> redo

Delete/Backspace -> remove selection

V -> select
P -> pen
T -> text

+/- -> zoom
```

Do not steal shortcuts when the user is typing into another input field.

---

# 20. Accessibility

Include:

- keyboard-accessible controls
- appropriate ARIA labels
- visible focus state
- accessible tooltips
- good color contrast
- sufficiently large touch targets

Icons must have accessible names.

Do not rely on icon appearance alone.

---

# 21. Performance

The whiteboard must remain responsive during normal tutoring usage.

Be careful about:

- React rerenders on pointer movement
- large serialized scenes
- excessive realtime events
- excessive persistence writes
- unnecessary subscriptions
- memory leaks
- stale event listeners

Use profiling if needed.

Do not put the entire whiteboard state into a global React state store that causes the classroom to rerender on every stroke.

---

# 22. Error handling

Handle:

- failed board load
- failed save
- realtime disconnect
- malformed scene
- missing page
- unauthorized access
- deleted board
- unsupported asset
- asset load failure

Errors should not crash the classroom.

Provide graceful recovery when possible.

---

# 23. Unit tests

Write comprehensive unit tests for the new feature.

Do not implement the feature first and leave testing as TODO.

Tests should be implemented alongside the feature.

Use the project's existing testing framework.

Test at minimum:

### Whiteboard state

- creates board
- loads board
- creates page
- switches page
- deletes page
- duplicates page
- reorders page
- prevents invalid page state

### Canvas adapter

- converts application objects to canvas elements
- adds elements
- deletes elements
- updates elements
- clears page
- exports/imports scene

### Educational assets

- loads asset categories
- searches assets
- inserts asset
- converts asset to canvas representation
- handles invalid assets

### Permissions

- teacher has correct capabilities
- student has correct capabilities
- locked student cannot edit
- unauthorized user cannot access board

### Persistence

- save is debounced
- save failure is handled
- latest valid state is preserved
- loading persisted board restores scene

### Collaboration

- remote update is processed
- local update is published
- reconnect restores subscription
- duplicate/replayed messages do not corrupt scene

Use mocks/fakes where appropriate.

---

# 24. React/component tests

Add component/integration tests for:

- toolbar
- page navigator
- asset library
- search
- teacher lock
- save indicator
- confirmation dialogs
- error state
- disconnected state

Verify user-visible behavior rather than implementation details.

---

# 25. Playwright E2E tests

Create comprehensive Playwright tests.

These must exercise the feature through the real application UI.

Do not only test isolated components.

Include at least these scenarios.

## Test 1 — Open a class

Teacher enters a tutoring class.

Verify:

- whiteboard loads
- canvas visible
- toolbar visible
- correct board is associated with class

---

## Test 2 — Draw

Teacher:

1. selects pen
2. draws on board

Verify:

- drawing appears
- drawing persists

Reload the page.

Verify:

- drawing still exists

---

## Test 3 — Multiple classes are isolated

Create/open:

```text
Class A
Class B
```

Draw:

```text
A
```

on Class A.

Draw:

```text
B
```

on Class B.

Reload both.

Verify:

```text
Class A contains A and not B
Class B contains B and not A
```

This is a critical test.

---

## Test 4 — Pages

Teacher:

1. creates page 2
2. draws unique content
3. switches to page 1
4. switches back

Verify each page maintains independent content.

Reload.

Verify both pages are restored.

---

## Test 5 — Asset library

Open library.

Select:

```text
Math -> Coordinate Plane
```

Insert onto board.

Verify:

- object appears
- can be moved
- can be resized
- can be deleted

---

## Test 6 — Student permissions

Teacher disables student editing.

Using a second browser context representing the student:

Verify:

- board remains visible
- drawing tools are disabled or unavailable
- attempts to mutate the board fail

Teacher enables editing.

Verify student can now draw.

---

## Test 7 — Realtime collaboration

Use two independent Playwright browser contexts:

```text
Context 1 -> Teacher
Context 2 -> Student
```

Teacher draws an object.

Verify it appears for student.

Student writes something.

Verify it appears for teacher.

Do NOT fake the collaboration layer for this test unless absolutely necessary.

---

## Test 8 — Reconnect

Teacher and student are connected.

Simulate network interruption for one client.

Modify board from other client.

Restore connectivity.

Verify the disconnected client catches up without corruption or duplicate elements.

---

## Test 9 — Refresh

Draw several elements.

Refresh browser.

Verify everything persists.

---

## Test 10 — Undo/redo

Create several objects.

Undo.

Verify most recent change disappears.

Redo.

Verify it returns.

---

## Test 11 — Delete/clear confirmation

Attempt to clear the page.

Verify confirmation is shown.

Cancel.

Verify data remains.

Confirm.

Verify page clears.

---

## Test 12 — Responsive tablet experience

Run Playwright using an iPad/tablet-sized viewport.

Verify:

- toolbar remains usable
- controls don't overlap
- canvas remains interactive
- page controls work
- asset panel works

---

# 26. Multi-user test helper

Create reusable Playwright utilities for multi-user classroom tests.

For example:

```ts
createTeacherContext();
createStudentContext();
joinClassAsTeacher();
joinClassAsStudent();
```

Avoid duplicating login/setup code across every collaboration test.

---

# 27. Test IDs

Use stable selectors where required.

Example:

```html
data-testid="whiteboard-toolbar" data-testid="whiteboard-canvas" data-testid="tool-pen"
data-testid="tool-text" data-testid="page-add" data-testid="page-1"
data-testid="asset-library" data-testid="student-editing-toggle"
```

Prefer accessible roles and labels where possible.

Use `data-testid` only when semantic selectors are insufficient.

---

# 28. Testing quality gate

Before declaring implementation complete, run:

- lint
- TypeScript/type checking
- unit tests
- component/integration tests
- Playwright tests
- production build

Fix failures.

Do not disable failing tests simply to get a green build.

Do not use:

```ts
test.skip();
```

or:

```ts
it.skip();
```

as a substitute for fixing the implementation.

Do not lower coverage thresholds.

---

# 29. Existing functionality

Do not break:

- existing classroom behavior
- Zoom Video SDK
- audio/video
- chat
- scheduling
- authentication
- authorization
- classroom navigation

Run relevant existing regression tests.

---

# 30. Code organization

Prefer feature-oriented organization.

For example:

```text
whiteboard/
  components/
    Whiteboard.tsx
    WhiteboardToolbar.tsx
    WhiteboardPages.tsx
    WhiteboardLibrary.tsx
    WhiteboardPresence.tsx

  canvas/
    WhiteboardEngine.ts
    ExcalidrawWhiteboardEngine.ts

  collaboration/
    WhiteboardCollaborationProvider.ts

  assets/
    types.ts
    registry.ts
    math/
    science/
    charts/

  permissions/
    permissions.ts

  persistence/
    repository.ts

  hooks/
    useWhiteboard.ts
    useWhiteboardCollaboration.ts

  tests/
```

Adapt this to the existing project architecture rather than forcing this exact structure if the repository already has established conventions.

---

# 31. Extensibility requirement

A future developer should be able to add:

```text
Science -> Microscope
```

without editing the whiteboard engine itself.

Ideally something similar to:

```ts
registerWhiteboardAsset({
  id: "microscope",
  category: "science",
  ...
})
```

Likewise, it should be possible to add a new toolbar tool through a clear extension point rather than modifying a monolithic component.

Avoid giant `switch` statements spread throughout the application.

---

# 32. Do not over-engineer

Build clean extension points, but don't implement speculative frameworks we don't yet need.

We need:

- good abstractions
- clear boundaries
- testable modules

We do NOT need dozens of empty interfaces or unused plugin systems.

---

# 33. UI expectations

The finished experience should feel approximately like:

**Zoom Whiteboard simplicity + Goodnotes drawing ergonomics + our native classroom UI.**

It should NOT feel like:

> "Excalidraw opened inside an iframe."

Keep the interface calm and focused.

Important actions should be immediately accessible.

Secondary configuration should be behind menus/popovers.

---

# 34. Inspect the existing codebase first

Before implementing:

1. Inspect the existing classroom architecture.
2. Identify the Zoom Video SDK integration.
3. Identify design-system components.
4. Identify auth and classroom roles.
5. Identify realtime infrastructure already available.
6. Identify database/persistence conventions.
7. Identify existing unit testing setup.
8. Identify Playwright setup.
9. Identify monorepo/package conventions.

Reuse existing patterns.

Do not introduce duplicate libraries for capabilities we already have.

---

# 35. Implementation approach

Implement this incrementally.

Suggested order:

```text
1. Canvas adapter
2. Native whiteboard shell
3. Core drawing tools
4. Page abstraction
5. Persistence
6. Collaboration
7. Permissions
8. Educational asset registry
9. Initial Math assets
10. Responsive UX
11. Tests
12. Playwright multi-user tests
13. Regression pass
```

After each meaningful stage, run relevant tests.

---

# 36. Definition of Done

The feature is complete only when:

- every class can have an independent whiteboard
- teacher can draw and edit
- student can collaborate
- board updates appear between participants
- board persists across refresh/rejoin
- multiple pages work
- class isolation is verified
- student editing permissions work
- custom asset library works
- coordinate plane can be inserted
- number line can be inserted
- graph paper can be inserted
- adding future Science/Math assets requires no whiteboard-engine rewrite
- tablet layout works
- existing classroom/video functionality remains functional
- unit tests pass
- integration tests pass
- Playwright tests pass
- multi-user Playwright tests pass
- type checking passes
- lint passes
- production build passes

Do not report the task as complete until those checks have actually been executed.

At the end, provide:

1. summary of architecture implemented
2. files added/changed
3. database/schema changes
4. realtime design
5. testing performed
6. exact test commands run
7. test results
8. known limitations
9. recommended next iteration

Do not claim something was tested unless the command was actually run successfully.
