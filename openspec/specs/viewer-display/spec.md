# viewer-display Specification

## Purpose
What the viewer shows and how: reset camera, screenshot, stage background, floor grid, auto-rotate, wireframe, and light intensity and direction. (Purpose TBD, synced from change add-viewer-toolbar.)
## Requirements
### Requirement: Reset camera
The stage menu's reset button and the `R` key SHALL return the camera to the default framing of the model, and SHALL NOT change the
clip or its time.

#### Scenario: Reset
- **WHEN** the camera was orbited and zoomed and the reset button is pressed at 12.00 s of a clip
- **THEN** the camera is at the default framing and the clip keeps its time

### Requirement: Screenshot
The stage menu's camera button SHALL download a PNG of the stage as shown: the model with the current pose and camera over
the stage background (the gradient, or the solid colour; the gradient when the background is transparent), at the
size of the stage in device pixels. The PNG SHALL be opaque. The file name SHALL be
`<construct>_<skin>_<clip>_<time>.png`, with `<skin>` the id of the skin shown, the clip name and any character outside
`A-Za-z0-9._-` replaced by `_`, `bindpose` in bind pose or when the skin has no clips, and the time in seconds with two decimals
and an `s`.

#### Scenario: Take a screenshot
- **WHEN** `BoardAct0201` is paused at 12.30 s and the camera button is pressed
- **THEN** a PNG named `crepuscule_r5biankamd010011_BoardAct0201_12.30s.png` is downloaded, showing the model in that pose over the gradient

#### Scenario: Another skin
- **WHEN** Sunlit Tides is shown with `UiStand1` paused at 3.00 s and a screenshot is taken
- **THEN** the PNG is named `crepuscule_r5biankamd019271_UiStand1_3.00s.png`

#### Scenario: Transparent background
- **WHEN** the background is "transparent" and a screenshot is taken
- **THEN** the PNG has no transparent pixels

### Requirement: Stage background
The settings popover SHALL offer the stage background as gradient (default), a solid colour, or transparent shown as a
checker pattern. The choice SHALL change the stage immediately and SHALL NOT affect the model or its lighting.

#### Scenario: Solid colour
- **WHEN** "solid" is chosen and a colour is picked
- **THEN** the area behind the model shows that colour

### Requirement: Floor grid
The settings popover SHALL have a "show grid floor" switch, off by default. When on, a grid SHALL be drawn on the floor
plane at the model's feet and SHALL NOT change the default framing.

#### Scenario: Grid on
- **WHEN** the grid is switched on
- **THEN** a grid appears under the model and the camera does not move

### Requirement: Auto-rotate
The settings popover SHALL have an "auto-rotate" switch, off by default. When on, the camera SHALL orbit the model
once in about 30 seconds, advancing with elapsed time, pausing while the user drags and continuing after. While
auto-rotating the viewer SHALL render at most 30 frames per second unless the user is moving the camera.

#### Scenario: Auto-rotate while paused
- **WHEN** auto-rotate is on, playback is paused, and 2 seconds pass without interaction
- **THEN** the camera has turned by about 24° and between 40 and 62 frames were rendered

### Requirement: Wireframe
The settings popover SHALL have a "wireframe" switch, off by default, that draws the model's meshes as wireframe, and
SHALL restore the normal materials when switched off.

#### Scenario: Wireframe
- **WHEN** wireframe is switched on and then off
- **THEN** the meshes show as wireframe and then return to their textured look

### Requirement: Light intensity and direction
The lighting popover SHALL have an intensity slider (0.25 to 2, default 1) that scales all stage lights, a direction slider
(−180° to 180°, default −22°) that turns the directional light around the model's vertical axis, and a reset that restores
both defaults. Changes SHALL show immediately.

#### Scenario: Intensity
- **WHEN** the intensity is set to 2
- **THEN** both stage lights have twice their default intensity

#### Scenario: Reset lighting
- **WHEN** the intensity and direction were changed and reset is pressed
- **THEN** the sliders and the lights are back at their defaults

### Requirement: Display settings start from defaults
Background (mode and solid colour), grid, auto-rotate, follow animation, wireframe, lighting and toon shading SHALL start, each time the
panel opens, from the values the user last set for background, grid, follow animation, lighting and toon shading (see
`user-preferences`), else from their defaults (toon shading on, follow animation on, gradient background, grid off, lighting 1 and 0°);
auto-rotate and wireframe SHALL always start off, and playback speed at 1×.

#### Scenario: First open
- **WHEN** the panel opens with nothing saved
- **THEN** toon shading and follow animation are on, the grid is off, the background is the gradient

#### Scenario: Grid on reopen
- **WHEN** the grid was switched on and the panel is closed and opened again
- **THEN** the grid is on

#### Scenario: Toon shading on reopen
- **WHEN** toon shading was switched off and the panel is closed and opened again
- **THEN** toon shading is off

#### Scenario: Auto-rotate and wireframe on reopen
- **WHEN** auto-rotate and wireframe were switched on and the panel is closed and opened again
- **THEN** both are off

### Requirement: Follow animation
The settings popover SHALL have a "Follow animation" switch, on by default. When on, the camera SHALL keep the part of the body it
is looking at in the same place in the view while the clip moves: the head in a face close-up, the chest in a chest view, the pelvis in
a full-body view (the one nearest the orbit target). The orbit target and the camera SHALL move together, smoothly, keeping the distance
and angle the user chose. While the user orbits, pans or zooms, the camera SHALL do what the user does; afterwards it SHALL follow the
part nearest the new target. A paused clip SHALL move nothing. A model without clips SHALL be unaffected.

#### Scenario: Face close-up through a bow
- **WHEN** follow is on, the camera is at a face close-up, and a Board action bows the head
- **THEN** the face stays in view throughout

#### Scenario: A Fight clip that travels
- **WHEN** follow is on in a full-body view of Crepuscule and `Stigmata · Born` carries the pelvis about 1.9 m across the floor
- **THEN** the body stays in view, centred again after the movement

#### Scenario: On by default
- **WHEN** the panel opens and a Board action plays with the camera at a face close-up
- **THEN** the face stays in view without the switch having been touched

#### Scenario: Off
- **WHEN** follow is switched off and the same clips play
- **THEN** the camera does not move by itself
