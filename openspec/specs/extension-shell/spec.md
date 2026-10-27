# extension-shell Specification

## Purpose
The extension shell: the Manifest V3 side panel, its skeleton layout, design tokens, and the single source of the active construct. (Purpose TBD, synced from change scaffold-extension.)

## Requirements

### Requirement: Toolbar icon opens the side panel
The extension SHALL be a Chrome Manifest V3 extension whose toolbar icon opens the side panel. The
manifest SHALL request only the `sidePanel` permission.

#### Scenario: Clicking the icon
- **WHEN** the user clicks the extension's toolbar icon
- **THEN** the browser opens the extension's side panel

#### Scenario: Minimal permissions
- **WHEN** the built `manifest.json` is inspected
- **THEN** `permissions` contains exactly `sidePanel` and there are no `host_permissions`

### Requirement: Panel skeleton follows DESIGN.md
The side panel SHALL open in Display (see `display-mode`), where the stage fills the whole panel. In Playground the side panel SHALL
render, top to bottom: a header with the active construct's display name as the frame picker and the Display button, the stage (the
canvas on a light vertical gradient from `--color-stage-top` to `--color-stage-bottom`, edge to edge, no tab row and no section title),
and below it the skin title and the skin strip, on the dark panel background. In Playground the stage SHALL fill all the height the other
parts leave, with a minimum height; when the panel is shorter than the parts need, the page SHALL scroll vertically instead of squeezing
the stage. The header and the skin area SHALL be hidden while Focus is on (see `viewer-toolbar`), when the stage fills the whole panel.

#### Scenario: Panel opens
- **WHEN** the side panel opens
- **THEN** the stage fills the whole panel with no header and no skin strip

#### Scenario: Playground
- **WHEN** the panel is switched to Playground with Crepuscule shown
- **THEN** the header reads "Crepuscule", the stage fills the space between the header and the skin strip, and no area of the panel below the skin strip is empty

#### Scenario: Tall panel
- **WHEN** the side panel is 1045 px tall and in Playground
- **THEN** the stage is taller than 2:3 portrait would give and the skin strip is at the bottom edge of the panel

#### Scenario: Short panel
- **WHEN** the side panel is in Playground and shorter than the header, the minimum stage and the skin area together
- **THEN** the page scrolls vertically and the stage keeps its minimum height

#### Scenario: Narrow width
- **WHEN** the side panel is 320 px wide
- **THEN** all skeleton elements of either mode fit without horizontal scrolling

### Requirement: Design tokens in the Tailwind theme
The colors and radii listed under "Design tokens" in `DESIGN.md` SHALL be defined once in the
Tailwind theme with the same names, and components SHALL use them by name instead of literal values.

#### Scenario: Token use
- **WHEN** a component needs the panel background, surface, text or accent color
- **THEN** it uses the theme token (e.g. `bg-bg`, `text-accent`) rather than a hex value

### Requirement: Single source for the active construct
The list of frames (constructs) the panel offers and the frame it opens on SHALL be defined in exactly one place
(`lib/constructs/`). The panel and the build configuration SHALL read the construct ids, display names and served asset
paths from there; components SHALL receive the shown construct through props or the composable that holds it rather than
naming it.

#### Scenario: No hard-coded construct in components
- **WHEN** the source under `components/` and `entrypoints/` is searched for `crepuscule`, `stigmata`, `veritas` and `zero`
- **THEN** there are no matches

#### Scenario: Build reads the same list
- **WHEN** a frame is removed from the list in `lib/constructs/` and the extension is built
- **THEN** that frame is neither offered by the picker nor served
