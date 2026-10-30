## ADDED Requirements

### Requirement: Diffuse and shadow-colour shading for a model without PGR parameters
A material whose extras name the family `diffuseShadow` (a base-colour and a shadow-colour texture with one UV layout) SHALL be drawn showing the shadow-colour
texture where the surface faces away from the light and the base-colour texture where it faces it, with a soft edge a few percent of N·L wide, using the Lighting
popover's light and nothing from the PGR parameters. Models with PGR parameters SHALL be drawn exactly as before.

#### Scenario: Lit and shadow
- **WHEN** Erza is shown with the light from the front (azimuth 0)
- **THEN** her front-facing surfaces show the base-colour texture and her back-facing ones, and the underside of her chin and hair, show the shadow-colour texture, with a soft edge between them

#### Scenario: Light direction
- **WHEN** the light direction slider is moved from 0° to 180°
- **THEN** the lit and shadow areas swap sides on her body

#### Scenario: Toon switch
- **WHEN** "Toon shading" is turned off while Erza is shown
- **THEN** her own material, the base-colour texture without outline or shadow, is shown at once

#### Scenario: Qu unchanged
- **WHEN** Shukra's Generic is shown with toon shading on
- **THEN** it is drawn as before this change

### Requirement: A model without outline materials gets a default outline
A model shaded as above, whose materials have no outline material to pair with, SHALL get a thin outline on each visible mesh, of constant width on
screen, in a darker shade of the surface it outlines, built from the mesh's own geometry. The outline SHALL follow the toon switch (shown with toon
shading, removed without it) and the hidden parts (a hidden mesh has none).

#### Scenario: Outline on Erza
- **WHEN** Erza is shown with toon shading on
- **THEN** her silhouette has a thin dark outline of constant width at any zoom

#### Scenario: Switch and parts
- **WHEN** "Toon shading" is turned off
- **THEN** the outline disappears with it

### Requirement: Erza's toon resources are released
Switching between Erza and the other frames repeatedly SHALL NOT grow the renderer's geometry and texture counts, and the toon materials, outlines and
textures built for her SHALL be released with her model.

#### Scenario: No leak
- **WHEN** Erza and Shukra are chosen alternately three times each
- **THEN** each model shows the same geometry and texture counts the last time as the first
