## Context

`/home/dhyoga/serdadu/pgr` is a finished WXT + Vue 3 + three.js side panel for Bianca's four PGR frames: Display (lobby) and Playground,
toon shading from the PGR material parameters, clips decoded from huaxu's packed JSON, cross-frame retargeting by `Bip001…` name,
voiced Board actions with subtitles, a lobby whose borrowed animations the user chooses (Display menu, "Animations"), preferences. Its 20
specs are copied into `openspec/specs/` as this project's baseline, as of PGR commit `baeda85` (`add-lobby-pool-menu` archived); the code
is copied from the same commit.

This folder holds only `openspec/` and Erza's two source folders (FBX, DAE, OBJ, PNG). The end goal is an Erza-only companion that plays
Qu's clips and voice lines; this change is the first of three (`bootstrap-titania` → `add-erza-model` → `erza-only-companion`) and
must leave a working extension on its own.

Facts about Qu already measured (huaxu manifests and the JSON chunk of each Generic GLB, fetched read-only):

| | Shukra (`shukra`) | Pavo (`pavo`) |
|---|---|---|
| Generic prefab | `r3qumd010011`, 11.1 MB (5.6 stored) | `r2qumd010011`, 5.3 MB (3.4 stored) |
| Clips in `anim/manifest.json` | 70 (`BaseLayer` 56, `LevelCombine1Level1` 13, `UiStand1`) | 100 (`BaseLayer` 49, `Base Layer` 11, `LevelCombine1Level1` 27, `LevelCombine1Level2` 11, `UiStand1`, `UiStand1_2`) |
| `rootNode` | 1 = `Bip001` on every clip | same |
| Menu list (PGR `buildCatalog`) | Idle: `StandAct0101`, `UiStand1`; Board actions: `BoardAct0201`–`0203`, `1001`–`1007` | same |
| Fight list | Idle: `Stand1`, `Stand2`, `Standchange`; Movement: `Run`, `Walk`; Other: `Born`, `Save`, `Win` | same, plus Level skills: `LevelAttack14`; Other adds `Executioner01`–`05` |
| Hidden nodes / state hides | none | none |
| Rig | 326 nodes, 55 `Bip001*`; clavicles under `Spine2`, thighs under `Pelvis`; props `Prop1`, `Prop2` | 203 nodes, 64 `Bip001*`; clavicles under `Neck`, thighs under `Spine`; prop `Prop1` |
| Rest pelvis / head height | 0.959 / 1.462 m | 0.968 / 1.449 m |
| Meshes | 10, prefix `R3QuMd010011` (`Alpha`, `Body`, `Down`, `Eye`, `Face`, `Hair01`, `Hair02`, `Huangyu`, `Upper`, `Weapon`) | 8, prefix `R2QuMd010011` (`Bead`, `Body`, `Cloth`, `Eye`, `Face`, `Hair01`, `Hair02`, `Head`) |
| Morph targets | `Face` 35, `Eye` 7 | `Face` 21, `Eye` 5 |
| Voice folder | `v_qus` (81 English links on the page) | `v_qu` (66) |

The two rigs differ in the same ways Bianca's did (Shukra's hierarchy is Crepuscule's minus `Root`, Pavo's is Veritas'/Zero's), so the
retargeting code is exercised on both kinds of hierarchy without change.

## Goals / Non-Goals

**Goals:**

- A working extension named Titania: Fairy Tail Companion, built from the PGR code with the smallest code change that swaps the subjects.
- Qu's data downloaded and checked by the existing pipeline and tests, so `add-erza-model` starts from proven clips, rigs and voices.
- New `AGENTS.md`, `DESIGN.md` and `README.md` that describe this repository, not Bianca's.
- Specs that describe what this repository does after the change.

**Non-Goals:**

- Erza (next change). Her source folders stay where they are, untouched.
- Qu's coatings, chibis and `anim-skins/`: Qu's models disappear in `erza-only-companion`, so only what Erza will need is downloaded.
- Rewriting the PGR toon shader, PBR metal or emission: they render Qu's models as they rendered Bianca's.
- Refactoring the construct model ("frame shows its own clips"). That is `add-erza-model`'s and `erza-only-companion`'s work.

