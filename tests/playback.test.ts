import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { Playback } from '../lib/viewer/Playback.ts'
import { voiceTimeline } from '../lib/voice/timeline.ts'

const near = (a: number, b: number, msg = '') => assert.ok(Math.abs(a - b) < 1e-5, `${msg} ${a} != ${b}`)

/** root > a, b; `a` starts at x = 5 so "back to original" is distinguishable from zero. */
function setup() {
  const root = new THREE.Group()
  const a = new THREE.Object3D()
  const b = new THREE.Object3D()
  a.position.set(5, 0, 0)
  b.position.set(0, 7, 0)
  root.add(a, b)
  const playback = new Playback(root)
  return { root, a, b, playback }
}

/** A 2 s clip that moves `target` along x from 0 to 2 (x = time). */
function slide(target: THREE.Object3D, name = 'slide'): THREE.AnimationClip {
  return new THREE.AnimationClip(name, 2, [new THREE.VectorKeyframeTrack(`${target.uuid}.position`, [0, 1, 2], [0, 0, 0, 1, 0, 0, 2, 0, 0])])
}

/** A 2 s clip that rotates `target` about Z by 0 → 90° and moves it, to compare full poses. */
function wave(target: THREE.Object3D): THREE.AnimationClip {
  const q0 = new THREE.Quaternion()
  const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
  return new THREE.AnimationClip('wave', 2, [
    new THREE.QuaternionKeyframeTrack(`${target.uuid}.quaternion`, [0, 2], [...q0.toArray(), ...q1.toArray()]),
    new THREE.VectorKeyframeTrack(`${target.uuid}.position`, [0, 2], [0, 0, 0, 4, 0, 0]),
  ])
}

test('loop off: the clip clamps at the end and reports finished', () => {
  const { a, playback } = setup()
  playback.play('s', slide(a), { loop: false })
  playback.update(1)
  assert.equal(playback.state().finished, false)
  playback.update(1.5)
  const s = playback.state()
  assert.equal(s.finished, true)
  assert.equal(s.playing, false)
  near(s.time, 2)
  near(a.position.x, 2, 'last frame is held')
  playback.update(1)
  near(a.position.x, 2, 'still held')
})

test('loop on: the clip wraps and never finishes', () => {
  const { a, playback } = setup()
  playback.play('s', slide(a), { loop: true })
  playback.update(2.5)
  const s = playback.state()
  assert.equal(s.finished, false)
  assert.equal(s.playing, true)
  near(s.time, 0.5)
  near(a.position.x, 0.5)
})

test('resuming a finished clip restarts it from 0', () => {
  const { a, playback } = setup()
  playback.play('s', slide(a), { loop: false })
  playback.update(3)
  assert.equal(playback.state().finished, true)
  playback.setPaused(false)
  let s = playback.state()
  assert.equal(s.finished, false)
  assert.equal(s.playing, true)
  near(s.time, 0)
  playback.update(0.5)
  near(a.position.x, 0.5)
  playback.update(5) // ends again
  s = playback.state()
  assert.equal(s.finished, true)
})

test('pause holds the time, resume continues from it', () => {
  const { a, playback } = setup()
  playback.play('s', slide(a), { loop: true })
  playback.update(0.8)
  playback.setPaused(true)
  playback.update(1)
  near(playback.state().time, 0.8)
  assert.equal(playback.state().playing, false)
  near(a.position.x, 0.8)
  playback.setPaused(false)
  playback.update(0.5)
  near(playback.state().time, 1.3)
})

test('seek equals playing to that time', () => {
  const sought = setup()
  const played = setup()
  sought.playback.play('w', wave(sought.a), { loop: false, fade: 0 })
  played.playback.play('w', wave(played.a), { loop: false, fade: 0 })
  sought.playback.seek(1.2)
  for (let i = 0; i < 12; i++) played.playback.update(0.1)
  played.playback.setPaused(true)
  near(sought.playback.state().time, 1.2)
  near(played.playback.state().time, 1.2)
  assert.ok(sought.a.position.distanceTo(played.a.position) < 1e-5)
  // components, not angleTo(): acos amplifies float32 rounding for nearly equal rotations
  sought.a.quaternion.toArray().forEach((c, i) => near(c, played.a.quaternion.toArray()[i]!, `quaternion[${i}]`))
  assert.ok(sought.a.quaternion.z > 0.1, 'the rotation was applied')
})

