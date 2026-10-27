// Timeline of a clip that plays with a voice line. Pure TypeScript: no three.js, no Vue, no extension APIs.
//
// The timeline is as long as the longer of clip and audio. While the clip lasts, the model shows the clip at the
// timeline time. If the audio is longer, the clip holds its last frame and the idle clip fades in over `fade` seconds,
// then loops until the timeline ends. `sample` depends only on the time, so seeking gives the same pose as playing.

export interface VoiceTimelineOptions {
  clipDuration: number
  audioDuration: number
  /** Length of the idle clip that fills the time after the clip (it loops). */
  idleDuration: number
  /** Crossfade from the clip into the idle clip, in seconds. */
  fade?: number
}

export interface TimelineSample {
  /** `clip` while the clip plays; `idle` from the moment the clip has ended. */
  segment: 'clip' | 'idle'
  main: { time: number; weight: number }
  /** Null while the clip plays. */
  idle: { time: number; weight: number } | null
}

export interface VoiceTimeline {
  duration: number
  clipDuration: number
  /** Pose at timeline time `t` (clamped to `[0, duration]`). */
  sample(t: number): TimelineSample
}

const DEFAULT_FADE = 0.25

export function voiceTimeline(options: VoiceTimelineOptions): VoiceTimeline {
  const { clipDuration, audioDuration, idleDuration } = options
  const fade = options.fade ?? DEFAULT_FADE
  for (const [name, value] of Object.entries({ clipDuration, audioDuration, idleDuration })) {
    if (!(value > 0) || !Number.isFinite(value)) throw new Error(`voiceTimeline: ${name} must be a positive number, got ${value}`)
  }
  const duration = Math.max(clipDuration, audioDuration)

  return {
    duration,
    clipDuration,
    sample(t: number): TimelineSample {
      const time = Math.min(Math.max(t, 0), duration)
      // Without a tail (audio not longer than the clip) the end of the timeline is the clip's last frame.
      if (time < clipDuration || duration === clipDuration) return { segment: 'clip', main: { time, weight: 1 }, idle: null }
      const since = time - clipDuration
      const w = fade > 0 ? Math.min(1, since / fade) : 1
      return {
        segment: 'idle',
        main: { time: clipDuration, weight: 1 - w },
        idle: { time: since % idleDuration, weight: w },
      }
    },
  }
}
