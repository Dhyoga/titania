## 1. Measure first

- [x] 1.1 Re-measure on a scratch copy of the test setup (not committed) the lowest-foot-point offsets and the foot's rest-pose facts for Shukra ↔ Pavo and Shukra/Pavo → Erza with D1 applied, and confirm the figures of the design's table (and that the three rest soles are flat on the floor); stop and revise `design.md` if they differ materially
- [x] 1.2 Render Pavo's `Executioner01` at 30 % and Shukra's `BoardAct1004` onto Erza before the change, with the scratch viewer or the panel, as the "before" images for 4.1

## 2. The two rules in `retarget.ts`

- [x] 2.1 Foot alignment (design D1): `Bip001LFoot` and `Bip001RFoot` keep `A` = identity in `correction`; `mainChild` and the contact planner are untouched; the header comment of `retarget.ts` says so
- [x] 2.2 Twist follow (design D2): a table of the four twist bones and the bone each follows; after the matched bones, each entry present on the target, with its main bone matched and no source bone of the twist's name, gets `W_main · W_main_rest⁻¹ · W_twist_rest` as a local `quaternion` track in its parent's frame, with the hemisphere kept; output stays `Bip001…` tracks only
- [x] 2.3 Synthetic tests in `tests/retarget.test.ts`: a rig with a twist bone the source lacks follows the main bone through a bent knee and keeps its rest offset; a source that has the twist bone drives it and the rule does not apply; a target without the twist bone gets no extra track; a foot takes the source's change of world rotation exactly

## 3. Tests and bounds on the real data

- [x] 3.1 Accuracy test: move the foot from the direction measure to the head's change-of-rotation measure with a 1° bound, keep 15° / 5° / 5° for everything else, for Shukra ↔ Pavo and onto Erza (D3)
- [x] 3.2 Real-data tests: onto Erza, Shukra's and Pavo's `UiStand1`, `BoardAct0201` and `Run` give a track for each of her four twist bones where the source lacks them, and none for any non-`Bip001…` node; Pavo → Erza drives `LThighTwist` from Pavo's own track
- [x] 3.3 Set `FEET_TOLERANCE` from the re-measured figures (D4) with the reason beside it: 2 cm for Shukra ↔ Pavo (stated by the spec), the measured values rounded up by 0.5 cm onto Erza; `pnpm compile` and `pnpm test` pass

## 4. In the panel

- [x] 4.1 `pnpm build`, load the build, and play on Erza every clip that showed strips (Pavo's `Executioner01` to `05`, Shukra's `BoardAct1004` and `Run`) at two moments each: no stretched boots; look at the "after" frames against 1.2, and at her feet in `UiStand1` and `Run` to decide whether the remaining 6 to 7 cm needs a floor-contact change (not part of this one)
- [x] 4.2 Play every Board action of Shukra on Pavo and of Pavo on Shukra, and Run, `Walk` and the kicks of Pavo on Shukra, and look at each: their feet and clothing are as before or better; record anything that is not

## 5. Documents

- [x] 5.1 Update `AGENTS.md`: "Erza" (the feet decision and figures, the calf-twist defect now fixed, the residual and its cause), "Retargeting" (accuracy and feet figures, the foot's alignment and the twist rule, the Shukra → Pavo foot figure), "Possible later changes" (drop the two items this change does; add floor contact if 4.1 says so); check `DESIGN.md` ("How a borrowed clip looks") still reads true
- [x] 5.2 `openspec validate fix-erza-retarget-limbs --strict` passes against the specs now and after `bootstrap-titania` and `add-erza-model` are archived (a temporary copy is enough); commit

## Workflow follow-up

- Archive order: `bootstrap-titania`, `add-erza-model`, then this change.
