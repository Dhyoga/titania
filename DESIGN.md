# DESIGN.md

UI and interaction design for the side panel of **Titania: Fairy Tail Companion**. The reference is the huaxu.app
construct model page (the panel is carried over from the PGR companion, whose models come from there); the goal is to reproduce its
viewer controls closely, adapted to a narrow side panel. Until `erza-only-companion` the panel shows Qu's two frames, Shukra and Pavo,
and, in Playground only, Erza (`add-erza-model`). Colors and sizes below are approximations read from screenshots;
adjust them by eye against the reference.

## Principles

- **Match the reference.** When unsure how a control should look or behave, copy huaxu.
- **Viewer first.** The 3D canvas is the largest element; controls float over or hug it.
- **Narrow by default.** Everything works at 320 px wide; extra width just gives the canvas more room.
- **Dark UI, light stage.** Dark chrome around a light, soft-gradient 3D stage.

## Design tokens

Define these in the Tailwind theme (`@theme` in the CSS entry) and use them by name.

| Token | Value (approx.) | Use |
|---|---|---|
| `--color-bg` | `#111214` | panel background |
| `--color-surface` | `#2b2d31` | toolbars, dropdown buttons |
| `--color-surface-2` | `#1f2023` | dropdown field, pressed buttons |
| `--color-border` | `#3a3c40` | 1 px borders on buttons and fields |
| `--color-text` | `#f2f2f2` | primary text, icons |
| `--color-text-muted` | `#a0a3a8` | secondary text, time readout |
| `--color-accent` | `#9cbd6f` | active toggle, slider fill and thumb, active tab underline, badges |
| `--color-accent-fg` | `#111214` | text on accent backgrounds |
| `--color-stage-top` | `#a9bfdc` | stage gradient top |
| `--color-stage-bottom` | `#e9eef5` | stage gradient bottom |
| `--color-rarity` | `#22c55e` | rarity stars |
| radius | `12px` (buttons), `16px` (player, popovers; the stage itself has no radius) | |
| icon size | 20–24 px, stroke icons | Lucide-style line icons |
| font | system sans (Inter if available) | |

## Modes: Display and Playground

The panel has two modes on **one viewer and one canvas** (switching never creates a second renderer, and reloads the model only when the
other mode shows a different one). It always opens in **Display**; the mode is not remembered.

- **Display** is the quiet view, modelled on the game's lobby: the stage fills the whole panel (no header, player or skin area), with only
  the stage menu icon over it and, when a line plays and captions are on, the caption at the bottom. The model is the **Display model**
  (a frame and one of its skins; Shukra - Generic until the user chooses another; saved as soon as it is
  chosen). What it plays is the **lobby director**'s (see "Display behaviour" below).
- **Playground** is the panel as described under "Panel layout" below. Entering it shows the Display model (nothing reloads); the frame
  and skin chosen in it are temporary and never change the Display model, which comes back (loaded again only if Playground changed it)
  when Display is entered.
- **Switching**: the header's **Display** button (right of the frame picker, `monitor` icon) and the Display menu's **Playground** button.
  A switch closes popovers, leaves Focus, and resets the camera to the entered mode's own view (a camera moved in one mode never carries
  into the other, also when the switch loads another model). Both modes share the display settings (background, grid, toon, lighting,
  follow) and the voice settings.

**Display camera.** Locked: drag, wheel, pinch and pan do nothing (follow animation still moves it, so a bow keeps the face in view). Its
view is the saved Display camera, else the built-in **bust framing**: from the crown to the upper thighs, the face in the upper third, from
the front at eye level, stored as a view relative to the default framing (`DISPLAY_PRESET` in `lib/viewer/cameraView.ts`: zoom 0.42,
azimuth 0, polar 90°, target 0.23 model heights above the default target). It was matched to the user's lobby screenshot (the eyes at about
19 % of the stage height, the face as wide); on Bianca's four frames in the PGR companion it put the head bone at 25 to 29 % of the height
and the crown within 3 % of the top edge. The same preset is used here; the figures measured on Shukra and Pavo are in `AGENTS.md`.