test('seek clamps to the clip and keeps play/pause as it was', () => {
  const { a, playback } = setup()
  playback.play('s', slide(a), { loop: true })
  playback.seek(-3)
  near(playback.state().time, 0)
  playback.seek(99)
  near(playback.state().time, 2)
  assert.equal(playback.state().playing, true)
  playback.setPaused(true)
  playback.seek(1)
  assert.equal(playback.state().playing, false)
  near(a.position.x, 1)
  playback.update(1)
  near(playback.state().time, 1, 'still paused after seek')
})

test('seek after a finish unfinishes and shows the pose', () => {
  const { a, playback } = setup()
  playback.play('s', slide(a), { loop: false })
  playback.update(3)
  assert.equal(playback.state().finished, true)
  playback.seek(0.5)
  near(a.position.x, 0.5)
  assert.equal(playback.state().finished, false)
})

test('seek during a crossfade stops the outgoing clip', () => {
  const sought = setup()
  const reference = setup()
  const a1 = slide(sought.a, 'one')
  const b1 = slide(sought.b, 'two')
  sought.playback.play('one', a1, { loop: true })
  sought.playback.update(0.5)
  sought.playback.play('two', b1, { loop: true, fade: 0.25 })
  sought.playback.update(0.1)
  assert.equal(sought.playback.isAnimating(), true)
  sought.playback.seek(1.5)

  reference.playback.play('two', slide(reference.b, 'two'), { loop: true, fade: 0 })
  reference.playback.seek(1.5)

  near(sought.b.position.x, reference.b.position.x)
  near(sought.b.position.x, 1.5)
  near(sought.a.position.x, 5, 'the outgoing clip no longer drives its node')
  assert.equal(sought.playback.release(a1), true, 'outgoing clip is not scheduled any more')
})

test('toggling loop keeps the time', () => {
  const { a, playback } = setup()
  playback.play('s', slide(a), { loop: true })
  playback.update(0.7)
  playback.setLoop(false)
  near(playback.state().time, 0.7)
  assert.equal(playback.state().loop, false)
  playback.update(0.6)
  near(playback.state().time, 1.3)
  playback.update(1)
  assert.equal(playback.state().finished, true, 'loop off lets the clip end')
  // and on again mid-clip
  playback.setPaused(false)
  playback.update(0.4)
  playback.setLoop(true)
  near(playback.state().time, 0.4)
  playback.update(2)
  assert.equal(playback.state().finished, false)
  near(playback.state().time, 0.4)
})

test('bindPose restores original values and clears the state', () => {
  const { a, b, playback } = setup()
  playback.play('s', slide(a), { loop: true })
  playback.update(0.5)
  assert.notEqual(a.position.x, 5)
  playback.bindPose()
  assert.deepEqual(a.position.toArray(), [5, 0, 0])
  assert.deepEqual(b.position.toArray(), [0, 7, 0])
  const s = playback.state()
  assert.equal(s.key, null)
  assert.equal(s.playing, false)
  assert.equal(s.duration, 0)
  assert.equal(playback.isAnimating(), false)
  playback.update(1) // harmless
  assert.deepEqual(a.position.toArray(), [5, 0, 0])
})

test('crossfade ends with only the new clip active', () => {
  const { a, b, playback } = setup()
  const first = slide(a, 'first')
  const second = slide(b, 'second')
  playback.play('first', first, { loop: true })
  playback.update(0.5)
  near(a.position.x, 0.5)
  playback.play('second', second, { loop: true, fade: 0.25 })
  near(playback.state().time, 0, 'time restarts at 0')
  assert.equal(playback.isAnimating(), true)
  playback.update(0.1)
  // mid fade both clips contribute
  assert.ok(a.position.x !== 5 && b.position.x !== 7)
  playback.update(0.3)
  // fade over: the first clip's node is back at its original value, the second clip drives its node
  near(a.position.x, 5, 'first clip released')
  near(b.position.x, 0.4)
  assert.equal(playback.release(first), true, 'first clip has no scheduled action left')
  assert.equal(playback.state().key, 'second')
})

test('switching to the clip that is playing restarts it without a fade', () => {
  const { a, playback } = setup()
  const clip = slide(a)
  playback.play('s', clip, { loop: true })
  playback.update(1)
  playback.play('s', clip, { loop: true })
  near(playback.state().time, 0)
  playback.update(0.5)
  near(a.position.x, 0.5)
})

test('fade 0 switches at once', () => {
  const { a, b, playback } = setup()
  playback.play('one', slide(a, 'one'), { loop: true })
  playback.update(0.5)
  playback.play('two', slide(b, 'two'), { loop: true, fade: 0 })
  playback.update(0.5)
  near(a.position.x, 5)
  near(b.position.x, 0.5)
})

