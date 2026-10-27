# toon-shading Specification

## Purpose
The default look: toon materials built from each material's game parameters (cel bands, face shadow, specular and hair highlights,
rim, render state, chibi face and albedo detail), the character's self-shadow, outlines, tone mapping, the toon switch, and the
lifetime and cost of toon resources. (Purpose TBD, synced from change add-toon-shading.)
## Requirements
### Requirement: Toon materials from the material parameters
The viewer SHALL draw, when toon shading is on, every mesh whose glTF material carries the game's character shader
parameters (`extras.family` = `character`) with a toon material built from those parameters: the base texture `_MainTex` tinted by
`_AlbedoColor`, split into a lit and a shadow band by the key light at `_FirstShadow` with `_SmoothFactor` softness and tinted
with `_NoShadowColor` and `_FirstShadowColor`, with a darker second band where `_SecondShadow` is below `_FirstShadow`, and
areas the mask texture's G marks as always shadowed kept in shadow. Materials marked `IF_SMOOTH_SHADOW` SHALL have a soft shadow edge
and a gentle gradient of form on the lit side, except the face. While toon shading is on the image SHALL be tone mapped (ACES), so
skin reads pale as in the game. Values SHALL come from data; no material, colour or threshold
SHALL be hard-coded per skin or frame. A material whose parameters cannot be read SHALL keep its glTF material.

#### Scenario: Two-tone shading
- **WHEN** toon shading is on and the key light comes from the front right
- **THEN** the body shows a lit area and a shadow area tinted with its `_FirstShadowColor`, with an edge no wider than its `_SmoothFactor` allows, instead of a smooth gradient

#### Scenario: Soft form and pale skin
- **WHEN** Generic - Final's legs are shown with toon shading and the default light
- **THEN** the thighs, knees and shins show soft shading at their edges, the skin reads pale ivory as in the in-game reference, and the face stays flat

#### Scenario: Lighting popover drives the bands
- **WHEN** the light direction is changed in the lighting popover
- **THEN** the shadow bands move with it

#### Scenario: Dark suit on another frame
- **WHEN** Stigmata Generic - Final is shown with toon shading, front and back, at the default light
- **THEN** the suit and armour read dark (near-black navy and purple as on huaxu, compared by relative brightness), show a lit and a shadow side, and are not a flat light grey

#### Scenario: Crepuscule unchanged against the game
- **WHEN** the views of Generic - Final compared with `reference/ingame/` in `add-toon-shading` are rendered again
- **THEN** they match the in-game screenshots at least as well as before this change

### Requirement: Face shadow
Materials marked for the face shadow (`_SHADOW_OBJECT_SPACE_NORMAL_MAP`) SHALL take their shadow edge from the face mask's
gradient compared with the light's angle around the head (the model's head anchor), mirrored for light from the other side, so
the face shades in large flat shapes. If this does not read as a face shadow, the face SHALL use the cel bands instead (the
decision is recorded).

#### Scenario: Light from the side
- **WHEN** the light direction is turned from the front to the side
- **THEN** the shadow on the face grows from the far cheek across the face as one flat shape

### Requirement: Specular and rim from the parameters
Materials with `_SpecularIntensity` above 0 SHALL show a stylised highlight in `_SpecularColor` sized by `_SpecularShiness`
and `_SpecularSmoothFactor`, limited by the PBR mask where the material has one. Materials with `IF_RIM` = 1 SHALL show a rim
light in `_RimColor` between `_RimMin` and `_RimMax` of the view angle, scaled by `_RimIntensity`, on the lit side. Materials
without them SHALL show neither. Materials with `_SpecularShiness` 0 (hair) SHALL NOT get a highlight lobe over the whole
surface: their highlight SHALL follow the strands, masked by the strand map `_SkinRampAO` where the material has
`_HAIR_SKIN_RAMP_AO`, or along the strand direction where it has `_SPEC_BITANGENT_OFFSET` and the mesh has tangents, and
otherwise they SHALL show none.

#### Scenario: Hair highlight
- **WHEN** the default skin is shown with toon shading
- **THEN** the hair (specular intensity 0.8 and 0.5) shows highlights and the body (intensity 0) shows none

#### Scenario: Hair highlight stays in the strands
- **WHEN** Generic - Final is shown with toon shading in a face close-up
- **THEN** the hair's highlights lie along the middle of its strands, as in the reference screenshot, and the hair is not lit white as a whole

#### Scenario: Rim
- **WHEN** Night Sonata is shown with toon shading and viewed from the side
- **THEN** the materials with rim enabled show a light edge and the others do not

