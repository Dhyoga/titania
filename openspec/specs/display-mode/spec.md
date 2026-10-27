# display-mode Specification

## Purpose
The Display and Playground modes of the side panel: Display is the quiet default view (a locked bust camera on a saved Display model, idle animation, mute) and Playground is the full panel; how the modes share one viewer, how the Display model and camera are chosen, and how switching and keys behave. (Purpose TBD, synced from change add-display-mode.)

## Requirements

### Requirement: Two modes on one viewer
The panel SHALL have two modes: Display and Playground. Playground SHALL be the panel as it was before this change (header, stage with
its menu and player, skin area). Both modes SHALL use the same viewer and canvas: switching modes SHALL NOT create a second renderer and
SHALL NOT reload the model unless the mode shows a different model. The panel SHALL open in Display every time; the mode SHALL NOT be
remembered.

#### Scenario: Open the panel
- **WHEN** the side panel opens
- **THEN** it is in Display, showing the Display model

#### Scenario: Reopen after Playground
- **WHEN** the panel was in Playground and is closed and opened again
- **THEN** it opens in Display

#### Scenario: One renderer
- **WHEN** the modes are switched back and forth ten times without changing the model
- **THEN** the model is loaded once, and the renderer's geometry and texture counts are the same after each switch

### Requirement: Display stage
In Display the stage SHALL fill the whole panel. The header, the player, its handle and the skin area SHALL NOT be shown. The stage SHALL
show only the Display menu icon in its top-right corner (following the stage menu's open and close rules) and, when a caption is on and a
line plays, the caption at the bottom of the stage. Display SHALL use the display settings (background, grid, toon shading, lighting,
follow animation) of Playground. What Display plays is decided by the lobby director (see `lobby-director`).

#### Scenario: Stage only
- **WHEN** the panel is in Display and the pointer is not over the menu
- **THEN** the panel shows the stage edge to edge with only the menu icon over it

#### Scenario: Idle
- **WHEN** the panel is in Display on Crepuscule Generic - Final and no action is playing
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
- **WHEN** no Display camera is saved and Crepuscule Generic - Final is shown in a 381 px wide panel
- **THEN** the stage shows her from the top of the head to the upper thighs, with the face in the upper third, as in the user's reference screenshot

#### Scenario: Other frame
- **WHEN** no Display camera is saved and Veritas is the Display model
- **THEN** Veritas is framed from the crown to the upper thighs too

### Requirement: Adjust camera
The Display menu SHALL have an "Adjust camera" button. While adjusting, orbit, zoom and pan SHALL work as in Playground and a bar at the
bottom of the stage SHALL offer "Save", "Use built-in" and "Cancel". "Save" SHALL store the current view as the Display camera and end
adjusting; "Use built-in" SHALL remove the saved Display camera, place the built-in bust framing and end adjusting; "Cancel" and `Esc`
SHALL return the camera to the Display camera view it had before and end adjusting. Leaving Display ends adjusting as Cancel does. The
Playground default camera SHALL NOT change.

#### Scenario: Save a Display camera
- **WHEN** the user presses "Adjust camera", zooms closer to the face, presses "Save", and later reopens the panel
- **THEN** Display opens at that closer view, and Playground still opens at its own default

#### Scenario: Cancel
- **WHEN** the user presses "Adjust camera", orbits 40° and presses `Esc`
- **THEN** the camera is back at the Display camera view and the stage takes no orbit input again

#### Scenario: Use built-in
- **WHEN** a Display camera is saved and the user adjusts and presses "Use built-in"
- **THEN** the camera shows the built-in bust framing, now and on the next open

### Requirement: Display model
The Display menu SHALL have a "Model" button that opens a popover listing the four frames and, for the chosen frame, its skins as
thumbnails (each skin's name is its tooltip and accessible name, and the shown skin's name is written under them), without the dorm chibis. Choosing a skin SHALL show it in Display at once and SHALL save it as the Display
model. The default Display model SHALL be Crepuscule, Generic - Final. A saved Display model that no longer exists or is a chibi SHALL be
replaced by the default without an error.

#### Scenario: Choose a Display model
- **WHEN** the Model popover is opened, Stigmata is chosen and then Solitary Dream
- **THEN** Display shows Stigmata Solitary Dream, and the next open of the panel shows it too

#### Scenario: No chibi
- **WHEN** the Model popover lists Crepuscule's skins
- **THEN** the six skins without the chibi are listed

#### Scenario: Unknown saved model
- **WHEN** the saved Display model names a skin id that no frame has
- **THEN** the panel opens on Crepuscule Generic - Final

### Requirement: Playground follows the Display model
Entering Playground SHALL keep the model Display shows, with the Playground camera (the saved default camera, else the built-in default
framing). A frame or skin chosen in Playground SHALL be shown there but SHALL NOT change the Display model. Entering Display SHALL show the
Display model, loading it only when Playground showed another one, and SHALL start Display in idle (see `lobby-director`: no new Board action).

#### Scenario: Enter Playground
- **WHEN** Display shows Night Sonata and the user switches to Playground
- **THEN** the header reads Crepuscule, the skin strip marks Night Sonata, the model is not loaded again and the camera shows the Playground framing

#### Scenario: Temporary choice
- **WHEN** in Playground the user picks Veritas Grace and switches back to Display
- **THEN** Display shows the Display model again and the saved Display model is unchanged

### Requirement: Switching modes
The Playground header SHALL have a "Display" button on its right; the Display menu SHALL have a "Playground" button. Each SHALL switch to
the other mode at once. Switching SHALL close any open popover and leave Focus off. The buttons SHALL be keyboard accessible and SHALL fit
a 320 px panel.

#### Scenario: To Playground and back
- **WHEN** in Display the menu's "Playground" button is pressed, and then the header's "Display" button
- **THEN** the header, player and skin area appear, and then disappear again with the stage filling the panel

#### Scenario: Narrow panel
- **WHEN** the panel is 320 px wide
- **THEN** the header's frame picker and Display button fit on one line, and the Display menu's buttons fit on one line

### Requirement: Mute in Display
The Display menu SHALL have a mute button that toggles the voice mute and shows its state. It SHALL change the same setting as the
playback options' mute and `M`.

#### Scenario: Mute
- **WHEN** the Display menu's mute button is pressed
- **THEN** voice lines are silent, the button shows muted, and Playground's playback options show muted too

### Requirement: Keyboard in Display
In Display, `M` SHALL toggle mute, `C` SHALL toggle subtitles and `R` SHALL return the camera to the Display camera view. `Esc` SHALL end
Adjust camera, else close the open popover, else close the menu. `Space` and `Enter` SHALL act as a tap on the stage (see `lobby-director`). `←`, `→`, `L`, `F` and `H` SHALL do nothing in
Display. The same exceptions as in Playground SHALL apply (modifier keys, text fields, keys another control handled).

#### Scenario: Playback keys ignored
- **WHEN** `←`, `L` and `H` are pressed in Display
- **THEN** the clip keeps playing and nothing is shown or hidden

#### Scenario: Reset in Display
- **WHEN** a Display camera is saved, the user presses "Adjust camera", orbits, and presses `R`
- **THEN** the camera returns to the saved Display view and adjusting continues

### Requirement: Display animations
The Display menu SHALL have an "Animations" button, between Model and Adjust camera, that opens a popover listing what Display may play on
the Display model, in sections by frame: the Display frame first, then the other frames in the frame picker's order, Zero included. Each
section SHALL list the frame's `UiStand1` as its idle and every Board action it has with a voice line (the voice line's title, the clip
name and its length), and SHALL NOT list a clip without a voice line or `StandAct0101`. The Display frame's own rows SHALL be checked and
SHALL NOT be uncheckable. Another frame's rows SHALL be checkable one by one, and its section SHALL have a checkbox that checks or clears
all of its rows and shows a mixed state when some are checked. Each change SHALL be saved at once for the Display frame and SHALL apply
to Display while it runs (see `lobby-director`). "Use default" SHALL forget the Display frame's choice and show its default. Sections SHALL start folded, except one whose
animations are partly chosen, and the user can fold and unfold them. A frame whose clips or voice lines could not be read SHALL be shown
disabled with a note. The popover SHALL fit a 320 px panel without horizontal
scrolling and its list SHALL scroll when it is taller than the stage. A press inside the popover SHALL NOT be a tap on the stage.

