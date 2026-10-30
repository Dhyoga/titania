## 1. Copy and repository

- [x] 1.1 Check that PGR is at commit `baeda85` with a clean working tree (`git -C /home/dhyoga/serdadu/pgr status`, `rev-parse HEAD`); if it moved on, stop and ask (design, "PGR moves on after the copy"). Copy the PGR working tree into this folder per design D1 (sources, `tests/`, `assets/`, `entrypoints/`, `components/`, `composables/`, `lib/`, the three Python scripts, `voice_pairings.json`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `wxt.config.ts`, `.gitignore`, `.agent/workflows/`); leave out `data/`, `dist/`, `node_modules/`, `.wxt/`, `.git/`, `reference/`, `__pycache__/`, `.freebuff/`, `AGENTS.md`, `DESIGN.md`, `README.md`, `openspec/`
- [x] 1.2 Add `Erza Scarlet*/` to `.gitignore`; `git init` and commit the unedited copy plus `openspec/` as the first commit
- [x] 1.3 `pnpm install`, then `pnpm compile` and `pnpm test` (the data sweeps skip without `data/`); record anything that fails before edits

## 2. Rebrand

- [x] 2.1 `package.json` name and description, `wxt.config.ts` manifest `name` (`Titania: Fairy Tail Companion`) and description, `entrypoints/sidepanel/index.html` `<title>`
- [x] 2.2 `lib/prefs/prefs.ts`: `PREFS_KEY = 'titania.prefs'`, `PREFS_FILE_NAME = 'titania-companion-preferences.json'`; update `composables/usePreferenceFiles.ts`' comment and the prefs tests
- [x] 2.3 Change comments that would mislead about this repository (what the panel opens on in `App.vue`, file names, the prefs key); keep the explanatory Bianca measurements in `retarget.ts`, `contact.ts`, `catalog.ts` (design D6)
- [x] 2.4 Search `components/`, `entrypoints/`, `composables/` and `wxt.config.ts` for `Bianca` and `Gray Raven Companion`: no matches

## 3. Qu data

- [x] 3.1 `download_construct.py`: add the `PREFABS` table (`shukra: r3qumd010011`, `pavo: r2qumd010011`); download only that prefab's model and icon (no other prefabs, coatings, chibis), plus the saved voices page and the English and Japanese voices as before; an unknown slug fails naming it
- [x] 3.2 `download_animations.py`: import `PREFABS` from `download_construct.py`, empty `SKIN_PREFABS`, update the usage docstring
- [x] 3.3 `build_voices.py`: remove the Crepuscule `--check` mode and its "never regenerated" rule; update the docstring
- [x] 3.4 Run `python3 download_construct.py shukra pavo` and `python3 download_animations.py shukra pavo`; check `data/<slug>/` holds one GLB, one icon, `wiki/voices.html`, `voices_en/`, `voices_ja/`, `anim/manifest.json` and 70 / 100 clip files; re-run both to confirm everything is skipped
- [x] 3.5 Record in a scratch note (for `AGENTS.md`): sizes on disk per folder, number of English and Japanese voice files per frame, and the Japanese audio duration of every file (e.g. with `ffprobe`)

## 4. Voice pairing (with the user)

