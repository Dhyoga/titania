// Animation clip decoding. Pure TypeScript: no three.js, no Vue, no extension APIs.
//
// The packed clip files (`anim/**.json`, `anim-skins/<skin>/**.json`) were reverse engineered from the files
// themselves; there is no published spec. All 712 shipped Crepuscule clips decode with this code and agree with
// their GLBs (tests/conformance.test.ts). What the data shows:
//   - `packing.times` is the key time list (seconds) shared by every track, `valueDigits` the decimal scale (1e5),
//     `rotationBits` the width of a quantized quaternion component (16).
//   - A track with `value` is constant (stored as plain floats). A track with `deltas` is animated.
//   - Animated vectors (position, scale) store three planes of `count` integers: all x, then all y, then all z. Each
//     plane is delta coded (first value absolute, then differences). Real value = sum / 10^valueDigits.
//   - Animated quaternions store three planes the same way. The fourth component is dropped (smallest-three): it is
//     the largest one, positive, and is rebuilt as sqrt(1 - a^2 - b^2 - c^2). `dropped` lists `{ at, component }`
//     where from key `at` on the stored planes hold the three other components in ascending order. Components are
//     quantized so that +-1/sqrt(2) maps to +-(2^(bits-1) - 1). The delta chain simply runs across a layout change.
//   - A `weights` track is one morph target (`target`) of the mesh node, `count` delta coded integers, same scale.
//   - A clip without `packing` is a single static pose (every track constant).
//
// Decoded layout (see `Clip`): every animated track is one flat, key-major Float32Array, which is what three.js
// keyframe tracks take, so they can be wrapped without copying. Tracks are identified by glTF node index of the
// original GLB, not by name (names are not unique in these models).

export type TrackProperty = 'position' | 'quaternion' | 'scale'

export interface RawDropped {
  at: number
  component: number
}

export interface RawTrack {
  node: number
  property: 'position' | 'quaternion' | 'scale' | 'weights'
  /** Constant value (plain floats; a weights track holds one number, alone or in a one-element array). */
  value?: number[] | number
  /** Delta coded integers, see the header of this file. */
  deltas?: number[]
  dropped?: RawDropped[]
  /** Morph target index (weights tracks only). */
  target?: number
}

export interface RawClip {
  version: number
  tracks: RawTrack[]
  /** Missing in clips that are a single static pose. */
  packing?: { times: number[]; rotationBits: number; valueDigits: number }
}

export interface ClipTrack {
  node: number
  property: TrackProperty
  /** Components per key: 3 for position and scale, 4 for quaternion. */
  size: number
  /** `size` numbers when `constant`, else `size * count` numbers (key after key). */
  values: Float32Array
  constant: boolean
}

export interface ClipMorphTrack {
  node: number
  target: number
  /** One number when `constant`, else `count` numbers. */
  values: Float32Array
  constant: boolean
}

export interface Clip {
  name: string
  duration: number
  count: number
  /** Key times in seconds, shared by every animated track. */
  times: Float32Array
  tracks: ClipTrack[]
  morphs: ClipMorphTrack[]
}

const SIZE: Record<TrackProperty, number> = { position: 3, quaternion: 4, scale: 3 }

