# animation-playback Specification

## Purpose
Playing the active construct's clips on its model in the side panel: the animation list per context, play, pause, seek, loop, crossfade, Fight/Menu switching, per-clip mesh visibility, in-place root motion, clip loading and caching, and keyboard control. (Purpose TBD, synced from change add-animation-playback.)

## Requirements

### Requirement: Animation list per context
The panel SHALL offer an animation list for the current context. The list SHALL hold clips only (there is no `Bind pose` item).
It SHALL start with the shown frame's own groups, built from the shown skin's manifest, followed by the groups of every other frame
(animation source) in frame-list order, each group label prefixed with the frame's name and a middle dot (`Stigmata · Board actions`).
In the Menu context a frame's groups SHALL be an `Idle` group with the menu idle clip and the menu controller's clips that are not
Board actions, and a `Board actions` group with every `BoardAct*` clip of the menu controller. In the Fight context a frame's groups
SHALL start from every clip referenced by the fight base controller and its `levels` controllers, grouped by name into Idle, Movement,
Attacks, Level skills, Reactions and Other, and SHALL then be cut down:
- when several clips share a name, only the one whose file is in the `BaseLayer` (or `Base Layer`) folder SHALL be listed if there
  is one;
- Attacks and Reactions SHALL be left out;
- Movement SHALL keep only the clips named exactly `Walk` and `Run`;
- Level skills SHALL keep only `LevelAttack08_NunWalk`, `LevelAttack11_Loop`, `LevelAttack013Loop` and `LevelAttack14`;
- clips whose name starts with `Squat` SHALL be left out;
- empty groups SHALL be left out.
The left-out clips SHALL stay in the manifests. Items SHALL be sorted by name with numbers compared by value within a group. When two
listed items of one frame share a name, each SHALL show its folder in brackets, and its folder and file name when the folder is shared
too. The field SHALL show a source item as `<Frame> · <name>`. Items whose clip has a paired voice line SHALL show a speaker glyph
after the name, with the text "with voice" for screen readers.

#### Scenario: Menu list on Crepuscule
- **WHEN** the Menu context is shown for Crepuscule's Generic - Final
- **THEN** the list reads `Idle`: `StandAct0101`, `UiStand1`; `Board actions`: `BoardAct0201` … `BoardAct1007`; then `Stigmata · Idle`, `Stigmata · Board actions` (with `BoardAct10021` and `BoardAct10022`), `Veritas · Idle`, `Veritas · Board actions`, `Zero · Idle`, `Zero · Board actions`

#### Scenario: Fight list on Crepuscule
- **WHEN** the Fight context is shown for Crepuscule's Generic - Final
- **THEN** Crepuscule's own groups read `Idle`: `Stand1`, `Stand2`, `Standchange`; `Movement`: `Run`, `Walk`; `Level skills`: the four kept clips; `Other`: `Born`, `Save`, `Win`, followed by `Stigmata · Idle`, `Stigmata · Movement` (`Run`, `Walk`), `Stigmata · Other`, `Veritas · Idle`, `Veritas · Movement` (`Run`), `Veritas · Other`, and Zero's groups likewise

#### Scenario: Field label of a source clip
- **WHEN** Veritas' `Win` is selected on Crepuscule
- **THEN** the field reads `Veritas · Win`

#### Scenario: Speaker glyph on paired Board actions
- **WHEN** the Menu list is open for Crepuscule
- **THEN** every Board action with a pairing in its own frame's `voices.json` shows the speaker glyph, and Veritas' `BoardAct0202` and `BoardAct0203` do not

