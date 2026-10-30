## MODIFIED Requirements

### Requirement: Display opens with a Board action
When the side panel opens, and when the Display model is changed from the Display menu, Display SHALL start a Board action with its voice
line as soon as the model is shown, without waiting for a tap. When the panel was switched back to Display from Playground, Display
SHALL start in idle instead, with no new action. In Display a newly loaded model SHALL stay invisible until its first clip starts (at most 1.5 s after it loaded), so that it is
never shown in its bind pose first. A voice line SHALL start without a user gesture; when the browser refuses or the line misses the
clock's start window the action SHALL run silently (see `board-voice`).

#### Scenario: Open the panel
- **WHEN** the side panel opens on Shukra's Generic with a non-empty pool
- **THEN** a Board action of the pool plays, its voice line is heard, and its caption shows when captions are on

#### Scenario: Another Display model
- **WHEN** Pavo's Generic is chosen in the Display model popover
- **THEN** the new model is shown and starts a Board action

#### Scenario: Back from Playground
- **WHEN** the panel is switched from Playground to Display
- **THEN** Display is in idle and no Board action starts until a tap

#### Scenario: Back from Fight
- **WHEN** Playground was in the Fight context and the panel is switched to Display
- **THEN** Display idles on its Menu idles, and a tap starts a Board action

#### Scenario: Refused audio
- **WHEN** the browser refuses to start the voice line on open
- **THEN** the action plays without sound and the panel keeps working

#### Scenario: No bind pose on open
- **WHEN** the side panel opens
- **THEN** the first frame in which the model is visible already shows a frame of the action

#### Scenario: Slow start
- **WHEN** the first clip is not ready 1.5 s after the model loaded
- **THEN** the model is shown anyway

### Requirement: The action pool
The pool SHALL be every Board action (a Menu clip whose name starts with `BoardAct`) of the Display frame's own clips that has a voice line in
that frame's `voices.json`, always, plus the borrowed Board actions the user has chosen for that Display frame (see `display-mode`, "Display
animations"), each from the other frame's Generic clip set and with a voice line in that frame's `voices.json`, borrowed as in Playground. A
clip without a voice line SHALL NOT be in the pool. When the user has made no choice for the Display frame, the borrowed actions SHALL be its
default: every voiced Board action of each frame in its construct configuration's `lobby.actionFrom` (Shukra: Pavo; Pavo: Shukra). Actions
SHALL be taken from one shuffled bag over the whole pool: every action plays once before any plays twice, and the first action of a new bag
SHALL NOT be the last one of the previous bag. When the pool is empty (the Display frame's data could not be read and nothing is borrowed),
Display SHALL stay in idle and a tap SHALL start nothing.

#### Scenario: Shukra's default pool
- **WHEN** Display shows Shukra, no choice is saved for Shukra, and all ten Board actions (`0201`–`0203`, `1001`–`1007`) are paired for both frames
- **THEN** the pool holds twenty actions: Shukra's ten and Pavo's ten

#### Scenario: Nothing borrowed
- **WHEN** the user has cleared Pavo's section for Shukra
- **THEN** the pool holds Shukra's voiced Board actions only

#### Scenario: No line, no pool
- **WHEN** Pavo's `voice_pairings.json` entry has no `BoardAct0202`
- **THEN** `Pavo · BoardAct0202` is in neither frame's pool and is not offered in the Animations popover

#### Scenario: No repeats back to back
- **WHEN** the actions are started 60 times in a row on Shukra with a pool of twenty
- **THEN** no action follows itself, and each block of twenty starts (the first to the twentieth, the twenty-first to the fortieth, and so on) holds each action once

#### Scenario: Empty pool
- **WHEN** neither frame has a `voices.json`
- **THEN** Display idles, and tapping starts nothing

### Requirement: Idle is varied
In idle Display SHALL play `UiStand1` of the shown skin's own clip set (when it has it), always, and the `UiStand1` of the other frame when
the user has chosen it for the Display frame (or, with no choice saved, of every frame in its construct configuration's `lobby.idleFrom`:
Shukra: Pavo; Pavo: Shukra), borrowed as in Playground, the own clip taking 75 % of the picks and the borrowed ones together 25 % (split
evenly over them); when nothing is borrowed, the own clip alone. `StandAct0101` SHALL NOT be played in Display, on any frame, own or
borrowed, and SHALL NOT be offered. Repeats are allowed. A chosen idle SHALL play whole loops for at least 10 s (the number of loops is the
smallest that reaches 10 s, to within 0.05 s), and the next idle SHALL be chosen at the end of its last loop; a different one crossfades in
over 0.25 s, the same one just goes on looping. The meshes shown follow the shown skin's rule for a clip of that name.

#### Scenario: Dwell
- **WHEN** Pavo's `UiStand1` (6.0 s) is chosen
- **THEN** it plays twice (12 s) before the next choice

#### Scenario: Long idle
- **WHEN** Shukra's `UiStand1` (17.0 s) is chosen
- **THEN** it plays once before the next choice

#### Scenario: Another idle
- **WHEN** an idle ends its last loop and the other frame's `UiStand1` is chosen
- **THEN** it crossfades in from the start, with no frame in bind pose

#### Scenario: Same idle again
- **WHEN** the same idle is chosen again
- **THEN** it keeps looping with no restart

#### Scenario: Share of borrowed idles
- **WHEN** 400 idles are chosen on Shukra with the default choice
- **THEN** between 20 % and 30 % of them are Pavo's

#### Scenario: No StandAct0101
- **WHEN** 400 idles are chosen on either frame with any choice
- **THEN** none of them is `StandAct0101`, own or borrowed

#### Scenario: Own idle alone
- **WHEN** the user has cleared Pavo's `UiStand1` for Shukra
- **THEN** the idle is Shukra's own `UiStand1`, which just goes on looping at the end of each dwell

### Requirement: A borrowed clip plays as in Playground
A clip borrowed for Display SHALL be retargeted onto the shown model, and play with the same rules as the same item chosen in Playground:
its voice line and caption come from the frame it was borrowed from, the meshes shown follow the shown skin's rule for a clip of that name,
and hair and cloth hold the mean pose of the shown model's idle. It SHALL be prepared in advance like an own action (its lender's rig read
and its clip retargeted and cached), and its crossfades and end follow `lobby-director`'s other requirements.

