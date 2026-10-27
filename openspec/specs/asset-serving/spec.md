# asset-serving Specification

## Purpose
Serving the active construct's assets from the extension package, offline and read-only with respect to data/. (Purpose TBD, synced from change scaffold-extension.)

## Requirements

### Requirement: Active construct assets are packaged with the extension
Every build (dev and production) SHALL make the served paths of every frame in the frame list — for Crepuscule, Stigmata, Veritas
and Zero: `models/`, `anim/`, `anim-skins/`, `voices_ja/`, `voices.json` and `icons/` — available inside the extension output under
`/<constructId>/`, either as symlinks into `data/<constructId>/` or as copies. Paths not listed (constructs outside the frame list,
`voices_en/`, `wiki/`) SHALL NOT be included. A served path that does not exist in `data/<constructId>/` (for example `icons/` or
`voices.json` before they have been generated) SHALL be skipped with a warning; the build SHALL NOT fail and SHALL NOT leave a
dangling link for it.

#### Scenario: Served paths present
- **WHEN** `pnpm build` finishes
- **THEN** `dist/chrome-mv3/` contains `crepuscule/`, `stigmata/`, `veritas/` and `zero/`, each with `models/`, `anim/`, `anim-skins/`, `voices_ja/`, and `voices.json` and `icons/` when they exist in `data/`, and nothing for `dirge`, `solacetune` or `zitherwoe`

#### Scenario: Dev build
- **WHEN** `pnpm dev` builds or rebuilds the extension
- **THEN** the same served paths are present in the dev output

#### Scenario: Optional path missing
- **WHEN** `data/zero/icons/` does not exist and `pnpm build` runs
- **THEN** the build succeeds with a warning naming `zero` and `icons`, and `dist/chrome-mv3/zero/icons` does not exist

### Requirement: Assets load offline from the extension origin
The side panel SHALL load assets only through `browser.runtime.getURL('/<constructId>/<path>')`,
with no network host involved, so loading works with the network disconnected.

#### Scenario: Large binary asset
- **WHEN** the panel fetches `/crepuscule/models/r5biankamd010011.glb` with networking disabled
- **THEN** the response is OK and its byte length equals the file in `data/crepuscule/models/`

### Requirement: data/ is never modified
The build SHALL only read from `data/`. It SHALL NOT write, move, rename or delete anything inside
`data/`.

#### Scenario: Build leaves data untouched
- **WHEN** `pnpm build` and `pnpm dev` have run
- **THEN** no file under `data/` has a changed modification time, size, or name
