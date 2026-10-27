import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { materialRefs, pairOutlines, parseToonMaterial, type MaterialRef } from '../lib/viewer/toon/params.ts'

test('defaults: a character material with no parameters', () => {
  const p = parseToonMaterial({ name: 'X', extras: { family: 'character' } })
  assert.ok(p)
  assert.equal(p.family, 'character')
  assert.equal(p.shadow.first, 0.5)
  assert.equal(p.shadow.second, 0.5, 'second band follows the first')
  assert.equal(p.shadow.soft, false)
  assert.deepEqual(p.shadow.firstColor, [1, 1, 1, 1])
  assert.deepEqual(p.shadow.secondColor, [1, 1, 1, 1])
  assert.equal(p.specular.intensity, 0)
  assert.equal(p.rim.enabled, false)
  assert.deepEqual(p.render, { blend: 'none', depthWrite: true, cull: 'back', alphaTest: 0, renderOrder: 2000 })
  assert.equal(p.outline, null)
  assert.deepEqual(p.textures, {})
  assert.equal(p.pbr, null)
  assert.equal(p.matcap, null)
})

test('PBR and matcap parameters', () => {
  const full = parseToonMaterial({
    name: 'M',
    extras: {
      family: 'character',
      shader: {
        keywords: ['_PBR', '_USE_MATCAP'],
        floats: { _Metallic: 1.5, _Roughness: 0.2, _MetallicMapScale: 1.1, _PBRRate: 'x', _PBRSpecularIntensity: 0.3, _MatCapYScale: 0.2, _MatcapMask: 2 },
        colors: { _CubemapColor: [0.5, 0.5, 0.5, 1] },
      },
    },
  })
  assert.deepEqual(full?.pbr, {
    mode: 'full',
    metallic: 1,
    roughness: 0.2,
    metallicMapScale: 1.1,
    roughnessMapScale: 1,
    rate: 1,
    specularIntensity: 0.3,
    specularColor: [1, 1, 1, 1],
    cubemapIntensity: 1,
    cubemapColor: [0.5, 0.5, 0.5, 1],
  })
  assert.deepEqual(full?.matcap, { yScale: 0.2, mask: 1, metallic: 1 })
  const simple = parseToonMaterial({ name: 'S', extras: { family: 'character', shader: { keywords: ['_SIMPLE_PBR'], floats: { _Metallic: 0.38, _PBRRate: 0.7 } } } })
  assert.equal(simple?.pbr?.mode, 'simple')
  assert.equal(simple?.pbr?.rate, 0.7)
})

test('emission, colour ramp and shadow colour sets', () => {
  const p = parseToonMaterial(
    {
      name: 'Cloth',
      extras: {
        family: 'character',
        shader: {
          keywords: ['_MUTLI_CHANEL_SKIN', '_MUTLI_CHANEL_SHADOW_COLOR', '_USE_EMISSION_FLOWING'],
          textures: { _SkinRamp: { index: 0 } },
          floats: { _EmissionIntensity: 5, IF_SKIN: 1, _SkinRate: 0.25, _SkinIntensity: 'x' },
          colors: { _EmissionColor: [0.5, 0.4, 0.9, 1], _FirstShadowColor: [0.8, 0.8, 0.8, 0], _FirstShadowColor1: [0.7, 0.6, 0.5, 0] },
          vectors: { _MutliSkinRate: [0.45, 0, 2, 'x'], _MutliSkinIntensity: [1, 1, 1, 1.2] },
        },
      },
    },
    [{ extras: { colorSpace: 'sRGB' } }],
  )
  assert.deepEqual(p?.emission, { intensity: 5, color: [0.5, 0.4, 0.9, 1], flowing: true })
  assert.deepEqual(p?.skinRamp, { rate: 0.25, intensity: 1, multi: true, zoneRates: [0.45, 0, 1, 1], zoneIntensities: [1, 1, 1, 1.2] })
  assert.equal(p?.shadowSets?.length, 4)
  assert.deepEqual(p?.shadowSets?.[0]?.firstColor, [0.8, 0.8, 0.8, 0])
  assert.deepEqual(p?.shadowSets?.[1], { noColor: [1, 1, 1, 1], firstColor: [0.7, 0.6, 0.5, 0], secondColor: [0.7, 0.6, 0.5, 0] }, 'second follows first')

  const plain = parseToonMaterial({ name: 'Body', extras: { family: 'character', shader: { floats: { _EmissionIntensity: 0, IF_SKIN: 1 } } } })
  assert.equal(plain?.emission, null)
  assert.equal(plain?.skinRamp, null, 'IF_SKIN without a ramp texture')
  assert.equal(plain?.shadowSets, null)
})