**Display menu** (the same icon and show/hide rules as Playground's stage menu; five buttons and the icon, 6 × 32 + 5 × 4 = 212 px):

| Control | Icon | Behavior |
|---|---|---|
| Model | `user-round` | **Display model** popover: the frames (two columns) and the chosen frame's skins as the skin strip's thumbnails; choosing a frame shows and saves its default skin, choosing a skin saves it |
| Animations | `list-checks` | **Display animations** popover (below): what the lobby may play on the Display model, by frame; the frame's own animations are always played, other frames' are chosen |
| Adjust camera | `frame` | Unlocks the camera (pressed while adjusting); the **adjust bar** shows at the bottom of the stage: Save (accent), Use built-in, Cancel. Save stores the view as the Display camera; Use built-in removes it and shows the bust framing; Cancel returns to the view it had. A save that did not stick keeps the bar with "Could not save: …" |
| Mute | `volume-2` / `volume-x` | The voice mute (same setting as `M` and the playback popover), pressed while muted |
| Playground | `layout-dashboard` | Switches to Playground |

**Display animations popover** (`add-lobby-pool-menu`): a header line (e.g. "20 actions · 2 idles in Display"), then one section per frame,
the Display frame first ("Shukra · this model", its rows checked, disabled and marked "Always played") and the other frame after it in
the picker's order. A section is a row with the frame's checkbox (check all, clear all, mixed when some), a count ("9 / 10"; "Could
not be read" and disabled when the frame has nothing to offer) and a chevron that folds the list; sections start folded except one that is
partly chosen. Rows: the frame's two idles first (`UiStand1` and `StandAct0101`, the clip name first, "Idle" and the length below), then every
Board action that has a voice line, each with the line's wiki title ("General Greeting 13", the clip name when there is none), the clip
name and its length. A clip without a voice line is not listed. After the Menu sections a **Fight** heading and one section per frame in the same order: the frame's Fight
idle candidates (clip name, length, "once" for a clip that does not loop). The Display frame's own Fight rows start checked and can be unchecked; another frame's start unchecked.
Every change is saved at once for the Display frame; "Use default" (enabled once something is saved) forgets the frame's choice, own Fight clips turned off included. The list scrolls inside the popover; a failed save shows the usual "Could not save" line.

**Keys in Display**: `M` mutes, `C` toggles captions, `R` returns the camera to the Display view; `Esc` ends Adjust camera (like Cancel), else
closes the open popover, else the menu; `Space` and `Enter` are a tap (below), unless focus is on a button, link or other control that uses
them. `←`, `→`, `L`, `F` and `H` do nothing (there is no player, no Focus).

### Display behaviour

```
 open ──▶ ACTION (a pool action + its voice line) ──ends──▶ IDLE ──tap──▶ ACTION …
                    ▲ tap interrupts                          │ (idles go on picking, with no input too)
                    └─────────────────────────────────────────┘
```

- **On open**, and when the Display model is changed from the Display menu, a random Board action starts with its voice line (the model
  is kept invisible until its first frame, so the bind pose is never shown). **Back from Playground** Display idles instead.
- **The pool** is every Board action of the shown frame that has a voice line (up to ten for each of Shukra and Pavo: as many as
  `voice_pairings.json` pairs), always, plus the borrowed ones the user chose in the Animations popover, drawn from a shuffled bag: each
  once before any twice, never the same one twice in a row. A borrowed action plays with the lender's own voice line and caption and looks
  as in Playground (see "How a borrowed clip looks"). With nothing chosen for the frame, its **default** applies (`lobby` in its construct
  config): Shukra borrows every voiced action of **Pavo** and Pavo's idle, and Pavo the same from Shukra (20 actions when all ten are
  paired on both). A change made while Display runs applies at once (`setPool`): the clip that plays goes on, a removed action never
  starts again, an added one joins the current bag. A lender that cannot be read is left out with a console warning and its section reads
  "Could not be read".
- **A tap** on the stage starts the next action, interrupting the one that plays (its line stops, the new action crossfades in). A tap is a
  press and release within 10 px and 500 ms; a press that closes a popover, unpins the menu or happens while the camera is adjusted is not a
  tap; taps closer than 400 ms are ignored; a press on the caption counts (it lets presses through). `Space` and `Enter` do the same.
- **Idle**: three groups of candidates: the frame's own **Fight** clips (`Born`, `Stand1`, `Stand2`, `Standchange`, `Save`, `Win`, and Pavo's `LevelAttack14`), its own
  **Menu** idles (`UiStand1` 3, `StandAct0101` 2) and what the user borrowed from the other frame (by default its two Menu idles). They take 60 %, 30 % and 10 % of the picks,
  renormalized over the groups that are not empty (Shukra's default: each Fight clip 10 %, `UiStand1` 18 %, `StandAct0101` 12 %, Pavo's two idles 6 % and 4 %). A looping
  clip plays whole loops for at least 10 s and the next pick crossfades in at the end of a loop; a clip that does not loop (`Born`, `Standchange`, `Win`, `LevelAttack14`)
  plays once, as an interlude, and the next pick follows. A Fight clip shows the meshes of the Menu idle's rule (Qu hides nothing), has no voice line, and a borrowed one
  hangs its cloth as in the shown model's Fight idle. The loop choice made in Playground never makes an action loop. Leaving Display during a Fight clip opens Playground in Fight with it selected.
