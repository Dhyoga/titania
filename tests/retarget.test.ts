import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { decodeClip, type Clip } from '../lib/anim/clip.ts'
import { applyClipKey, restPose, worldPose } from '../lib/anim/fk.ts'
import { resolveClipPath } from '../lib/anim/paths.ts'
import { cross, qangle, qinv, qmul, sub, vangle } from '../lib/anim/quat.ts'
import { contactWeight } from '../lib/anim/contact.ts'
import { mainChild, retargetClip, rollReference } from '../lib/anim/retarget.ts'
import { rigFromGltf, type Rig } from '../lib/anim/rig.ts'

test('main child and roll reference by Biped name', () => {
  assert.equal(mainChild('Bip001LUpperArm'), 'Bip001LForearm')
  assert.equal(mainChild('Bip001RHand'), 'Bip001RFinger2')
  assert.equal(mainChild('Bip001Spine2'), 'Bip001Neck')
  assert.equal(mainChild('Bip001LFinger0'), 'Bip001LFinger01')
  assert.equal(mainChild('Bip001LFinger02'), null)
  assert.equal(mainChild('Bip001Head'), null)
  assert.equal(rollReference('Bip001LHand'), 'Bip001LFinger0')
  assert.equal(rollReference('Bip001LForearm'), null)
})

test('a rig with an extra turned root and another parent for the arm still gets the source directions', () => {
  // Source: Bip001 > Spine > Arm > Hand. Target: Root (90° about X) > Bip001 > Spine > Neck > Arm > Hand, other rest offsets.
  const source = rigFromGltf({
    nodes: [
      { name: 'Bip001', children: [1], translation: [0, 1, 0] },
      { name: 'Bip001Spine', children: [2], translation: [0, 0.2, 0] },
      { name: 'Bip001LUpperArm', children: [3], translation: [0.1, 0.3, 0] },
      { name: 'Bip001LForearm', translation: [0.3, 0, 0] },
    ],
  })
  const s = Math.SQRT1_2
  const target = rigFromGltf({
    nodes: [
      { name: 'Root', children: [1], rotation: [s, 0, 0, s] },
      { name: 'Bip001', children: [2], translation: [0, 0, -1], rotation: [-s, 0, 0, s] },
      { name: 'Bip001Spine', children: [3], translation: [0, 0.25, 0] },
      { name: 'Bip001Neck', children: [4], translation: [0, 0.3, 0] },
      { name: 'Bip001LUpperArm', children: [5], translation: [0.1, 0, 0], rotation: [0, 0, 0.1305, 0.9914] },
      { name: 'Bip001LForearm', translation: [0.28, 0, 0] },
    ],
  })
  // The arm raised 90° about Z at key 1.
  const clip: Clip = {
    name: 'raise', duration: 1, count: 2, times: Float32Array.of(0, 1), morphs: [],
    tracks: [{ node: 2, property: 'quaternion', size: 4, constant: false, values: Float32Array.of(0, 0, 0, 1, 0, 0, s, s) }],
  }
  const out = retargetClip(clip, source, target)
  assert.ok(out.tracks.some((t) => t.node === 4 && t.property === 'quaternion'), 'the arm is driven')
  assert.ok(!out.tracks.some((t) => t.node === 3), 'the neck (not in the source) is not driven')
  for (const k of [0, 1]) {
    const sp = restPose(source)
    applyClipKey(sp, clip, k)
    const sw = worldPose(source, sp)
    const tp = restPose(target)
    applyClipKey(tp, out, k)
    const tw = worldPose(target, tp)
    const ds = sub(sw.translations[3]!, sw.translations[2]!)
    const dt = sub(tw.translations[5]!, tw.translations[4]!) // tracks are Float32: a few thousandths of a degree of rounding
    assert.ok(vangle(ds, dt) < 0.01, `key ${k}: arm direction off by ${vangle(ds, dt)}°`)
  }
})