/** Validate and decode a packed clip. Throws on anything unexpected instead of guessing. */
export function decodeClip(raw: RawClip, name = ''): Clip {
  if (typeof raw !== 'object' || raw === null || !Array.isArray(raw.tracks)) throw new Error(`clip ${name}: not a clip file`)
  if (raw.version !== 1) throw new Error(`clip ${name}: unsupported version ${raw.version}`)
  const packing = raw.packing ?? { times: [0, 1 / 30], rotationBits: 16, valueDigits: 5 }
  const times = Float32Array.from(packing.times)
  const count = times.length
  if (count < 2) throw new Error(`clip ${name}: needs at least two keys`)
  for (let i = 1; i < count; i++) {
    if (!(times[i]! > times[i - 1]!)) throw new Error(`clip ${name}: key times are not increasing at key ${i}`)
  }
  const scale = Math.pow(10, packing.valueDigits)
  const quatScale = (Math.pow(2, packing.rotationBits - 1) - 1) * Math.SQRT2

  const tracks: ClipTrack[] = []
  const morphs: ClipMorphTrack[] = []
  for (const t of raw.tracks) {
    if (t.property === 'weights') {
      const target = t.target
      if (target === undefined) throw new Error(`clip ${name}: weights track of node ${t.node} has no target`)
      if (t.deltas) {
        if (t.deltas.length !== count) throw new Error(`clip ${name}: weights track of node ${t.node} has ${t.deltas.length} values, expected ${count}`)
        const values = new Float32Array(count)
        let acc = 0
        for (let i = 0; i < count; i++) values[i] = (acc += t.deltas[i]!) / scale
        morphs.push({ node: t.node, target, values, constant: false })
      } else if (typeof t.value === 'number' || (Array.isArray(t.value) && t.value.length === 1)) {
        morphs.push({ node: t.node, target, values: Float32Array.of(Array.isArray(t.value) ? t.value[0]! : t.value), constant: true })
      } else throw new Error(`clip ${name}: weights track of node ${t.node} has no data`)
      continue
    }

    const property = t.property
    const size = SIZE[property]
    if (!size) throw new Error(`clip ${name}: unknown property ${String(property)} on node ${t.node}`)
    if (t.deltas) {
      if (t.deltas.length !== count * 3) throw new Error(`clip ${name}: ${property} track of node ${t.node} has ${t.deltas.length} numbers, expected ${count * 3}`)
      const values = property === 'quaternion' ? decodeQuaternions(t, count, quatScale, name) : decodeVectors(t.deltas, count, scale)
      tracks.push({ node: t.node, property, size, values, constant: false })
    } else if (Array.isArray(t.value) && t.value.length === size) {
      tracks.push({ node: t.node, property, size, values: Float32Array.from(t.value), constant: true })
    } else throw new Error(`clip ${name}: ${property} track of node ${t.node} has no usable data`)
  }

  return { name, duration: times[count - 1]!, count, times, tracks, morphs }
}

function decodeVectors(deltas: number[], count: number, scale: number): Float32Array {
  const out = new Float32Array(count * 3)
  for (let plane = 0; plane < 3; plane++) {
    let acc = 0
    for (let k = 0; k < count; k++) {
      acc += deltas[plane * count + k]!
      out[k * 3 + plane] = acc / scale
    }
  }
  return out
}

function decodeQuaternions(t: RawTrack, count: number, quatScale: number, name: string): Float32Array {
  const deltas = t.deltas!
  const dropped = [...(t.dropped ?? [])].sort((a, b) => a.at - b.at)
  if (dropped.length === 0 || dropped[0]!.at !== 0) throw new Error(`clip ${name}: quaternion track of node ${t.node} does not say which component is dropped at key 0`)

  const out = new Float32Array(count * 4)
  const acc = [0, 0, 0]
  let next = 0
  let current = dropped[0]!.component
  for (let k = 0; k < count; k++) {
    while (next < dropped.length && dropped[next]!.at <= k) current = dropped[next++]!.component
    let sum = 0
    let slot = 0
    for (let c = 0; c < 4; c++) {
      if (c === current) continue
      const plane = slot++
      acc[plane] = acc[plane]! + deltas[plane * count + k]!
      const v = acc[plane]! / quatScale
      out[k * 4 + c] = v
      sum += v * v
    }
    out[k * 4 + current] = Math.sqrt(Math.max(0, 1 - sum))

    // q and -q are the same rotation: keep neighbouring keys in one hemisphere so interpolation takes the short way.
    if (k > 0) {
      const o = (k - 1) * 4
      const d = out[o]! * out[k * 4]! + out[o + 1]! * out[k * 4 + 1]! + out[o + 2]! * out[k * 4 + 2]! + out[o + 3]! * out[k * 4 + 3]!
      if (d < 0) for (let c = 0; c < 4; c++) out[k * 4 + c] = -out[k * 4 + c]!
    }
  }
  return out
}