test('effect characters parse as their character layer', () => {
  const p = parseToonMaterial({ name: 'Alpha01', extras: { family: 'effectCharacter', shader: { keywords: ['CHARACTER_MATERIAL_ENABLE'] }, render: { blend: { src: 'srcAlpha', dst: 'oneMinusSrcAlpha' }, renderOrder: 3000 } } })
  assert.equal(p?.family, 'effectCharacter')
  assert.equal(p?.render.blend, 'alpha')
  assert.equal(p?.render.renderOrder, 3000)
  assert.equal(pairOutlines([{ name: 'Alpha01OL', family: 'outline' }, { name: 'Alpha01', family: 'effectCharacter' }]).size, 0, 'no outline')
})

test('not drawn: no extras, unknown or pass-only families', () => {
  assert.equal(parseToonMaterial(null), null)
  assert.equal(parseToonMaterial({ name: 'A' }), null)
  assert.equal(parseToonMaterial({ name: 'A', extras: { family: 'sparkle' } }), null)
  assert.equal(parseToonMaterial({ name: 'A', extras: { family: 'bloom' } }), null)
  assert.equal(parseToonMaterial({ name: 'A', extras: 'character' }), null)
})

test('bad values fall back instead of throwing', () => {
  const p = parseToonMaterial(
    {
      name: 'X',
      extras: {
        family: 'character',
        render: { blend: 'weird', cull: 7, renderOrder: 'x', depthWrite: false },
        shader: {
          keywords: ['_PBR', 3, null],
          floats: { _FirstShadow: 'a', _SmoothFactor: -1, _SpecularIntensity: Number.NaN, IF_RIM: 1, _RimIntensity: 0.5, IF_SMOOTH_SHADOW: 1 },
          colors: { _FirstShadowColor: [0.5, 'x', 0.5], _NoShadowColor: 'red' },
          textures: { _MainTex: { index: 0 }, _MaskTex: { index: -1 }, _PBRMask: { index: 9 }, _BumpMap: 'x' },
        },
      },
    },
    [{ extras: { colorSpace: 'sRGB' } }],
  )
  assert.ok(p)
  assert.deepEqual([...p.keywords], ['_PBR'])
  assert.equal(p.shadow.first, 0.5)
  assert.equal(p.shadow.smooth, 0)
  assert.equal(p.specular.intensity, 0)
  assert.equal(p.rim.enabled, true)
  assert.equal(p.shadow.soft, true)
  assert.deepEqual(p.shadow.firstColor, [0.5, 1, 0.5, 1])
  assert.deepEqual(p.shadow.noColor, [1, 1, 1, 1])
  assert.deepEqual(Object.keys(p.textures), ['_MainTex'], 'negative and out-of-range indices are dropped')
  assert.deepEqual(p.textures._MainTex, { index: 0, texCoord: 0, scale: [1, 1], offset: [0, 0], srgb: true })
  assert.deepEqual(p.render, { blend: 'none', depthWrite: false, cull: 'back', alphaTest: 0, renderOrder: 2000 })
})

test('render state and outline parameters', () => {
  const veil = parseToonMaterial({
    name: 'Alpha',
    extras: { family: 'character', render: { blend: { src: 'srcAlpha', dst: 'oneMinusSrcAlpha' }, cull: 'none', alphaTest: 0.1, renderOrder: 3000 } },
  })
  assert.deepEqual(veil?.render, { blend: 'alpha', depthWrite: true, cull: 'none', alphaTest: 0.1, renderOrder: 3000 })
  const premultiplied = parseToonMaterial({ name: 'P', extras: { family: 'character', render: { blend: { src: 'one', dst: 'oneMinusSrcAlpha' } } } })
  assert.equal(premultiplied?.render.blend, 'premultiplied')
  const outline = parseToonMaterial({
    name: 'BodyOL',
    extras: { family: 'outline', render: { cull: 'front' }, shader: { floats: { _XCharOutlineWidth: 1.2 }, colors: { _OutlineColor: [0.32, 0.27, 0.27, 0.3] } } },
  })
  assert.deepEqual(outline?.outline, { width: 1.2, color: [0.32, 0.27, 0.27, 0.3] })
  assert.equal(outline?.render.cull, 'front')
  assert.equal(outline?.render.renderOrder, 2001)
})