- **The next action is prepared** a second after a clip starts (its clip built, its line decoded), so a tap needs no request.
- **No sleep**: Display keeps playing for as long as it is open (it renders at most 30 fps; a closed or hidden panel renders nothing). It always follows the animation,
  whatever Playground's "Follow animation" says, so a low pose never leaves the bust framing; that setting applies again in Playground.
- **Speed**: Display always plays at 1×; the Playground speed comes back with Playground.

## Panel layout (top to bottom)

This is Playground.

1. **Header** — the shown frame's name ("Shukra") with a chevron: the **frame picker** (see "Frames"), and the **Display** button on the right. In normal flow; hidden while Focus is on.
2. **Stage** — the canvas fills all the height the header and skin area leave, with a minimum height of 22 rem (so the stage is never squished below usefulness). No fixed aspect ratio, no card radius, edge to edge. When the panel is shorter than header + minimum stage + skin area, the page scrolls. Overlaid controls: the **stage menu** at the top and the **player** at the bottom.
3. **Skin title row** — skin name (large, bold, e.g. "Generic") and a **DEFAULT** badge in accent text when it's the default
   skin. Hidden while Focus is on. Rarity stars right-aligned are **not built yet**: the data has a coating `quality` (1, 2 or 6) but
   how huaxu draws it is unchecked.
4. **Skin strip** — horizontal scroll of square thumbnails (56 px, rounded, bordered; the selected one with an accent ring, a spinner on
   the tile while it loads). Grouped by kind, each group label written **vertically** (reading bottom-up) before its tiles, and a group
   without skins is not shown: Shukra and Pavo each have one **GENERIC** group with one tile (the type also knows **COATINGS** and
   **CHIBI**). Under the strip, a thin accent **scroll-progress bar** shows the horizontal scroll position (only when the strip overflows).
   It is a radio group: `←/→` (and `↑/↓`) move to the previous or next skin and select it, `Home`/`End` the first or last. Hidden while
   Focus is on (scroll position and selected tile survive); the selected tile is scrolled into view again when Focus is turned off.
   Thumbnails are the huaxu outfit icons (256 px, transparent background) downloaded into `data/<construct>/icons/`; a missing icon shows
   the skin's initials (`G` for Generic) on a tint per group.
5. **Voices tab** — deferred; see "Voices". (The one-tab tab row and the "Models" title are gone: they come back with it, if it does.)

## Animation list

The animation dropdown is a grouped list, as on huaxu (screenshot reference, Menu mode):

```
Idle
    StandAct0101
    UiStand1          ← default when entering Menu
Board actions
    BoardAct0201 … BoardAct1007   (sorted by name)
```

- **Menu** mode lists the clips of the menu context (see `AGENTS.md` → Data contracts):
  `UiStand1` and `StandAct0101` under **Idle**, every `BoardAct*` under **Board actions**.
  Board actions that have a paired voice line show a small speaker glyph (Lucide `volume-2`, muted)
  after the name, read as "with voice" by screen readers.
- **Fight** mode lists a cut-down set of the clips of the fight base controller and its `levels` controllers (Shukra lists 8, Pavo 14),
  grouped by **name**. The groups are ours, not huaxu's (provisional; they live in
  `lib/anim/catalog.ts` and are easy to change). First match wins, groups without clips are left out:

  | Group | Names | Listed |
  |---|---|---|
  | Idle | `Stand*` | all |
  | Movement | `Run*`, `Walk*`, `Move*`, `Jump*`, `Stop*` | only `Run` and `Walk` (not `WalkStart`, `Jump*` ...) |
  | Attacks | `Attack*` | none |
  | Level skills | `LevelAttack*` | only `LevelAttack08_NunWalk`, `LevelAttack11_Loop`, `LevelAttack013Loop`, `LevelAttack14` |
  | Reactions | `Hit*`, `Behitfly`, `Hoverhit`, `Falldown`, `Hitdown`, `Lieonfloor`, `Standup`, `Stun`, `Death` | none |
  | Other | everything else (`Born`, `Win`, `Save` ...) | all |

  The rest stay in the manifest and on disk; only the list leaves them out (`FIGHT_SHOWN` in `catalog.ts`). Items are sorted by name
  with numbers compared by value (`Attack2` before `Attack11`). Of clips that share a name only the one in the base layer (`BaseLayer`, `Base Layer`) is listed when there is one, so layer
  variants of a name never show; when several remain they get their folder in brackets. `Squat*` is never listed. Entering Fight plays the clip of `contexts.fight.idle` (`Stand1`).
