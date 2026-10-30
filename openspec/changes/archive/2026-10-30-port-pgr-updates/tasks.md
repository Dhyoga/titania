## 1. Before starting

- [x] 1.1 Re-read PGR's three archived changes and the commits `d3a4e88`, `0074cff`, `835e07b` against the current Titania files (`lib/lobby/`, `prefs.ts`, `useLobbyDirector.ts`, `usePlayback.ts`, `DisplayAnimationsPopover.vue`, `ModelTab.vue`, `useViewerSettings.ts`); note anything in the PGR diff that belongs to `add-weapons` or `add-chibi-expressions` (the later commits touched the same files) and leave it out
- [x] 1.2 Measure the file sizes of Shukra's and Pavo's Fight candidates (`Born`, `Stand1`, `Stand2`, `Standchange`, `Save`, `Win`, `LevelAttack14`) and confirm the durations and `loop` flags of the design's table; revise `design.md` if they differ

## 2. Pool (`lib/lobby/pool.ts`, `director.ts` constants)

- [x] 2.1 `LOBBY_IDLE_WEIGHTS` back to `UiStand1` 3 and `StandAct0101` 2; `LOBBY_FIGHT_IDLES` (with `Born`) and `LOBBY_GROUP_SHARES` (0.6 / 0.3 / 0.1); `CandidateKind` adds `'fight'`; `Candidate` and `PoolItem` gain `once` and `context`
- [x] 2.2 `listCandidates` takes Menu and Fight items; Fight candidates only for the names in `LOBBY_FIGHT_IDLES`, one per name and source; `defaultChoice` keeps both Menu idles of each `lobby.idleFrom` frame and no Fight key
- [x] 2.3 `resolvePool` takes `ownOff`: groups, renormalization, weights within groups and within a lender as in the design (D2); idles carry `once`
- [x] 2.4 `tests/lobbyPool.test.ts`: candidates per frame on the real data (Shukra six, Pavo seven, Pavo's `LevelAttack14` offered to Shukra), the worked shares of Shukra's default (10 / 18 / 12 / 6 / 4 %), nothing borrowed, all own Fight off (75 / 25), a lender with both lists, `ownOff` keys of an unknown clip ignored; `tests/lobbyConfig.test.ts` still passes

## 3. Director (`lib/lobby/director.ts`)

- [x] 3.1 Remove sleep: no `asleep` phase, no `sleep`/`wake` commands, no sleep timer, no `input` event, no `LOBBY_SLEEP_AFTER_MS` / `DirectorConfig.sleepAfterMs`; `__pgrLobbyOverrides` keeps the other timings
- [x] 3.2 `IdleChoice.once`; the `idleEnded { id }` event; a `once` pick sets no loop count and a repeated `once` pick issues `playIdle` again; a stale `idleEnded` is ignored
- [x] 3.3 `tests/director.test.ts`: the sleep tests go and the others lose their `asleep` branches; new: an interlude ends and the next pick follows, the same interlude again restarts, a tap during an interlude starts an action, `setPool` during an interlude, a stale `idleEnded` after a tap, a long run without input keeps idling

## 4. Playback (`composables/usePlayback.ts`, hand merge, design D8)

- [x] 4.1 Generalize `catalog` into `catalogOf(ctx)` (own part only with a manifest); `lobbyItems` (both lists, items tagged with their list, a warning and no items when a list cannot be built), `find(id)`, a lobby `voiced` over the Menu items
- [x] 4.2 `request`, `lineOf` and the fill-pose key take the item's list; `select(id, { loop, look })` takes items of either list and `look: 'menuIdle'` gives the Menu idle's hidden nodes; `itemInfo` and `lineTitle` use `find`
- [x] 4.3 `adoptSelectionContext()`: when the selected item is in the other list, make that list the context without playing and re-apply the hidden nodes and the remembered selection
- [x] 4.4 Tests that exist for Playground (`playback`, `catalog`, `frameVoices`, the Erza cases of `catalog` and `skins`) pass unchanged; add a unit test for what can be tested without Vue (the tagging of items by list, ids not colliding between lists)

## 5. Display composable, popover and stage

- [x] 5.1 `useLobbyDirector`: resolution from `lobbyItems` and `ownOff`; Fight items played with `look: 'menuIdle'` and no caption; a `once` idle played with `loop: false` and `finished` → `idleEnded`; no `input` events and no `adjusting` option; `toggleOwn`, `setOwnFight`; the lender warning still skips frames with no clip set
- [x] 5.2 `DisplayAnimationsPopover.vue`: the idle rows (`UiStand1`, `StandAct0101`) with the clip name first, a "Fight" heading and a section per frame from `displayFrames`, own Fight rows checkable and checked by default, others unchecked, the "once" note, the header counting Menu and Fight idles; fits 320 px
- [x] 5.3 `ModelTab.vue`: leaving Display while a Fight item is selected calls `adoptSelectionContext()`; drop the `adjusting` option passed to the director
- [x] 5.4 `useViewerSettings.ts`: Display always follows (the effective value is `mode === 'display' || follow`), Playground's setting untouched

## 6. Preferences

- [x] 6.1 `lib/prefs/prefs.ts`: `lobby.ownOff` (tolerant parse giving `{}` for a wrong shape, strict import refusing a wrong type, serialize, defaults, `withOwnOff`); a PGR file is still accepted; `tests/prefs.test.ts`: a record before this change, a wrong shape, an import refusal, a round trip, the own Fight list kept per frame
- [x] 6.2 `composables/usePreferences.ts`: `setOwnOff(frame, keys | null)`; Forget all clears it; `setPool(frame, null)` and "Use default" clear both lists

## 7. The icon

- [x] 7.1 `scripts/make-icons.ts` (Node, no dependency, deterministic, reads nothing from `data/`, writes only `public/icon/<size>.png`); run it and commit the five PNGs
- [x] 7.2 A test: the five files exist with the PNG dimensions 16, 32, 48, 96 and 128, and running the script into a temporary folder gives the same bytes; `pnpm build` and the built `manifest.json` list the five icons (check by reading it; if WXT does not add them, name them in `wxt.config.ts`)

## 8. In the browser

- [x] 8.1 `pnpm build`, load the build: the panel opens in Display on Shukra; with the dwell shortened through `__pgrLobbyOverrides` every Fight candidate of Shukra and of Pavo comes up, interludes (`Born`, `Standchange`, `Win`, Pavo's `LevelAttack14` on Shukra) play once and hand over with no bind-pose frame, `StandAct0101` comes up, nothing sleeps over a long idle run (the director's trace shows picks continuing)
- [x] 8.2 The popover: Fight sections, toggles, "Use default", Pavo's Fight rows unchecked by default, Erza not a section; reload keeps `ownOff`; leaving Display during `Stand2` gives Playground in Fight with `Stand2` selected; the shares by sampling the director over many picks are in the spec's ranges
- [x] 8.3 Look at each Fight candidate in the Display framing, follow on and off in Playground (Display follows either way): record what is seen (low poses, `Born`, `Win`, `Standchange`, an empty hand) in `AGENTS.md`
- [x] 8.4 Playground is unchanged: Erza's list, the remembered selection, the idle tail of `Shukra · BoardAct1004` on Erza, Shukra's own Board actions with their lines; the renderer's geometry and texture counts stay the same over many picks and over Erza ↔ Shukra switches

## 9. Documents and closing

- [x] 9.1 `AGENTS.md`: rewrite "PGR since the copy" (what was ported, what was left out and why: weapons, chibi expressions, PGR's skill files), the lobby sections (no sleep, candidates, shares, interludes, `ownOff`), the layout (`scripts/make-icons.ts`, `public/icon/`), the measured figures; `DESIGN.md` (Display behaviour, the popover); `README.md` (Display no longer sleeps, the Fight idles, the icon)
- [x] 9.2 `pnpm compile` and `pnpm test` pass, `openspec validate port-pgr-updates --strict` passes; commit

## Workflow follow-up

- After archive, edit the `## Purpose` line of the main `lobby-director` spec by hand (it still says "sleep after 2 minutes without input"); a delta cannot change a Purpose.
