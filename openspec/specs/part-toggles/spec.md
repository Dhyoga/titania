# part-toggles Specification

## Purpose
Hiding parts of the shown skin: how the model's meshes are grouped into parts, the parts popover and its puzzle button, hiding on top of the animation data's visibility rules, what is kept across clips, contexts and skins, and the single-mesh chibi. (Purpose TBD, synced from change add-part-toggles.)

## Requirements

### Requirement: Parts are the model's meshes grouped by name
The viewer SHALL list the meshes of the shown model, each labelled with its node name without the model prefix and grouped by the
model id in that prefix. The prefix SHALL be the identifier up to and including the first run of five or six digits
(`R5BiankaMd019271`, `R3Bianka01001`, `R3Bianka019101`, `R2AolisuoMd019011`), and the model id that run of digits. A mesh whose name
has no such prefix (Zero's `Cheek`) SHALL be listed under its full name in a group labelled `Other`. A mesh whose name is only a
prefix (a dorm chibi's single mesh) SHALL NOT be listed. Groups SHALL be ordered by model id with `Other` last, and meshes within a
group by label with numbers compared by value. The list SHALL come from the model's own node names and SHALL NOT be hard-coded.

#### Scenario: Crepuscule Generic - Final
- **WHEN** Crepuscule's Generic - Final is shown
- **THEN** its meshes are grouped as `010011` (14 meshes) and `010031` (Down, Part, Upper)

#### Scenario: Five-digit ids and no prefix
- **WHEN** Zero's Generic is shown
- **THEN** `Eye`, `Face`, `Cloth01`, `Cloth02`, `Fur`, `Hair01` and `Hair02` are listed under `01001`, and `Cheek` under `Other`

#### Scenario: Chibi
- **WHEN** a dorm chibi is shown
- **THEN** at most one mesh is listed (none on Crepuscule's, Stigmata's and Zero's; Veritas' lists its `Sleeve`) and the parts button is disabled, since it needs at least two

### Requirement: Parts popover
The stage menu's puzzle button SHALL open a popover titled Parts with two sections:
- "Hidden by this animation", shown only when the animation data hides meshes in the current state: one switch per such mesh (off unless
  the user switched it on), in node order. The list SHALL follow the clip, the context, the voice idle tail and the skin.
- "All meshes": every other listed mesh, grouped by model id (see "Parts are the model's meshes grouped by name"). Each group SHALL have a
  switch with the number of its meshes shown out of its total (`12/13`) and a chevron that folds and unfolds its list (all unfolded
  when the popover opens), and inside one switch per mesh labelled with its name without the model prefix.
A switch SHALL show whether the mesh is shown now: the user's choice if there is one, else what is saved for the skin, else the skin's default form (see "Crepuscule's
Generic skins open in their Light form"), else the animation data's. The popover SHALL have a
"Reset" button and a "Save" button, both disabled while there is no unsaved choice (one that differs from what is saved for
the skin, or, when nothing is saved, from the skin's default form), and, while something is saved for the skin, a "Forget saved" button.
"Reset" SHALL drop the unsaved choices; "Save" SHALL keep the shown state for the skin (see `user-preferences`); "Forget saved" SHALL
remove what is saved for the skin and return it to the skin's default form. The list SHALL scroll inside the popover when it is taller than the panel
allows. The puzzle button SHALL be shown pressed while the popover is open and SHALL be disabled when fewer than two meshes are listed
or no model is shown. The popover SHALL follow the popover rules of the stage menu (one at a time, closes on outside press and `Esc`, fits
at 320 px).

#### Scenario: Open the popover
- **WHEN** the puzzle button is pressed on Crepuscule's Generic - Final while `UiStand1` plays
- **THEN** "Hidden by this animation" lists `BodyEX02`, `AlphaEX`, `AlphaEX01` and `FaceEX` switched off, "All meshes" lists the groups `010011` and `010031` with every switch on but `Band` and `BodyEX01` (the Light form), and Reset is disabled

#### Scenario: Chibi
- **WHEN** a dorm chibi is shown
- **THEN** the puzzle button is disabled

#### Scenario: Save
- **WHEN** `Hat` is switched off on Sunlit Tides and "Save" is pressed
- **THEN** "Save" and "Reset" become disabled, "Forget saved" shows, and the hat stays off

#### Scenario: Reset returns to what is saved
- **WHEN** `Hat` was saved off on Sunlit Tides, `Hair01` is then switched off and "Reset" is pressed
- **THEN** `Hair01` is shown again and `Hat` stays off

#### Scenario: Forget saved
- **WHEN** "Forget saved" is pressed on Sunlit Tides with `Hat` saved off
- **THEN** the hat is shown again, as the animation data says, and "Forget saved" disappears

### Requirement: A hidden part is invisible in every state
Switching a mesh off SHALL make it invisible at once and keep it invisible while the animation changes which meshes it shows (clips,
Menu and Fight, a Board action's mesh swap, the voice idle tail). Switching on a mesh the animation data hides SHALL make it visible in
every state as well; the doubled surfaces that may come with it are the user's choice. A mesh without a choice SHALL follow the animation
data and the skin's default form. Switching a group off SHALL hide every mesh of that model id, the ones the current state hides included,
so a later mesh swap cannot bring any of them back; switching a group on when some of its meshes are hidden SHALL drop the choices for that
group and show every mesh the group lists, including the ones the default form hides. Choices and the default form SHALL NOT change the
default framing of the camera.

#### Scenario: Hide one mesh
- **WHEN** `Hair01` is switched off on Crepuscule's Generic - Final
- **THEN** that mesh is invisible and every other mesh is as before

#### Scenario: Show a mesh the animation hides
- **WHEN** `BodyEX02` is switched on in "Hidden by this animation" while `UiStand1` plays
- **THEN** `BodyEX02` becomes visible and stays visible when `BoardAct0201` is selected

#### Scenario: Group off survives a mesh swap
- **WHEN** the group `010011` is switched off and `BoardAct0201` plays (the data then shows `BodyEX` meshes)
- **THEN** no mesh of model id `010011`, base or `EX`, is visible

#### Scenario: Framing is unchanged
- **WHEN** `Hair01` is switched off and the camera is reset
- **THEN** the camera returns to the same default framing as without choices

### Requirement: Hidden parts are kept
The user's unsaved choices SHALL be kept by node name across clips, contexts, skins and frames: a model with a mesh of that name SHALL show the
choice, and a model without one SHALL be unaffected, with the choice kept for the next model that has it. What is saved for a skin SHALL apply whenever that skin is shown, under the unsaved choices. "Reset" SHALL drop every
unsaved choice, including names the shown model does not have, which returns every mesh to what is saved for the skin, else to the
skin's default form and the animation data. The panel SHALL open without unsaved choices.

#### Scenario: Across skins
- **WHEN** `Hair01` (`R5BiankaMd010011Hair01`) is switched off on Crepuscule's Generic and Generic - Final is selected
- **THEN** the hair mesh of the same name on Generic - Final is invisible and its switch is off

#### Scenario: Model without the mesh
- **WHEN** a mesh is switched off on Thorns of Crimson and Generic (which has no mesh of that name) is selected, then Thorns of Crimson again
- **THEN** Generic is unaffected, and Thorns of Crimson shows the mesh off

#### Scenario: Reopen
- **WHEN** meshes were switched off without saving and the panel is closed and opened again
- **THEN** there are no unsaved choices and every mesh is as saved for the skin, else as the animation data and the skin's default form say

#### Scenario: Saved for one skin only
- **WHEN** `Hat` is saved off on Sunlit Tides and Thorns of Crimson is then shown
- **THEN** Thorns of Crimson's meshes are as its own saved choices, else the animation data, say

### Requirement: Crepuscule's Generic skins open in their Light form
Crepuscule's Generic, Generic - Modified and Generic - Final SHALL open in their Light form, read from the model's
`scenes[0].extras.objectTags`: the `ModelCase` meshes listed in `LightDisable` (`AlphaEX`, `AlphaEX01`, `Band`, `BodyEX01`, `BodyEX02`,
`FaceEX`) hidden and every other `ModelCase` mesh shown, in every state, as default choices under the user's own. Which skins open this way
SHALL be set in the construct config; the node lists SHALL come from the model. Other skins (Crepuscule's coatings, the chibis, the other
frames) SHALL follow the animation data. The default form SHALL NOT count as a choice: Reset stays disabled until the user switches something.

#### Scenario: Board action without the dark veil
- **WHEN** `BoardAct0201` plays on Generic - Final at 29.5 s and the camera is turned behind the model
- **THEN** the white veil (`Alpha`, `Alpha01`) and the `Body` are shown, the black-inked `AlphaEX` veil is not, and no thorn tattoos or cuffs are visible

#### Scenario: Show a Light-form mesh again
- **WHEN** `Band` is switched on and Reset is pressed
- **THEN** the cuffs are shown, then hidden again after Reset

#### Scenario: Coating
- **WHEN** Thorns of Crimson is shown
- **THEN** its meshes follow the animation data (its menu hides `Alpha01`, `FaceEX` and `Hat`)

### Requirement: Screenshots show the parts as displayed
A screenshot SHALL show the meshes as they are displayed, with the user's choices applied.

#### Scenario: Screenshot with a hidden mesh
- **WHEN** `Hair01` and `Hair02` are switched off and a screenshot is taken
- **THEN** the PNG shows the model without that hair
