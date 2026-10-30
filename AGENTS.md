# AGENTS.md

Instructions for AI coding agents working in this repository.
Read this file and `DESIGN.md` before making any change.

## Project

**Titania: Fairy Tail Companion** is a **personal** browser extension that shows a 3D viewer in the browser **side panel** for
**Erza Scarlet** of *Fairy Tail*. Erza has models but no animations or voice lines of her own; **Qu** of *Punishing: Gray Raven* shares her
voice actress, so Qu's two frames, **Shukra** and **Pavo**, are the source of Erza's motion (clips, retargeted at runtime) and voice.

- Personal use only. It will never be published. It is loaded unpacked.
- Everything is rendered locally with three.js from assets in `data/`.
  Never embed, iframe, or fetch anything from huaxu.app or any other remote host at runtime.
- **Current scope (after `add-erza-model`): Erza, Shukra and Pavo are frames**, in that order. Shukra and Pavo (Generic skin each, with their
  clips and voice lines) are shown in both modes; **Erza (one skin, her body without the sword) is shown in Playground only and plays only
  Shukra's and Pavo's clips, retargeted**, with their voice lines. `erza-only-companion` then hides Shukra and Pavo (they stay in `data/` as
  animation and voice sources) and makes Display show Erza. Code should not hard-code a construct id deep in components: pass it down from one
  place (`lib/constructs/`).
