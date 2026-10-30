## MODIFIED Requirements

### Requirement: The Display model and camera are saved
The preferences record SHALL hold the Display model (frame id and skin id), the Display camera (a camera view stored like the default
camera, or none) and, per Display frame, the borrowed animations chosen for it (each as `<frame id>:<clip name>`; the frame's own Menu
animations are never stored) and the frame's own Fight clips the user turned off (each as `<frame id>:<clip name>`, under its own key, so
that a frame with nothing stored there plays all of its own Fight clips), apart from the display settings and the Playground default camera. The Display model SHALL be saved as soon
as it is chosen; the Display camera when "Save" or "Use built-in" is pressed while adjusting; an animation choice as soon as it is made,
and forgotten (both lists of the frame) by "Use default". A record without them, or with a value of the wrong shape, SHALL give the defaults for them (Shukra's
Generic, the built-in bust framing, each frame's default animations with all of its own Fight clips on) without affecting the other preferences. A stored animation that the
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

#### Scenario: Choice saved before Fight idles
- **WHEN** the stored record holds a borrowed-animation choice for Shukra and no list of own Fight clips turned off
- **THEN** that choice still applies unchanged and all of Shukra's own Fight clips are on

#### Scenario: Own Fight clip off kept
- **WHEN** Shukra's own `Win` is turned off and the panel is reopened
- **THEN** `Win` does not come up as an idle on Shukra and the popover shows it unchecked, and Shukra's other Fight clips are on

#### Scenario: Wrong own Fight list
- **WHEN** the stored list of own Fight clips turned off is a string
- **THEN** all of the frame's own Fight clips are on and the rest of the record is still read

### Requirement: Preferences can be exported and imported
"Export" SHALL download the preferences as a JSON file named `titania-companion-preferences.json`. "Import" SHALL read a chosen JSON file,
and when it is a valid preferences record SHALL replace the saved preferences with it and apply them at once; when it is not, SHALL
show a message and change nothing. The file SHALL contain the display settings, the saved camera, the Display model, camera and animation
choices (borrowed animations and own Fight clips turned off) and the saved parts, and no voice settings. A record without the Display model
and camera, or without the animation choices or the own Fight clips turned off, SHALL be accepted and give the defaults for what it lacks. A record of the same shape exported by the PGR companion SHALL be accepted: its display
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

#### Scenario: Record before Fight idles
- **WHEN** a record exported before this change, with animation choices but no own Fight clips turned off, is imported
- **THEN** it is accepted, its choices apply, and every frame's own Fight clips are on

#### Scenario: Own Fight list in a round trip
- **WHEN** Shukra's own `Win` is turned off, the preferences are exported, forgotten, and the file is imported
- **THEN** `Win` is off for Shukra again

#### Scenario: Wrong animation choice
- **WHEN** a file whose Display animation choice for a frame is a string instead of a list is imported
- **THEN** a message says so and nothing changes
