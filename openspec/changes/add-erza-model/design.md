## Context

`bootstrap-titania` left a working panel on Qu's two frames (Shukra, Pavo), with runtime retargeting between them. This change adds Erza
as a third frame. Three things make her different from every frame so far: her model comes from a different tool chain (an FBX, not a huaxu
GLB), she has **no clip set and no voice lines of her own**, and her materials carry no PGR parameters.

**What the source holds** (read during planning with three.js' `FBXLoader` in Node, nothing written to the project; the spike confirms it):

| | `Erza Scarlet/Model.fbx` |
|---|---|
| Structure | one `SkinnedMesh` (48,168 vertices, 16,056 triangles) with two materials, body (`Role_Erza.png`) and sword (`Role_Erza_weapon.png`); 317 nodes, 136 bones, no animations |
| Skeleton | 59 `Bip001…` bones plus 77 `Bone_*` (skirt, hair, ribbons, face); pelvis 1.110 m, head 1.726 m: **metres**, about 1.75 m tall |
| Names | `Bip001 L Thigh` in the file; `FBXLoader` turns spaces into `_` (`Bip001_L_Thigh`) |
| Facing | toes at z +0.108 against ankles at −0.054: she faces **+Z**; Qu faces −Z. Her left hand is at +X, so a pure 180° turn about Y gives Qu's convention with no mirroring |
| Pose | arms out, hands at x ±0.58 m, y 1.29 m (a T-pose), toes 3.7 cm above y = 0 |
| Hierarchy | clavicles under `Bip001_Neck`, thighs under `Bip001_Spine`: Pavo's shape, not Shukra's |
| `Bip001` | rest orientation (−0.5, −0.5, −0.5, 0.5), 180° away from Qu's: only directions matter to retargeting, not that |
| Against Qu's rigs | all 55 of Shukra's `Bip001…` names exist on Erza (after removing separators); 56 of Pavo's 64 (the 8 missing are Pavo-only `…ForeTwist`, `…UpArmTwist`); Erza has two the sources lack (`LCalfTwist`, `RCalfTwist`) |
| Props | `Bip001Prop1` is 54 cm from her right hand, `Prop2` 2 m from both: neither sits on a hand at rest |
| Face | 13 `Bone_ypS/ypX/zb/yz/mm*` bones; no morph targets |
| Textures | each model has `Role_Erza*.png` (diffuse) and `*_SH.png`: the same UV layout as a flat, darker **shadow-colour** version |
| Mesh space | the mesh's local coordinates are Z-up (body z 0 to 2.0, sword z 0 to 3.86) while the skeleton is Y-up, so the bind matrices carry the turn |
| Skinned bounds (scene pose) | body material x −1.22 to 0.77, y 0 to 2.00, z −0.34 to 0.19: **not symmetric about her body**. The sword material: x 0.86 to 2.54, y 0 to 3.86, skinned to its own bones (`Bone_wq_*`, not to `Bip001Prop1/2`), so it floats 1 to 2.5 m to her side and is 3.9 m long. *(The spike found the cause: the scene pose is the bind pose, and 632 triangles of the **body** material are skinned to `Bone_wq_cj`, a second sword part hanging at x −1.2 to −0.75 m; see D2.)* |

**Where the code assumes a clip set of its own** (`composables/usePlayback.ts`, `lib/anim/catalog.ts`, `lib/constructs/`): `hasClips` is false
without a manifest (the panel then shows "No animations"); `catalog` is null; an item's entry, the root node, the fill pose and the idle tail are
read from the shown model's manifest (`rootNodeOf`, `fillClip`, `idleOf`); `Catalog.defaultClip` is an index into the shown model's clips;
`loadFrameData` reads `animationSource` and `voices.json` of every frame; Display and its Animations popover list every frame.

## Goals / Non-Goals

**Goals:**

- Erza Scarlet shown in Playground, first in the picker, with Shukra's and Pavo's clips retargeted onto her and their voice lines and
  subtitles working.
- An offline, repeatable conversion with documented conventions and a conformance check, whose go/no-go is settled by a spike before the rest.
- A frame with no clip set of its own as a first-class case in playback, so `erza-only-companion` builds on it instead of working around it.
- Erza's own look: toon shading from her diffuse and shadow-colour textures, with outlines.

**Non-Goals:**

- Heaven's Wheel Armor (`Erza Scarlet (Heaven's Wheel Armor)/` stays untouched; the script takes the folder as an argument so adding it later
  is data, not code), and her sword.
- Display: Erza is not a Display model and not a lender in its Animations popover until `erza-only-companion`.
- Her face (bone-driven, while Qu's clips animate morph targets) and swinging hair, skirt and ribbons: they hold their bind pose.
- Removing the PGR shading paths and Qu's frames (`erza-only-companion`), a rendered thumbnail, a new dependency.

## Decisions

### D1. Convert with `FBXLoader` in Node and our own small glTF writer

A Node script (`scripts/convert-fbx.ts`, run with `node scripts/convert-fbx.ts <source folder> <out.glb>`) parses the FBX with the three.js
loader already in `node_modules`, with its texture loader replaced by a stub (the textures are read from disk by the writer, not by three.js), then
writes the GLB itself: nodes, one skin with inverse bind matrices, vertex data (positions, normals, UVs, joints, weights, indices), materials and the
PNGs embedded as images. The writer is a few hundred lines and has no dependency of its own.

*Alternatives:* Blender (not installed, and a large dependency for one file); `fbx2gltf` (a downloaded binary from outside, to be trusted and kept in
step); three.js' `GLTFExporter` (needs a DOM canvas and `FileReader`, so it would have to run in headless Chromium, which adds a driver for one
conversion). *Fallback if the spike says no-go:* Chromium with `GLTFExporter`, then `fbx2gltf` with the user's say-so.

### D2. Conventions are baked in at conversion, not fixed at runtime

The output follows what Qu's models have, so `rig.ts`, `retarget.ts` and the viewer stay unchanged:

- **Y up, metres, facing −Z**: the 180° turn about Y goes into a parent node `Root` above the skeleton and the mesh (as Crepuscule's `Root` sat above
  its `Bip001`, which the retarget code already handles), not into vertex data.
- **`Bip001` names without separators**: `Bip001 L Thigh` → `Bip001LThigh`, done for names that start with `Bip001`; the `Bone_*` names keep what the file gives.
  Normalising at conversion keeps `rig.ts` free of a second spelling.
- **Rest transforms come from the bind pose.** The glTF node transforms are the pose the mesh was bound in (the skin's bind matrices), not the FBX's
  scene pose, so the skinned mesh is undeformed at rest. *Spike: the two are the same pose in this file (within 2 µm), so the choice made no
  difference here; the script still derives the transforms from the bind matrices, which is the safe one for another folder.* The mesh's Z-up local
  space is baked into the vertices, and the inverse bind matrices are the inverses of the bones' bind world matrices, so the mesh node sits at identity
  under `Root`.
- **The sword is left out of version 1.** Its bones are not on her hand in the file, so it cannot be shown as it is (and it would make the default framing
  fit a 3.9 m object). *Spike: it is not only the weapon material. A second sword part (632 triangles, skinned to `Bone_wq_cj`) is part of
  the body material, so a split by material leaves it on her body and the bounds asymmetric.* A triangle therefore goes to the weapon when its material is the
  weapon's (texture stem ending `_weapon`) **or any of its vertices is dominated by a `Bone_wq_*` bone**. The script writes `Erza_Body` from the rest
  (one primitive per body material), and a `--weapon` flag keeps the weapon triangles as `Erza_Weapon` for experiments. Where the sword should
  sit (on her hand, driven by a prop bone) is a later change. The body name carries no model prefix, so Parts would list it under `Other`; with one mesh the
  Parts button is disabled.
- **Material extras** carry what the toon path needs (D6): the shadow-colour texture index. Textures are embedded in the GLB.

The conformance check reads facing and sides from directions (toes against ankles, left hand's side), not from `Bip001`'s raw orientation, which
legitimately differs from Qu's.

### D3. A frame with no clip set of its own is a sources-only frame

A construct config gets `animationSource: … | null` (null: lends nothing, has no clips) and the skin `manifest` stays null. Playback treats "has clips"
as "has an own clip set **or** at least one source":

- **The list** is the sources' groups only, in frame-list order (`Shukra · Idle`, `Shukra · Board actions`, `Pavo · Idle`, …): `withSources` over an
  empty own catalog.
- **The default item** replaces the index-based `defaultClip`: `Catalog` gains `defaultItem` (an item id), which for a sources-only frame is the
  first source's own default (`Shukra · UiStand1` in Menu, `Shukra · Stand1` in Fight). An own catalog keeps `defaultClip` as before.
- **Root node**: the index of the shown model's `Bip001` in its rig (a lent clip carries the shown model's node indices), instead of the root node
  of the shown manifest's idle clip.
- **Fill pose**: none. Without an idle of her own, the skirt, hair, ribbons and helper bones keep their bind pose (the known limit the proposal
  accepts); `erza-only-companion` decides whether to derive a pose from the sources' idles.
- **Idle tail** (a voiced line that outlasts its clip): the idle of **the action's own source frame**, retargeted (`Shukra · UiStand1` after a
  Shukra Board action). With the final pairings this almost never happens (only Shukra's `BoardAct1004`, by 0.1 s) but a later pairing can give a
  longer line. A model with an idle of its own keeps using it.
- **Visibility**: no manifest, so nothing is hidden except by the user.
- **A remembered selection** is found by source frame and name, which already works for any shown frame ("Switching keeps the source").

*Alternative:* give Erza a synthetic own manifest copied from Shukra's. Rejected: its track node indices belong to Shukra's rig, so the clips would
play without retargeting and bend her. *Alternative:* a fixed idle for every sources-only frame (always Shukra's). Rejected: it makes Pavo's lines
end in Shukra's pose for no reason.

### D4. Erza is a frame that Display does not know

`ConstructConfig` gets `display?: false`. Frames with it are left out of the Display model popover and of the Animations popover's lenders, and
`resolveDisplayModel` falls back to the default for a saved Display model that names one (an unknown frame already does). A frame with
`animationSource: null` is skipped when the frame data is read (no manifest, and no `voices.json` is fetched, so no warning in the console).
`erza-only-companion` turns both around.

### D5. Where the data lives

The folder `Erza Scarlet/` moves to `data/erza/source/` (as the proposal says; it is a game asset like the rest of `data/`), and the script writes
`data/erza/models/erza-scarlet.glb`. The skin id is `erza-scarlet` (the model file stem, with the icon `icons/erza-scarlet.webp`, which does not
exist: the tile shows the initials `ES`). Served paths for `erza` are `models` and `icons` only (no clips, no voices). The frame is named `Erza` in the header.
A rendered thumbnail is not built.

### D6. Erza's toon shading is a separate material, next to the PGR one

`parseToonMaterial` gains one more family, read from the material's extras (`family: 'diffuseShadow'`, the base-colour texture and the shadow-colour
texture); everything the PGR path reads stays as it is. A new `DiffuseShadowMaterial` (its own file) shades a fragment as
`mix(shadow, lit, smoothstep(lo, hi, N·L))`: `lit` is the diffuse texture, `shadow` the `_SH` texture, `N·L` uses the shared light of the
Lighting popover (direction and intensity), with a soft edge of a few percent. There is no self-shadow, no ramp, no emission. Outlines use the
existing hull outline with fixed defaults (a thin line in a darker shade of the surface), because her materials have no outline pair. The toon
switch off shows the GLB's own material (base-colour texture only), as for every model. Keeping it in its own file is deliberate: when
`erza-only-companion` removes the PGR paths this one stays untouched.

*Alternative:* write PGR-style parameters into her materials' extras so the existing shader draws her. Rejected: the shader's inputs (colour
ramps, masks, PBR) have nothing to read from her textures, and a fake parameter set would pretend to be the game's.

### D7. Conformance and accuracy are tested the way Qu's are

`tests/erzaModel.test.ts` (skipped without `data/erza/`): the GLB loads, has one skin and the two mesh nodes, its `Bip001` names are unique and
separator-free, it stands about 1.75 m tall on y = 0 within a few cm, faces −Z with her left on −X, and every `Bip001…` bone that Shukra's and Pavo's
clips drive exists on it except the eight named Pavo twist bones. The retarget accuracy test of `retarget.test.ts` is extended with Erza as a target
only (Shukra → Erza, Pavo → Erza: limb directions and palms within the same bounds). The feet bound for Erza is measured and set in the task, not
assumed (see Risks).

## Risks / Trade-offs

- **[The spike fails: bad skin weights, a wrong bind pose from the Z-up mesh, or a loader bug]** → The spike is task 1 and gates the rest; the
  fallbacks of D1 are tried in order; a no-go stops the change with what was measured written down, and `design.md` is revised before anything else.
- **[Her feet float or sink]** → Her toes rest 3.7 cm above the floor and the pelvis ratio is 1.110 / 0.959 = 1.16, so the 2 cm of the spec may not
  hold (Shukra → Pavo already gives 2.7 cm for a 1 cm toe offset). **Spike: she sinks 4.5 to 10.4 cm** (lowest foot point against the source's, both
  relative to their rest poses; Shukra → Erza 5.9 to 8.0, Pavo → Erza 4.5 to 10.0). A pelvis-height correction would not fix it: the cause is the foot
  bone, which direction matching turns to Shukra's steep foot direction while her foot bone is longer (0.213 against 0.132 m), so the toe lands 6.6 cm
  lower than her flat boot rests. Either the test bound is set to the measured value with the reason, or retargeting treats the foot differently
  (keeping its rest-relative pitch, so a flat source foot gives her flat boot), which also touches Qu's pairs. Decided with the numbers in front of us
  (tasks 2.3 and 5.5).
- **[The scene pose differs from the bind pose, or the skin weights are wrong]** → Bounds that are not symmetric about the body are the symptom; the spike
  writes the bind pose as the rest transforms (D2), renders her and checks the deformation against the texture and the limbs. Skin weights that are
  wrong in the file are a no-go for this model, not something the script repairs.
- **[A T-pose body takes a hand-on-hip or arm clip badly]** → The direction method does not depend on the rest pose, and the contact planner is
  weighted and bounded; the spike plays Shukra's hand-on-hip Board actions and the clips that put arms across the body, and records any that look wrong.
- **[Hair, skirt and ribbons stand stiff, her face stays still]** → Accepted in the proposal and shown in the browser check, so it is a known limit and
  not a surprise; both are possible later changes.
- **[The sources-only path regresses Qu's frames]** → Qu's tests stay as they are and must keep passing; the new path adds its own (a list built from sources only,
  the default item, the idle tail from the source frame, the Display exclusions).
- **[Her proportions]** → She is taller (1.75 m against 1.46 m) with a wider T-pose; the default framing is computed from her own bounds and its figures are
  measured in a task, and `widthShare` 0.8 is checked on her.
- **[Moving the source folder]** → A move inside the project, into the folder that holds every other game asset, and git-ignored either way; the conversion
  can always be re-run from it.

## Migration Plan

Nothing to migrate: a new frame and new files. `data/erza/` is generated locally; deleting it removes Erza and leaves Qu's frames working (the
build skips served paths that are missing). `Erza Scarlet (Heaven's Wheel Armor)/` is not touched.

## Open Questions

- Whether the converted skin deforms correctly and which pose the FBX holds as its bind pose (the spike).
- The feet: a bound of about 11 cm with its reason, or a different foot treatment in `retarget.ts` (see Risks). Settled in tasks 2.3 and 5.5.
- Which Shukra and Pavo clips look wrong on her (the browser check; there is no exclusion mechanism, only a record).
- Whether the diffuse/shadow edge looks right with `smoothstep` limits of a few percent, judged by eye against the game's look.
