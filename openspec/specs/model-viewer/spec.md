# model-viewer Specification

## Purpose
Rendering the active construct's 3D model in the side panel stage card with three.js: loading, framing, orbit camera, lighting, on-demand rendering, error handling and resource cleanup. (Purpose TBD, synced from change add-model-viewer.)

## Requirements

### Requirement: Default skin is shown in the stage card
When the panel opens, it SHALL load the Display model's GLB (see `display-mode`; by default the active construct's default skin) from
`/<constructId>/models/<skin>.glb` and render it inside the stage card, upright, facing the camera. In Playground the default framing
SHALL show the whole body with some headroom above the head; Display uses its own camera.

#### Scenario: Model appears
- **WHEN** the side panel opens with no Display model saved and is switched to Playground
- **THEN** the stage card shows Shukra's Generic (`/shukra/models/r3qumd010011.glb`) from the front, feet and head both inside the card, over the stage gradient

#### Scenario: Framing follows the model
- **WHEN** a different model is loaded into the viewer in Playground
- **THEN** the camera is framed from that model's bounds without any construct-specific numbers

### Requirement: Manifest hidden nodes are not rendered
The viewer SHALL read the hidden-node lists from the skin's animation manifest and SHALL make the glTF nodes listed for the current
state invisible, and every other mesh node visible, with the user's mesh choices applied on top (see the part-toggles capability): a
mesh the user switched off SHALL be invisible, and a mesh the user switched on SHALL be visible even when the manifest hides it. The
current state's list SHALL be `stateHides[<clip name>]` of the current context when the context has an entry for the playing clip, and
otherwise the context's `hiddenNodes` (also used when a model without clips stands in bind pose); a manifest without these lists hides
nothing. The model SHALL open in the Menu context. The indices SHALL be taken from data and SHALL NOT be hard-coded.

#### Scenario: Default skin
- **WHEN** the default skin loads in the Menu context with `UiStand1`
- **THEN** the nodes with indices 392, 394, 395 and 396 are invisible and all other mesh nodes are visible

#### Scenario: Board action
- **WHEN** `BoardAct0201` plays in the Menu context
- **THEN** the nodes with indices 2, 4, 392, 393 and 396 are invisible and the nodes 394 and 395 are visible

#### Scenario: Fight context
- **WHEN** the Fight context is selected and its default clip plays
- **THEN** the nodes with indices 3, 391, 392, 394, 395 and 396 are invisible

#### Scenario: Hidden mesh on top of the manifest
- **WHEN** `Hair01` (node 8) is switched off on the default skin and `UiStand1` plays
- **THEN** node 8 is invisible as well as 392, 394, 395 and 396, and every other mesh node is visible

#### Scenario: Shown mesh over the manifest
- **WHEN** `BodyEX02` (node 392) is switched on on the default skin and `UiStand1` plays
- **THEN** node 392 is visible and 394, 395 and 396 stay invisible

#### Scenario: Manifest unusable
- **WHEN** the manifest cannot be fetched or `contexts.menu.hiddenNodes` is present but not a list of numbers
- **THEN** the load fails with an error that names the manifest URL and no model is shown

### Requirement: Orbit camera
In Playground, and in Display while adjusting the camera, the user SHALL be able to rotate the camera around the model by dragging, zoom
with the mouse wheel or a pinch, and pan with right-drag or a two-finger drag; otherwise in Display the camera SHALL take no such input
(see `display-mode`). The orbit target SHALL be at about mid-body height, so a full-body view is vertically centred. Zoom SHALL go towards
the point under the pointer. The closest zoom SHALL be 0.15 × the model's height, whatever the panel's width (a face close-up with the
eyes filling the view), and the farthest 2× the full-body distance (the distance at which the whole body, arms and hair included, fits the
canvas); the camera SHALL NOT go below the floor plane. `resetCamera()` SHALL restore the default framing of the mode.

#### Scenario: Orbit
- **WHEN** the user drags horizontally across the stage in Playground
- **THEN** the camera moves around the model and the view updates

#### Scenario: Locked in Display
- **WHEN** the user drags across the stage in Display without adjusting the camera
- **THEN** the camera does not move

#### Scenario: Zoom limits
- **WHEN** the user zooms in or out as far as possible
- **THEN** the camera distance stays between 0.15 × the model height and 2× the full-body distance

