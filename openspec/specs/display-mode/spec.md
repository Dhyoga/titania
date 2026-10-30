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
line plays, the caption at the bottom of the stage. Display SHALL use the display settings (background, grid, toon shading, lighting)
of Playground, but SHALL always follow the animation, whatever the Follow animation setting of Playground is (the low poses of the Fight
idles would otherwise leave the bust framing); that setting SHALL apply again in Playground. What Display plays is decided by the lobby
director (see `lobby-director`).

#### Scenario: Stage only
- **WHEN** the panel is in Display and the pointer is not over the menu
- **THEN** the panel shows the stage edge to edge with only the menu icon over it

#### Scenario: Idle
- **WHEN** the panel is in Display on Shukra's Generic and no action is playing
- **THEN** one of the model's idle clips plays, looping or once (see `lobby-director`)

#### Scenario: Shared settings
- **WHEN** toon shading is turned off in Playground and the mode is switched to Display
- **THEN** Display shows the original materials

#### Scenario: Display always follows
- **WHEN** Follow animation is off in Playground and the mode is switched to Display while Pavo's `LevelAttack14` (a low pose) plays
- **THEN** the head and upper body stay in the frame, and in Playground the camera does not follow again

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
the Display model, in sections by frame: first the Menu sections, the Display frame first, then the other frames in the frame picker's
order; then, under a "Fight" heading, a Fight section per frame in the same order. Each Menu section SHALL list the frame's idles `UiStand1`
and `StandAct0101` (each with its clip name and length) and every Board action it has with a voice line (the voice line's title, the clip
name and its length), and SHALL NOT list a clip without a voice line. Each Fight section SHALL list the frame's Fight idle candidates (see
`lobby-director`, "Idle is varied"), each with its clip name, its length and, for a clip that does not loop, the note "once". The Display
frame's own Menu rows SHALL be checked and SHALL NOT be uncheckable. Every other row, the Display frame's own Fight rows included, SHALL be
checkable one by one, and every section but the Display frame's Menu section SHALL have a checkbox that checks or clears all of its rows and
shows a mixed state when some are checked. The Display frame's own Fight rows SHALL be checked by default; another frame's Fight rows SHALL
be unchecked by default. The heading line SHALL count the actions and the idles (Menu and Fight) Display plays. Each change SHALL be saved
at once for the Display frame and SHALL apply to Display while it runs (see `lobby-director`). "Use default" SHALL forget the Display
frame's choice (borrowed animations and own Fight clips turned off) and show its default. Sections SHALL start folded, except one whose
animations are partly chosen, and the user can fold and unfold them. A frame whose clips or voice lines could not be read SHALL be shown
disabled with a note. The popover SHALL fit a 320 px panel without horizontal scrolling and its list SHALL scroll when it is taller than
the stage. A press inside the popover SHALL NOT be a tap on the stage.

#### Scenario: Own animations locked
- **WHEN** the Animations popover is opened with Shukra as the Display model and Shukra's Menu section is unfolded
- **THEN** it lists `StandAct0101`, `UiStand1` and every voiced Board action of Shukra, all checked and disabled

#### Scenario: Own Fight clips on by default
- **WHEN** the popover is opened with Shukra as the Display model and no choice saved, and Shukra's Fight section is unfolded
- **THEN** it lists Shukra's six Fight clips (`Born`, `Stand1`, `Stand2`, `Standchange`, `Save`, `Win`), all checked and enabled, with "once" on `Born`, `Standchange` and `Win`

#### Scenario: Turn off an own Fight clip
- **WHEN** `Win` is cleared in Shukra's Fight section
- **THEN** the section checkbox shows the mixed state, the choice is saved for Shukra, and `Win` no longer comes up as an idle

#### Scenario: Borrow a frame's Fight clips
- **WHEN** Pavo's Fight section checkbox is pressed with Shukra as the Display model
- **THEN** Pavo's seven Fight clips are checked, saved for Shukra, and come up in Shukra's borrowed idles

#### Scenario: No silent clips
- **WHEN** Pavo's `voice_pairings.json` entry has no `BoardAct0202` and the popover lists Pavo
- **THEN** its Menu section lists Pavo's two idles and its voiced Board actions, without `BoardAct0202`

#### Scenario: Default on Shukra
- **WHEN** the popover is opened on Shukra with no choice saved
- **THEN** every row of Pavo's Menu section is checked (both idles and the voiced Board actions) and no row of Pavo's Fight section

#### Scenario: Mixed frame
- **WHEN** one of Pavo's Menu rows is cleared on Shukra
- **THEN** Pavo's Menu section checkbox shows the mixed state and the row's action no longer starts in Display

#### Scenario: Per Display frame
- **WHEN** Pavo's Menu section is cleared for Shukra and the Display model is then changed to Pavo
- **THEN** the popover shows Pavo's own Menu rows locked, its own Fight rows checked and Pavo's choice (its default: all of Shukra's Menu rows, none of its Fight rows), and Shukra's choice is kept for when it is the Display model again

#### Scenario: Use default
- **WHEN** "Use default" is pressed on Shukra after changes
- **THEN** every Menu row of Pavo's section is checked again, none of Pavo's Fight rows, all of Shukra's own Fight clips, and Display's pool and idles are the default again

#### Scenario: Narrow panel
- **WHEN** the panel is 320 px wide
- **THEN** the Display menu's five buttons and its icon fit on one line, and the popover, Fight sections included, fits without horizontal scrolling

#### Scenario: Choose a whole frame
- **WHEN** Pavo's Menu section checkbox is pressed on Shukra
- **THEN** Pavo's two idles and ten Board actions are checked, saved for Shukra, and Pavo's actions join Display's pool

### Requirement: A frame without clips of its own is not offered in Display
A frame that has no clip set of its own (Erza) SHALL NOT be a Display model and SHALL NOT be a section of the Display menu's Animations popover.
The Model popover SHALL list the frames that can be shown in Display only. A saved Display model that names such a frame SHALL be replaced by the
default (Shukra's Generic) without an error. The lobby's lenders and idles SHALL come only from frames that have a clip set. In Playground the frame
SHALL be shown as any other.

#### Scenario: Model popover
- **WHEN** the Display menu's Model popover is opened
- **THEN** it lists Shukra and Pavo, and not Erza

#### Scenario: Animations popover
- **WHEN** the Animations popover is opened with Shukra as the Display model
- **THEN** it has sections for Shukra and Pavo only

#### Scenario: Saved Erza
- **WHEN** the stored Display model is Erza (an edited record or an import)
- **THEN** the panel opens on Shukra's Generic without an error, and the stored value is kept

#### Scenario: Playground
- **WHEN** Erza is chosen in Playground and the panel is switched to Display
- **THEN** Display shows the saved Display model (Shukra's Generic by default) and the saved Display model is unchanged
