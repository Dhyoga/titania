# frame-picker Specification

## Purpose
Choosing which of Bianca's frames (Crepuscule, Stigmata, Veritas, Zero) the viewer shows: the frame list and the picker in the header, what switching frames loads and keeps, and that the other frames get every viewer feature. (Purpose TBD, synced from change add-frame-picker.)

## Requirements

### Requirement: Frame list
The panel SHALL offer Erza and Qu's frames Shukra and Pavo, in that order, from the construct configurations. The panel SHALL open on the Display
model's frame (see `display-mode`), which is Shukra unless the user chose another; Erza is never the Display model in this version.

#### Scenario: Open the panel
- **WHEN** the side panel opens and no Display model is saved
- **THEN** Shukra's Generic is loaded, and switching to Playground shows Shukra in the header

#### Scenario: Saved Display model
- **WHEN** the Display model is Pavo's Generic and the side panel opens
- **THEN** Pavo's Generic is loaded, and switching to Playground shows Pavo in the header

#### Scenario: Erza is first in the picker
- **WHEN** in Playground the header picker is opened
- **THEN** it lists Erza, Shukra and Pavo in that order, and choosing Erza shows her for Playground only, leaving the Display model unchanged

#### Scenario: Board action onto Erza
- **WHEN** `BoardAct0201` plays on Shukra and Erza is chosen
- **THEN** Erza is shown and plays `Shukra · BoardAct0201`, retargeted, from 0 with Shukra's paired line

### Requirement: Frame picker in the header
In Playground the panel header SHALL show the shown frame's name as a picker (the name with a chevron). Activating it SHALL open a list
of the frames with the shown one marked; choosing another frame SHALL show it, for Playground only (it SHALL NOT change the Display
model). The picker SHALL be keyboard accessible (arrow keys move, Enter chooses, Escape closes) and SHALL fit a 320 px panel together
with the Display button. The header SHALL be hidden while Focus is on (see `viewer-toolbar`) and in Display.

#### Scenario: Pick a frame
- **WHEN** in Playground the header picker is opened on Shukra and Pavo is chosen
- **THEN** the header reads Pavo, Pavo's default skin loads, the skin strip shows Pavo's skin, and the Display model is unchanged

#### Scenario: Keyboard
- **WHEN** Shukra is shown, the picker has focus, is opened with Enter, `↓` is pressed once and Enter again
- **THEN** Pavo is shown

### Requirement: Switching frames loads and keeps like a skin switch
Choosing a frame SHALL load its default skin (its Generic) into the same viewer, with that frame's clip set and voice lines, and release
the previous model, clips and voice line. It SHALL keep what a skin switch keeps: the context, the clip of the same name in the new list
(else the context's default clip, a Board action restarting from 0 with the new frame's line), a camera the user moved, the display
settings, voice volume and mute, subtitles on or off, the loop choice, and mesh choices matched by node name. A newer choice SHALL
cancel an older load. A load error SHALL show the stage's error with Retry.

#### Scenario: Board action across frames
- **WHEN** `BoardAct0201` plays on Shukra and Pavo is chosen
- **THEN** Pavo's Generic plays its own `BoardAct0201` from 0 with Pavo's paired line, or silently when Pavo's `BoardAct0201` has no pairing

#### Scenario: Clip missing in the new frame
- **WHEN** `Executioner01` plays in Fight on Pavo and Shukra is chosen
- **THEN** Shukra stays in Fight and plays `Stand1` (Shukra has no `Executioner01`)

#### Scenario: No leak
- **WHEN** the two frames are chosen one after the other, three times each
- **THEN** each frame's default skin shows the same geometry and texture counts the last time as the first

### Requirement: Other frames have the viewer's features
Every frame's model SHALL be shown with toon shading by default and the original materials behind the switch, outlines, lighting, the
parts menu, screenshots (named after its frame and skin), subtitles of its voiced Board actions, the stage menu, the player and Focus.
Nothing SHALL be hidden on these models unless the user hides it (their manifests list no hidden nodes).

#### Scenario: Toon shading on Pavo
- **WHEN** Pavo's Generic is shown
- **THEN** it is drawn with cel bands and outlines, and turning "Toon shading" off shows its original materials

#### Scenario: Screenshot name
- **WHEN** a screenshot is taken of Pavo's `r2qumd010011` during `Run` at 0.40 s
- **THEN** the file is named `pavo_r2qumd010011_Run_0.40s.png`