- **There is no "Bind pose" item.** The list is clips only. Bind pose still exists as a state of the viewer (a model without a clip set
  stands in it), but nothing in the list selects it.
- A clip's default loop state comes from the manifest's `loop` flag (Board actions: off, idles: on). Until the user touches the loop
  toggle (or `L`), selecting a clip applies that default. **Once they have, their choice sticks**: every clip chosen afterwards,
  in either context and on any skin, plays with it, on or off, until they change it again. A reload starts from the defaults.

- **Placement**: the animation dropdown is in the **player** over the bottom of the stage (full width, full clip name, opens up or down by available room).
  The Fight/Menu toggle is in the **player's top row** (left, next to the hide button).
- **Clips play in place**: when the manifest's root node is above the pelvis, its position track is not applied, so a clip with root
  motion stays at the origin. Qu's root is the pelvis bone `Bip001` itself, whose position carries the pelvis height, so it is applied.
  Other tracks still move the character.
- **Visible meshes** follow the context and clip: `stateHides[<clip>]` when Menu has an entry for the
  playing clip, otherwise the context's `hiddenNodes`. Qu's models hide nothing, so every mesh shows in every state.
- **Frame rate**: while a clip plays the viewer renders at most 30 frames per second (the clips are
  keyed at 30 fps); paused, finished and bind pose render nothing; orbiting still renders at the
  display rate.

## Frames

**Erza**, first in the picker, and Qu's two frames, **Shukra** and **Pavo**, are viewable (until `erza-only-companion` hides Qu's: Qu is where
Erza's motion and voice come from). Shukra's and Pavo's models play each other's animations and voice lines; **Erza's list is lent clips only**
(she has no clip set or voice lines of her own): `Shukra · Idle`, `Shukra · Board actions`, `Pavo · Idle`, … with no group without a prefix, starting
on `Shukra · UiStand1` (Menu) or `Shukra · Stand1` (Fight). Each frame has one skin; Erza's is `Erza Scarlet` with the initials tile `ES` (no icon).
**Display does not offer her**: its Model popover and its Animations popover list Shukra and Pavo only, and a stored Display model of Erza opens on
Shukra's Generic with the stored value untouched. In Playground she is shown like any frame; choosing her leaves the Display model as it was.

