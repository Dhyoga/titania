import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MediaClock, type SilentReason, type Timers } from '../lib/voice/MediaClock.ts'

const near = (a: number, b: number, tol = 1e-6, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} != ${b}`)

/** An `<audio>` stand-in: a position that the test advances in coarse steps, plus `playing`/`ended` events. */
class FakeElement {
  currentTime = 0
  playbackRate = 1
  volume = 1
  muted = false
  paused = true
  ended = false
  /** The position advances only after the `playing` event, as in a real element (it waits for the first samples). */
  running = false
  playCalls = 0
  playResult: 'ok' | 'reject' = 'ok'
  private listeners: Record<string, (() => void)[]> = { playing: [], ended: [] }
  play(): Promise<void> {
    this.playCalls++
    if (this.playResult === 'reject') return Promise.reject(new Error('NotAllowedError'))
    this.paused = false
    this.ended = false
    return Promise.resolve()
  }
  pause(): void {
    this.paused = true
    this.running = false
  }
  addEventListener(type: 'playing' | 'ended', fn: () => void): void {
    this.listeners[type]!.push(fn)
  }
  removeEventListener(type: 'playing' | 'ended', fn: () => void): void {
    this.listeners[type] = this.listeners[type]!.filter((f) => f !== fn)
  }
  fire(type: 'playing' | 'ended'): void {
    if (type === 'playing' && !this.paused) this.running = true
    for (const f of this.listeners[type]!) f()
  }
  listenerCount(): number {
    return this.listeners.playing!.length + this.listeners.ended!.length
  }
}

/** Clock + element + timers on one fake time (ms) that the test advances. */
function setup(audio: number, duration: number, opts: { loop?: boolean } = {}) {
  const el = new FakeElement()
  let nowMs = 1000
  let pending: { at: number; fn: () => void; id: number }[] = []
  let nextId = 1
  const timers: Timers = {
    set: (fn, ms) => {
      const id = nextId++
      pending.push({ at: nowMs + ms, fn, id })
      return id
    },
    clear: (id) => {
      pending = pending.filter((p) => p.id !== id)
    },
  }
  const silent: SilentReason[] = []
  let released = 0
  const clock = new MediaClock(el, { duration, audioDuration: audio, loop: opts.loop ?? false, now: () => nowMs, timers, onSilent: (r) => silent.push(r), release: () => released++ })
  /** Advance time; the element's position follows in steps of `stepMs` (like a coarse media clock) while it plays. */
  const advance = (seconds: number, stepMs = 40) => {
    const end = nowMs + seconds * 1000
    while (nowMs < end) {
      const next = Math.min(end, nowMs + stepMs)
      pending.sort((a, b) => a.at - b.at)
      const due = pending[0]
      if (due && due.at <= next) {
        pending.shift()
        step(due.at - nowMs)
        due.fn()
        continue
      }
      step(next - nowMs)
    }
  }
  const step = (ms: number) => {
    nowMs += ms
    if (el.running && !el.ended) {
      el.currentTime += (ms / 1000) * el.playbackRate
      if (el.currentTime >= audio) {
        el.currentTime = audio
        el.ended = true
        el.paused = true
        el.running = false
        el.fire('ended')
      }
    }
  }
  /** Start playing and let the element report `playing`, as a real one does a moment later. */
  const start = (when = 30) => {
    clock.play()
    advance(when / 1000)
    el.fire('playing')
  }
  return { clock, el, advance, start, silent, released: () => released, pendingTimers: () => pending.length, now: () => nowMs }
}

test('starts paused at 0; the time does not move while paused', () => {
  const { clock, advance } = setup(22.44, 29.5)
  assert.equal(clock.playing, false)
  assert.equal(clock.time(), 0)
  advance(2)
  assert.equal(clock.time(), 0)
})

test('play waits for the first sound, then follows the element', () => {
  const { clock, el, advance } = setup(22.44, 29.5)
  clock.play()
  assert.equal(el.currentTime, 0)
  assert.equal(el.playCalls, 1)
  advance(0.3)
  assert.equal(clock.time(), 0, 'frozen until the element plays')
  el.fire('playing')
  advance(1)
  near(clock.time(), 1, 0.06)
})

test('coarse element steps are smoothed: no backwards steps, close to the element, at 60 fps', () => {
  const { clock, el, advance, start } = setup(60, 60)
  start()
  let last = clock.time()
  let worst = 0
  for (let i = 0; i < 600; i++) {
    advance(1 / 60, 100) // a 100 ms element step is the worst seen in Chromium
    const t = clock.time()
    assert.ok(t >= last, `went backwards at frame ${i}: ${last} -> ${t}`)
    last = t
    worst = Math.max(worst, Math.abs(t - el.currentTime))
  }
  assert.ok(worst < 0.1, `clock strayed ${worst} s from the element`)
  near(clock.time(), 10, 0.15)
})

test('a lagging element pulls the clock back by freezing it, never rewinding it', () => {
  const { clock, el, advance, start } = setup(60, 60)
  start()
  advance(5)
  const before = clock.time()
  el.currentTime -= 0.3 // the element stalls (buffering): the clock must not run on
  advance(0.1, 20)
  assert.ok(clock.time() >= before)
  near(clock.time(), before, 0.001, 'held')
  advance(1)
  assert.ok(clock.time() > before)
})

test('pause keeps the time and stops the element; resume restarts it at that time', () => {
  const { clock, el, advance, start } = setup(22.44, 29.5)
  start()
  advance(12.3)
  clock.pause()
  const t = clock.time()
  near(t, 12.3, 0.1)
  assert.equal(el.paused, true)
  advance(5)
  assert.equal(clock.time(), t)
  clock.play()
  near(el.currentTime, t, 1e-9, 'element restarted at the paused time')
  assert.equal(clock.time(), t, 'waiting for the sound again')
  el.fire('playing')
  advance(1)
  near(clock.time(), t + 1, 0.06)
})

test('seek inside the audio moves the element; past the audio it stops it', () => {
  const { clock, el, advance, start } = setup(22.44, 29.5)
  start()
  advance(3)
  clock.seek(10)
  near(clock.time(), 10, 0.001)
  near(el.currentTime, 10, 1e-9)
  assert.equal(el.paused, false, 'keeps playing')
  advance(0.5)
  near(clock.time(), 10.5, 0.06)
  clock.seek(25)
  assert.equal(el.paused, true, 'no sound past the line')
  advance(2)
  near(clock.time(), 27, 0.001, 'the clock carries on')
  clock.seek(5)
  assert.equal(el.paused, false)
  near(el.currentTime, 5, 1e-9)
})

test('seek while paused only moves the time; play then starts the element there', () => {
  const { clock, el } = setup(22.44, 29.5)
  clock.seek(7)
  assert.equal(clock.time(), 7)
  assert.equal(el.playCalls, 0)
  clock.seek(-1)
  assert.equal(clock.time(), 0)
  clock.seek(99)
  assert.equal(clock.time(), 29.5)
  clock.seek(7)
  clock.play()
  near(el.currentTime, 7, 1e-9)
})

test('the clock runs on after the line ends and finishes at the end of the timeline', () => {
  const { clock, el, advance, start } = setup(22.44, 29.5)
  let changes = 0
  clock.onChange(() => changes++)
  start()
  advance(23)
  assert.equal(el.ended, true)
  assert.equal(clock.playing, true)
  near(clock.time(), 23, 0.1)
  advance(7) // the end timer fires on its own
  assert.equal(clock.finished, true)
  assert.equal(clock.playing, false)
  assert.equal(clock.time(), 29.5)
  assert.equal(changes, 2, 'play, finish')
  advance(3)
  assert.equal(clock.time(), 29.5)
  clock.play()
  assert.equal(clock.finished, false)
  assert.equal(clock.time(), 0)
})

test('loop on wraps to 0 with the overshoot carried and restarts the element', () => {
  const { clock, el, advance, start } = setup(17.92, 24, { loop: true })
  let changes = 0
  clock.onChange(() => changes++)
  start()
  advance(24.5)
  assert.equal(clock.playing, true)
  assert.equal(clock.finished, false)
  assert.ok(clock.time() < 1.2, `back near the start, at ${clock.time()}`)
  assert.ok(el.playCalls >= 2, 'the element was started again')
  assert.ok(el.currentTime < 1.2)
  assert.ok(changes >= 2, 'play, wrap')
})

test('setLoop keeps the time and does not touch the element', () => {
  const { clock, el, advance, start } = setup(22.44, 29.5)
  start()
  advance(4)
  const calls = el.playCalls
  clock.setLoop(true)
  near(clock.time(), 4, 0.1)
  assert.equal(el.playCalls, calls)
  assert.equal(clock.loop, true)
})

test('setRate keeps the time, sets the element rate and runs at the new rate', () => {
  const { clock, el, advance, start } = setup(60, 60)
  start()
  advance(4)
  const t = clock.time()
  clock.setRate(0.5)
  near(clock.time(), t, 0.01, 'unchanged by the rate change')
  assert.equal(el.playbackRate, 0.5)
  advance(4)
  near(clock.time(), t + 2, 0.12)
  clock.setRate(2)
  const t2 = clock.time()
  advance(3)
  near(clock.time(), t2 + 6, 0.2)
  clock.setRate(-1)
  assert.equal(el.playbackRate, 2, 'invalid rates are ignored')
})

test('the end timer follows the rate', () => {
  const { clock, advance, start } = setup(10, 10)
  start()
  clock.setRate(2)
  advance(4.7)
  assert.equal(clock.finished, false)
  advance(0.5)
  assert.equal(clock.finished, true)
})

test('play() rejected: silent, the timeline runs at its normal length, reported once', async () => {
  const { clock, el, advance, silent } = setup(22.44, 29.5)
  el.playResult = 'reject'
  clock.play()
  await Promise.resolve()
  await Promise.resolve()
  assert.deepEqual(silent, ['rejected'])
  advance(2)
  near(clock.time(), 2, 0.01)
  assert.equal(clock.playing, true)
  advance(30)
  assert.equal(clock.finished, true, 'finishes at the normal length')
  assert.equal(clock.time(), 29.5)
  assert.equal(silent.length, 1)
})

test('no playing event within the wait: silent, running from where it started', () => {
  const { clock, advance, silent } = setup(22.44, 29.5)
  clock.seek(5)
  clock.play()
  advance(0.5)
  assert.equal(clock.time(), 5)
  assert.deepEqual(silent, [])
  advance(0.2)
  assert.deepEqual(silent, ['timeout'])
  advance(1)
  near(clock.time(), 6.1, 0.15)
})

test('output is the element volume and mute', () => {
  const { clock, el } = setup(10, 10)
  clock.setOutput({ volume: 0.4, muted: true })
  assert.equal(el.volume, 0.4)
  assert.equal(el.muted, true)
  clock.setOutput({ volume: 5, muted: false })
  assert.equal(el.volume, 1, 'clamped')
  clock.setOutput({ volume: -1, muted: false })
  assert.equal(el.volume, 0)
})

test('dispose stops the element, removes listeners and timers, calls release once', () => {
  const { clock, el, advance, start, released, pendingTimers } = setup(22.44, 29.5)
  let changes = 0
  clock.onChange(() => changes++)
  start()
  clock.dispose()
  clock.dispose()
  assert.equal(el.paused, true)
  assert.equal(el.listenerCount(), 0)
  assert.equal(pendingTimers(), 0)
  assert.equal(released(), 1)
  assert.equal(clock.playing, false)
  clock.play()
  advance(40)
  assert.equal(el.playCalls, 1, 'a disposed clock stays silent')
  assert.equal(changes, 1, 'no events after dispose')
})

test('the timeline cannot be shorter than the audio', () => {
  assert.throws(() => setup(30, 20), /shorter than the audio/)
})
