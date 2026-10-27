import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as THREE from 'three'
import { decodeClip, type Clip } from '../lib/anim/clip.ts'
import { resolveClipPath } from '../lib/anim/paths.ts'
import { toAnimationClip } from '../lib/viewer/threeClip.ts'

const times = Float32Array.of(0, 0.5, 1)

/** Mesh with `targets` morph targets, set up the way GLTFLoader leaves a morphed mesh. */
function morphMesh(targets: number): THREE.Mesh {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3))
  geometry.morphAttributes.position = Array.from({ length: targets }, () => new THREE.Float32BufferAttribute(new Float32Array(9), 3))
  const mesh = new THREE.Mesh(geometry)
  mesh.updateMorphTargets()
  return mesh
}

/** Scene: root > [boneA, boneB (same name), face (4 morph targets)]. Node indices are 0, 1, 2, 3 (root last). */
function scene() {
  const root = new THREE.Group()
  const a = new THREE.Object3D()
  const b = new THREE.Object3D()
  a.name = b.name = 'hair'
  const face = morphMesh(4)
  face.name = 'Face'
  root.add(a, b, face)
  return { root, a, b, face, nodes: [a, b, face, root] as THREE.Object3D[] }
}

function clip(parts: Partial<Clip>): Clip {
  return { name: 'test', duration: 1, count: 3, times, tracks: [], morphs: [], ...parts }
}

/** Play `built` on `root` to `t` seconds and leave the mixer's result on the nodes. */
function sample(root: THREE.Object3D, built: THREE.AnimationClip, t: number): THREE.AnimationMixer {
  const mixer = new THREE.AnimationMixer(root)
  mixer.clipAction(built).play()
  mixer.update(t)
  return mixer
}

test('two nodes with the same name receive their own values', () => {
  const { root, a, b, nodes } = scene()
  const c = clip({
    tracks: [
      { node: 0, property: 'position', size: 3, constant: false, values: Float32Array.of(0, 0, 0, 0.5, 0, 0, 1, 0, 0) },
      { node: 1, property: 'position', size: 3, constant: false, values: Float32Array.of(0, 0, 0, 1, 0, 0, 2, 0, 0) },
    ],
  })
  const { clip: built, skipped } = toAnimationClip(c, nodes, { rootNode: 3, inPlace: false })
  assert.equal(skipped, 0)
  sample(root, built, 0.5)
  assert.ok(Math.abs(a.position.x - 0.5) < 1e-6, `a.x = ${a.position.x}`)
  assert.ok(Math.abs(b.position.x - 1) < 1e-6, `b.x = ${b.position.x}`)
})

test('a morph track drives morphTargetInfluences[3]', () => {
  const { root, face, nodes } = scene()
  const c = clip({ morphs: [{ node: 2, target: 3, constant: false, values: Float32Array.of(0, 0.4, 1) }] })
  const { clip: built } = toAnimationClip(c, nodes, { rootNode: 3, inPlace: false })
  sample(root, built, 0.5)
  assert.ok(Math.abs(face.morphTargetInfluences![3]! - 0.4) < 1e-6)
  assert.equal(face.morphTargetInfluences![0], 0) // other targets are untouched
})

test('a constant track holds its value for the whole clip', () => {
  const { root, a, b, face, nodes } = scene()
  const c = clip({
    tracks: [
      { node: 0, property: 'scale', size: 3, constant: true, values: Float32Array.of(2, 2, 2) },
      { node: 1, property: 'quaternion', size: 4, constant: true, values: Float32Array.of(0, 0, Math.SQRT1_2, Math.SQRT1_2) },
    ],
    morphs: [{ node: 2, target: 1, constant: true, values: Float32Array.of(0.7) }],
  })
  const { clip: built } = toAnimationClip(c, nodes, { rootNode: 3, inPlace: false })
  assert.deepEqual(built.tracks.map((t) => Array.from(t.times)), [[0, 1], [0, 1], [0, 1]])
  const mixer = sample(root, built, 0.25)
  for (const t of [0, 0.4, 0.3]) {
    assert.ok(Math.abs(a.scale.x - 2) < 1e-6 && Math.abs(a.scale.z - 2) < 1e-6)
    assert.ok(Math.abs(b.quaternion.z - Math.SQRT1_2) < 1e-6 && Math.abs(b.quaternion.w - Math.SQRT1_2) < 1e-6)
    assert.ok(Math.abs(face.morphTargetInfluences![1]! - 0.7) < 1e-6)
    mixer.update(t)
  }
})

