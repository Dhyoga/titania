## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Sleep
**Reason**: Paused, the pose reads as the model standing still for no reason; Display is to keep moving for as long as it is open.
**Migration**: None. Display keeps playing (see "Display keeps playing"); a closed or hidden panel still renders nothing.

### Requirement: Idle is varied
**Reason**: Split in three: "Idle candidates" and "Idle shares" (the candidates now include `StandAct0101` and the Fight clips, with new shares, and the sentence that `StandAct0101` is
never played goes) and "An idle plays whole loops" (the dwell, crossfade and repeat rules, unchanged). The old requirement cannot be modified in place: its scenarios "No StandAct0101"
and "Share of borrowed idles" no longer hold.
**Migration**: None.

### Requirement: The director stops outside Display
**Reason**: Replaced by "Leaving Display stops the director", without the sleeping pose that no longer exists (its scenario "Playground after sleep" goes with "Sleep").
**Migration**: None; the rest of the requirement is unchanged.