test('fill: nodes the retargeted clip leaves without a track hold the fill clip\'s mean pose; driven nodes and Bip001 positions are not touched', () => {
  const source = rigFromGltf({
    nodes: [
      { name: 'Bip001', children: [1], translation: [0, 1, 0] },
      { name: 'Bip001Spine', children: [2], translation: [0, 0.2, 0] },
      { name: 'Bip001LUpperArm', children: [3], translation: [0.1, 0.3, 0] },
      { name: 'Bip001LForearm', translation: [0.3, 0, 0] },
    ],
  })
  // The target has a skirt helper bone under the spine and a twist bone, which the source lacks.
  const target = rigFromGltf({
    nodes: [
      { name: 'Bip001', children: [1], translation: [0, 1, 0] },
      { name: 'Bip001Spine', children: [2, 4, 5], translation: [0, 0.2, 0] },
      { name: 'Bip001LUpperArm', children: [3], translation: [0.1, 0.3, 0] },
      { name: 'Bip001LForearm', translation: [0.3, 0, 0] },
      { name: 'SkirtBoneL00', translation: [0, -0.1, 0] },
      { name: 'Bip001LUpArmTwist', translation: [0, 0, 0] },
    ],
  })
  const s = Math.SQRT1_2
  const clip: Clip = {
    name: 'raise', duration: 1, count: 2, times: Float32Array.of(0, 1), morphs: [],
    tracks: [{ node: 2, property: 'quaternion', size: 4, constant: false, values: Float32Array.of(0, 0, 0, 1, 0, 0, s, s) }],
  }
  const fill: Clip = {
    name: 'idle', duration: 2, count: 3, times: Float32Array.of(0, 1, 2), morphs: [],
    tracks: [
      { node: 4, property: 'quaternion', size: 4, constant: false, values: Float32Array.of(0, 0.2588, 0, 0.9659, 0, 0.5, 0, 0.866, 0, 0.2588, 0, 0.9659) },
      { node: 4, property: 'position', size: 3, constant: true, values: Float32Array.of(0, -0.12, 0.01) },
      { node: 5, property: 'quaternion', size: 4, constant: true, values: Float32Array.of(0.1, 0, 0, 0.995) },
      { node: 2, property: 'quaternion', size: 4, constant: false, values: Float32Array.of(0.5, 0, 0, 0.866, 0, 0, 0, 1, 0, 0, 0, 1) }, // driven by the clip: not filled
      { node: 1, property: 'position', size: 3, constant: true, values: Float32Array.of(0, 0.3, 0) }, // a Bip001 position: never filled
    ],
  }
  const plain = retargetClip(clip, source, target)
  assert.ok(!plain.tracks.some((t) => t.node === 4 || t.node === 5), 'no fill: the helper bones have no track')

  const out = retargetClip(clip, source, target, { fill })
  const track = (node: number, property: string) => out.tracks.find((t) => t.node === node && t.property === property)
  // Three keys about Y at 30°, 60°, 30° (the half angles 0.2588/0.9659, 0.5/0.866, 0.2588/0.9659): their normalized mean.
  const sum = [0.2588 + 0.5 + 0.2588, 0.9659 + 0.866 + 0.9659]
  const length = Math.hypot(sum[0]!, sum[1]!)
  const mean = track(4, 'quaternion')!.values
  assert.ok(Math.abs(mean[1]! - sum[0]! / length) < 1e-5 && Math.abs(mean[3]! - sum[1]! / length) < 1e-5 && mean[0] === 0 && mean[2] === 0, 'mean of the fill clip\'s keys')
  assert.equal(track(4, 'quaternion')!.constant, true)
  assert.deepEqual([...track(4, 'position')!.values], [...Float32Array.of(0, -0.12, 0.01)])
  assert.deepEqual([...track(5, 'quaternion')!.values], [...Float32Array.of(0.1, 0, 0, 0.995)], 'a Bip001 bone the source does not drive is filled too')
  assert.deepEqual([...track(2, 'quaternion')!.values], [...plain.tracks.find((t) => t.node === 2 && t.property === 'quaternion')!.values], 'the driven arm keeps the retargeted rotation')
  assert.ok(!track(1, 'position') || track(1, 'position')!.values[1] !== 0.3, 'Bip001 positions come from the source, not the fill')
  assert.equal(out.tracks.length, plain.tracks.length + 3, 'three filled tracks: skirt rotation and position, twist rotation')
})

// Real data: Shukra's and Pavo's Generic rigs and clip sets, in both directions. Skipped without data/.
// Qu's frames are the sources (they have clips); Erza (add-erza-model) is a target only.
const MODELS = { shukra: 'r3qumd010011', pavo: 'r2qumd010011', erza: 'erza-scarlet' } as const
type Model = keyof typeof MODELS
type Frame = 'shukra' | 'pavo'
const FRAMES: Frame[] = ['shukra', 'pavo']
const skip = !FRAMES.every((f) => existsSync(new URL(`../data/${f}/anim/manifest.json`, import.meta.url))) && 'data/ is not present'
const data = (path: string) => new URL(`../data/${path}`, import.meta.url)
const skipErza = skip || (!existsSync(data('erza/models/erza-scarlet.glb')) && 'data/erza/ has no converted model')

