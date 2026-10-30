## Why

Titania is a copy of the PGR companion at `baeda85`. PGR has moved on by six commits and **five archived changes** (more than `AGENTS.md` lists under "PGR since the copy",
which was written before they landed): `restore-standact-idle`, `remove-lobby-sleep`, `add-lobby-fight-idles`, `add-chibi-expressions` and `add-weapons`, plus the extension
icons. The first three change what Display does on its own: it idles on more than one clip again, never falls asleep, and varies much more by also idling on Fight clips
(stances, the win pose, the entrance). Titania's Display still plays only `UiStand1`, sleeps after 2 minutes, and has no extension icon. `AGENTS.md` says porting is a change of
its own, written as specs first and then code and tests, not files copied across.

## What Changes

Ported, adapted to Titania (Shukra and Pavo as the Display frames, `titania.prefs`, Erza with `display: false`, one skin per frame):

- **`StandAct0101` is a Display idle again** (`restore-standact-idle`): `UiStand1` weighs 3 and `StandAct0101` 2 within a source; the Animations popover lists both idle rows
  (clip name first); a frame in `lobby.idleFrom` lends both by default.
- **Display never sleeps** (`remove-lobby-sleep`, **BREAKING** for the 2-minute pause): the director has no `asleep` phase, no sleep timer and no `input` event; idles go on until a
  tap or until Display is left. The cost is continuous rendering (at most 30 fps) while the panel is open and visible.
- **Fight idles in Display** (`add-lobby-fight-idles`, with the later `Born` commit): `Born`, `Stand1`, `Stand2`, `Standchange`, `Save`, `Win` and the `LevelAttack…` clips (on
  Titania's frames only Pavo's `LevelAttack14`, lent to Shukra) become idle candidates; shares own Fight 60 %, own Menu 30 %, borrowed 10 %, renormalized over the groups that have
  something; a clip that does not loop plays once as an interlude; a Fight clip in Display shows the meshes of the Menu idle's rule and, when borrowed, fills from the shown
  model's Fight idle; the Animations popover gets a Fight section per frame (own Fight rows start checked and can be unchecked, other frames' start unchecked); the own Fight clips
  turned off are saved per Display frame in a new `lobby.ownOff` (absent = all on, so every stored record keeps its meaning); leaving Display while a Fight clip plays opens
  Playground in Fight with that clip selected.
- **Display always follows the animation** (part of the same PGR commit): its bust framing would leave the low poses of the Fight idles out of the frame, so Display follows
  whatever Playground's "Follow animation" says, which applies again in Playground.
- **An extension icon of its own**: PGR's icons are pictures of Bianca; Titania gets a generated monogram (`public/icon/16, 32, 48, 96, 128.png`, made by a script, no game asset),
  which WXT puts in the manifest.

Deliberately **left out**, and why:

- **`add-weapons`** (66 files, a new `weapons` capability, `download_weapons.py`): needs weapon prefabs per frame from the wiki, of which Titania has no page (it saves only the voices
  page), and Shukra and Pavo stop being frames in `erza-only-companion`. Erza's sword is a different asset (see `add-erza-model`). A change of its own if wanted.
- **`add-chibi-expressions`**: Titania has no chibis (`bootstrap-titania` dropped them), so its skin expressions and stage-menu button have nothing to act on.
- **PGR's OpenSpec skill and command files** (commit `114adb8`, tooling), and everything Bianca-only (Crepuscule's `LevelAttack…` set, Zero's, Veritas' and Stigmata's data).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lobby-director`: idle candidates and shares (Menu and Fight, `StandAct0101`, `Born`); a clip that does not loop plays once; how a Fight clip looks in Display; entering Display from
  Fight and a Fight clip carried over to Playground; "Sleep" is removed and replaced by "Display keeps playing".
- `display-mode`: the Animations popover lists the idle rows and a Fight section per frame; the Display stage always follows the animation.
- `user-preferences`: the Display animation choice also stores the own Fight clips turned off (`lobby.ownOff`); export, import and "Forget all" carry it.
- `extension-shell`: the extension has its own icon, in five sizes, made without game assets.

## Impact

- Code: `lib/lobby/director.ts` and `pool.ts` (candidate kinds, shares, `IdleChoice.once`, an `idleEnded` event, no sleep), `lib/prefs/prefs.ts` and `composables/usePreferences.ts`
  (`lobby.ownOff`, `withOwnOff`), `composables/useLobbyDirector.ts` (interludes, Fight items, `ownOff`, no `input`), `composables/usePlayback.ts` (Display reads Menu and Fight
  items whatever the context; a mesh rule and fill pose per play; **Titania's version has diverged** with sources-only frames, so this is merged by hand, not taken from PGR),
  `composables/useViewerSettings.ts` (Display always follows), `components/DisplayAnimationsPopover.vue` and `ModelTab.vue`, `public/icon/*` and a generator script.
- Tests: `director`, `lobbyPool`, `lobbyConfig`, `prefs` and `displayModel` tests change with their specs; new ones for interludes, shares, `ownOff` and the icons.
- Docs: `AGENTS.md` (lobby sections, "PGR since the copy" rewritten to say what was ported and what was left out, layout), `DESIGN.md` (Display behaviour, popover), `README.md`
  (Display no longer sleeps).
- Touches nothing under `data/`, no new dependency. Written against the main specs as `bootstrap-titania`, `add-erza-model` and `fix-erza-retarget-limbs` left them (all archived).