- **Frame picker** (built): the header's name ("Shukra ⌄") opens a small dark list of the frames (the shown one marked; arrow keys,
  Enter, Escape). The panel opens on the Display model's frame (Shukra by default). Picking a frame loads its Generic and works like a skin switch: same context, the
  clip of the same name (else the context's default clip), a moved camera, the display settings, voice volume, subtitles, the loop
  choice and mesh choices all carry over.
- **Fight lists of every frame** follow the same cut: base-layer clips only, no Attacks, Reactions or `Squat*`, Movement only `Walk` and
  `Run`, Level skills only the four kept names (Pavo has `LevelAttack14`, Shukra none).
- **Animations from other frames**: after the shown frame's own groups the dropdown lists every other frame's groups, labelled with
  the frame's name, in frame order:

  ```
  Idle                       ← the shown frame's own clips
  Board actions
  Pavo · Idle
  Pavo · Board actions         BoardAct0201 🔊  BoardAct0202 🔊 …
  ```

  The field shows a borrowed clip as `Pavo · BoardAct0201`. Group headers stay visible while the long list scrolls.
- **How a borrowed clip looks**: the body moves as in its own frame (bones matched by name, corrected for the two rest poses, the pelvis
  scaled to the shown model's height; a foot keeps the source foot's turn from its rest pose, so a flat foot stays flat, and a twist bone the source lacks, Erza's calf
  and thigh twists, turns with its calf or thigh); the face takes the source's expressions where the shown face has the same expression. **Hair,
  cloth and helper bones do not swing** on borrowed clips (there is no physics), but they hang as the shown model's own idle has them
  (its mean pose). **On Erza they hold their bind pose** (she has no idle of her own to take a mean from): her skirt, hair and ribbons stand
  stiff, and her face (bone-driven, while Qu's clips animate morph targets) stays still. Known limits, not bugs. **A hand that rests on the hip** rests on the hip of the shown body too, whatever the arm lengths of the two models.
  **Weapons stay in hand**: a prop the shown model holds (Shukra's `Prop1` in the right hand, `Prop2` in the left) stays in that hand for
  the whole clip, instead of following the lending frame's own; a prop that does not sit on a hand at rest (Pavo's) is not driven.
  Meshes shown follow the shown skin's own rule for a clip of that name.
- **Voice of a borrowed Board action**: its own frame's line and subtitle (Pavo's `BoardAct0201` speaks Pavo's line, whichever model
  performs it). When the line outlasts the clip, the shown model's own `UiStand1` takes over until the line ends, as described under
  "Board action + voice"; on Erza, which has none, it is the `UiStand1` of the frame the action comes from, retargeted onto her. A Board action with no paired line plays silently without the speaker glyph.
- **Switching** keeps a borrowed clip by frame and name (`Pavo · BoardAct1005` stays selected on another skin); switching to the clip's
  own frame selects that frame's own clip of the name.

## Board action + voice

Choosing a Board action that has a paired line (`voices.json` → `animation`) plays its
**Japanese** audio together with the clip. There is no separate voice UI.

```
A line shorter than its clip (illustrative: a 32 s clip, a 24 s line)

0 s                         24 s            32 s
├── Board action ─────────────────────────────┤
├── JA line ──────────────────┤ (clip continues silently)
└── scrubber 0 … 32.00 s, readout "12.30 / 32.00 s"

A line longer than its clip (the pairings can give one)

0 s            clip end                     line end
├── Board action ──┤ 0.25 s crossfade
│                  └── UiStand1 (looping) ──┤
├── line ───────────────────────────────────┤
```

- **Timeline** = the longer of clip and audio. When the audio ends first, the clip continues
  silently. When the clip ends first,
  it crossfades (0.25 s) to `UiStand1`, which keeps looping until the timeline ends; the meshes switch
  to `UiStand1`'s hidden-node list at the start of that crossfade.
- **Audio is the master clock** while it plays: the line is decoded once, re-encoded as a PCM WAV and
  played by an `<audio>` element; the timeline time is the element's position (predicted between its
  updates, never running backwards), and the clip is posed from it, never the other way round, so the two
  cannot drift apart. The WAV is what makes this work: the MP3s are VBR without a seek table, so seeking
  them is approximate, while a WAV seeks exactly and `preservesPitch` keeps the pitch at any speed.
- **Scrubbing/seeking** moves audio and clip together; past the end of the line the clip continues
  silently, and past the clip's end (longer lines only) the model shows `UiStand1` at the matching offset.
- **Pause, speed, loop** apply to both. Loop restarts the whole timeline (clip and audio) from 0. Speed
  (0.25× to 2×, playback popover) changes the rate of clip and voice together; the voice keeps its pitch,
  and the idle tail and its crossfade follow the timeline, so they run at that speed too.
- **Subtitles**: while a voiced Board action plays, its English transcript (`voices.json` → `text`) shows as a dark rounded
  caption over the stage, just above the player (at the bottom of the stage while the player is hidden), and never takes clicks from the canvas.
  The data has no timing and the audio is Japanese, so the cues are estimated: the text is cut into sentences (pieces under 24
  characters are joined, over 100 are cut at a comma near the middle) and each gets a share of the time the voice is heard
  (leading and trailing silence trimmed), in proportion to its length plus a short pause allowance; the timing is an estimate. No caption
  shows before the voice starts or later than 0.4 s after it ends, for a clip without a line, or when the line's audio could not be loaded;
  it follows seeking, scrubbing, speed changes and looping, and muting does not hide it.
  On/off: **Subtitles** switch in the settings popover or `C`; on by default and remembered with the voice settings.
- **If the browser will not start the audio** (autoplay policy, or it does not start within 600 ms) the
  timeline runs on without sound at its normal length, with a console warning.
- **Leaving**: choosing another clip, switching to Fight, or closing the panel stops the audio.
- **No pair or missing file** (a Board action with no entry in `voice_pairings.json`): the clip plays silently;
  no error.
- **Skin switch** keeps the selected Board action and restarts it from 0 with its audio.

## Stage menu

One icon (three lines, `menu`, 32 px) in the top-right corner of the stage, flush to the top, 4 px from the edge.
The row of controls appears **to the left of the icon** when visible (the icon is always rightmost), with 4 px gaps between items. The
icon and the row, gaps included, are one hover area, so the pointer can cross the row without the menu closing; the empty area beside
them does not take pointer input from the canvas, and the row is out of the layout (and the keyboard order) while hidden.

**Visibility state machine**: `visible = (hovering || keyFocused || pinned || popoverOpen) && !dismissed`