#### Scenario: Zooming out past the default
- **WHEN** the user zooms out from the default framing until the zoom stops
- **THEN** the whole body, arms and hair included, is in view

#### Scenario: Face close-up in a narrow panel
- **WHEN** the panel is 360 px wide and the user scrolls the wheel with the pointer on the face until the zoom stops
- **THEN** the eyes fill the view

#### Scenario: Reset
- **WHEN** the camera has been moved in Playground and `resetCamera()` is called
- **THEN** the camera returns to the default framing

### Requirement: Neutral lighting and original materials
The scene SHALL use neutral lighting (a hemisphere light and one directional light, no tone mapping and no
shadows except the toon look's tone mapping and the character's self-shadow while toon shading is on, see the toon-shading
capability). It SHALL draw the model either with the GLB's own materials or, when toon shading is on (the default, see the
toon-shading capability), with toon materials and outlines built from the materials' own parameters; custom shaders SHALL be used
only for toon shading. The light level and the direction
of the directional light SHALL be adjustable (see the viewer-display capability) and SHALL drive both kinds of material, and the
model's meshes SHALL be drawable as wireframe on request; otherwise the lights and materials are the defaults. The renderer
background SHALL be transparent so the stage card's background shows behind the model.

#### Scenario: Stage background
- **WHEN** the model is displayed
- **THEN** pixels not covered by the model show the stage card's background (the gradient by default)

#### Scenario: Default lighting
- **WHEN** the lighting is at its defaults
- **THEN** the hemisphere light has intensity 1.6 and the directional light has intensity 2.2

#### Scenario: Original materials
- **WHEN** toon shading is switched off
- **THEN** every mesh shows the material the GLB assigns to it and there are no outlines, no shadows and no tone mapping

### Requirement: Viewer follows its container size
The canvas SHALL always match its container's size without distortion, using a device pixel
ratio capped at 2. A container with zero width or height SHALL be ignored until it has a size again.

#### Scenario: Panel resized
- **WHEN** the user resizes the side panel from 320 px to 600 px wide
- **THEN** the canvas fills the stage card at the new size and the model is not stretched

#### Scenario: High pixel density
- **WHEN** `devicePixelRatio` is 3
- **THEN** the renderer uses a pixel ratio of 2

### Requirement: Rendering happens on demand
The viewer SHALL render a frame only when something changed: camera movement, resize, model
load, an explicit render request, a clip that is playing, or auto-rotate. While a clip plays or the camera auto-rotates and nothing
else changes, it SHALL render at most 30 frames per second. When playback is paused, finished, or in bind
pose, auto-rotate is off and nothing else changes, it SHALL NOT render frames.

#### Scenario: Idle panel
- **WHEN** playback is paused, auto-rotate is off, and the user does not interact for 2 seconds
- **THEN** the renderer's frame counter does not increase during that time

#### Scenario: Playing clip
- **WHEN** a clip plays for 2 seconds without camera interaction
- **THEN** between 40 and 62 frames are rendered in that time

#### Scenario: Interaction
- **WHEN** the user drags to orbit
- **THEN** frames are rendered for as long as the camera moves

### Requirement: Loading state
While a model loads, the stage card SHALL show a spinner with the load percentage when the
loader reports a total size, or an indeterminate spinner when it does not. The camera controls
SHALL NOT respond until the model is shown.

#### Scenario: Total size known
- **WHEN** the GLB is being loaded and the loader reports a total size
- **THEN** the stage card shows a spinner and a percentage that increases toward 100%

#### Scenario: Total size unknown
- **WHEN** the GLB is being loaded and the loader cannot report a total size (as is the case for files served from the extension)
- **THEN** the stage card shows a spinner without a percentage

### Requirement: Load errors are reported with a retry
When the model or its manifest fails to load, the stage card SHALL show a short message that
includes the URL that failed and a Retry button. The header and tabs SHALL stay usable. Pressing
Retry SHALL attempt the load again.

#### Scenario: Missing asset
- **WHEN** the served model path is missing and the panel opens
- **THEN** the stage card shows an error message containing the model URL and a Retry button

#### Scenario: Retry succeeds
- **WHEN** the asset becomes available and the user presses Retry
- **THEN** the model loads and is displayed

