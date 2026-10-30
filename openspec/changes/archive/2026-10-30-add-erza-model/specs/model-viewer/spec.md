## ADDED Requirements

### Requirement: Erza is framed from her body
The default framing of Erza SHALL be computed from her body's visible meshes, as for every model: her height fits the canvas with the usual margin, limited by her
width where the panel is narrow, and no prop far from her body is included. Her bind pose is a T-pose, so the width limit SHALL be checked against the clips that play
on her; the figures measured for her are recorded in `AGENTS.md`, not here.

#### Scenario: Tall panel
- **WHEN** Erza is shown at 387 × 1045 px with no camera saved
- **THEN** her head and feet are inside the canvas with room above and below, and she is centred

#### Scenario: Wide panel
- **WHEN** Erza is shown at 600 × 800 px
- **THEN** the height decides the framing and her whole body is in view

#### Scenario: Narrow panel
- **WHEN** Erza is shown at 320 px wide while `Shukra · BoardAct0201` plays
- **THEN** her head is in view and her arms do not leave the canvas by more than the zoom-out the user can make (the same cost accepted for Qu's frames)
