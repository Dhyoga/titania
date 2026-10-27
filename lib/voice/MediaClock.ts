// Voice line playback whose position is the timeline clock (see lib/viewer/clock.ts). No three.js, no Vue.
//
// The line is an `<audio>` element playing a PCM WAV made from the decoded line: it seeks exactly and, with
// `preservesPitch`, plays at another speed without changing the pitch. The timeline time is the element's position. In
// Chromium `currentTime` changes on every animation frame, but an element may report it in steps, so the clock predicts
// between updates:
//   time = base + (now - stamp) * rate
// and each time the element reports a new position the prediction is corrected (pulled a fifth of the way, or snapped
// when more than SNAP_S off). The returned time never runs backwards except on a seek or a loop wrap, so the clip,
// posed from it, cannot stutter back, and it cannot drift from the voice.
//
// After `play()` the clock waits, frozen, for the element's `playing` event so the clip does not run ahead of the first
// sound. If the browser refuses to start the audio, or it does not start in time, the clock runs without sound (`onSilent`).
// Past the end of the audio (a timeline longer than the line) it runs on its own. Element and clock are injected so the
// logic runs in Node tests with fakes.
import type { TimelineClock } from '../viewer/clock.ts'

export interface MediaElementLike {
  currentTime: number
  playbackRate: number
  volume: number
  muted: boolean
  readonly paused: boolean
  readonly ended: boolean
  play(): Promise<void>
  pause(): void
  addEventListener(type: 'playing' | 'ended', listener: () => void): void
  removeEventListener(type: 'playing' | 'ended', listener: () => void): void
}

export interface Timers {
  set(callback: () => void, ms: number): unknown
  clear(handle: unknown): void
}

export type SilentReason = 'rejected' | 'timeout'

export interface MediaClockOptions {
  /** Timeline length; at least the audio's. */
  duration: number
  /** Length of the audio in the element. */
  audioDuration: number
  loop: boolean
  /** Milliseconds, any origin; defaults to `performance.now`. */
  now?: () => number
  timers?: Timers
  /** Called once if the audio cannot be heard: the browser refused to start it, or it did not start in time. */
  onSilent?: (reason: SilentReason) => void
  /** Called by `dispose` after the element is stopped (revoke the object URL here). */
  release?: () => void
}

// A correction bigger than this snaps to the element; smaller ones are blended in.
const SNAP_S = 0.08
const PULL = 0.2
// How long to wait for the element to start playing before running without sound.
const ARM_TIMEOUT_MS = 600
// The end timer fires a little late on purpose, so the timeline has really reached its end when it is checked.
const END_SLACK_MS = 5

