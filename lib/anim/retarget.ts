// Retargeting: a decoded clip of one model played on another model of the same rig family (Bianca's frames all use 3ds Max Biped
// bone names, `Bip001…`, unique in every model). Pure TypeScript; the result is an ordinary `Clip` with the target's node indices, so
// caching, the three.js conversion, the voice timeline and visibility work on it unchanged. Nothing in data/ is touched.
//
// The four rigs differ in more than their rest poses: Crepuscule has a `Root` node turned 90° above `Bip001`, its clavicles hang from
// `Spine2` (the others' from `Neck`), and Veritas' and Zero's thighs hang from `Spine` (the others' from `Pelvis`). A bone's local
// rotation therefore means different things on different rigs, so the default method works in world space:
//   - `direction` (default): every matched bone gets the world rotation of the source bone, corrected once by the rest poses so that a
//     bone whose rest direction (towards its main child joint) differs on the two rigs points where the source bone points:
//       W_target = W_source · W_source_rest⁻¹ · A · W_target_rest,  A = shortest rotation from the target's to the source's rest direction
//     and the local rotation is that world rotation in the target parent's frame. Bones without a main child (head, toes, finger tips,
//     props) use A = identity. The hand also matches its roll: A turns the target's rest (finger direction, palm) frame into the
//     source's, because where the finger roots sit in the hand differs by 13 to 22° between the models.
//   - `local`: q_target = r_target · r_source⁻¹ · q_source per bone (local rest rotations); only right where both rigs give the bone the
//     same parent and the same rest frame. Kept to measure against (tests/retarget.test.ts).
// The pelvis root (`Bip001`) also keeps its motion: its world offset from rest, scaled by the ratio of the rigs' pelvis heights.
// Weapon props (`Bip001Prop…`) are not copied: the frames hold different weapons (Crepuscule's own clips move a sword the model does not
// show; Veritas holds a rifle in her left hand, Stigmata a bow in her right). A target prop that sits on a hand at rest (every prop of
// the four rigs does, within 4 cm) stays held by that hand, rigidly; any other prop stays at rest.
// Morph weights follow by mesh role (`Face`, `Eye`, see `meshRole`) and morph target name. Bones the source does not drive stay at rest.
import type { Clip, ClipMorphTrack, ClipTrack } from './clip.ts'
import { createContactPlanner } from './contact.ts'
import { restPose, worldPose } from './fk.ts'
import { IDENTITY, normalize, qfromFrames, qfromUnitVectors, qinv, qmul, qrotate, sub, type Quat, type Vec3 } from './quat.ts'
import { meshRole, type Rig } from './rig.ts'

export type RetargetMethod = 'direction' | 'local'

export interface RetargetOptions {
  method?: RetargetMethod
  /**
   * A decoded clip of the target model itself (its idle clip). Every target node the retargeted clip leaves without a track gets a
   * constant track with this clip's mean pose over its keys, instead of staying at the bind pose: helper bones the game drives through
   * constraints (the dress's front panel, repair and twist bones) hold the pose the model's own clips give them, so the clothing moves
   * with the body. The mean, not the first key: the idle's recorded cloth physics sway around the pose the dress really hangs in, and
   * its first key is the start of the recording (the thighs still show through the front panel). Nodes that already have a track are
   * left alone, and the positions of `Bip001…` bones are never filled.
   */
  fill?: Clip
  /**
   * Keep a hand that rests on the hip resting on it: the hand is placed where it was in the source's body frame (scaled to the target's
   * body) and the arm solved there (`contact.ts`), instead of wherever the target's shoulder and arm lengths put it. `direction` only.
   */
  contact?: boolean
}

const BONE_PREFIX = 'Bip001'
const PROP = /^Bip001Prop\d+$/
/** A prop this close to a hand at rest is held by that hand. */
const HELD_DISTANCE = 0.1
const ROOT_BONE = 'Bip001'
const PELVIS = 'Bip001Pelvis'

