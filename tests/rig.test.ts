import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { restPose, worldPose } from '../lib/anim/fk.ts'
import { qangle, qfromUnitVectors, qinv, qmul, qrotate, vangle, type Quat, type Vec3 } from '../lib/anim/quat.ts'
import { meshRole, rigFromGltf } from '../lib/anim/rig.ts'

const close = (a: number[], b: number[], eps = 1e-9) => a.every((v, i) => Math.abs(v - b[i]!) < eps)

test('quaternions: product, inverse, rotation, shortest arc', () => {
  const z90: Quat = [0, 0, Math.SQRT1_2, Math.SQRT1_2]
  assert.ok(close(qrotate(z90, [1, 0, 0]), [0, 1, 0]))
  assert.ok(close(qmul(z90, qinv(z90)), [0, 0, 0, 1]))
  assert.ok(Math.abs(qangle(qmul(z90, z90), [0, 0, 1, 0]) - 0) < 1e-6, 'two quarter turns are a half turn')
  const from: Vec3 = [1, 0, 0]
  const to: Vec3 = [0, 0, 1]
  assert.ok(close(qrotate(qfromUnitVectors(from, to), from), to))
  assert.ok(close(qrotate(qfromUnitVectors(from, [-1, 0, 0]), from), [-1, 0, 0]), 'opposite directions')
  assert.ok(Math.abs(vangle([1, 0, 0], [0, 2, 0]) - 90) < 1e-9)
})

test('rig: parents, order and morph targets from glTF JSON; errors on matrices and loops', () => {
  const rig = rigFromGltf({
    nodes: [
      { name: 'Root', children: [1] },
      { name: 'Bip001', children: [2, 3], translation: [0, 1, 0] },
      { name: 'hair', mesh: 0 },
      { name: 'hair' },
    ],
    meshes: [{ extras: { targetNames: ['a', 'b'] } }],
  })
  assert.deepEqual(rig.nodes.map((n) => n.parent), [-1, 0, 1, 1])
  assert.equal(rig.byName.get('hair'), 2, 'the first of a repeated name')
  assert.deepEqual(rig.nodes[2]!.morphTargets, ['a', 'b'])
  assert.equal(rig.nodes[3]!.morphTargets, null)
  assert.ok(rig.order.indexOf(0) < rig.order.indexOf(1) && rig.order.indexOf(1) < rig.order.indexOf(3))
  assert.throws(() => rigFromGltf({ nodes: [{ matrix: new Array(16).fill(0) }] }), /matrix/)
  assert.throws(() => rigFromGltf({ nodes: [{ children: [1] }, { children: [0] }] }), /cycle|two parents/)
  assert.throws(() => rigFromGltf({ nodes: [{ children: [5] }] }), /outside/)
})

test('mesh roles pair face meshes across models', () => {
  assert.equal(meshRole('R3QuMd010011Face'), 'Face')
  assert.equal(meshRole('R2QuMd010011FaceEX'), 'Face')
  assert.equal(meshRole('R3QuMd010011Eye'), 'Eye')
  assert.equal(meshRole('R3Bianka01001Eye'), 'Eye', 'a five-digit model id')
  assert.equal(meshRole('Cheek'), 'Cheek')
})

// Real models: Shukra's and Pavo's Generic rigs. Skipped without data/.
const MODELS = { shukra: 'r3qumd010011', pavo: 'r2qumd010011' } as const
const skip = !Object.keys(MODELS).every((f) => existsSync(new URL(`../data/${f}/models/`, import.meta.url))) && 'data/ is not present'

function rigOf(frame: keyof typeof MODELS) {
  const b = readFileSync(new URL(`../data/${frame}/models/${MODELS[frame]}.glb`, import.meta.url))
  return rigFromGltf(JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')))
}

test('real rigs: Bip001 bones are unique, the pelvis and head stand at their measured heights, Bip001 faces the same way in both', { skip }, () => {
  const heights: Record<string, number> = {}
  const heads: Record<string, number> = {}
  const counts: Record<string, [number, number]> = {}
  const bip: Quat[] = []
  for (const frame of Object.keys(MODELS) as (keyof typeof MODELS)[]) {
    const rig = rigOf(frame)
    const bones = rig.nodes.filter((n) => n.name.startsWith('Bip001')).map((n) => n.name)
    assert.equal(new Set(bones).size, bones.length, `${frame}: a Bip001 name repeats`)
    const world = worldPose(rig, restPose(rig))
    heights[frame] = world.translations[rig.byName.get('Bip001Pelvis')!]![1]
    heads[frame] = world.translations[rig.byName.get('Bip001Head')!]![1]
    counts[frame] = [rig.nodes.length, bones.length]
    bip.push(world.rotations[rig.byName.get('Bip001')!]!)
    const foot = world.translations[rig.byName.get('Bip001LToe0')!]![1]
    assert.ok(foot > -0.02 && foot < 0.12, `${frame}: toe at ${foot.toFixed(3)} m, not on the floor`)
    const face = rig.nodes.find((n) => n.morphTargets && meshRole(n.name) === 'Face')
    assert.ok(face && face.morphTargets!.includes('eyebrow01'), `${frame}: a Face mesh with named morph targets`)
  }
  assert.deepEqual(counts, { shukra: [326, 55], pavo: [203, 64] }, 'nodes and Bip001 bones')
  assert.ok(Math.abs(heights.shukra! - 0.959) < 0.005 && Math.abs(heights.pavo! - 0.968) < 0.005, 'pelvis height')
  assert.ok(Math.abs(heads.shukra! - 1.462) < 0.005 && Math.abs(heads.pavo! - 1.449) < 0.005, 'head height')
  for (const q of bip.slice(1)) assert.ok(qangle(q, bip[0]!) < 0.5, 'Bip001 world rest orientation differs')
})
