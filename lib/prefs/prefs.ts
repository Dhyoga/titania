// The user's preferences as one versioned record. Pure TypeScript; the storage itself is the caller's.
// The voice volume, mute and subtitles keep their own record (`lib/voice/voiceSettings.ts`) and are never part of this one.

import { readCameraView, type CameraView } from '../viewer/cameraView.ts'
import { DEFAULT_LIGHTING, LIGHT_AZIMUTH_RANGE, LIGHT_INTENSITY_RANGE } from '../viewer/lighting.ts'

export const PREFS_KEY = 'pgr.prefs'
export const PREFS_VERSION = 1
/** Name of the file "Export" downloads. */
export const PREFS_FILE_NAME = 'bianca-companion-preferences.json'

export const BACKGROUND_MODES = ['gradient', 'solid', 'transparent'] as const
export type BackgroundMode = (typeof BACKGROUND_MODES)[number]

/** Colour a solid background starts with: a pale stage grey that the model's white outfit still stands out from. */
export const DEFAULT_SOLID_COLOR = '#cfd8e6'

/** The display settings that are remembered (not auto-rotate, wireframe or playback speed). */
export interface DisplayPrefs {
  backgroundMode: BackgroundMode
  solidColor: string
  grid: boolean
  follow: boolean
  toon: boolean
  /** Light intensity and direction (`Lighting`). */
  intensity: number
  azimuthDeg: number
}

export type PartChoice = 'hide' | 'show'

export interface SkinPrefs {
  /** Saved show/hide choices by node name, against the skin's default form. */
  parts: Record<string, PartChoice>
}

/**
 * What Display mode shows: its model (frame and skin ids, null for the default) and its camera (relative to the default framing, null
 * for the built-in bust framing). Not under `display`, which holds the viewer's display settings. Whether the ids name a skin Display
 * can show is decided against the construct list (`resolveDisplayModel` in `lib/constructs/display.ts`), not here.
 */
export interface LobbyPrefs {
  frame: string | null
  skin: string | null
  camera: CameraView | null
  /**
   * The borrowed animations chosen for each Display frame (by frame id), as `<lending frame id>:<clip name>`; a frame's own animations
   * are always played and never stored. A frame with no entry has its default (the construct config's `lobby`), an empty list means
   * nothing borrowed. Which keys name a clip that exists is decided against the shown model (`resolvePool`), not here.
   */
  pools: Record<string, string[]>
}

export interface Prefs {
  version: typeof PREFS_VERSION
  display: DisplayPrefs
  /** The default camera relative to the default framing, or null for the built-in default. */
  camera: CameraView | null
  /** Display mode's model and camera. */
  lobby: LobbyPrefs
  /** By skin id (unique across the four frames). */
  skins: Record<string, SkinPrefs>
}

export const DEFAULT_DISPLAY: Readonly<DisplayPrefs> = {
  backgroundMode: 'gradient',
  solidColor: DEFAULT_SOLID_COLOR,
  grid: false,
  follow: true,
  toon: true,
  intensity: DEFAULT_LIGHTING.intensity,
  azimuthDeg: DEFAULT_LIGHTING.azimuthDeg,
}

/** A fresh record with every default. */
export function defaultPrefs(): Prefs {
  return { version: PREFS_VERSION, display: { ...DEFAULT_DISPLAY }, camera: null, lobby: defaultLobby(), skins: {} }
}

export function defaultLobby(): LobbyPrefs {
  return { frame: null, skin: null, camera: null, pools: {} }
}

/** Why an imported file was refused. */
export class PrefsError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
/** A key that would set the prototype of a plain object when assigned. */
const isSafeKey = (key: string): boolean => key !== '__proto__'
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

type Check<T> = (value: unknown) => T | undefined

const checkBoolean: Check<boolean> = (v) => (typeof v === 'boolean' ? v : undefined)
const checkMode: Check<BackgroundMode> = (v) => ((BACKGROUND_MODES as readonly unknown[]).includes(v) ? (v as BackgroundMode) : undefined)
const checkColor: Check<string> = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : undefined)
const checkIntensity: Check<number> = (v) =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, LIGHT_INTENSITY_RANGE.min, LIGHT_INTENSITY_RANGE.max) : undefined
const checkAzimuth: Check<number> = (v) =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, LIGHT_AZIMUTH_RANGE.min, LIGHT_AZIMUTH_RANGE.max) : undefined
const checkPart: Check<PartChoice> = (v) => (v === 'hide' || v === 'show' ? v : undefined)
/** A frame or skin id: a short string, or null for the default. */
const checkId: Check<string | null> = (v) => (v === null || (typeof v === 'string' && v.length > 0 && v.length <= 64) ? v : undefined)

