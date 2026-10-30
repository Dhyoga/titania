## MODIFIED Requirements

### Requirement: Parts are the model's meshes grouped by name
The viewer SHALL list the meshes of the shown model, each labelled with its node name without the model prefix and grouped by the
model id in that prefix. The prefix SHALL be the identifier up to and including the first run of five or six digits
(`R3QuMd010011`, `R2QuMd010011`, `R3Bianka01001`), and the model id that run of digits. A mesh whose name has no such prefix SHALL be
listed under its full name in a group labelled `Other`. A mesh whose name is only a prefix SHALL NOT be listed. Groups SHALL be ordered by
model id with `Other` last, and meshes within a group by label with numbers compared by value. The list SHALL come from the model's own
node names and SHALL NOT be hard-coded.

#### Scenario: Shukra's Generic
- **WHEN** Shukra's Generic is shown
- **THEN** its ten meshes are listed in one group `010011`: `Alpha`, `Body`, `Down`, `Eye`, `Face`, `Hair01`, `Hair02`, `Huangyu`, `Upper`, `Weapon`

#### Scenario: Pavo's Generic
- **WHEN** Pavo's Generic is shown
- **THEN** its eight meshes are listed in one group `010011`: `Bead`, `Body`, `Cloth`, `Eye`, `Face`, `Hair01`, `Hair02`, `Head`

#### Scenario: Five-digit ids and no prefix
- **WHEN** the grouping is given the names `R3Bianka01001Eye` and `Cheek` (unit test)
- **THEN** `Eye` is listed under `01001` and `Cheek` under `Other`

### Requirement: Parts popover
The stage menu's puzzle button SHALL open a popover titled Parts with two sections:
- "Hidden by this animation", shown only when the animation data hides meshes in the current state: one switch per such mesh (off unless
  the user switched it on), in node order. The list SHALL follow the clip, the context, the voice idle tail and the skin.
- "All meshes": every other listed mesh, grouped by model id (see "Parts are the model's meshes grouped by name"). Each group SHALL have a
  switch with the number of its meshes shown out of its total (`9/10`) and a chevron that folds and unfolds its list (all unfolded
  when the popover opens), and inside one switch per mesh labelled with its name without the model prefix.
A switch SHALL show whether the mesh is shown now: the user's choice if there is one, else what is saved for the skin, else the animation
data's. The popover SHALL have a "Reset" button and a "Save" button, both disabled while there is no unsaved choice (one that differs from
what is saved for the skin, or, when nothing is saved, from the animation data), and, while something is saved for the skin, a "Forget
saved" button. "Reset" SHALL drop the unsaved choices; "Save" SHALL keep the shown state for the skin (see `user-preferences`); "Forget
saved" SHALL remove what is saved for the skin and return it to the animation data. The list SHALL scroll inside the popover when it is
taller than the panel allows. The puzzle button SHALL be shown pressed while the popover is open and SHALL be disabled when fewer than two
meshes are listed or no model is shown. The popover SHALL follow the popover rules of the stage menu (one at a time, closes on outside
press and `Esc`, fits at 320 px).

#### Scenario: Open the popover
- **WHEN** the puzzle button is pressed on Shukra's Generic while `UiStand1` plays
- **THEN** there is no "Hidden by this animation" section (her manifest hides nothing), "All meshes" lists the group `010011` at `10/10` with every switch on, and Reset is disabled

#### Scenario: Save
- **WHEN** `Weapon` is switched off on Shukra and "Save" is pressed
- **THEN** "Save" and "Reset" become disabled, "Forget saved" shows, and the weapon stays off

#### Scenario: Reset returns to what is saved
- **WHEN** `Weapon` was saved off on Shukra, `Hair01` is then switched off and "Reset" is pressed
- **THEN** `Hair01` is shown again and `Weapon` stays off

#### Scenario: Forget saved
- **WHEN** "Forget saved" is pressed on Shukra with `Weapon` saved off
- **THEN** the weapon is shown again, as the animation data says, and "Forget saved" disappears

### Requirement: A hidden part is invisible in every state
Switching a mesh off SHALL make it invisible at once and keep it invisible while the animation changes which meshes it shows (clips,
Menu and Fight, a Board action's mesh swap, the voice idle tail). Switching on a mesh the animation data hides SHALL make it visible in
every state as well; the doubled surfaces that may come with it are the user's choice. A mesh without a choice SHALL follow the animation
data. Switching a group off SHALL hide every mesh of that model id, the ones the current state hides included, so a later mesh swap cannot
bring any of them back; switching a group on when some of its meshes are hidden SHALL drop the choices for that group and show every mesh
the group lists. Choices SHALL NOT change the default framing of the camera.

#### Scenario: Hide one mesh
- **WHEN** `Hair01` is switched off on Shukra's Generic
- **THEN** that mesh is invisible and every other mesh is as before

#### Scenario: Group off across clips
- **WHEN** the group `010011` is switched off on Pavo and `BoardAct0201` is then selected
- **THEN** no mesh of Pavo is visible during the clip

#### Scenario: Framing is unchanged
- **WHEN** `Hair01` is switched off and the camera is reset
- **THEN** the camera returns to the same default framing as without choices

### Requirement: Hidden parts are kept
The user's unsaved choices SHALL be kept by node name across clips, contexts, skins and frames: a model with a mesh of that name SHALL show the
choice, and a model without one SHALL be unaffected, with the choice kept for the next model that has it. What is saved for a skin SHALL
apply whenever that skin is shown, under the unsaved choices. "Reset" SHALL drop every unsaved choice, including names the shown model does
not have, which returns every mesh to what is saved for the skin, else to the animation data. The panel SHALL open without unsaved choices.

#### Scenario: Across clips and contexts
- **WHEN** `Hair01` is switched off on Shukra and the Fight context is chosen, then `Run`
- **THEN** the hair stays invisible and its switch is off

#### Scenario: Model without the mesh
- **WHEN** `Weapon` is switched off on Shukra and Pavo (which has no mesh of that node name) is chosen, then Shukra again
- **THEN** Pavo is unaffected, and Shukra shows the weapon off

#### Scenario: Reopen
- **WHEN** meshes were switched off without saving and the panel is closed and opened again
- **THEN** there are no unsaved choices and every mesh is as saved for the skin, else as the animation data says

#### Scenario: Saved for one skin only
- **WHEN** `Weapon` is saved off on Shukra and Pavo is then shown
- **THEN** Pavo's meshes are as its own saved choices, else the animation data, say

## REMOVED Requirements

### Requirement: Crepuscule's Generic skins open in their Light form
**Reason**: Specific to Crepuscule's models (their `LightDisable` object tags); no model of this project has a Light and Dark form.
**Migration**: None. The construct config's default-form setting and its code are removed; a model's meshes follow the animation data,
the saved choices and the user's choices.