## Decisions

### D1. Copy the working tree, start a fresh repository

Copy the PGR files (sources, tests, scripts, configs, `pnpm-lock.yaml`, `.gitignore`, `.agent/workflows/`) but not `data/`, `dist/`,
`node_modules/`, `.wxt/`, `.git/`, `reference/`, `__pycache__/`, `.freebuff/`, `AGENTS.md`, `DESIGN.md`, `README.md` and `openspec/`
(already in place). Then `git init` and a first commit of the copy as-is, before any edit, so every later diff reads as "from PGR".

*Alternative:* a git fork keeping PGR's history. Rejected: the history is about Bianca and her specs; the archive of 25 changes would
contradict this project's baseline. The PGR repo remains the reference.

`.gitignore` gains `Erza Scarlet*/` (the source models are game assets and are moved under `data/` by `add-erza-model`).

### D2. Qu replaces Bianca as frames, Generic skin only

`lib/constructs/` gets `shukra.ts` and `pavo.ts` and loses Bianca's four; `FRAMES = [shukra, pavo]`, `DEFAULT_FRAME = shukra.id`. Each frame
lists one skin, `{ id: '<prefix>010011', name: 'Generic', group: 'generic', manifest: 'anim/manifest.json' }`, which is also its default skin,
and `animationSource: { manifest: 'anim/manifest.json', extras: [] }`. Served paths: `models`, `anim`, `voices_ja`, `voices.json`, `icons`
(no `anim-skins`).

*Why `…010011` and not Generic - Final (`…010031`, PGR's default):* `anim/` is the `…010011` clip set; another skin would need its own
`anim-skins/` download for a model that is hidden two changes later.

`lobby`: Shukra `{ actionFrom: ['pavo'], idleFrom: ['pavo'] }`, Pavo `{ actionFrom: ['shukra'], idleFrom: ['shukra'] }`. Since
`add-lobby-pool-menu` this is only the default of the Animations popover (what Display borrows when the user has chosen nothing); there is
no `lobby.exclude` and no fixed list of Board action names. A borrowed clip that looks wrong on the other frame is recorded in `AGENTS.md`
and either left out of the default by the user in the popover or, if it should never be offered, handled by a later change.

Every voiced Board action is in the pool, so the lobby's variety depends on how many of the ten Board actions per frame get a pairing in
D4: an unpaired action is neither played in Display nor offered in the popover.

### D3. The download scripts are pointed at Qu and limited to the base prefab

- `download_animations.py`: `PREFABS = { shukra: r3qumd010011, pavo: r2qumd010011 }`; `SKIN_PREFABS` emptied (`--skins` then does nothing).
- `download_construct.py`: today it downloads every prefab, chibi and icon found on the model page (Shukra's page names nine ids, among
  them coatings, a chibi and `e3jianmd…`). It gets the same `PREFABS` table and downloads only that model and its icon, plus the voices and
  the saved page as before. The table lives in one place (`download_construct.py`, imported by `download_animations.py`, as
  `build_voices.py` already imports `nuxt_payload`).
- `build_voices.py`: unchanged logic; the Crepuscule `--check` mode and its "never regenerated" rule are removed, since no shipped
  `voices.json` exists here.

### D4. Board action pairing is chosen by listening, recorded in `voice_pairings.json`

Nothing in the data links a Board action to a line (checked: the voices page payload and the manifests' `eventTables`, which hold only
`stopAnimNames` and state-sync flags). The pairing is made by hand per frame: candidates are the lines whose Japanese audio length is close
to the clip's (length narrows rather than decides; **take it by decoding the file**: ffprobe reads these VBR MP3s up to 2× too long, which
misled the first draft. With the user's final pairs every line ends before its clip, except Shukra's `BoardAct1004`, 41.9 s against 41.8 s), then confirmed by
playing the clip with the candidate line in Playground. A clip without a confident pairing gets no entry and plays silently. The table's
`_comment` records how pairs were chosen. This is the only step of the change that needs the user's ear; the rest is mechanical.

### D5. How the baseline specs are re-anchored

