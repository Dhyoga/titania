## MODIFIED Requirements

### Requirement: Active construct assets are packaged with the extension
Every build (dev and production) SHALL make the served paths of every frame in the frame list — for Shukra and Pavo: `models/`, `anim/`,
`voices_ja/`, `voices.json` and `icons/` — available inside the extension output under `/<constructId>/`, either as symlinks into
`data/<constructId>/` or as copies. Paths not listed (constructs outside the frame list, `anim-skins/`, `voices_en/`, `wiki/`) SHALL NOT be
included. A served path that does not exist in `data/<constructId>/` (for example `icons/` or `voices.json` before they have been
generated) SHALL be skipped with a warning; the build SHALL NOT fail and SHALL NOT leave a dangling link for it.

#### Scenario: Served paths present
- **WHEN** `pnpm build` finishes
- **THEN** `dist/chrome-mv3/` contains `shukra/` and `pavo/`, each with `models/`, `anim/`, `voices_ja/`, and `voices.json` and `icons/` when they exist in `data/`, and no other construct folder

#### Scenario: Dev build
- **WHEN** `pnpm dev` builds or rebuilds the extension
- **THEN** the same served paths are present in the dev output

#### Scenario: Optional path missing
- **WHEN** `data/pavo/icons/` does not exist and `pnpm build` runs
- **THEN** the build succeeds with a warning naming `pavo` and `icons`, and `dist/chrome-mv3/pavo/icons` does not exist

### Requirement: Assets load offline from the extension origin
The side panel SHALL load assets only through `browser.runtime.getURL('/<constructId>/<path>')`,
with no network host involved, so loading works with the network disconnected.

#### Scenario: Large binary asset
- **WHEN** the panel fetches `/shukra/models/r3qumd010011.glb` with networking disabled
- **THEN** the response is OK and its byte length equals the file in `data/shukra/models/`