/**
 * Reads one field of a record: absent gives `fallback`; present and unusable gives `fallback` too, or, when `strict`, throws.
 * `null` is a valid value only where `check` returns it (the camera).
 */
function field<T>(source: Record<string, unknown>, key: string, check: Check<T>, fallback: T, strict: boolean, path: string): T {
  if (!(key in source)) return fallback
  const value = check(source[key])
  if (value !== undefined) return value
  if (strict) throw new PrefsError(`"${path}" is not valid`)
  return fallback
}

function readDisplay(raw: unknown, strict: boolean): DisplayPrefs {
  const display = { ...DEFAULT_DISPLAY }
  if (raw === undefined) return display
  if (!isRecord(raw)) {
    if (strict) throw new PrefsError('"display" is not valid')
    return display
  }
  display.backgroundMode = field(raw, 'backgroundMode', checkMode, display.backgroundMode, strict, 'display.backgroundMode')
  display.solidColor = field(raw, 'solidColor', checkColor, display.solidColor, strict, 'display.solidColor')
  display.grid = field(raw, 'grid', checkBoolean, display.grid, strict, 'display.grid')
  display.follow = field(raw, 'follow', checkBoolean, display.follow, strict, 'display.follow')
  display.toon = field(raw, 'toon', checkBoolean, display.toon, strict, 'display.toon')
  display.intensity = field(raw, 'intensity', checkIntensity, display.intensity, strict, 'display.intensity')
  display.azimuthDeg = field(raw, 'azimuthDeg', checkAzimuth, display.azimuthDeg, strict, 'display.azimuthDeg')
  return display
}

function readSkins(raw: unknown, strict: boolean): Record<string, SkinPrefs> {
  const skins: Record<string, SkinPrefs> = {}
  if (raw === undefined) return skins
  if (!isRecord(raw)) {
    if (strict) throw new PrefsError('"skins" is not valid')
    return skins
  }
  for (const [id, entry] of Object.entries(raw)) {
    if (!isSafeKey(id)) continue
    if (!isRecord(entry) || !isRecord(entry.parts)) {
      if (strict) throw new PrefsError(`"skins.${id}" is not valid`)
      continue
    }
    const parts: Record<string, PartChoice> = {}
    for (const [name, choice] of Object.entries(entry.parts)) {
      if (!isSafeKey(name)) continue
      const checked = checkPart(choice)
      if (checked) parts[name] = checked
      else if (strict) throw new PrefsError(`"skins.${id}.parts.${name}" is not valid`)
    }
    if (Object.keys(parts).length > 0) skins[id] = { parts }
  }
  return skins
}

/** The key of a chosen animation: `<frame id>:<clip name>`, short. */
const checkPoolKey: Check<string> = (v) => (typeof v === 'string' && v.length <= 64 && /^[^:]+:.+$/.test(v) ? v : undefined)

/** The chosen animations of each Display frame. Entries that are not a list, and keys that are not `<frame>:<name>`, are dropped (or throw when strict). */
function readPools(raw: unknown, strict: boolean): Record<string, string[]> {
  const pools: Record<string, string[]> = {}
  if (!isRecord(raw)) {
    if (strict) throw new PrefsError('"lobby.pools" is not valid')
    return pools
  }
  for (const [frame, entry] of Object.entries(raw)) {
    if (!isSafeKey(frame)) continue
    if (checkId(frame) === undefined || !Array.isArray(entry)) {
      if (strict) throw new PrefsError(`"lobby.pools.${frame}" is not valid`)
      continue
    }
    const keys: string[] = []
    for (const key of entry) {
      const checked = checkPoolKey(key)
      if (checked === undefined) {
        if (strict) throw new PrefsError(`"lobby.pools.${frame}" holds a value that is not <frame>:<clip>`)
        continue
      }
      if (!keys.includes(checked)) keys.push(checked)
    }
    pools[frame] = keys
  }
  return pools
}

