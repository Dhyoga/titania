# playback-speed Specification

## Purpose
Playback speed for clips and voice lines with the voice's pitch kept, and voice volume and mute with their persistence. (Purpose TBD, synced from change add-viewer-toolbar.)

## Requirements

### Requirement: Playback speed
The playback popover SHALL offer the speeds 0.25×, 0.5×, 1×, 1.5× and 2×, with 1× selected on open. The chosen speed SHALL
apply to the playing clip at once and to every clip started afterwards, including after a switch to another clip or context.
Time shown by the readout and the scrubber SHALL stay in clip (or timeline) seconds, and a frame step SHALL stay 1/30 s.

#### Scenario: Slower
- **WHEN** 0.5× is chosen while `UiStand1` plays
- **THEN** the readout advances at about half the real-time rate

#### Scenario: Speed is kept across clips
- **WHEN** 2× is chosen and then another clip is selected
- **THEN** the new clip plays at 2×

### Requirement: Speed applies to the voice line without changing its pitch
For a clip with a voice line, the speed SHALL apply to clip and voice line together, the voice SHALL keep its original pitch,
and pausing, seeking and the end of the timeline SHALL behave as at 1×. The idle tail and its crossfade follow the timeline,
so they also run at the chosen speed.

#### Scenario: Voiced Board action at 0.5×
- **WHEN** `BoardAct0201` plays at 0.5×
- **THEN** the audio plays at half speed with unchanged pitch and the pose at any moment is the pose of the timeline time read from the audio clock

### Requirement: Voice volume and mute
The playback popover SHALL have a voice volume slider (0 to 100 %, default 100 %) and a mute button. `M` SHALL toggle mute. Mute
SHALL silence the voice without stopping it or changing the timeline, and unmuting SHALL restore the volume of the slider. The
controls SHALL apply to the voice playing now and to every later one.

#### Scenario: Mute while playing
- **WHEN** `BoardAct0201` plays and the mute button is pressed
- **THEN** the voice is silent, the clip continues, and unmuting restores the sound at the slider's volume

### Requirement: Volume and mute are remembered
The volume and the mute state SHALL be remembered across sessions. When storage is unavailable the controls SHALL work and the
defaults SHALL apply on the next open, without an error.

#### Scenario: Reopen the panel
- **WHEN** the volume is set to 40 % and the voice muted, and the panel is closed and opened again
- **THEN** the volume slider shows 40 % and the mute button shows muted
