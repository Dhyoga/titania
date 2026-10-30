## Context

`lib/anim/retarget.ts` carries a clip from one rig onto another by world-space direction matching (see `AGENTS.md`, "Retargeting"): per matched `Bip001…` bone,
`W_t = W_s · W_s_rest⁻¹ · A · W_t_rest`, where `A` turns the target's rest direction toward its main child joint (`mainChild`) into the source's, and is identity for
bones with no main child (head, toes, finger tips, props). Only bones with the same name in both rigs are matched (`matchBones`); every other node holds its bind pose or,
when a fill clip is given, the shown model's idle mean. `add-erza-model` put a third rig into this: Erza has `Bip001LCalfTwist`/`RCalfTwist` (neither source has them),
`Bip001LThighTwist`/`RThighTwist` (Pavo has them, Shukra does not) and a foot bone 0.213 m long against Shukra's 0.132 m.

What was measured on a scratch copy of `retarget.ts` (not in the repository) while preparing this change, onto the lowest foot point relative to each rest pose:

| pair, clip | now | foot `A` = identity | and pelvis scaled by the leg-length ratio |
|---|---|---|---|
| Shukra → Pavo, `UiStand1` / `Run` | −2.7 / −2.7 cm | −1.9 / −1.9 | −1.9 / −1.8 |
| Pavo → Shukra | 1.0 / 0.9 | 0.3 / 0.1 | 0.3 / −0.0 |
| Shukra → Erza | −8.0 / −8.0 | −3.0 / −6.0 | −2.9 / −5.6 |
| Pavo → Erza | −4.5 / −10.0 | −0.7 / −7.3 | −0.7 / −7.0 |

## Goals / Non-Goals

**Goals:**

- No stretched geometry at Erza's boots in any clip she is offered, with Qu's pairs unchanged where they have no such bones.
- A foot planted flat on the source is flat on the target; the feet bounds fall to what the foot's length leaves, and are recorded with that reason.
- Qu's pairs keep every accuracy bound they meet today, and the Shukra → Pavo feet figure comes under the 2 cm the spec states.

**Non-Goals:**

- Foot placement against the ground (planting, IK, a per-key ground correction): the residual in `Run` onto Erza is the foot bone's length (her toe goes lower than the
  scaled source toe in a push-off), and fixing it needs contact detection. It stays a recorded limit.
- Any other twist, helper, skirt, hair or ribbon bone, and the fill-pose mechanism: the follow rule is for the four named twist bones only.
- The contact planner (`contact.ts`) and the hand alignment.

## Decisions

### D1. The foot gets `A` = identity, by name

In the loop that builds `correction`, a target bone named `Bip001LFoot` or `Bip001RFoot` skips `mainChild` and keeps `A` = identity, exactly as the head does. `mainChild` itself
stays as it is (`Foot → Toe0`), because its unit test and the accuracy test read it. The foot's world rotation then follows the source foot's rotation change, so the sole's pitch
against the floor is whatever the rest pose has when the source foot is flat.

*Alternatives:* a per-pair pitch correction measured from the rest poses (more code, same result for flat feet); leaving direction matching and bounding the feet (what
`add-erza-model` did: 4.5 to 10 cm, and the boots dip under the floor); an ankle IK to the source's floor contact (the real fix, but contact detection is a change of its own).

### D2. Twist bones follow their main bone through a table, not a heuristic

A small table maps the four target names to the bone they follow (`Bip001LCalfTwist → Bip001LCalf`, `…RCalfTwist → …RCalf`, `…LThighTwist → …LThigh`,
`…RThighTwist → …RThigh`). For each entry the rule applies when the target has both bones, the source has the main bone and does not have the twist bone. The twist's
world rotation per key is `W_main_target · W_main_target_rest⁻¹ · W_twist_target_rest` (its own rest offset from the main bone, so Erza's 2° of rest roll is kept), written
as a local `quaternion` track in the twist bone's parent frame like any other matched bone. They are processed after the matched bones (the main bone's world rotation is
needed), and they appear in the output as ordinary `Bip001…` tracks.

A table keeps the rule exact and testable: a name pattern such as `…Twist` would give a rule to any future rig's twist bones that nobody checked. `ForeTwist` and
`UpArmTwist` are left out on purpose: only Pavo has them, so no target in the frame list has them while its source lacks them.

*Alternatives:* copy the main bone's local rotation (right for these siblings, wrong for `ThighTwist`, which is a child of `Spine`, so it is not done); give the fill clip
an idle for Erza (she has none, and a mean pose would not move with the knee); drop the twist bones' skin weights in the converter (changes her model and loses the twist for
Pavo's `ThighTwist` clips).

### D3. The foot leaves the direction measure, and enters the head's

`tests/retarget.test.ts` compares each main bone's direction toward its main child, except the head by its change of world rotation from rest. The foot moves to the head's
branch: with `A` = identity its change of world rotation equals the source's exactly (a numerical identity, so the test bound for it is 1°, not 15°). This is a statement about
the method, so the spec says so (the delta to "Retargeting is accurate against the source model"); every other bone keeps 15° and 5°. The palm check is unchanged.

### D4. Re-measure, then set the bounds from the measurement

The feet test keeps one bound per pair and the reason beside it. The figures in the context table are the expectation, not the bounds: the first task re-measures on the
real change and the bounds are set from those, rounded up by 0.5 cm, as `add-erza-model` did. The spec's own sentence (2 cm between Qu's frames, the recorded bound for Erza)
needs no number from this change.

### D5. The pelvis scaling stays as it is

A leg-length ratio (pelvis height above the lowest rest foot point, instead of above y = 0) was tried and moved Erza's feet by under 0.4 cm, because her leg ratio (1.119) is
close to her pelvis ratio (1.158). It is not adopted.

## Risks / Trade-offs

- **[A flat foot is not flat on a model whose rest foot is not flat]** → `A` = identity is right only if the rest sole is horizontal on both rigs. Checked by the rest-pose
  figures in the first task (Shukra's toes touch the floor, Pavo's are 1.0 cm above it, Erza's 3.7 cm: all three stand on their feet at rest); a rig with heels at rest would
  carry its heel pitch to a flat-booted model, which is what a rest-relative rule does and what is wanted here.
- **[Qu's pairs change on screen]** → a few degrees at the feet in clips that stand on tiptoe in the source; the accuracy test and the feet bounds guard the numbers, and the
  user plays the Board actions of each frame on the other once more (task 4.2). No clip is excluded.
- **[The residual in `Run` onto Erza stays at 6 to 7 cm]** → recorded in `AGENTS.md` with its cause (her foot bone is 1.6 times Shukra's length, her legs 1.1 times), as a limit; a
  floor-contact change would be the next step.
- **[The twist rule hides a missing source bone]** → it only fills bones the source lacks, and a test checks that a source that has the bone drives it.
- **[Order of archive]** → the delta is written against the specs after `bootstrap-titania` and `add-erza-model`, so those are archived first; the change was validated
  against both states.

## Open Questions

- None that change what is built. Whether the remaining 6 to 7 cm in `Run` onto Erza is worth a floor-contact change is decided after looking at it in the panel (task 4.1).