test('onChange fires for discrete changes only', () => {
  const { a, playback } = setup()
  let changes = 0
  playback.onChange(() => changes++)
  playback.play('s', slide(a), { loop: true })
  playback.update(0.2)
  assert.equal(changes, 1)
  playback.setPaused(true)
  playback.setPaused(false)
  playback.setLoop(false)
  playback.seek(0.1)
  assert.equal(changes, 5)
  playback.update(5) // finishes
  assert.equal(changes, 6)
  playback.bindPose()
  assert.equal(changes, 7)
})

test('release refuses the playing clip and frees others', () => {
  const { a, b, playback } = setup()
  const playing = slide(a, 'playing')
  const other = slide(b, 'other')
  playback.play('other', other, { loop: true, fade: 0 })
  playback.play('playing', playing, { loop: true, fade: 0 })
  assert.equal(playback.release(playing), false)
  assert.equal(playback.release(other), true)
  playback.update(0.5)
  near(a.position.x, 0.5)
})

test('dispose restores the model', () => {
  const { a, playback } = setup()
  playback.play('s', slide(a), { loop: true })
  playback.update(0.5)
  playback.dispose()
  assert.deepEqual(a.position.toArray(), [5, 0, 0])
})

// ---- driven mode (a clip whose time comes from the voice clock)

/** main slides `a` 0→2 over 2 s; idle slides `b` over 2 s; the line is 3 s, so there is a 1 s idle tail. */
function driven() {
  const env = setup()
  const main = slide(env.a, 'board')
  const idle = slide(env.b, 'idle')
  const timeline = voiceTimeline({ clipDuration: 2, audioDuration: 3, idleDuration: 2 })
  return { ...env, main, idle, timeline }
}

test('driven: pose sets the clip time and the mixer does not advance it', () => {
  const { a, playback, main, idle, timeline } = driven()
  playback.playDriven('board', main, idle, 0)
  playback.pose(timeline.sample(1.25))
  playback.update(0)
  near(a.position.x, 1.25)
  playback.update(0.5)
  near(a.position.x, 1.25, 'time stays where the clock put it')
  assert.equal(playback.isAnimating(), false, 'no crossfade running; the clock decides')
  assert.equal(playback.state().key, 'board')
})

test('driven: in the idle tail the clip holds its last frame and the idle clip fades in', () => {
  const { a, b, playback, main, idle, timeline } = driven()
  playback.playDriven('board', main, idle, 0)
  playback.pose(timeline.sample(2.125))
  playback.update(0)
  near(a.position.x, 0.5 * 2 + 0.5 * 5, 'clip at its end, half weight; the rest is the original value')
  near(b.position.x, 0.5 * 0.125, 'idle at 0.125 s, half weight')
  playback.pose(timeline.sample(2.5))
  playback.update(0)
  near(a.position.x, 5, 'clip weight 0')
  near(b.position.x, 0.5)
  assert.equal(playback.release(idle), false, 'the idle clip is in use')
})

test('driven: back from the idle tail the clip plays alone again', () => {
  const { a, b, playback, main, idle, timeline } = driven()
  playback.playDriven('board', main, idle, 0)
  playback.pose(timeline.sample(2.6))
  playback.update(0)
  playback.pose(timeline.sample(1))
  playback.update(0)
  near(a.position.x, 1)
  assert.deepEqual(b.position.toArray(), [0, 7, 0], 'idle clip released')
})

test('driven: crossfades in from the previous clip without advancing its own time', () => {
  const { a, b, playback, main, idle, timeline } = driven()
  const before = slide(b, 'ui')
  playback.play('ui', before, { loop: true })
  playback.update(0.5)
  playback.playDriven('board', main, idle)
  playback.pose(timeline.sample(0.3))
  playback.update(0.1)
  assert.equal(playback.isAnimating(), true, 'crossfade running')
  assert.notDeepEqual(b.position.toArray(), [0, 7, 0], 'previous clip still blends in')
  playback.update(0.3)
  assert.equal(playback.isAnimating(), false, 'crossfade over')
  near(a.position.x, 0.3)
  assert.deepEqual(b.position.toArray(), [0, 7, 0])
  assert.equal(playback.release(before), true, 'previous clip released')
})

