import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { restPose, worldPose } from '../lib/anim/fk.ts'
import { rigFromGltf } from '../lib/anim/rig.ts'
import { normaliseName, slugOf } from '../scripts/convert-fbx.ts'

const data = (path: string) => new URL(`../data/${path}`, import.meta.url)
const erzaFile = data('erza/models/erza-scarlet.glb')
const skip = !existsSync(erzaFile) && 'data/erza/ has no converted model'

interface Json {
  nodes: { name: string; mesh?: number; skin?: number }[]
  meshes: { name: string; primitives: { attributes: { POSITION: number } }[] }[]
  skins: unknown[]
  accessors: { min?: number[]; max?: number[] }[]
  materials: { extras?: { family?: string; shadowTexture?: number } }[]
  textures: unknown[]
}

function jsonOf(file: URL): Json {
  const b = readFileSync(file)
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) as Json
}

test('names: Bip001 names lose spaces and underscores, others are kept; a folder name becomes a slug', () => {
  assert.equal(normaliseName('Bip001 L Thigh'), 'Bip001LThigh')
  assert.equal(normaliseName('Bip001_L_Thigh_C1'), 'Bip001LThighC1')
  assert.equal(normaliseName('Bip001'), 'Bip001')
  assert.equal(normaliseName('Bone_tf_pjL01'), 'Bone_tf_pjL01')
  assert.equal(slugOf('data/erza/source/Erza Scarlet'), 'erza-scarlet')
  assert.equal(slugOf("Erza Scarlet (Heaven's Wheel Armor)"), 'erza-scarlet-heaven-s-wheel-armor')
})

test('real data: one skin, one mesh node Erza_Body, unique separator-free Bip001 names, her materials name the shadow texture', { skip }, () => {
  const json = jsonOf(erzaFile)
  assert.equal(json.skins.length, 1)
  const meshNodes = json.nodes.filter((n) => n.mesh !== undefined)
  assert.deepEqual(meshNodes.map((n) => n.name), ['Erza_Body'])
  assert.equal(meshNodes[0]!.skin, 0)
  assert.equal(json.nodes.filter((n) => /^Bone_wq_/.test(n.name)).length, 4, 'the sword bones stay in the rig, with no triangles')

  const bip = json.nodes.map((n) => n.name).filter((n) => n.startsWith('Bip001'))
  assert.equal(new Set(bip).size, bip.length, 'Bip001 names are unique')
  for (const name of bip) assert.match(name, /^Bip001[A-Za-z0-9]*$/, `${name} has a separator`)
  assert.ok(bip.includes('Bip001LThigh'))
  assert.ok(json.nodes.some((n) => n.name === 'Bone_tf_pjL01'), 'other names are kept')

  assert.ok(json.materials.length >= 1)
  for (const m of json.materials) {
    assert.equal(m.extras?.family, 'diffuseShadow')
    assert.ok(Number.isInteger(m.extras?.shadowTexture) && m.extras!.shadowTexture! < json.textures.length)
  }
})

test('real data: she stands on the floor, about 2 m tall with her hair, facing -Z with her left on -X, undeformed and symmetric', { skip }, () => {
  const json = jsonOf(erzaFile)
  const rig = rigFromGltf(json)
  assert.equal(rig.nodes[0]!.name, 'Root')
  const world = worldPose(rig, restPose(rig))
  const at = (name: string) => world.translations[rig.byName.get(name)!]!

  assert.ok(Math.abs(at('Bip001Pelvis')[1] - 1.11) < 0.02, `pelvis at ${at('Bip001Pelvis')[1]}`)
  const toes = Math.min(at('Bip001LToe0')[1], at('Bip001RToe0')[1])
  assert.ok(Math.abs(toes) < 0.05, `lowest toe at ${toes}`)
  for (const side of ['L', 'R']) assert.ok(at(`Bip001${side}Toe0`)[2] < at(`Bip001${side}Foot`)[2], `${side} toe is not in front of the ankle (-Z)`)
  assert.ok(at('Bip001LHand')[0] < at('Bip001RHand')[0], 'her left hand is at -X')
  assert.ok(Math.abs(at('Bip001LHand')[0] + at('Bip001RHand')[0]) < 0.02, 'hands mirror about x = 0')
  assert.ok(Math.abs(at('Bip001LHand')[1] - at('Bip001RHand')[1]) < 0.02)
  assert.ok(Math.abs(at('Bip001LHand')[2] - at('Bip001RHand')[2]) < 0.02)

  // The skinned mesh at rest is its baked vertices under Root (a turn of 180° about Y): the bounds of the body.
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const mesh of json.meshes) {
    for (const p of mesh.primitives) {
      const a = json.accessors[p.attributes.POSITION]!
      for (let k = 0; k < 3; k++) {
        const lo = k === 1 ? a.min![k]! : -a.max![k]!
        const hi = k === 1 ? a.max![k]! : -a.min![k]!
        min[k] = Math.min(min[k]!, lo)
        max[k] = Math.max(max[k]!, hi)
      }
    }
  }
  assert.ok(Math.abs(min[0]! + max[0]!) < 0.02, `bounds are not symmetric about her: x ${min[0]} to ${max[0]}`)
  assert.ok(max[0]! < 1 && min[0]! > -1, 'no sword to her side')
  assert.ok(min[1]! > -0.05 && max[1]! > 1.8 && max[1]! < 2.05, `height ${min[1]} to ${max[1]}`)
})

