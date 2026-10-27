# user-preferences Specification

## Purpose
What the panel remembers for the user on this machine: display settings, hidden parts saved per skin, a default camera view, the preferences menu, and export and import of all of it as a JSON file. Voice settings keep their own record. (Synced from change user-preferences.)

## Requirements

### Requirement: Preferences are stored on this machine
The panel SHALL keep the user's preferences in the browser's local storage of the extension, in one versioned record, and SHALL NOT send
them anywhere. Anything missing, unreadable or of an unknown version in the record SHALL fall back to the defaults for that part without
an error and without blocking the panel. When storage is unavailable or full, every control SHALL still work for the session and the
preferences menu SHALL say that a save did not stick. A change made in another open panel SHALL be picked up without a reload. The voice
volume, mute and subtitle settings SHALL stay in their own record, unchanged.

#### Scenario: Corrupt record
- **WHEN** the stored record is not valid JSON
- **THEN** the panel opens with the defaults and the first save writes a valid record

#### Scenario: Storage blocked
- **WHEN** local storage throws on every access
- **THEN** the panel opens with the defaults, all controls work, and pressing a Save button shows that it could not be saved

#### Scenario: Voice settings untouched
- **WHEN** preferences are exported, imported or forgotten
- **THEN** the voice volume, mute and subtitle settings are unchanged

### Requirement: Display settings are remembered
Background mode and solid colour, grid, follow animation, toon shading and the lighting (intensity and direction) SHALL be saved when the
user changes them and SHALL be what the panel opens with. Auto-rotate, wireframe and playback speed SHALL NOT be saved.

#### Scenario: Remembered
- **WHEN** the background is set to a solid colour, follow animation is switched off, and the panel is closed and opened again
- **THEN** the background is that colour and follow animation is off

#### Scenario: Not remembered
- **WHEN** auto-rotate is switched on and the speed is set to 0.5×, and the panel is closed and opened again
- **THEN** auto-rotate is off and the speed is 1×

### Requirement: Hidden parts can be saved per skin
The Parts popover's "Save" button SHALL save the choices shown for the shown skin (its meshes' show and hide state against the skin's
default form), keyed by the skin's model id and, inside it, by node name. A saved skin SHALL open with those choices on every open, in
every animation state, with the user's unsaved choices on top, and SHALL NOT change the framing of the camera. "Forget saved" SHALL
remove what is saved for the shown skin only. A node name the shown model lacks SHALL be ignored and kept. Saved choices SHALL be kept
for one skin at a time: saving one skin SHALL NOT change another.

#### Scenario: Hide the hat for good
- **WHEN** Sunlit Tides is shown, its `Hat` is switched off in the Parts popover, "Save" is pressed, and the panel is closed and opened again with Sunlit Tides selected
- **THEN** the hat is hidden from the first frame, and its switch is off

#### Scenario: Other skins unaffected
- **WHEN** the hat of Sunlit Tides is saved off and Night Sonata is shown
- **THEN** Night Sonata's meshes follow its own saved choices, else the animation data

#### Scenario: Survives state changes
- **WHEN** a saved choice hides a mesh and a Board action that swaps meshes plays
- **THEN** the mesh stays hidden

#### Scenario: Forget
- **WHEN** "Forget saved" is pressed on Sunlit Tides
- **THEN** the hat is shown as the animation data says, and on the next open too

### Requirement: The default camera can be saved
The preferences menu's "Save current view as default" SHALL save the Playground camera as it is now, and "Use the built-in default" SHALL
remove it. A saved camera SHALL be stored relative to the default framing of the model shown: the distance as a share of the default
distance, the orbit angles, and the orbit target's offset from the default target in model heights, so that it gives the same view on
every frame, skin and panel size. The saved camera SHALL replace the default framing in Playground wherever that applies: when a model is
shown, when the panel is resized and the camera has not been moved by the user, when the camera is reset (the reset button and `R`), and
when the panel switches to Playground. It SHALL NOT apply in Display, which has its own camera (see `display-mode`). A saved distance
SHALL be kept inside the zoom limits of the model shown. When follow animation is on, the saved target SHALL leave out the displacement of
the followed body part since the model's rest pose, and be restored with the part's current displacement, so the view is the same
whichever moment of a clip the camera was saved or restored at. The Display camera SHALL be stored and restored the same way.

#### Scenario: Save and reopen
- **WHEN** in Playground the user zooms in to the upper body and turns the model 20°, presses "Save current view as default", and later opens the panel and switches to Playground
- **THEN** the model shows at that view in Playground, and Display shows its own camera