### Requirement: WebGL context loss is recoverable
If the WebGL context is lost after start-up, the viewer SHALL show the load error state with a
Retry button instead of a frozen or blank canvas, and Retry SHALL create a fresh viewer.

#### Scenario: Context lost
- **WHEN** the browser reports `webglcontextlost` for the viewer's canvas
- **THEN** the stage card shows an error with Retry, and pressing Retry displays the model again

### Requirement: Resources are released
Loading a model SHALL first dispose the previous model's geometries, materials and textures.
Disposing the viewer SHALL cancel the render loop, disconnect the resize observer, dispose the
controls and renderer, and release the WebGL context. A model load still in progress SHALL be
cancelled and its result discarded.

#### Scenario: Repeated loads do not leak
- **WHEN** the default model is loaded and disposed ten times in a row
- **THEN** the renderer's geometry and texture counts after the last load equal those after the first

#### Scenario: Unmount
- **WHEN** the Model tab is removed from the panel
- **THEN** no animation frame callback of the viewer remains scheduled and its WebGL context is released

### Requirement: Viewer reports resource statistics
The viewer SHALL expose statistics for the loaded model: counts of geometries and textures,
draw calls and triangles of the last frame, and an estimate of texture memory in bytes. The
measured values for the default skin SHALL be recorded in `AGENTS.md`.

#### Scenario: Stats available
- **WHEN** the default model is displayed and `getStats()` is called
- **THEN** it returns the geometry count, texture count, triangle count and an estimated texture size in bytes, all greater than zero

### Requirement: No part disappears up close
Every mesh of the shown model, and its outline, SHALL be drawn whatever the camera's distance and angle and the clip's pose; no part
SHALL be skipped because of a bounding volume that does not follow the animation.

#### Scenario: Face close-up during a Board action
- **WHEN** Shukra plays `BoardAct0201`, paused mid-clip, with the camera at its closest on the face and turned around it
- **THEN** the eyes and the face stay drawn at every angle

### Requirement: Default framing fits the body's height to the whole canvas
The default framing SHALL fit the model's height to the whole canvas with a small, even margin above the crown and below the feet, and
SHALL treat the model's width only as a loose limit (0.8 of the bounds' width for a person, the full width for a chibi), so that in a tall narrow panel
the body fills the height. Controls laid over the stage SHALL NOT change the framing: hiding or showing one SHALL NOT move the camera
or the model. A camera the user has moved SHALL keep its position when the canvas changes size.

#### Scenario: Tall narrow panel
- **WHEN** a person's model is shown at its default framing in a panel 387 px wide and 1045 px tall
- **THEN** the crown is within the top 18 % of the canvas, the feet are within the bottom 18 % (a bar laid over the bottom may cover them), and the torso is inside the width

#### Scenario: Every frame
- **WHEN** the default skin of each of the two frames is shown at the default framing at 320, 387 and 600 px wide
- **THEN** each body fills at least 55 % of the canvas height and its torso is inside the width

#### Scenario: A bar over the bottom
- **WHEN** a control bar over the bottom of the stage is hidden or shown
- **THEN** the camera and the model do not move; the feet are visible only when the bar is hidden

#### Scenario: Panel resized
- **WHEN** the panel is resized and the camera was not moved by the user
- **THEN** the default framing is recomputed for the new size; a camera the user moved stays where it is

### Requirement: Erza is framed from her body
The default framing of Erza SHALL be computed from her body's visible meshes, as for every model: her height fits the canvas with the usual margin, limited by her
width where the panel is narrow, and no prop far from her body is included. Her bind pose is a T-pose, so the width limit SHALL be checked against the clips that play
on her; the figures measured for her are recorded in `AGENTS.md`, not here.

#### Scenario: Tall panel
- **WHEN** Erza is shown at 387 × 1045 px with no camera saved
- **THEN** her head and feet are inside the canvas with room above and below, and she is centred

#### Scenario: Wide panel
- **WHEN** Erza is shown at 600 × 800 px
- **THEN** the height decides the framing and her whole body is in view

#### Scenario: Narrow panel
- **WHEN** Erza is shown at 320 px wide while `Shukra · BoardAct0201` plays
- **THEN** her head is in view and her arms do not leave the canvas by more than the zoom-out the user can make (the same cost accepted for Qu's frames)
