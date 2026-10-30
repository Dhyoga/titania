# lobby-director Specification

## Purpose
What Display does on its own: a random Board action with its voice line on open and on every tap (a tap interrupts), idles picked from Menu and Fight clips (clips that do not loop play once) with a minimum dwell, the next action prepared in advance, no sleep, and how the director stops outside Display. (Purpose TBD, synced from change add-lobby-director.)

## Requirements

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
- **THEN** Display idles on its idles (Menu and Fight, see "Idle is varied"), and a tap starts a Board action

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

### Requirement: A tap starts an action and interrupts
A tap on the stage SHALL start the next action of the bag at once, also while an action plays: the playing action and its voice line
stop and the new action crossfades in. A tap is a press and release of the primary pointer on the stage within 10 px and 500 ms. A press
on the menu, a popover or the adjust bar SHALL NOT count; the caption lets presses through to the stage, so a press on it counts. A tap SHALL NOT count while the camera is being adjusted, while a
popover of the Display menu is open, or while the menu is pinned open (that press closes them instead). Taps closer than 400 ms to the
previous accepted tap SHALL be ignored, and so SHALL a tap before Display has started (the model still loading). A state reported for a clip
other than the one Display last started (the end of an interrupted action, a wrap of the idle that a tap is replacing) SHALL NOT change
what Display does. `Space` and `Enter` SHALL act as a tap when focus is not on a button, link or other control that
uses them.

#### Scenario: Tap in idle
- **WHEN** Display is in idle and the stage is tapped
- **THEN** a Board action starts with its voice line

#### Scenario: Tap during an action
- **WHEN** a Board action plays and the stage is tapped
- **THEN** another action starts, the first line stops, and the caption of the first line is gone

#### Scenario: A drag is not a tap
- **WHEN** the pointer is pressed on the stage, moved 30 px and released
- **THEN** nothing starts

#### Scenario: Tap while a popover is open
- **WHEN** the Model popover is open and the stage is tapped
- **THEN** the popover closes and no action starts

#### Scenario: Tap while adjusting
- **WHEN** Adjust camera is on and the stage is tapped
- **THEN** no action starts

#### Scenario: Tap near the end of an action
- **WHEN** the stage is tapped 0.1 s before an action ends, and the new action takes longer than that to load
- **THEN** the new action plays; the end of the old one does not bring the idle in

#### Scenario: Tap on the caption
- **WHEN** a caption shows and it is tapped
- **THEN** an action starts as for a tap anywhere else on the stage

#### Scenario: Fast taps
- **WHEN** the stage is tapped twice within 200 ms
- **THEN** one action starts

#### Scenario: Keyboard
- **WHEN** focus is on the page body and `Space` is pressed
- **THEN** an action starts as for a tap

#### Scenario: Space on a button
- **WHEN** focus is on a menu button and `Space` is pressed
- **THEN** the button is activated and no action starts

### Requirement: After an action the model idles
When an action ends (its clip and its voice line, whichever is longer), Display SHALL crossfade to an idle clip, clear the caption, and
stay in idle until the next tap. The action SHALL end with the loop off whatever the loop choice of Playground is.

#### Scenario: Action ends
- **WHEN** a Board action reaches the end of its timeline
- **THEN** an idle clip takes over with a crossfade of 0.25 s and no caption shows

#### Scenario: Loop choice
- **WHEN** the loop was turned on in Playground and Display plays an action
- **THEN** the action still ends and the model idles

### Requirement: The next action is prepared in advance
While Display idles or plays an action, the next action of the bag SHALL be prepared: its clip built and cached in the viewer, and its voice
line fetched, decoded and encoded. A tap SHALL start a prepared action without fetching, decoding or
building anything. A prepared line that is not used SHALL be released (its blob URL revoked); at most one action is prepared at a time.
When the preparing fails the action SHALL be loaded when it is started, as in Playground.

#### Scenario: Tap starts at once
- **WHEN** Display has idled for 3 s and the stage is tapped
- **THEN** the action starts without any new request for its clip or its line

