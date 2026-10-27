## ADDED Requirements

### Requirement: Preferences are kept under Titania's own key
The preferences record SHALL be stored in the extension's local storage under the key `titania.prefs`. Nothing SHALL be read from or
written to the PGR companion's key `pgr.prefs`.

#### Scenario: Storage key
- **WHEN** a display setting is changed and the extension's local storage is inspected
- **THEN** the record is under `titania.prefs` and there is no `pgr.prefs` entry

## MODIFIED Requirements

### Requirement: Hidden parts can be saved per skin
The Parts popover's "Save" button SHALL save the choices shown for the shown skin (its meshes' show and hide state against the animation
data), keyed by the skin's model id and, inside it, by node name. A saved skin SHALL open with those choices on every open, in every
animation state, with the user's unsaved choices on top, and SHALL NOT change the framing of the camera. "Forget saved" SHALL remove what
is saved for the shown skin only. A node name the shown model lacks SHALL be ignored and kept. Saved choices SHALL be kept for one skin at
a time: saving one skin SHALL NOT change another.

#### Scenario: Hide the weapon for good
- **WHEN** Shukra is shown, her `Weapon` is switched off in the Parts popover, "Save" is pressed, and the panel is closed and opened again with Shukra shown
- **THEN** the weapon is hidden from the first frame, and its switch is off

#### Scenario: Other skins unaffected
- **WHEN** Shukra's weapon is saved off and Pavo is shown
- **THEN** Pavo's meshes follow its own saved choices, else the animation data

#### Scenario: Survives state changes
- **WHEN** a saved choice hides a mesh and a Board action plays, then the Fight context is chosen
- **THEN** the mesh stays hidden

#### Scenario: Forget
- **WHEN** "Forget saved" is pressed on Shukra
- **THEN** the weapon is shown as the animation data says, and on the next open too

### Requirement: Preferences can be exported and imported
"Export" SHALL download the preferences as a JSON file named `titania-companion-preferences.json`. "Import" SHALL read a chosen JSON file,
and when it is a valid preferences record SHALL replace the saved preferences with it and apply them at once; when it is not, SHALL
show a message and change nothing. The file SHALL contain the display settings, the saved camera, the Display model, camera and animation
choices and the saved parts, and no voice settings. A record without the Display model and camera, or without the animation choices, SHALL
be accepted and give the defaults for what it lacks. A record of the same shape exported by the PGR companion SHALL be accepted: its display
settings and cameras apply, a Display model that names no frame of this project gives the default, and parts and animation choices saved
under ids this project lacks are kept and never match.

#### Scenario: Round trip
- **WHEN** preferences are exported, forgotten, and the file is imported
- **THEN** the saved camera, the Display model, camera and animation choices, parts and display settings are back and applied

#### Scenario: Record without a Display model
- **WHEN** a valid record without the Display model, camera and animation choices is imported
- **THEN** it is accepted, its settings apply, the Display model and camera are the defaults, and the animation choices are every frame's default

#### Scenario: PGR companion file
- **WHEN** a `bianca-companion-preferences.json` whose Display model is Crepuscule and which holds an animation choice for Crepuscule is imported
- **THEN** it is accepted, its display settings apply, the Display model is Shukra's Generic, and Shukra's and Pavo's animation choices are their defaults

#### Scenario: Wrong file
- **WHEN** a file that is not a preferences record is imported
- **THEN** a message says so and nothing changes

#### Scenario: Wrong animation choice
- **WHEN** a file whose Display animation choice for a frame is a string instead of a list is imported
- **THEN** a message says so and nothing changes

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
- **WHEN** the saved view was made on Shukra at 387 px wide and Pavo is shown at 600 px wide
- **THEN** the view has the same relative zoom, angle and target on Pavo

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

### Requirement: The Display model and camera are saved
The preferences record SHALL hold the Display model (frame id and skin id), the Display camera (a camera view stored like the default
camera, or none) and, per Display frame, the borrowed animations chosen for it (each as `<frame id>:<clip name>`; the frame's own
animations are never stored), apart from the display settings and the Playground default camera. The Display model SHALL be saved as soon
as it is chosen; the Display camera when "Save" or "Use built-in" is pressed while adjusting; an animation choice as soon as it is made,
and forgotten by "Use default". A record without them, or with a value of the wrong shape, SHALL give the defaults for them (Shukra's
Generic, the built-in bust framing, each frame's default animations) without affecting the other preferences. A stored animation that the
shown model's frames do not offer SHALL be ignored and kept.

#### Scenario: Record without them
- **WHEN** the stored record has no Display model, no Display camera and no animation choices
- **THEN** the panel opens on Shukra's Generic with the built-in bust framing and the default animations, and the saved parts, camera and display settings still apply

#### Scenario: Wrong shape
- **WHEN** the stored Display camera is a string
- **THEN** Display uses the built-in bust framing and the Display model is still read

#### Scenario: Animation choice kept
- **WHEN** Pavo's `BoardAct1004` is cleared for Shukra and the panel is reopened
- **THEN** Display on Shukra never plays it, and the popover shows it unchecked

#### Scenario: Unknown animation kept
- **WHEN** the choice for Shukra holds `pavo:BoardActX`
- **THEN** it is ignored in the pool and the popover, and stays in the record
