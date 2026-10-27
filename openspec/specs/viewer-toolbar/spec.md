# viewer-toolbar Specification

## Purpose
The viewer's controls in the side panel: the stage menu at the top of the stage, the player over its bottom edge (which can be hidden), Focus (header and skin area hidden), popovers, and the viewer keyboard shortcuts.

## Requirements

### Requirement: Popovers
Settings, lighting and parts SHALL open as dark rounded cards below the stage menu, and playback options as a card above the player's
button. Only one popover SHALL be open at a time; opening one SHALL close another. A popover SHALL close on a pointer press outside it
and on `Esc`, and closing the stage menu SHALL close its popover. While a popover is open its button SHALL be shown pressed and expose
its state to assistive technology. A popover SHALL fit within the panel width at 320 px.

#### Scenario: Open and dismiss
- **WHEN** the settings button is pressed, then the stage is pressed
- **THEN** the settings popover opens with its button pressed, and closes on the second press

#### Scenario: Switch popovers
- **WHEN** the lighting popover is open and the settings button is pressed
- **THEN** the lighting popover closes and the settings popover opens

#### Scenario: Closing the menu
- **WHEN** a popover is open and the menu's close icon is pressed
- **THEN** the popover and the menu close

### Requirement: Keyboard shortcuts for the viewer
In Playground, when the panel has focus, `M` SHALL toggle voice mute, `C` SHALL toggle subtitles and `R` SHALL reset the camera; these
three also work from inside an open popover. `F` SHALL toggle Focus and `H` SHALL hide or show the player. `Esc` SHALL close the open
popover, and when none is open close the stage menu. These shortcuts SHALL be ignored with a modifier key, in text fields, while the
animation list is open, and for keys another control already handled; `F` and `H` are also ignored inside an open popover. Display has
its own key rules (see `display-mode`).

#### Scenario: Esc order
- **WHEN** a popover is open in the stage menu and `Esc` is pressed twice
- **THEN** the first press closes the popover and the second closes the menu

#### Scenario: Reset with the key
- **WHEN** the camera has been orbited in Playground and `R` is pressed
- **THEN** the camera returns to the default framing and the clip keeps its time

#### Scenario: Subtitles with the key
- **WHEN** a Board action shows its caption and `C` is pressed
- **THEN** the caption disappears and the settings popover's "Subtitles" switch is off

#### Scenario: Focus and player keys
- **WHEN** in Playground `F` is pressed, then `H`, then `H` again
- **THEN** the header and skin area hide, the player hides, and the player shows again

### Requirement: Stage menu
The stage SHALL show one menu icon (three lines) in its top-right corner, flush to the top, in both modes. The menu SHALL open in the same
row, to the left of the icon, as one row of icon buttons from left to right: in Playground parts (puzzle), lighting, settings, reset camera,
screenshot, preferences and Focus; in Display the buttons described in `display-mode` (Model, Adjust camera, Mute, Playground). The rules
below for showing and hiding the menu are the same in both modes. While the menu is shown the icon SHALL show a close mark (an X) instead of the three lines. The menu SHALL be shown while the
pointer is over the icon or the menu, while the icon or a control in it has keyboard focus, while one of its popovers is open, and
while it is pinned: pressing the icon while the menu is hidden pins it (on a touch screen this is the way to open it). Pressing the
icon while the menu is shown (by hover, focus, pin or a popover) SHALL hide the menu at once, close its popover and unpin it, and the
menu SHALL stay hidden until the pointer leaves the icon and the menu; a press outside the menu and its popovers unpins it. While the
menu is hidden only the icon SHALL show, and the empty area beside it SHALL NOT take pointer input from the canvas. At a panel width
of 320 px the row SHALL fit without horizontal scrolling or wrapping.

#### Scenario: Hover
- **WHEN** the pointer moves over the menu icon, then left along the row onto the lighting button
- **THEN** the row of buttons appears to the left of the icon, the icon shows the close mark, and the row stays while the pointer moves into it

#### Scenario: Press the close mark while hovering
- **WHEN** the menu is shown by hover and the icon is pressed
- **THEN** the row hides at once, the icon shows the three lines again, and the row stays hidden until the pointer leaves and returns

