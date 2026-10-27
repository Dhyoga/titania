# toon-emission Specification

## Purpose
TBD - created by archiving change fix-toon-material-variants. Update Purpose after archive.
## Requirements
### Requirement: Emission from the material parameters
With toon shading on, toon materials with `_EmissionIntensity` above 0 SHALL light up the texels their `_MaskTex` alpha marks as emissive, in a
colour from `_EmissionColor` (and the base texture, if the recorded rule includes it), scaled by `_EmissionIntensity`, independent of the key
light and the shadow band. Whether the base texture is multiplied in SHALL be decided by comparison with the reference and recorded. Texels the mask does not mark SHALL NOT glow, and materials with `_EmissionIntensity` 0 SHALL show no emission.
Materials with `_USE_EMISSION_FLOWING` SHALL show their emission without animation. No bloom or screen-space glow is added. Values SHALL come
from data; nothing SHALL be hard-coded per skin.

#### Scenario: Glowing lines
- **WHEN** Veritas' Ink-lit Hermit is shown with toon shading
- **THEN** the thin yellow lines on the suit stand out brighter than the suit around them, in both the lit and the shadow band, as on huaxu

#### Scenario: Lamp in shadow
- **WHEN** Stigmata Generic - Final is shown with toon shading and the light from behind
- **THEN** the lamp on the hip device and the claw tips stay bright in a purple tint while the suit around them is in shadow

#### Scenario: No glow over whole surfaces
- **WHEN** every skin of the four frames is shown with toon shading
- **THEN** no material glows over its whole surface, and the eyes (emission 0.1) look as before this change

#### Scenario: Toon off
- **WHEN** toon shading is switched off
- **THEN** the GLB's own materials show without the added emission