- **Origin of the code.** The panel is a copy of the PGR companion (`/home/dhyoga/serdadu/pgr`, "Bianca: Gray Raven Companion") at commit
  **`baeda85`**, with its 20 specs as the baseline of `openspec/specs/`. PGR keeps moving; Titania does not follow it automatically (see
  "PGR since the copy"). Comments about Bianca that explain *why* code is as it is (retarget's hierarchy notes, `contact.ts`'
  hand-on-hip measurements, `catalog.ts`' folder rules) were kept on purpose: those measurements are the reason the code exists.
- **Voices tab is deferred.** Voice audio is used only to accompany Board action clips (see "Board action + voice" in `DESIGN.md`).
- **Two modes**: **Display** (the default on open: a locked bust camera on the saved Display model, the quiet lobby-like view) and
  **Playground** (the full panel). See `DESIGN.md` and the specs `display-mode`, `lobby-director`.
- **Behaviour is specified in `openspec/specs/`** (and `DESIGN.md` for the look); this file records the data contracts and the measured
  facts the code relies on. When they disagree with the code, the code and its tests are what runs: fix the document.

### PGR since the copy

Titania is pinned to PGR `baeda85`. PGR has since added `restore-standact-idle` (`StandAct0101` is a Display idle again, commit
`d3a4e88`), extension icons (`07bf1a1`), and, not yet committed when this was written, `remove-lobby-sleep` and the active change
`add-lobby-fight-idles`. None is in Titania: Display here never plays `StandAct0101`, still sleeps after 2 minutes, and has no extension
icon. Porting them is a change of its own (specs into `openspec/specs/`, then code and tests); do not copy files across ad hoc.

## Stack

| Concern | Choice |
|---|---|
| Extension framework | WXT (Manifest V3, Chrome target) |
| UI | Vue 3, `<script setup lang="ts">`, via `@wxt-dev/module-vue` |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` |
| 3D | three.js (`GLTFLoader`, `AnimationMixer`, `OrbitControls`) |
| Language | TypeScript, strict mode |
| Package manager | pnpm |
| Data scripts | Python 3 (standard library only) |

## Repository layout

```
erza/
├── data/                      # Asset store. READ-ONLY for agents (see below). Git-ignored.
│   ├── shukra/ pavo/          # Qu's frames: models/ anim/ voices_en/ voices_ja/ voices.json icons/ wiki/voices.html
│   └── erza/                  # source/Erza Scarlet/ (FBX, DAE, OBJ, PNG: moved here by add-erza-model) and models/erza-scarlet.glb (generated)
├── Erza Scarlet (Heaven's Wheel Armor)/   # a second model, out of scope for now; git-ignored, untouched
├── scripts/                   # convert-fbx.ts: Erza's FBX -> data/erza/models/*.glb (Node; reads a source folder, writes under data/erza/ only)
├── download_construct.py      # models, icons, voices, saved voices page; owns the PREFABS table (shukra, pavo)
├── download_animations.py     # clips of each frame's Generic skin (imports PREFABS)
├── build_voices.py            # data/<slug>/voices.json from the saved page + voice_pairings.json
├── voice_pairings.json        # Board action -> huaxu line title per frame (input of build_voices.py)
├── entrypoints/               # background.ts (opens the side panel on icon click), sidepanel/ (index.html, main.ts, App.vue)
├── components/                # Vue UI: ModelTab (host of both modes), ModelViewer, StageCard, StageMenu, Player, SubtitleOverlay,
│                              #   AnimationSelect, Popover + Settings/Lighting/Playback/Parts/Preferences popovers, DisplayModelPopover,
│                              #   DisplayAnimationsPopover, AdjustCameraBar, SkinStrip, SkinTitle, PanelHeader, Icon, ...
├── composables/               # useViewer, usePlayback, usePreferences (the one store of `titania.prefs`), useParts, useLobbyDirector,
│                              #   useViewerSettings, useVoiceOutput, useCameraPreference, usePreferenceFiles, key handlers, ...
├── lib/viewer/                # framework-free three.js code: Viewer, Playback, threeClip, ClipCache, framing, cameraView, parts, follow, ...
├── lib/viewer/toon/           # toon shading: params.ts (material extras -> parameters; pure), shaders.ts, ToonMaterial.ts, OutlineMaterial.ts, applyToon.ts;
│                              #   Erza's path: DiffuseShadowMaterial.ts (diffuse + `_SH` by N·L), DefaultOutline.ts (hull outline with no outline material)
├── lib/anim/                  # framework-free (no three.js/Vue/browser APIs): manifest, clip, paths, loader, catalog, names, rig, fk, quat,
│                              #   retarget, contact
├── lib/voice/                 # voices.ts (voices.json, pairing), subtitles.ts, timeline.ts, MediaClock.ts, wav.ts, voiceSettings.ts
├── lib/lobby/                 # director.ts (what Display plays: a pure state machine), pool.ts (candidates, pool, idles from the choice)
├── lib/prefs/                 # prefs.ts: the `titania.prefs` record (types, tolerant parse, strict import, serialize; pure)
├── lib/constructs/            # erza.ts, shukra.ts, pavo.ts (construct configs), index.ts (FRAMES, DEFAULT_FRAME, lendingFrames, displayFrames), skins.ts, display.ts
├── lib/build/                 # Node-only build helpers used by wxt.config.ts (asset symlinks)
├── tests/                     # `node --test` unit tests; the data tests skip when data/ or a voices.json is absent
├── assets/                    # app CSS (Tailwind entry)
├── wxt.config.ts
├── AGENTS.md  DESIGN.md  README.md
└── openspec/                  # OpenSpec specs and change proposals
```

There is no extension icon yet (PGR's was added after the copy) and no `reference/` folder of screenshots.

## Assets and `data/`

- `data/` is produced by the Python download scripts. **Agents must never modify, rename, move, or delete anything inside `data/`**, and
  must not run the download scripts unless the user asks. (`data/<slug>/voices.json` is the one generated file: `build_voices.py` writes
  it from `voice_pairings.json`; the pairing table is never typed into `data/` by hand.)
- **No API, no local server.** Assets ship inside the unpacked extension and are loaded with `browser.runtime.getURL('/<frame>/<path>')`,
  which works offline.
- **Serve only the in-scope subset**: for each frame in `FRAMES` (`lib/constructs/index.ts`) that is `models/`, `anim/`, `voices_ja/`,
  `voices.json` and `icons/`; `voices_en/` and `wiki/` are left out. A served path missing from `data/` is skipped with a warning (the
  build says so for a `voices.json` that `build_voices.py` has not written). The build places them under `/<frame id>/` in the output as
  **symlinks** into `data/` (`lib/build/serveAssets.ts`, run from the `build:done` hook in `wxt.config.ts`), so the built extension depends
  on this checkout's absolute path; rebuild after moving the repo. If a Chrome version ever refuses the links, switch `mode` in
  `wxt.config.ts` to `'copy'` (implemented, not exercised; about 100 MB). Do not copy assets into the sources or commit them.
- **Size on disk** (measured in `bootstrap-titania`): `data/` is 96 MiB. Shukra 61.4 MB (anim 32.3, models 11.1, voices_ja 9.7, voices_en
  8.1, wiki 0.2), Pavo 37.6 MB (anim 17.9, models 5.3, voices_ja 9.9, voices_en 4.3, wiki 0.2).
- **Only the Generic prefab of each frame is downloaded**: Shukra `r3qumd010011`, Pavo `r2qumd010011` (the `PREFABS` table in
  `download_construct.py`); no coatings, chibis or `anim-skins/`. An unknown slug fails naming it.
- **Model slimming is not done.** Computed from the GLB JSON (image sizes read from their headers; RGBA8 plus mipmaps, every texture):
  Shukra 38 textures (11 of 2048², 13 of 1024², 6 of 512², the rest ramps), about **315 MiB** of GPU texture memory, 28,615 triangles,
  10 mesh primitives; Pavo 23 textures (5 of 2048², 8 of 1024², 5 of 512²), about **157 MiB**, 19,964 triangles, 8 primitives. Both are
  below the 400 MiB line set for slimming. Real GPU usage was not measured (`Viewer.getStats()` in Chromium was not run here).
- Before writing a loader for anything not described under "Data contracts", inspect real files and record the actual format there
  first. Do not invent schemas.
- **Measure audio by decoding it.** ffprobe reads these VBR MP3s from the first frame and is wrong by up to 2× either way (Shukra's read
  up to 2× too long, Pavo's up to 1.5× too short); `ffmpeg -i f.mp3 -f null -` gives the real length. A first pairing draft was chosen from
  ffprobe's lengths and was off for that reason.

## Data contracts

Code must match what is written here.

### `models/*.glb`

- glTF 2.0 binary, all meshes skinned, **no animations** inside; Y up, metres, the model faces **-Z**. The JSON chunk alone is enough to
  build a rig (`rigFromGltf`); a lent clip's rig is read from it without downloading the rest of the file.
- Qu's two Generic models (measured):

  | | Shukra `r3qumd010011` | Pavo `r2qumd010011` |
  |---|---|---|
  | Nodes / `Bip001*` bones | 326 / 55 | 203 / 64 |
  | Mesh nodes (one primitive each) | 10: `Alpha` `Body` `Down` `Eye` `Face` `Hair01` `Hair02` `Huangyu` `Upper` `Weapon` | 8: `Bead` `Body` `Cloth` `Eye` `Face` `Hair01` `Hair02` `Head` |
  | Name prefix / model id | `R3QuMd010011` / `010011` | `R2QuMd010011` / `010011` |
  | Morph targets | `Face` 35, `Eye` 7 | `Face` 21, `Eye` 5 |
  | Pelvis / head height at rest | 0.959 / 1.462 m | 0.968 / 1.449 m |
  | Toes at rest | on the floor (−0.0003 m) | 1.04 cm above it |
  | Hierarchy | clavicles under `Spine2`, thighs under `Pelvis`; no `Root` above `Bip001` | clavicles under `Neck`, thighs under `Spine` |
  | Props | `Bip001Prop1` on the right hand, `Prop2` on the left (0 cm at rest) | `Bip001Prop1`, 30 cm from the left hand (not held) |
  | Mesh bounds (bind pose, A-pose) | x ±0.55, y 0 to 1.64, z −0.12 to 0.31 (1.09 × 1.64 × 0.43 m) | x ±0.54, y 0 to 1.72, z −0.23 to 0.36 (1.09 × 1.72 × 0.59 m) |
  | Materials | 20: 11 `character`, 8 `outline`, 1 `bloom` (a pass, not drawn) | 16: 9 `character`, 7 `outline` |

- `Bip001` is the root of both skeletons, and it faces the same way on both (their rest orientations agree to 0°).
- Neither model carries `LightDisable` object tags: there is no Light and Dark form (the PGR code for it was removed here).
- Files: Shukra 11.1 MB on disk (5.6 MB stored per the manifest's `modelStoredBytes`), Pavo 5.3 MB (3.4 MB stored).

### `anim/manifest.json`

```
{ formatVersion: 1, target: "<skinId>", model: "base.glb", characterId, eventDispatch,
  defaultContext: "menu",
  clips:       [{ name, file, duration, frameRate: 30, loop, rootNode }],   // index = clip id
  controllers: [{ id, layers: [{ name, blending, default, states: { <state>: { clip, skills?, blend? } } }] }],
  contexts: {
    menu:  { base: <controller id>, entry: { clip }, idle: { clip }, hiddenNodes, stateHides: { <clipName>: [node] }, mounts },
    fight: { base, entry: { controller, layer, state }, idle: {…}, levels: [controller id], hiddenNodes, mounts, transitions },
  },
  eventTables: {…} }
```

- **Menu vs Fight**: the menu controller lists `StandAct0101` and the ten `BoardAct*`; entry and idle are `UiStand1`. The fight controller
  (plus its `levels`) lists the fight states; entry `Born`, idle `Stand1`.
- Node indices in `hiddenNodes`, `stateHides`, `mounts` and in clip tracks are **glTF node indices of the model the manifest's `target`
  names**. A clip set only fits that model.
- **Qu's manifests** (measured): `rootNode` is `1` (= `Bip001`) on every clip; `hiddenNodes` is empty and `stateHides` is `{}`, so every mesh
  shows in every state. Shukra has 70 clips (`BaseLayer` 56, `LevelCombine1Level1` 13, `UiStand1`), Pavo 100 (`BaseLayer` 49, `Base Layer`
  11, `LevelCombine1Level1` 27, `LevelCombine1Level2` 11, `UiStand1`, `UiStand1_2`).
- **Pavo has two clips named `UiStand1`** (`anim/UiStand1.json` and `anim/UiStand1_2.json`, both 6.0 s, both looping). Only the first is
  in a Menu state, so the list shows one. They are **different idles** (148 of 298 tracks differ, by up to 0.18; 298 tracks against 273),
  not a duplicate. Offering the second one is a possible later change.
- **The animation lists** (the catalog; `tests/catalog.test.ts`): Menu is `Idle`: `StandAct0101`, `UiStand1` and `Board actions`: the ten
  `BoardAct0201`–`0203`, `1001`–`1007` on both frames. Fight: Shukra lists 8 (`Stand1` `Stand2` `Standchange`; `Run` `Walk`; `Born` `Save`
  `Win`), Pavo 14 (the same, plus the Level skill `LevelAttack14` and `Executioner01`–`05` under Other).

### Clip files

Packed JSON, reverse engineered. The format and its decoder are documented in the header of `lib/anim/clip.ts`; summary:

- `{ version: 1, tracks: [...], packing?: { times, rotationBits: 16, valueDigits: 5 } }`; a clip without `packing` is a single static pose.
- Track: `{ node, property: "position" | "quaternion" | "scale" | "weights", value? | deltas?, dropped?, target? }`; `value` constant,
  `deltas` animated (planes, delta coded; quaternions smallest-three with `dropped`).
- Manifest `file` paths start with `anim/`; resolve them against the manifest's own folder with that prefix stripped
  (`resolveClipPath` in `lib/anim/paths.ts` is the one implementation). Pavo's clips live in `BaseLayer` and `Base Layer` (with a
  space); `lib/assetPath.ts` URL-encodes each path segment for it.

Confirmed against all of Qu's data (`tests/conformance.test.ts`, run by `pnpm test`):

- 2 manifests, **170 clips** (70 + 100), every listed file exists and decodes; every decoded duration is within 0.02 s of the manifest, every
  track node is a node of the target GLB, every morph target index is inside its mesh's list, every animated quaternion has unit length.
- Looping clips end where they start on the body (`Bip001…`) tracks (≥ 90 %); hair, cloth and prop bones are recorded physics and end a few
  degrees off, so the sweep checks the body only.
- Key 0 of the standing clips matches the bind pose on 88 to 95 % of the position tracks (the rest are the pelvis height and the
  `*repairBone*`/`BoneCalf*` helper bones that clips move; the test bound is 85 %) and on the pelvis rotation (to within 1e-3), where the
  clip has a pelvis rotation track at all (Pavo's `UiStand1` and Shukra's `BoardAct0201` do not).
- Sizes: Shukra's clip files are 29.8 KiB (`Lieonfloor`) to 2.8 MiB (`BoardAct1004`, 2,868 KiB), Pavo's 20.5 KiB (`Attack91`) to 803 KiB.

Decoded layout (`Clip`): `times` one `Float32Array`; every animated track's `values` a flat key-major `Float32Array`. Tracks carry the
**glTF node index**, not a name (names repeat): bind through node index → object → uuid.

**Measured cost of a source clip** (Node/V8 on this machine, steady state: the best of three warm runs; `JSON.parse` of the text, `decodeClip`,
`retargetClip` onto the other frame; all 170 clips, both directions):

| Clip (Shukra → Pavo) | File | parse | decode | retarget | total |
|---|---|---|---|---|---|
| `BoardAct1004` (41.8 s) | 2.8 MiB | 31.5 | 19.4 | 15.6 | **66.5 ms** |
| `BoardAct0202` (36.7 s) | 2.4 MiB | 28.5 | 17.1 | 14.9 | **60.5 ms** |
| `BoardAct0203` (34.2 s) | 2.0 MiB | 23.9 | 15.1 | 12.4 | **51.4 ms** |
| every other clip | | | | | ≤ 43.6 ms (median 4.7, p90 15.8) |

PGR's line for moving decoding to a worker is 50 ms; **three clips are over it**, so the `cross-frame-animation` spec was relaxed to
70 ms after measuring. The effect is one stall of about four frames the first time one of those clips is selected in Playground (it is
cached after); Display prepares its next action in advance, so it does not show there. Not measured in headless Chromium (the same V8; two
attempts to time it there gave no valid figure); the decoder is pure, so a Worker stays possible.

### Playing clips

- **Binding is by node uuid** (`<node uuid>.<property>`, `<uuid>.morphTargetInfluences[<target>]`), never by bone name:
  `lib/viewer/threeClip.ts` is the one place that builds them. Constant tracks are expanded to two keys.
- **Root.** Qu's `rootNode` is `Bip001`, the pelvis itself, whose position track is its height, so `toAnimationClip` keeps it and drops the
  root's position only when the root node is not named `Bip001` (the case of a model with a `Root` above it). Verified on Shukra's and
  Pavo's `Run`.
- **Duplicate clip names.** Names are not keys: use the clip index; the catalog labels duplicates with their folder (and file name when the
  folder is shared) and, among clips sharing a name, lists only the `BaseLayer`/`Base Layer` one.
- **`stateHides`.** Qu has none, so Menu and Fight both use `hiddenNodes` (empty). `hiddenNodesFor` in `lib/anim/catalog.ts` is the one
  implementation.
- **Cache.** The viewer keeps a clip cache (`ClipCache`, LRU by decoded bytes, never evicts the playing clip).

### Controls and framing

Unchanged from PGR (see `DESIGN.md` for the controls). The default framing is `computeFraming` (`lib/viewer/framing.ts`): the model's height
fits the canvas with a 0.25 margin, limited by the width (`widthShare` 0.8 for a person, 1 for a chibi), FOV 24°; the Display camera is the
saved view or `DISPLAY_PRESET` (zoom 0.42, target 0.23 model heights above the default target). **Qu's figures** (computed with those
functions on the GLB bounds, projecting onto the target plane; not rendered, so they ignore perspective across the body's depth; the user
checked the panel by eye):

| Canvas | Shukra: default distance | crown / feet | bust: head bone / crown | Pavo: default distance | crown / feet | bust: head bone / crown |
|---|---|---|---|---|---|---|
| 320 × 700 | 5.08 m (width decides) | 12.0 % / 88.0 % | 21.0 % / 1.1 % | 5.36 m (height) | 12.2 % / 87.8 % | 30.1 % / 1.4 % |
| 387 × 1045 | 6.22 m (width) | 19.0 % / 81.0 % | 26.3 % / 10.1 % | 6.27 m (width) | 17.7 % / 82.3 % | 33.0 % / 8.4 % |
| 381 × 1006 | 6.09 m (width) | 18.3 % / 81.7 % | 25.8 % / 9.2 % | 6.14 m (width) | 17.0 % / 83.0 % | 32.6 % / 7.6 % |
| 600 × 800 | 5.04 m (height) | 11.7 % / 88.3 % | 20.8 % / 0.8 % | 5.36 m (height) | 12.2 % / 87.8 % | 30.1 % / 1.4 % |

Closest zoom 0.25 m (Shukra) and 0.26 m (Pavo), i.e. 0.15 × the model height. The bust preset puts Shukra's head bone at 21 to 26 % of the
canvas height and Pavo's at 30 to 33 % (the edge of the upper third): Pavo's bounds reach 1.72 m because of hair and ornaments above her
1.449 m head bone, so her crown sits lower in the frame than Shukra's. On Bianca's four frames the same preset gave 25 to 29 % and a crown within 3 % of
the top. Whether the Qu preset should be tuned is a question for Erza's own measurements, not these.

### Retargeting (clips of one frame on another frame's model)

`lib/anim/retarget.ts` is the one implementation (with `rig.ts`, `fk.ts`, `quat.ts`; framework-free; `tests/retarget.test.ts`).

- **The rigs differ in hierarchy, not only in rest pose**, so a local rotation means something else on each rig and a local delta does not
  work. **Method: world-space direction matching.** Per key, forward kinematics gives the source bones' world rotations; each matched
  `Bip001…` bone gets `W_t = W_s · W_s_rest⁻¹ · A · W_t_rest` in the target parent's frame, where `A` turns the target's rest direction towards
  its main child joint into the source's (`mainChild`). The hand is aligned on two axes (finger direction and palm). Bones without a main
  child (head, toes, finger tips, props) use `A` = identity. Matching is by `Bip001…` name (Biped names, spaces removed).
- **Accuracy on Qu** (direction of every main limb bone against the source model playing the clip, eight sampled keys of `UiStand1`,
  `BoardAct0201` and `Run`, both directions): **mean 0.06° (Shukra → Pavo) and 0.07° (Pavo → Shukra), at most 0.3° per bone**; palms within
  5°. Bianca's four frames gave at most 0.7°. The tests bound the error at 15° per bone, 5° on average and 5° on palms.
- **Feet.** The lowest foot point stays within 1.0 cm (Pavo → Shukra) of the source's floor contact, as the spec asks (2 cm). **Shukra → Pavo
  comes out 2.7 cm off** (the test allows 3 cm for that direction only): Pavo's rest toes are 1 cm above the floor while Shukra's are on it,
  and scaling the pelvis by the ratio of heights (0.968 / 0.959) cannot absorb that, so Pavo's toes dip about 2.9 cm below their rest level
  (about 1.9 cm under the floor). Not fixed here (the spec does not ask for it); revisit with Erza's measurements, since her rig is a third one.
- **Root**: only `Bip001` gets a position (its world offset from rest, scaled by the pelvis-height ratio); the parents are taken at rest.
  Face weights map by mesh role (`Face`, `Eye`, `EX` copies included: `meshRole`) and morph target name; a name the target lacks is dropped
  (Pavo's `Face` has 21 targets against Shukra's 35).
- **Output tracks**: Pavo's `Run` onto Shukra drives 58 tracks, all `Bip001…`, with positions on `Bip001`, `Bip001Prop1` and `Prop2`; Shukra's
  onto Pavo 54 tracks with a position only on `Bip001`.
- **Helper bones and the fill pose** (`retargetClip(…, { fill })`): the models hold bones the game drives through constraints and bakes into
  each clip (Shukra has 269 non-`Bip001` nodes: `*repairBone*`, `*Twist*`, ribbon chains; Pavo 137). Retargeting drives only `Bip001…`;
  with `fill` set to the shown model's idle clip, every node the result has no track for gets a constant track holding that idle's **mean**
  (quaternions sign-aligned). Measured: Pavo's `BoardAct1002` onto Shukra with her `UiStand1` adds 199 constant tracks on 167 nodes, none a
  `Bip001` position, and leaves every driven track unchanged.
- **Weapon props**: props are never copied from the source. A prop that sits on a hand at rest is driven to keep its rest offset from that
  hand: Shukra's `Bip001Prop1` (right) and `Prop2` (left) stay within 0.5 cm of their rest distance through `UiStand1` and `Run` driven
  from Pavo; Pavo's `Bip001Prop1` is 30 cm from a hand at rest, so nothing drives it.
- **A hand on the hip stays on the hip** (`lib/anim/contact.ts`, `retargetClip(…, { contact })`, on for lent clips): the planner and its
  weight are covered by synthetic tests. Qu's clips that put a hand on the hip were not listed or measured; the user played every Board
  action of each frame on the other in the panel and found nothing wrong (no clip is excluded; there is no `lobby.exclude`).
- **Lending in the panel** (`usePlayback`): each frame's Generic clip set (`animationSource` in its construct config) and `voices.json` are
  read once; the list adds each other frame's groups (`withSources`, labelled `<Frame> · <group>`). A list item has an `id` (`#12` own,
  `pavo:anim/manifest.json#40` lent). A lent clip's rig is read from the JSON chunk of **its manifest's `target` model**. Its line comes
  from its own frame; **the idle tail is the shown model's own `UiStand1`** (`idleOf(current)`); visibility is the shown skin's rule.
  `animationSource.extras` (extra clip sets, `replace`) is unused by Qu and covered by synthetic tests.

### `voices.json`

```
{ version: 1, audioLang: "ja", textLang: "en",
  entries: [{ id, file, title?, text, lang: "en", animation?, note? }] }
```

- One entry per file in `voices_ja/` (Shukra 103, Pavo 117). `title` is the huaxu line title ("General Greeting 11"); missing on audio
  variants with no wiki text (`note` says so). `animation` = the clip that plays with the line; **exactly the entries named in
  `voice_pairings.json` carry it** (10 per frame). Pairing is by clip **name**; the audio path is `voices_<audioLang>/<file>`;
  `lib/voice/voices.ts` is the one implementation.
- **The pairing table is chosen by listening**, because nothing in the data links a clip to a line (checked: the voices page payload and the
  manifests' `eventTables`, which hold only `stopAnimNames` and state-sync flags). `build_voices.py` stops with an error for a title that
  matches no line or more than one, or a line claimed by two clips, and writes nothing for that frame. Two wiki lines linking one file
  with the same text take the first line's title (a note is printed); different texts stop the script.
- A Board action with no pairing plays silently and is neither played nor offered in Display.
- Files: voice folders `v_qus` (Shukra: 81 English files on the page, 103 Japanese) and `v_qu` (Pavo: 66 and 117), `<entry id>.mp3`.
  Entry ids look like `v_qus_9_11`.

**The final pairs** (chosen by the user by listening; line lengths by decoding the file):

| Frame | Clip | Clip s | Line | Line s | Line − clip |
|---|---|---|---|---|---|
| Shukra | BoardAct0201 | 32.33 | General Greeting 11 (`v_qus_9_11`) | 27.53 | -4.80 |
| Shukra | BoardAct0202 | 36.73 | General Greeting 12 (`v_qus_9_12`) | 27.84 | -8.89 |
| Shukra | BoardAct0203 | 34.23 | General Greeting 15 (`v_qus_9_15`) | 28.96 | -5.27 |
| Shukra | BoardAct1001 | 27.67 | Affection Up 16 (`v_qus_101_2`) | 24.47 | -3.20 |
| Shukra | BoardAct1002 | 26.73 | Quick Tap 3 (`v_qus_21_3`) | 23.74 | -2.99 |
| Shukra | BoardAct1003 | 19.00 | Shake 2 (`v_qus_20_2`) | 13.53 | -5.47 |
| Shukra | BoardAct1004 | 41.83 | Connection Made 8 (`v_qus_18_8`) | 41.92 | +0.09 |
| Shukra | BoardAct1005 | 23.67 | Idle 4 (`v_qus_16_4`) | 19.43 | -4.24 |
| Shukra | BoardAct1006 | 25.57 | Extended Offline Time (`v_qus_19`) | 22.54 | -3.03 |
| Shukra | BoardAct1007 | 17.83 | Extended Connection 4 (`v_qus_17_4`) | 13.42 | -4.41 |
| Pavo | BoardAct0201 | 11.67 | General Greeting 1 (`v_qu_9_1`) | 8.46 | -3.21 |
| Pavo | BoardAct0202 | 19.33 | General Greeting 9 (`v_qu_9_9`) | 19.17 | -0.16 |
| Pavo | BoardAct0203 | 16.00 | General Greeting 12 (`v_qu_9_15`) | 11.99 | -4.01 |
| Pavo | BoardAct1001 | 17.33 | Affection Up 12 (`v_qu_101_2`) | 15.09 | -2.24 |
| Pavo | BoardAct1002 | 7.97 | Quick Tap 2 (`v_qu_21_2`) | 6.06 | -1.91 |
| Pavo | BoardAct1003 | 7.00 | Shake 3 (`v_qu_20_3`) | 5.38 | -1.62 |
| Pavo | BoardAct1004 | 11.00 | Connection Made 4 (`v_qu_18_4`) | 8.80 | -2.20 |
| Pavo | BoardAct1005 | 10.67 | Idle 4 (`v_qu_16_4`) | 8.72 | -1.95 |
| Pavo | BoardAct1006 | 12.57 | Extended Offline Time 1 (`v_qu_19`) | 10.21 | -2.36 |
| Pavo | BoardAct1007 | 19.00 | Extended Connection 4 (`v_qu_17_6`) | 15.56 | -3.44 |

Every line ends before its clip, except Shukra's `BoardAct1004` (`Connection Made 8`, 41.92 s against 41.83 s: it outlasts it by 0.1 s). So the
idle tail (a line longer than its clip: the clip crossfades to the shown model's `UiStand1`, which loops until the line ends) is almost never
taken with these pairs. **Erza has no `UiStand1` of her own**, so which idle takes over for her is decided in `add-erza-model`. Decoded Japanese audio per
frame: Shukra 960 s over 103 files (0.47 to 41.92 s), Pavo 912 s over 117 files (1.35 to 29.72 s). Playback (`OfflineAudioContext` decode →
PCM WAV → `<audio>`, `MediaClock`) is unchanged from PGR.

### `wiki/`

- `voices.html`: the saved huaxu voices page, the source for `voices.json`. Not loaded at runtime.

### Material parameters and toon shading

Unchanged from PGR: shading values come from each material's `extras` (`lib/viewer/toon/params.ts`, `tests/toonParams.test.ts`).
Qu's models use the same parameters, so the PGR shader renders them unchanged (measured on the two Generic models, `tests/toonParams.test.ts`):

| | Shukra | Pavo |
|---|---|---|
| Materials on meshes | 10 `character` | 8 `character` |
| Outline pairs | 8 of 10 meshes (`Alpha`, `Eye` have none) | 7 of 8 (`Eye` none; `Hair01` and `Hair02` share one outline) |
| PBR (`full` / `simple`) | `Down`, `Upper`, `Weapon` / `Huangyu` | `Cloth` / `Head` |
| Matcap / emission / colour ramps (multi-zone) | 2 / 3 / 7 (2) | 1 / 0 / 2 (0) |

Not built: bloom (Shukra has a `bloom` pass material that is not drawn), animated emission. **Erza's shading is different** (a diffuse
texture plus a shadow-colour `_SH` texture, no PGR parameters) and arrives with `add-erza-model`; `erza-only-companion` removes the paths
that served only PGR models (the parameter-driven toon, emission, PBR metal).

### Erza (`add-erza-model`, spike findings)

Source: `data/erza/source/Erza Scarlet/` (moved there from the repository root; `Erza Scarlet (Heaven's Wheel Armor)/` is untouched), converted
by `scripts/convert-fbx.ts` into `data/erza/models/erza-scarlet.glb`. Read with three.js' `FBXLoader` in Node (texture loader stubbed); **go**.
Measured on the first conversion (`node scripts/convert-fbx.ts "data/erza/source/Erza Scarlet"`, 0.6 s, 1.36 MB, the same bytes on a second run):

- **Unit, height, facing.** Metres. Pelvis 1.1104 m (the design said 1.110), head bone 1.726 m; body bounds after the `Root` turn x ±0.770, y 0
  to 2.003 (hair and ornaments above the head bone), z −0.193 to 0.340: 1.54 × 2.003 × 0.533 m, centred on x = 0. The FBX faces +Z; a 180°
  turn about Y in a `Root` node above the skeleton gives −Z with her left hand at −X (hands mirror to 0.0000 m). Lowest toe 3.67 cm above y = 0.
  `FBXLoader` writes spaces as `_`; `Bip001_L_Thigh` becomes `Bip001LThigh`; no two names collide once separators are gone.
- **Bind pose.** The FBX's scene pose **is** its bind pose (every skinned bone's bind position is within 2 µm of its scene position), so
  there is no pose to choose; the converter still derives the node transforms from the bind matrices. The mesh's local space is Z-up
  (`bindMatrix` = −90° about X); the converter bakes it into the vertices and writes the skin's inverse bind matrices as the inverse of each
  bone's bind world matrix. Skin weights sum to 1 on every vertex (four influences); no triangle is stretched (viewed from front, side, back,
  and in a Shukra `BoardAct0201`, a Pavo `Run` and `BoardAct1001` pose).
- **Nodes.** 138 in the GLB: `Root`, 136 bones (133 skinned; `Bip001`, `Bip001Prop1`, `Bip001Prop2` are not), the mesh node `Erza_Body`. 59 are
  `Bip001…`. One 48,168-vertex unindexed mesh with two materials (body `Role_Erza.png`, sword `Role_Erza_weapon.png`); welded to 10,771 vertices and
  12,988 triangles for the body. Textures are 1024² RGBA (diffuse alpha 225 to 255 on 0.008 % of pixels, `_SH` opaque): used as opaque.
- **The sword is two parts, and the second hides in the body material.** The weapon material holds 2,436 triangles; **another 632 triangles
  of the body material are skinned to `Bone_wq_cj`** and hang on her right, x −1.2 to −0.75 m (1,896 vertices), which made the "body" bounds
  asymmetric (x −1.22 to 0.77) in the design's reading. The converter leaves out a triangle when its material is the weapon's **or any vertex
  is dominated by a `Bone_wq_*` bone**; without them the body is symmetric. `--weapon` keeps all of them as `Erza_Weapon`.
- **Names against Qu's rigs.** All 55 of Shukra's `Bip001…` names exist on her; 56 of Pavo's 64 (the eight Pavo-only `ForeTwist`/`UpArmTwist`
  bones are dropped). Her `Bip001LCalfTwist`/`RCalfTwist` get no track from either source, nor do `Bip001LThighTwist`/`RThighTwist` from
  Shukra (Pavo drives them), nor `Bip001Prop1`/`Prop2`; no `Bone_…` node gets one. `Bip001Prop1` is 0.545 m from her right hand, `Prop2`
  2.0 m from her left: no prop track on any clip.
- **Retargeting accuracy** (Shukra and Pavo `UiStand1`, `BoardAct0201`, `Run` onto her, eight keys each, the test's measure): mean **0.06°
  (Shukra) and 0.07° (Pavo)**, at most 0.3° per bone, palms within 0.6°. Her hierarchy is Pavo's, not Shukra's. Her root follows the
  source's (Shukra's `BoardAct1004` travels 2.4 m forward in its own model and 2.75 m on her).
- **Feet.** The lowest foot point on her sits **4.5 to 10.4 cm below** where the source puts its own, relative to each rest pose (Shukra →
  Erza `UiStand1` 8.0, `BoardAct0201` 5.9, `Run` 8.0 cm; Pavo → Erza 4.5, 5.0, 10.0 cm), far over the 2 cm that Qu's frames meet. The cause is
  not the pelvis ratio (1.158 against a leg ratio of 1.119 gives almost the same height for `UiStand1`): direction matching turns her foot
  bone to **Shukra's foot direction**, which points steeply down (the toe 0.121 m under the ankle over 0.132 m), and her foot bone is longer
  (0.213 m), so her toe lands at −2.9 cm where her flat boot rests at +3.7 cm. **Decision: a bound with its reason** (`FEET_TOLERANCE` in
  `tests/retarget.test.ts`: 9 cm from Shukra, 11 cm from Pavo; measured 8.0 and 10.0): without a floor drawn, standing she is 4.5 cm under y = 0
  at worst, which the panel does not show. A ground correction on the pelvis would not help (see above); the real fix is treating the foot bone
  by its rest-relative pitch, which changes Qu's pairs too, so it is a change of its own.
- **Known limits, as planned.** Skirt, hair and ribbons hold their bind pose (in a `Run`, a `Walk` or a kick the stiff skirt parts and shows a
  thigh, or the white garment under it); the face has no morph targets and is bone-driven, so it stays still.
- **Played in the panel** (every Menu item of both sources, 24, and every Fight item, 22, at two moments each, toon on, contact planner on as in
  the panel): all start and end without an error, none puts a hand through the body or a hand on the hip wrongly, arms that cross the chest in
  Pavo's `BoardAct0201`/`1005`/`1007` only touch the armour. Shukra's `BoardAct1004` is a sitting action and she sits on nothing, as in
  its own model. **One defect that is not a known limit: black strips stretch off her boots in strong knee bends**, worst in Pavo's `Executioner01`,
  `02`, `04`, `05` (also `03` and Shukra's `BoardAct1004` and `Run`). Cause confirmed by a render: `Bip001LCalfTwist`/`RCalfTwist` are children
  of the thigh and get no track from either source, so they stay straight while the calf bends and the ankle vertices that carry their weight are
  pulled toward them. With the twist bone given the calf's rotation the strip is gone. Not fixed here (a rule in `retarget.ts` for target
  bones the source lacks, which the spec does not ask for): see "Possible later changes".
- **Voice.** Shukra's and Pavo's Board actions on her play their own frame's line and subtitle (checked: Pavo `BoardAct0201`/`0202` with Pavo's
  text, Shukra `BoardAct1004` with Shukra's); at 41.88 s of `Shukra · BoardAct1004` (clip 41.83 s, line 41.92 s) the timeline is in its idle
  segment and the cached idle is Shukra's `UiStand1` retargeted onto her (`shukra/anim/manifest.json#69@erza/erza-scarlet/menu`).
- **Framing** (`computeFraming` on her bounds, FOV 24°, `widthShare` 0.8; projected onto the target plane): width decides at 320 × 700 (7.11 m,
  height alone 6.16 m; crown 16.9 % / feet 83.1 %), 387 × 1045 (8.72 m; 23.0 % / 77.0 %) and 381 × 1006 (8.53 m; 22.4 % / 77.6 %); height
  decides at 600 × 800 (6.16 m; 11.7 % / 88.3 %). Head bone 26.0, 30.5, 30.0 and 22.3 %. Closest zoom 0.30 m (0.15 × her height). **`widthShare`
  0.8 holds**: her T-pose arms are 1.54 m wide, but across the 54 clips she is offered (hands and forearms, about the pelvis) the half-spread is
  0.47 m (median), 0.67 m (90th percentile), 0.76 m at most (Pavo's `Executioner03`) against 0.616 m for the share and 0.77 m for the bounds;
  at 320 px the canvas shows 0.69 m each side, so only the widest clips (a few Executioner kicks) leave it, by up to 7 cm. The bust preset
  was not tuned for her.
- **Viewer statistics** (`Viewer.getStats()`): 1 geometry, 2 textures (1024² RGBA, 11.2 MB with mipmaps, against Shukra's 33 textures and 223 MB),
  12,988 triangles (25,976 drawn with the outline hull), 1 draw call per pass. Switching Erza and Shukra three times each leaves geometries and
  textures at 1/7 and 10/48 every time (shader programs grow once, 5 → 8 for her, then stay).
- **Retarget time onto her** (parse + decode + retarget, best of three warm runs, contact planner on, all 170 clips): the largest are Shukra's
  `BoardAct1004` 18.9 ms (8.0 + 5.5 + 5.5), `BoardAct0202` 17.2, `BoardAct0203` 15.8; median 1.4 ms, 90th percentile 4.4 ms; **none over 70 ms**. The
  `bootstrap-titania` table gave 66.5 ms for Shukra's `BoardAct1004` onto Pavo (without the contact planner); onto Erza it is 3.5× lower in this run,
  which I did not investigate (a warmer machine, or the target rig), so the 70 ms bound stands but this is not evidence of headroom by itself.

**Conversion conventions** (`scripts/convert-fbx.ts`, which the tests run): Y up, metres, facing −Z (a 180° `Root` node, never a mirror); node
transforms from the bind pose, the mesh's Z-up space baked into its vertices; `Bip001…` names without spaces or underscores, `Bone_…` names as
the file gives them; vertices welded; one skin of every skeleton bone; mesh node `Erza_Body` (one primitive per body material), the weapon left
out unless `--weapon`; the diffuse PNG and its `_SH` PNG embedded, the material's `extras` = `{ family: 'diffuseShadow', shadowTexture: <index> }`.
The output is deterministic, must stay under `data/erza/`, and the source folder is only read. `Erza Scarlet (Heaven's Wheel Armor)/` converts
with no change to the script (142 bones, 2 body materials in one `Erza_Body`, 25,817 triangles; checked, nothing kept).

**A frame with no clip set of her own** (`animationSource: null`, no manifest; `display: false`): the list is the sources' groups only, its default is
the first source's default (`Catalog.defaultItem`), the root node of a lent clip is the shown rig's `Bip001`, no fill pose, nothing hidden, the idle
tail is the action's own frame's `UiStand1` retargeted (`usePlayback`: `canPlay`, `idleOf`). `loadFrameData` reads neither a manifest nor a
`voices.json` for her. Display's pickers use `displayFrames` and the lobby warns only about frames in `lendingFrames`.

**Her shading** (`DiffuseShadowMaterial.ts`, `DefaultOutline.ts`; `parseDiffuseShadowMaterial` in `params.ts`): `mix(shadow, diffuse, smoothstep(0.06,
0.14, N·L))` times the light colour, no tone mapping; the outline is a back-face hull pushed along the view-space normal by 2 width units (1.4 px)
in 0.3 of the base colour; both are tuned by eye (the edge sits a little past the terminator), not measured against the game. Checked in
the panel: front light lights her front, 180° swaps the sides, "Toon shading" off shows her diffuse texture with no outline.

### Skins, parts, preferences, Display

Described by the specs (`skin-selector`, `part-toggles`, `user-preferences`, `display-mode`, `lobby-director`) and `DESIGN.md`. Facts that
bite:

- Each Qu frame has one skin, its Generic (`defaultSkin` = the `…010011` model, the `anim/` clip set). The skin type still knows coatings and
  chibis; a group without skins is not shown.
- Preferences are one record under `titania.prefs` (display settings, saved camera, Display model, camera and animation choices per
  Display frame, hidden parts per skin id); the voice settings keep their own record (`pgr.voice`, a name left from the copy). Export
  is `titania-companion-preferences.json`; a PGR file is accepted and what names frames this project lacks falls back to the defaults.
- Display's pool is every voiced Board action of the Display frame plus the borrowed ones the user chose (default: the other Qu frame's
  voiced actions and its `UiStand1`); `lobby` in a construct config is only that default (there is no `lobby.exclude`).
- Dev-only globals `__pgrViewer`, `__pgrLobby`, `__pgrLobbyTrace` and `__pgrLobbyOverrides` keep their PGR names.

## Engineering rules

### three.js and Vue

- Keep all three.js code in `lib/viewer/` as plain TypeScript classes/functions with no Vue imports. Vue talks to it through a small API.
- **Never put three.js objects in Vue reactive state.** Use `shallowRef` or `markRaw`.
- Drive the render loop with `requestAnimationFrame` inside the viewer, not from Vue watchers. Push only small plain values back to Vue.
- On model switch or unmount, dispose geometries, materials, textures, the mixer and the renderer. Cancel the animation frame.
- Size the renderer with a `ResizeObserver` on the canvas container; the side panel can be resized by the user at any time.
- Use `preserveDrawingBuffer` only if screenshots require it; prefer rendering one frame then calling `canvas.toBlob()`.

### Side panel

- The side panel is narrow (roughly 320–600 px wide, user-resizable). Design mobile-first.
- "Fullscreen" here means an overlay that fills the whole side panel, not the browser Fullscreen API.
- Background script: `browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`. The manifest needs the `sidePanel` permission.

### Shading

- Toon shading is the default look; the GLB's own materials with neutral lighting are the alternative behind the "Toon shading" switch.
  Shading values come from each material's `extras`, never per-skin constants; custom shaders live in `lib/viewer/toon/` only.

### General

- Modules that Node tests import (`lib/anim/`, `lib/viewer/framing.ts`, `lib/lobby/`, `lib/prefs/`, `lib/voice/` parts) use explicit `.ts`
  extensions in relative imports, because Node's type stripping does not resolve extensionless paths; Vite and `vue-tsc` accept them.
  Everything under `lib/anim/` must stay free of three.js, Vue, WXT and `browser`/`chrome` (a test enforces it); `fetch` is injected for tests.
- TypeScript strict; no `any` without a comment explaining why.
- Tailwind utilities for styling; design tokens live in the Tailwind theme (see `DESIGN.md`).
- Keep components small; one component per UI control group described in `DESIGN.md`.
- Don't add dependencies beyond the stack above without stating why in the change proposal.
- Tests keep synthetic cases synthetic; a test that reads real data skips itself when `data/` (or a `voices.json`) is absent. Take figures
  from the data, not from memory: several of PGR's did not carry over (the Light form, the 50 ms bound, the 2 cm feet bound).

## Commands

```bash
pnpm install
pnpm dev          # WXT dev mode, rebuilds into dist/chrome-mv3-dev (does not open a browser)
pnpm build        # production build → dist/chrome-mv3
pnpm compile      # vue-tsc type check
pnpm test         # node --test tests/*.test.ts (the data tests skip without data/ or a voices.json)

python3 download_construct.py shukra pavo    # models, icons, voices, saved voices page  (only when asked)
python3 download_animations.py shukra pavo   # clips                                      (only when asked)
python3 build_voices.py shukra pavo          # data/<slug>/voices.json from voice_pairings.json
```

Run the Python scripts from the repository root (`--out`/`--data` default to `data`). To use the build in a normal Chrome profile:
`chrome://extensions` → Developer mode → Load unpacked → `dist/chrome-mv3` (or `dist/chrome-mv3-dev` while `pnpm dev` runs). The output is
`dist/`, not WXT's hidden `.output/`, so the folder picker can select it. After changing `voice_pairings.json`: run `build_voices.py`,
then `pnpm build` (the build serves `voices.json`), then reload the extension.

## Workflow (OpenSpec)

This repo uses OpenSpec for spec-driven changes. If `openspec init` ever writes a managed block into this file, **keep all hand-written
content outside that managed block** so re-running `openspec update` doesn't overwrite it.

Changes, in order:

1. `bootstrap-titania` — this copy of the PGR panel, rebranded (extension name, package, preferences key and file), with Qu's Shukra and Pavo
   as the two frames (Generic skin each), the data pipeline pointed at Qu, the Board action pairing made by hand, and the Bianca-only
   behaviour dropped (Light form, chibis, extra clip sets). It records what was measured (above).
2. `add-erza-model` — Erza Scarlet's FBX converted to GLB (a spike first, go/no-go: go), added as a frame with one skin (Playground only), her
   animation list made only of Shukra's and Pavo's retargeted clips, her own toon shading (diffuse + `_SH`), and the idle tail for a model with
   no `UiStand1`. It records what was measured (the "Erza" section above). **Heaven's Wheel Armor is out of scope** for now.
3. `erza-only-companion` — Shukra and Pavo stop being frames (no picker, never shown, still the animation and voice sources), one merged
   source grouped by source, Display shows Erza, the PGR-only rendering paths are removed.

Possible later changes (not planned): the calf-twist defect (see "Erza": a retarget rule so a target bone the source lacks, `Bip001LCalfTwist` and
`RCalfTwist`, follows its calf, which removes the stretched boot strips in kicks) and the foot bone's rest-relative pitch (the 4.5 to 10 cm of sinking),
both in `retarget.ts` and so touching Qu's pairs; Erza's sword on her hand; Erza's second model; Pavo's second `UiStand1`; a face mapping for Erza (her face is bone-driven,
Qu's clips animate morph targets); porting what PGR has added since `baeda85` (see "PGR since the copy"); decoding in a Worker if the 70 ms
bound is ever too slow; tuning the Display framing for Erza's own bounds.