test('real data: every Bip001 bone of Shukra (55) and Pavo (64, minus eight twist bones) exists on her', { skip: skip || (!existsSync(data('shukra/models/r3qumd010011.glb')) || !existsSync(data('pavo/models/r2qumd010011.glb'))) && 'Qu models are not present' }, () => {
  const erza = new Set(jsonOf(erzaFile).nodes.map((n) => n.name))
  const bip = (file: string) => [...new Set(jsonOf(data(file)).nodes.map((n) => n.name).filter((n) => n.startsWith('Bip001')))]
  const shukra = bip('shukra/models/r3qumd010011.glb')
  const pavo = bip('pavo/models/r2qumd010011.glb')
  assert.equal(shukra.length, 55)
  assert.deepEqual(shukra.filter((n) => !erza.has(n)), [])
  assert.equal(pavo.length, 64)
  const missing = pavo.filter((n) => !erza.has(n))
  assert.deepEqual(missing.sort(), ['Bip001LForeTwist', 'Bip001LForeTwist1', 'Bip001LUpArmTwist', 'Bip001LUpArmTwist1', 'Bip001RForeTwist', 'Bip001RForeTwist1', 'Bip001RUpArmTwist', 'Bip001RUpArmTwist1'])
})

// Converting is deterministic: two runs give the same bytes, and the same bytes as the file in data/erza/models/.
const sourceFolder = data('erza/source/Erza Scarlet/')
test('real data: converting the source twice gives the same bytes', { skip: skip || (!existsSync(new URL('Model.fbx', sourceFolder)) && 'the source folder is not in data/erza/source/') }, () => {
  const out = (n: string) => new URL(`../data/erza/.test-convert-${n}.glb`, import.meta.url)
  const script = new URL('../scripts/convert-fbx.ts', import.meta.url)
  try {
    for (const n of ['a', 'b']) {
      const run = spawnSync(process.execPath, [fileURLToPath(script), fileURLToPath(sourceFolder), '--out', fileURLToPath(out(n))], { encoding: 'utf8' })
      assert.equal(run.status, 0, run.stderr)
    }
    const a = readFileSync(out('a'))
    assert.ok(a.equals(readFileSync(out('b'))), 'two conversions differ')
    assert.ok(a.equals(readFileSync(erzaFile)), 'a conversion differs from data/erza/models/erza-scarlet.glb (convert again)')
  } finally {
    for (const n of ['a', 'b']) rmSync(out(n), { force: true })
  }
})

test('the script refuses an output outside data/erza/', { skip: !existsSync(new URL('../scripts/convert-fbx.ts', import.meta.url)) && 'no script' }, () => {
  const script = new URL('../scripts/convert-fbx.ts', import.meta.url)
  const run = spawnSync(process.execPath, [fileURLToPath(script), fileURLToPath(sourceFolder), '--out', '/tmp/should-not-exist.glb'], { encoding: 'utf8' })
  assert.notEqual(run.status, 0)
  assert.match(run.stderr, /must be under/)
  assert.equal(existsSync('/tmp/should-not-exist.glb'), false)
})