/** The child joint a bone points at, by Biped name: the direction the `direction` method aligns. Null when a bone has none. */
export function mainChild(name: string): string | null {
  const side = name.match(/^Bip001([LR])/)?.[1]
  const finger = name.match(/^(Bip001[LR]Finger\d)(\d?)$/)
  if (finger) {
    const level = finger[2] === '' ? 0 : Number(finger[2])
    return level < 2 ? `${finger[1]}${level + 1}` : null
  }
  const chain: Record<string, string> = {
    Bip001Pelvis: 'Bip001Spine',
    Bip001Spine: 'Bip001Spine1',
    Bip001Spine1: 'Bip001Spine2',
    Bip001Spine2: 'Bip001Neck',
    Bip001Neck: 'Bip001Head',
  }
  if (chain[name]) return chain[name]!
  if (!side) return null
  const limb: Record<string, string> = {
    Clavicle: 'UpperArm',
    UpperArm: 'Forearm',
    Forearm: 'Hand',
    Hand: 'Finger2',
    Thigh: 'Calf',
    Calf: 'Foot',
    Foot: 'Toe0',
  }
  const part = name.slice(`Bip001${side}`.length)
  return limb[part] ? `Bip001${side}${limb[part]}` : null
}

/** The second joint that fixes a bone's roll (the thumb root for the hand: with the middle finger it spans the palm). */
export function rollReference(name: string): string | null {
  const hand = name.match(/^Bip001([LR])Hand$/)
  return hand ? `Bip001${hand[1]}Finger0` : null
}

/** Pairs of (source node, target node) for the bones both rigs have, in the target's parent-first order. */
function matchBones(source: Rig, target: Rig): [number, number][] {
  const pairs: [number, number][] = []
  for (const t of target.order) {
    const name = target.nodes[t]!.name
    if (!name.startsWith(BONE_PREFIX) || PROP.test(name)) continue
    const s = source.byName.get(name)
    if (s !== undefined) pairs.push([s, t])
  }
  return pairs
}

/** Keep each key in the hemisphere of the previous one, so interpolation takes the short way. */
function keepHemisphere(values: Float32Array, key: number): void {
  if (key === 0) return
  const o = key * 4
  const p = o - 4
  if (values[o]! * values[p]! + values[o + 1]! * values[p + 1]! + values[o + 2]! * values[p + 2]! + values[o + 3]! * values[p + 3]! < 0) {
    for (let c = 0; c < 4; c++) values[o + c] = -values[o + c]!
  }
}

/** out[oo..] = a[ao..] · b[bo..] (quaternions; `out` may alias `a` or `b`). */
function mulInto(a: Float64Array, ao: number, b: Float64Array, bo: number, out: Float64Array, oo: number): void {
  const ax = a[ao]!, ay = a[ao + 1]!, az = a[ao + 2]!, aw = a[ao + 3]!
  const bx = b[bo]!, by = b[bo + 1]!, bz = b[bo + 2]!, bw = b[bo + 3]!
  out[oo] = aw * bx + ax * bw + ay * bz - az * by
  out[oo + 1] = aw * by - ax * bz + ay * bw + az * bx
  out[oo + 2] = aw * bz + ax * by - ay * bx + az * bw
  out[oo + 3] = aw * bw - ax * bx - ay * by - az * bz
}

function inverseInto(q: Float64Array, o: number, out: Float64Array): void {
  out[0] = -q[o]!
  out[1] = -q[o + 1]!
  out[2] = -q[o + 2]!
  out[3] = q[o + 3]!
}

/** One value per component: the track's constant, or its mean over the keys (quaternions: the sign-aligned mean, normalized). */
function meanValue(t: ClipTrack): Float32Array {
  if (t.constant) return Float32Array.from(t.values.subarray(0, t.size))
  const keys = t.values.length / t.size
  const sum = new Float64Array(t.size)
  for (let k = 0; k < keys; k++) {
    // Neighbouring keys of a decoded quaternion track share a hemisphere; align every key to the first so the sum cannot cancel.
    let sign = 1
    if (t.property === 'quaternion') {
      let dot = 0
      for (let c = 0; c < 4; c++) dot += t.values[k * 4 + c]! * t.values[c]!
      if (dot < 0) sign = -1
    }
    for (let c = 0; c < t.size; c++) sum[c]! += sign * t.values[k * t.size + c]!
  }
  const out = new Float32Array(t.size)
  if (t.property === 'quaternion') {
    const length = Math.hypot(sum[0]!, sum[1]!, sum[2]!, sum[3]!) || 1
    for (let c = 0; c < 4; c++) out[c] = sum[c]! / length
  } else for (let c = 0; c < t.size; c++) out[c] = sum[c]! / keys
  return out
}