#### Scenario: Other model and panel size
- **WHEN** the saved view was made on Crepuscule at 387 px wide and Veritas is shown at 600 px wide
- **THEN** the view has the same relative zoom, angle and target on Veritas

#### Scenario: Reset
- **WHEN** a default view is saved, the camera is orbited in Playground and `R` is pressed
- **THEN** the camera returns to the saved view

#### Scenario: Built-in default
- **WHEN** a default view is saved and "Use the built-in default" is pressed
- **THEN** the Playground camera returns to the built-in default framing, now and on the next switch to Playground

#### Scenario: Saved while following
- **WHEN** follow animation is on, a Board action bows the head, the view is saved at the lowest point of the bow, and the clip is restarted and the camera reset
- **THEN** the view shows the same part of the body at the same size as when it was saved, at the new time of the clip

#### Scenario: Zoom limit
- **WHEN** the saved distance is closer than a smaller model's closest zoom
- **THEN** the camera is placed at that model's closest zoom

### Requirement: Preferences menu
The stage menu's preferences button SHALL open a popover with: the camera preference ("Save current view as default" and "Use the built-in
default", the latter disabled while none is saved), the Display camera's state (saved or built-in) with "Use built-in" for it (disabled
while none is saved), the number of skins that have saved parts, "Export" and "Import", and "Forget all". It SHALL follow the popover rules
of the stage menu and fit a 320 px panel.

#### Scenario: Open
- **WHEN** the preferences button is pressed
- **THEN** the popover shows the camera buttons, the Display camera's state, the count of skins with saved parts, Export, Import and Forget all, and fits the panel

#### Scenario: Display camera from Playground
- **WHEN** a Display camera is saved and its "Use built-in" is pressed in the preferences popover
- **THEN** the popover shows the Display camera as built-in, and Display shows the built-in bust framing

#### Scenario: Forget all
- **WHEN** "Forget all" is pressed and confirmed
- **THEN** the saved camera, the Display model and camera, every skin's saved parts and the saved display settings are removed and the panel is back at its defaults

### Requirement: Preferences can be exported and imported
"Export" SHALL download the preferences as a JSON file named `bianca-companion-preferences.json`. "Import" SHALL read a chosen JSON file,
and when it is a valid preferences record SHALL replace the saved preferences with it and apply them at once; when it is not, SHALL
show a message and change nothing. The file SHALL contain the display settings, the saved camera, the Display model, camera and animation
choices and the saved parts, and no voice settings. A file exported before this change (without the Display model and camera, or without
the animation choices) SHALL be accepted and give the defaults for what it lacks.

#### Scenario: Round trip
- **WHEN** preferences are exported, forgotten, and the file is imported
- **THEN** the saved camera, the Display model, camera and animation choices, parts and display settings are back and applied

#### Scenario: Older file
- **WHEN** a file exported before this change is imported
- **THEN** it is accepted, its settings apply, and the Display animation choices are every frame's default

#### Scenario: Wrong file
- **WHEN** a file that is not a preferences record is imported
- **THEN** a message says so and nothing changes

#### Scenario: Wrong animation choice
- **WHEN** a file whose Display animation choice for a frame is a string instead of a list is imported
- **THEN** a message says so and nothing changes

### Requirement: The Display model and camera are saved
The preferences record SHALL hold the Display model (frame id and skin id), the Display camera (a camera view stored like the default
camera, or none) and, per Display frame, the borrowed animations chosen for it (each as `<frame id>:<clip name>`; the frame's own
animations are never stored), apart from the display settings and the Playground default camera. The Display model SHALL be saved as soon
as it is chosen; the Display camera when "Save" or "Use built-in" is pressed while adjusting; an animation choice as soon as it is made,
and forgotten by "Use default". A record without them, or with a value of the wrong shape, SHALL give the defaults for them (Crepuscule
Generic - Final, the built-in bust framing, each frame's default animations) without affecting the other preferences. A stored animation
that the shown model's frames do not offer SHALL be ignored and kept.

#### Scenario: Older record
- **WHEN** the stored record was written before this change
- **THEN** the panel opens on Crepuscule Generic - Final with the built-in bust framing and the default animations, and the saved parts, camera and display settings still apply

#### Scenario: Wrong shape
- **WHEN** the stored Display camera is a string
- **THEN** Display uses the built-in bust framing and the Display model is still read

#### Scenario: Animation choice kept
- **WHEN** Zero's `BoardAct1004` is chosen for Crepuscule and the panel is reopened
- **THEN** Display on Crepuscule plays it among the others, and the popover shows it checked

#### Scenario: Unknown animation kept
- **WHEN** the choice for Crepuscule holds `stigmata:BoardActX`
- **THEN** it is ignored in the pool and the popover, and stays in the record
