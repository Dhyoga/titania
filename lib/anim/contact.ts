// Hands that rest on the body keep resting on it when a clip is retargeted (design D4 of `improve-lent-clips`). Pure TypeScript.
//
// The `direction` method gives the target's arm the source arm's directions, so the hand lands where the target's shoulder and arm
// lengths put it, not where the source's hand was relative to its body: Veritas' hand on her hip sits 4 cm higher and 4 cm in front on
// Crepuscule (on her ribs) and 3 cm inside the body on Zero. For a hand near the hip the planner measures it in the source's body frame
// (outward from the pelvis–spine axis, along the axis, forward), puts it at the same place of the target's body frame (scaled by the
// ratio of the rigs' pelvis heights), and turns the upper arm and forearm there with a two-bone solve that keeps the elbow on its side.
// Elsewhere (hands away from the hip) nothing changes: the weight fades out with the hand's distance from the zone.
import { normalize, qfromUnitVectors, qmul, qrotate, sub, type Quat, type Vec3 } from './quat.ts'
import type { Rig } from './rig.ts'

const PELVIS = 'Bip001Pelvis'
/** The most a hand is moved, in metres: a safeguard against a source pose the zone test mistakes for a contact. */
const MAX_SHIFT = 0.1

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const add = (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: Readonly<Vec3>, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a: Readonly<Vec3>, b: Readonly<Vec3>): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const length = (a: Readonly<Vec3>): number => Math.hypot(a[0], a[1], a[2])
const crossv = (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** Where a hand counts as resting on the hip, in the source's body frame, as a weight 0 to 1. */
export function contactWeight(out: number, up: number, forward: number, axisLength: number): number {
  const lateral = smoothstep(0.07, 0.1, out) * (1 - smoothstep(0.17, 0.21, out))
  const height = smoothstep(-0.16, -0.1, up) * (1 - smoothstep(axisLength + 0.1, axisLength + 0.16, up))
  return lateral * height * (1 - smoothstep(0.1, 0.16, Math.abs(forward)))
}

interface BodyFrame {
  up: Vec3
  lateral: Vec3
  forward: Vec3
  axisLength: number
}

/** Body frame from the pelvis (origin), spine and thigh positions relative to the pelvis. */
function frameOf(spine: Vec3, leftThigh: Vec3, rightThigh: Vec3): BodyFrame | null {
  const axisLength = length(spine)
  if (axisLength < 1e-6) return null
  const up = normalize(spine)
  const across = sub(leftThigh, rightThigh)
  const rest = sub(across, scale(up, dot(across, up)))
  if (length(rest) < 1e-6) return null
  const lateral = normalize(rest)
  return { up, lateral, forward: crossv(up, lateral), axisLength }
}

interface Side {
  sign: 1 | -1
  hand: [source: number, target: number]
  upperArm: number
  forearm: number
}

export interface ContactPlanner {
  /**
   * For the pose at one key: `sourceWorld` holds the source nodes' world rotations (4 numbers per node), `sourceOf` the matched source
   * node of every target node; writes the corrected world rotations of the target's upper arms and forearms into `override` (4 per
   * node) and sets `has[node]` for them. Leaves everything else alone.
   */
  plan(sourceWorld: Float64Array, override: Float64Array, has: Uint8Array): void
}

/**
 * A planner for the arms the rigs have, or null when they lack a bone it needs (every Bianca rig has them all). `sourceOf[t]` is the source node
 * matched to target node `t` (or -1), `corrections` the per-bone factor of the `direction` method (4 per target node).
 */
export function createContactPlanner(source: Rig, target: Rig, sourceOf: Int32Array, corrections: Float64Array, heightRatio: number): ContactPlanner | null {
  const need = [PELVIS, 'Bip001Spine', 'Bip001LThigh', 'Bip001RThigh']
  const sides: Side[] = []
  for (const [letter, sign] of [['L', 1], ['R', -1]] as const) {
    const names = [`Bip001${letter}UpperArm`, `Bip001${letter}Forearm`, `Bip001${letter}Hand`]
    const t = names.map((n) => target.byName.get(n))
    const s = source.byName.get(names[2]!)
    if (t.some((i) => i === undefined) || s === undefined || sourceOf[t[2]!]! < 0) continue // a side without its arm is left alone
    sides.push({ sign, hand: [s, t[2]!], upperArm: t[0]!, forearm: t[1]! })
  }
  if (sides.length === 0) return null
  const nodes = need.map((n) => [source.byName.get(n), target.byName.get(n)] as const)
  if (nodes.some(([s, t]) => s === undefined || t === undefined)) return null
  const [pelvis, spine, leftThigh, rightThigh] = nodes.map(([s, t]) => ({ s: s!, t: t! }))
  const descends = (rig: Rig, node: number, root: number): boolean => {
    for (let n = node; n >= 0; n = rig.nodes[n]!.parent) if (n === root) return true
    return false
  }
  for (const side of sides) {
    for (const [rig, node] of [[source, side.hand[0]], [target, side.hand[1]]] as const) if (!descends(rig, node, rig === source ? pelvis!.s : pelvis!.t)) return null
  }
  for (const n of [spine!, leftThigh!, rightThigh!]) if (!descends(source, n.s, pelvis!.s) || !descends(target, n.t, pelvis!.t)) return null

  const sourceRest = source.nodes.map((n) => n.translation)
  const targetRest = target.nodes.map((n) => n.translation)
  const targetRestRotation = target.nodes.map((n) => n.rotation)

  return {
    plan(sourceWorld, override, has) {
      // Positions relative to the pelvis, from world rotations and rest offsets.
      const sourceRotation = (i: number): Quat => [sourceWorld[i * 4]!, sourceWorld[i * 4 + 1]!, sourceWorld[i * 4 + 2]!, sourceWorld[i * 4 + 3]!]
      const sourcePosition = (i: number): Vec3 => {
        if (i === pelvis!.s) return [0, 0, 0]
        const p = source.nodes[i]!.parent
        return add(sourcePosition(p), qrotate(sourceRotation(p), sourceRest[i]!))
      }
      const sourceFrame = frameOf(sourcePosition(spine!.s), sourcePosition(leftThigh!.s), sourcePosition(rightThigh!.s))
      if (!sourceFrame) return

      // Cheap first: which hands are near the hip at all.
      const wanted: { side: Side; out: number; up: number; forward: number; weight: number }[] = []
      for (const side of sides) {
        const v = sourcePosition(side.hand[0])
        const out = side.sign * dot(v, sourceFrame.lateral)
        const up = dot(v, sourceFrame.up)
        const forward = dot(v, sourceFrame.forward)
        const weight = contactWeight(out, up, forward, sourceFrame.axisLength)
        if (weight > 1e-3) wanted.push({ side, out, up, forward, weight })
      }
      if (wanted.length === 0) return

      // The target's world rotations, parent first, from the same formula the retargeting uses; memoized for this key.
      const memo = new Map<number, Quat>()
      const targetRotation = (i: number): Quat => {
        let q = memo.get(i)
        if (q) return q
        const s = sourceOf[i]!
        if (s >= 0) {
          const a = sourceRotation(s)
          const c: Quat = [corrections[i * 4]!, corrections[i * 4 + 1]!, corrections[i * 4 + 2]!, corrections[i * 4 + 3]!]
          q = qmul(a, c)
        } else {
          const p = target.nodes[i]!.parent
          q = p < 0 ? targetRestRotation[i]! : qmul(targetRotation(p), targetRestRotation[i]!)
        }
        memo.set(i, q)
        return q
      }
      const targetPosition = (i: number): Vec3 => {
        if (i === pelvis!.t) return [0, 0, 0]
        const p = target.nodes[i]!.parent
        return add(targetPosition(p), qrotate(targetRotation(p), targetRest[i]!))
      }
      const targetFrame = frameOf(targetPosition(spine!.t), targetPosition(leftThigh!.t), targetPosition(rightThigh!.t))
      if (!targetFrame) return

      for (const { side, out, up, forward, weight } of wanted) {
        const shoulder = targetPosition(side.upperArm)
        const elbowOffset = targetRest[side.forearm]!
        const handOffset = targetRest[side.hand[1]]!
        const upperLength = length(elbowOffset)
        const foreLength = length(handOffset)
        if (upperLength < 1e-6 || foreLength < 1e-6) continue
        const upperRotation = targetRotation(side.upperArm)
        const foreRotation = targetRotation(side.forearm)
        const elbow = add(shoulder, qrotate(upperRotation, elbowOffset))
        const hand = add(elbow, qrotate(foreRotation, handOffset))

        // Where the hand should be: the source's body-frame coordinates, scaled to the target's body.
        const wanted3 = add(add(scale(targetFrame.lateral, side.sign * out), scale(targetFrame.up, up)), scale(targetFrame.forward, forward))
        let shift = sub(scale(wanted3, heightRatio), hand)
        const shiftLength = length(shift)
        if (shiftLength > MAX_SHIFT) shift = scale(shift, MAX_SHIFT / shiftLength)
        const goal = add(hand, scale(shift, weight))

        // Two-bone solve, the elbow staying on the side it is on now.
        const reach = sub(goal, shoulder)
        const distance = Math.min(upperLength + foreLength - 1e-3, Math.max(Math.abs(upperLength - foreLength) + 1e-3, length(reach)))
        const toGoal = normalize(reach)
        const bend = sub(sub(elbow, shoulder), scale(toGoal, dot(sub(elbow, shoulder), toGoal)))
        const pole = length(bend) > 1e-4 ? normalize(bend) : scale(targetFrame.forward, -1)
        const cosine = (upperLength * upperLength + distance * distance - foreLength * foreLength) / (2 * upperLength * distance)
        const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine))
        const elbowGoal = add(shoulder, add(scale(toGoal, upperLength * cosine), scale(pole, upperLength * sine)))
        const handGoal = add(shoulder, scale(toGoal, distance))

        const newUpper = qmul(qfromUnitVectors(normalize(sub(elbow, shoulder)), normalize(sub(elbowGoal, shoulder))), upperRotation)
        const newFore = qmul(qfromUnitVectors(normalize(sub(hand, elbow)), normalize(sub(handGoal, elbowGoal))), foreRotation)
        override.set(newUpper, side.upperArm * 4)
        override.set(newFore, side.forearm * 4)
        has[side.upperArm] = 1
        has[side.forearm] = 1
      }
    },
  }
}
