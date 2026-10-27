import assert from 'node:assert/strict'
import { test } from 'node:test'
import { voiceTimeline } from '../lib/voice/timeline.ts'

const near = (a: number, b: number, msg = '') => assert.ok(Math.abs(a - b) < 1e-9, `${msg} ${a} != ${b}`)

test('audio shorter than the clip (every shipped line): timeline = clip, no idle', () => {
  const tl = voiceTimeline({ clipDuration: 29.5, audioDuration: 22.44, idleDuration: 20.57 })
  assert.equal(tl.duration, 29.5)
  for (const t of [0, 10, 22.44, 25, 29.49]) {
    const s = tl.sample(t)
    assert.equal(s.segment, 'clip')
    assert.equal(s.idle, null)
    near(s.main.time, t)
    assert.equal(s.main.weight, 1)
  }
  const end = tl.sample(29.5) // the end is the clip's last frame, not the start of an idle segment
  assert.equal(end.segment, 'clip')
  near(end.main.time, 29.5)
  assert.equal(end.idle, null)
  assert.equal(tl.sample(40).segment, 'clip')
})

test('audio longer: the clip holds its last frame while the idle clip fades in over 0.25 s', () => {
  const tl = voiceTimeline({ clipDuration: 24, audioDuration: 34.77, idleDuration: 20.57 })
  assert.equal(tl.duration, 34.77)
  assert.equal(tl.clipDuration, 24)
  const before = tl.sample(23.9)
  assert.equal(before.segment, 'clip')
  const start = tl.sample(24)
  assert.equal(start.segment, 'idle')
  near(start.idle!.weight, 0)
  near(start.main.weight, 1)
  const mid = tl.sample(24.125)
  near(mid.main.time, 24, 'main holds its last frame')
  near(mid.main.weight, 0.5)
  near(mid.idle!.weight, 0.5)
  near(mid.idle!.time, 0.125)
  const done = tl.sample(24.25)
  near(done.main.weight, 0)
  near(done.idle!.weight, 1)
  const later = tl.sample(30)
  near(later.idle!.time, 6, 'idle at the matching offset')
  near(later.idle!.weight, 1)
})

test('the idle clip wraps when the tail is longer than one idle loop', () => {
  const tl = voiceTimeline({ clipDuration: 10, audioDuration: 40, idleDuration: 20.57 })
  near(tl.sample(30.57).idle!.time, 0)
  near(tl.sample(35).idle!.time, 25 - 20.57)
  near(tl.sample(40).idle!.time, 30 - 20.57)
})

test('equal lengths: timeline = clip', () => {
  const tl = voiceTimeline({ clipDuration: 12, audioDuration: 12, idleDuration: 5 })
  assert.equal(tl.duration, 12)
  assert.equal(tl.sample(11.99).segment, 'clip')
  assert.equal(tl.sample(12).segment, 'clip')
})

test('times outside the timeline are clamped', () => {
  const tl = voiceTimeline({ clipDuration: 10, audioDuration: 15, idleDuration: 4 })
  const s = tl.sample(-3)
  assert.equal(s.segment, 'clip')
  assert.equal(s.main.time, 0)
  const e = tl.sample(99)
  near(e.idle!.time, 5 % 4)
  near(e.idle!.weight, 1)
})

test('no fade switches at once', () => {
  const tl = voiceTimeline({ clipDuration: 10, audioDuration: 15, idleDuration: 4, fade: 0 })
  const s = tl.sample(10)
  assert.equal(s.main.weight, 0)
  assert.equal(s.idle!.weight, 1)
})

test('the same time always gives the same sample', () => {
  const tl = voiceTimeline({ clipDuration: 24, audioDuration: 34.77, idleDuration: 20.57 })
  assert.deepEqual(tl.sample(26.3), tl.sample(26.3))
})

test('durations must be positive', () => {
  assert.throws(() => voiceTimeline({ clipDuration: 0, audioDuration: 1, idleDuration: 1 }), /clipDuration/)
  assert.throws(() => voiceTimeline({ clipDuration: 1, audioDuration: Number.NaN, idleDuration: 1 }), /audioDuration/)
  assert.throws(() => voiceTimeline({ clipDuration: 1, audioDuration: 1, idleDuration: -2 }), /idleDuration/)
})
