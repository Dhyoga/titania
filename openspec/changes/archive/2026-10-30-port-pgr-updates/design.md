## Context

The port is of three PGR changes to the Display lobby (`restore-standact-idle`, `remove-lobby-sleep`, `add-lobby-fight-idles`, with the later `Born` commit and the "Display always follows"
line of the same commit), and PGR's extension icons. PGR's own design for the Fight idles (`openspec/changes/archive/2026-10-27-add-lobby-fight-idles/design.md` in the PGR repository) is
the source of decisions 1 to 7 below; this document says only what differs for Titania. Compared with the `baeda85` they were both copied from, **Titania has not touched** `lib/lobby/`,
`lib/prefs/prefs.ts` (6 lines), `useLobbyDirector.ts` (5), `usePreferences.ts`, `DisplayAnimationsPopover.vue` and `useViewerSettings.ts`, so those files take PGR's changes over almost
as they are. **`composables/usePlayback.ts` has diverged by 137 lines** (frames with no clip set of their own, the lent idle tail, `canPlay`, `framesRead`), so the same PGR change there is
a hand merge, written against Titania's version. `ModelTab.vue` differs by 11 lines (`displayFrames`, `noClips`).

Measured on Titania's data for this change (`data/*/anim/manifest.json`, base-layer clips):

| Clip | Shukra s, loop | Pavo s, loop |
|---|---|---|
| `Stand1` / `Stand2` | 3.0 / 2.67, loops | 2.0 / 2.0, loops |
| `Standchange` | 2.2, once | 2.13, once |
| `Save` | 2.0, loops | 2.0, loops |
| `Win` | 6.67, once | 6.33, once |
| `Born` | 6.93, once | 4.67, once |
| `LevelAttack14` | none | 1.47, once |
| `UiStand1` / `StandAct0101` | 17.0 / 3.33, loop | 6.0 / 6.0, loop |

So Shukra has six own Fight candidates and Pavo seven, `LevelAttack14` is the one clip lent for Fight (Pavo → Shukra), and the interludes (clips that do not loop) are `Born`,
`Standchange`, `Win` and `LevelAttack14`. No Fight name equals a Menu name, so the `<frame>:<clip name>` key still names one clip. Nothing is hidden on Qu's models in any
context (`hiddenNodes` is empty), so "a Fight clip looks like the Menu idle" has no visible effect on Qu and is tested on a synthetic manifest.

## Goals / Non-Goals

**Goals:**

- Titania's Display idles and behaves as PGR's does after the three changes, for Shukra and Pavo, with every stored record keeping its meaning.
- Titania's own behaviour is untouched: Erza as a Playground-only frame (`display: false`), frames with no clip set, the retarget fixes. Playground's lists do not change.
- The port is specified first (the deltas) and then built; nothing is copied across wholesale.

**Non-Goals:**

- **Weapons** (`add-weapons`) and **chibi expressions** (`add-chibi-expressions`), see the proposal. If weapons are wanted later: Titania has no page for Qu's weapons, so it would start
  with a spike on the wiki, and Erza's sword is a different asset.
- A Fight clip as an action (no voice line, never in the bag), chaining of Fight clips, a camera change for low poses, Erza in Display (`erza-only-companion`).
- PGR's skill and command files, and any Bianca-only content.

## Decisions

### D1–D7. As PGR designed them, adapted

Taken from PGR's design with the Titania names; the code is ported from the PGR commits `d3a4e88`, `0074cff` and `835e07b`, not rewritten:

1. **Display reads both lists** whatever the context: `usePlayback` gains `lobbyItems` (Menu and Fight catalogs of the shown model, each item tagged with its list) and `find(id)`;
   `select(id, { loop, look })` takes items of either list and uses the item's list for the fill pose and cache key; `look: 'menuIdle'` gives the Menu idle's hidden nodes.
2. **Candidates and shares** in `lib/lobby/pool.ts`: `CandidateKind` adds `'fight'`, `LOBBY_FIGHT_IDLES` (with `Born`) and `LOBBY_GROUP_SHARES` (0.6 / 0.3 / 0.1), `resolvePool` takes `ownOff`.
   Worked out for Shukra's default: each own Fight clip 10 %, `UiStand1` 18 %, `StandAct0101` 12 %, Pavo's `UiStand1` 6 % and `StandAct0101` 4 %; with all own Fight off it is 75 / 25.
   Shares are per pick, not per second (`Win` holds the stage 6.7 s for one pick, `Save` 10 s): accepted, as in PGR.