const defaultTimers: Timers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export class MediaClock implements TimelineClock {
  readonly duration: number
  private readonly el: MediaElementLike
  private readonly audioDuration: number
  private readonly now: () => number
  private readonly timers: Timers
  private readonly onSilent: ((reason: SilentReason) => void) | undefined
  private readonly release: (() => void) | undefined
  /** Timeline time at `stamp` (while playing), else the current time. */
  private base = 0
  private stamp = 0
  private rate = 1
  private _playing = false
  private _finished = false
  private _loop: boolean
  /** Waiting for the element's `playing` event. */
  private arming = false
  /** The element is playing inside the audio and is the authority for the position. */
  private live = false
  private lastRead = -1
  private lastReturned = 0
  private silentReported = false
  private endTimer: unknown = null
  private armTimer: unknown = null
  private disposed = false
  private changeHandler: (() => void) | null = null

  constructor(el: MediaElementLike, options: MediaClockOptions) {
    if (!(options.duration >= options.audioDuration)) {
      throw new Error(`MediaClock: duration ${options.duration} is shorter than the audio (${options.audioDuration})`)
    }
    this.el = el
    this.duration = options.duration
    this.audioDuration = options.audioDuration
    this._loop = options.loop
    this.now = options.now ?? (() => performance.now())
    this.timers = options.timers ?? defaultTimers
    this.onSilent = options.onSilent
    this.release = options.release
    el.addEventListener('playing', this.handlePlaying)
    el.addEventListener('ended', this.handleEnded)
  }

  get playing(): boolean {
    return this._playing
  }

  get finished(): boolean {
    return this._finished
  }

  get loop(): boolean {
    return this._loop
  }

  time(): number {
    if (!this._playing) return this.base
    if (this.arming) return this.base // waiting for the first sound
    const now = this.now()
    const predicted = this.base + ((now - this.stamp) / 1000) * this.rate
    let t = predicted
    if (this.live) {
      if (predicted >= this.audioDuration || this.el.ended) {
        this.live = false // the line is over; the clock runs on its own from here
      } else if (this.el.currentTime !== this.lastRead) {
        const measured = this.el.currentTime
        this.lastRead = measured
        const diff = measured - predicted
        t = Math.abs(diff) > SNAP_S ? measured : predicted + PULL * diff
        this.base = t
        this.stamp = now
      }
    }
    if (t >= this.duration) {
      this.reachEnd(t)
      return this._playing ? this.currentPosition() : this.base
    }
    if (t < this.lastReturned) return this.lastReturned // never backwards
    this.lastReturned = t
    return t
  }

  play(): void {
    if (this.disposed || this._playing) return
    if (this._finished) {
      this._finished = false
      this.base = 0
    }
    this._playing = true
    this.stamp = this.now()
    this.lastReturned = this.base
    this.startAudio()
    this.scheduleEnd()
    this.emit()
  }

  pause(): void {
    if (!this._playing) return
    const t = this.time() // may finish or wrap first
    if (!this._playing) return
    this.stopAudio()
    this.clearTimers()
    this.base = t
    this._playing = false
    this.emit()
  }

  seek(seconds: number): void {
    if (this.disposed) return
    const t = Math.min(Math.max(seconds, 0), this.duration)
    this._finished = false
    this.base = t
    this.stamp = this.now()
    this.lastReturned = t
    if (this._playing) {
      if (t < this.audioDuration) {
        if (this.live && !this.el.paused && !this.el.ended) {
          this.el.currentTime = t // keeps playing from the new position
          this.lastRead = this.el.currentTime
        } else {
          this.startAudio()
        }
      } else {
        this.stopAudio()
      }
      this.scheduleEnd()
    }
    this.emit()
  }

  setLoop(loop: boolean): void {
    this._loop = loop
    this.emit()
  }

  setRate(rate: number): void {
    if (this.disposed || !(rate > 0)) return
    const t = this.time()
    this.base = t
    this.stamp = this.now()
    this.rate = rate
    this.el.playbackRate = rate
    if (this._playing) this.scheduleEnd()
  }

  setOutput(output: { volume: number; muted: boolean }): void {
    this.el.volume = Math.min(Math.max(output.volume, 0), 1)
    this.el.muted = output.muted
  }

  onChange(handler: (() => void) | null): void {
    this.changeHandler = handler
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.stopAudio()
    this.clearTimers()
    this._playing = false
    this.el.removeEventListener('playing', this.handlePlaying)
    this.el.removeEventListener('ended', this.handleEnded)
    this.changeHandler = null
    this.release?.()
  }

  /** The timeline position right now, from the current anchor (after the anchor was moved by a wrap). */
  private currentPosition(): number {
    const t = this.base + ((this.now() - this.stamp) / 1000) * this.rate
    this.lastReturned = Math.max(this.lastReturned, t)
    return this.lastReturned
  }

  /** Start the element at `base` and wait for it to play. A timeline position past the audio needs no element. */
  private startAudio(): void {
    this.stopAudio()
    if (this.base >= this.audioDuration) return
    this.el.playbackRate = this.rate
    this.el.currentTime = this.base
    this.lastRead = this.el.currentTime
    this.arming = true
    this.armTimer = this.timers.set(() => {
      this.armTimer = null
      if (this.arming) this.goSilent('timeout')
    }, ARM_TIMEOUT_MS)
    this.el.play().catch(() => {
      if (this.arming || this.live) this.goSilent('rejected')
    })
  }

  private stopAudio(): void {
    this.arming = false
    this.live = false
    if (this.armTimer !== null) this.timers.clear(this.armTimer)
    this.armTimer = null
    if (!this.el.paused) this.el.pause()
  }

  /** Run on without sound from the current position. */
  private goSilent(reason: SilentReason): void {
    if (!this._playing || this.disposed) return
    const t = this.arming ? this.base : this.time()
    this.arming = false
    this.live = false
    if (this.armTimer !== null) this.timers.clear(this.armTimer)
    this.armTimer = null
    if (!this.el.paused) this.el.pause()
    this.base = t
    this.stamp = this.now()
    this.lastReturned = Math.max(this.lastReturned, t)
    if (!this.silentReported) {
      this.silentReported = true
      this.onSilent?.(reason)
    }
    this.scheduleEnd()
  }

  private reachEnd(t: number): void {
    if (this._loop) {
      this.base = (t - this.duration) % this.duration // carry the overshoot so the clock stays on time
      this.stamp = this.now()
      this.lastReturned = this.base
      // A wrap is not a user action: a line the browser refused to play stays silent instead of waiting again.
      if (this.base < this.audioDuration && !this.silentReported) this.startAudio()
      else this.stopAudio()
      this.scheduleEnd()
    } else {
      this.stopAudio()
      this.clearTimers()
      this.base = this.duration
      this.lastReturned = this.duration
      this._playing = false
      this._finished = true
    }
    this.emit()
  }

  private scheduleEnd(): void {
    if (this.endTimer !== null) this.timers.clear(this.endTimer)
    const t = this.arming ? this.base : this.currentPosition()
    const ms = Math.max(0, ((this.duration - t) / this.rate) * 1000) + END_SLACK_MS
    this.endTimer = this.timers.set(() => {
      this.endTimer = null
      if (!this._playing) return
      this.time() // finishes or wraps when due
      if (this._playing && this.endTimer === null) this.scheduleEnd() // fired early (or while waiting for sound): wait again
    }, ms)
  }

  private clearTimers(): void {
    if (this.endTimer !== null) this.timers.clear(this.endTimer)
    if (this.armTimer !== null) this.timers.clear(this.armTimer)
    this.endTimer = null
    this.armTimer = null
  }

  private readonly handlePlaying = (): void => {
    if (!this.arming || this.disposed) return
    this.arming = false
    if (this.armTimer !== null) this.timers.clear(this.armTimer)
    this.armTimer = null
    this.live = true
    this.base = this.el.currentTime // the first sound is at the element's position
    this.stamp = this.now()
    this.lastRead = this.el.currentTime
    this.lastReturned = Math.max(this.lastReturned, this.base)
    this.scheduleEnd()
  }

  private readonly handleEnded = (): void => {
    this.live = false // the line is over; the clock runs on its own
  }

  private emit(): void {
    this.changeHandler?.()
  }
}
