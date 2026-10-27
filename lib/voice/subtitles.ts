// Subtitle cues for a voice line. Pure TypeScript: no three.js, no Vue, no browser globals.
//
// `voices.json` holds one English transcript per line and no timing, and the audio is Japanese, so the cues are an
// estimate: the text is cut into sentences and each gets a share of the time the voice is heard, in proportion to its
// length (plus a small allowance for the pause that ends it). Cue edges can be off by a second or so; they are meant to
// keep the reader roughly in step, not to be frame accurate.

export interface Cue {
  /** Seconds on the line's timeline (the audio's own time, 0 at the start of the file). */
  start: number
  end: number
  text: string
}

export interface SpeechSpan {
  start: number
  end: number
}

/** Pieces shorter than this are joined to their neighbour ("Huh?" alone is not worth a cue). */
const MIN_CUE_CHARS = 24
/** Pieces longer than this are cut near their middle; at the panel's width it is about three lines. */
const MAX_CUE_CHARS = 100
/** Allowance, in characters of speech, for the pause after a cue. */
const PAUSE_CHARS = { sentence: 6, ellipsis: 10, none: 0 } as const
/** A sample quieter than this counts as silence when looking for where the voice starts and stops. */
const SILENCE_LEVEL = 0.02
/** The last cue stays up this long after the voice has finished. */
const HOLD_AFTER_SPEECH = 0.4

/** Sentences of `text`: cut after `.`, `!`, `?` or `…` (and a closing quote or bracket) that is followed by a space. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…]["”')\]]*)\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function joinShort(pieces: string[]): string[] {
  const out: string[] = []
  let buffer = ''
  for (const piece of pieces) {
    buffer = buffer ? `${buffer} ${piece}` : piece
    if (buffer.length >= MIN_CUE_CHARS) {
      out.push(buffer)
      buffer = ''
    }
  }
  if (buffer) {
    if (out.length) out[out.length - 1] += ` ${buffer}`
    else out.push(buffer)
  }
  return out
}

/** Cut a long piece at the comma (else the space) nearest its middle, repeatedly, until every part is short enough. */
function cutLong(piece: string): string[] {
  if (piece.length <= MAX_CUE_CHARS) return [piece]
  const middle = piece.length / 2
  const nearest = (re: RegExp): number => {
    let best = -1
    for (const m of piece.matchAll(re)) {
      const at = m.index + m[0].length
      if (at > 12 && at < piece.length - 12 && (best < 0 || Math.abs(at - middle) < Math.abs(best - middle))) best = at
    }
    return best
  }
  const at = nearest(/[,;:]\s+/g) >= 0 ? nearest(/[,;:]\s+/g) : nearest(/\s+/g)
  if (at < 0) return [piece]
  return [...cutLong(piece.slice(0, at).trim()), ...cutLong(piece.slice(at).trim())]
}

function pauseFor(text: string): number {
  if (/(\.\.\.|…)["”')\]]*$/.test(text)) return PAUSE_CHARS.ellipsis
  if (/[.!?]["”')\]]*$/.test(text)) return PAUSE_CHARS.sentence
  return PAUSE_CHARS.none
}

/**
 * Cues for `text` spread over the time the voice is heard (`speech`, within a line of `audioDuration` seconds). Cues
 * touch: each one stays up until the next begins. Empty text gives no cues.
 */
export function buildCues(text: string, audioDuration: number, speech?: SpeechSpan): Cue[] {
  const pieces = joinShort(sentences(text.replace(/\s+/g, ' ').trim())).flatMap(cutLong)
  if (pieces.length === 0 || !(audioDuration > 0)) return []
  const start = Math.min(Math.max(speech?.start ?? 0, 0), audioDuration)
  const end = Math.min(Math.max(speech?.end ?? audioDuration, start), audioDuration)
  const weights = pieces.map((p) => p.length + pauseFor(p))
  const total = weights.reduce((a, b) => a + b, 0)

  const cues: Cue[] = []
  let used = 0
  pieces.forEach((piece, i) => {
    const from = start + ((end - start) * used) / total
    used += weights[i]!
    cues.push({ start: from, end: start + ((end - start) * used) / total, text: piece })
  })
  return cues
}

/** The cue to show at line time `t`, or null before the voice starts and after it has finished. */
export function cueAt(cues: readonly Cue[], t: number): Cue | null {
  const last = cues[cues.length - 1]
  if (!last || t < cues[0]!.start || t >= last.end + HOLD_AFTER_SPEECH) return null
  for (let i = cues.length - 1; i >= 0; i--) if (t >= cues[i]!.start) return cues[i]!
  return null
}

/** Where the voice starts and stops: the first and last sample louder than a silence threshold, in seconds. */
export function speechSpan(channels: readonly Float32Array[], sampleRate: number): SpeechSpan {
  const length = channels[0]?.length ?? 0
  const loud = (i: number): boolean => channels.some((c) => Math.abs(c[i]!) > SILENCE_LEVEL)
  let first = 0
  while (first < length && !loud(first)) first++
  if (first === length) return { start: 0, end: length / sampleRate } // all silence: no trimming
  let last = length - 1
  while (last > first && !loud(last)) last--
  return { start: first / sampleRate, end: (last + 1) / sampleRate }
}