const rigs = new Map<Model, Rig>()
function rigOf(frame: Model): Rig {
  if (!rigs.has(frame)) {
    const b = readFileSync(data(`${frame}/models/${MODELS[frame]}.glb`))
    rigs.set(frame, rigFromGltf(JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'))))
  }
  return rigs.get(frame)!
}
function clipOf(frame: Frame, name: string): Clip {
  const manifest = JSON.parse(readFileSync(data(`${frame}/anim/manifest.json`), 'utf8')) as { clips: { name: string; file: string }[] }
  const entry = manifest.clips.find((c) => c.name === name)!
  return decodeClip(JSON.parse(readFileSync(data(`${frame}/${resolveClipPath('anim/manifest.json', entry.file)}`), 'utf8')), name)
}

const MAIN_BONES = ['Bip001Spine', 'Bip001Spine1', 'Bip001Spine2', 'Bip001Neck', 'Bip001Head', ...['L', 'R'].flatMap((side) => ['Clavicle', 'UpperArm', 'Forearm', 'Hand', 'Thigh', 'Calf', 'Foot'].map((part) => `Bip001${side}${part}`))]
const FOOT_BONE = /^Bip001[LR]Foot$/
const keysOf = (clip: Clip) => [...new Set([0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1].map((f) => Math.round(f * (clip.count - 1))))]

test('real data: retargeted limbs point where the source model points, palms included, from Shukra to Pavo and back', { skip }, () => {
  const report: string[] = []
  for (const from of FRAMES) for (const to of FRAMES) if (from !== to) checkLimbs(from, to, report)
  assert.equal(report.length, 6, 'two directions, three clips each')
})

test('real data: the same onto Erza, from Shukra and from Pavo (the skeleton is another one: Pavo-like hierarchy, longer legs, T-pose)', { skip: skipErza }, () => {
  const report: string[] = []
  for (const from of FRAMES) checkLimbs(from, 'erza', report)
  assert.equal(report.length, 6, 'two sources, three clips each')
})

function checkLimbs(from: Frame, to: Model, report: string[]): void {
  const source = rigOf(from)
  const target = rigOf(to)
  const sourceRest = worldPose(source, restPose(source))
  const targetRest = worldPose(target, restPose(target))
  for (const name of ['UiStand1', 'BoardAct0201', 'Run']) {
    const clip = clipOf(from, name)
    const out = retargetClip(clip, source, target)
    let sum = 0
    let n = 0
    for (const k of keysOf(clip)) {
      const sp = restPose(source)
      applyClipKey(sp, clip, k)
      const sw = worldPose(source, sp)
      const tp = restPose(target)
      applyClipKey(tp, out, k)
      const tw = worldPose(target, tp)
      for (const bone of MAIN_BONES) {
        const s = source.byName.get(bone)!
        const t = target.byName.get(bone)!
        const child = mainChild(bone)
        // The head and the feet keep the source's change of world rotation instead of pointing at a joint (feet: fix-erza-retarget-limbs).
        const byRotation = child === null || FOOT_BONE.test(bone)
        const error =
          byRotation
            ? qangle(qmul(sw.rotations[s]!, qinv(sourceRest.rotations[s]!)), qmul(tw.rotations[t]!, qinv(targetRest.rotations[t]!))) // the head: its change of world rotation
            : vangle(sub(sw.translations[source.byName.get(child)!]!, sw.translations[s]!), sub(tw.translations[target.byName.get(child)!]!, tw.translations[t]!))
        if (FOOT_BONE.test(bone)) {
          assert.ok(error < 1, `${from}→${to} ${name} key ${k}: ${bone} turned differently from the source's by ${error.toFixed(2)}°`)
          continue
        }
        assert.ok(error < 15, `${from}→${to} ${name} key ${k}: ${bone} off by ${error.toFixed(1)}°`)
        sum += error
        n++
      }
      for (const side of ['L', 'R']) {
        const palm = (rig: Rig, w: typeof sw) => {
          const h = w.translations[rig.byName.get(`Bip001${side}Hand`)!]!
          return cross(sub(w.translations[rig.byName.get(`Bip001${side}Finger0`)!]!, h), sub(w.translations[rig.byName.get(`Bip001${side}Finger2`)!]!, h))
        }
        const error = vangle(palm(source, sw), palm(target, tw))
        assert.ok(error < 5, `${from}→${to} ${name} key ${k}: ${side} palm turned by ${error.toFixed(1)}°`)
      }
    }
    assert.ok(sum / n < 5, `${from}→${to} ${name}: mean ${(sum / n).toFixed(2)}°`)
    report.push(`${from}→${to} ${name} ${(sum / n).toFixed(2)}°`)
  }
}

// The spec asks for 2 cm between Qu's frames, which holds since the feet keep their rest-relative pitch (fix-erza-retarget-limbs: Shukra → Pavo -1.9 cm, was
// -2.7 with the foot pointed at its toe; Pavo → Shukra 0.3). Onto Erza (measured with the real code: Shukra 3.0 cm in `UiStand1` and 6.0 in `Run`, Pavo 0.7 and 7.3,
// was 8.0 and 10.0) the rest is her foot bone's length, 0.213 m against Shukra's 0.132 m: in a push-off her toe dips below where the scaled source toe would be.
// Bounded at the measured values rounded up by 0.5 cm; see AGENTS.md.
const FEET_TOLERANCE: Record<string, number> = { 'pavo→shukra': 0.02, 'shukra→pavo': 0.02, 'shukra→erza': 0.065, 'pavo→erza': 0.08 }

test('real data: the feet stay within 2 cm between Shukra and Pavo, and within 6.5 and 8 cm onto Erza, of where the source puts them relative to the floor', { skip }, () => {
  const lowest = (rig: Rig, clip: Clip): number => {
    const ids = ['Bip001LToe0', 'Bip001RToe0', 'Bip001LFoot', 'Bip001RFoot'].map((n) => rig.byName.get(n)!)
    const rest = worldPose(rig, restPose(rig))
    const restMin = Math.min(...ids.map((i) => rest.translations[i]![1]))
    let min = Infinity
    for (let k = 0; k < clip.count; k += Math.max(1, Math.floor(clip.count / 60))) {
      const p = restPose(rig)
      applyClipKey(p, clip, k)
      const w = worldPose(rig, p)
      min = Math.min(min, ...ids.map((i) => w.translations[i]![1]))
    }
    return min - restMin
  }
  for (const from of FRAMES) {
    for (const to of [...FRAMES, ...(skipErza ? [] : ['erza' as const])] as Model[]) {
      if (from === to) continue
      for (const name of ['UiStand1', 'Run']) {
        const clip = clipOf(from, name)
        const difference = Math.abs(lowest(rigOf(to), retargetClip(clip, rigOf(from), rigOf(to))) - lowest(rigOf(from), clip))
        assert.ok(difference < FEET_TOLERANCE[`${from}→${to}`]!, `${from}→${to} ${name}: feet ${(difference * 100).toFixed(1)} cm off`)
      }
    }
  }
})

test('real data: unmatched bones are dropped, only Bip001 keeps a position, face weights follow by morph name', { skip }, () => {
  const shukra = rigOf('shukra')
  const pavo = rigOf('pavo')
  const pavoRun = clipOf('pavo', 'Run')
  const out = retargetClip(pavoRun, pavo, shukra)
  assert.ok(out.tracks.every((t) => shukra.nodes[t.node]!.name.startsWith('Bip001')), 'only Bip001 bones: hair, cloth and helper bones are not driven')
  // Positions only for the pelvis root and the props, which follow the hands (see the held-prop test).
  assert.deepEqual(out.tracks.filter((t) => t.property === 'position').map((t) => shukra.nodes[t.node]!.name).sort(), ['Bip001', 'Bip001Prop1', 'Bip001Prop2'])
  assert.equal(out.times, pavoRun.times, 'key times are shared, not copied')

  const board = clipOf('pavo', 'BoardAct0201')
  assert.ok(board.morphs.length > 0, 'the source clip has face weights')
  const mapped = retargetClip(board, pavo, shukra)
  for (const m of board.morphs) {
    const name = pavo.nodes[m.node]!.morphTargets![m.target]!
    const onTarget = mapped.morphs.filter((x) => shukra.nodes[x.node]!.morphTargets![x.target] === name)
    // A morph the target lacks is dropped (Pavo's `Face` has 21 targets, Shukra's 35), so only those it has must follow by name.
    if (!shukra.nodes.some((n) => n.morphTargets?.includes(name))) continue
    assert.ok(onTarget.length >= 1, `${name} is driven on Shukra`)
    for (const x of onTarget) assert.match(shukra.nodes[x.node]!.name, /Face|Eye/)
  }
})

test('real data: onto Erza only Bip001 bones are driven, only the pelvis root has a position, and her unheld props get nothing', { skip: skipErza }, () => {
  const erza = rigOf('erza')
  const rest = worldPose(erza, restPose(erza))
  const distance = (a: string, b: string) => Math.hypot(...sub(rest.translations[erza.byName.get(a)!]!, rest.translations[erza.byName.get(b)!]!))
  // Her Bip001Prop1 is 54 cm from her right hand and Prop2 2 m from both: neither is held (a prop within 10 cm of a hand is).
  assert.ok(distance('Bip001Prop1', 'Bip001RHand') > 0.4)
  assert.ok(distance('Bip001Prop2', 'Bip001LHand') > 1 && distance('Bip001Prop2', 'Bip001RHand') > 1)
  for (const from of FRAMES) {
    for (const name of ['UiStand1', 'BoardAct0201', 'Run']) {
      const out = retargetClip(clipOf(from, name), rigOf(from), erza)
      const driven = out.tracks.map((t) => erza.nodes[t.node]!.name)
      assert.ok(driven.every((n) => n.startsWith('Bip001')), `${from} ${name}: a track for ${driven.find((n) => !n.startsWith('Bip001'))}`)
      assert.ok(!driven.some((n) => /^Bone_/.test(n)), `${from} ${name}: skirt, hair, ribbon or face bone driven`)
      assert.ok(!driven.some((n) => /Prop/.test(n)), `${from} ${name}: a prop is driven`)
      assert.deepEqual(out.tracks.filter((t) => t.property === 'position').map((t) => erza.nodes[t.node]!.name), ['Bip001'])
    }
  }
})

test('real data: onto Erza her calf and thigh twist bones are driven: followed from Shukra, taken from Pavo\'s own where Pavo has them', { skip: skipErza }, () => {
  const erza = rigOf('erza')
  const rest = worldPose(erza, restPose(erza))
  const change = (w: ReturnType<typeof worldPose>, rig: Rig, name: string) => qmul(w.rotations[rig.byName.get(name)!]!, qinv(rest.rotations[rig.byName.get(name)!]!))
  for (const from of FRAMES) {
    const source = rigOf(from)
    const sourceRest = worldPose(source, restPose(source))
    for (const name of ['UiStand1', 'BoardAct0201', 'Run']) {
      const clip = clipOf(from, name)
      const out = retargetClip(clip, source, erza)
      for (const side of ['L', 'R']) {
        for (const twist of [`Bip001${side}CalfTwist`, `Bip001${side}ThighTwist`]) {
          assert.ok(out.tracks.some((t) => t.node === erza.byName.get(twist) && t.property === 'quaternion'), `${from} ${name}: ${twist} has a track`)
        }
      }
      for (const k of keysOf(clip)) {
        const sp = restPose(source)
        applyClipKey(sp, clip, k)
        const sw = worldPose(source, sp)
        const tp = restPose(erza)
        applyClipKey(tp, out, k)
        const tw = worldPose(erza, tp)
        for (const side of ['L', 'R']) {
          // neither source has a CalfTwist: it turns with her calf (within 0.1°: the output tracks are single precision)
          const calf = qangle(change(tw, erza, `Bip001${side}Calf`), change(tw, erza, `Bip001${side}CalfTwist`))
          assert.ok(calf < 0.1, `${from} ${name} key ${k}: ${side} calf twist is ${calf.toFixed(3)}° from her calf's turn`)
          if (from === 'shukra') {
            const thigh = qangle(change(tw, erza, `Bip001${side}Thigh`), change(tw, erza, `Bip001${side}ThighTwist`))
            assert.ok(thigh < 0.1, `shukra ${name} key ${k}: ${side} thigh twist is ${thigh.toFixed(3)}° from her thigh's turn`)
          } else {
            // Pavo has it: Pavo's own track, whose change of world rotation carries over exactly (no main child)
            const s = source.byName.get(`Bip001${side}ThighTwist`)!
            const own = qangle(qmul(sw.rotations[s]!, qinv(sourceRest.rotations[s]!)), change(tw, erza, `Bip001${side}ThighTwist`))
            assert.ok(own < 0.1, `pavo ${name} key ${k}: ${side} thigh twist is ${own.toFixed(3)}° from Pavo's own`)
          }
        }
      }
    }
  }
})

test('real data: a weapon prop stays in the hand it sits on at rest; props are never copied from the source', { skip }, () => {
  // Shukra's `Bip001Prop1` sits on her right hand and `Bip001Prop2` on her left (0 cm at rest). Pavo's `Bip001Prop1` is 30 cm from
  // her left hand: it is not held, so nothing drives it.
  const held: [string, string][] = [['Bip001Prop1', 'Bip001RHand'], ['Bip001Prop2', 'Bip001LHand']]
  const shukra = rigOf('shukra')
  for (const name of ['UiStand1', 'Run']) {
    const out = retargetClip(clipOf('pavo', name), rigOf('pavo'), shukra)
    const rest = worldPose(shukra, restPose(shukra))
    for (const [prop, hand] of held) {
      const p = shukra.byName.get(prop)!
      const h = shukra.byName.get(hand)!
      const restDistance = Math.hypot(...sub(rest.translations[p]!, rest.translations[h]!))
      assert.ok(out.tracks.some((t) => t.node === p && t.property === 'position'), `pavo→shukra ${name}: ${prop} is driven`)
      for (const k of keysOf(out)) {
        const pose = restPose(shukra)
        applyClipKey(pose, out, k)
        const w = worldPose(shukra, pose)
        const d = sub(w.translations[p]!, w.translations[h]!)
        const distance = Math.hypot(d[0], d[1], d[2])
        // Held rigidly: the same distance from the hand as at rest.
        assert.ok(Math.abs(distance - restDistance) < 0.005, `pavo→shukra ${name} key ${k}: ${prop} ${(distance * 100).toFixed(1)} cm from ${hand}, ${(restDistance * 100).toFixed(1)} at rest`)
      }
    }
    const pavo = rigOf('pavo')
    const back = retargetClip(clipOf('shukra', name), shukra, pavo)
    assert.ok(!back.tracks.some((t) => t.node === pavo.byName.get('Bip001Prop1') && t.property === 'position'), `shukra→pavo ${name}: Pavo's prop is not held, so it is not driven`)
  }
})

test('real data: Pavo\'s BoardAct1002 on Shukra fills her helper and ribbon bones from Shukra\'s UiStand1', { skip }, () => {
  const target = rigOf('shukra')
  const idle = clipOf('shukra', 'UiStand1')
  const source = rigOf('pavo')
  const clip = clipOf('pavo', 'BoardAct1002')
  const plain = retargetClip(clip, source, target)
  const out = retargetClip(clip, source, target, { fill: idle })
  const driven = new Set(plain.tracks.map((t) => `${t.node}:${t.property}`))
  const filled = out.tracks.filter((t) => !driven.has(`${t.node}:${t.property}`))
  const names = new Set(filled.map((t) => target.nodes[t.node]!.name))
  for (const bone of ['ThighrepairBoneL00', 'ThighrepairBoneR00', 'BoneLThighTwist', 'BoneLUpperArmTwist', 'RibbonBoneL00']) {
    assert.ok(names.has(bone), `${bone} is filled`)
  }
  assert.ok(filled.length > 150, `${filled.length} tracks filled`)
  assert.ok(filled.every((t) => t.constant), 'fill tracks are constant')
  assert.ok(!filled.some((t) => t.property === 'position' && target.nodes[t.node]!.name.startsWith('Bip001')), 'no Bip001 position is filled')
  // Every driven track is unchanged by the fill.
  for (const t of plain.tracks) {
    const same = out.tracks.find((o) => o.node === t.node && o.property === t.property)!
    assert.deepEqual([...same.values], [...t.values])
  }
})

test('fill: the mean of an animated quaternion track survives keys stored with opposite signs', () => {
  const rig = rigFromGltf({ nodes: [{ name: 'Bip001', children: [1] }, { name: 'Bip001Spine', children: [2] }, { name: 'SkirtBoneL00' }] })
  const clip: Clip = { name: 'c', duration: 1, count: 2, times: Float32Array.of(0, 1), morphs: [], tracks: [{ node: 1, property: 'quaternion', size: 4, constant: true, values: Float32Array.of(0, 0, 0, 1) }] }
  // q and −q are the same rotation: a naive sum of these three keys would cancel.
  const fill: Clip = { name: 'idle', duration: 2, count: 3, times: Float32Array.of(0, 1, 2), morphs: [], tracks: [{ node: 2, property: 'quaternion', size: 4, constant: false, values: Float32Array.of(0, 0.5, 0, 0.866, 0, -0.5, 0, -0.866, 0, 0.5, 0, 0.866) }] }
  const out = retargetClip(clip, rig, rig, { fill })
  const q = out.tracks.find((t) => t.node === 2)!.values
  assert.ok(Math.abs(Math.hypot(q[0]!, q[1]!, q[2]!, q[3]!) - 1) < 1e-5, 'unit length')
  assert.ok(Math.abs(q[1]! - 0.5) < 1e-4 && Math.abs(q[3]! - 0.866) < 1e-4, 'the same rotation, not a cancelled sum')
})

// ---------------------------------------------------------------- hands that rest on the hip (improve-lent-clips, contact.ts)

/** A small biped: pelvis, spine, two thighs, and the left arm chain; `arm` is the upper arm and forearm length, `shoulder` the shoulder's offset. */
function biped(arm: [number, number], shoulder: number): Rig {
  return rigFromGltf({
    nodes: [
      { name: 'Bip001', children: [1], translation: [0, 1, 0] },
      { name: 'Bip001Pelvis', children: [2, 3, 4] },
      { name: 'Bip001Spine', children: [5], translation: [0, 0.2, 0] },
      { name: 'Bip001LThigh', translation: [0.08, -0.05, 0] },
      { name: 'Bip001RThigh', translation: [-0.08, -0.05, 0] },
      { name: 'Bip001Spine1', children: [6], translation: [0, 0.15, 0] },
      { name: 'Bip001LClavicle', children: [7], translation: [0.06, 0.1, 0] },
      { name: 'Bip001LUpperArm', children: [8], translation: [shoulder, 0, 0] },
      { name: 'Bip001LForearm', children: [9], translation: [arm[0], 0, 0] },
      { name: 'Bip001LHand', translation: [arm[1], 0, 0] },
    ],
  })
}
const handFrom = (r: Rig, clip: Clip, key: number): number[] => {
  const p = restPose(r)
  applyClipKey(p, clip, key)
  const w = worldPose(r, p)
  const hand = w.translations[r.byName.get('Bip001LHand')!]!
  const pelvis = w.translations[r.byName.get('Bip001Pelvis')!]!
  return [hand[0] - pelvis[0], hand[1] - pelvis[1], hand[2] - pelvis[2]]
}
/** The left upper arm turned `degrees` about Z (0: out to the side, -90: hanging down), the rest at rest. */
const armClip = (degrees: number, upperNode = 7): Clip => {
  const h = (degrees * Math.PI) / 360
  return { name: 'arm', duration: 1, count: 2, times: Float32Array.of(0, 1), morphs: [], tracks: [{ node: upperNode, property: 'quaternion', size: 4, constant: true, values: Float32Array.of(0, 0, Math.sin(h), Math.cos(h)) }] }
}

test('contact: an arm hanging at the hip puts the target\'s hand where the source\'s hand was in its body frame; a hand away from the hip is left alone', () => {
  const source = biped([0.28, 0.25], 0.1)
  const target = biped([0.33, 0.27], 0.13) // longer arm, wider shoulder: the direction method puts the hand elsewhere
  const clip = armClip(-90)
  const wanted = handFrom(source, clip, 0)
  const plain = handFrom(target, retargetClip(clip, source, target), 0)
  const kept = handFrom(target, retargetClip(clip, source, target, { contact: true }), 0)
  assert.ok(Math.hypot(plain[0]! - wanted[0]!, plain[1]! - wanted[1]!) > 0.03, 'without contact the hand lands more than 3 cm off')
  assert.ok(Math.hypot(kept[0]! - wanted[0]!, kept[1]! - wanted[1]!, kept[2]! - wanted[2]!) < 0.003, `with contact within 3 mm: ${kept} vs ${wanted}`)

  // An arm held out to the side (hand 70 cm from the body axis) is not a contact: the result is the same as without.
  const away = armClip(0)
  const a = retargetClip(away, source, target)
  const b = retargetClip(away, source, target, { contact: true })
  for (const t of a.tracks) assert.deepEqual([...b.tracks.find((o) => o.node === t.node && o.property === t.property)!.values], [...t.values])
})

test('contact: the weight is 1 at the hip, 0 away from it, and fades in between', () => {
  const at = contactWeight(0.13, 0.1, 0.0, 0.2)
  assert.equal(at, 1)
  assert.equal(contactWeight(0.4, 0.1, 0, 0.2), 0, 'far to the side')
  assert.equal(contactWeight(0.13, 0.5, 0, 0.2), 0, 'at the shoulders')
  assert.equal(contactWeight(0.13, 0.1, 0.3, 0.2), 0, 'far in front')
  assert.equal(contactWeight(0.02, 0.1, 0, 0.2), 0, 'in front of the belly, across the body')
  const between = contactWeight(0.19, 0.1, 0, 0.2)
  assert.ok(between > 0 && between < 1, `fades: ${between}`)
})

// ---- the foot and the twist bones (fix-erza-retarget-limbs): synthetic rigs

/** A one-leg rig: `Bip001` > pelvis > thigh > calf > foot > toe, and optionally a twist bone that hangs from the thigh beside the calf (rolled 2° at rest). */
function leg(toe: [number, number, number], twist: boolean): Rig {
  const roll = [0, Math.sin(Math.PI / 180), 0, Math.cos(Math.PI / 180)]
  const nodes: object[] = [
    { name: 'Bip001', children: [1], translation: [0, 1, 0] },
    { name: 'Bip001Pelvis', children: [2] },
    { name: 'Bip001LThigh', children: twist ? [3, 6] : [3], translation: [0.1, 0, 0] },
    { name: 'Bip001LCalf', children: [4], translation: [0, -0.45, 0] },
    { name: 'Bip001LFoot', children: [5], translation: [0, -0.45, 0] },
    { name: 'Bip001LToe0', translation: toe },
  ]
  if (twist) nodes.push({ name: 'Bip001LCalfTwist', translation: [0, -0.45, 0], rotation: roll })
  return rigFromGltf({ nodes })
}

/** The calf (node 3) bent about X by `degrees` at keys 0, 1, 2; extra constant tracks for the twist bone when given. */
function bend(degrees: number[], twistDegrees?: number[]): Clip {
  const q = (d: number) => [Math.sin((d * Math.PI) / 360), 0, 0, Math.cos((d * Math.PI) / 360)]
  const track = (node: number, ds: number[]) => ({ node, property: 'quaternion' as const, size: 4, constant: false, values: Float32Array.from(ds.flatMap(q)) })
  return { name: 'bend', duration: 2, count: degrees.length, times: Float32Array.from(degrees.map((_, i) => i)), morphs: [], tracks: [track(3, degrees), ...(twistDegrees ? [track(6, twistDegrees)] : [])] }
}

const worldChange = (rig: Rig, out: Clip, node: number, key: number) => {
  const rest = worldPose(rig, restPose(rig))
  const pose = restPose(rig)
  applyClipKey(pose, out, key)
  const w = worldPose(rig, pose)
  return { rest, w, delta: qmul(w.rotations[node]!, qinv(rest.rotations[node]!)) }
}

test('twist: a twist bone the source lacks follows the calf through a bent knee and keeps its rest offset', () => {
  const source = leg([0, -0.12, 0.05], false)
  const target = leg([0, -0.14, 0.16], true)
  const out = retargetClip(bend([0, 45, 90]), source, target)
  const twist = target.byName.get('Bip001LCalfTwist')!
  assert.ok(out.tracks.some((t) => t.node === twist && t.property === 'quaternion'), 'the twist bone gets a track')
  for (const key of [0, 1, 2]) {
    const { rest, w } = worldChange(target, out, twist, key)
    const calf = target.byName.get('Bip001LCalf')!
    const calfChange = qmul(w.rotations[calf]!, qinv(rest.rotations[calf]!))
    const twistChange = qmul(w.rotations[twist]!, qinv(rest.rotations[twist]!))
    // the twist bone turns with the calf from its own rest pose (the 2° roll stays)
    assert.ok(qangle(calfChange, twistChange) < 0.01, `key ${key}: the twist bone is ${qangle(calfChange, twistChange).toFixed(3)}° from the calf's turn`)
    const offset = qmul(qinv(w.rotations[calf]!), w.rotations[twist]!)
    const restOffset = qmul(qinv(rest.rotations[calf]!), rest.rotations[twist]!)
    assert.ok(qangle(offset, restOffset) < 0.01, `key ${key}: the offset from the calf is its rest offset`)
  }
  assert.ok(qangle(worldChange(target, out, twist, 2).delta, [0, 0, 0, 1]) > 80, 'it really bent')
  assert.ok(out.tracks.every((t) => target.nodes[t.node]!.name.startsWith('Bip001')), 'Bip001 tracks only')
})

test('twist: a source that has the twist bone drives it; the follow rule does not apply', () => {
  const source = leg([0, -0.12, 0.05], true)
  const target = leg([0, -0.14, 0.16], true)
  // the source's twist bone turns less than its calf
  const out = retargetClip(bend([0, 40, 80], [0, 10, 20]), source, target)
  const twist = target.byName.get('Bip001LCalfTwist')!
  const track = out.tracks.filter((t) => t.node === twist)
  assert.equal(track.length, 1, 'one track, from the match by name')
  const { delta } = worldChange(target, out, twist, 2)
  const sourceChange = worldChange(source, bend([0, 40, 80], [0, 10, 20]), source.byName.get('Bip001LCalfTwist')!, 2).delta
  assert.ok(qangle(delta, sourceChange) < 0.01, 'it follows the source twist bone, not the calf')
})

test('twist: a target without the twist bone gets no extra track; with it, exactly one more', () => {
  const source = leg([0, -0.12, 0.05], false)
  const rotations = (target: Rig) => retargetClip(bend([0, 45, 90]), source, target).tracks.filter((t) => t.property === 'quaternion')
  const plain = leg([0, -0.14, 0.16], false)
  assert.equal(rotations(plain).length, 6, 'Bip001, pelvis, thigh, calf, foot, toe: the matched bones')
  const withTwist = leg([0, -0.14, 0.16], true)
  assert.equal(rotations(withTwist).length, 7)
  assert.equal(rotations(withTwist).filter((t) => withTwist.nodes[t.node]!.name === 'Bip001LCalfTwist').length, 1)
})

test('foot: it takes the source foot\'s change of world rotation, whatever its rest direction', () => {
  // Steep source foot (toe 0.12 under the ankle), flatter target foot: pointing at the toe would tilt the target's foot to the source's.
  const source = leg([0, -0.12, 0.05], false)
  const target = leg([0, -0.14, 0.16], true)
  const clip = bend([0, 45, 90])
  const out = retargetClip(clip, source, target)
  const foot = (rig: Rig) => rig.byName.get('Bip001LFoot')!
  for (const key of [0, 1, 2]) {
    const a = worldChange(source, clip, foot(source), key).delta
    const b = worldChange(target, out, foot(target), key).delta
    assert.ok(qangle(a, b) < 0.01, `key ${key}: the foot's change of world rotation is the source's (${qangle(a, b).toFixed(3)}°)`)
  }
  // and at rest it is the target's own pose: the same clip key 0 changes nothing
  assert.ok(qangle(worldChange(target, out, foot(target), 0).delta, [0, 0, 0, 1]) < 0.01)
})
