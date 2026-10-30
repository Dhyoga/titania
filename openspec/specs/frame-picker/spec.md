# frame-picker Specification

## Purpose
Choosing which of Bianca's frames (Crepuscule, Stigmata, Veritas, Zero) the viewer shows: the frame list and the picker in the header, what switching frames loads and keeps, and that the other frames get every viewer feature. (Purpose TBD, synced from change add-frame-picker.)

## Requirements

### Requirement: Frame list
The panel SHALL offer Bianca's frames Crepuscule, Stigmata, Veritas and Zero, in that order, from the construct configurations. The
panel SHALL open on the Display model's frame (see `display-mode`), which is Crepuscule unless the user chose another.

#### Scenario: Open the panel
- **WHEN** the side panel opens and no Display model is saved
- **THEN** Crepuscule's Generic - Final is loaded, and switching to Playground shows Crepuscule in the header

#### Scenario: Saved Display model
- **WHEN** the Display model is Veritas Grace and the side panel opens
- **THEN** Veritas Grace is loaded, and switching to Playground shows Veritas in the header

### Requirement: Frame picker in the header
In Playground the panel header SHALL show the shown frame's name as a picker (the name with a chevron). Activating it SHALL open a list
of the four frames with the shown one marked; choosing another frame SHALL show it, for Playground only (it SHALL NOT change the Display
model). The picker SHALL be keyboard accessible (arrow keys move, Enter chooses, Escape closes) and SHALL fit a 320 px panel together
with the Display button. The header SHALL be hidden while Focus is on (see `viewer-toolbar`) and in Display.

#### Scenario: Pick a frame
- **WHEN** in Playground the header picker is opened and Veritas is chosen
- **THEN** the header reads Veritas, Veritas' default skin loads, the skin strip shows Veritas' skins, and the Display model is unchanged

#### Scenario: Keyboard
- **WHEN** the picker has focus, is opened with Enter, `↓` is pressed twice and Enter again
- **THEN** Veritas is shown

### Requirement: Switching frames loads and keeps like a skin switch
Choosing a frame SHALL load its default skin (its Generic - Final) into the same viewer, with that frame's clip set and voice lines,
and release the previous model, clips and voice line. It SHALL keep what a skin switch keeps: the context, the clip of the same name
in the new list (else the context's default clip, a Board action restarting from 0 with the new frame's line), a camera the user
moved, the display settings, voice volume and mute, subtitles on or off, the loop choice, and mesh choices matched by node name.
A newer choice SHALL cancel an older load. A load error SHALL show the stage's error with Retry.

#### Scenario: Board action across frames
- **WHEN** `BoardAct0201` plays on Crepuscule and Stigmata is chosen
- **THEN** Stigmata's Generic - Final plays its own `BoardAct0201` from 0 with Stigmata's paired line

#### Scenario: Clip missing in the new frame
- **WHEN** `Walk` plays in Fight on Stigmata and Zero is chosen
- **THEN** Zero stays in Fight and plays `Stand1` (Zero has no `Walk`)

#### Scenario: No leak
- **WHEN** the four frames are chosen one after another twice
- **THEN** each frame's default skin shows the same geometry and texture counts the second time as the first

### Requirement: Other frames have the viewer's features
A model of Stigmata, Veritas or Zero SHALL be shown with toon shading by default and the original materials behind the switch,
outlines, lighting, the parts menu, screenshots (named after its frame and skin), subtitles of its voiced Board actions, the
stage menu, the player and Focus, as Crepuscule is. Nothing SHALL be hidden on these models unless the user hides it (their manifests list no hidden
nodes).

#### Scenario: Screenshot name
- **WHEN** a screenshot is taken of Veritas' `r3biankamd010031` during `Run` at 0.40 s
- **THEN** the file is named `veritas_r3biankamd010031_Run_0.40s.png`
