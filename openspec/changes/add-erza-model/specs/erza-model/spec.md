## ADDED Requirements

### Requirement: Erza's model is converted offline from the source FBX
A repeatable script SHALL convert the FBX of a source folder (`Model.fbx` and its PNG textures) into a GLB under `data/erza/models/`, taking the
source folder as an argument. It SHALL read only the source folder and write only under `data/erza/`; running it twice SHALL give the same file.
The converted model SHALL be glTF 2.0 binary with one skin, Y up, in metres, facing −Z (a pure 180° turn about Y when the source faces +Z, held in a
parent node above the skeleton and the mesh, never a mirroring), with the textures embedded. The node transforms SHALL be the pose the mesh was bound in,
so the skinned mesh is undeformed at rest. Names that start with `Bip001` SHALL be written without separators (`Bip001 L Thigh` → `Bip001LThigh`); other
names SHALL keep what the file gives. The mesh SHALL be written as one mesh node, `Erza_Body`, holding the triangles of the body material; the triangles
of the weapon material, and every triangle with a vertex skinned mainly to a `Bone_wq_*` (weapon) bone, SHALL be left out, unless the script is given
`--weapon`, which keeps them as a second mesh node, `Erza_Weapon`. The DAE and OBJ
files SHALL NOT be used. The source folder SHALL NOT be modified by the conversion.

#### Scenario: Convert Erza Scarlet
- **WHEN** the script is run on `data/erza/source/Erza Scarlet/`
- **THEN** `data/erza/models/erza-scarlet.glb` is written, and a second run leaves it byte-identical

#### Scenario: Names
- **WHEN** the converted model's nodes are read
- **THEN** the left thigh is `Bip001LThigh`, no `Bip001…` name contains a space or underscore, and the skirt, hair and ribbon bones keep their `Bone_…` names

#### Scenario: Facing and size
- **WHEN** the converted model is loaded and its rest pose read
- **THEN** her toes are at a smaller z than her ankles, her left hand is at a smaller x than her right, her pelvis is at 1.11 m within 2 cm and the lowest toe is within 5 cm of y = 0

#### Scenario: The sword is left out
- **WHEN** the converted model is read
- **THEN** it has one mesh node, `Erza_Body`, and its bounds are those of her body (symmetric about her, about 1.8 to 2.0 m tall)

#### Scenario: Sword kept on request
- **WHEN** the script is run with `--weapon`
- **THEN** the model also has `Erza_Weapon`, sharing the one skin

#### Scenario: Undeformed at rest
- **WHEN** the converted model is loaded in its rest pose
- **THEN** the body is upright and symmetric (the left and right hands within 2 cm of mirror positions about x = 0), with no stretched triangles

#### Scenario: Another folder
- **WHEN** the script is given `Erza Scarlet (Heaven's Wheel Armor)/`
- **THEN** it converts that folder the same way, without any change to the script

### Requirement: The converted model fits the retargeting by name
Every `Bip001…` bone that Shukra's and Pavo's clips drive SHALL exist on the converted model, except the Pavo-only twist bones
`Bip001LForeTwist`, `Bip001LForeTwist1`, `Bip001LUpArmTwist`, `Bip001LUpArmTwist1` and their right-hand counterparts, which are dropped like any bone the
target lacks. The names of its `Bip001…` bones SHALL be unique. Her skirt, hair, ribbon, cloth and face bones SHALL get no track from any source (they
hold their bind pose).

#### Scenario: Shukra's bones
- **WHEN** the `Bip001…` names of Shukra's rig are looked up on Erza's
- **THEN** all 55 are found

#### Scenario: Pavo's bones
- **WHEN** the `Bip001…` names of Pavo's rig are looked up on Erza's
- **THEN** 56 of 64 are found, the missing ones being the eight Pavo-only twist bones

#### Scenario: A retargeted clip drives only Bip001 bones
- **WHEN** Shukra's `Run` is retargeted onto Erza
- **THEN** every track belongs to a `Bip001…` node, and the `Bone_…` nodes have none

### Requirement: Retargeted motion is accurate on Erza
Retargeting Shukra's or Pavo's `UiStand1`, `BoardAct0201` and `Run` onto Erza SHALL point every main limb bone (spine, neck, head, clavicles, upper
arms, forearms, hands, thighs, calves, feet) where it points in the source model playing the clip, within the bounds `cross-frame-animation` sets for
two models, and her palms the same way as the source's. Her lowest foot point SHALL stay within the bound measured for her (recorded in `AGENTS.md`, no
looser than the 2 cm that `cross-frame-animation` asks for between Qu's frames unless the measurement and its reason say otherwise).

#### Scenario: Shukra on Erza
- **WHEN** Shukra's `BoardAct0201` is retargeted onto Erza and sampled at eight keys
- **THEN** every main bone is within 15° of the source's direction, the mean error is under 5°, and each palm is within 5°

#### Scenario: Pavo on Erza
- **WHEN** Pavo's `Run` is retargeted onto Erza
- **THEN** the same bounds hold

#### Scenario: Props
- **WHEN** a clip is retargeted onto Erza
- **THEN** no track is written for a prop bone that does not sit on a hand at rest (her `Bip001Prop1` is 54 cm from her right hand)

### Requirement: Erza is a frame with one skin
The frame list SHALL include `erza` (display name "Erza") with one skin, `Erza Scarlet` (`erza-scarlet`, group generic), which is also its default
skin, with no clip set of its own (no manifest) and no `voices.json`. The frame SHALL serve `models/` and `icons/` only. The skin's icon SHALL be
`icons/erza-scarlet.webp`, which is not provided: its tile SHALL show the placeholder with the initials `ES`.

#### Scenario: Erza's skin
- **WHEN** Erza is shown in Playground
- **THEN** the header reads "Erza", the skin strip holds one tile, `Erza Scarlet`, marked default, with the placeholder `ES`, and the model is loaded from `/erza/models/erza-scarlet.glb`

#### Scenario: Not converted yet
- **WHEN** `data/erza/models/` does not exist and the extension is built
- **THEN** the build succeeds with a warning that names `erza` and `models`, and choosing Erza shows the stage's load error with Retry while the other frames keep working
