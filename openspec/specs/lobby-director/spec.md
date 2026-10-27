# lobby-director Specification

## Purpose
What Display does on its own: a random Board action with its voice line on open and on every tap (a tap interrupts), varied idles with a minimum dwell, the next action prepared in advance, sleep after 2 minutes without input, and how the director stops outside Display. (Purpose TBD, synced from change add-lobby-director.)

## Requirements

### Requirement: Display opens with a Board action
When the side panel opens, and when the Display model is changed from the Display menu, Display SHALL start a Board action with its voice
line as soon as the model is shown, without waiting for a tap. When the panel was switched back to Display from Playground, Display
SHALL start in idle instead, with no new action. In Display a newly loaded model SHALL stay invisible until its first clip starts (at most 1.5 s after it loaded), so that it is
never shown in its bind pose first. A voice line SHALL start without a user gesture; when the browser refuses or the line misses the
clock's start window the action SHALL run silently (see `board-voice`).

#### Scenario: Open the panel
- **WHEN** the side panel opens on Crepuscule Generic - Final
- **THEN** a Board action of the pool plays, its voice line is heard, and its caption shows when captions are on

#### Scenario: Another Display model
- **WHEN** a different skin is chosen in the Display model popover
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
animations"), each from another frame's Generic clip set (with that frame's extras) and with a voice line in that frame's `voices.json`,
borrowed as in Playground. The Display frame's own clips SHALL include its extras that the shown skin lists as the frame's own (Solitary
Dream's `BoardAct10021` and `BoardAct10022` on Stigmata's other skins). A clip without a voice line SHALL NOT be in the pool. When the user
has made no choice for the Display frame, the borrowed actions SHALL be its default: every voiced Board action of each frame in its
construct configuration's `lobby.actionFrom` (Crepuscule: Stigmata and Veritas; the other frames: none). Any frame, Zero included, SHALL be
choosable as a lender. Actions SHALL be taken from one shuffled bag over the whole pool: every action plays once before any plays twice, and
the first action of a new bag SHALL NOT be the last one of the previous bag. When the pool is empty (the Display frame's data could not be
read), Display SHALL stay in idle and a tap SHALL start nothing.