| State | Trigger | Effect |
|---|---|---|
| `hovering` | pointer enters icon or row | row appears |
| `keyFocused` | `:focus-visible` in the group | row appears |
| `pinned` | press the icon while hidden | row appears; only way on touch |
| `popoverOpen` | a popover is open | row stays |
| `dismissed` | press the icon (X) while visible | row hides; lasts until pointer leaves the group; cleared on `pointerleave` |

While visible the icon shows **X** (close mark); while hidden, three lines. Press the X: unpin, close the open popover, `dismissed = true`. Press outside the menu and its popovers: unpin. `Esc` closes the open popover and returns focus to its trigger button; with no popover open it closes the menu (focus stays on the icon). The icon is first in the keyboard order, so Tab reaches it, the row opens, and Tab then walks the buttons. A touch screen has no hover: its first press pins the menu open and the next hides it.

At 320 px the icon and the seven buttons (parts, lighting, settings, reset camera, screenshot, preferences, Focus) are 8 × 32 + 7 × 4 = 284 px, within the 304 px budget (8 px margin each side); measured at 24 to 308 px on one line.

Button order (left to right in the row):

| Control | Icon | Behavior |
|---|---|---|
| Puzzle | `puzzle` | **Parts** popover below the row |
| Lighting | `sun` | Lighting popover below the row |
| Settings | `settings` | Settings popover below the row |
| Reset camera | `rotate-ccw` | Resets the camera to the default framing, or to the saved default camera; does not touch the clip |
| Screenshot | `camera` | Downloads a PNG of the stage |
| Preferences | `bookmark` | **Preferences** popover below the row (see "Popovers") |
| Focus | `maximize` (enter) / `minimize` (leave) | Toggles Focus (see below) |
| Icon (trigger) | `menu` / `x` | Rightmost; opens/closes the menu |

Popovers open below the menu row (`placement="down"`); closing the menu also closes the open popover.

This is Playground's row. `StageMenu` holds only the icon and the visibility rules; each mode passes its own buttons as the slot (Display's
row is under "Modes").

## Player

A rounded card (`--color-surface`, 12 px padding, shadow) overlaid on the bottom of the stage, 8 px from the sides and bottom.
**Three rows:**

- **Row 1**: `Fight | Menu` segmented toggle on the left; hide button (`chevron-down`) on the right.
- **Row 2**: animation dropdown (full width, full clip name) with a sliders button on the right (playback options popover).
- **Row 3**: play/pause button, scrubber, time readout `9.92 / 10.00 s`, loop toggle.

A playback error shows inside the card (between rows 2 and 3) and forces the player visible if hidden.
The player overlays the bottom of the stage; the model's framing is unchanged (see `AGENTS.md`, "Controls and framing").

## Hide the player

The hide button (`chevron-down`) in the player's top row hides the player and shows a **small handle** (a
`chevron-up` button, 32 px, semi-transparent surface, centred at the stage's bottom) in its place. Pressing
the handle shows the player again. The `H` key toggles between the two states.

- **Nothing is reset**: the camera does not move, the model is not reloaded, the clip keeps playing.
  `Space` and the arrow keys still work while the player is hidden.
- The caption stays at the bottom of the stage (just above the handle) while the player is hidden.
- The choice is **not** remembered: the panel opens with the player shown.
- An error while hidden shows the player immediately.

## Focus

The Focus button (maximize/minimize icon) in the stage menu hides the header and the skin area together,
so the stage fills the whole panel. Pressing it again shows them. The `F` key toggles the same.

- Focus is independent of the player's hidden state.
- Entering or leaving Focus does **not** reload the model or restart the clip.
- A camera the user has moved keeps its position; an untouched camera refits to the new canvas size (the
  `default-camera` `ResizeObserver` takes care of this).
- When Focus is turned off, the strip's selected tile is scrolled into view.
- The choice is **not** remembered: the panel opens with Focus off.

## Interaction details

- **Camera**: drag to orbit, pinch/wheel to zoom, two-finger/right-drag to pan. Orbit target at
  the model's mid-body height. Default framing fits the model's height to the whole stage (the player may cover the feet; hide it to see them).
  Zoom goes towards the point under the pointer and as close as a face close-up (eyes filling the view), however narrow the
  panel; the farthest zoom keeps the model in view. Reset camera returns to the full-body framing. No part of the model ever
  disappears up close (eyes, face), whatever the pose. With "Follow animation" on, the camera keeps the part it looks at in view
  while the clip moves (the head in a face close-up, the pelvis in a full-body view), smoothly; the user's own moves always win.
- **Scrubber**: dragging pauses playback and seeks; releasing restores the previous play state.
  The time readout updates while dragging.
