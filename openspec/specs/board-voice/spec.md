# board-voice Specification

## Purpose
Playing a Board action together with its paired voice line: pairing from `voices.json`, the clip + line timeline (length, idle tail, crossfade, segment visibility), the line's audio as the master clock, pause/seek/scrub/loop/finish on the timeline, stopping the audio when the Board action is left, and silent fallback when the audio is unavailable. (Purpose TBD, synced from change add-board-voice-sync.)

## Requirements

### Requirement: Voice lines are paired with clips from voices.json
The panel SHALL read the `voices.json` of every frame whose clips the list offers, and pair a clip with the entry of its own frame's
`voices.json` whose `animation` field equals the clip's name. The audio file SHALL be `voices_<audioLang>/<file>` under that frame's
assets. Pairings SHALL come from data only; no clip or file name SHALL be hard-coded. If a frame's `voices.json` cannot be read, no clip
of that frame SHALL have a pairing and the rest of the panel SHALL work as before.

#### Scenario: Source frame pairing
- **WHEN** Crepuscule's Menu list is built and Stigmata's `voices.json` pairs `BoardAct0201` with `v_biankasuper_9_6.mp3`
- **THEN** `Stigmata · BoardAct0201` is paired with `stigmata/voices_ja/v_biankasuper_9_6.mp3`, and Crepuscule's own `BoardAct0201` keeps its own line

#### Scenario: voices.json missing
- **WHEN** a frame's `voices.json` cannot be fetched
- **THEN** that frame's Board actions play silently with their own duration, show no speaker glyph, and no error appears in the panel

### Requirement: A paired Board action plays with its voice line
Selecting a paired clip in the Menu context SHALL start the clip and its audio together at time 0. Clips
in the Fight context SHALL NOT play voice lines.

#### Scenario: Select a Board action
- **WHEN** `BoardAct0201` is selected
- **THEN** the clip starts at 0 and `v_biankasups_009_12` starts playing at its beginning at the same moment

### Requirement: The timeline is the longer of clip and audio
A paired clip SHALL play on a timeline whose length is the longer of the clip's duration and the decoded
audio's duration. The scrubber and the time readout SHALL span the timeline.

#### Scenario: Clip longer than the audio (every shipped line)
- **WHEN** `BoardAct0201` (clip 29.50 s, line 22.44 s) is selected
- **THEN** the readout shows `/ 29.50 s`

#### Scenario: Audio longer than the clip
- **WHEN** a paired clip of 24.00 s is played with a 34.78 s line
- **THEN** the readout shows `/ 34.78 s`

### Requirement: After the clip ends the model idles until the timeline ends
When the clip ends before the timeline, the model SHALL crossfade over about 0.25 s from the clip's last frame
into the menu idle clip (`UiStand1`), which SHALL loop until the timeline ends, while the audio continues. From
the start of that crossfade the visible meshes SHALL follow the idle clip's hidden-node rule instead of the
Board action's.

#### Scenario: Idle tail
- **WHEN** a 24.00 s Board action plays with a 34.78 s line past 24.00 s
- **THEN** the audio keeps playing, the model shows `UiStand1` from 24.25 s on, and the nodes 392, 394, 395 and 396 are invisible while 2, 4 and 393 are visible

#### Scenario: Idle tail longer than one idle loop
- **WHEN** the idle tail is longer than the idle clip (20.57 s for `UiStand1`)
- **THEN** the idle clip wraps during the tail without stopping

### Requirement: The clip continues silently when the audio ends first
When the audio ends before the clip, the clip SHALL continue to its end without sound.

#### Scenario: Short line
- **WHEN** `BoardAct1003` (clip 24.00 s, line 17.92 s) plays past 18 s
- **THEN** no audio plays and the clip continues to 24.00 s

### Requirement: Audio is the master clock
While a paired clip plays, the timeline time SHALL be derived from the audio's clock (the audio element's position, smoothed
between its updates and never running backwards), and the clip time SHALL be derived from the timeline time, never the other
way round. Pausing, resuming, seeking and changing the speed SHALL NOT let motion and voice drift apart.

#### Scenario: Long playback
- **WHEN** `BoardAct1007` plays for 40 s, with a pause and a resume in between
- **THEN** the pose shown at any moment is the pose of the timeline time read from the audio clock, within one frame (1/30 s), and that time is within 0.1 s of the audio's own position

### Requirement: Pause, seek and scrub act on clip and audio together
Pausing SHALL stop the audio and the motion at the same timeline time; resuming SHALL continue both from it.
Seeking or scrubbing to a time SHALL move both: the audio SHALL play from that time when it is inside the audio,
and the model SHALL show the pose of that time, which is the idle clip at the matching offset past the clip's end.
The pose at a timeline time SHALL be the same whether it was reached by playing or by seeking. A change of speed SHALL change
the rate of both together without moving the timeline time.

#### Scenario: Pause and resume
- **WHEN** `BoardAct0201` is paused at 12.30 s and resumed
- **THEN** the audio is silent while paused and continues from 12.30 s together with the clip

#### Scenario: Scrub past the end of the line
- **WHEN** the scrubber of `BoardAct0201` is dragged to 25.00 s and released while playing, then dragged back to 10.00 s
- **THEN** the clip continues from 25.00 s without sound, and after the second drag the audio plays from 10.00 s with the clip

#### Scenario: Scrub into the idle tail
- **WHEN** a 24.00 s Board action with a 34.78 s line is scrubbed to 30.00 s and released while playing
- **THEN** the model shows `UiStand1` at 6.00 s and the audio continues from 30.00 s

