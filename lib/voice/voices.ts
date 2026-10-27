// Voice line metadata (`<construct>/voices.json`): types, validation and the Board action pairing.
// Pure TypeScript: no three.js, no Vue, no extension APIs. Only the fields the app uses are validated; errors name the
// field path, e.g. `entries[3].file`, like the manifest parser.

export interface VoiceEntry {
  id: string
  /** File name inside `voices_<audioLang>/`. */
  file: string
  /** The wiki's title of the line ("General Greeting 12"); absent when the entry has none. */
  title?: string
  /** Transcript (`textLang`, not the audio's language); absent when the entry has none. */
  text?: string
  /** Name of the clip that plays with this line (Board actions only). */
  animation?: string
}

export interface Voices {
  /** Language of the audio files; the folder is `voices_<audioLang>`. */
  audioLang: string
  entries: VoiceEntry[]
  /** Clip name -> paired entry. */
  byAnimation: Map<string, VoiceEntry>
}

function fail(path: string, problem: string): never {
  throw new Error(`voices.json ${path}: ${problem}`)
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'expected an object')
  return value as Record<string, unknown>
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value === '') fail(path, 'expected a non-empty string')
  return value
}

/** Validate `voices.json`. A second entry for an animation is ignored with a warning; the first one wins. */
export function parseVoices(raw: unknown, warn: (message: string) => void = console.warn): Voices {
  const root = object(raw, '(root)')
  const audioLang = string(root.audioLang, 'audioLang')
  if (!/^[a-z]{2,3}$/.test(audioLang)) fail('audioLang', `unexpected language code "${audioLang}"`)
  if (!Array.isArray(root.entries)) fail('entries', 'expected a list')

  const entries: VoiceEntry[] = root.entries.map((item, i) => {
    const e = object(item, `entries[${i}]`)
    const file = string(e.file, `entries[${i}].file`)
    if (file.includes('/') || file.includes('\\')) fail(`entries[${i}].file`, `"${file}" must be a file name, not a path`)
    const entry: VoiceEntry = { id: string(e.id, `entries[${i}].id`), file }
    if (typeof e.title === 'string' && e.title.trim() !== '') entry.title = e.title.trim()
    if (typeof e.text === 'string' && e.text.trim() !== '') entry.text = e.text.trim()
    if (e.animation !== undefined) entry.animation = string(e.animation, `entries[${i}].animation`)
    return entry
  })

  const byAnimation = new Map<string, VoiceEntry>()
  for (const entry of entries) {
    if (!entry.animation) continue
    const existing = byAnimation.get(entry.animation)
    if (existing) warn(`voices.json: ${entry.animation} is paired with ${existing.id} and ${entry.id}; using ${existing.id}`)
    else byAnimation.set(entry.animation, entry)
  }
  return { audioLang, entries, byAnimation }
}

/** The line that plays with clip `clipName`, if any. */
export function voiceFor(voices: Voices, clipName: string): VoiceEntry | undefined {
  return voices.byAnimation.get(clipName)
}

/** Asset path (under `/<constructId>/`) of a line's audio file. */
export function voiceAudioPath(voices: Voices, entry: VoiceEntry): string {
  return `voices_${voices.audioLang}/${entry.file}`
}
