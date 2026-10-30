# cross-frame-animation Specification

## Purpose
Playing the clips and voice lines of Bianca's other frames on the shown model: which frames lend clips, retargeting by `Bip001` bone name (world-space direction matching, weapons kept in the hands, face morphs by name), its measured accuracy, the voice line and visibility of a lent clip, what skin and frame switches keep, and the cost budget. (Purpose TBD, synced from change add-cross-frame-animation.)
## Requirements
### Requirement: Other frames are animation sources
For the shown model, every frame in the frame list other than the shown one SHALL be an animation source. A source's clips SHALL be
those of its Generic clip set (`anim/`), plus, for Stigmata, the Board actions `BoardAct10021` and `BoardAct10022` from skin
`r4biankamd019241`'s clip set (Solitary Dream). A frame MAY lend a named clip from another of its clip sets in place of its Generic one:
Veritas SHALL lend `BoardAct1005` from Ink-lit Hermit's clip set (`r3biankamd019141`), keeping its place, label and voice line in the
list; Veritas' own skins SHALL keep playing their own clips. A source clip SHALL belong to the Menu context when the source's menu controller lists it
(or it is the source's menu idle clip) and to the Fight context when the source's fight controllers list it, and SHALL be cut down by the
same rules as the shown frame's own list. The shown frame's own added extra clips (Solitary Dream's two Board actions) SHALL also join its own
list, labelled with the skin they come from, on its skins whose clip set lacks them, retargeted like a source clip.

### Requirement: Retargeted clips drive the shown model's matching bones
A source clip SHALL be played on the shown model by mapping each of its tracks to the shown model's node with the same name, for
bones named `Bip001…` (names unique in every model). Since the rigs differ in hierarchy (Crepuscule's extra `Root`, clavicles under
`Spine2` or `Neck`, thighs under `Pelvis` or `Spine`), rotations SHALL be carried over in world space: a matched bone SHALL get the
source bone's world rotation corrected by the two rest poses so that it points at its main child joint where the source bone points
(`W_target = W_source · W_source_rest⁻¹ · A · W_target_rest`, `A` turning the target's rest direction into the source's; for the hand
also its palm), expressed in the target parent's frame; bones without a main child use `A` = identity. The position track of `Bip001`
SHALL be carried over as its offset from the source's rest position, scaled by the ratio of the target's to the source's rest
pelvis height and expressed in the target's parent frame; other position and scale tracks SHALL NOT be carried over. Weapon props
(`Bip001Prop…`) SHALL NOT be copied from the source (the frames hold different weapons): a target prop that sits on a hand at rest
SHALL stay held by that hand with its rest offset, and any other prop SHALL stay at rest. Morph weight
tracks SHALL be mapped to the target mesh of the same role (`Face`, `Eye`) and the morph target with the same name; a weight without
a same-named target SHALL be dropped. A hand that rests on the hip in the source (outward 7 to 21 cm from the pelvis–spine axis, near the hip's height and not far in front) SHALL
rest at the same place of the target's body: the target's upper arm and forearm SHALL be solved so the hand is at the source's coordinates in
the body frame (outward, along the pelvis–spine axis, forward) scaled by the ratio of the rigs' pelvis heights, fading with the hand's
distance from that zone, by at most 10 cm. Source tracks for bones the target lacks SHALL be dropped, and target bones the source does
not animate (helper, twist, hair, cloth and spring bones) SHALL hold the mean pose of the shown model's own idle clip for the context
(`UiStand1` in Menu, the fight idle in Fight) over its keys, so clothing that hangs from helper bones moves with the body. The data in `data/` SHALL NOT be changed.

#### Scenario: Different pelvis height
- **WHEN** Veritas' `Run` plays on Crepuscule (pelvis 1.082 m on Veritas, 1.055 m on Crepuscule)
- **THEN** Crepuscule's pelvis follows the run scaled to her height and her feet neither sink into nor float above the floor by more than 2 cm

#### Scenario: Bone missing on the target
- **WHEN** a Veritas clip animates `Bip001LUpArmTwist`, which Crepuscule's model lacks
- **THEN** that track is dropped and the clip plays without an error

#### Scenario: A hand on the hip stays on the hip
- **WHEN** a clip whose hand rests on the hip (Veritas' `BoardAct1005`, hand-on-hip pose) plays on Crepuscule, Stigmata or Zero
- **THEN** the hand is within 1 cm of where it is in the source's body frame (outward from the body's axis, along it, forward), instead of 4 cm higher and in front (Crepuscule) or 3 cm inside the body (Zero)

#### Scenario: A hand away from the hip is not moved
- **WHEN** a clip holds the hand out to the side, 40 cm or more from the body's axis, and plays on another frame
- **THEN** the arm is exactly what the direction method gives

### Requirement: Retargeting is accurate against the source model
Retargeting SHALL keep every main limb bone within 15° of its direction on the source model, and within 5° on average. For each
source and target frame, at sampled keys of `UiStand1`, `BoardAct0201` and `Run`, the world direction of each main limb bone
(`Bip001` spine, neck, head, clavicles, upper arms, forearms, hands, thighs, calves, feet) after retargeting is compared with the
same bone's direction when the source frame's own model plays the clip.
A Node test SHALL check this with forward kinematics on the models' rest poses and the decoded clips, skipped when `data/` is absent.

#### Scenario: Accuracy test
- **WHEN** `pnpm test` runs with `data/` present
- **THEN** the retarget accuracy test passes for every pair of the four frames

### Requirement: Retargeted Board actions play with their own frame's voice
A retargeted clip SHALL be paired with a voice line through its source frame's `voices.json` and play it from the source frame's
`voices_ja/`, with the same timeline, master-clock, subtitle and silent-fallback behaviour as a native Board action. When the line is
longer than the clip, the idle tail SHALL be the shown model's own menu idle clip.

#### Scenario: Source without a line
- **WHEN** `Veritas · BoardAct0202` is selected (no line yet)
- **THEN** it plays silently for its own duration without a speaker glyph or error

### Requirement: Visibility follows the shown skin by clip name
While a retargeted clip plays, the hidden nodes SHALL be those the shown skin's manifest gives for a clip of the same name in the
current context (`stateHides[<name>]` in Menu when present, otherwise the context's `hiddenNodes`), with the user's mesh choices on top.

### Requirement: Switching keeps the source
After a skin or frame switch, a selected source clip SHALL be selected again by source frame and name on the new model, retargeted
to it. When the new frame is the clip's source frame, its own clip of that name SHALL be selected instead. If the clip is not
available, the context's default clip SHALL play.

#### Scenario: Switch to the source frame
- **WHEN** `Stigmata · Walk` plays on Crepuscule and the frame picker switches to Stigmata
- **THEN** Stigmata's own `Walk` plays

### Requirement: Retargeting cost stays within the existing budget
Loading, decoding and retargeting a source clip SHALL block the main thread for less than 50 ms for every source clip (the line at
which decoding would move to a worker), and a source clip's rig description SHALL be read from the JSON chunk of the model its clip
set's manifest names as `target` (the Generic model for `anim/`, Solitary Dream's for its two Board actions) without downloading the rest
of the file. Retargeted clips SHALL be cached in the existing clip cache under keys that include the source frame, the clip and the shown
skin, and SHALL be released when the model is released.

#### Scenario: Largest source clip
- **WHEN** Stigmata's longest Board action is retargeted onto Crepuscule in headless Chromium
- **THEN** parse, decode and retarget together take under 50 ms

#### Scenario: Reselect
- **WHEN** `Veritas · BoardAct1004` is selected, then `UiStand1`, then `Veritas · BoardAct1004` again
- **THEN** the clip file is fetched and retargeted once
