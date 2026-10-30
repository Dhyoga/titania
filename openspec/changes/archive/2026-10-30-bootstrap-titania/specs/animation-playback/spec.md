## MODIFIED Requirements

### Requirement: Animation list per context
The panel SHALL offer an animation list for the current context. The list SHALL hold clips only (there is no `Bind pose` item).
It SHALL start with the shown frame's own groups, built from the shown skin's manifest, followed by the groups of every other frame
(animation source) in frame-list order, each group label prefixed with the frame's name and a middle dot (`Pavo · Board actions`).
In the Menu context a frame's groups SHALL be an `Idle` group with the menu idle clip and the menu controller's clips that are not
Board actions, and a `Board actions` group with every `BoardAct*` clip of the menu controller. In the Fight context a frame's groups
SHALL start from every clip referenced by the fight base controller and its `levels` controllers, grouped by name into Idle, Movement,
Attacks, Level skills, Reactions and Other, and SHALL then be cut down:
- when several clips share a name, only the one whose file is in the `BaseLayer` (or `Base Layer`) folder SHALL be listed if there
  is one;
- Attacks and Reactions SHALL be left out;
- Movement SHALL keep only the clips named exactly `Walk` and `Run`;
- Level skills SHALL keep only `LevelAttack08_NunWalk`, `LevelAttack11_Loop`, `LevelAttack013Loop` and `LevelAttack14`;
- clips whose name starts with `Squat` SHALL be left out;
- empty groups SHALL be left out.
The left-out clips SHALL stay in the manifests. Items SHALL be sorted by name with numbers compared by value within a group. When two
listed items of one frame share a name, each SHALL show its folder in brackets, and its folder and file name when the folder is shared
too. The field SHALL show a source item as `<Frame> · <name>`. Items whose clip has a paired voice line SHALL show a speaker glyph
after the name, with the text "with voice" for screen readers.

#### Scenario: Menu list on Shukra
- **WHEN** the Menu context is shown for Shukra's Generic
- **THEN** the list reads `Idle`: `StandAct0101`, `UiStand1`; `Board actions`: `BoardAct0201`, `BoardAct0202`, `BoardAct0203`, `BoardAct1001` … `BoardAct1007`; then `Pavo · Idle`, `Pavo · Board actions` with the same names

#### Scenario: Fight list on Shukra
- **WHEN** the Fight context is shown for Shukra's Generic
- **THEN** Shukra's own groups read `Idle`: `Stand1`, `Stand2`, `Standchange`; `Movement`: `Run`, `Walk`; `Other`: `Born`, `Save`, `Win`, followed by `Pavo · Idle`, `Pavo · Movement` (`Run`, `Walk`), `Pavo · Level skills` (`LevelAttack14`) and `Pavo · Other` (`Born`, `Executioner01` … `Executioner05`, `Save`, `Win`)

#### Scenario: Field label of a source clip
- **WHEN** Pavo's `Win` is selected on Shukra
- **THEN** the field reads `Pavo · Win`

#### Scenario: Speaker glyph on paired Board actions
- **WHEN** the Menu list is open for Shukra
- **THEN** every Board action with a pairing in its own frame's `voices.json` shows the speaker glyph, and a Board action without one does not

### Requirement: Clips play in place
When a manifest's root node (`rootNode`) is a node above the pelvis bone, its position track SHALL NOT be applied, so the character
stays at its origin. When the root node is the pelvis bone `Bip001` itself (every clip of Shukra and Pavo), its position track SHALL be
applied, since it carries the pelvis height. Other tracks of the root node and all other nodes SHALL be applied.

#### Scenario: Root above the pelvis
- **WHEN** a test clip whose `rootNode` is a node above `Bip001` carries that node 9.5 m away
- **THEN** the root node keeps its bind position and the model stays inside the stage

#### Scenario: Root is the pelvis
- **WHEN** Pavo's `Run` plays on Pavo's model
- **THEN** the pelvis moves up and down with the run near its rest height (0.968 m) and the feet stay on the floor