#### Scenario: Own animations locked
- **WHEN** the Animations popover is opened with Crepuscule as the Display model and Crepuscule's section is unfolded
- **THEN** it lists `UiStand1` and its ten Board actions, all checked and disabled

#### Scenario: No silent clips
- **WHEN** the popover lists Veritas
- **THEN** it lists Veritas' `UiStand1` and eight Board actions, without `BoardAct0202` and `BoardAct0203`

#### Scenario: Choose a whole frame
- **WHEN** Zero's section checkbox is pressed on Crepuscule
- **THEN** Zero's idle and ten Board actions are checked, saved for Crepuscule, and Zero's actions join Display's pool

#### Scenario: Mixed frame
- **WHEN** one of Stigmata's rows is cleared
- **THEN** Stigmata's section checkbox shows the mixed state and the row's action no longer starts in Display

#### Scenario: Per Display frame
- **WHEN** Zero is chosen for Crepuscule and the Display model is then changed to Veritas
- **THEN** the popover shows Veritas' own rows locked and Veritas' choice (its default: nothing borrowed), and Crepuscule's choice is kept for when it is the Display model again

#### Scenario: Use default
- **WHEN** "Use default" is pressed on Crepuscule after changes
- **THEN** Stigmata's and Veritas' actions, Stigmata's idle and nothing of Zero are checked, and Display's pool is the default again

#### Scenario: Narrow panel
- **WHEN** the panel is 320 px wide
- **THEN** the Display menu's five buttons and its icon fit on one line, and the popover fits without horizontal scrolling
