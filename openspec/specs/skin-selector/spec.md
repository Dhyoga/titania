# skin-selector Specification

## Purpose
Choosing which skin of the construct the viewer shows: the skin list and its source, the skin strip and title row, thumbnails and their placeholder, switching skins (model, clip set, hidden nodes, disposal, what is kept), loading and errors while switching, and the chibi without clips. (Purpose TBD, synced from change add-skin-selector.)

## Requirements

### Requirement: Skin list from data
The viewer SHALL offer the shown frame's skins from its construct configuration, each with an id (the model file stem), a display
name, a group (generic, coating or chibi), its clip set (or none) and an icon path. Names and groups SHALL come from the frame's huaxu
page payload saved in `data/<frame>/wiki/`. For Crepuscule the list SHALL be, in this order: Generic (`r5biankamd010011`), Generic -
Modified (`r5biankamd010021`), Generic - Final (`r5biankamd010031`, the default), Thorns of Crimson (`r5biankamd019011`), Night Sonata
(`r5biankamd019241`), Sunlit Tides (`r5biankamd019271`) and the dorm chibi (`qr5biankamd010011_chibi`). Stigmata, Veritas and Zero
SHALL list their models the same way (Generic, Generic - Modified, Generic - Final, their coatings, their dorm chibi); Stigmata's
battle chibi `q4biankamd010011` SHALL NOT be listed. Every frame's default skin SHALL be its Generic - Final (`…010031`). A skin whose
id is `<prefix>010011` SHALL use the clip set `anim/`, another skin `anim-skins/<id>/`, and a dorm chibi none. A frame chosen in the
frame picker SHALL open on its default skin; the panel and Playground SHALL open on the Display model's skin (see `display-mode`).

#### Scenario: Names and order
- **WHEN** the panel opens with no Display model saved and is switched to Playground
- **THEN** Crepuscule's Generic - Final is shown and the strip lists Crepuscule's seven skins in the order above with those names

#### Scenario: Another frame
- **WHEN** Zero is chosen in the frame picker
- **THEN** the strip lists Zero's Generic, Generic - Modified, Generic - Final, its two coatings and its chibi, and Generic - Final is shown

#### Scenario: Display model in Playground
- **WHEN** the Display model is Night Sonata and the panel is switched to Playground
- **THEN** the strip marks Night Sonata as the shown skin

### Requirement: Skin strip
In Playground, below the stage card, the panel SHALL show a horizontally scrolling strip of square thumbnails, one per skin, grouped as
Generic, Coatings and Chibi with each group's label written vertically before its tiles. The shown skin's tile SHALL be
highlighted in the accent style. A thin accent bar under the strip SHALL show the horizontal scroll position when the strip
does not fit. The strip SHALL be a radio group: `←`/`→` SHALL move to the previous or next skin and select it, `Home`/`End` the
first or last, and the selected tile SHALL be scrolled into view. It SHALL be hidden while Focus is on (see `viewer-toolbar`), with
the selected tile in view again when Focus is turned off, and SHALL NOT cause horizontal page scrolling at 320 px.

#### Scenario: Narrow panel
- **WHEN** the side panel is 320 px wide
- **THEN** the strip scrolls inside itself, the progress bar shows its position, and the page does not scroll horizontally

#### Scenario: No strip in Display
- **WHEN** the panel is in Display
- **THEN** no skin strip is shown; the Display model is chosen in the Display menu (see `display-mode`)

### Requirement: Thumbnails with a placeholder
A tile SHALL show the skin's icon from `icons/<id>.webp` when that file is available, and otherwise a neutral placeholder with
the skin's initials, without an error. Icons SHALL be loaded only from the extension package.

#### Scenario: Icons downloaded
- **WHEN** `data/crepuscule/icons/` holds the seven icons and the panel opens
- **THEN** every tile shows its icon

#### Scenario: Icons missing
- **WHEN** `data/crepuscule/icons/` does not exist
- **THEN** every tile shows a placeholder with initials (e.g. `TC` for Thorns of Crimson), the build succeeds, and no error appears in the panel

### Requirement: Title row
Above the strip the panel SHALL show the shown skin's name in large bold text, and a `DEFAULT` badge in accent text when it
is the shown frame's default skin.

#### Scenario: Default skin
- **WHEN** Generic - Final of any frame is shown
- **THEN** the title reads `Generic - Final` with a `DEFAULT` badge

### Requirement: Switching loads the skin's model and clip set
Selecting a skin SHALL load its model and its clip set into the same viewer, apply that skin's own hidden-node lists, and release
the previous model, its clips, its cached clips and any voice line. Switching between skins repeatedly SHALL NOT increase the
renderer's geometry or texture counts for the same skin.

#### Scenario: No leak
- **WHEN** all seven skins are selected one after another twice
- **THEN** each skin shows the same geometry and texture counts the second time as the first

### Requirement: Switching keeps what it can
After a switch the panel SHALL stay in the same context and select the clip with the same name in the new skin's list for that
context; if the new skin has no such clip, it SHALL play the context's default clip. A Board action SHALL restart from 0 with its voice
line. A camera the user has moved SHALL keep its position; otherwise the new model SHALL get its default framing. Speed, lighting,
background, grid, auto-rotate, wireframe, toon shading, voice volume and mute, subtitles on or off and the user's loop choice SHALL stay
as set, and the user's mesh choices SHALL stay, matched by node name.

#### Scenario: Fight context kept
- **WHEN** the Fight context is shown on Generic and Generic - Final is selected
- **THEN** the Fight list of Generic - Final is shown and the same Fight clip plays

### Requirement: Loading and errors while switching
While a skin loads the stage SHALL show the loading spinner with progress and the tile of that skin SHALL show that it is loading.
Selecting another skin while one loads SHALL cancel the older load; only the last choice SHALL be shown. If a skin fails to load,
the stage SHALL show the error with Retry (which retries that skin), and the strip SHALL stay usable.

#### Scenario: Fast reselection
- **WHEN** Night Sonata is selected and, before it has loaded, Sunlit Tides
- **THEN** Sunlit Tides is shown and Night Sonata never appears

#### Scenario: Missing model file
- **WHEN** a skin's model cannot be fetched
- **THEN** the stage shows an error naming the file with Retry, and selecting another skin from the strip loads it

### Requirement: Chibi without clips
The chibi SHALL be shown in bind pose with no node hidden and its default framing. Since it has no clip set, the animation select
SHALL read "No animations" and be disabled, and play/pause, scrubber, loop, playback options and the Fight/Menu toggle SHALL be
disabled; camera, settings, lighting, screenshot and expand SHALL keep working. Selecting another skin afterwards SHALL restore the
context and clip that were selected before the chibi.

#### Scenario: Show the chibi
- **WHEN** the chibi is selected while `UiStand1` plays in Menu
- **THEN** the chibi stands in bind pose, the select reads "No animations", and the playback controls are disabled

#### Scenario: Back from the chibi
- **WHEN** Generic is selected after the chibi
- **THEN** Generic plays `UiStand1` in Menu