#### Scenario: Pavo's action on Shukra
- **WHEN** Display shows Shukra and a paired Pavo Board action is chosen
- **THEN** it plays with Pavo's line and its caption, on Shukra's body

#### Scenario: Prepared like an own action
- **WHEN** a borrowed action is next in the bag and Display has idled for 3 s
- **THEN** a tap starts it without any new request for its clip, its lender's rig or its line

#### Scenario: Interrupt a borrowed action
- **WHEN** a tap interrupts a borrowed action
- **THEN** its line stops and is released, and the next action starts as for an own one

### Requirement: A lender that cannot be read is left out
When a lender's clip data or `voices.json` cannot be read, Display SHALL warn in the console and leave that lender's clips out of the pool
and the idle list for the session, and carry on with the others. When a borrowed clip fails to load or play, the rule of "A failed action
does not stop the lobby" applies.

#### Scenario: Lender without clips
- **WHEN** Pavo's manifest cannot be fetched
- **THEN** Display on Shukra plays its own clips only, and a warning is logged

#### Scenario: Lender without lines
- **WHEN** Pavo's `voices.json` cannot be read
- **THEN** none of Pavo's actions is in Shukra's pool, a warning is logged, and the rest of the pool is unchanged

### Requirement: The pool follows the choice while Display runs
Display SHALL use the new pool and idles without restarting when the chosen animations of the Display frame change while it runs (from
the Animations popover, an import, or another panel's write): the action or idle that plays SHALL go on to its end even when it was
removed; a removed action SHALL NOT start again; an added action SHALL join the current bag (it plays before any action plays twice) and
SHALL NOT come right after the last action taken; the next idle pick SHALL use the new idles; when the next action changed, it SHALL be
prepared in advance as before.

#### Scenario: Remove while playing
- **WHEN** Pavo's `BoardAct0201` plays on Shukra and the user clears Pavo in the popover
- **THEN** it plays to its end, the lobby idles, and no Pavo action starts afterwards

#### Scenario: Add while idling
- **WHEN** Display idles on Shukra with Pavo cleared and the user checks Pavo's `BoardAct1004`
- **THEN** the idle goes on, and Pavo's `BoardAct1004` starts within the next bag's worth of taps

#### Scenario: Prepared action removed
- **WHEN** the prepared next action is removed from the pool
- **THEN** another action is prepared, and the next tap starts an action that is in the pool
