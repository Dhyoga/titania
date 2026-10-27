## MODIFIED Requirements

### Requirement: Other frames are animation sources
For the shown model, every frame in the frame list other than the shown one SHALL be an animation source: on Shukra, Pavo; on Pavo,
Shukra. A source's clips SHALL be those of its Generic clip set (`anim/`). A frame MAY name in its construct configuration extra clips
from another of its clip sets, or clips that it lends from another clip set in place of its Generic ones; Shukra and Pavo name none. A
source clip SHALL belong to the Menu context when the source's menu controller lists it (or it is the source's menu idle clip) and to the
Fight context when the source's fight controllers list it, and SHALL be cut down by the same rules as the shown frame's own list.

#### Scenario: Sources for Shukra
- **WHEN** Shukra is shown in the Menu context
- **THEN** the list offers Pavo's `StandAct0101`, `UiStand1` and ten Board actions

#### Scenario: Pavo's fight clips on Shukra
- **WHEN** Shukra is shown in the Fight context
- **THEN** the list offers Pavo's `LevelAttack14` and `Executioner01` … `Executioner05`, which Shukra's own list lacks

### Requirement: Retargeted clips drive the shown model's matching bones
A source clip SHALL be played on the shown model by mapping each of its tracks to the shown model's node with the same name, for
bones named `Bip001…` (names unique in every model). Since the rigs differ in hierarchy (clavicles under `Spine2` on Shukra and under `Neck`
on Pavo, thighs under `Pelvis` on Shukra and under `Spine` on Pavo, and possibly a node above `Bip001`), rotations SHALL be carried over in
world space: a matched bone SHALL get the source bone's world rotation corrected by the two rest poses so that it points at its main
child joint where the source bone points (`W_target = W_source · W_source_rest⁻¹ · A · W_target_rest`, `A` turning the target's rest
direction into the source's; for the hand also its palm), expressed in the target parent's frame; bones without a main child use `A` =
identity. The position track of `Bip001` SHALL be carried over as its offset from the source's rest position, scaled by the ratio of the
target's to the source's rest pelvis height and expressed in the target's parent frame; other position and scale tracks SHALL NOT be
carried over. Weapon props (`Bip001Prop…`) SHALL NOT be copied from the source (the frames hold different weapons): a target prop that
sits on a hand at rest SHALL stay held by that hand with its rest offset, and any other prop SHALL stay at rest. Morph weight tracks SHALL
be mapped to the target mesh of the same role (`Face`, `Eye`) and the morph target with the same name; a weight without a same-named
target SHALL be dropped. A hand that rests on the hip in the source (outward 7 to 21 cm from the pelvis–spine axis, near the hip's height
and not far in front) SHALL rest at the same place of the target's body: the target's upper arm and forearm SHALL be solved so the hand
is at the source's coordinates in the body frame (outward, along the pelvis–spine axis, forward) scaled by the ratio of the rigs' pelvis
heights, fading with the hand's distance from that zone, by at most 10 cm. Source tracks for bones the target lacks SHALL be dropped, and
target bones the source does not animate (helper, twist, hair, cloth and spring bones) SHALL hold the mean pose of the shown model's own
idle clip for the context (`UiStand1` in Menu, the fight idle in Fight) over its keys, so clothing that hangs from helper bones moves with
the body. The data in `data/` SHALL NOT be changed.

#### Scenario: Board action from Pavo on Shukra
- **WHEN** Shukra's Generic is shown and `Pavo · BoardAct0201` is selected
- **THEN** Shukra performs Pavo's `BoardAct0201` upright, facing the camera, feet on the floor, with Pavo's facial expressions wherever Shukra's `Face` and `Eye` meshes have morph targets of the same name

#### Scenario: Different pelvis height
- **WHEN** Pavo's `Run` plays on Shukra (rest pelvis 0.968 m on Pavo, 0.959 m on Shukra)
- **THEN** Shukra's pelvis follows the run scaled to her height and her feet neither sink into nor float above the floor by more than 2 cm

#### Scenario: Props are not copied
- **WHEN** a Pavo clip plays on Shukra
- **THEN** Shukra's `Bip001Prop1` and `Bip001Prop2` do not follow Pavo's prop tracks: a prop that sits on a hand at rest stays in that hand for the whole clip, and any other stays at rest

#### Scenario: Bone missing on the target
- **WHEN** a Pavo clip animates a `Bip001…` bone that Shukra's model lacks (Pavo has 64 `Bip001…` bones, Shukra 55)
- **THEN** that track is dropped and the clip plays without an error

#### Scenario: A hand on the hip stays on the hip
- **WHEN** a clip whose hand rests on the hip (found and recorded in `AGENTS.md` during this change) plays on the other frame
- **THEN** the hand is within 1 cm of where it is in the source's body frame (outward from the body's axis, along it, forward)

