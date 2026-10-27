// Voice volume, mute and subtitles on/off as remembered between sessions. Pure TypeScript; the storage itself is the caller's.

export interface VoiceSettings {
  /** 0 to 1. */
  volume: number
  muted: boolean
  /** Show the subtitle of a voiced Board action. */
  subtitles: boolean
}

export const DEFAULT_VOICE_SETTINGS: Readonly<VoiceSettings> = { volume: 1, muted: false, subtitles: true }
export const VOICE_SETTINGS_KEY = 'pgr.voice'

/** Settings from stored text. Anything missing or unusable falls back to the default for that field; never throws. */
export function parseVoiceSettings(text: string | null | undefined): VoiceSettings {
  const settings = { ...DEFAULT_VOICE_SETTINGS }
  if (!text) return settings
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return settings
  }
  if (typeof raw !== 'object' || raw === null) return settings
  const { volume, muted, subtitles } = raw as Record<string, unknown>
  if (typeof volume === 'number' && Number.isFinite(volume)) settings.volume = Math.min(Math.max(volume, 0), 1)
  if (typeof muted === 'boolean') settings.muted = muted
  if (typeof subtitles === 'boolean') settings.subtitles = subtitles
  return settings
}

export function serializeVoiceSettings(settings: VoiceSettings): string {
  return JSON.stringify({ volume: settings.volume, muted: settings.muted, subtitles: settings.subtitles })
}