test('properties a clip does not animate keep their original values', () => {
  const { root, a, b, nodes } = scene()
  b.position.set(5, 6, 7)
  const c = clip({ tracks: [{ node: 0, property: 'position', size: 3, constant: true, values: Float32Array.of(1, 1, 1) }] })
  const { clip: built } = toAnimationClip(c, nodes, { rootNode: 3, inPlace: false })
  sample(root, built, 0.5)
  assert.deepEqual(b.position.toArray(), [5, 6, 7])
  assert.deepEqual(a.position.toArray(), [1, 1, 1])
})

test('root position is dropped with inPlace and kept without; other root tracks stay', () => {
  const rootTracks: Clip['tracks'] = [
    { node: 3, property: 'position', size: 3, constant: false, values: Float32Array.of(0, 0, 0, 0, 0, 1, 0, 0, 2) },
    { node: 3, property: 'scale', size: 3, constant: true, values: Float32Array.of(1.5, 1.5, 1.5) },
  ]
  const names = (inPlace: boolean) => {
    const { nodes, root } = scene()
    const { clip: built } = toAnimationClip(clip({ tracks: rootTracks }), nodes, { rootNode: 3, inPlace })
    return { names: built.tracks.map((t) => t.name.slice(root.uuid.length + 1)), root, built }
  }
  assert.deepEqual(names(false).names, ['position', 'scale'])
  const inPlace = names(true)
  assert.deepEqual(inPlace.names, ['scale'])

  // And it really stays at its bind position when played.
  const { nodes, root } = scene()
  root.position.set(0, 0, 9)
  const { clip: built } = toAnimationClip(clip({ tracks: rootTracks }), nodes, { rootNode: 3, inPlace: true })
  sample(root, built, 1)
  assert.equal(root.position.z, 9)
  assert.ok(Math.abs(root.scale.x - 1.5) < 1e-6)
})

test('only the root node loses its position track', () => {
  const { nodes } = scene()
  const c = clip({ tracks: [{ node: 0, property: 'position', size: 3, constant: false, values: new Float32Array(9) }] })
  assert.equal(toAnimationClip(c, nodes, { rootNode: 3, inPlace: true }).clip.tracks.length, 1)
})

test('a root that is the pelvis bone (Bip001) keeps its position track even in place', () => {
  const { nodes, root } = scene()
  root.name = 'Bip001'
  const tracks: Clip['tracks'] = [{ node: 3, property: 'position', size: 3, constant: false, values: Float32Array.of(0, 1, 0, 0, 0.9, 0, 0, 1, 0) }]
  const { clip: built } = toAnimationClip(clip({ tracks }), nodes, { rootNode: 3, inPlace: true })
  assert.equal(built.tracks.length, 1)
  sample(root, built, 0.5)
  assert.ok(Math.abs(root.position.y - 0.9) < 1e-6)
})

test('animated arrays are not copied', () => {
  const { nodes } = scene()
  const values = Float32Array.of(0, 0, 0, 0.5, 0, 0, 1, 0, 0)
  const weights = Float32Array.of(0, 0.5, 1)
  const c = clip({
    tracks: [{ node: 0, property: 'position', size: 3, constant: false, values }],
    morphs: [{ node: 2, target: 0, constant: false, values: weights }],
  })
  const { clip: built, bytes } = toAnimationClip(c, nodes, { rootNode: 3, inPlace: false })
  assert.equal(built.tracks[0]!.values, values)
  assert.equal(built.tracks[0]!.times, times)
  assert.equal(built.tracks[1]!.values, weights)
  assert.equal(built.tracks[1]!.times, times)
  // shared times once, a constant-times array, and the two animated arrays
  assert.equal(bytes, times.byteLength + 8 + values.byteLength + weights.byteLength)
})

