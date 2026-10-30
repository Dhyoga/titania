## MODIFIED Requirements

### Requirement: Skin list from data
The viewer SHALL offer the shown frame's skins from its construct configuration, each with an id (the model file stem), a display
name, a group (generic, coating or chibi), its clip set (or none) and an icon path. Names and groups SHALL come from the frame's huaxu
page payload saved in `data/<frame>/wiki/`, except Erza's, which are named in her construct configuration. Each of Qu's frames SHALL offer one
skin, its Generic, which is also its default skin: Shukra `r3qumd010011` and Pavo `r2qumd010011`, each with the clip set `anim/`. Erza SHALL offer one
skin, `Erza Scarlet` (`erza-scarlet`), which is also her default skin, with no clip set of her own. Coatings and chibis SHALL NOT be offered. A frame
chosen in the frame picker SHALL open on its default skin; the panel and Playground SHALL open on the Display model's skin (see `display-mode`).

#### Scenario: Names and order
- **WHEN** the panel opens with no Display model saved and is switched to Playground
- **THEN** Shukra's Generic is shown and the strip lists one tile, Generic

#### Scenario: Another frame
- **WHEN** Pavo is chosen in the frame picker
- **THEN** the strip lists Pavo's Generic only, and it is shown

#### Scenario: Erza
- **WHEN** Erza is chosen in the frame picker
- **THEN** the strip lists one tile, `Erza Scarlet`, marked default, and it is shown

### Requirement: Thumbnails with a placeholder
A tile SHALL show the skin's icon from `icons/<id>.webp` when that file is available, and otherwise a neutral placeholder with
the skin's initials, without an error. Icons SHALL be loaded only from the extension package.

#### Scenario: Icons downloaded
- **WHEN** `data/shukra/icons/r3qumd010011.webp` exists and the panel is switched to Playground on Shukra
- **THEN** the Generic tile shows that icon

#### Scenario: Icons missing
- **WHEN** `data/pavo/icons/` does not exist
- **THEN** Pavo's Generic tile shows a placeholder with the initial `G`, the build succeeds, and no error appears in the panel

#### Scenario: Erza has no icon
- **WHEN** Erza is shown
- **THEN** her tile shows a placeholder with the initials `ES`, and no error appears in the panel