- **Loop off**: clip plays once and holds the last frame; play button shows "play" again.
- **Clip switch**: crossfade ~0.25 s from the current clip; reset time to 0.
- **Skin switch**: the same viewer loads the new model and its own clip set (spinner while it loads; a newer
  pick cancels an older one). It keeps the context and the clip of the same name in that context (or `Bind
  pose`), else plays the context's default clip; a Board action restarts from 0 with its line. A camera the user
  moved keeps its position, otherwise the new model gets its default framing. Speed, lighting, background,
  grid, auto-rotate, wireframe and voice volume carry over. The panel always opens on the default skin, **Generic** (it carries the DEFAULT badge).
- **Screenshot**: opaque PNG of the stage as shown (current pose and camera) over the stage background —
  the gradient, or the solid colour; the gradient when the background is "transparent" — at the stage's size
  in device pixels. File name `<construct>_<skin>_<clip>_<time>.png` with the clip label's unsafe characters
  replaced by `_`, `bindpose` in bind pose, and the time as seconds with two decimals and an `s`, e.g.
  `shukra_r3qumd010011_BoardAct0201_12.30s.png`.
- **Keyboard** (when the panel is focused): `Space` play/pause, `←/→` step 1/30 s while paused,
  `L` toggle loop, `M` mute voice, `C` toggle subtitles, `R` reset camera (camera only; to the saved default camera when there is one),
  `F` toggle Focus, `H` hide or show the player, `Esc` close the open popover.
  `M`, `C`, `R` work from inside an open popover; `F` and `H` are ignored inside one.
  All shortcuts are ignored in text fields, sliders, the open animation list, and with a modifier key held;
  another control may handle the key first.
- **Display settings**: background (mode and colour), grid, follow animation, toon shading and lighting are remembered and are what the panel
  opens with (first open: gradient, grid off, follow on, toon on, light intensity 1 and direction 0°); auto-rotate and wireframe always start
  off and the speed at 1×. Voice volume, mute and subtitles on/off are remembered in their own record. Hidden parts per skin and the default
  camera are saved explicitly (see "Parts" and the Preferences popover).

## Parts

The puzzle button's popover shows and hides the model's meshes, laid out like huaxu's:

- **Hidden by this animation** (only when there is something): the meshes the animation data hides in the current state (the
  alternate-state `EX` copies; the list follows the clip, Fight/Menu and skin). One switch each, off at first; switching one on
  shows it on top of the others (the doubled surfaces are the data's reason for hiding it, so that is the user's call).