A requirement is modified here when its normative text or its scenarios name Bianca's frames, skins, prefabs, files or Bianca-only
behaviour. Each modified requirement is restated for Qu with facts from the table above. Figures that need the downloaded data (voice
line lengths, framing percentages, timings) are not guessed in scenarios: the scenario states the property, and the figure measured
during the change goes into `AGENTS.md`. Bianca-only requirements (Light form, chibi without clips) are removed, with the reason.

Left as they are: `toon-shading`, `toon-emission`, `pbr-metal` (their examples name Bianca's materials; the behaviour applies to Qu's
models unchanged and the three are replaced or removed in `erza-only-companion`), and `viewer-display`, `viewer-toolbar`, `playback-speed`
(generic, or naming Bianca only in a screenshot file-name example). The stale examples in those six specs are accepted until then.

### D6. Code comments

Comments that explain *why* the code is as it is (retarget's hierarchy notes, contact.ts' hand-on-hip measurements, catalog's folder
rules) keep their Bianca examples: those measurements are the reason the code exists, and the PGR repository holds the evidence. Only
comments that would mislead about this repository (what the panel opens on, file names, the prefs key) are changed. `catalog.ts`' Level
skills keep-list (Bianca's four names) stays as it is: it does no harm on Qu (Pavo's `LevelAttack14` matches) and Erza's list is
reworked in `erza-only-companion`.

### D7. Preferences: new key, no migration

`PREFS_KEY = 'titania.prefs'`, `PREFS_FILE_NAME = 'titania-companion-preferences.json'`. An unpacked extension gets its own storage,
so there is nothing to migrate. An imported PGR preferences file names Bianca's frames: its Display model falls back to the default, as
an unknown saved model already does; parts saved under Bianca's skin ids are kept and never match.

### D8. The new project documents

- `AGENTS.md`: from PGR's, keep Project (rewritten), Stack, Repository layout (updated), Assets and `data/` rules, Data contracts
  (formats are the same: manifest, clip, voices), Engineering rules, Commands and Workflow. Drop "Prior prototype" and every Bianca
  measurement section; add a "Qu (animation and voice source)" section with the facts table above plus what the change measures
  (sizes on disk, voice counts, line lengths of the pairings, framing figures, the retarget accuracy result). The changes list restarts
  with the three planned changes.
- `DESIGN.md`: PGR's panel design carried over with names changed (title, frame list, examples). The layout and tokens are unchanged.
- `README.md`: Titania, what it is for (Erza with Qu's motion and voice, Qu shown for now), the unofficial-fan-project notice covering both
  games' owners, requirements, build, load, commands.

## Risks / Trade-offs

- [Voice pairing is a judgement call] → Unpaired clips still play in Playground; the table can be revised at any time with
  `build_voices.py`, and the conformance test catches typos. Display only plays and offers paired Board actions, so few pairings mean a
  small lobby pool.
- [PGR moves on after the copy] → The baseline and the code are pinned to PGR `baeda85`. A later PGR change is ported by hand (specs into
  `openspec/specs/`, the affected changes' deltas re-checked), as was done for `add-lobby-pool-menu`.
- [huaxu changes its layout or paths] → The scripts already fail loudly per file; the saved page (`wiki/voices.html`) keeps
  `voices.json` rebuildable offline.
- [Qu clips trip a Bianca-tuned assumption] (folder names, the Level skills list, retarget accuracy thresholds) → The conformance sweep
  and the retarget accuracy test run on Qu's data in this change; a failure is fixed here, before Erza adds a third rig.
- [Stale Bianca examples in six untouched specs] → Accepted and listed in D5; removed by `erza-only-companion`.
- [Symlinked assets tie the build to this checkout's path] → Unchanged from PGR, documented in the README.

## Migration Plan

Nothing to migrate: a new extension. The PGR extension and repository are not touched. Rollback is deleting this folder's copy.

## Open Questions

- The voice pairings themselves (D4), settled during the change with the user.
- Pavo's manifest holds a second clip named `UiStand1` (`anim/UiStand1_2.json`, 6.0 s like the first) that no Menu state uses, so it is
  not listed. Whether it is a distinct idle worth offering is checked by eye during the change; offering it would be a later change.