test('bytes include the expanded constant tracks', () => {
  const { nodes } = scene()
  const c = clip({ tracks: [{ node: 0, property: 'quaternion', size: 4, constant: true, values: Float32Array.of(0, 0, 0, 1) }] })
  const { bytes } = toAnimationClip(c, nodes, { rootNode: 3, inPlace: false })
  assert.equal(bytes, times.byteLength + 8 + 2 * 4 * 4)
})

test('missing nodes and morph targets are skipped and counted', () => {
  const { nodes, root, a } = scene()
  const c = clip({
    tracks: [
      { node: 0, property: 'position', size: 3, constant: true, values: Float32Array.of(1, 0, 0) },
      { node: 99, property: 'position', size: 3, constant: true, values: Float32Array.of(1, 0, 0) },
    ],
    morphs: [
      { node: 2, target: 3, constant: true, values: Float32Array.of(1) }, // exists (4 targets)
      { node: 2, target: 4, constant: true, values: Float32Array.of(1) }, // out of range
      { node: 0, target: 0, constant: true, values: Float32Array.of(1) }, // node without morph targets
      { node: 98, target: 0, constant: true, values: Float32Array.of(1) }, // no such node
    ],
  })
  const { clip: built, skipped } = toAnimationClip(c, nodes, { rootNode: 3, inPlace: false })
  assert.equal(skipped, 4)
  assert.equal(built.tracks.length, 2)
  sample(root, built, 0.5)
  assert.equal(a.position.x, 1)
})

test('clip name and duration carry over', () => {
  const { nodes } = scene()
  const { clip: built } = toAnimationClip(clip({ name: 'BoardAct0201', duration: 29.5 }), nodes, { rootNode: 3, inPlace: true })
  assert.equal(built.name, 'BoardAct0201')
  assert.equal(built.duration, 29.5)
})

// Real data: which root tracks survive for each frame. Skipped when data/ is absent.
const dataRoot = new URL('../data/', import.meta.url)
const haveData = existsSync(new URL('shukra/anim/manifest.json', dataRoot)) && existsSync(new URL('pavo/anim/manifest.json', dataRoot))

/** Object per glTF node with the node's own name, and the decoded clip `name` of the frame's default clip set. */
function realClip(frame: string, model: string, name: string) {
  const glbBytes = readFileSync(new URL(`${frame}/models/${model}.glb`, dataRoot))
  const json = JSON.parse(glbBytes.subarray(20, 20 + glbBytes.readUInt32LE(12)).toString('utf8')) as { nodes: { name: string }[] }
  const nodes = json.nodes.map((n) => Object.assign(new THREE.Object3D(), { name: n.name }))
  const manifest = JSON.parse(readFileSync(new URL(`${frame}/anim/manifest.json`, dataRoot), 'utf8')) as { clips: { name: string; file: string; rootNode: number }[] }
  const entry = manifest.clips.find((c) => c.name === name)!
  const decoded = decodeClip(JSON.parse(readFileSync(new URL(`${frame}/${resolveClipPath('anim/manifest.json', entry.file)}`, dataRoot), 'utf8')), name)
  return { nodes, decoded, rootNode: entry.rootNode }
}

test('real data: Qu\'s clips are built on Bip001, and in place keeps its position (the pelvis height, not travel)', { skip: !haveData && 'data/ is not present' }, () => {
  for (const [frame, model] of [['shukra', 'r3qumd010011'], ['pavo', 'r2qumd010011']] as const) {
    const run = realClip(frame, model, 'Run')
    assert.equal(run.nodes[run.rootNode]!.name, 'Bip001', frame)
    assert.ok(run.decoded.tracks.some((t) => t.node === run.rootNode && t.property === 'position'), `${frame}: the data animates the root position`)
    const built = toAnimationClip(run.decoded, run.nodes, { rootNode: run.rootNode, inPlace: true }).clip
    assert.ok(built.tracks.some((t) => t.name === `${run.nodes[run.rootNode]!.uuid}.position`), `${frame}: Bip001 position is kept`)
  }
})