#### Scenario: Crepuscule's default pool
- **WHEN** Display shows any Crepuscule skin and no choice is saved for Crepuscule
- **THEN** the pool holds thirty actions: Crepuscule's ten Board actions, Stigmata's twelve (its ten and Solitary Dream's two) and Veritas' eight (all but `0202` and `0203`)

#### Scenario: Veritas' own pool
- **WHEN** Display shows a Veritas skin and no choice is saved for Veritas
- **THEN** the pool holds Veritas' `BoardAct0201`, `1001`, `1002`, `1003`, `1004`, `1005`, `1006` and `1007` and nothing borrowed

#### Scenario: Solitary Dream's actions are Stigmata's own
- **WHEN** Display shows Stigmata Generic - Final
- **THEN** the pool holds `BoardAct10021` and `BoardAct10022` among its own actions, whatever is chosen

#### Scenario: Zero chosen
- **WHEN** the user has chosen Zero's `BoardAct1004` for Crepuscule
- **THEN** that action is in the pool and plays with Zero's line and caption

#### Scenario: No line, no pool
- **WHEN** Display shows Night Sonata
- **THEN** `BoardAct0204` and `BoardAct0205` (no voice line) are never played

#### Scenario: No repeats back to back
- **WHEN** the actions are started 60 times in a row on Crepuscule with the default pool
- **THEN** no action follows itself, and each block of thirty starts (the first to the thirtieth, the thirty-first to the sixtieth) holds each action once

#### Scenario: Empty pool
- **WHEN** the Display frame has no `voices.json` and borrows nothing
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

### Requirement: Idle is varied
In idle Display SHALL play `UiStand1` of the shown skin's own clip set (when it has it), always, and the `UiStand1` of every other frame the
user has chosen for the Display frame (or, with no choice saved, of every frame in its construct configuration's `lobby.idleFrom`:
Crepuscule: Stigmata; the others: none), borrowed as in Playground, the own clip taking 75 % of the picks and the borrowed ones together 25 %
(split evenly over them); when nothing is borrowed, the own clip alone. `StandAct0101` SHALL NOT be played in Display, on any frame, own or
borrowed, and SHALL NOT be offered. Repeats are allowed. A chosen idle SHALL play whole loops for at least 10 s (the number of loops is the
smallest that reaches 10 s, to within 0.05 s), and the next idle SHALL be chosen at the end of its last loop; a different one crossfades in
over 0.25 s, the same one just goes on looping. The meshes shown follow the shown skin's rule for a clip of that name.

#### Scenario: Dwell
- **WHEN** an idle of 6 s is chosen
- **THEN** it plays twice (12 s) before the next choice

#### Scenario: Another idle
- **WHEN** an idle ends its last loop and another source's `UiStand1` is chosen (Stigmata's after Crepuscule's own, or the reverse)
- **THEN** it crossfades in from the start, with no frame in bind pose

#### Scenario: Same idle again
- **WHEN** the same idle is chosen again
- **THEN** it keeps looping with no restart

#### Scenario: Share of borrowed idles
- **WHEN** 400 idles are chosen on Crepuscule with the default choice
- **THEN** between 20 % and 30 % of them are Stigmata's

#### Scenario: Several borrowed idles
- **WHEN** the user has chosen Stigmata's, Veritas' and Zero's `UiStand1` for Crepuscule and 1200 idles are chosen
- **THEN** Crepuscule's own is 70 % to 80 % of them and each borrowed one 6 % to 11 %

#### Scenario: No StandAct0101
- **WHEN** 400 idles are chosen on any frame with any choice
- **THEN** none of them is `StandAct0101`, own or borrowed

#### Scenario: Own idle alone
- **WHEN** Display shows Stigmata, Veritas or Zero and no idle is chosen for that frame
- **THEN** the idle is the model's own `UiStand1`, which just goes on looping at the end of each dwell

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

### Requirement: Sleep
After 2 minutes without input, at the end of an idle loop (the next wrap of the idle that plays), Display SHALL pause the pose so that the viewer renders nothing. Input
is a tap, a key, any use of the Display menu, its popovers and the adjust bar, and entering Display. Display SHALL NOT sleep while an
action plays or while Adjust camera is on. A tap while asleep SHALL wake Display and start an action.

#### Scenario: Falls asleep
- **WHEN** Display has been in idle for 2 minutes with no input
- **THEN** at the end of the current idle loop the pose is paused and no frame is rendered during the next 2 s

#### Scenario: Wake
- **WHEN** the stage is tapped while Display sleeps
- **THEN** the pose resumes and an action starts

#### Scenario: Not during an action
- **WHEN** a 50 s action plays 1 min 50 s after the last input
- **THEN** it plays to its end and Display idles; sleep comes at the end of an idle loop 2 minutes after the last input

#### Scenario: Input resets the time
- **WHEN** the Display menu is used 1 min 50 s after the last input
- **THEN** Display does not sleep for another 2 minutes

### Requirement: Display plays at normal speed
Display SHALL play its clips and voice lines at normal speed (1×) whatever playback speed was set in Playground; the Playground speed SHALL
be applied again when Playground is entered.

#### Scenario: Slow Playground
- **WHEN** the speed is 0.25× in Playground and the panel is switched to Display
- **THEN** the idle and the actions play at 1×, and back in Playground the speed is 0.25× again

### Requirement: The director stops outside Display
Leaving Display SHALL stop the director: no timer runs, no action starts by itself in Playground, a sleeping pose resumes, and the
prepared line is released. The clip that was playing carries over to Playground as the selected clip.

#### Scenario: Playground after an action
- **WHEN** the panel is switched to Playground while an action plays
- **THEN** the action goes on and is the selected clip in the player, and no new action starts when it ends

#### Scenario: Playground after sleep
- **WHEN** the panel is switched to Playground while Display sleeps
- **THEN** the pose is playing again

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

#### Scenario: Stigmata's action on Crepuscule
- **WHEN** Display shows Crepuscule and Stigmata's `BoardAct0201` is chosen
- **THEN** it plays with Stigmata's line (`v_biankasuper_9_6`) and its caption, on Crepuscule's body

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
- **WHEN** Stigmata's manifest cannot be fetched
- **THEN** Display on Crepuscule plays its own clips and Veritas' only, and a warning is logged

#### Scenario: Lender without lines
- **WHEN** Veritas' `voices.json` cannot be read
- **THEN** none of Veritas' actions is in the pool, a warning is logged, and the rest of the pool is unchanged

### Requirement: The pool follows the choice while Display runs
Display SHALL use the new pool and idles without restarting when the chosen animations of the Display frame change while it runs (from
the Animations popover, an import, or another panel's write): the action or idle that plays SHALL go on to its end even when it was
removed; a removed action SHALL NOT start again; an added action SHALL join the current bag (it plays before any action plays twice) and
SHALL NOT come right after the last action taken; the next idle pick SHALL use the new idles; when the next action changed, it SHALL be
prepared in advance as before.

#### Scenario: Remove while playing
- **WHEN** Stigmata's `BoardAct0201` plays on Crepuscule and the user clears Stigmata in the popover
- **THEN** it plays to its end, the lobby idles, and no Stigmata action starts afterwards

#### Scenario: Add while idling
- **WHEN** Display idles on Crepuscule and the user checks Zero's `BoardAct1004`
- **THEN** the idle goes on, and Zero's `BoardAct1004` starts within the next bag's worth of taps

#### Scenario: Prepared action removed
- **WHEN** the prepared next action is removed from the pool
- **THEN** another action is prepared, and the next tap starts an action that is in the pool