/** `readCameraView` as a field check: `null` is a value, `undefined` means unusable. */
const checkCamera: Check<CameraView | null> = (v) => readCameraView(v)

/** Display mode's record; absent (a record or file from before Display mode) gives the defaults. */
function readLobby(raw: unknown, strict: boolean): LobbyPrefs {
  const lobby = defaultLobby()
  if (raw === undefined) return lobby
  if (!isRecord(raw)) {
    if (strict) throw new PrefsError('"lobby" is not valid')
    return lobby
  }
  lobby.frame = field(raw, 'frame', checkId, lobby.frame, strict, 'lobby.frame')
  lobby.skin = field(raw, 'skin', checkId, lobby.skin, strict, 'lobby.skin')
  lobby.camera = field(raw, 'camera', checkCamera, lobby.camera, strict, 'lobby.camera')
  if ('pools' in raw) lobby.pools = readPools(raw.pools, strict)
  return lobby
}

function readPrefs(raw: unknown, strict: boolean): Prefs {
  if (!isRecord(raw)) {
    if (strict) throw new PrefsError('This is not a preferences file')
    return defaultPrefs()
  }
  if (raw.version !== PREFS_VERSION) {
    if (strict) throw new PrefsError('This is not a preferences file (unknown version)')
    return defaultPrefs() // a record of an unknown version is not read; the next save replaces it
  }
  return {
    version: PREFS_VERSION,
    display: readDisplay(raw.display, strict),
    camera: field(raw, 'camera', checkCamera, null, strict, 'camera'),
    lobby: readLobby(raw.lobby, strict),
    skins: readSkins(raw.skins, strict),
  }
}

/** Preferences from stored text. Anything missing or unusable falls back to the default for that field; never throws. */
export function parsePrefs(text: string | null | undefined): Prefs {
  if (!text) return defaultPrefs()
  try {
    return readPrefs(JSON.parse(text), false)
  } catch {
    return defaultPrefs()
  }
}

/** Preferences from an imported file. A file that is not a preferences record (or has a field of the wrong type) is an error. */
export function importPrefs(text: string): Prefs {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new PrefsError('This is not a preferences file (it is not valid JSON)')
  }
  return readPrefs(raw, true)
}

/** The text to store or export: exactly the record's fields, nothing else. */
export function serializePrefs(prefs: Prefs): string {
  const { display, camera, lobby, skins } = prefs
  return JSON.stringify({ version: PREFS_VERSION, display: { ...display }, camera, lobby: { ...lobby, pools: copyPools(lobby.pools) }, skins }, null, 2)
}

const copyPools = (pools: Readonly<Record<string, readonly string[]>>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(pools).map(([frame, keys]) => [frame, [...keys]]))

/** The record with one Display frame's chosen animations replaced; null forgets them (the frame's default applies again). */
export function withPool(prefs: Prefs, frame: string, keys: readonly string[] | null): Prefs {
  if (!isSafeKey(frame)) return prefs
  const pools = copyPools(prefs.lobby.pools)
  if (keys === null) delete pools[frame]
  else pools[frame] = [...new Set(keys)]
  return { ...prefs, lobby: { ...prefs.lobby, pools } }
}

/** The record with one skin's saved parts replaced; none (or no entries) removes the skin. Other skins are untouched. */
export function withSkinParts(prefs: Prefs, skinId: string, parts: Readonly<Record<string, PartChoice>> | null): Prefs {
  const skins = { ...prefs.skins }
  if (!isSafeKey(skinId)) return prefs
  if (parts && Object.keys(parts).length > 0) skins[skinId] = { parts: { ...parts } }
  else delete skins[skinId]
  return { ...prefs, skins }
}

/** Whether two display records hold the same settings. */
export function sameDisplay(a: Readonly<DisplayPrefs>, b: Readonly<DisplayPrefs>): boolean {
  return (
    a.backgroundMode === b.backgroundMode &&
    a.solidColor === b.solidColor &&
    a.grid === b.grid &&
    a.follow === b.follow &&
    a.toon === b.toon &&
    a.intensity === b.intensity &&
    a.azimuthDeg === b.azimuthDeg
  )
}

/** How many skins have saved parts. */
export function savedSkinCount(prefs: Prefs): number {
  return Object.keys(prefs.skins).length
}
