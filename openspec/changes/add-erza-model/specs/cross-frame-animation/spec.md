## MODIFIED Requirements

### Requirement: Other frames are animation sources
For the shown model, every frame in the frame list that has a clip set and is not the shown one SHALL be an animation source: on Shukra, Pavo; on
Pavo, Shukra; on Erza, Shukra and Pavo. Erza has no clip set of her own and is never a source. A source's clips SHALL be those of its Generic
clip set (`anim/`). A frame MAY name in its construct configuration extra clips from another of its clip sets, or clips that it lends from another
clip set in place of its Generic ones; Shukra and Pavo name none. A source clip SHALL belong to the Menu context when the source's menu controller lists
it (or it is the source's menu idle clip) and to the Fight context when the source's fight controllers list it, and SHALL be cut down by the same rules
as the shown frame's own list.

#### Scenario: Sources for Shukra
- **WHEN** Shukra is shown in the Menu context
- **THEN** the list offers Pavo's `StandAct0101`, `UiStand1` and ten Board actions, and nothing of Erza's

#### Scenario: Pavo's fight clips on Shukra
- **WHEN** Shukra is shown in the Fight context
- **THEN** the list offers Pavo's `LevelAttack14` and `Executioner01` … `Executioner05`, which Shukra's own list lacks

#### Scenario: Sources for Erza
- **WHEN** Erza is shown in the Menu context
- **THEN** the list offers Shukra's and Pavo's `StandAct0101`, `UiStand1` and ten Board actions each, and no clip of her own

### Requirement: Retargeted Board actions play with their own frame's voice
A retargeted clip SHALL be paired with a voice line through its source frame's `voices.json` and play it from the source frame's
`voices_ja/`, with the same timeline, master-clock, subtitle and silent-fallback behaviour as a native Board action. When the line is
longer than the clip, the idle tail SHALL be the shown model's own menu idle clip, or, when the shown model has no clip set of its own, the menu idle
(`UiStand1`) of the clip's own source frame, retargeted onto the shown model.

#### Scenario: Pavo's line on Shukra
- **WHEN** a paired `Pavo · BoardAct…` is selected on Shukra
- **THEN** Pavo's paired line plays from `pavo/voices_ja/` with Pavo's subtitle, and if the line is longer than the clip, Shukra's `UiStand1` takes over after the clip ends until the line ends

#### Scenario: Source without a line
- **WHEN** a Pavo Board action without a pairing is selected on Shukra
- **THEN** it plays silently for its own duration without a speaker glyph or error

#### Scenario: Shukra's line on Erza
- **WHEN** `Shukra · BoardAct1004` (clip 41.83 s, line 41.92 s) is selected on Erza
- **THEN** Shukra's line and subtitle play, and after the clip ends `Shukra · UiStand1`, retargeted onto Erza, takes over for the last 0.1 s

## ADDED Requirements

### Requirement: A frame with no clip set of its own plays only lent clips
A frame whose construct configuration names no clip set SHALL be shown with all of its animations lent by the other frames: its list holds the sources'
groups only, each labelled with the source's name, and it starts on the first source's default clip of the context. Lent clips SHALL use the shown model's
`Bip001` as root, no fill pose and nothing hidden except by the user. Its player controls SHALL be enabled; "No animations" applies only with neither a clip
set nor sources.

#### Scenario: Open Erza
- **WHEN** Erza is chosen in the frame picker while Shukra plays `BoardAct0201` in Menu
- **THEN** the list starts with `Shukra · Idle`, plays `Shukra · BoardAct0201` retargeted, and the player controls are enabled

#### Scenario: Nothing remembered
- **WHEN** Erza is opened with no clip selected before
- **THEN** `Shukra · UiStand1` plays in Menu looping, and `Shukra · Stand1` in Fight

#### Scenario: Clip missing
- **WHEN** Pavo's `Executioner01` plays in Fight on Pavo and Erza is chosen
- **THEN** `Pavo · Executioner01` plays on Erza, retargeted

#### Scenario: Leaving Erza
- **WHEN** `Shukra · BoardAct0201` plays on Erza and Shukra is chosen
- **THEN** Shukra's own `BoardAct0201` plays from 0 with her line

#### Scenario: Helper bones hold the bind pose
- **WHEN** any lent clip plays on Erza
- **THEN** her skirt, hair and ribbon bones stay in their bind pose and no error is logged

#### Scenario: Controls and remembered selection
- **WHEN** Erza is shown
- **THEN** the player, the scrubber, the loop toggle and the Fight/Menu toggle are enabled, and a selection is remembered by source frame and name across skin and frame switches, as for any lent clip

#### Scenario: Stays in bounds
- **WHEN** Shukra's `Run` plays on Erza
- **THEN** Erza stays at the origin, her pelvis follows the run scaled by the ratio of pelvis heights (1.110 / 0.959), and she faces −Z