test('driven: settleDriven ends a running crossfade (deterministic seek)', () => {
  const sought = driven()
  const before = slide(sought.b, 'ui')
  sought.playback.play('ui', before, { loop: true })
  sought.playback.update(0.5)
  sought.playback.playDriven('board', sought.main, sought.idle)
  sought.playback.update(0.1)
  sought.playback.settleDriven()
  sought.playback.pose(sought.timeline.sample(1.5))
  sought.playback.update(0)

  const fresh = driven()
  fresh.playback.playDriven('board', fresh.main, fresh.idle, 0)
  fresh.playback.pose(fresh.timeline.sample(1.5))
  fresh.playback.update(0)

  assert.equal(sought.playback.isAnimating(), false)
  near(sought.a.position.x, fresh.a.position.x)
  assert.deepEqual(sought.b.position.toArray(), fresh.b.position.toArray())
})

test('a normal clip after a driven one fades out the idle tail too', () => {
  const { a, b, playback, main, idle, timeline } = driven()
  playback.playDriven('board', main, idle, 0)
  playback.pose(timeline.sample(2.8))
  playback.update(0)
  playback.play('next', slide(a, 'next'), { loop: true })
  assert.equal(playback.isAnimating(), true)
  playback.update(0.4)
  assert.deepEqual(b.position.toArray(), [0, 7, 0], 'idle tail faded out and released')
  near(a.position.x, 0.4)
  assert.equal(playback.release(idle), true)
})

test('bindPose ends driven mode', () => {
  const { a, b, playback, main, idle, timeline } = driven()
  playback.playDriven('board', main, idle, 0)
  playback.pose(timeline.sample(2.5))
  playback.update(0)
  playback.bindPose()
  assert.deepEqual(a.position.toArray(), [5, 0, 0])
  assert.deepEqual(b.position.toArray(), [0, 7, 0])
  assert.equal(playback.release(idle), true)
})

// ---- speed

test('speed: the clip advances at the rate, in clip seconds', () => {
  const { a, playback } = setup()
  playback.play('s', slide(a), { loop: true })
  playback.setSpeed(0.5)
  playback.update(1)
  near(playback.state().time, 0.5)
  near(a.position.x, 0.5)
  playback.setSpeed(2)
  playback.update(0.25)
  near(playback.state().time, 1)
})

test('speed is kept for clips started later', () => {
  const { a, b, playback } = setup()
  playback.setSpeed(2)
  playback.play('one', slide(a, 'one'), { loop: true })
  playback.update(0.5)
  near(playback.state().time, 1)
  playback.play('two', slide(b, 'two'), { loop: true, fade: 0 })
  playback.update(0.5)
  near(playback.state().time, 1, 'new clip also at 2x')
})

test('speed: a loop-off clip ends sooner at 2x and later at 0.5x', () => {
  const fast = setup()
  fast.playback.play('s', slide(fast.a), { loop: false })
  fast.playback.setSpeed(2)
  fast.playback.update(1.05)
  assert.equal(fast.playback.state().finished, true)
  const slow = setup()
  slow.playback.play('s', slide(slow.a), { loop: false })
  slow.playback.setSpeed(0.5)
  slow.playback.update(2.5)
  assert.equal(slow.playback.state().finished, false)
  slow.playback.update(1.6)
  assert.equal(slow.playback.state().finished, true)
})

test('speed does not stretch the crossfade or move seek and pause', () => {
  const { a, b, playback } = setup()
  playback.play('one', slide(a, 'one'), { loop: true })
  playback.update(0.5)
  playback.setSpeed(0.25)
  playback.play('two', slide(b, 'two'), { loop: true, fade: 0.25 })
  playback.update(0.3) // the crossfade is over in real time even at 0.25x
  assert.equal(playback.isAnimating(), true, 'the new clip keeps playing')
  near(a.position.x, 5, 'first clip released after 0.25 s of real time')
  playback.seek(1.2)
  near(playback.state().time, 1.2)
  playback.setPaused(true)
  playback.update(1)
  near(playback.state().time, 1.2)
})

test('invalid speeds are ignored', () => {
  const { a, playback } = setup()
  playback.play('s', slide(a), { loop: true })
  playback.setSpeed(0)
  playback.setSpeed(-1)
  playback.setSpeed(Number.NaN)
  playback.update(1)
  near(playback.state().time, 1)
})

test('a driven clip is not time-scaled by the mixer speed', () => {
  const { a, playback } = setup()
  const main = slide(a, 'board')
  const idle = slide(a, 'idle')
  const timeline = voiceTimeline({ clipDuration: 2, audioDuration: 2, idleDuration: 2 })
  playback.setSpeed(2)
  playback.playDriven('board', main, idle, 0)
  playback.pose(timeline.sample(1))
  playback.update(0.5)
  near(a.position.x, 1, 'the clock decides the time')
})
