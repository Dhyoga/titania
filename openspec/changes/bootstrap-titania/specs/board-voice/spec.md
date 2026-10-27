## MODIFIED Requirements

### Requirement: Voice lines are paired with clips from voices.json
The panel SHALL read the `voices.json` of every frame whose clips the list offers, and pair a clip with the entry of its own frame's
`voices.json` whose `animation` field equals the clip's name. The audio file SHALL be `voices_<audioLang>/<file>` under that frame's
assets. Pairings SHALL come from data only; no clip or file name SHALL be hard-coded. If a frame's `voices.json` cannot be read, no clip
of that frame SHALL have a pairing and the rest of the panel SHALL work as before.

#### Scenario: Shukra pairings
- **WHEN** Shukra's Menu list is built
- **THEN** each of its Board actions that `voice_pairings.json` pairs has a pairing with a `shukra/voices_ja/v_qus_*.mp3` file, and the others have none

#### Scenario: Source frame pairing
- **WHEN** Shukra's Menu list is built and Pavo's `voices.json` pairs `BoardAct0201` with one of Pavo's files
- **THEN** `Pavo · BoardAct0201` is paired with that file under `pavo/voices_ja/`, and Shukra's own `BoardAct0201` keeps its own line

#### Scenario: voices.json missing
- **WHEN** a frame's `voices.json` cannot be fetched
- **THEN** that frame's Board actions play silently with their own duration, show no speaker glyph, and no error appears in the panel

### Requirement: A paired Board action plays with its voice line
Selecting a paired clip in the Menu context SHALL start the clip and its audio together at time 0. Clips
in the Fight context SHALL NOT play voice lines.

#### Scenario: Select a Board action
- **WHEN** a paired Board action of Shukra is selected
- **THEN** the clip starts at 0 and its paired `v_qus_*` line starts playing at its beginning at the same moment

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
- **WHEN** a paired Board action plays on Shukra and its voice is heard
- **THEN** a caption above the toolbar shows the current sentence of the line's English text, and the next cue replaces it as the line goes on

#### Scenario: Before the voice and after it
- **WHEN** a Board action starts and its line begins after about 2 s of silence, and later the line ends while the clip continues
- **THEN** no caption shows during the first silence, and none from about 0.4 s after the line's end

#### Scenario: No line
- **WHEN** `StandAct0101` plays
- **THEN** no caption shows
