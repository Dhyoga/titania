import { speechSpan, type SpeechSpan } from '~/lib/voice/subtitles'
import { encodeWav } from '~/lib/voice/wav'

/** A decoded voice line ready to play: an `<audio>` element on a WAV made from it. */
export interface VoiceLine {
  el: HTMLAudioElement
  /** Length of the decoded audio in seconds. */
  duration: number
  /** Where the voice is heard within the line (silence trimmed at both ends), for subtitle timing. */
  speech: SpeechSpan
  /** Stop the element and revoke its object URL. Safe to call twice. */
  release(): void
}

/** Compressed bytes of lines already fetched, by URL (all ten shipped lines are about 2 MB together). */
export type LineBytes = Map<string, ArrayBuffer>

// The shipped lines are 48 kHz; the offline context resamples anything else to this.
const DECODE_RATE = 48000

/**
 * Fetch a line (or take its bytes from `cache`), decode it without a running audio context, re-encode it as PCM WAV
 * (exact seeks, pitch-preserving speed on an element) and wait until the element can play through.
 */
export async function loadVoiceLine(url: string, cache: LineBytes, signal: AbortSignal): Promise<VoiceLine> {
  let bytes = cache.get(url)
  if (!bytes) {
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    bytes = await res.arrayBuffer()
    cache.set(url, bytes)
  }
  const decoded = await new OfflineAudioContext(1, 1, DECODE_RATE).decodeAudioData(bytes.slice(0)) // decoding detaches its input
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, c) => decoded.getChannelData(c))
  const objectUrl = URL.createObjectURL(new Blob([encodeWav(channels, decoded.sampleRate)], { type: 'audio/wav' }))

  const el = new Audio()
  let released = false
  const release = (): void => {
    if (released) return
    released = true
    el.pause()
    el.removeAttribute('src')
    el.load() // drops the media resource
    URL.revokeObjectURL(objectUrl)
  }
  el.preload = 'auto'
  el.preservesPitch = true // speed changes must not change the pitch
  try {
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => reject(new DOMException('Voice line load was aborted', 'AbortError'))
      if (signal.aborted) return onAbort()
      signal.addEventListener('abort', onAbort, { once: true })
      el.addEventListener('canplaythrough', () => resolve(), { once: true })
      el.addEventListener('error', () => reject(new Error(`audio element error ${el.error?.code ?? ''}`)), { once: true })
      el.src = objectUrl
    })
  } catch (err) {
    release()
    throw err
  }
  return { el, duration: decoded.duration, speech: speechSpan(channels, decoded.sampleRate), release }
}
