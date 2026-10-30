# skin-selector Specification

## Purpose
Choosing which skin of the construct the viewer shows: the skin list and its source, the skin strip and title row, thumbnails and their placeholder, switching skins (model, clip set, hidden nodes, disposal, what is kept), loading and errors while switching, and the chibi without clips. (Purpose TBD, synced from change add-skin-selector.)

## Requirements

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

#### Scenario: Display model in Playground
- **WHEN** the Display model is Pavo's Generic and the panel is switched to Playground
- **THEN** the header reads Pavo and the strip marks Generic as the shown skin

### Requirement: Skin strip
In Playground, below the stage card, the panel SHALL show a horizontally scrolling strip of square thumbnails, one per skin, grouped as
Generic, Coatings and Chibi with each group's label written vertically before its tiles; a group without skins SHALL NOT be shown. The
shown skin's tile SHALL be highlighted in the accent style. A thin accent bar under the strip SHALL show the horizontal scroll position
when the strip does not fit. The strip SHALL be a radio group: `←`/`→` SHALL move to the previous or next skin and select it, `Home`/`End`
the first or last, and the selected tile SHALL be scrolled into view. It SHALL be hidden while Focus is on (see `viewer-toolbar`), with
the selected tile in view again when Focus is turned off, and SHALL NOT cause horizontal page scrolling at 320 px.

#### Scenario: One skin
- **WHEN** Shukra is shown in Playground
- **THEN** the strip shows the `Generic` group label and one highlighted tile, and no Coatings or Chibi label

#### Scenario: Keyboard with one skin
- **WHEN** the strip has focus on Shukra's Generic and `→` is pressed
- **THEN** Generic stays selected and nothing is loaded again

#### Scenario: Narrow panel
- **WHEN** the side panel is 320 px wide
- **THEN** the strip fits or scrolls inside itself, and the page does not scroll horizontally

#### Scenario: No strip in Display
- **WHEN** the panel is in Display
- **THEN** no skin strip is shown; the Display model is chosen in the Display menu (see `display-mode`)

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

### Requirement: Title row
Above the strip the panel SHALL show the shown skin's name in large bold text, and a `DEFAULT` badge in accent text when it
is the shown frame's default skin.

#### Scenario: Default skin
- **WHEN** the Generic of either frame is shown
- **THEN** the title reads `Generic` with a `DEFAULT` badge

### Requirement: Switching loads the skin's model and clip set
Selecting a skin (from the strip, or a frame's default skin through the frame picker) SHALL load its model and its clip set into the same
viewer, apply that skin's own hidden-node lists, and release the previous model, its clips, its cached clips and any voice line. Switching
repeatedly SHALL NOT increase the renderer's geometry or texture counts for the same skin.

#### Scenario: Load a frame's skin
- **WHEN** Pavo's Generic is loaded in the Menu context
- **THEN** its model is shown with no node hidden (its manifest hides none) and its `UiStand1` plays

#### Scenario: No leak
- **WHEN** Shukra's and Pavo's Generic are loaded one after the other, three times each
- **THEN** each skin shows the same geometry and texture counts the last time as the first

### Requirement: Switching keeps what it can
After a switch the panel SHALL stay in the same context and select the clip with the same name in the new skin's list for that
context; if the new skin has no such clip, it SHALL play the context's default clip. A Board action SHALL restart from 0 with its voice
line. A camera the user has moved SHALL keep its position; otherwise the new model SHALL get its default framing. Speed, lighting,
background, grid, auto-rotate, wireframe, toon shading, voice volume and mute, subtitles on or off and the user's loop choice SHALL stay
as set, and the user's mesh choices SHALL stay, matched by node name.

#### Scenario: Board action across a switch
- **WHEN** `BoardAct1004` plays on Shukra and Pavo is chosen
- **THEN** Pavo's `BoardAct1004` plays from 0 with Pavo's line for it, if it has one

#### Scenario: Fight context kept
- **WHEN** the Fight context is shown on Shukra with `Walk` playing and Pavo is chosen
- **THEN** the Fight list of Pavo is shown and Pavo's `Walk` plays

#### Scenario: Mesh choice matched by node name
- **WHEN** `Hair01` (`R3QuMd010011Hair01`) is switched off on Shukra and Pavo is chosen
- **THEN** Pavo's `R2QuMd010011Hair01` (another node name) is visible, and Shukra's hair is off again when Shukra is chosen back

### Requirement: Loading and errors while switching
While a skin loads the stage SHALL show the loading spinner with progress and the tile of that skin SHALL show that it is loading.
Selecting another skin or frame while one loads SHALL cancel the older load; only the last choice SHALL be shown. If a skin fails to
load, the stage SHALL show the error with Retry (which retries that skin), and the strip and the frame picker SHALL stay usable.

#### Scenario: Fast reselection
- **WHEN** Pavo is chosen on Shukra and, before Pavo has loaded, Shukra is chosen again
- **THEN** Shukra is shown and Pavo never appears

#### Scenario: Missing model file
- **WHEN** a skin's model cannot be fetched
- **THEN** the stage shows an error naming the file with Retry, and choosing the other frame loads it
