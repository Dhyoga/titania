# Titania: Fairy Tail Companion

A browser extension that opens a side panel with a 3D viewer for **Erza Scarlet** of *Fairy Tail*. Erza has models but no animations or
voice lines of her own, so her motion and voice come from **Qu** of *Punishing: Gray Raven*, who shares her voice actress. Qu's two frames,
**Shukra** and **Pavo**, supply the clips and the voice lines. Everything is rendered locally with three.js.

Right now the panel shows Qu's two frames themselves, with their Generic skins, animations and voice lines: this is the base that Erza's
models are added to (`add-erza-model`) and that then shows only Erza (`erza-only-companion`). The history is in `openspec/`.

This is a **personal, unofficial fan project**. It is loaded unpacked and will never be published. *Fairy Tail* and Erza Scarlet belong to
their rights holders, and Erza's source models to the game they come from. *Punishing: Gray Raven*, its models, animations and voice lines
belong to Kuro Games. None of these assets is in this repository.

## Two modes

The panel always opens in **Display**, modelled on the game's lobby: the stage fills the whole panel with only a menu icon over it, the
character framed from the crown to the upper thighs on a locked camera.

- When it opens she performs a **Board action with its voice line**, then stands in her idle. **Tap the stage** (or press `Space` or
  `Enter`) and she performs another one, interrupting the first. The actions are the Board actions of the shown frame that have a voice
  line, plus those of the other frame by default (Shukra borrows Pavo's, Pavo borrows Shukra's), each with its own frame's voice line.
- After 2 minutes without input she falls asleep (the pose pauses and nothing is rendered) until the next tap.
- Display always plays at normal speed.

Its menu has five buttons:

- **Model**: choose the frame and skin Display shows. It is saved as soon as you choose it.
- **Animations**: choose which animations Display may play on this model. The frame's own are always played; the other frame's are
  checked one by one or all at once, and saved per Display frame. **Use default** forgets the choice. A change applies while Display runs.
- **Adjust camera**: unlocks the camera (drag, scroll or pinch), then **Save**, **Use built-in** or **Cancel** (`Esc`). The saved view is
  stored relative to the default framing, so it fits every frame, skin and panel size. It is separate from the Playground default camera.
- **Mute**: the voice mute, the same as `M`.
- **Playground**: switch to the full panel.

**Playground** is the full panel described below. It opens on the model Display shows; the frame and skin you pick in it are temporary and
never change the Display model. The header's **Display** button goes back (Display then starts in idle, with no new action). In Display only
`M`, `C`, `R`, `Esc`, `Space` and `Enter` do anything (`R` returns to the Display camera).

## Features

- Two frames (Shukra, Pavo), picked from the header, each with its Generic skin in a skin strip (in Playground). A **Focus** mode hides
  both and the **player** can be hidden too, so the stage can fill the whole panel.