### Requirement: Character self-shadow
While toon shading is on, the key light SHALL cast a shadow map of the character alone, its shadow volume fitted to the model
and following the light direction. Opaque and alpha-clipped toon meshes SHALL cast (clipped ones with their cut-out), and
alpha-blended meshes and outlines SHALL NOT. Materials marked `_CHAR_SHADOWMAP` SHALL receive it as their shadow band (the
material's shadow tint, never black); other materials SHALL ignore it. If the self-shadow does not read as the game's (stripes,
a dirty face), it SHALL be turned off and the decision recorded.

#### Scenario: Bangs on the face
- **WHEN** Generic - Final is shown with toon shading in a face close-up, light from the front and above
- **THEN** the bangs throw a soft shadow over the forehead and the top of the eyes and the chin over the neck, as in the reference screenshot, without stripes on the face

#### Scenario: Light direction
- **WHEN** the light direction is changed in the lighting popover
- **THEN** the self-shadow moves with it and stays inside its shadow volume

### Requirement: Render state from the parameters
Toon materials SHALL follow the material's `extras.render`: blending, depth write, culling (with reversed winding), alpha clip at
`_Cutoff`, and the draw order `renderOrder`.

#### Scenario: Translucent veil
- **WHEN** the default skin is shown with toon shading
- **THEN** the veil (`Alpha`) is drawn blended after the opaque meshes, as with the original materials

### Requirement: Outlines
Meshes that have an outline material (paired by name, `…OL`) SHALL get an outline when toon shading is on: the mesh pushed out
along the model's own smooth normals (`_PGRSMOOTHNORMAL`, tangent space), drawn from the back, in `_OutlineColor` tinted by the outlined mesh's base texture, with a width
from `_XCharOutlineWidth` scaled by the vertex colour and kept about constant on screen when zooming. Outlines SHALL animate and
morph with their mesh and SHALL be hidden whenever their mesh is hidden (manifest visibility, hidden parts). Meshes without an
outline material SHALL have none.

#### Scenario: Outline on the body
- **WHEN** the default skin is shown with toon shading at the default framing
- **THEN** the body and hair have a thin dark outline and the face interior has none

#### Scenario: Outline colour follows the surface
- **WHEN** Generic - Final is shown with toon shading in a face close-up
- **THEN** the hair outlines are a darker shade of the hair and the jaw line a darker skin tone, not black

#### Scenario: Zoom
- **WHEN** the camera zooms from the default distance to half of it
- **THEN** the outline width on screen stays within a factor of 1.5

#### Scenario: Hidden part
- **WHEN** Hair is hidden
- **THEN** the hair's outline is hidden too

### Requirement: Chibi face
With toon shading on, the chibi SHALL show its face (brows, eyes, mouth) from its `_FaceMap` texture on the second UV set over
the shaded skin, laid over by the texture's alpha. Materials with `_ALBEDO_DETAIL` SHALL lay their `_DetailMap` (second UV set)
over the shaded colour the same way.

#### Scenario: Chibi
- **WHEN** the chibi is shown with toon shading
- **THEN** its face has eyes, brows and a mouth, and no blocks of white or black around them

#### Scenario: Thorn tattoos
- **WHEN** Generic - Final plays a Board action with toon shading
- **THEN** the blue thorn tattoos show on the arm and thigh, as in the in-game reference

### Requirement: Toon switch
The settings popover SHALL have a "Toon shading" switch, on by default every time the panel opens. Switching it off SHALL show the
GLB's own materials without outlines or self-shadow; switching it on SHALL show the toon materials, outlines and self-shadow again, at once, without reloading
the model. Wireframe, lighting, hidden parts, screenshots and skin switches SHALL work in both states, and a skin loaded while
toon shading is on SHALL never show a frame of its original materials.

#### Scenario: Compare
- **WHEN** the switch is turned off and on again
- **THEN** the model shows the original materials and then the toon materials, and the same viewer, model and textures are used throughout

#### Scenario: Screenshot follows the switch
- **WHEN** a screenshot is taken with toon shading on
- **THEN** the PNG shows the toon materials and outlines

### Requirement: Toon resources are bounded and released
The extra textures a toon material needs SHALL be loaded only for the shown skin and SHALL be freed with it, together with the toon
materials and outlines, whichever set is shown. Switching skins repeatedly SHALL NOT grow the renderer's geometry or texture counts
for the same skin. The added GPU memory, draw calls and frame time per skin SHALL be measured and recorded.

#### Scenario: No leak
- **WHEN** all seven skins are selected one after another twice with toon shading on, and toon shading is toggled on each
- **THEN** each skin shows the same geometry and texture counts the second time as the first

### Requirement: Colour ramps and zone colours
Toon materials with `IF_SKIN` = 1 and a `_SkinRamp` texture SHALL take their shadow tint from the ramp along the light term, so the lit
side keeps the ramp's lit end and the shadow side its tint, with the band edges where the cel bands put them. Where a material has several
colour zones (`_MUTLI_CHANEL_SKIN`, `_MUTLI_CHANEL_SHADOW_COLOR`), each vertex's zone SHALL pick its ramp row and its set of
`_NoShadowColorN`/`_FirstShadowColorN`/`_SecondShadowColorN`, the zone read from the model's vertex data by the recorded rule (`_PGRZONE`,
vertex colour, or the first zone when the model has neither). Materials without these SHALL shade as before.

#### Scenario: Tinted shadows
- **WHEN** Stigmata Generic - Final is shown with toon shading and the light from the side
- **THEN** the shadow side of the coat and armour is tinted in the ramp's blue and purple, different per zone, instead of one grey tint

#### Scenario: Unaffected materials
- **WHEN** a material without `IF_SKIN` or without a `_SkinRamp` is shown
- **THEN** its shadow tint is its `_FirstShadowColor` as before

### Requirement: Effect veils
Materials of the `effectCharacter` family (Stigmata's veils) SHALL either be drawn with a blended toon material built from their
parameters (base texture, mask, colour, render state; no dissolution or flow animation, no outline) or keep their glTF material, whichever
matches the reference better; the decision SHALL be recorded. Either way they SHALL follow the hide rules and the toon switch like every other
mesh.

#### Scenario: Stigmata from behind
- **WHEN** Stigmata Generic - Final is shown from behind with toon shading
- **THEN** the veils are translucent and pale over the dark suit, without opaque grey patches, as on huaxu