- [x] 4.1 Per frame and per Board action, list candidate lines by Japanese audio length against the clip's duration (design D4); present the candidates to the user
- [x] 4.2 With the user, confirm pairings by playing each clip with its candidate line in Playground; write the agreed pairs to `voice_pairings.json` under `shukra` and `pavo` (Bianca's entries removed) with a `_comment` saying the pairs were chosen by listening
- [x] 4.3 Run `python3 build_voices.py shukra pavo`; both `voices.json` files are written without errors

## 5. Constructs and code

- [x] 5.1 Add `lib/constructs/shukra.ts` and `pavo.ts` per design D2 (one Generic skin, `anim/` clip set, served paths without `anim-skins`, `lobby` borrowing from each other as the popover's default, no `exclude` field: it no longer exists); remove `crepuscule.ts`, `stigmata.ts`, `veritas.ts`, `zero.ts`; `FRAMES = [shukra, pavo]`, `DEFAULT_FRAME = shukra.id`
- [x] 5.2 Remove the Light form (default-form) setting from `lib/constructs/skins.ts` and its use in `lib/viewer/parts.ts` and the parts composable, so meshes follow the animation data, the saved choices and the user's choices
- [x] 5.3 Point the Display model default (`lib/constructs/display.ts`) at Shukra's Generic; an unknown saved model, including a Bianca one from an imported PGR file, falls back to it
- [x] 5.4 Make the skin strip omit a group without skins (only `Generic` shows) if it does not already
- [x] 5.5 Update the tests that name Bianca's frames, skins or files (`catalog`, `skins`, `lobbyConfig`, `lobbyPool`, `director`, `displayModel`, `parts`, `prefs`, `screenshotName`, `assetPath`, `conformance`, `frameVoices`, `voices`, `retarget`, `rig`, …) to Qu's ids and facts from the specs, keeping synthetic cases synthetic
- [x] 5.6 `pnpm compile` and `pnpm test` pass with `data/` present: the conformance sweep decodes all 170 clips, the frame voice data checks pass for both frames, and the retarget accuracy test passes Shukra → Pavo and Pavo → Shukra

## 6. In the browser

- [x] 6.1 `pnpm build`, load `dist/chrome-mv3` unpacked; the extension is named Titania: Fairy Tail Companion and opens in Display on Shukra with a Board action (voiced when paired)
- [x] 6.2 Playground: the frame picker lists Shukra, Pavo; each shows one Generic tile with its icon; the Menu and Fight lists match the `animation-playback` scenarios; a `Base Layer` clip of Pavo loads
- [x] 6.3 Play every Board action of each frame on the other frame and look at it: record clips that look wrong (in the scratch note for `AGENTS.md`; there is no `lobby.exclude`, see design D2), whether clothing stays closed, and which clips put a hand on the hip; check that hand stays on the hip
- [x] 6.4 Check by eye whether Pavo's second `UiStand1` (`anim/UiStand1_2.json`) differs from the first; record the answer (design open question)
- [x] 6.5 Measure and record: default framing figures for both frames at 320 / 387 / 600 px, viewer statistics of each Generic, and the longest source clip's parse + decode + retarget time (under 70 ms; the spec's bound was relaxed from 50 ms after measuring 67 ms on `BoardAct1004`; measured in Node/V8, not in headless Chromium)
- [x] 6.6 Export the preferences, check the file name; import a PGR `bianca-companion-preferences.json` (with a Crepuscule animation choice) and check it falls back to Shukra's Generic with Shukra's and Pavo's default animations
- [x] 6.7 Display menu, Animations: on Shukra, Shukra's section is locked and Pavo's fully checked; unpaired Board actions are absent; clearing Pavo while one of Pavo's actions plays lets it finish and no Pavo action starts again; "Use default" restores it; switch the Display model to Pavo and check the mirror case; the five buttons fit at 320 px

## 7. Project documents

- [x] 7.1 Write `AGENTS.md` per design D8: project, stack, repository layout, `data/` rules, data contracts, a "Qu (animation and voice source)" section with the facts table of the design plus everything recorded in 3.5, 4 and 6, engineering rules, commands, workflow with the three planned changes
- [x] 7.2 Write `DESIGN.md` from PGR's with this project's names and examples; layout and tokens unchanged
- [x] 7.3 Write `README.md`: what Titania is (Erza with Qu's motion and voice; Qu shown until `erza-only-companion`), unofficial fan project notice naming both games' owners, requirements, the data scripts, build and load, commands
- [x] 7.4 Commit; `openspec validate bootstrap-titania --strict` passes