- Menu and Fight animation lists; either frame's model can play the other's clips (retargeted at runtime, nothing is written to `data/`).
- Board actions play with their Japanese voice line and English subtitles, where a line is paired (see "The data").
- Toon shading with outlines, metal reflections and emission (switchable back to the model's own materials).
- Per-mesh show/hide (the puzzle button), lighting, backgrounds, grid, auto-rotate, follow animation (on by default), playback speed
  from 0.25× to 2×, screenshots.
- Orbit, pan and zoom (towards the pointer) with the mouse or touch.
- **Preferences**, kept on this machine: display settings (background, grid, follow animation, toon shading, lighting), hidden parts per skin,
  a default camera, and the Display model, camera and animation choices. See "Preferences" below.

## Keyboard shortcuts

Active while the panel is focused; ignored in text fields, sliders and the open animation list. In Display only `M`, `C`, `R`, `Esc`, `Space` and `Enter` act (`Space` and `Enter` are a tap).

| Key | Action |
|---|---|
| `Space` | Play / pause (in Display: a tap, like `Enter`) |
| `←` / `→` | Step one frame (1/30 s) while paused |
| `L` | Toggle loop |
| `M` | Mute / unmute the voice |
| `C` | Show / hide subtitles |
| `R` | Reset the camera (to your saved default camera, if you saved one) |
| `F` | Focus: hide / show the header and the skin strip |
| `H` | Hide / show the player |
| `Esc` | Close the open popover, otherwise the stage menu |

## Preferences

Kept in the browser's local storage for the extension (key `titania.prefs`), on this machine only (nothing is sent anywhere). The bookmark
button in the stage menu opens them:

- **Remembered as you change them**: background (and its colour), grid, follow animation, toon shading, light intensity and direction.
  Auto-rotate, wireframe and playback speed always start from their defaults. Voice volume, mute and subtitles are remembered separately.
- **Hidden parts per skin**: hide meshes in the Parts menu, then press **Save**. That skin opens with them hidden from the first frame;
  **Forget saved** brings them back, **Reset** drops what you changed since the last save.
- **Default camera** (Playground): orbit and zoom, then **Save current view as default**. It is stored relative to the default framing, so it
  fits every frame, skin and panel size, and it is where the camera goes on open and on reset (`R`). **Use the built-in default** removes it.
- **Display model, camera and animations**: chosen and saved in Display (see "Two modes"); the preferences menu shows whether the Display
  camera is saved and can return it to the built-in framing.
- **Export, Import, Forget all**: a JSON backup (`titania-companion-preferences.json`) of all of the above, because an unpacked extension's
  storage goes when the extension is removed. A file that is not a preferences file is refused and changes nothing. A file exported by the
  PGR companion is accepted: its display settings and cameras apply, and what names frames this project lacks falls back to the defaults.

## Requirements

- [Node.js](https://nodejs.org) 22.18 or newer (the tests run TypeScript directly; developed on 24), [pnpm](https://pnpm.io) and Python 3.
- A Chromium browser with side panel support (Chrome).
- The `data/` folder (not in the repository, git-ignored; about 100 MB). It holds Shukra's and Pavo's Generic models, clips, voice lines and
  icons, in the layout described in [AGENTS.md](AGENTS.md). It is made with the Python scripts in the repository root, which download
  from the wiki the game data comes from, so run them only when you mean to (each documents its usage at the top):

  ```bash
  python3 download_construct.py shukra pavo   # models, icons, voices, saved voices page
  python3 download_animations.py shukra pavo  # clips
  python3 build_voices.py shukra pavo         # each frame's voices.json, from voice_pairings.json
  ```

- The Erza source folders (`Erza Scarlet/`, `Erza Scarlet (Heaven's Wheel Armor)/`) sit in the repository root, git-ignored, and are used from
  `add-erza-model` on.

## The data

Nothing in the downloaded data says which voice line belongs to which Board action, so the pairs are written by hand in
`voice_pairings.json` (clip name to the wiki's line title, per frame) and `build_voices.py` turns them into each frame's `voices.json`. A
Board action without a pair plays silently and is left out of Display. Change a pair, run the script again, rebuild.

## Build and load

```bash
pnpm install
pnpm build        # production build into dist/chrome-mv3
```

Then open `chrome://extensions`, switch on **Developer mode**, choose **Load unpacked** and select `dist/chrome-mv3`. Click the toolbar
icon to open the side panel. After a rebuild, press the reload button on the extension's card.

`pnpm dev` rebuilds into `dist/chrome-mv3-dev` while you work (load that folder instead; it does not open a browser).

### The assets are symlinks

The build does not copy the models: it places symlinks into `data/` inside the build output, so the built extension depends on **this
checkout's absolute path**. If you move the repository, rebuild. If a Chrome version ever refuses the links, set `mode` to `'copy'` in
`wxt.config.ts` (implemented, not yet exercised; it copies about 100 MB).

## Commands

| Command | |
|---|---|
| `pnpm dev` | WXT dev mode |
| `pnpm build` | Production build |
| `pnpm compile` | Type check (`vue-tsc`) |
| `pnpm test` | Unit tests; the data checks skip themselves when `data/` or a `voices.json` is absent |

## Project documents

- [AGENTS.md](AGENTS.md): rules for working in the repository, and the measured facts about the data (formats, rigs, shading).
- [DESIGN.md](DESIGN.md): how the panel looks and behaves.
- `openspec/`: the specs and the history of changes.

Built with [WXT](https://wxt.dev), Vue 3, Tailwind CSS 4 and three.js. The panel is carried over from the PGR companion.
