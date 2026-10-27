// Decoded clip (lib/anim) -> three.js AnimationClip. No Vue imports.
//
// Tracks are bound by node uuid, not name: 52 node names repeat in the model (hair, cloth and spring bones), and
// `PropertyBinding` would pick the first match. The animated arrays of the decoded clip are used as they are
// (`KeyframeTrack` keeps a Float32Array it is given), so building a clip does not copy the key data.
import * as THREE from 'three'
import type { Clip } from '../anim/clip.ts'

export interface ToAnimationClipOptions {
  /** glTF node index of the clip's root (the manifest's `rootNode`). */
  rootNode: number
  /**
   * Leave out the root node's position track so the character stays at its origin. Except when the root node is the pelvis
   * bone itself (`Bip001`: Stigmata, Veritas and Zero): its position track is the pelvis height, not travel, so it stays.
   */
  inPlace: boolean
}

/** A manifest whose `rootNode` is this bone has no separate root above the pelvis. */
const PELVIS_ROOT = 'Bip001'

export interface BuiltClip {
  clip: THREE.AnimationClip
  /** Bytes of key data this clip holds (shared arrays counted once); what the clip cache budgets. */
  bytes: number
  /** Tracks left out because their node or morph target does not exist in `nodes`. */
  skipped: number
}

/**
 * `nodes[i]` is the object of glTF node `i`. A track whose node is missing, or whose morph target is outside the
 * mesh's target list, is skipped and counted instead of thrown: the conformance sweep makes that unreachable for
 * shipped data, and one bad track should not stop a whole clip from playing.
 */
export function toAnimationClip(clip: Clip, nodes: readonly (THREE.Object3D | undefined)[], options: ToAnimationClipOptions): BuiltClip {
  const tracks: THREE.KeyframeTrack[] = []
  let skipped = 0
  let bytes = clip.times.byteLength
  // Constant tracks hold their value over two keys, so the mixer can blend and restore them like animated ones.
  const constTimes = Float32Array.of(0, clip.duration)
  bytes += constTimes.byteLength

  const expand = (value: Float32Array): Float32Array => {
    const out = new Float32Array(value.length * 2)
    out.set(value, 0)
    out.set(value, value.length)
    bytes += out.byteLength
    return out
  }

  const dropRootPosition = options.inPlace && nodes[options.rootNode]?.name !== PELVIS_ROOT
  for (const t of clip.tracks) {
    const node = nodes[t.node]
    if (!node) {
      skipped++
      continue
    }
    if (dropRootPosition && t.node === options.rootNode && t.property === 'position') continue

    const name = `${node.uuid}.${t.property}`
    const times = t.constant ? constTimes : clip.times
    const values = t.constant ? expand(t.values) : t.values
    if (!t.constant) bytes += values.byteLength
    if (t.property === 'quaternion') tracks.push(new THREE.QuaternionKeyframeTrack(name, times, values))
    else tracks.push(new THREE.VectorKeyframeTrack(name, times, values))
  }

  for (const m of clip.morphs) {
    const node = nodes[m.node] as THREE.Mesh | undefined
    if (!node || node.morphTargetInfluences?.[m.target] === undefined) {
      skipped++
      continue
    }
    const name = `${node.uuid}.morphTargetInfluences[${m.target}]`
    const times = m.constant ? constTimes : clip.times
    const values = m.constant ? expand(m.values) : m.values
    if (!m.constant) bytes += values.byteLength
    tracks.push(new THREE.NumberKeyframeTrack(name, times, values))
  }

  return { clip: new THREE.AnimationClip(clip.name, clip.duration, tracks), bytes, skipped }
}
