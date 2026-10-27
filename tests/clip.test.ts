// Clip decoding (framework-free). Synthetic data only; real files are covered by conformance.test.ts.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decodeClip, type RawClip, type RawTrack } from '../lib/anim/clip.ts'

const SCALE = 1e5
const QSCALE = 32767 * Math.SQRT2

/** Encoder for the packed format, written from the description in clip.ts: the tests decode what it produces. */
function planes(keys: number[][], scale: number): number[] {
  const out: number[] = []
  for (let p = 0; p < keys[0]!.length; p++) {
    let prev = 0
    for (const k of keys) {
      const q = Math.round(k[p]! * scale)
      out.push(q - prev)
      prev = q
    }
  }
  return out
}

function quatTrack(node: number, quats: number[][]): RawTrack {
  const dropped: { at: number; component: number }[] = []
  const stored = quats.map((q, k) => {
    let big = 0
    for (let c = 1; c < 4; c++) if (Math.abs(q[c]!) > Math.abs(q[big]!)) big = c
    const sign = q[big]! < 0 ? -1 : 1
    if (k === 0 || dropped[dropped.length - 1]!.component !== big) dropped.push({ at: k, component: big })
    return [0, 1, 2, 3].filter((c) => c !== big).map((c) => q[c]! * sign)
  })
  return { node, property: 'quaternion', deltas: planes(stored, QSCALE), dropped }
}

function rawClip(count: number, tracks: RawTrack[]): RawClip {
  return { version: 1, tracks, packing: { times: Array.from({ length: count }, (_, i) => +(i / 30).toFixed(5)), rotationBits: 16, valueDigits: 5 } }
}

/** Quaternion (x, y, z, w) of a turn of `deg` degrees about a unit axis. */
function axisAngle(axis: [number, number, number], deg: number): number[] {
  const half = (deg * Math.PI) / 360
  const s = Math.sin(half)
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)]
}

const dot = (a: ArrayLike<number>, b: ArrayLike<number>): number => Array.from(a).reduce((sum, v, i) => sum + v * b[i]!, 0)

// ---------------------------------------------------------------- decoding

test('decodes positions, scales, constants and morph weights', () => {
  const positions = [[0, 1, -1], [0.1, 1.2, -1.1], [0.25, 1.2, -1.3], [0.2, 1, -1.5]]
  const raw = rawClip(4, [
    { node: 3, property: 'position', deltas: planes(positions, SCALE) },
    { node: 4, property: 'position', value: [0, 0, -0.064] },
    { node: 5, property: 'scale', deltas: planes([[1, 1, 1], [1.1, 1, 0.9], [1.2, 1, 0.8], [1.3, 1, 0.7]], SCALE) },
    { node: 6, property: 'quaternion', value: [0, 0, 0, 1] },
    { node: 7, property: 'weights', target: 2, deltas: [0, 50000, 50000, -100000] },
    { node: 7, property: 'weights', target: 3, value: [0.25] },
  ])
  const clip = decodeClip(raw, 'test')
  assert.equal(clip.name, 'test')
  assert.equal(clip.count, 4)
  assert.ok(Math.abs(clip.duration - 3 / 30) < 1e-6)
  const pos = clip.tracks[0]!
  positions.forEach((p, k) => p.forEach((v, c) => assert.ok(Math.abs(pos.values[k * 3 + c]! - v) < 1e-5, `position key ${k} comp ${c}`)))
  assert.deepEqual(Array.from(clip.tracks[1]!.values), [0, 0, Math.fround(-0.064)])
  assert.equal(clip.tracks[1]!.constant, true)
  assert.equal(clip.tracks[1]!.values.length, 3)
  assert.ok(Math.abs(clip.tracks[2]!.values[3 * 3 + 2]! - 0.7) < 1e-5)
  assert.deepEqual(Array.from(clip.tracks[3]!.values), [0, 0, 0, 1])
  assert.deepEqual(Array.from(clip.morphs[0]!.values).map((v) => +v.toFixed(3)), [0, 0.5, 1, 0])
  assert.equal(clip.morphs[0]!.node, 7)
  assert.equal(clip.morphs[0]!.target, 2)
  assert.equal(clip.morphs[1]!.constant, true)
  assert.equal(clip.morphs[1]!.values[0], 0.25)
})

test('a constant weights track may hold a bare number', () => {
  const clip = decodeClip(rawClip(3, [{ node: 7, property: 'weights', target: 0, value: 0.5 }]), 'w')
  assert.equal(clip.morphs[0]!.values[0], 0.5)
})

test('decodes quaternions through changes of the dropped component and keeps neighbours in one hemisphere', () => {
  // A turn about y that passes the point where the largest component changes from w to y, then a flip of sign.
  const quats = [0, 40, 80, 120, 160, 200, 240].map((deg) => axisAngle([0, 1, 0], deg))
  const raw = rawClip(quats.length, [quatTrack(9, quats)])
  assert.ok(raw.tracks[0]!.dropped!.length >= 2, 'the test needs a layout change')
  const track = decodeClip(raw, 'q').tracks[0]!
  for (let k = 0; k < quats.length; k++) {
    const got = Array.from(track.values.slice(k * 4, k * 4 + 4))
    assert.ok(Math.abs(Math.abs(dot(got, quats[k]!)) - 1) < 1e-3, `key ${k}: rotation differs`)
    // Component by component (same rotation up to sign), far tighter than the quantization step of 2.2e-5 times a few.
    const sign = dot(got, quats[k]!) < 0 ? -1 : 1
    got.forEach((v, c) => assert.ok(Math.abs(v - sign * quats[k]![c]!) < 2e-4, `key ${k} component ${c}: ${v} vs ${sign * quats[k]![c]!}`))
    assert.ok(Math.abs(Math.hypot(...got) - 1) < 1e-3, `key ${k}: not unit length`)
    if (k > 0) assert.ok(dot(track.values.slice((k - 1) * 4, k * 4), got) >= 0, `key ${k}: neighbouring keys are in opposite hemispheres`)
  }
})