#### Scenario: A hand away from the hip is not moved
- **WHEN** a clip holds the hand out to the side, 40 cm or more from the body's axis, and plays on another frame
- **THEN** the arm is exactly what the direction method gives

#### Scenario: Clothing follows the body
- **WHEN** Shukra's Generic is shown and `Pavo · BoardAct1002` plays, paused at 2, 4 and 6 s
- **THEN** Shukra's helper and cloth bones hold the mean pose of Shukra's own `UiStand1`, not the bind pose, and no skirt or coat panel is left behind the body

### Requirement: Retargeting is accurate against the source model
Retargeting SHALL keep every main limb bone within 15° of its direction on the source model, and within 5° on average. For each
source and target frame, at sampled keys of `UiStand1`, `BoardAct0201` and `Run`, the world direction of each main limb bone
(`Bip001` spine, neck, head, clavicles, upper arms, forearms, hands, thighs, calves, feet) after retargeting is compared with the
same bone's direction when the source frame's own model plays the clip.
A Node test SHALL check this with forward kinematics on the models' rest poses and the decoded clips, skipped when `data/` is absent.

#### Scenario: Accuracy test
- **WHEN** `pnpm test` runs with `data/` present
- **THEN** the retarget accuracy test passes from Shukra to Pavo and from Pavo to Shukra

### Requirement: Retargeted Board actions play with their own frame's voice
A retargeted clip SHALL be paired with a voice line through its source frame's `voices.json` and play it from the source frame's
`voices_ja/`, with the same timeline, master-clock, subtitle and silent-fallback behaviour as a native Board action. When the line is
longer than the clip, the idle tail SHALL be the shown model's own menu idle clip.

#### Scenario: Pavo's line on Shukra
- **WHEN** a paired `Pavo · BoardAct…` is selected on Shukra
- **THEN** Pavo's paired line plays from `pavo/voices_ja/` with Pavo's subtitle, and if the line is longer than the clip, Shukra's `UiStand1` takes over after the clip ends until the line ends

#### Scenario: Source without a line
- **WHEN** a Pavo Board action without a pairing is selected on Shukra
- **THEN** it plays silently for its own duration without a speaker glyph or error

### Requirement: Visibility follows the shown skin by clip name
While a retargeted clip plays, the hidden nodes SHALL be those the shown skin's manifest gives for a clip of the same name in the
current context (`stateHides[<name>]` in Menu when present, otherwise the context's `hiddenNodes`), with the user's mesh choices on top.

#### Scenario: Nothing hidden on Shukra
- **WHEN** `Pavo · BoardAct1003` plays on Shukra's Generic
- **THEN** every mesh of Shukra is shown (her manifest hides none), except those the user switched off

### Requirement: Switching keeps the source
After a skin or frame switch, a selected source clip SHALL be selected again by source frame and name on the new model, retargeted
to it. When the new frame is the clip's source frame, its own clip of that name SHALL be selected instead. If the clip is not
available, the context's default clip SHALL play.

#### Scenario: Switch to the source frame
- **WHEN** `Pavo · Walk` plays on Shukra and the frame picker switches to Pavo
- **THEN** Pavo's own `Walk` plays

#### Scenario: Switch away from the source frame
- **WHEN** Pavo's own `Executioner01` plays and the frame picker switches to Shukra
- **THEN** `Pavo · Executioner01` plays on Shukra, retargeted

### Requirement: Retargeting cost stays within the existing budget
Loading, decoding and retargeting a source clip SHALL block the main thread for less than 50 ms for every source clip (the line at
which decoding would move to a worker), and a source clip's rig description SHALL be read from the JSON chunk of the model its clip
set's manifest names as `target` (the Generic model for `anim/`) without downloading the rest of the file. Retargeted clips SHALL be
cached in the existing clip cache under keys that include the source frame, the clip and the shown skin, and SHALL be released when the
model is released.

#### Scenario: Largest source clip
- **WHEN** Shukra's longest Board action (`BoardAct1004`, 41.8 s) is retargeted onto Pavo in headless Chromium
- **THEN** parse, decode and retarget together take under 50 ms

#### Scenario: Reselect
- **WHEN** `Pavo · BoardAct1004` is selected on Shukra, then `UiStand1`, then `Pavo · BoardAct1004` again
- **THEN** the clip file is fetched and retargeted once
