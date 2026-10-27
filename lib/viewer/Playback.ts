// Plays one clip at a time on a model with an AnimationMixer. No Vue imports.
//
// The mixer does the interpolation, loop modes, crossfades and restoring the model's original values when a clip
// stops. This class adds the rules of the viewer: pause and loop as separate flags, "finished" for a clip that ended
// with loop off (it holds its last frame), restarting such a clip when play is pressed, and a deterministic seek.
//
// A clip can also be *driven*: an outside clock (the voice line) owns its time, and `pose` sets the clip, and the idle
// clip after it, from a timeline sample. The mixer then only blends: the crossfade in from the previous clip and the
// fade into the idle clip.
import * as THREE from 'three'
import type { TimelineSample } from '../voice/timeline.ts'

export interface PlaybackState {
  /** Key given to `play`, or null in bind pose. */
  key: string | null
  /** Seconds into the clip. */
  time: number
  duration: number
  /** Advancing: not paused and not finished. */
  playing: boolean
  loop: boolean
  /** The clip reached its end with loop off and holds its last frame. */
  finished: boolean
  /** How many times the current looping clip has wrapped around since it started (the mixer's `loop` events); 0 for a driven clip. */
  loops: number
}

export interface PlayOptions {
  loop: boolean
  /** Crossfade from the clip that is playing, in seconds. 0 switches at once. */
  fade?: number
}

const DEFAULT_FADE = 0.25

export class Playback {
  private readonly mixer: THREE.AnimationMixer
  private action: THREE.AnimationAction | null = null
  private key: string | null = null
  private paused = false
  private finished = false
  private loop = true
  /** Wraps of the current clip (see `PlaybackState.loops`). */
  private loops = 0
  /** Speed multiplier of clips the mixer advances itself. A driven clip's speed is its clock's. */
  private speed = 1
  /** Actions of earlier clips that are still fading out. */
  private readonly fading = new Set<THREE.AnimationAction>()
  /** Set while the current clip is driven by an outside clock. */
  private driven: { idle: THREE.AnimationClip; idleAction: THREE.AnimationAction | null } | null = null
  private changeHandler: (() => void) | null = null

  constructor(root: THREE.Object3D) {
    this.mixer = new THREE.AnimationMixer(root)
    this.mixer.addEventListener('finished', this.handleFinished)
    this.mixer.addEventListener('loop', this.handleLoop)
  }

  /** Play at `rate` times real time (clip time stays in clip seconds). Applies to the current and every later clip. */
  setSpeed(rate: number): void {
    if (!(rate > 0) || !Number.isFinite(rate)) return
    this.speed = rate
    if (this.action && !this.driven) this.action.timeScale = rate
  }

  /** Called after every discrete change: a new clip, pause or resume, loop, finish, seek, bind pose. Not for time passing. */
  onChange(handler: (() => void) | null): void {
    this.changeHandler = handler
  }

  /** Start `clip` from 0, crossfading from the clip that is playing. */
  play(key: string, clip: THREE.AnimationClip, options: PlayOptions): void {
    this.key = key
    this.loop = options.loop
    this.paused = false
    this.finished = false
    this.switchTo(clip, options.fade ?? DEFAULT_FADE, (next) => {
      this.applyLoop(next)
      next.timeScale = this.speed
    })
    this.emit()
  }

  /**
   * Start `clip` driven by an outside clock: the mixer does not advance it, `pose` sets its time. `idle` is the clip
   * shown after `clip` has ended (only when the timeline is longer). Crossfades in from the clip that is playing.
   */
  playDriven(key: string, clip: THREE.AnimationClip, idle: THREE.AnimationClip, fade = DEFAULT_FADE): void {
    this.key = key
    this.paused = false
    this.finished = false
    this.switchTo(clip, fade, (next) => {
      next.setLoop(THREE.LoopOnce, 1)
      next.clampWhenFinished = true
      next.paused = true // time comes from `pose`
      next.timeScale = 1
    })
    this.driven = { idle, idleAction: null }
    this.emit()
  }

  /** Show a timeline sample of the driven clip. The pose is applied by the next `update`. */
  pose(sample: TimelineSample): void {
    const action = this.action
    const driven = this.driven
    if (!action || !driven) return
    action.time = sample.main.time
    if (sample.idle) {
      let idle = driven.idleAction
      if (!idle) {
        idle = this.mixer.clipAction(driven.idle)
        this.fading.delete(idle) // the idle clip may still be fading out from before the Board action
        idle.reset()
        idle.setLoop(THREE.LoopRepeat, Infinity)
        idle.paused = true
        idle.play()
        driven.idleAction = idle
      }
      idle.time = sample.idle.time
      action.setEffectiveWeight(sample.main.weight)
      idle.setEffectiveWeight(sample.idle.weight)
    } else if (driven.idleAction) {
      // back from the idle tail (seek or loop): the clip alone again
      driven.idleAction.stop()
      driven.idleAction = null
      action.setEffectiveWeight(1)
    }
  }

  /** For a seek of the driven clip: end running crossfades so the pose depends only on the time. */
  settleDriven(): void {
    if (!this.driven || !this.action) return
    this.stopFading()
    if (!this.driven.idleAction) this.action.setEffectiveWeight(1)
  }

