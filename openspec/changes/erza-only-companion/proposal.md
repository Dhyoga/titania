## Why

Titania is Erza's companion; Qu is only where her motion and voice come from. After `add-erza-model`, Erza plays Qu's clips in
Playground, but Shukra and Pavo are still frames you can pick and Display still shows them. This change makes Erza the only model shown,
merges Shukra's and Pavo's clips into one source for her, and removes the rendering paths that served only PGR models.

## What Changes

- **Shukra and Pavo stop being frames**: never shown, not in any picker, no skin strip. They stay in `data/` and are still served for what
  Erza needs from them: clips, voice lines, and the rig of each Generic model (read from the GLB's JSON chunk only, as lent clips already do).
- **BREAKING: the frame picker is removed.** The header names Erza; the skin strip holds her two skins.
- **One merged animation source**: Shukra's and Pavo's clips together, grouped by source in the list (`Shukra · Board actions`,
  `Pavo · Board actions`, their idles), since both have `BoardAct0201`…`BoardAct1007` and `UiStand1` under the same names.
- **Display shows Erza**: the Display model is one of her skins; the lobby pool is the voiced Board actions of both sources, each with its
  own voice line; idles come from both sources' Menu idles.
- **The Animations popover without an own frame**: today the Display frame's own animations are always in and locked, which is what keeps
  the pool from being empty. Erza has no animations of her own, so `design.md` decides how the popover and the pool work for her: e.g. the
  two sources shown as sections that are all checked by default, with a rule that keeps at least one action (or an empty pool that idles).
  Choices are stored under `erza` in `lobby.pools`; stored choices for `shukra` and `pavo` are ignored and kept.
- **Helper bones without a source track**: with no idle of Erza's own, what they hold (bind pose, or a pose derived from the sources'
  idles) is decided in `design.md` from what the spike and `add-erza-model` measured.
- **PGR-only rendering removed**: the toon path driven by PGR material parameters, emission, PBR metal and the Light form handling go,
  with their code; Erza's diffuse/shadow toon is the toon path.
- **Preferences**: the Display model is an Erza skin; a stored Qu frame or skin falls back to the default without an error.
- `README.md`, `AGENTS.md` and `DESIGN.md` describe the Erza-only panel.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cross-frame-animation`: the lending frames are animation sources that are never shown; their clips form one merged source.
- `animation-playback`: the merged list and its grouping by source.
- `skin-selector`: only Erza's skins.
- `display-mode`: the Display model is an Erza skin; the Model button lists her skins only; the Animations popover for a Display model
  with no animations of its own.
- `lobby-director`: the pool and idles come from both sources for Erza's model.
- `toon-shading`: the requirements driven by PGR material parameters are removed.
- `part-toggles`: parts of Erza's models (mesh names of the converted GLBs).
- `user-preferences`: stored Display models, animation choices and per-skin parts are Erza's; old Qu values fall back.
- `asset-serving`: Qu's folders are served for clips, voices and rigs only.

### Removed Capabilities

- `frame-picker`, `pbr-metal`, `toon-emission`.

## Impact

- `lib/constructs/*` (sources separated from the shown model), `lib/anim/catalog.ts`, `lib/lobby/pool.ts`, `lib/viewer/toon/*`,
  `composables/useLobbyDirector.ts`, `components/` (header, Model popover), `lib/prefs/prefs.ts`; tests trimmed to match.
- Less served and loaded: Qu's models are never rendered, so no textures of theirs reach the GPU.
- No new dependencies.
