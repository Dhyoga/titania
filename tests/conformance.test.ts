// Every shipped clip of Bianca's four frames decodes and agrees with the GLB it was exported for. Skipped when data/ is absent.
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { decodeClip, type Clip } from '../lib/anim/clip.ts'
import { loadClip, loadManifest } from '../lib/anim/loader.ts'
import { parseManifest, type AnimManifest } from '../lib/anim/manifest.ts'
import { resolveClipPath } from '../lib/anim/paths.ts'

const FRAMES = ['crepuscule', 'stigmata', 'veritas', 'zero'] as const
/** Manifests of models that are not offered: Stigmata's battle chibi has clips but no Menu context. */
const NOT_OFFERED = new Set(['q4biankamd010011'])
const dataDir = new URL('../data/crepuscule/', import.meta.url)
const skip = !FRAMES.every((f) => existsSync(new URL(`../data/${f}/anim/manifest.json`, import.meta.url))) && 'data/ is not present'
const frameDir = (frame: string): URL => new URL(`../data/${frame}/`, import.meta.url)
const readIn = (frame: string, path: string): Buffer => readFileSync(new URL(path, frameDir(frame)))
const read = (path: string): Buffer => readFileSync(new URL(path, dataDir))

interface GlbJson {
  nodes: { name: string; mesh?: number; translation?: number[]; rotation?: number[]; scale?: number[] }[]
  meshes: { primitives: { targets?: unknown[] }[] }[]
}

/** JSON chunk of a GLB (the first chunk follows the 12 byte header and its own 8 byte chunk header). */
function glbJson(path: string, frame = 'crepuscule'): GlbJson {
  const b = readIn(frame, path)
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'))
}

/**
 * Share of animated tracks (root node excluded: it carries the motion; `include` narrows it to some nodes) whose last key is back at the first key.
 * A clip the manifest marks `loop` is meant to repeat seamlessly, so this is close to 1 for every one of them; a
 * decoder that gets deltas, planes or quantization wrong breaks it.
 */
function loopClosure(clip: Clip, rootNode: number, include: (node: number) => boolean = () => true): number {
  const last = clip.count - 1
  let animated = 0
  let closed = 0
  for (const t of clip.tracks) {
    if (t.constant || t.node === rootNode || !include(t.node)) continue
    animated++
    if (t.property === 'quaternion') {
      let d = 0
      for (let c = 0; c < 4; c++) d += t.values[c]! * t.values[last * 4 + c]!
      if (1 - Math.abs(d) < 2e-3) closed++
    } else {
      let worst = 0
      for (let c = 0; c < t.size; c++) worst = Math.max(worst, Math.abs(t.values[c]! - t.values[last * t.size + c]!))
      if (worst < 2e-2) closed++
    }
  }
  return animated === 0 ? 1 : closed / animated
}

const manifestFolders = skip
  ? []
  : FRAMES.flatMap((frame) =>
      ['anim', ...readdirSync(new URL('anim-skins/', frameDir(frame))).sort().filter((d) => !NOT_OFFERED.has(d)).map((d) => `anim-skins/${d}`)].map((folder) => [frame, folder] as const),
    )