  /** Stop everything; the model shows the original values of every property a clip animated. */
  bindPose(): void {
    this.mixer.stopAllAction()
    this.fading.clear()
    this.driven = null
    this.action = null
    this.key = null
    this.paused = false
    this.finished = false
    this.loops = 0
    this.emit()
  }

  /** Pause or resume. Resuming a clip that ended (loop off) plays it again from 0. */
  setPaused(paused: boolean): void {
    const action = this.action
    if (!action) return
    this.paused = paused
    if (!paused && this.finished) {
      this.finished = false
      action.reset()
      this.applyLoop(action)
    }
    action.paused = paused || this.finished
    this.emit()
  }

  /** Change the loop mode in place; the clip keeps its time. */
  setLoop(loop: boolean): void {
    this.loop = loop
    if (this.action) this.applyLoop(this.action)
    this.emit()
  }

  /**
   * Show the pose at `seconds` (clamped to the clip). Clips still fading out are stopped first, so the pose of a
   * time is the same however the clip was reached. Play/pause stays as it was.
   */
  seek(seconds: number): void {
    const action = this.action
    if (!action) return
    this.stopFading()
    const duration = action.getClip().duration
    action.setEffectiveWeight(1)
    action.enabled = true
    action.time = Math.min(Math.max(seconds, 0), duration)
    this.finished = false
    action.paused = this.paused
    this.mixer.update(0) // zero delta: applies the pose without advancing time or dispatching `finished`
    this.emit()
  }

  /** Advance by `dt` seconds. */
  update(dt: number): void {
    if (!this.action) return
    this.mixer.update(dt)
    for (const action of this.fading) {
      if (action.enabled) continue
      action.stop() // faded out
      this.fading.delete(action)
    }
  }

  state(): PlaybackState {
    const action = this.action
    if (!action) return { key: null, time: 0, duration: 0, playing: false, loop: this.loop, finished: false, loops: 0 }
    const duration = action.getClip().duration
    return {
      key: this.key,
      time: Math.min(Math.max(action.time, 0), duration),
      duration,
      playing: !this.paused && !this.finished,
      loop: this.loop,
      finished: this.finished,
      loops: this.loops,
    }
  }

  /** True while the pose changes by itself: a clip is advancing, or a crossfade is still running. */
  isAnimating(): boolean {
    if (this.driven) return this.fading.size > 0 // the clock decides whether the clip moves
    return this.action !== null && ((!this.paused && !this.finished) || this.fading.size > 0)
  }

  /**
   * Free the mixer's bindings and actions for `clip` (for a clip evicted from the cache). Refuses the clip that is
   * playing and returns false then.
   */
  release(clip: THREE.AnimationClip): boolean {
    const existing = this.mixer.existingAction(clip)
    if (existing && existing === this.action) return false
    if (this.driven?.idle === clip) return false
    if (existing) {
      existing.stop()
      this.fading.delete(existing)
    }
    this.mixer.uncacheAction(clip)
    this.mixer.uncacheClip(clip)
    return true
  }

  dispose(): void {
    this.mixer.removeEventListener('finished', this.handleFinished)
    this.mixer.removeEventListener('loop', this.handleLoop)
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.mixer.getRoot())
    this.fading.clear()
    this.driven = null
    this.action = null
    this.key = null
    this.changeHandler = null
  }

  /** Make `clip` the current action from time 0, crossfading out the current one (and a driven idle clip). */
  private switchTo(clip: THREE.AnimationClip, fade: number, setup: (next: THREE.AnimationAction) => void): void {
    const previous = this.action
    const next = this.mixer.clipAction(clip)
    this.fading.delete(next) // switching back to a clip that was still fading out
    const idle = this.driven?.idleAction
    this.driven = null
    this.loops = 0

    next.reset()
    setup(next)
    next.play()

    if (previous && previous !== next) {
      if (fade > 0 && previous.enabled) {
        next.crossFadeFrom(previous, fade, false)
        this.fading.add(previous)
      } else {
        previous.stop()
      }
    }
    if (idle && idle !== next) {
      if (fade > 0) {
        idle.fadeOut(fade)
        this.fading.add(idle)
      } else {
        idle.stop()
      }
    }
    this.action = next
  }

  private applyLoop(action: THREE.AnimationAction): void {
    action.setLoop(this.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
    action.clampWhenFinished = true // hold the last frame when a clip ends with loop off
  }

  private stopFading(): void {
    for (const action of this.fading) action.stop()
    this.fading.clear()
  }

  /** A looping clip wrapped around: counted (for the clip that is current, not one fading out) and reported at once. */
  private readonly handleLoop = (event: { action: THREE.AnimationAction; loopDelta: number }): void => {
    if (event.action !== this.action) return
    this.loops += Math.abs(event.loopDelta)
    this.emit()
  }

  private readonly handleFinished = (event: { action: THREE.AnimationAction }): void => {
    if (event.action !== this.action) return
    this.finished = true
    this.emit()
  }

  private emit(): void {
    this.changeHandler?.()
  }
}
