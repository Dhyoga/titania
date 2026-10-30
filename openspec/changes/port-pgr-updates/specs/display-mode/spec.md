## MODIFIED Requirements

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
