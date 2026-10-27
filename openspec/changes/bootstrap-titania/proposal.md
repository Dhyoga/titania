## Why

Titania is a sibling of the PGR Bianca companion (`/home/dhyoga/serdadu/pgr`) for Erza Scarlet of *Fairy Tail*. Erza has models but no
animations or voice lines of her own; Qu in *Punishing: Gray Raven* shares her voice actress, so Qu's two frames, Shukra and Pavo, will be
the source of her motion and voice. Before Erza's models come in (`add-erza-model`), the copy has to stand on its own: rebranded, its
data pipeline pointed at Qu, and proven end to end on Qu's own models, which the existing code already renders, retargets and voices.

## What Changes

- **Copy of the PGR companion** into this folder (WXT, Vue 3, Tailwind 4, three.js, the tests, the Python scripts), without `data/`,
  `dist/`, `node_modules/`, `.git/`, `reference/`, `__pycache__/` and `.freebuff/`; a new git repository. The 20 PGR specs are already
  copied into `openspec/specs/` as the baseline.
- **Rebrand**: extension name **Titania: Fairy Tail Companion**, package `titania-fairy-tail-companion`, panel title, preferences key
  `titania.prefs` (was `pgr.prefs`), export file `titania-companion-preferences.json`, README.
- **BREAKING (from the baseline)**: Bianca's four frames are replaced by Qu's two, **Shukra** (`shukra`, prefab `r3qumd010011`, 70 clips)
  and **Pavo** (`pavo`, prefab `r2qumd010011`, 100 clips), each with its Generic skin only: no coatings, no chibi, no `anim-skins/`. They
  are shown as frames here **only for now**; `erza-only-companion` hides them.
- **Data pipeline for Qu**: `download_construct.py`, `download_animations.py` and `build_voices.py` take `shukra` and `pavo` (voice folders
  `v_qus` and `v_qu`, Japanese audio found by the same listing as Bianca's); Bianca's slugs, skin prefab lists and the Crepuscule-only
  `--check` are dropped.
- **Board action pairing for Qu is made by hand** in `voice_pairings.json`: neither the huaxu voices page nor the manifests'
  `eventTables` link a clip to a line (checked). A Board action without a pairing plays without a voice, as today.
- **Lobby**: by default Shukra and Pavo each borrow the other's voiced Board actions and idle, as Crepuscule borrows from Stigmata and
  Veritas; the user can change this per Display frame in the Display menu's Animations popover (PGR's `add-lobby-pool-menu`, copied as is).
- **Bianca-only behaviour is dropped**: Crepuscule's Light form, chibi skins, Solitary Dream's extra clips, Veritas' Ink-lit replacement.
- **New `AGENTS.md` and `DESIGN.md`**: the stack, engineering rules, workflow and panel design carried over; Bianca's measured facts left
  out; Qu's facts (rig, pelvis height, clip and voice counts, sizes) measured on the downloaded data and recorded.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `extension-shell`: the extension's name and title.
- `asset-serving`: the served frames are `shukra` and `pavo`.
- `frame-picker`: the frame list is Shukra, Pavo.
- `skin-selector`: one Generic skin per frame; the chibi requirement is removed.
- `frame-voice-data`: the slugs, voice folders and pairing table are Qu's; no Crepuscule check.
- `animation-data`: the conformance sweep runs over Qu's clips and models.
- `animation-playback`: the Menu and Fight lists and their examples are Qu's.
- `cross-frame-animation`: Shukra and Pavo lend to each other.
- `board-voice`: examples re-anchored on Qu's lines.
- `lobby-director`: the pool and lending between Shukra and Pavo, and the default of the user's choice.
- `display-mode`: the Display model is chosen among Qu's frames; the Animations popover's examples are Shukra's and Pavo's.
- `part-toggles`: Crepuscule's Light form requirement is removed.
- `user-preferences`: the storage key, the export file name, and the defaults of the Display record (animation choices included).
- `model-viewer`: the default skin and the framing figures, re-measured on Qu.

Not changed here: `toon-shading`, `toon-emission` and `pbr-metal` (Qu's models use the same PGR material parameters; their Bianca examples
stay until `erza-only-companion` replaces them), `viewer-display`, `viewer-toolbar`, `playback-speed`.

## Impact

- The whole repository is new here; the code is changed only where it names Bianca's frames (`lib/constructs/*`, `lib/anim/catalog.ts`,
  `lib/anim/names.ts`, `lib/prefs/prefs.ts`, `wxt.config.ts`, a few tests and components).
- `data/shukra/` and `data/pavo/` are downloaded (git-ignored, never committed): Generic GLBs of 5.6 and 3.4 MB plus clips, icons and
  voices; total size recorded in `AGENTS.md` after the download.
- The Erza source folders already in this directory are left untouched until `add-erza-model`.
- No new dependencies.
