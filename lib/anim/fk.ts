// Forward kinematics over a rig: local transforms (the rest pose, optionally overridden by one key of a decoded clip) to world
// transforms. Pure TypeScript; used by the retargeting and by its accuracy test. Scale is ignored (no retargeted bone is scaled).
import type { Clip } from './clip.ts'
import { qmul, qnormalize, qrotate, type Quat, type Vec3 } from './quat.ts'
import type { Rig } from './rig.ts'

export interface Pose {
  translations: Vec3[]
  rotations: Quat[]
}

/** The rig's rest pose as local transforms (copies, so callers may change them). */
export function restPose(rig: Rig): Pose {
  return {
    translations: rig.nodes.map((n) => [...n.translation] as Vec3),
    rotations: rig.nodes.map((n) => [...n.rotation] as Quat),
  }
}

/** Overwrite `pose` with the clip's position and rotation tracks at key `key` (constant tracks hold their one value). */
export function applyClipKey(pose: Pose, clip: Clip, key: number): void {
  for (const t of clip.tracks) {
    if (t.property === 'scale' || t.node >= pose.rotations.length) continue
    const o = t.constant ? 0 : key * t.size
    const v = t.values
    if (t.property === 'quaternion') pose.rotations[t.node] = qnormalize([v[o]!, v[o + 1]!, v[o + 2]!, v[o + 3]!])
    else pose.translations[t.node] = [v[o]!, v[o + 1]!, v[o + 2]!]
  }
}

/** World transforms of every node of `pose`. */
export function worldPose(rig: Rig, pose: Pose): Pose {
  const translations = new Array<Vec3>(rig.nodes.length)
  const rotations = new Array<Quat>(rig.nodes.length)
  for (const i of rig.order) {
    const p = rig.nodes[i]!.parent
    if (p < 0) {
      translations[i] = pose.translations[i]!
      rotations[i] = pose.rotations[i]!
      continue
    }
    const pt = translations[p]!
    const off = qrotate(rotations[p]!, pose.translations[i]!)
    translations[i] = [pt[0] + off[0], pt[1] + off[1], pt[2] + off[2]]
    rotations[i] = qmul(rotations[p]!, pose.rotations[i]!)
  }
  return { translations, rotations }
}