#### Scenario: Deterministic seek on the timeline
- **WHEN** a paired clip is sought to 20.00 s, and separately played from 0 and paused at 20.00 s
- **THEN** the node transforms are equal in both cases

#### Scenario: Speed change mid-line
- **WHEN** the speed is changed from 1× to 0.5× at 12.30 s of `BoardAct0201`
- **THEN** the timeline time stays 12.30 s at the change and then advances at half rate with the audio

### Requirement: Loop and end of the timeline
With loop on, reaching the end of the timeline SHALL restart clip and audio together from 0. With loop off,
the audio SHALL stop at the end, the model SHALL hold the last pose, the play button SHALL show "play", and
pressing it SHALL restart clip and audio from 0. The loop toggle SHALL start from the clip's manifest `loop`
flag (off for Board actions) and changing it SHALL NOT restart the timeline.

#### Scenario: Loop on
- **WHEN** loop is turned on during `BoardAct1003` and the timeline reaches 24.00 s
- **THEN** the clip and the audio both start again from 0

#### Scenario: Loop off
- **WHEN** `BoardAct0201` reaches 29.50 s with loop off
- **THEN** the audio has stopped, the model holds its last pose, and pressing play starts clip and audio from 0

### Requirement: Leaving a Board action stops its audio
The audio SHALL stop when another clip is selected, when the context switches to Fight, when another skin or frame is shown, and when
the panel closes. No audio SHALL play without its Board action.

#### Scenario: Choose another clip mid-line
- **WHEN** `UiStand1` is selected while `BoardAct0201` is at 12.00 s
- **THEN** the voice stops at once and `UiStand1` plays without sound

#### Scenario: Switch to Fight
- **WHEN** the context switches to Fight while a Board action plays
- **THEN** the voice stops and `Stand1` plays without sound

#### Scenario: Switch frames mid-line
- **WHEN** another frame is chosen in the header while a Board action's line plays
- **THEN** the line stops at once, before the new frame's model is shown

### Requirement: Missing audio plays silently
When a paired clip's audio cannot be fetched or cannot be decoded, the clip SHALL play as a clip without a voice line (its own
duration and loop flag, no idle tail), and no error SHALL be shown in the panel. When the audio is ready but the browser does
not let it start, the timeline SHALL run without sound at its normal length so the readout and scrubber do not change while
playing. A failure to load the clip itself SHALL still show the clip error.

#### Scenario: Audio file missing
- **WHEN** a paired Board action's audio file returns an error
- **THEN** the Board action plays silently, the readout shows the clip's duration, and no error message appears

#### Scenario: Browser refuses to start the audio
- **WHEN** a paired Board action's audio is decoded but starting playback is rejected
- **THEN** the clip and its timeline run without sound, no error message appears, and a warning is logged to the console

### Requirement: Audio loads on demand and is not fetched twice
A line's audio SHALL be fetched when its Board action is first selected, together with the clip and the idle
clip. A newer selection SHALL cancel the older loads and their results SHALL be ignored. Selecting the same Board
action again SHALL NOT fetch its audio again. At most one decoded line SHALL be kept in memory.

#### Scenario: Reselect
- **WHEN** `BoardAct1001` is selected, then `UiStand1`, then `BoardAct1001` again
- **THEN** its audio file is fetched once

#### Scenario: Fast reselection
- **WHEN** `BoardAct1007` is selected and, before it starts, `BoardAct1001`
- **THEN** only `BoardAct1001` and its line play

### Requirement: Subtitles follow the voice line
While a Board action plays with its voice line, the panel SHALL show the line's English transcript (`voices.json` `text`) as a caption
over the stage, just above the player (at the bottom of the stage while the player is hidden), and the
caption SHALL NOT take pointer input from the canvas. The transcript SHALL be cut into cues at sentence ends (pieces under 24 characters
joined with the next, pieces over 100 characters cut at a comma near their middle, else at a space), and each cue SHALL get a share of the
time the voice is heard (silence trimmed at both ends) in proportion to its length plus a short pause allowance; the timing is an
estimate. No caption SHALL show before the voice starts or later than 0.4 s after it ends, for a clip without a line, or when the line's
audio could not be loaded. The caption SHALL follow the voice timeline when seeking, scrubbing, changing speed and looping, and muting
SHALL NOT hide it.

#### Scenario: Caption during a line
- **WHEN** `BoardAct0201` plays on Crepuscule and its voice is heard
- **THEN** a caption above the toolbar shows the current sentence of "Like roses and thorns, forever entwined…", and the next cue replaces it as the line goes on

#### Scenario: Before the voice and after it
- **WHEN** a Board action starts and its line begins after about 2 s of silence, and later the line ends while the clip continues
- **THEN** no caption shows during the first silence, and none from about 0.4 s after the line's end

#### Scenario: No line
- **WHEN** `StandAct0101` plays
- **THEN** no caption shows

### Requirement: Subtitles can be switched off
The settings popover SHALL have a "Subtitles" switch, on by default, and `C` SHALL toggle it
with the same rules as the viewer's other shortcuts. Switching it off SHALL hide the caption at once without changing the playback. The
choice SHALL be remembered across sessions together with the voice volume and mute; when storage is unavailable the switch SHALL work and
the default SHALL apply on the next open, without an error.

#### Scenario: Switch off
- **WHEN** a caption shows and `C` is pressed
- **THEN** the caption disappears, the clip and voice continue, and the settings popover's "Subtitles" switch is off

#### Scenario: Remembered
- **WHEN** subtitles are switched off and the panel is closed and opened again
- **THEN** the "Subtitles" switch is off and no caption shows during a Board action
