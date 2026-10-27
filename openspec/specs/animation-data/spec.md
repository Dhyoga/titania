# animation-data Specification

## Purpose
Decoding the packed animation manifests and clips of a construct into typed, three.js-ready data, without any framework dependency. (Purpose TBD, synced from change add-clip-decoder.)

## Requirements

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
- **WHEN** the Crepuscule default skin's `anim/manifest.json` is parsed
- **THEN** the result has 139 clips, `contexts.menu.hiddenNodes` equal to `[392, 394, 395, 396]` and `contexts.menu.idle.clip` pointing at the clip named `UiStand1`

#### Scenario: Manifest without hidden nodes
- **WHEN** Stigmata's `anim/manifest.json` is parsed
- **THEN** parsing succeeds with 113 clips, empty `hiddenNodes` for both contexts and an empty `stateHides`

#### Scenario: Optional and unknown keys
- **WHEN** a manifest has no `contexts.fight.levels` and carries extra top-level keys
- **THEN** parsing succeeds and the extra keys are not part of the result

#### Scenario: Bad hidden nodes
- **WHEN** `contexts.menu.hiddenNodes` is present but not a list of non-negative integers
- **THEN** parsing throws an error that contains `contexts.menu.hiddenNodes`

#### Scenario: Clip index out of range
- **WHEN** a controller state refers to clip index 500 in a manifest with 139 clips
- **THEN** parsing throws an error that names the controller and the state

### Requirement: Clip paths resolve against the manifest's folder
A clip's `file` value in a manifest SHALL start with `anim/`. Its asset path SHALL be the folder of the
manifest that lists it, followed by the `file` value without that `anim/` prefix.

#### Scenario: Default skin
- **WHEN** the manifest path is `anim/manifest.json` and the clip file is `anim/BaseLayer/Born.json`
- **THEN** the asset path is `anim/BaseLayer/Born.json`

#### Scenario: Other skin
- **WHEN** the manifest path is `anim-skins/r5biankamd019241/manifest.json` and the clip file is `anim/BaseLayer/BoardAct0204.json`
- **THEN** the asset path is `anim-skins/r5biankamd019241/BaseLayer/BoardAct0204.json`

#### Scenario: Unexpected prefix
- **WHEN** a clip file does not start with `anim/`
- **THEN** resolving its path throws an error naming the file

### Requirement: Packed clips are decoded
The system SHALL decode a packed clip file into key times and tracks. Constant tracks SHALL keep a
single value. Animated position and scale tracks SHALL be rebuilt from three delta-coded planes with the
clip's `valueDigits` scale. Animated quaternion tracks SHALL be rebuilt from three quantized planes
(`rotationBits`) with the dropped component restored as the positive remainder and with changes of the
dropped component (`dropped`) honoured. Morph weight tracks SHALL be decoded per mesh node and morph
target index. A clip without `packing` SHALL decode as a static pose of two keys.

#### Scenario: Animated vectors and constants
- **WHEN** a clip with a delta-coded position track, a constant position track, a scale track and a constant quaternion track is decoded
- **THEN** the decoded values equal the originals within 1e-5 and the constant tracks hold exactly one value

#### Scenario: Quaternion with changing dropped component
- **WHEN** a quaternion track whose largest component changes partway through is decoded
- **THEN** every decoded key has unit length within 1e-4 and equals the original rotation within quantization error

#### Scenario: Neighbouring quaternions stay in one hemisphere
- **WHEN** a quaternion track crosses the point where the stored sign would flip
- **THEN** the dot product of every pair of neighbouring decoded keys is not negative

#### Scenario: Static pose
- **WHEN** a clip has no `packing` and only constant tracks
- **THEN** it decodes with two keys and its duration is one frame at 30 fps

### Requirement: Undecodable clips are rejected, not guessed
The decoder SHALL throw an error that names the clip, and the node where relevant, for an unsupported
`version`, key times that do not increase, fewer than two keys, a delta list of the wrong length, a
quaternion track that does not say which component is dropped at key 0, a weights track without
`target`, a track with neither `value` nor `deltas`, or an unknown property.

#### Scenario: Wrong length
- **WHEN** a position track with 4 keys carries 11 delta numbers
- **THEN** decoding throws an error naming the clip, the node and the expected count

#### Scenario: Unsupported version
- **WHEN** a clip has `version` 2
- **THEN** decoding throws an error naming the clip and the version

### Requirement: Decoded layout feeds three.js keyframe tracks directly
A decoded clip SHALL expose its key times as one `Float32Array` and every animated track's values as one
flat, key-major `Float32Array` (position and scale: 3 numbers per key, quaternion: 4, morph weight: 1),
and SHALL identify each track by glTF node index (not by node name).

#### Scenario: Layout
- **WHEN** a clip with 886 keys and an animated position track is decoded
- **THEN** that track's `values` has 2658 numbers ordered key by key, and `times` has 886 numbers

### Requirement: Clips and manifests are loaded with fetch and decoded
The system SHALL load a manifest or a clip from a URL, check the response status, parse and validate or
decode it, and return the result. A failure SHALL throw an error that contains the URL and the reason.
An aborted request SHALL be reported as an abort, not as a load failure. The `fetch` function SHALL be
replaceable so the code can run without a browser. Asset paths that contain spaces or other characters
that are not allowed in a URL path (Veritas' and Zero's `anim/Base Layer/…`) SHALL be encoded segment by
segment when the URL is built, so they load.

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
- **WHEN** Veritas' `BoardAct0201` (`anim/Base Layer/BoardAct0201.json`) is selected
- **THEN** its URL ends in `anim/Base%20Layer/BoardAct0201.json` and the clip loads and plays

### Requirement: The module is framework-free
Everything under `lib/anim/` SHALL be free of three.js, Vue and `browser`/`chrome` extension APIs, so
it can run in Node and be unit tested.

#### Scenario: No framework imports
- **WHEN** the imports of the files under `lib/anim/` are listed
- **THEN** none of them import `three`, `vue`, `wxt` or use the `browser` global

### Requirement: All shipped Crepuscule clips decode and agree with their models
Every clip of the Crepuscule construct SHALL decode and agree with its model. For every manifest (default
`anim/` and every `anim-skins/<id>/`) and every clip it lists, the clip file SHALL exist and decode
without error, its decoded duration SHALL be within 0.02 s of the manifest's `duration`, every track's
node index SHALL be a node of the manifest's target GLB, every morph weight target SHALL be inside the
morph target count of that node's mesh, and every animated quaternion SHALL have unit length.

#### Scenario: Sweep
- **WHEN** all 712 clips of the six manifests are decoded and compared with their target GLBs
- **THEN** there are no failures and no mismatches

#### Scenario: Data absent
- **WHEN** the `data/` folder is not present
- **THEN** the sweep is skipped with a message and the synthetic tests still run
