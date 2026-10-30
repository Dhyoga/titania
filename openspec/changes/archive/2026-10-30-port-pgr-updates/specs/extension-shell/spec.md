## ADDED Requirements

### Requirement: The extension has an icon of its own
The extension SHALL have toolbar and extension-page icons of 16, 32, 48, 96 and 128 px, listed in the built `manifest.json`, made by a script in the repository
from no game asset (a monogram, not an image of a character), so that it can be committed. The icons SHALL be square PNG files of exactly those sizes.

#### Scenario: Icons in the manifest
- **WHEN** `pnpm build` finishes
- **THEN** `manifest.json` lists an icon for each of the five sizes and each file exists in the output with those dimensions

#### Scenario: No game asset
- **WHEN** the icon script is run
- **THEN** it reads nothing under `data/` and writes only the five files under `public/icon/`, giving the same bytes every time