test('albedo intensity scales the colour, not the alpha', () => {
  const p = parseToonMaterial({
    name: 'X',
    extras: { family: 'character', shader: { floats: { _AlbedoColorIntensity: 2 }, colors: { _AlbedoColor: [0.5, 0.25, 1, 0.8] } } },
  })
  assert.deepEqual(p?.albedo, [1, 0.5, 2, 0.8])
})

const ref = (name: string, family: string | null): MaterialRef => ({ name, family })

test('pairing: exact name, the pass run before, then looser names; never an outline that comes later', () => {
  const list = [
    ref('M000001AlphaXT', 'bloom'), // 0
    ref('M000001Alpha', 'character'), // 1: no outline
    ref('M000001BodyOL', 'outline'), // 2
    ref('M000001Body', 'character'), // 3: exact
    ref('M000001HairOL', 'outline'), // 4
    ref('M000001Hair02', 'character'), // 5: pass run before
    ref('M000002BodyEX01', 'character'), // 6: looser name (another prefix)
    ref('M000001Cloth02OL', 'outline'), // 7
    ref('M000001Cloth02', 'character'), // 8
    ref('M000001Cloth02_3', 'character'), // 9: `_3` dropped
    ref('M000001Skirt', 'character'), // 10: SkirtOL only comes later
    ref('M000001SkirtOL', 'outline'), // 11
    ref('M000001Skirt02', 'character'), // 12
  ]
  assert.deepEqual(
    [...pairOutlines(list).entries()],
    [
      [3, 2],
      [5, 4],
      [6, 2],
      [8, 7],
      [9, 7],
      [12, 11],
    ],
  )
})

// Real data: every material of Shukra's and Pavo's Generic models. Skipped without data/.
const MODELS = { shukra: 'r3qumd010011', pavo: 'r2qumd010011' } as const
const frames = Object.keys(MODELS) as (keyof typeof MODELS)[]
const skip = !frames.every((f) => existsSync(new URL(`../data/${f}/models/${MODELS[f]}.glb`, import.meta.url))) && 'data/ is not present'

interface Gltf {
  materials: { name: string; extras?: { family?: string } }[]
  textures: unknown[]
  meshes: { primitives: { material?: number; attributes: Record<string, number> }[] }[]
  nodes: { name: string; mesh?: number }[]
}

function gltf(frame: keyof typeof MODELS): Gltf {
  const b = readFileSync(new URL(`../data/${frame}/models/${MODELS[frame]}.glb`, import.meta.url))
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) as Gltf
}

/** Main material name → outline material name, for the materials on meshes. */
function pairsByName(json: Gltf): Map<string, string | null> {
  const pairs = pairOutlines(materialRefs(json.materials))
  const used = new Set(json.meshes.flatMap((m) => m.primitives.map((p) => p.material ?? -1)))
  const out = new Map<string, string | null>()
  for (const index of used) {
    const outline = pairs.get(index)
    out.set(json.materials[index]!.name, outline === undefined ? null : json.materials[outline]!.name)
  }
  return out
}

test('real models: every material parses; character and outline materials are drawn, passes (Shukra\'s `bloom`) are not', { skip }, () => {
  for (const frame of frames) {
    const json = gltf(frame)
    for (const material of json.materials) {
      const p = parseToonMaterial(material, json.textures)
      const family = material.extras?.family
      if (family === 'character' || family === 'outline') {
        assert.ok(p, `${frame} ${material.name}`)
        for (const slot of Object.values(p.textures)) assert.ok(slot.index < json.textures.length)
      } else {
        assert.equal(p, null, `${frame} ${material.name} (${family})`)
      }
    }
    // Every material on a mesh is a character material.
    for (const mesh of json.meshes) for (const prim of mesh.primitives) assert.equal(json.materials[prim.material ?? -1]?.extras?.family, 'character', frame)
  }
})