#### Scenario: Interrupt
- **WHEN** a tap interrupts an action
- **THEN** the next action of the bag is prepared again, and the interrupted action's line is released

#### Scenario: Leaving Display
- **WHEN** the panel is switched to Playground while an action is prepared
- **THEN** the prepared line is released

### Requirement: Display plays at normal speed
Display SHALL play its clips and voice lines at normal speed (1×) whatever playback speed was set in Playground; the Playground speed SHALL
be applied again when Playground is entered.

#### Scenario: Slow Playground
- **WHEN** the speed is 0.25× in Playground and the panel is switched to Display
- **THEN** the idle and the actions play at 1×, and back in Playground the speed is 0.25× again

### Requirement: A failed action does not stop the lobby
When an action cannot be loaded or played, Display SHALL warn in the console, drop that action from the bag for this model, and carry on
in idle (or start the next action when the cause was a tap).

#### Scenario: Missing clip
- **WHEN** the clip file of the chosen action cannot be fetched
- **THEN** a warning is logged, the model keeps idling, and the next tap tries another action

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

### Requirement: Display keeps playing
Display SHALL NOT pause the pose on its own. With no input, the idles SHALL go on being picked and played (see "Idle is varied") for as long
as Display is shown; only a tap, leaving Display or another Display model changes what plays.

#### Scenario: Long without input
- **WHEN** Display has idled on Shukra's Generic for 5 minutes with no input
- **THEN** an idle clip is still playing, frames are still rendered, and idles have changed at the end of their dwell

#### Scenario: Tap after a long wait
- **WHEN** the stage is tapped after 5 minutes without input
- **THEN** an action starts as after any other tap

### Requirement: A clip that does not loop plays once
An idle candidate whose manifest entry does not loop (`Born`, `Standchange`, `Win`, `LevelAttack14`) SHALL play once from its start to its end,
whatever its length and whatever the loop choice of Playground, and the next idle SHALL then be chosen as at the end of a looping idle's
dwell. When it is chosen again it SHALL start again from its start. A tap during it SHALL start an action as in any idle.

#### Scenario: Win
- **WHEN** Shukra's `Win` (6.67 s) is chosen
- **THEN** it plays once, and at its end another idle (or `Win` again, from its start) crossfades in

#### Scenario: The entrance
- **WHEN** Shukra's `Born` (6.93 s) is chosen
- **THEN** it plays once to its end before the next idle is chosen

#### Scenario: Tap during an interlude
- **WHEN** the stage is tapped while `Standchange` plays
- **THEN** an action starts as after a tap in any idle

### Requirement: A Fight clip in Display looks like the Menu idle
A Fight clip played in Display, own or borrowed, SHALL show the meshes the shown skin's rule gives its Menu idle clip (`UiStand1`), not the
Fight rule, so that no mesh appears or disappears when it crossfades with a Menu clip. A borrowed Fight clip SHALL hold the bones its
source does not drive in the mean pose of the shown model's own Fight idle (`Stand1`), as it does in Playground's Fight list. A Fight clip
SHALL NOT have a voice line or a caption.

