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

// Real data: every pair of the four frames' Generic rigs and clip sets. Skipped without data/.
const MODELS = { crepuscule: 'r5biankamd010011', stigmata: 'r4biankamd010011', veritas: 'r3biankamd010011', zero: 'r2biankamd010011' } as const
type Frame = keyof typeof MODELS
const FRAMES = Object.keys(MODELS) as Frame[]
const skip = !FRAMES.every((f) => existsSync(new URL(`../data/${f}/anim/manifest.json`, import.meta.url))) && 'data/ is not present'
const data = (path: string) => new URL(`../data/${path}`, import.meta.url)

const rigs = new Map<Frame, Rig>()
function rigOf(frame: Frame): Rig {
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
const keysOf = (clip: Clip) => [...new Set([0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1].map((f) => Math.round(f * (clip.count - 1))))]

test('real data: retargeted limbs point where the source model points, palms included, for every pair of frames', { skip }, () => {
  const report: string[] = []
  for (const from of FRAMES) {
    for (const to of FRAMES) {
      if (from === to) continue
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
            const error =
              child === null
                ? qangle(qmul(sw.rotations[s]!, qinv(sourceRest.rotations[s]!)), qmul(tw.rotations[t]!, qinv(targetRest.rotations[t]!))) // the head: its change of world rotation
                : vangle(sub(sw.translations[source.byName.get(child)!]!, sw.translations[s]!), sub(tw.translations[target.byName.get(child)!]!, tw.translations[t]!))
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
  }
  assert.equal(report.length, 36)
})

test('real data: the feet stay within 2 cm of where the source puts them relative to the floor', { skip }, () => {
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
    for (const to of FRAMES) {
      if (from === to) continue
      for (const name of ['UiStand1', 'Run']) {
        const clip = clipOf(from, name)
        const difference = Math.abs(lowest(rigOf(to), retargetClip(clip, rigOf(from), rigOf(to))) - lowest(rigOf(from), clip))
        assert.ok(difference < 0.02, `${from}→${to} ${name}: feet ${(difference * 100).toFixed(1)} cm off`)
      }
    }
  }
})

test('real data: unmatched bones are dropped, only Bip001 keeps a position, face weights follow by morph name', { skip }, () => {
  const veritasRun = clipOf('veritas', 'Run')
  const out = retargetClip(veritasRun, rigOf('veritas'), rigOf('crepuscule'))
  const crepuscule = rigOf('crepuscule')
  assert.ok(out.tracks.every((t) => crepuscule.nodes[t.node]!.name.startsWith('Bip001')), 'only Bip001 bones')
  assert.ok(!out.tracks.some((t) => crepuscule.nodes[t.node]!.name.includes('UpArmTwist')), 'Veritas-only twist bones are dropped')
  // Positions only for the pelvis root and the props, which follow the hands (see the held-prop test).
  assert.deepEqual(out.tracks.filter((t) => t.property === 'position').map((t) => crepuscule.nodes[t.node]!.name).sort(), ['Bip001', 'Bip001Prop1', 'Bip001Prop2'])
  assert.equal(out.times, veritasRun.times, 'key times are shared, not copied')

  const stigmata = rigOf('stigmata')
  const board = clipOf('stigmata', 'BoardAct0201')
  assert.ok(board.morphs.length > 0, 'the source clip has face weights')
  const mapped = retargetClip(board, stigmata, crepuscule)
  for (const m of board.morphs) {
    const name = stigmata.nodes[m.node]!.morphTargets![m.target]!
    const onTarget = mapped.morphs.filter((x) => crepuscule.nodes[x.node]!.morphTargets![x.target] === name)
    assert.ok(onTarget.length >= 1, `${name} is driven on Crepuscule`)
    for (const x of onTarget) assert.match(crepuscule.nodes[x.node]!.name, /Face|Eye/)
  }
})

test('real data: a weapon prop stays in the hand it sits on at rest; props are never copied from the source', { skip }, () => {
  // Every prop of the four rigs sits on a hand at rest (0 to 4 cm). Veritas holds her rifle in the left hand, Stigmata her bow in the
  // right; Crepuscule's and Zero's props carry no visible mesh but follow the same rule.
  const cases: [Frame, string, string][] = [
    ['veritas', 'Bip001Prop2', 'Bip001LHand'],
    ['zero', 'Bip001Prop2', 'Bip001LHand'],
    ['stigmata', 'Bip001Prop1', 'Bip001RHand'],
    ['stigmata', 'Bip001Prop2', 'Bip001LHand'],
    ['crepuscule', 'Bip001Prop1', 'Bip001RHand'],
  ]
  for (const [to, prop, hand] of cases) {
    const target = rigOf(to)
    for (const from of FRAMES.filter((f) => f !== to)) {
      for (const name of ['UiStand1', 'Run']) {
        const out = retargetClip(clipOf(from, name), rigOf(from), target)
        const p = target.byName.get(prop)!
        const h = target.byName.get(hand)!
        const rest = worldPose(target, restPose(target))
        const restDistance = Math.hypot(...sub(rest.translations[p]!, rest.translations[h]!))
        assert.ok(out.tracks.some((t) => t.node === p && t.property === 'position'), `${from}→${to} ${name}: ${prop} is driven`)
        for (const k of keysOf(out)) {
          const pose = restPose(target)
          applyClipKey(pose, out, k)
          const w = worldPose(target, pose)
          const d = sub(w.translations[p]!, w.translations[h]!)
          const distance = Math.hypot(d[0], d[1], d[2])
          // Held rigidly: the same distance from the hand as at rest (0 to 4 cm).
          assert.ok(Math.abs(distance - restDistance) < 0.005, `${from}→${to} ${name} key ${k}: ${prop} ${(distance * 100).toFixed(1)} cm from ${hand}, ${(restDistance * 100).toFixed(1)} at rest`)
        }
      }
    }
  }
})

test('real data: Solitary Dream\'s Board action is retargeted from Solitary Dream\'s own rig, not the Generic one', { skip }, () => {
  // Its tracks address the node indices of its manifest's target (r4biankamd019241); only 7 of 196 match the Generic model.
  const readRig = (path: string) => {
    const b = readFileSync(data(path))
    return rigFromGltf(JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')))
  }
  const manifestPath = 'anim-skins/r4biankamd019241/manifest.json'
  const manifest = JSON.parse(readFileSync(data(`stigmata/${manifestPath}`), 'utf8')) as { target: string; clips: { name: string; file: string }[] }
  const entry = manifest.clips.find((c) => c.name === 'BoardAct10021')!
  const clip = decodeClip(JSON.parse(readFileSync(data(`stigmata/${resolveClipPath(manifestPath, entry.file)}`), 'utf8')), entry.name)
  const source = readRig(`stigmata/models/${manifest.target}.glb`)
  const target = rigOf('crepuscule')
  const out = retargetClip(clip, source, target)
  for (const k of keysOf(clip)) {
    const sp = restPose(source)
    applyClipKey(sp, clip, k)
    const sw = worldPose(source, sp)
    const tp = restPose(target)
    applyClipKey(tp, out, k)
    const tw = worldPose(target, tp)
    for (const bone of MAIN_BONES) {
      const child = mainChild(bone)
      if (child === null) continue
      const s = source.byName.get(bone)!
      const t = target.byName.get(bone)!
      const error = vangle(sub(sw.translations[source.byName.get(child)!]!, sw.translations[s]!), sub(tw.translations[target.byName.get(child)!]!, tw.translations[t]!))
      assert.ok(error < 15, `key ${k}: ${bone} off by ${error.toFixed(1)}°`)
    }
  }
})

test('real data: Stigmata\'s BoardAct1002 on Crepuscule fills the dress panel and the repair/twist bones from Crepuscule\'s UiStand1', { skip }, () => {
  const target = rigOf('crepuscule')
  const manifestPath = 'anim-skins/r5biankamd010031/manifest.json'
  const manifest = JSON.parse(readFileSync(data(`crepuscule/${manifestPath}`), 'utf8')) as { clips: { name: string; file: string }[] }
  const idleEntry = manifest.clips.find((c) => c.name === 'UiStand1')!
  const idle = decodeClip(JSON.parse(readFileSync(data(`crepuscule/${resolveClipPath(manifestPath, idleEntry.file)}`), 'utf8')), 'UiStand1')
  const source = rigOf('stigmata')
  const clip = clipOf('stigmata', 'BoardAct1002')
  const plain = retargetClip(clip, source, target)
  const out = retargetClip(clip, source, target, { fill: idle })
  const driven = new Set(plain.tracks.map((t) => `${t.node}:${t.property}`))
  const filled = out.tracks.filter((t) => !driven.has(`${t.node}:${t.property}`))
  const names = new Set(filled.map((t) => target.nodes[t.node]!.name))
  for (const bone of ['SkirtBoneL00', 'SkirtBoneR00', 'SkirtBoneL03', 'PelvisrepairBoneL1', 'ThighrepairBoneR', 'ClaviclerepairBoneL']) {
    assert.ok([...names].some((n) => n.startsWith(bone.replace(/\d+$/, ''))), `${bone} family is filled`)
  }
  const skirt = [...names].filter((n) => /^SkirtBone[LR]0[0-3]$/.test(n))
  assert.equal(skirt.length, 8, 'the eight skirt-panel roots under the pelvis')
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

test('real data: Ink-lit Hermit\'s hand on the hip stays in the same place of the body on every frame (within 1 cm)', { skip }, () => {
  const readRig = (path: string) => {
    const b = readFileSync(data(path))
    return rigFromGltf(JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')))
  }
  const source = readRig('veritas/models/r3biankamd019141.glb')
  const manifestPath = 'anim-skins/r3biankamd019141/manifest.json'
  const manifest = JSON.parse(readFileSync(data(`veritas/${manifestPath}`), 'utf8')) as { clips: { name: string; file: string }[] }
  const entry = manifest.clips.find((c) => c.name === 'BoardAct1005')!
  const clip = decodeClip(JSON.parse(readFileSync(data(`veritas/${resolveClipPath(manifestPath, entry.file)}`), 'utf8')), entry.name)
  // Body-frame coordinates of the left hand: outward from the pelvis–spine axis, along it, forward.
  const coords = (r: Rig, c: Clip, key: number): number[] => {
    const p = restPose(r)
    applyClipKey(p, c, key)
    const w = worldPose(r, p)
    const at = (n: string) => w.translations[r.byName.get(n)!]!
    const rel = (a: number[], b: number[]) => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!]
    const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!
    const unit = (a: number[]) => a.map((x) => x / Math.hypot(a[0]!, a[1]!, a[2]!))
    const pelvis = at('Bip001Pelvis')
    const up = unit(rel(at('Bip001Spine'), pelvis))
    const across = rel(at('Bip001LThigh'), at('Bip001RThigh'))
    const lateral = unit(across.map((x, i) => x - dot(across, up) * up[i]!))
    const forward = [up[1]! * lateral[2]! - up[2]! * lateral[1]!, up[2]! * lateral[0]! - up[0]! * lateral[2]!, up[0]! * lateral[1]! - up[1]! * lateral[0]!]
    const v = rel(at('Bip001LHand'), pelvis)
    return [dot(v, lateral), dot(v, up), dot(v, forward)]
  }
  const key = 46 // the hand rests on the hip from 1.4 s to 2.4 s
  const wanted = coords(source, clip, key)
  for (const frame of ['crepuscule', 'stigmata', 'zero', 'veritas'] as const) {
    const target = rigOf(frame)
    const plain = coords(target, retargetClip(clip, source, target), key)
    const kept = coords(target, retargetClip(clip, source, target, { contact: true }), key)
    const off = (c: number[]) => Math.max(...c.map((x, i) => Math.abs(x - wanted[i]!)))
    assert.ok(off(kept) < 0.01, `${frame}: within 1 cm with contact (${(off(kept) * 100).toFixed(1)} cm, ${(off(plain) * 100).toFixed(1)} cm without)`)
  }
})
