## MODIFIED Requirements

### Requirement: Display stage
In Display the stage SHALL fill the whole panel. The header, the player, its handle and the skin area SHALL NOT be shown. The stage SHALL
show only the Display menu icon in its top-right corner (following the stage menu's open and close rules) and, when a caption is on and a
line plays, the caption at the bottom of the stage. Display SHALL use the display settings (background, grid, toon shading, lighting,
follow animation) of Playground. What Display plays is decided by the lobby director (see `lobby-director`).

#### Scenario: Stage only
- **WHEN** the panel is in Display and the pointer is not over the menu
- **THEN** the panel shows the stage edge to edge with only the menu icon over it

#### Scenario: Idle
- **WHEN** the panel is in Display on Shukra's Generic and no action is playing
- **THEN** one of the model's idle clips plays looping (see `lobby-director`)

#### Scenario: Shared settings
- **WHEN** toon shading is turned off in Playground and the mode is switched to Display
- **THEN** Display shows the original materials

### Requirement: Display camera is locked
In Display, drag, wheel, pinch and two-finger input on the stage SHALL NOT move the camera. The camera SHALL be placed by the Display
camera view: the one saved for Display, else a built-in bust framing (from the crown to the upper thighs, the face in the upper third of
the stage, from the front) stored as a camera view relative to the default framing, so that it gives the same framing on every frame,
skin and panel size. Follow animation SHALL keep working in Display. The camera SHALL refit on resize as an unmoved camera does.

#### Scenario: Drag does nothing
- **WHEN** the user drags across the stage in Display, and scrolls the wheel over it
- **THEN** the camera does not move

#### Scenario: Built-in bust framing
- **WHEN** no Display camera is saved and Shukra's Generic is shown in a 381 px wide panel
- **THEN** the stage shows her from the top of the head to the upper thighs, with the face in the upper third

#### Scenario: Other frame
- **WHEN** no Display camera is saved and Pavo is the Display model
- **THEN** Pavo is framed from the crown to the upper thighs too

### Requirement: Display model
The Display menu SHALL have a "Model" button that opens a popover listing the frames and, for the chosen frame, its skins as thumbnails
(each skin's name is its tooltip and accessible name, and the shown skin's name is written under them). Choosing a skin SHALL show it in
Display at once and SHALL save it as the Display model. The default Display model SHALL be Shukra, Generic. A saved Display model that no
longer exists SHALL be replaced by the default without an error.

#### Scenario: Choose a Display model
- **WHEN** the Model popover is opened, Pavo is chosen and then its Generic
- **THEN** Display shows Pavo's Generic, and the next open of the panel shows it too

#### Scenario: Unknown saved model
- **WHEN** the saved Display model names a skin id that no frame has (for example a Bianca skin from an imported PGR preferences file)
- **THEN** the panel opens on Shukra's Generic

### Requirement: Playground follows the Display model
Entering Playground SHALL keep the model Display shows, with the Playground camera (the saved default camera, else the built-in default
framing). A frame or skin chosen in Playground SHALL be shown there but SHALL NOT change the Display model. Entering Display SHALL show the
Display model, loading it only when Playground showed another one, and SHALL start Display in idle (see `lobby-director`: no new Board action).

#### Scenario: Enter Playground
- **WHEN** Display shows Pavo's Generic and the user switches to Playground
- **THEN** the header reads Pavo, the skin strip marks Pavo's Generic, the model is not loaded again and the camera shows the Playground framing

#### Scenario: Temporary choice
- **WHEN** Display shows Shukra, in Playground the user picks Pavo and switches back to Display
- **THEN** Display shows Shukra again and the saved Display model is unchanged

### Requirement: Display animations
The Display menu SHALL have an "Animations" button, between Model and Adjust camera, that opens a popover listing what Display may play on
the Display model, in sections by frame: the Display frame first, then the other frames in the frame picker's order. Each section SHALL
list the frame's `UiStand1` as its idle and every Board action it has with a voice line (the voice line's title, the clip name and its
length), and SHALL NOT list a clip without a voice line or `StandAct0101`. The Display frame's own rows SHALL be checked and SHALL NOT be
uncheckable. Another frame's rows SHALL be checkable one by one, and its section SHALL have a checkbox that checks or clears all of its rows
and shows a mixed state when some are checked. Each change SHALL be saved at once for the Display frame and SHALL apply to Display while it
runs (see `lobby-director`). "Use default" SHALL forget the Display frame's choice and show its default. Sections SHALL start folded, except
one whose animations are partly chosen, and the user can fold and unfold them. A frame whose clips or voice lines could not be read SHALL be
shown disabled with a note. The popover SHALL fit a 320 px panel without horizontal scrolling and its list SHALL scroll when it is taller
than the stage. A press inside the popover SHALL NOT be a tap on the stage.

#### Scenario: Own animations locked
- **WHEN** the Animations popover is opened with Shukra as the Display model and Shukra's section is unfolded
- **THEN** it lists `UiStand1` and every voiced Board action of Shukra, all checked and disabled

#### Scenario: No silent clips
- **WHEN** Pavo's `voice_pairings.json` entry has no `BoardAct0202` and the popover lists Pavo
- **THEN** it lists Pavo's `UiStand1` and its voiced Board actions, without `BoardAct0202`

#### Scenario: Default on Shukra
- **WHEN** the popover is opened on Shukra with no choice saved
- **THEN** every row of Pavo's section is checked (Shukra's default borrows Pavo's voiced Board actions and idle)

#### Scenario: Mixed frame
- **WHEN** one of Pavo's rows is cleared on Shukra
- **THEN** Pavo's section checkbox shows the mixed state and the row's action no longer starts in Display

#### Scenario: Per Display frame
- **WHEN** Pavo's section is cleared for Shukra and the Display model is then changed to Pavo
- **THEN** the popover shows Pavo's own rows locked and Pavo's choice (its default: all of Shukra's), and Shukra's choice is kept for when it is the Display model again

#### Scenario: Use default
- **WHEN** "Use default" is pressed on Shukra after changes
- **THEN** every row of Pavo's section is checked again, and Display's pool is the default again

#### Scenario: Narrow panel
- **WHEN** the panel is 320 px wide
- **THEN** the Display menu's five buttons and its icon fit on one line, and the popover fits without horizontal scrolling

#### Scenario: Choose a whole frame
- **WHEN** Pavo's section checkbox is pressed on Shukra
- **THEN** Pavo's idle and ten Board actions are checked, saved for Shukra, and Pavo's actions join Display's pool