for (const [frame, folder] of manifestFolders) {
  test(`${frame}/${folder}: every clip decodes and agrees with its model`, { skip }, () => {
    const manifestPath = `${folder}/manifest.json`
    const manifest = parseManifest(JSON.parse(readIn(frame, manifestPath).toString('utf8')))
    const glb = glbJson(`models/${manifest.target}.glb`, frame)
    const problems: string[] = []
    let quaternions = 0
    let looping = 0

    for (const entry of manifest.clips) {
      const where = `${frame}/${folder}/${entry.name}`
      let clip
      let packed = true
      try {
        const raw = JSON.parse(readIn(frame, resolveClipPath(manifestPath, entry.file)).toString('utf8')) as { packing?: unknown }
        packed = raw.packing !== undefined
        clip = decodeClip(raw as Parameters<typeof decodeClip>[0], entry.name)
      } catch (err) {
        problems.push(`${where}: ${(err as Error).message}`)
        continue
      }
      // A clip without `packing` is a single static pose: it has no key times, so the manifest's duration is not checkable
      // (Stigmata's `Lieonfloor` says 0.333 s and decodes to one frame).
      if (packed && Math.abs(clip.duration - entry.duration) > 0.02) problems.push(`${where}: duration ${clip.duration} vs manifest ${entry.duration}`)

      for (const t of clip.tracks) {
        if (t.node >= glb.nodes.length) problems.push(`${where}: node ${t.node} is not in ${manifest.target} (${glb.nodes.length} nodes)`)
        if (t.constant || t.property !== 'quaternion') continue
        quaternions++
        for (let k = 0; k < clip.count; k++) {
          const len = Math.hypot(t.values[k * 4]!, t.values[k * 4 + 1]!, t.values[k * 4 + 2]!, t.values[k * 4 + 3]!)
          if (Math.abs(len - 1) > 1e-3) {
            problems.push(`${where}: node ${t.node} key ${k} has quaternion length ${len}`)
            break
          }
        }
      }
      if (entry.loop && packed) {
        // Crepuscule's clips close on every bone. The other frames' hair, cloth and shirt bones are recorded physics and end a
        // few degrees off the start, so there the check covers the body (`Bip001…`) bones only.
        const body = frame === 'crepuscule' ? undefined : (node: number) => (glb.nodes[node]?.name ?? '').startsWith('Bip001')
        const closure = loopClosure(clip, entry.rootNode, body)
        looping++
        if (closure < 0.9) problems.push(`${where}: loops, but only ${(closure * 100).toFixed(0)}% of its ${body ? 'body ' : ''}tracks end where they start`)
      }
      for (const m of clip.morphs) {
        const mesh = glb.nodes[m.node]?.mesh
        const targets = mesh === undefined ? 0 : (glb.meshes[mesh]!.primitives[0]!.targets?.length ?? 0)
        if (m.target >= targets) problems.push(`${where}: morph target ${m.target} of node ${m.node} (mesh has ${targets})`)
      }
    }
    assert.ok(quaternions > 0, 'the sweep checked no animated quaternions')
    assert.ok(looping > 0, 'the sweep checked no looping clips')
    assert.deepEqual(problems.slice(0, 10), [], `${problems.length} problems in ${folder}`)
  })
}

test('clips start from the model: key 0 matches the bind pose where the clip does not move a bone', { skip }, () => {
  const manifest = parseManifest(JSON.parse(read('anim/manifest.json').toString('utf8')))
  const glb = glbJson(`models/${manifest.target}.glb`)
  const byName = (name: string) => glb.nodes.findIndex((n) => n.name === name)
  for (const clipName of ['UiStand1', 'StandAct0101', 'BoardAct0201', 'BoardAct1007']) {
    const entry = manifest.clips.find((c) => c.name === clipName)!
    const clip = decodeClip(JSON.parse(read(resolveClipPath('anim/manifest.json', entry.file)).toString('utf8')), clipName)

    // Bones keep their bind offsets in these clips: almost every position track starts at the node's own translation.
    const positions = clip.tracks.filter((t) => t.property === 'position')
    const same = positions.filter((t) => (glb.nodes[t.node]!.translation ?? [0, 0, 0]).every((v, c) => Math.abs(v - t.values[c]!) < 2e-3))
    assert.ok(same.length / positions.length > 0.9, `${clipName}: only ${same.length} of ${positions.length} position tracks start at the bind position`)

    // The pelvis stands in its bind rotation at key 0 (rotation tracks are compared up to sign).
    const pelvis = clip.tracks.find((t) => t.property === 'quaternion' && t.node === byName('Bip001Pelvis'))
    assert.ok(pelvis, `${clipName}: no pelvis rotation track`)
    const rest = glb.nodes[pelvis.node]!.rotation!
    const d = rest.reduce((sum, v, c) => sum + v * pelvis.values[c]!, 0)
    assert.ok(Math.abs(Math.abs(d) - 1) < 1e-3, `${clipName}: pelvis key 0 is not the bind rotation (dot ${d})`)
  }
})

test('manifests and clips load through the loader with a fetch that serves files from disk', { skip }, async () => {
  const files = (async (input: unknown) => {
    const path = String(input).replace('mem://', '')
    return existsSync(new URL(path, dataDir)) ? { ok: true, status: 200, json: async () => JSON.parse(read(path).toString('utf8')) } : { ok: false, status: 404, json: async () => ({}) }
  }) as unknown as typeof fetch

  const manifest: AnimManifest = await loadManifest('mem://anim/manifest.json', { fetch: files })
  assert.equal(manifest.clips.length, 139)
  const entry = manifest.clips.find((c) => c.name === 'BoardAct0201')!
  const clip = await loadClip(`mem://${resolveClipPath('anim/manifest.json', entry.file)}`, entry.name, { fetch: files })
  assert.equal(clip.count, 886)
  assert.ok(Math.abs(clip.duration - 29.5) < 0.01)
  await assert.rejects(loadClip('mem://anim/BaseLayer/Nope.json', 'Nope', { fetch: files }), /Nope\.json.*404/)
})
