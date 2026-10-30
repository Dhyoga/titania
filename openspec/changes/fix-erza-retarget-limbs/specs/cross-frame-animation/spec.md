## MODIFIED Requirements

### Requirement: Retargeted clips drive the shown model's matching bones
A source clip SHALL be played on the shown model by mapping each of its tracks to the shown model's node with the same name, for
bones named `Bip001…` (names unique in every model). Since the rigs differ in hierarchy (clavicles under `Spine2` on Shukra and under `Neck`
on Pavo, thighs under `Pelvis` on Shukra and under `Spine` on Pavo, and possibly a node above `Bip001`), rotations SHALL be carried over in
world space: a matched bone SHALL get the source bone's world rotation corrected by the two rest poses so that it points at its main
child joint where the source bone points (`W_target = W_source · W_source_rest⁻¹ · A · W_target_rest`, `A` turning the target's rest
direction into the source's; for the hand also its palm), expressed in the target parent's frame; bones without a main child, and the feet,
use `A` = identity, so a foot takes the source foot's change of world rotation from its rest pose and a foot planted flat on the source is flat
on the target. The position track of `Bip001` SHALL be carried over as its offset from the source's rest position, scaled by the ratio of the
target's to the source's rest pelvis height and expressed in the target's parent frame; other position and scale tracks SHALL NOT be
carried over. Weapon props (`Bip001Prop…`) SHALL NOT be copied from the source (the frames hold different weapons): a target prop that
sits on a hand at rest SHALL stay held by that hand with its rest offset, and any other prop SHALL stay at rest. Morph weight tracks SHALL
be mapped to the target mesh of the same role (`Face`, `Eye`) and the morph target with the same name; a weight without a same-named
target SHALL be dropped. A hand that rests on the hip in the source (outward 7 to 21 cm from the pelvis–spine axis, near the hip's height
and not far in front) SHALL rest at the same place of the target's body: the target's upper arm and forearm SHALL be solved so the hand
is at the source's coordinates in the body frame (outward, along the pelvis–spine axis, forward) scaled by the ratio of the rigs' pelvis
heights, fading with the hand's distance from that zone, by at most 10 cm. Source tracks for bones the target lacks SHALL be dropped. A target twist bone
the source has no bone of the same name for (`Bip001LCalfTwist` and `Bip001RCalfTwist`, `Bip001LThighTwist` and `Bip001RThighTwist`) SHALL follow the
target's matched bone it belongs to (the calf, the thigh): its world rotation is that bone's, kept at its own rest offset from it, so a bent knee bends the
twist bone with it; a source that has the twist bone drives it. Other target bones the source does not animate (helper, hair, cloth and spring bones) SHALL hold the mean pose of the shown model's own
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

#### Scenario: A twist bone follows its calf
- **WHEN** a clip with a strongly bent knee (Pavo's `Executioner01`) is retargeted onto a model that has `Bip001LCalfTwist` where the source has none (Erza)
- **THEN** that twist bone's world rotation changes with the calf's from their rest poses, no track is written for any node that is not named `Bip001…`, and the boots show no stretched geometry

#### Scenario: A twist bone the source drives is not followed
- **WHEN** Pavo's `Run` is retargeted onto Erza, whose `Bip001LThighTwist` Pavo also has
- **THEN** her `Bip001LThighTwist` is driven from Pavo's own track, and from the thigh only when the source is Shukra, which has none

#### Scenario: A flat foot stays flat
- **WHEN** a clip in which the source's foot rests flat on the floor plays on another frame
- **THEN** the target's foot has the same change of world rotation from its rest pose as the source's, and its lowest foot point is within 2 cm of the source's relative to each rest pose between Shukra and Pavo (the bound for Erza is measured and recorded in `AGENTS.md`)

### Requirement: Retargeting is accurate against the source model
Retargeting SHALL keep every main limb bone within 15° of its direction on the source model, and within 5° on average. For each
source and target frame, at sampled keys of `UiStand1`, `BoardAct0201` and `Run`, the world direction of each main limb bone
(`Bip001` spine, neck, clavicles, upper arms, forearms, hands, thighs, calves) after retargeting is compared with the
same bone's direction when the source frame's own model plays the clip. The head and the feet, which keep the source's change of world rotation rather than a direction,
are compared by that change from their rest poses.
A Node test SHALL check this with forward kinematics on the models' rest poses and the decoded clips, skipped when `data/` is absent.

#### Scenario: Foot pitch
- **WHEN** the accuracy test samples a foot after retargeting
- **THEN** its change of world rotation from rest equals the source foot's within 1°, and its direction toward the toe is not compared

#### Scenario: Accuracy test
- **WHEN** `pnpm test` runs with `data/` present
- **THEN** the retarget accuracy test passes from Shukra to Pavo and from Pavo to Shukra