#### Scenario: Collapsed
- **WHEN** the pointer is elsewhere, nothing in the menu has focus, no popover is open and the menu is not pinned
- **THEN** only the menu icon shows, and a drag beside it orbits the camera in Playground (in Display the camera is locked and the drag does nothing)

#### Scenario: Touch
- **WHEN** the icon is tapped, and later tapped again
- **THEN** the first tap pins the menu open with the close mark, the second hides it

#### Scenario: Popover keeps the menu
- **WHEN** the parts popover is opened from the menu and the pointer leaves
- **THEN** the menu stays shown with the popover under it

#### Scenario: Menu at 320 px
- **WHEN** the panel is 320 px wide, in Playground, and the menu is shown
- **THEN** all seven buttons and the icon are on one line, fully visible

#### Scenario: Menu at 320 px in Display
- **WHEN** the panel is 320 px wide, in Display, and the menu is shown
- **THEN** its four buttons and the icon are on one line, fully visible

### Requirement: Player
In Playground the stage SHALL show the player over its bottom edge (Display has no player): one rounded card with a small gap to the stage's edges and three rows: the
Fight/Menu toggle on the left with the hide button on the right, the animation select (full width, full clip name) with a sliders
button, and play/pause, scrubber, time readout and loop toggle. A playback error SHALL show in the card, and SHALL show the player if
it is hidden. The player covers the bottom of the stage and SHALL NOT change the model's framing. At a panel width of 320 px everything
SHALL fit without horizontal scrolling.

#### Scenario: Pick a clip
- **WHEN** the animation select is opened in the player and `BoardAct0201` is chosen
- **THEN** the list was readable in full width, it closes, and `BoardAct0201` plays

#### Scenario: Play and pause
- **WHEN** the play/pause button is pressed while a clip plays
- **THEN** playback pauses and the button shows "play"

#### Scenario: Switch in the player
- **WHEN** `Fight` is selected in the player's top row
- **THEN** the animation list shows the Fight groups and `Stand1` plays looping

#### Scenario: Error while hidden
- **WHEN** the player is hidden and a clip fails to load
- **THEN** the player shows with the error

### Requirement: Hide the player
The player's hide button SHALL hide it, leaving only a small handle at the bottom centre of the stage that shows it again. Hiding or
showing SHALL NOT move the camera or the model, reload the model or restart the clip, and keyboard shortcuts for playback (`Space`,
`←`, `→`, `L`) SHALL keep working while it is hidden. A caption SHALL stay at the bottom of the stage while the player is hidden. The
choice SHALL NOT be remembered between sessions: the panel opens with the player shown.

#### Scenario: Hide and show
- **WHEN** the hide button is pressed while a clip plays, and later the handle
- **THEN** the player disappears and the handle shows, the clip keeps playing, the feet that the player covered are visible, and the player comes back

#### Scenario: Space while hidden
- **WHEN** the player is hidden and `Space` is pressed
- **THEN** the clip pauses

#### Scenario: Reopen
- **WHEN** the player was hidden and the panel is closed and opened again
- **THEN** the player is shown

### Requirement: Focus
The stage menu's Focus button SHALL hide the header and the skin area (title and strip) together so the stage fills the whole panel,
and show them again when pressed once more; its icon SHALL show which of the two the next press does. Entering or leaving Focus SHALL
NOT reload the model or restart the clip, and SHALL NOT move a camera the user moved. The choice SHALL NOT be remembered between
sessions. Focus SHALL be independent of the player's hidden state.

#### Scenario: Enter and leave
- **WHEN** Focus is pressed while a clip plays, and later pressed again
- **THEN** the header and skin area hide and the stage fills the panel while the clip keeps playing, and they come back with the skin strip showing the selected skin

#### Scenario: Everything hidden
- **WHEN** Focus is on and the player is hidden
- **THEN** the stage shows only the menu icon and the player's handle, and every control can be brought back

#### Scenario: Reopen
- **WHEN** Focus was on and the panel is closed and opened again
- **THEN** the header and skin area are shown