#### Scenario: No mesh swap
- **WHEN** a skin whose Fight list hides a mesh that its Menu idle shows is the Display model (a synthetic manifest: Qu's models hide nothing) and `Stand1` follows `UiStand1`
- **THEN** the same meshes are shown before, during and after the crossfade

#### Scenario: Borrowed Fight clip
- **WHEN** Pavo's `Win` plays on Shukra in Display
- **THEN** it plays retargeted with no caption, and Shukra's helper and cloth bones hold the mean pose of her own `Stand1`

### Requirement: A Fight clip carries over to Playground
When Display is left for Playground while a Fight clip plays, Playground SHALL be in the Fight context with that clip selected and going on,
and from then on SHALL apply the Fight rule for the meshes, as for any clip of its Fight list.

#### Scenario: Leave during Stand2
- **WHEN** the panel is switched to Playground while Shukra's `Stand2` plays in Display
- **THEN** the player shows Fight with `Stand2` selected, and no Menu clip starts

### Requirement: Idle candidates
Display's idle SHALL be picked from the shown skin's own Fight idles (`Born`, `Stand1`, `Stand2`, `Standchange`, `Save`, `Win` and the `LevelAttack…`
clips its Fight list has, except those the user turned off; all on by default), its own Menu idles (`UiStand1`, `StandAct0101`, always) and the same
clips of other frames the user chose (by default both Menu idles of each frame in `lobby.idleFrom`, no Fight clip), borrowed as in Playground.
`Run`, `Walk`, attacks and reactions are not candidates.

#### Scenario: Own Fight clips
- **WHEN** Shukra and then Pavo are the Display model with no choice saved
- **THEN** the own Fight candidates are Shukra's six (`Born`, `Stand1`, `Stand2`, `Standchange`, `Save`, `Win`) and Pavo's seven (those and `LevelAttack14`)

#### Scenario: Level skill on another frame
- **WHEN** Pavo's `LevelAttack14` is chosen for Shukra and comes up as an idle
- **THEN** it plays on Shukra's body, retargeted, once, with no caption

### Requirement: Idle shares
The own Fight, own Menu and borrowed groups SHALL take 60 %, 30 % and 10 % of the picks, renormalized over the groups that are not empty. Within
own Fight every clip SHALL weigh the same; within own Menu `UiStand1` SHALL weigh 3 and `StandAct0101` 2; the borrowed share SHALL be split evenly
over the lending frames, and within one lender its Fight clips and its Menu idles SHALL keep the ratio 60 : 30 when it lends both. Repeats are allowed.

#### Scenario: Shares on Shukra's default
- **WHEN** 1000 idles are chosen on Shukra with the default choice
- **THEN** 55 % to 65 % of them are Shukra's six Fight clips, 25 % to 35 % its own `UiStand1` and `StandAct0101`, and 7 % to 13 % Pavo's two Menu idles

#### Scenario: Nothing borrowed
- **WHEN** the user has cleared Pavo's section for Shukra and 600 idles are chosen with otherwise the default choice
- **THEN** 61 % to 72 % of them are Shukra's six Fight clips and the rest its own `UiStand1` and `StandAct0101`

#### Scenario: Own Fight turned off
- **WHEN** the user turned off all of Shukra's own Fight clips and 1000 idles are chosen on Shukra with otherwise the default choice
- **THEN** 70 % to 80 % of them are Shukra's own Menu idles and the rest Pavo's

### Requirement: An idle plays whole loops
A chosen clip that loops SHALL play whole loops for at least 10 s (the smallest number of loops that reaches 10 s, to within 0.05 s), and the next
idle SHALL be chosen at the end of its last loop; a different one crossfades in over 0.25 s, the same one just goes on looping. A clip that does not
loop plays once (see "A clip that does not loop plays once").

#### Scenario: Dwell
- **WHEN** Pavo's `UiStand1` (6.0 s) is chosen
- **THEN** it plays twice (12 s) before the next choice

#### Scenario: Long idle
- **WHEN** Shukra's `UiStand1` (17.0 s) is chosen
- **THEN** it plays once before the next choice

#### Scenario: Short idle
- **WHEN** Shukra's `StandAct0101` (3.33 s) is chosen
- **THEN** it plays three times before the next choice

#### Scenario: Short Fight idle
- **WHEN** Shukra's `Save` (2.0 s) is chosen
- **THEN** it plays five times before the next choice

#### Scenario: Another idle
- **WHEN** an idle ends its last loop and another idle is chosen (`Stand1` after `UiStand1`, or Pavo's after Shukra's own)
- **THEN** it crossfades in from the start, with no frame in bind pose

#### Scenario: Same idle again
- **WHEN** the same looping idle is chosen again
- **THEN** it keeps looping with no restart

### Requirement: Leaving Display stops the director
Leaving Display SHALL stop the director: no timer runs, no action starts by itself in Playground, and the prepared line is released. The
clip that was playing carries over to Playground as the selected clip.

#### Scenario: Playground after an action
- **WHEN** the panel is switched to Playground while an action plays
- **THEN** the action goes on and is the selected clip in the player, and no new action starts when it ends
