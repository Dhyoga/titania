## 1. Spike (go / no-go): do this first, the rest follows only if it passes

- [x] 1.1 Move `Erza Scarlet/` to `data/erza/source/` (keeping the folder name) and check `Model.fbx` and the four PNGs arrive with the same sizes; leave `Erza Scarlet (Heaven's Wheel Armor)/` where it is, untouched
- [x] 1.2 First `scripts/convert-fbx.ts` (design D1, D2): `FBXLoader` in Node with its texture loader stubbed, then our own glTF writer: bind pose as the rest transforms, a `Root` node turning her 180° about Y, `Bip001…` names without separators, `Erza_Body` only, the diffuse and `_SH` PNGs embedded; write `data/erza/models/erza-scarlet.glb`
- [x] 1.3 Check the file at rest: it loads with `GLTFLoader` in the viewer (a temporary construct entry is enough), the skinned bounds are symmetric about her body, she stands about 1.75 m tall on y = 0 facing −Z with her left on −X, and no triangle is stretched (look at it from the front, side and back)
- [x] 1.4 Retarget onto her Shukra's `UiStand1` and one Board action and Pavo's `Run` (a Node script with `rigFromGltf` and `retargetClip`, then the panel): record the unit and height, the facing, which pose the FBX holds as its bind pose, whether the skin deforms correctly, the bone mapping (the eight Pavo-only twist bones, her two extra `CalfTwist` bones), the bones that get no track, and the lowest foot point against the 2 cm of `cross-frame-animation`
- [x] 1.5 Decide go or no-go and write what was measured under an "Erza" section of `AGENTS.md`; on no-go try D1's fallbacks in order, and if none works stop here and report; revise `design.md` where the spike disagrees with it (bind pose, the feet bound, anything about the sword) before section 2

## 2. Conversion, final

- [x] 2.1 Finish `scripts/convert-fbx.ts`: the source folder as an argument, `--weapon`, deterministic output (no timestamps or unordered maps), reads only the source and writes only under `data/erza/`, usage at the top of the file, a console note for anything it drops
- [x] 2.2 Write `tests/erzaModel.test.ts` (skipped without `data/erza/`): the model loads with one skin and one mesh node `Erza_Body`, `Bip001…` names are unique and separator-free, her size, facing and sides as in the `erza-model` scenarios, all 55 of Shukra's and 56 of Pavo's `Bip001…` names found, and (when the source is present) converting twice gives the same bytes
- [x] 2.3 Extend the real-data retarget accuracy test in `tests/retarget.test.ts` with Erza as a target only (Shukra → Erza, Pavo → Erza: `UiStand1`, `BoardAct0201`, `Run`) and the "only Bip001 tracks" and prop checks of the `erza-model` spec; set her feet bound to the measured value, with the reason, as Shukra → Pavo's is
- [x] 2.4 Run the script on `Erza Scarlet (Heaven's Wheel Armor)/` writing to a scratch folder only, to confirm the "another folder" scenario; keep nothing from it

## 3. A frame with no clip set of its own

- [x] 3.1 `lib/constructs/`: `animationSource` may be null, `display?: false`; add `erza.ts` (id `erza`, name `Erza`, skin `erza-scarlet` named `Erza Scarlet`, manifest null, served paths `models` and `icons`, `display: false`); `FRAMES = [erza, shukra, pavo]`, `DEFAULT_FRAME` stays Shukra; update `skins.test.ts` and the frame-list tests
- [x] 3.2 `lib/anim/catalog.ts`: a catalog built from sources only (the own catalog empty), `Catalog.defaultItem` (an item id: the first source's own default, `Shukra · UiStand1` in Menu and `Shukra · Stand1` in Fight); tests for the Menu and Fight lists on Erza from the `animation-playback` scenarios and for the default item
- [x] 3.3 `composables/usePlayback.ts` (design D3): "has clips" is a clip set or at least one source; the catalog, item info and request work without an own manifest; the root node of a lent clip is the shown rig's `Bip001`; no fill pose without an own idle; the idle tail is the action's source frame's `UiStand1`, retargeted; the default and a missing remembered clip use `defaultItem`; `loadFrameData` skips a frame with no `animationSource` and reads no `voices.json` for it
- [x] 3.4 Components: "No animations" only when there is neither a clip set nor a source; the skin strip shows `ES` for her tile (check `initials('Erza Scarlet')`); the header picker lists Erza first
- [x] 3.5 Display (design D4): the Model popover and the Animations popover leave out a frame with `display: false`, the lobby's lenders and idles skip a frame without a clip set, `resolveDisplayModel` replaces a saved Display model that names one and keeps the stored value; tests in `displayModel`, `lobbyPool` and `lobbyConfig`
- [x] 3.6 `pnpm compile` and `pnpm test` pass, Qu's tests unchanged

## 4. Erza's shading

- [x] 4.1 `lib/viewer/toon/params.ts`: read the `diffuseShadow` family (base-colour texture, shadow-colour texture) without touching what the PGR families read; tests on a synthetic material, and a PGR material still parsing as before
- [x] 4.2 A new `DiffuseShadowMaterial` (its own file, design D6): the shadow texture where N·L is low and the diffuse where it is high, a soft edge, the shared light direction and intensity; wire it into `applyToon.ts` next to the PGR path
- [x] 4.3 The default outline for a mesh with no outline material (constant screen width, a darker shade of the surface), following the toon switch and hidden parts
- [x] 4.4 The script writes her material extras (`family: 'diffuseShadow'`, the shadow texture index); convert again and check the end result in the panel against the `toon-shading` scenarios

## 5. In the browser

- [x] 5.1 `pnpm build` and load `dist/chrome-mv3`: Erza is first in the picker, her tile shows `ES`, the model loads, toon shading shows lit and shadow areas with a soft edge and an outline, the light slider swaps the sides, "Toon shading" off shows her own material
- [x] 5.2 Play every Board action of Shukra and of Pavo and the Fight clips on her, and look at each: record the ones that look wrong (arms across the body, a hand on the hip), and note the stiff skirt, hair and ribbons and the still face as the known limits they are
- [x] 5.3 Voice: a voiced Shukra and a voiced Pavo Board action on Erza play their own frame's line and subtitle; `Shukra · BoardAct1004` goes on in `Shukra · UiStand1` for its last 0.1 s
- [x] 5.4 Display: the Model popover lists Shukra and Pavo only, the Animations popover has their sections only, and a stored Display model of Erza opens on Shukra's Generic
- [x] 5.5 Measure and record in `AGENTS.md`: her default framing (crown and feet at 320 / 387 / 600 px) and whether `widthShare` 0.8 holds with her T-pose bounds, the feet offset of Shukra → Erza and Pavo → Erza (and the decision: a bound with its reason, or the ground correction of the design's Risks), her viewer statistics (textures, triangles, GPU memory), and the retarget time of the largest clips onto her (parse + decode + retarget under 70 ms)
- [x] 5.6 Switch between Erza and Shukra three times each and check the geometry and texture counts are the same the last time as the first

## 6. Project documents

- [x] 6.1 Update `AGENTS.md` (the Erza section with the source facts and spike findings, the conversion conventions, the sources-only frame, her shading, the sword, the feet decision, known limits; the layout and the list of changes), `DESIGN.md` (Frames: her list is lent clips only, no Display; Shading: her path) and `README.md` (Erza, the conversion command)
- [x] 6.2 Commit; `openspec validate add-erza-model --strict` passes