### Requirement: Default playback on open
When a model has loaded and no earlier clip can be taken up (nothing is remembered, or the shown model's list lacks it), the panel SHALL be
in the Menu context with the menu idle clip (`UiStand1`) selected and playing, with loop set from that clip's manifest `loop` flag. The
panel opens in Display, where the lobby director chooses what plays first (see `lobby-director`).

#### Scenario: Nothing to take up
- **WHEN** a model is loaded in Playground and the clip that was selected before is not in its list
- **THEN** `UiStand1` plays, the loop toggle is on, and the time readout advances

#### Scenario: Open the panel
- **WHEN** the side panel opens
- **THEN** it is in Display and plays a Board action chosen by the lobby director, not `UiStand1` first

### Requirement: Selecting a clip plays it
Selecting a clip SHALL play it from time 0 with a crossfade of about 0.25 s from the previous clip and update the time readout's
duration to the clip's duration, or to the voice timeline's duration when the clip plays with a voice line. Its loop state SHALL be
the clip's manifest `loop` flag until the user has changed the loop toggle in this panel session; after that, every clip selected
SHALL play with the user's latest loop choice (see "Loop toggle").

#### Scenario: Switch to a Board action
- **WHEN** `BoardAct0201` is selected while `UiStand1` plays and the loop toggle has not been touched
- **THEN** `BoardAct0201` plays from 0 with its voice line, the readout shows `/ 29.50 s` (its 22.44 s line ends before the clip), and the loop toggle is off

#### Scenario: Switch to a clip without a voice line
- **WHEN** `StandAct0101` is selected and the loop toggle has not been touched
- **THEN** it plays from 0, the readout shows `/ 10.00 s`, and the loop toggle is on

#### Scenario: Clip ends with loop off
- **WHEN** a clip with loop off reaches its end
- **THEN** the model holds the last frame, the play button shows "play", and pressing it plays the clip again from 0

### Requirement: Tracks drive the right nodes
Each clip track SHALL animate the glTF node with its node index, even when several nodes share a name,
and morph weight tracks SHALL drive the morph target with their index on that node's mesh. Constant
tracks SHALL hold their value for the whole clip. Properties a clip does not animate SHALL show the
model's original values.

#### Scenario: Nodes with the same name
- **WHEN** a clip animates two different nodes that have the same name
- **THEN** each node receives its own track's values

#### Scenario: Morph weights
- **WHEN** a clip with a weights track for target 3 of the face mesh plays
- **THEN** that mesh's `morphTargetInfluences[3]` follows the track

### Requirement: Clips play in place
When a manifest's root node (`rootNode`) is a node above the pelvis bone, its position track SHALL NOT be applied, so the character
stays at its origin (Crepuscule's `Root`). When the root node is the pelvis bone `Bip001` itself (Stigmata, Veritas and Zero), its
position track SHALL be applied, since it carries the pelvis height. Other tracks of the root node and all other nodes SHALL be
applied.

#### Scenario: Attack with root motion
- **WHEN** Crepuscule's `Attack93` (root at z = −9.5 m in the data) plays
- **THEN** the root node keeps its bind position and the model stays inside the stage

#### Scenario: Root is the pelvis
- **WHEN** Stigmata's `Run` plays on Stigmata's model
- **THEN** the pelvis moves up and down with the run at about 0.9 to 1.0 m and the feet stay on the floor

### Requirement: Play and pause
The panel SHALL have a play/pause button that pauses and resumes the current clip at the current time.
The button SHALL show "pause" while playing and "play" otherwise.

#### Scenario: Pause and resume
- **WHEN** the user pauses at 3.20 s and resumes
- **THEN** the time readout stays at 3.20 s while paused and the clip continues from 3.20 s

### Requirement: Scrubber and time readout
The panel SHALL show a scrubber over the clip's duration and a readout `<time> / <duration> s` with two
decimals. Dragging the scrubber SHALL pause playback, show the pose at the dragged time, update the
readout while dragging, and restore the previous play state on release. Seeking to a time SHALL produce
the same pose as playing to that time.

#### Scenario: Drag while playing
- **WHEN** the user drags the scrubber of a playing clip to 5.00 s and releases
- **THEN** the readout shows 5.00 s during the drag, the model shows the pose at 5.00 s, and playback continues from 5.00 s after release

#### Scenario: Deterministic seek
- **WHEN** a clip is sought to 2.50 s, and separately played from 0 and paused exactly at 2.50 s
- **THEN** the node transforms are equal in both cases

### Requirement: Loop toggle
The panel SHALL have a loop toggle shown in the accent style when on. Turning loop on SHALL repeat the clip; turning it off SHALL let
the clip end and hold its last frame. Changing it SHALL NOT restart the clip. The toggle (or `L`) SHALL also set the loop state for
every clip selected afterwards, in either context and on any skin or frame, until it is changed again; before the user changes it each
clip uses its manifest `loop` flag. Reopening the panel SHALL start from the manifest flags again.

#### Scenario: Turn loop off mid-clip
- **WHEN** loop is turned off at 4.00 s of a looping clip
- **THEN** the clip continues from 4.00 s and stops at its end

#### Scenario: The choice sticks, off
- **WHEN** loop is turned off while `Stand1` plays in Fight and `Save` (manifest flag on) is selected next
- **THEN** `Save` plays with loop off

#### Scenario: The choice sticks, on
- **WHEN** loop is turned on while `Win` (manifest flag off) plays in Fight and `Born` (flag off) is selected next
- **THEN** `Born` plays with loop on

#### Scenario: Across contexts
- **WHEN** loop was turned off in Fight and the Menu context is selected, which plays `UiStand1` (manifest flag on)
- **THEN** `UiStand1` plays with loop off

### Requirement: Fight and Menu switch
A segmented `Fight | Menu` toggle SHALL be available in the top row of the player (left of the hide button), with the active
segment in the accent style. Switching SHALL replace the animation list, play the context's
default clip (Menu: `UiStand1`; Fight: the clip of `contexts.fight.idle`, `Stand1`), and apply that
context's hidden-node rules.

#### Scenario: To Fight
- **WHEN** the user selects `Fight`
- **THEN** the list shows the Fight groups and `Stand1` plays looping

### Requirement: Clips load on demand with errors kept local
A clip SHALL be fetched and decoded when first selected. While it loads, the previous clip SHALL keep
playing and the list field SHALL show the chosen name with a loading indicator. If a newer selection is
made, the older request SHALL be aborted and its result ignored. A failure SHALL show a one-line message
with the URL under the list and keep the previous clip playing; the rest of the panel SHALL stay usable.

#### Scenario: Missing clip file
- **WHEN** the selected clip's file cannot be fetched
- **THEN** an error naming the clip URL appears under the list and the previous clip keeps playing

#### Scenario: Fast reselection
- **WHEN** the user selects `BoardAct1007` and, before it loads, `BoardAct1001`
- **THEN** `BoardAct1001` ends up playing and `BoardAct1007` is never applied

### Requirement: Built clips are cached within a memory budget
Built clips SHALL be cached so reselecting a clip does not fetch it again. The cache SHALL keep the
decoded size of cached clips at or below 64 MiB, never evict the clip that is playing, and release mixer
resources for evicted clips.

#### Scenario: Reselect
- **WHEN** a clip that was played before is selected again
- **THEN** it plays without a new network request

#### Scenario: Budget
- **WHEN** all 10 Board actions and 20 Fight clips are played one after another
- **THEN** the cache holds at most 64 MiB of decoded data and the renderer's geometry and texture counts are unchanged

### Requirement: Keyboard shortcuts
When the panel has focus, `Space` SHALL toggle play/pause, `←` and `→` SHALL step the time by 1/30 s while
paused, and `L` SHALL toggle loop. Shortcuts SHALL be ignored while the animation list is open or a text
field or the scrubber has focus or the key comes from inside an open popover, and `Space` on a focused button SHALL
keep its normal behaviour.

#### Scenario: Step frames
- **WHEN** a clip is paused at 1.00 s and the user presses `→` three times
- **THEN** the readout shows 1.10 s

#### Scenario: Slider keys stay with the slider
- **WHEN** the volume slider in the playback popover has focus and `←` is pressed
- **THEN** the volume changes and the time of a paused clip does not

### Requirement: Animation list control is keyboard accessible
The animation list SHALL be a listbox with group headers that cannot be selected. It SHALL open from a
field showing the current clip name (truncated with an ellipsis when narrow) and a chevron, support `↑`,
`↓`, `Home`, `End`, `Enter`, `Esc` and typing a name prefix, show the selected item highlighted, and scroll
to it when opened.

#### Scenario: Keyboard selection
- **WHEN** the list is opened with the keyboard, the user types `BoardAct10` and presses `Enter`
- **THEN** `BoardAct1001` is selected and plays, and the list closes

### Requirement: Playback panel layout
The playback controls SHALL be in one place: the player, a rounded card laid over the bottom of the stage, in three rows: the Fight/Menu
toggle with the hide button, the animation select (full width, full clip name) with a sliders button on its right, and play/pause,
scrubber, time readout and loop toggle. No playback control SHALL sit outside the player. At a panel width of 320 px everything SHALL
fit without horizontal scrolling.

#### Scenario: Narrow panel
- **WHEN** the side panel is 320 px wide
- **THEN** all three rows of the player are fully visible over the stage and the page does not scroll horizontally
