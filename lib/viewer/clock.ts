// A clock that drives a clip from outside the mixer (the voice line's audio clock). No Web Audio, three.js or Vue here:
// the viewer only needs this interface. `lib/voice/AudioClock.ts` implements it.

export interface TimelineClock {
  /** Length of the timeline in seconds. */
  readonly duration: number
  /** Seconds on the timeline, in `[0, duration]`. Reading it also notices the end of the timeline. */
  time(): number
  readonly playing: boolean
  /** Reached the end with loop off; holds there until `play` (which restarts at 0) or `seek`. */
  readonly finished: boolean
  readonly loop: boolean
  /** Start or resume. From `finished`, restart at 0. */
  play(): void
  pause(): void
  seek(seconds: number): void
  setLoop(loop: boolean): void
  /** Speed multiplier (1 = real time). The timeline time stays where it is. */
  setRate(rate: number): void
  /** Voice output level (0 to 1) and mute; silence does not stop the clock. */
  setOutput(output: { volume: number; muted: boolean }): void
  /** Called after play, pause, seek, loop changes, a loop wrap and the finish. */
  onChange(handler: (() => void) | null): void
  /** Stop for good: silence, release the audio, cancel timers. */
  dispose(): void
}