- **All meshes**: every other mesh, grouped by the **model id** in its name (Qu's models have one, `010011`; a skin built from several
  would list one group each). Each group has a switch with a `shown/total` count and a chevron that folds its list (all open at first);
  inside, one switch per mesh, labelled with the model's own name without the prefix (`Hair01`, `Weapon`, `Bead`), sorted with numbers
  by value. The group switch is on while every mesh of the group is shown; switching it off hides the whole group (its `EX` copies
  too, so a clip's swap cannot bring it back); switching it on when something is hidden drops the choices for the group and shows what
  is saved or the animation data says.
- **Reset** drops the unsaved choices (disabled while there are none), **Save** keeps the shown state for this skin (disabled while no
  unsaved choice changes this skin; unsaved choices made on other skins are kept for them), and **Forget saved** (shown only while
  something is saved for the skin) removes what is saved and returns to the animation data. The list scrolls inside the popover when it is
  taller than the panel allows. A failed write shows "Could not save" under the buttons.

- A switch shows what is on screen: the user's choice if there is one, else what is saved for the skin, else the animation data's. A choice
  is kept per mesh **name** across clips, Fight/Menu, bind pose, the idle tail of a voiced Board action and skin switches; a name the
  shown skin lacks is ignored but kept. A reload starts with what is saved for the skin and no unsaved choices (what is saved sits under
  them, and a switch shows it). Hiding never changes the default framing, and screenshots show what is on screen.
- There is no Light and Dark form (Crepuscule's was specific to Bianca's models): every model follows the animation data.

## Popovers

Dark rounded cards placed above or below the bar that holds their button (the full width of the bar, so
they always fit the panel), closing on outside click or `Esc`; one at a time; the button is shown pressed.

- **Settings**: "Toon shading" switch first (on until the user switches it off; remembered), then "Subtitles" switch, then background (gradient /
  solid color / transparent checker; remembered), show grid floor (remembered), auto-rotate (a turn in about 30 s, rendered at the 30 fps cap; off
  at every open), follow animation (on until switched off; remembered), wireframe (debug; off at every open).
- **Lighting**: intensity slider, light direction (azimuth slider; default 0, from the front), reset to default. Both drive the
  toon shading too. Remembered.
- **Preferences (`bookmark`)**: "Default camera" (one line of status, "Save current view as default", "Use the built-in default", disabled while
  none is saved), "Display camera" (one line of status: saved or the built-in bust framing; "Use built-in for Display", disabled while none is
  saved; it is adjusted in Display), "Saved parts" (how many skins have some; saved in the Parts popover), "Backup" (Export, Import: a hidden file input), and "Forget
  all", which asks for a second press within 3 s (the label changes to "Press again to confirm"; no modal). An import that is refused shows
  "Not imported: …" in red, a failed write "Could not save: storage is unavailable. Changes last until the panel closes.".
- **Playback (sliders icon)**: speed `0.25× / 0.5× / 1× / 1.5× / 2×`; voice volume slider with a
  mute button (speaker icon) for Board action audio. Volume and mute are remembered across
  sessions.

## Shading

- **Toon shading is the default**: cel bands in each material's own shadow tints with soft edges and a gentle shape where the
  material asks for it (the face stays flat), pale game-like skin (the toon image is tone mapped), a face shadow from the face's threshold
  map (it turns with the head, not with the face's shape), the character's own shadow (bangs on the forehead, chin on the neck),
  stylised highlights on metal and along hair strands, thin outlines in a darker shade of the surface they outline that stay the same
  width on screen. The look is judged against in-game screenshots.
- The **"Toon shading" switch** (settings popover) shows the GLB's original materials without outlines or shadow, at once and
  without reloading. Lighting, wireframe (outlines are left out of it), hidden parts, screenshots, skins and animation work the
  same in both.
- **Metal reflects**: parts the game marks as metal or glossy reflect a dim neutral studio by their own roughness, so polished trims show
  bright and dark bands and enamel soft streaks, and dark metal stays dark. Part of the toon look: off with the switch.
- **Qu's models use the same material parameters** as Bianca's (the PGR shader reads them unchanged), so they render by these rules; how
  close they come to the game is recorded in `AGENTS.md`.
- **Erza's own path** (her materials carry no PGR parameters): the **shadow-colour texture** (`_SH`, the game's flat, darker version of the diffuse
  one) where the surface turns away from the light and the **diffuse texture** where it faces it, with a soft edge a few percent of N·L wide
  (centre 0.1, half-width 0.04); the light direction and intensity are the Lighting popover's. No bands, ramps, highlights, self-shadow or
  tone mapping: the textures are the look. Her **outline** is a thin dark line (about 1.4 px on screen at any zoom, 0.3 of the surface colour)
  from her own geometry. The "Toon shading" switch shows her glTF material (the diffuse texture, lit neutrally) with no outline, as for every
  model. `erza-only-companion` removes the paths that served only PGR models; this one stays.
- Not built: the game's bloom (halo, eye glints; Shukra's model carries a `bloom` pass material that is not drawn; emission brightens the
  surface only, without a glow around it), animated emission, matcap sheen.

## Voices

**Deferred.** Kept here as the target design for a later change; not part of the planned changes.

- Language toggle **EN / JA** at the top (segmented, accent active segment).
- List grouped by category from `voices.json` (exact grouping to follow the real schema).
- Each row: line title, transcript text (muted, wraps), play/stop button on the right.
  Only one line plays at a time; the playing row is highlighted with an accent left border.
- Missing audio for the selected language: disable the play button and show "No audio".

## States

- **Loading model**: stage shows a centered spinner, with a percent only when the loader knows the file size (files served from the extension have no size header, so usually just the spinner); controls disabled.
- **Load error**: stage shows a short message and a Retry button; the rest of the panel stays usable.
- **No clips** (a skin with no manifest *and* no frame lending it clips; none today, kept for models without a clip set; Erza has no manifest
  but is lent every clip, so she is not in this state): the model stands in bind pose
  with nothing hidden; the dropdown reads "No animations" and is disabled, as are play/pause, scrubber, loop, playback options and the
  Fight/Menu toggle; camera, settings, lighting, screenshot and Focus work.
- **Thumbnails missing**: a neutral placeholder tile with the skin's initials.

## Out of scope for now

- Erza's second model (Heaven's Wheel Armor), her sword, her face (bone-driven) and swinging hair, skirt and ribbons; the Erza-only panel
  (`erza-only-companion`).
- Swinging hair and cloth (physics) on clips borrowed from another frame.
- The Voices tab (see "Voices").
- English audio.
- Bloom and the other shading gaps listed under "Shading".