/** The constant tracks `fill` adds for the nodes `existing` has no track of (see `RetargetOptions.fill`). */
function fillTracks(fill: Clip, existing: readonly ClipTrack[], target: Rig): ClipTrack[] {
  const has = new Set(existing.map((t) => `${t.node}:${t.property}`))
  const out: ClipTrack[] = []
  for (const t of fill.tracks) {
    if (t.node >= target.nodes.length || has.has(`${t.node}:${t.property}`)) continue
    const node = target.nodes[t.node]!
    if (t.property === 'position' && node.name.startsWith(BONE_PREFIX)) continue
    const values = meanValue(t)
    // A pose indistinguishable from the bind pose (0.05°, 1 mm) is no track at all: most positions the idle bakes for twist and chain
    // bones stay within a millimetre of it (Stigmata: 88 of 89), and only the few that really move (its hip lamp, 19 cm) are worth one.
    const rest = t.property === 'quaternion' ? node.rotation : t.property === 'position' ? node.translation : ([1, 1, 1] as const)
    const same =
      t.property === 'quaternion'
        ? Math.abs(values[0]! * rest[0]! + values[1]! * rest[1]! + values[2]! * rest[2]! + values[3]! * rest[3]!) > 1 - 1e-7
        : values.every((v, c) => Math.abs(v - rest[c]!) < (t.property === 'position' ? 1e-3 : 1e-4))
    if (same) continue
    out.push({ node: t.node, property: t.property, size: t.size, values, constant: true })
  }
  return out
}

