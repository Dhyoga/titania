## Why

Erza's two models come from another game: `Erza Scarlet/` and `Erza Scarlet (Heaven's Wheel Armor)/`, each a binary FBX with its textures
(`Role_Erza*.png` and `*_SH.png`), plus a DAE and an OBJ. Only the FBX is usable: it holds a skinned **3ds Max Biped** rig (142 and 147
limb nodes, `Bip001 …` names with spaces), while the DAE and OBJ are Metasequoia exports without joints. The Biped rig is the family Qu's
models use, so `lib/anim/retarget.ts` (world-space direction matching by `Bip001…` name) should drive Erza with Shukra's and Pavo's clips.
Scale, facing, bind pose and skin weights of these ripped files are unknown, so the change starts with a spike.

## What Changes

- **Spike first, as the first task (go/no-go)**: convert one FBX to GLB, load it in the viewer, play Shukra's `UiStand1` and one Board
  action retargeted onto it. Measure and record in `AGENTS.md`: unit and height, facing, bind pose, whether the skin deforms correctly,
  the bone name mapping, and which Erza bones get no track. The rest of the tasks follow only if it passes; its findings may revise
  `design.md` before they start.
- **Conversion, offline and repeatable**: a script turns each source FBX into `data/erza/models/<skin>.glb` with PGR's conventions (Y up,
  metres, facing −Z, `Bip001` names without spaces: `Bip001 L Thigh` → `Bip001LThigh`). The source folders move to `data/erza/source/`
  (git-ignored, like all game assets). The DAE and OBJ are not used.
- **Erza is added as a frame**, first in the picker, with two skins: **Erza Scarlet** (default) and **Heaven's Wheel Armor**. She has no
  clip set of her own: her animation list is Shukra's and Pavo's clips, retargeted, in Playground. Display keeps Qu until
  `erza-only-companion`: Erza is not offered as a Display model, nor as a section of the Display menu's Animations popover (she has no
  clips or voice lines of her own to lend, so she must not show up as an empty or unreadable lender).
- **Erza's shading**: toon from the diffuse texture and its `_SH` shadow-colour texture (lit/shadow split on N·L), with the existing
  outlines; the PGR material path stays for Qu's models. The toon switch still falls back to the model's own materials.
- **Skin thumbnails**: there is no wiki icon for Erza; the strip uses the existing placeholder or a rendered thumbnail (decided in design).
- **Known limits, recorded and accepted here**: Erza's bones without a source track (skirt `Bone_qz*` / `Bone_qunzi_*`, hair
  `Bone_toufa*`, ribbons and cape `Bone_tf_*`) hold their bind pose, since there is no idle of her own to fill from; her face is driven
  by bones (`Bone_ypS/ypX` eyelids, `Bone_zb_*` mouth, `Bone_yz_*` eyes, `Bone_mm*` brows) while Qu's clips animate morph targets, so her
  face stays still. A face mapping is a possible later change.

## Capabilities

### New Capabilities

- `erza-model`: the FBX-to-GLB conversion, its conventions and bone name normalisation, Erza's two skins and a conformance check that
  every converted model loads and every `Bip001…` bone the sources animate is found.

### Modified Capabilities

- `frame-picker`: Erza joins the frame list, first.
- `skin-selector`: Erza's skins, without wiki icons.
- `cross-frame-animation`: a frame with no clip set of its own takes all its clips from the lending frames; rigs of converted models.
- `animation-playback`: a list made only of lent clips, and what plays when such a frame opens.
- `toon-shading`: toon shading from a diffuse and a shadow-colour texture for models without PGR material parameters.
- `asset-serving`: `erza` is served (models only).
- `display-mode`: a frame without clips of its own is neither a Display model nor a lender in the Animations popover.
- `model-viewer`: the default framing measured on Erza.

## Impact

- New: the conversion script (tool chosen in the spike; Blender is not installed here, three.js' `FBXLoader` and `fbx2gltf` are the
  candidates), `lib/constructs/erza.ts`, the diffuse/shadow toon path, tests.
- Changed: `lib/anim/catalog.ts` (a frame without its own clips), `lib/anim/rig.ts` if name normalisation lives at runtime,
  `lib/viewer/toon/applyToon.ts`, `lib/constructs/index.ts`.
- `data/erza/` is generated locally from the source files; nothing is downloaded.