test('real models: PBR and matcap materials on meshes', { skip }, () => {
  const counts = { full: 0, simple: 0, matcap: 0 }
  for (const frame of frames) {
    const json = gltf(frame)
    const used = new Set(json.meshes.flatMap((m) => m.primitives.map((p) => p.material ?? -1)))
    for (const index of used) {
      const p = parseToonMaterial(json.materials[index], json.textures)
      if (p?.pbr) counts[p.pbr.mode]++
      if (p?.matcap) counts.matcap++
      if (p?.pbr?.mode === 'full') assert.ok(p.textures._PBRMask, `${frame} ${p.name} has a PBR mask`)
    }
  }
  assert.deepEqual(counts, { full: 4, simple: 2, matcap: 3 })
  const near = (a: number | undefined, b: number) => assert.ok(a !== undefined && Math.abs(a - b) < 1e-3, `${a} is not ${b}`)
  const shukra = gltf('shukra')
  const weapon = parseToonMaterial(shukra.materials.find((m) => m.name === 'R3QuMd010011Weapon'), shukra.textures)
  assert.equal(weapon?.pbr?.mode, 'full')
  near(weapon?.pbr?.metallic, 0.965)
  near(weapon?.pbr?.roughness, 0.213)
  const huangyu = parseToonMaterial(shukra.materials.find((m) => m.name === 'R3QuMd010011Huangyu'), shukra.textures)
  assert.equal(huangyu?.pbr?.mode, 'simple')
  near(huangyu?.pbr?.metallic, 1)
})

test('real models: outline pairs', { skip }, () => {
  const shukra = pairsByName(gltf('shukra'))
  for (const part of ['Body', 'Down', 'Face', 'Hair01', 'Hair02', 'Huangyu', 'Upper', 'Weapon']) {
    assert.equal(shukra.get(`R3QuMd010011${part}`), `R3QuMd010011${part}OL`, part)
  }
  assert.equal(shukra.get('R3QuMd010011Alpha'), null)
  assert.equal(shukra.get('R3QuMd010011Eye'), null)

  const pavo = pairsByName(gltf('pavo'))
  for (const part of ['Bead', 'Body', 'Cloth', 'Face', 'Head']) assert.equal(pavo.get(`R2QuMd010011${part}`), `R2QuMd010011${part}OL`, part)
  assert.equal(pavo.get('R2QuMd010011Hair01'), 'R2QuMd010011HairOL', 'both hair meshes share one outline')
  assert.equal(pavo.get('R2QuMd010011Hair02'), 'R2QuMd010011HairOL')
  assert.equal(pavo.get('R2QuMd010011Eye'), null)
})

test('real models: meshes with an outline, per model', { skip }, () => {
  const counts: Record<string, string> = {}
  for (const frame of frames) {
    const json = gltf(frame)
    const pairs = pairOutlines(materialRefs(json.materials))
    const meshes = json.nodes.filter((n) => n.mesh !== undefined)
    const outlined = meshes.filter((n) => json.meshes[n.mesh!]!.primitives.some((p) => pairs.has(p.material ?? -1)))
    counts[frame] = `${outlined.length}/${meshes.length}`
  }
  assert.deepEqual(counts, { shukra: '8/10', pavo: '7/8' })
})

test('real models: emission, colour ramps, zones and matcap on meshes', { skip }, () => {
  const counts: Record<string, Record<string, number>> = {}
  for (const frame of frames) {
    const json = gltf(frame)
    const c = { emission: 0, flowing: 0, matcap: 0, skinRamp: 0, multiSkin: 0, shadowSets: 0, effect: 0 }
    const used = new Set(json.meshes.flatMap((m) => m.primitives.map((p) => p.material ?? -1)))
    for (const index of used) {
      const p = parseToonMaterial(json.materials[index], json.textures)
      if (!p) continue
      if (p.family === 'effectCharacter') c.effect++
      if (p.emission) c.emission++
      if (p.emission?.flowing) c.flowing++
      if (p.matcap) c.matcap++
      if (p.skinRamp) c.skinRamp++
      if (p.skinRamp?.multi) c.multiSkin++
      if (p.shadowSets) c.shadowSets++
    }
    counts[frame] = c
  }
  assert.deepEqual(counts, {
    shukra: { emission: 3, flowing: 0, matcap: 2, skinRamp: 7, multiSkin: 2, shadowSets: 0, effect: 0 },
    pavo: { emission: 0, flowing: 0, matcap: 1, skinRamp: 2, multiSkin: 0, shadowSets: 0, effect: 0 },
  })
})