test('neighbouring keys are flipped into one hemisphere where the encoder normalised the sign differently', () => {
  // About y from 200 to 350 degrees: up to 260 the largest component is y (positive), from 290 it is w (negative),
  // so the encoder negates those keys and the stored neighbours 260 and 290 point in opposite directions.
  const quats = [200, 230, 260, 290, 320, 350].map((deg) => axisAngle([0, 1, 0], deg))
  const raw = rawClip(quats.length, [quatTrack(2, quats)])
  assert.deepEqual(raw.tracks[0]!.dropped!.map((d) => d.component), [1, 3], 'the test needs the dropped component to change from y to w')
  const stored = quats.map((q) => {
    const big = q.reduce((best, v, c) => (Math.abs(v) > Math.abs(q[best]!) ? c : best), 0)
    return q.map((v) => (q[big]! < 0 ? -v : v))
  })
  assert.ok(stored.some((q, k) => k > 0 && dot(stored[k - 1]!, q) < 0), 'precondition: the normalised keys must contain a sign jump')

  const track = decodeClip(raw, 'flip').tracks[0]!
  for (let k = 0; k < quats.length; k++) {
    const got = track.values.slice(k * 4, k * 4 + 4)
    assert.ok(dot(got, quats[k]!) > 0.999, `key ${k} is not back in the hemisphere of the original (dot ${dot(got, quats[k]!)})`)
  }
})

test('a static pose without packing decodes with two keys, one frame at 30 fps', () => {
  const clip = decodeClip({ version: 1, tracks: [{ node: 2, property: 'position', value: [1, 2, 3] }] }, 'static')
  assert.equal(clip.tracks.length, 1)
  assert.equal(clip.count, 2)
  assert.ok(Math.abs(clip.duration - 1 / 30) < 1e-6)
})

test('decoded layout is flat and key-major, ready for three.js keyframe tracks', () => {
  const count = 886
  const positions = Array.from({ length: count }, (_, k) => [k * 0.001, 1, -k * 0.002])
  const quats = Array.from({ length: count }, (_, k) => axisAngle([0, 0, 1], k * 0.2))
  const clip = decodeClip(rawClip(count, [
    { node: 1, property: 'position', deltas: planes(positions, SCALE) },
    quatTrack(2, quats),
    { node: 3, property: 'weights', target: 0, deltas: new Array(count).fill(10) },
  ]), 'layout')
  assert.ok(clip.times instanceof Float32Array)
  assert.equal(clip.times.length, count)
  const [pos, quat] = clip.tracks
  assert.ok(pos!.values instanceof Float32Array)
  assert.equal(pos!.values.length, 2658)
  assert.equal(quat!.values.length, count * 4)
  assert.equal(clip.morphs[0]!.values.length, count)
  // key-major: the three numbers of key 500 sit together
  assert.ok(Math.abs(pos!.values[500 * 3 + 0]! - 0.5) < 1e-4)
  assert.ok(Math.abs(pos!.values[500 * 3 + 2]! + 1) < 1e-4)
  // tracks are identified by glTF node index
  assert.deepEqual(clip.tracks.map((t) => t.node), [1, 2])
})

// ---------------------------------------------------------------- rejected input

test('rejects clips it does not understand instead of guessing, naming the clip', () => {
  const ok = rawClip(3, [{ node: 1, property: 'position', value: [0, 0, 0] }])
  assert.doesNotThrow(() => decodeClip(ok, 'ok'))

  assert.throws(() => decodeClip({ ...ok, version: 2 }, 'v2'), /clip v2: unsupported version 2/)
  assert.throws(() => decodeClip(rawClip(4, [{ node: 1, property: 'position', deltas: new Array(11).fill(0) }]), 'bad'), /clip bad.*node 1.*11 numbers, expected 12/)
  assert.throws(() => decodeClip(rawClip(3, [{ node: 4, property: 'quaternion', deltas: new Array(9).fill(0) }]), 'nodrop'), /clip nodrop.*node 4.*dropped/)
  assert.throws(() => decodeClip(rawClip(3, [{ node: 6, property: 'weights', deltas: [0, 1, 2] }]), 'notarget'), /clip notarget.*node 6.*no target/)
  assert.throws(() => decodeClip({ ...ok, packing: { ...ok.packing!, times: [0, 0.1, 0.1] } }, 'times'), /clip times.*increasing/)
  assert.throws(() => decodeClip({ ...ok, packing: { ...ok.packing!, times: [0] } }, 'one'), /clip one.*two keys/)
  assert.throws(() => decodeClip(rawClip(3, [{ node: 8, property: 'position' }]), 'empty'), /clip empty.*node 8.*no usable data/)
  assert.throws(() => decodeClip(rawClip(3, [{ node: 9, property: 'weights', target: 1 }]), 'emptyw'), /clip emptyw.*node 9.*no data/)
  assert.throws(() => decodeClip(rawClip(3, [{ node: 5, property: 'rotation' as 'position', value: [0, 0, 0] }]), 'prop'), /clip prop.*unknown property rotation.*node 5/)
  assert.throws(() => decodeClip({ version: 1 } as unknown as RawClip, 'notracks'), /clip notracks/)
})
