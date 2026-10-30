## Why

`add-erza-model` showed two retargeting defects on Erza's legs that Qu's own pairs hide (both are recorded in `AGENTS.md`, "Erza"). In strong knee
bends (Pavo's `Executioner01`–`05`, Shukra's `BoardAct1004` and `Run`) **black strips stretch off her boots**: her `Bip001LCalfTwist` and `Bip001RCalfTwist`
are children of the thigh, neither source has a bone of that name, so they get no track and stay straight while the calf bends, and the ankle vertices
that carry their weight are pulled toward them (a render with the twist bone given the calf's rotation removes the strips). And her **feet sink**: the
lowest foot point sits 4.5 to 10.4 cm below where the source puts its own (Shukra → Erza 5.9 to 8.0 cm, Pavo → Erza 4.5 to 10.0 cm), because direction
matching turns her longer foot bone (0.213 m) to Shukra's steep foot direction, which her flat boot never has. Shukra → Pavo already shows the same effect
at 2.7 cm, over the 2 cm the spec states.

## What Changes

- **A target bone the source lacks follows its parent-chain partner** (new rule in `lib/anim/retarget.ts`): `Bip001{L,R}CalfTwist` takes the retargeted world
  rotation of `Bip001{L,R}Calf`, and `Bip001{L,R}ThighTwist` that of `Bip001{L,R}Thigh`, each keeping its own rest offset from that bone
  (`W_twist = W_main · W_main_rest⁻¹ · W_twist_rest`). It applies only when the source has no bone of the twist's name (Pavo drives `ThighTwist` itself), writes
  `Bip001…` tracks only, and changes nothing for a pair whose target has no such bone.
- **The foot keeps its rest-relative pitch**: `Bip001{L,R}Foot` is aligned like the head and the toes (`A` = identity: it takes the source foot's change of
  world rotation from its rest pose), instead of pointing at `Bip001…Toe0` where the source's foot points. A source foot planted flat gives a flat foot on the
  target. Measured on a scratch copy of `retarget.ts` before this proposal: Shukra → Erza `UiStand1` −8.0 → −3.0 cm and `Run` −8.0 → −6.0 cm, Pavo → Erza −4.5 → −0.7
  and −10.0 → −7.3 cm, Shukra → Pavo −2.7 → −1.9 cm, Pavo → Shukra 1.0 → 0.3 cm.
- **The feet bounds are re-measured and tightened**: `FEET_TOLERANCE` in `tests/retarget.test.ts` (now 0.02 / 0.03 / 0.09 / 0.11) is set from the new
  figures, with the reason for what is left (the foot bone's length: her toe dips below where Shukra's would in a push-off), and `AGENTS.md` is updated.
- **The accuracy measure changes for the foot**: its direction toward the toe is no longer compared with the source's (it differs by design, up to about 27°
  between rest poses); like the head it is compared by its change of world rotation from rest, which this alignment keeps exactly. The 15° per bone, 5° mean and 5° palm
  bounds stay for every other bone.
- **Not changed**: the pelvis scaling (a leg-length ratio instead of the pelvis ratio was tried on the scratch copy and changed Erza by under 0.4 cm), the
  stiff skirt, hair and ribbons, her face, the sword, the contact planner, and the port of what PGR has added since `baeda85`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cross-frame-animation`: "Retargeted clips drive the shown model's matching bones" gains the follow rule for twist bones the source lacks and the foot's rest-relative
  alignment (and its feet scenario names the bound that holds on every pair); "Retargeting is accurate against the source model" compares the foot by its change of world
  rotation.

## Impact

- Code: `lib/anim/retarget.ts` (the per-bone alignment and the matched-bone pairs; `contact.ts` is not touched), `tests/retarget.test.ts` (the feet bounds, the accuracy
  measure for the foot, a follow-rule test on synthetic rigs and on Erza), `AGENTS.md` ("Erza" feet and known limits, "Retargeting" accuracy and feet figures).
- **Touches Qu's pairs** (Shukra ↔ Pavo): their limb accuracy, feet and clips on screen change slightly; their tests must keep passing and the user plays Board actions of
  each frame on the other once more.
- Order: written against the specs as `bootstrap-titania` and `add-erza-model` leave them, so those two are archived first (checked in a temporary copy that they
  archive cleanly). No new dependency, no change under `data/`.
