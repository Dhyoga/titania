## ADDED Requirements

### Requirement: All shipped Qu clips decode and agree with their models
Every clip of Shukra and Pavo SHALL decode and agree with its model. For every manifest (each frame's `anim/manifest.json`) and every
clip it lists, the clip file SHALL exist and decode without error, its decoded duration SHALL be within 0.02 s of the manifest's
`duration`, every track's node index SHALL be a node of the manifest's target GLB, every morph weight target SHALL be inside the
morph target count of that node's mesh, and every animated quaternion SHALL have unit length.

#### Scenario: Sweep
- **WHEN** all 170 clips of the two manifests (Shukra 70, Pavo 100) are decoded and compared with their target GLBs
- **THEN** there are no failures and no mismatches

#### Scenario: Data absent
- **WHEN** the `data/` folder is not present
- **THEN** the sweep is skipped with a message and the synthetic tests still run

## MODIFIED Requirements

### Requirement: Manifest is parsed and validated
The system SHALL turn an animation manifest (`anim/manifest.json` or `anim-skins/<id>/manifest.json`)
into a typed object. It SHALL require `formatVersion` 1, `target`, `model`, `defaultContext`, a `clips`
list whose entries each have `name`, `file`, `duration`, `frameRate`, `loop` and `rootNode`, a
`controllers` list, `contexts.menu` (`base`, `entry`, `idle`, `mounts`) and `contexts.fight` (`base`, `entry`,
`idle`, `mounts`, and optionally `levels` and `transitions`). `contexts.menu.hiddenNodes`, `contexts.menu.stateHides`
and `contexts.fight.hiddenNodes` SHALL be optional and default to an empty list or map; when present they SHALL be
validated. Clip indices used by controller states and by `menu.entry` and `menu.idle` SHALL lie
within the `clips` list. Keys that are not needed SHALL be ignored. A failure SHALL throw an error that
names the offending field path.

#### Scenario: Real manifest
- **WHEN** Shukra's `anim/manifest.json` is parsed
- **THEN** the result has 70 clips, empty `hiddenNodes` for both contexts, an empty `stateHides`, and `contexts.menu.idle.clip` pointing at the clip named `UiStand1`

#### Scenario: Manifest with two fight levels
- **WHEN** Pavo's `anim/manifest.json` is parsed
- **THEN** parsing succeeds with 100 clips and the fight context's `levels` controllers

#### Scenario: Optional and unknown keys
- **WHEN** a manifest has no `contexts.fight.levels` and carries extra top-level keys
- **THEN** parsing succeeds and the extra keys are not part of the result

#### Scenario: Bad hidden nodes
- **WHEN** `contexts.menu.hiddenNodes` is present but not a list of non-negative integers
- **THEN** parsing throws an error that contains `contexts.menu.hiddenNodes`

#### Scenario: Clip index out of range
- **WHEN** a controller state refers to clip index 500 in a manifest with 70 clips
- **THEN** parsing throws an error that names the controller and the state

### Requirement: Clip paths resolve against the manifest's folder
A clip's `file` value in a manifest SHALL start with `anim/`. Its asset path SHALL be the folder of the
manifest that lists it, followed by the `file` value without that `anim/` prefix.

#### Scenario: Default skin
- **WHEN** the manifest path is `anim/manifest.json` and the clip file is `anim/BaseLayer/Born.json`
- **THEN** the asset path is `anim/BaseLayer/Born.json`

#### Scenario: Other clip set
- **WHEN** the manifest path is `anim-skins/r3qumd010031/manifest.json` and the clip file is `anim/BaseLayer/BoardAct0201.json`
- **THEN** the asset path is `anim-skins/r3qumd010031/BaseLayer/BoardAct0201.json`

#### Scenario: Unexpected prefix
- **WHEN** a clip file does not start with `anim/`
- **THEN** resolving its path throws an error naming the file

### Requirement: Clips and manifests are loaded with fetch and decoded
The system SHALL load a manifest or a clip from a URL, check the response status, parse and validate or
decode it, and return the result. A failure SHALL throw an error that contains the URL and the reason.
An aborted request SHALL be reported as an abort, not as a load failure. The `fetch` function SHALL be
replaceable so the code can run without a browser. Asset paths that contain spaces or other characters
that are not allowed in a URL path (Pavo's `anim/Base Layer/…`, which holds its `StandAct0101` and Board actions) SHALL be encoded
segment by segment when the URL is built, so they load.

#### Scenario: Load failure
- **WHEN** the server answers 404 for a clip URL
- **THEN** the error message contains that URL and "404"

#### Scenario: Abort
- **WHEN** the caller aborts a pending load through its `AbortSignal`
- **THEN** the load rejects with an `AbortError` and no "Could not read" error is produced

#### Scenario: Injected fetch
- **WHEN** a test supplies its own `fetch` that serves files from disk
- **THEN** manifests and clips load and decode in Node without a browser

#### Scenario: Path with a space
- **WHEN** Pavo's `BoardAct0201` (`anim/Base Layer/BoardAct0201.json`) is selected
- **THEN** its URL ends in `anim/Base%20Layer/BoardAct0201.json` and the clip loads and plays

## REMOVED Requirements

### Requirement: All shipped Crepuscule clips decode and agree with their models
**Reason**: Crepuscule's data is not part of this project; the same sweep now runs over Qu's clips.
**Migration**: See "All shipped Qu clips decode and agree with their models".