3. **Interludes**: `IdleChoice.once`, an `idleEnded { id }` event, a repeated `once` pick restarts the clip; stale `idleEnded` is ignored like a stale `idleLoop`.
4. **The look**: Fight items pass `look: 'menuIdle'`; a lent Fight item fills from the shown model's Fight idle, which its list gives already.
5. **Preferences**: `lobby.ownOff[<display frame>]` (own Fight keys turned off); absent or empty = all on; tolerant read, strict import, exported, cleared by Forget all, and "Use default"
   clears both lists of the frame. `pools` keeps holding borrowed keys only.
6. **Popover**: after the Menu sections a "Fight" heading and one section per frame in the same order; own Fight rows checkable and checked by default, other frames' unchecked; idle rows
   show the clip name first (both idles would read "Idle"); the header counts Menu and Fight idles. The frames come from `displayFrames`, so Erza is not a section.
7. **Leaving Display during a Fight clip**: `adoptSelectionContext()` sets the context to that clip's list without playing anything and re-applies the hidden nodes.

### D8. The usePlayback merge is written against Titania's version

PGR's `catalogOf(ctx)` assumes a manifest. Titania's `catalog` already handles a frame with no clip set (`withSources(null, …)`), so the port generalizes **Titania's** `catalog` computed into
`catalogOf(ctx)` (own part only when the shown skin has a manifest) and builds `lobbyItems` and `find` from it. `request` and `lineOf` take the item's list instead of reading
`context.value` (Titania's `request` keys the fill pose by context as PGR's did), `idleOf(current, item)` keeps its sources-only branch, and `canPlay` replaces `hasClips` as before. Erza is
never a Display model, so Display's Fight items always come from a frame with a manifest, but the code does not assume it: a session without a manifest yields no lobby items.
*Alternative:* take PGR's `usePlayback.ts` and re-apply Titania's changes on top (rejected: more of the file moved on Titania's side than PGR's, and a wrong merge there regresses Erza).

### D9. `Born` is in the specification

PGR added `Born` to `LOBBY_FIGHT_IDLES` after the fact and its spec still lists nine names without it. Here it is in the spec (candidates, the "once" note in the popover, the interlude list), so
the code and the document agree from the start.

### D10. "Display always follows" is a settings rule, not a camera change

`useViewerSettings` computes the effective follow value as `mode === 'display' || follow` and watches that, so a mode switch that changes nothing does not re-pick the followed part. Playground's setting is
unchanged and applies again when Playground is entered. The low poses among Qu's Fight clips (to be found by looking at each candidate in the Display framing) are checked in the panel and what is seen is recorded.

### D11. A generated icon, no game asset

`scripts/make-icons.ts` (Node, no dependency; a PNG is a few chunks and `zlib` is in Node) draws a monogram **T** in the panel's accent colour on its dark background at 128 px and scales to 96,
48, 32 and 16 by area averaging, writing `public/icon/<size>.png`. It is deterministic (no timestamps), reads nothing from `data/`, and the files are committed. WXT adds `public/icon/*.png`
to the manifest by itself; a test reads the built manifest in the build task and the PNG headers for the sizes. *Alternatives:* a render of Erza (rejected: a derivative of a game asset in the
repository), PGR's icons (Bianca), no icon (the toolbar shows a letter).

## Risks / Trade-offs

- **[Display now renders continuously]** (no sleep) → at most 30 fps while the panel is open and visible, as in PGR; a closed or hidden panel renders nothing. The user asked for it there; said so in the proposal.
- **[Combat stances with an empty hand]** → Qu holds no weapon model in Titania (none in `data/`); the user can turn single Fight clips off in the popover. Seen in the panel, recorded.
- **[Low poses in a bust framing]** → handled by "Display always follows"; checked for `Born`, `Win` and Pavo's `LevelAttack14`.
- **[A hand merge of `usePlayback.ts` can regress Erza or Qu's Playground]** → the existing tests stay as they are and must pass; Playground's list, remembered selection and the idle tail of a lent voiced action are
  re-checked in the panel on Erza (frames with no clip set) and Shukra.
- **[`Born` and `Win` end far from their start]** → interludes play once and crossfade out over 0.25 s, as PGR chose; never looped.
- **[More clips in the viewer's cache]** → the Fight candidates are small on disk (measured: Shukra's six 1.7 MiB together, the largest `Born` 0.56 MiB; Pavo's seven 0.9 MiB); the LRU evicts as before.
- **[Order of archive]** → written against the specs after `bootstrap-titania`, `add-erza-model` and `fix-erza-retarget-limbs`, which are archived.

## Open Questions

- None that change what is built. The idle shares (60 / 30 / 10) are the user's from PGR; if Titania's smaller pool feels wrong in the panel, they are constants in one place (`LOBBY_GROUP_SHARES`).