/** `clip` (decoded for `source`) as a clip for `target`. */
export function retargetClip(clip: Clip, source: Rig, target: Rig, options: RetargetOptions = {}): Clip {
  const method = options.method ?? 'direction'
  const count = Math.max(1, clip.count)
  const pairs = matchBones(source, target)
  const sourceRest = worldPose(source, restPose(source))
  const targetRest = worldPose(target, restPose(target))

  // Per matched bone, the constant factor of the world formula: W_source_rest⁻¹ · A · W_target_rest.
  const correction = new Map<number, Quat>()
  for (const [s, t] of pairs) {
    let align: Quat = [...IDENTITY] as Quat
    const child = mainChild(target.nodes[t]!.name)
    const sc = child === null ? undefined : source.byName.get(child)
    const tc = child === null ? undefined : target.byName.get(child)
    if (sc !== undefined && tc !== undefined) {
      const ds = normalize(sub(sourceRest.translations[sc]!, sourceRest.translations[s]!))
      const dt = normalize(sub(targetRest.translations[tc]!, targetRest.translations[t]!))
      const ref = rollReference(target.nodes[t]!.name)
      const sr = ref === null ? undefined : source.byName.get(ref)
      const tr = ref === null ? undefined : target.byName.get(ref)
      align =
        sr !== undefined && tr !== undefined
          ? qfromFrames(dt, sub(targetRest.translations[tr]!, targetRest.translations[t]!), ds, sub(sourceRest.translations[sr]!, sourceRest.translations[s]!))
          : qfromUnitVectors(dt, ds)
    }
    correction.set(t, qmul(qmul(qinv(sourceRest.rotations[s]!), align), targetRest.rotations[t]!))
  }

  const sourceRoot = source.byName.get(ROOT_BONE)
  const targetRoot = target.byName.get(ROOT_BONE)
  const sourcePelvis = source.byName.get(PELVIS)
  const targetPelvis = target.byName.get(PELVIS)
  const heightRatio =
    sourcePelvis !== undefined && targetPelvis !== undefined && sourceRest.translations[sourcePelvis]![1] > 0
      ? targetRest.translations[targetPelvis]![1] / sourceRest.translations[sourcePelvis]![1]
      : 1

  // Only the matched bones and their parents matter (the models have 157 to 449 nodes; about 60 bones are matched): the nodes to
  // evaluate, parents first, and each source node's rotation and position track, looked up once instead of per key.
  const withParents = (rig: Rig, nodes: number[]): number[] => {
    const need = new Set<number>()
    for (let n of nodes) for (; n >= 0 && !need.has(n); n = rig.nodes[n]!.parent) need.add(n)
    return rig.order.filter((i) => need.has(i))
  }
  const sourceNodes = withParents(source, [...pairs.map(([s]) => s), ...(sourceRoot === undefined ? [] : [sourceRoot])])
  const targetNodes = withParents(target, pairs.map(([, t]) => t))
  const rotationTrack: (ClipTrack | undefined)[] = new Array(source.nodes.length)
  const positionTrack: (ClipTrack | undefined)[] = new Array(source.nodes.length)
  for (const t of clip.tracks) {
    if (t.node >= source.nodes.length) continue
    if (t.property === 'quaternion') rotationTrack[t.node] = t
    else if (t.property === 'position') positionTrack[t.node] = t
  }

  // Flat, monomorphic buffers for the per-key loop: rest rotations, parents, the corrections, and each source node's track.
  const flatRotations = (rig: Rig): Float64Array => {
    const out = new Float64Array(rig.nodes.length * 4)
    rig.nodes.forEach((n, i) => out.set(n.rotation, i * 4))
    return out
  }
  const sourceRestLocal = flatRotations(source)
  const targetRestLocal = flatRotations(target)
  const sourceParent = Int32Array.from(source.nodes, (n) => n.parent)
  const targetParent = Int32Array.from(target.nodes, (n) => n.parent)
  const sourceOf = new Int32Array(target.nodes.length).fill(-1)
  for (const [s, t] of pairs) sourceOf[t] = s
  const corrections = new Float64Array(target.nodes.length * 4)
  for (const [t, q] of correction) corrections.set(q, t * 4)
  // Decoded quaternions are unit length (tests/conformance.test.ts checks every key), so they are used as they are.
  const trackValues: (Float32Array | null)[] = sourceNodes.map((i) => rotationTrack[i]?.values ?? null)
  const trackStride = Int32Array.from(sourceNodes, (i) => (rotationTrack[i] && !rotationTrack[i]!.constant ? 4 : 0))

  const outputs: (Float32Array | undefined)[] = new Array(target.nodes.length)
  for (const [, t] of pairs) outputs[t] = new Float32Array(count * 4)
  const rootPositions = sourceRoot !== undefined && targetRoot !== undefined ? new Float32Array(count * 3) : null
  const sourceWorld = new Float64Array(source.nodes.length * 4)
  const targetWorld = new Float64Array(target.nodes.length * 4)
  const local = new Float64Array(4)
  const world = new Float64Array(4)
  const inverse = new Float64Array(4)

  // The root's fixed parts. Its parents' positions are taken at rest, which keeps a clip in place: Crepuscule's `Root` travels in fight
  // clips, and the viewer drops that travel for native clips too (lib/viewer/threeClip.ts). Their rotations do follow the clip.
  const rootRest = sourceRoot === undefined ? [0, 0, 0] : sourceRest.translations[sourceRoot]!
  const targetRootRest = targetRoot === undefined ? [0, 0, 0] : targetRest.translations[targetRoot]!
  const targetRootParent = targetRoot === undefined ? -1 : target.nodes[targetRoot]!.parent
  const intoTargetParent: Quat = targetRootParent < 0 ? ([...IDENTITY] as Quat) : qinv(targetRest.rotations[targetRootParent]!)
  const targetParentPosition: Vec3 = targetRootParent < 0 ? [0, 0, 0] : targetRest.translations[targetRootParent]!

  // Props held by a hand at rest: their fixed offset from that hand, and their own tracks.
  const held: { prop: number; hand: number; rotation: Quat; offset: Vec3; rotations: Float32Array; positions: Float32Array }[] = []
  target.nodes.forEach((node, i) => {
    if (!PROP.test(node.name) || node.parent < 0) return
    let best: { hand: number; distance: number } | null = null
    for (const side of ['L', 'R']) {
      const hand = target.byName.get(`Bip001${side}Hand`)
      if (hand === undefined || sourceOf[hand]! < 0) continue
      const d = sub(targetRest.translations[i]!, targetRest.translations[hand]!)
      const distance = Math.hypot(d[0], d[1], d[2])
      if (!best || distance < best.distance) best = { hand, distance }
    }
    if (!best || best.distance > HELD_DISTANCE) return
    const handRest = qinv(targetRest.rotations[best.hand]!)
    held.push({
      prop: i,
      hand: best.hand,
      rotation: qmul(handRest, targetRest.rotations[i]!),
      offset: qrotate(handRest, sub(targetRest.translations[i]!, targetRest.translations[best.hand]!)),
      rotations: new Float32Array(count * 4),
      positions: new Float32Array(count * 3),
    })
  })
  const contact = options.contact && method === 'direction' ? createContactPlanner(source, target, sourceOf, corrections, heightRatio) : null
  const override = new Float64Array(target.nodes.length * 4)
  const overridden = new Uint8Array(target.nodes.length)
  const targetPosition = new Float64Array(target.nodes.length * 3)
  const quatAt = (buffer: Float64Array, i: number): Quat => [buffer[i * 4]!, buffer[i * 4 + 1]!, buffer[i * 4 + 2]!, buffer[i * 4 + 3]!]
  const vecAt = (buffer: Float64Array, i: number): Vec3 => [buffer[i * 3]!, buffer[i * 3 + 1]!, buffer[i * 3 + 2]!]
  // Positions are only needed along the chains to the holding hands and the props' parents.
  const handChain = withParents(target, held.flatMap((h) => [h.hand, targetParent[h.prop]!]))
  const targetRestTranslation = new Float64Array(target.nodes.length * 3)
  target.nodes.forEach((n, i) => targetRestTranslation.set(n.translation, i * 3))

  for (let k = 0; k < count; k++) {
    // World rotations of the source pose at key k (bones without a track stay at rest).
    for (let n = 0; n < sourceNodes.length; n++) {
      const i = sourceNodes[n]!
      const values = trackValues[n]
      // Two branches on purpose: one array type per load keeps the loop monomorphic (Float32 track data, Float64 rest data).
      if (values) {
        const o = k * trackStride[n]!
        local[0] = values[o]!
        local[1] = values[o + 1]!
        local[2] = values[o + 2]!
        local[3] = values[o + 3]!
      } else {
        const o = i * 4
        local[0] = sourceRestLocal[o]!
        local[1] = sourceRestLocal[o + 1]!
        local[2] = sourceRestLocal[o + 2]!
        local[3] = sourceRestLocal[o + 3]!
      }
      const parent = sourceParent[i]!
      if (parent < 0) sourceWorld.set(local, i * 4)
      else mulInto(sourceWorld, parent * 4, local, 0, sourceWorld, i * 4)
    }

    if (contact) {
      overridden.fill(0)
      contact.plan(sourceWorld, override, overridden)
    }

    // Target, parents first: a matched bone from the source, any other node from its rest pose.
    for (const i of targetNodes) {
      const parent = targetParent[i]!
      const s = sourceOf[i]!
      if (s < 0) {
        if (parent < 0) targetWorld.set(targetRestLocal.subarray(i * 4, i * 4 + 4), i * 4)
        else mulInto(targetWorld, parent * 4, targetRestLocal, i * 4, targetWorld, i * 4)
        continue
      }
      if (method === 'direction') {
        if (overridden[i]) world.set(override.subarray(i * 4, i * 4 + 4))
        else mulInto(sourceWorld, s * 4, corrections, i * 4, world, 0)
        if (parent < 0) local.set(world)
        else {
          inverseInto(targetWorld, parent * 4, inverse)
          mulInto(inverse, 0, world, 0, local, 0)
        }
      } else {
        // r_target · r_source⁻¹ · q_source, with q_source the source bone's local rotation at this key.
        const sp = sourceParent[s]!
        if (sp < 0) world.set(sourceWorld.subarray(s * 4, s * 4 + 4))
        else {
          inverseInto(sourceWorld, sp * 4, inverse)
          mulInto(inverse, 0, sourceWorld, s * 4, world, 0)
        }
        inverseInto(sourceRestLocal, s * 4, inverse)
        mulInto(inverse, 0, world, 0, local, 0)
        mulInto(targetRestLocal, i * 4, local, 0, local, 0)
      }
      if (parent < 0) targetWorld.set(local, i * 4)
      else mulInto(targetWorld, parent * 4, local, 0, targetWorld, i * 4)
      const out = outputs[i]!
      const o = k * 4
      out[o] = local[0]!
      out[o + 1] = local[1]!
      out[o + 2] = local[2]!
      out[o + 3] = local[3]!
      keepHemisphere(out, k)
    }

    if (rootPositions) {
      // The source root's world position: its parent's rest position plus its own local position at this key, turned by the parent.
      const track = positionTrack[sourceRoot!]
      const o = track ? (track.constant ? 0 : k * 3) : 0
      const t: Vec3 = track ? [track.values[o]!, track.values[o + 1]!, track.values[o + 2]!] : source.nodes[sourceRoot!]!.translation
      const parent = sourceParent[sourceRoot!]!
      let px = t[0], py = t[1], pz = t[2]
      if (parent >= 0) {
        const p = parent * 4
        const off = qrotate([sourceWorld[p]!, sourceWorld[p + 1]!, sourceWorld[p + 2]!, sourceWorld[p + 3]!], t)
        const base = sourceRest.translations[parent]!
        px = base[0] + off[0]
        py = base[1] + off[1]
        pz = base[2] + off[2]
      }
      // Its offset from rest, scaled to the target's height, in the target parent's frame.
      const moved: Vec3 = [
        targetRootRest[0]! + (px - rootRest[0]!) * heightRatio - targetParentPosition[0],
        targetRootRest[1]! + (py - rootRest[1]!) * heightRatio - targetParentPosition[1],
        targetRootRest[2]! + (pz - rootRest[2]!) * heightRatio - targetParentPosition[2],
      ]
      rootPositions.set(qrotate(intoTargetParent, moved), k * 3)
    }

    if (held.length > 0) {
      // Target world positions down to the hands (rest offsets; the root at this key's position), then each held prop.
      for (const i of handChain) {
        const parent = targetParent[i]!
        const fromRoot = i === targetRoot && rootPositions !== null
        const src = fromRoot ? rootPositions! : targetRestTranslation
        const o = fromRoot ? k * 3 : i * 3
        const tx = src[o]!, ty = src[o + 1]!, tz = src[o + 2]!
        if (parent < 0) {
          targetPosition[i * 3] = tx
          targetPosition[i * 3 + 1] = ty
          targetPosition[i * 3 + 2] = tz
          continue
        }
        // parent position + parent rotation applied to (tx, ty, tz), without allocating
        const q = parent * 4
        const x = targetWorld[q]!, y = targetWorld[q + 1]!, z = targetWorld[q + 2]!, w = targetWorld[q + 3]!
        const cx = y * tz - z * ty, cy = z * tx - x * tz, cz = x * ty - y * tx
        targetPosition[i * 3] = targetPosition[parent * 3]! + tx + 2 * (w * cx + y * cz - z * cy)
        targetPosition[i * 3 + 1] = targetPosition[parent * 3 + 1]! + ty + 2 * (w * cy + z * cx - x * cz)
        targetPosition[i * 3 + 2] = targetPosition[parent * 3 + 2]! + tz + 2 * (w * cz + x * cy - y * cx)
      }
      for (const h of held) {
        const handWorld = quatAt(targetWorld, h.hand)
        const handPosition = vecAt(targetPosition, h.hand)
        const parent = targetParent[h.prop]!
        const parentInverse = qinv(quatAt(targetWorld, parent))
        const localRotation = qmul(parentInverse, qmul(handWorld, h.rotation))
        const off = qrotate(handWorld, h.offset)
        const world: Vec3 = [handPosition[0] + off[0], handPosition[1] + off[1], handPosition[2] + off[2]]
        h.rotations.set(localRotation, k * 4)
        keepHemisphere(h.rotations, k)
        h.positions.set(qrotate(parentInverse, sub(world, vecAt(targetPosition, parent))), k * 3)
      }
    }
  }
  const rotations = new Map<number, Float32Array>(pairs.map(([, t]) => [t, outputs[t]!]))

  const tracks: ClipTrack[] = []
  for (const [, t] of pairs) {
    const values = rotations.get(t)!
    tracks.push(count === 1 ? { node: t, property: 'quaternion', size: 4, values, constant: true } : { node: t, property: 'quaternion', size: 4, values, constant: false })
  }
  if (rootPositions) tracks.push({ node: targetRoot!, property: 'position', size: 3, values: rootPositions, constant: count === 1 })
  for (const h of held) {
    tracks.push({ node: h.prop, property: 'quaternion', size: 4, values: h.rotations, constant: count === 1 })
    tracks.push({ node: h.prop, property: 'position', size: 3, values: h.positions, constant: count === 1 })
  }

  if (options.fill) tracks.push(...fillTracks(options.fill, tracks, target))

  const morphs: ClipMorphTrack[] = []
  for (const m of clip.morphs) {
    const sourceNode = source.nodes[m.node]
    const name = sourceNode?.morphTargets?.[m.target]
    if (!sourceNode || name === undefined) continue
    const role = meshRole(sourceNode.name)
    target.nodes.forEach((node, i) => {
      if (!node.morphTargets || meshRole(node.name) !== role) return
      const index = node.morphTargets.indexOf(name)
      if (index >= 0) morphs.push({ node: i, target: index, values: m.values, constant: m.constant })
    })
  }

  return { name: clip.name, duration: clip.duration, count: clip.count, times: clip.times, tracks, morphs }
}
