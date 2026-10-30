# frame-voice-data Specification

## Purpose
Producing the voice data of Bianca's other frames (Stigmata, Veritas, Zero) from their saved huaxu voices pages: saving the page and skin icons, building each frame's `voices.json` (titles, English transcripts), the Board action pairing from a table kept in the repo, and checking the result against `data/`. (Purpose TBD, synced from change add-frame-voice-data.)

## Requirements

### Requirement: The voices page and icons are saved for each frame
Running `download_construct.py <slug>` SHALL save the huaxu voices page it fetches as `data/<slug>/wiki/voices.html`, SHALL download the
frame's Generic model (the prefab named for the slug in the script's table) to `data/<slug>/models/<prefab>.glb` and its icon to
`data/<slug>/icons/<prefab>.webp`, and SHALL download the English voice lines the page links and the Japanese voice lines of the same
voice folders. It SHALL NOT download the other prefabs, coatings or chibis named on the model page. Files that already exist and are valid
SHALL be skipped. It SHALL be run for `shukra` and `pavo`; a slug missing from the table SHALL stop the script with an error naming it.

#### Scenario: Frames scraped
- **WHEN** `download_construct.py shukra pavo` has run
- **THEN** `data/shukra/` holds `models/r3qumd010011.glb`, `icons/r3qumd010011.webp`, `wiki/voices.html`, `voices_en/` and `voices_ja/` with `v_qus_*` files, `data/pavo/` likewise with `r2qumd010011` and `v_qu_*`, and no other model was downloaded

#### Scenario: Re-run
- **WHEN** the same command runs again
- **THEN** every file is skipped and none is changed

#### Scenario: Unknown slug
- **WHEN** `download_construct.py crepuscule` runs
- **THEN** it fails naming `crepuscule` and downloads nothing

### Requirement: voices.json is built from the page and the audio folder
A script SHALL write `data/<slug>/voices.json` with `version` 1, `audioLang` `ja`, `textLang` `en` and one entry per file in
`data/<slug>/voices_ja/`, in file name order. An entry's `id` and `file` SHALL be the file's stem and name. When a line of the page's
voice list has that stem as the base name of its Japanese audio path, the entry SHALL carry the line's name as `title` and its text
as `text` with `lang` `en`; otherwise the entry SHALL carry an empty `text` and a `note` saying that the wiki has no text for it.

#### Scenario: Line with a wiki entry
- **WHEN** Shukra's page lists a line whose Japanese audio path ends in `v_qus_1`
- **THEN** the entry for `v_qus_1.mp3` carries that line's title and English text

#### Scenario: Audio variant without a wiki entry
- **WHEN** a file in `voices_ja/` has no line in the page
- **THEN** its entry has an empty `text` and a `note`, and no `title`

#### Scenario: Two wiki lines for one file
- **WHEN** two lines of the page link the same Japanese file with the same text
- **THEN** the entry carries the title and text of the first of them in page order and the script prints a note; if their texts differ the script stops with an error naming both titles

### Requirement: Board action pairing comes from a table in the repo
The Board action ↔ line pairing SHALL be read from `voice_pairings.json` in the repository, keyed by frame slug and clip name,
with the huaxu line title as value. The script SHALL set `animation` to the clip name on the one entry whose `title` equals the
paired title. A title that matches no entry, or more than one, SHALL stop the script with an error naming the frame, clip and
title, and no file SHALL be written for that frame. A clip without a chosen line SHALL have no entry in the table. Pairings SHALL NOT
be typed into `data/` by hand. Since Qu's data holds no clip ↔ line link, the table's pairings SHALL be chosen by listening, and the
table's `_comment` SHALL say so.

#### Scenario: Shukra pairing
- **WHEN** the table pairs Shukra's `BoardAct0201` with a line title of Shukra's page
- **THEN** the entry of Shukra's `voices.json` with that title has `animation` `BoardAct0201`

#### Scenario: Unknown title
- **WHEN** the table pairs a clip with a title that no line has
- **THEN** the script fails naming the frame, the clip and the title, and that frame's `voices.json` is not written

#### Scenario: No line chosen
- **WHEN** a Board action of Pavo has no entry in the table
- **THEN** no entry of Pavo's `voices.json` carries that clip name

### Requirement: Generated voice data is checked against data/
A Node test SHALL check, for each frame that has a `voices.json`, that every entry's audio file exists in `voices_ja/`, that every
`animation` value names a Board action of the frame's manifests, that no clip name is paired twice, and that every pairing of the
table is present. The test SHALL be skipped when `data/` is absent.

#### Scenario: Data present
- **WHEN** `pnpm test` runs with the generated files in place
- **THEN** the frame voice data checks pass for Shukra and Pavo

#### Scenario: Data absent
- **WHEN** `pnpm test` runs without `data/`
- **THEN** the frame voice data checks are skipped
