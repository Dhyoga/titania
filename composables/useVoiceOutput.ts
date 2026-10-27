import { ref, watch, type Ref } from 'vue'
import { DEFAULT_VOICE_SETTINGS, parseVoiceSettings, serializeVoiceSettings, VOICE_SETTINGS_KEY, type VoiceSettings } from '~/lib/voice/voiceSettings'
import type { ViewerSession } from './useViewer'

/** Stored settings, or the defaults when storage is missing, blocked or holds something unusable. */
function readStored(): VoiceSettings {
  try {
    return parseVoiceSettings(localStorage.getItem(VOICE_SETTINGS_KEY))
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS } // storage can throw in private windows or with blocked site data
  }
}

/**
 * Voice volume and mute, remembered across sessions and pushed to the viewer (which applies them to the line
 * playing now and every later one). Unmuting restores the slider's volume: mute does not touch the volume.
 * Also remembers whether subtitles are shown; that one is for the panel only and never reaches the viewer.
 */
export function useVoiceOutput(session: Ref<ViewerSession | null>) {
  const stored = readStored()
  /** 0 to 1. */
  const volume = ref(stored.volume)
  const muted = ref(stored.muted)
  const subtitles = ref(stored.subtitles)

  watch(
    [volume, muted, session],
    () => session.value?.viewer.setVoiceOutput({ volume: volume.value, muted: muted.value }),
    { immediate: true },
  )
  watch([volume, muted, subtitles], () => {
    try {
      localStorage.setItem(VOICE_SETTINGS_KEY, serializeVoiceSettings({ volume: volume.value, muted: muted.value, subtitles: subtitles.value }))
    } catch {
      // not remembered this time; the controls still work
    }
  })

  function toggleMute(): void {
    muted.value = !muted.value
  }

  function toggleSubtitles(): void {
    subtitles.value = !subtitles.value
  }

  return { volume, muted, subtitles, toggleMute, toggleSubtitles }
}

export type VoiceOutputApi = ReturnType<typeof useVoiceOutput>
