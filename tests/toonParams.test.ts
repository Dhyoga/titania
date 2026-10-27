import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
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

// Real data: every material of every shipped model. Skipped without data/.
const dataDir = new URL('../data/crepuscule/models/', import.meta.url)
const skip = !existsSync(new URL('r5biankamd010011.glb', dataDir)) && 'data/crepuscule is not present'
const MODELS = ['r5biankamd010011', 'r5biankamd010021', 'r5biankamd010031', 'r5biankamd019011', 'r5biankamd019241', 'r5biankamd019271', 'qr5biankamd010011_chibi']

interface Gltf {
  materials: { name: string; extras?: { family?: string } }[]
  textures: unknown[]
  meshes: { primitives: { material?: number; attributes: Record<string, number> }[] }[]
  nodes: { name: string; mesh?: number }[]
}

function gltf(id: string): Gltf {
  const b = readFileSync(new URL(`${id}.glb`, dataDir))
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

test('real models: every material parses; character and outline materials are drawn, passes are not', { skip }, () => {
  for (const id of MODELS) {
    const json = gltf(id)
    for (const material of json.materials) {
      const p = parseToonMaterial(material, json.textures)
      const family = material.extras?.family
      if (family === 'character' || family === 'outline') {
        assert.ok(p, `${id} ${material.name}`)
        for (const slot of Object.values(p.textures)) assert.ok(slot.index < json.textures.length)
      } else {
        assert.equal(p, null, `${id} ${material.name}`)
      }
    }
    // Every material on a mesh is a character material.
    for (const mesh of json.meshes) for (const prim of mesh.primitives) assert.equal(json.materials[prim.material ?? -1]?.extras?.family, 'character', id)
  }
})

test('real models: PBR and matcap materials on meshes', { skip }, () => {
  const counts = { full: 0, simple: 0, matcap: 0 }
  for (const id of MODELS) {
    const json = gltf(id)
    const used = new Set(json.meshes.flatMap((m) => m.primitives.map((p) => p.material ?? -1)))
    for (const index of used) {
      const p = parseToonMaterial(json.materials[index], json.textures)
      if (p?.pbr) counts[p.pbr.mode]++
      if (p?.matcap) counts.matcap++
      if (p?.pbr?.mode === 'full') assert.ok(p.textures._PBRMask, `${id} ${p.name} has a PBR mask`)
    }
  }
  assert.deepEqual(counts, { full: 62, simple: 14, matcap: 13 })
  const final = gltf('r5biankamd010031')
  const down = final.materials.find((m) => m.name === 'R5BiankaMd010031Down')
  const p = parseToonMaterial(down, final.textures)
  assert.equal(p?.pbr?.metallic, 1)
  assert.equal(p?.pbr?.roughness, 0)
})

test('real models: outline pairs', { skip }, () => {
  const def = pairsByName(gltf('r5biankamd010011'))
  assert.equal(def.get('R5BiankaMd010011Hair01'), 'R5BiankaMd010011HairOL')
  assert.equal(def.get('R5BiankaMd010011Hair02'), 'R5BiankaMd010011HairOL')
  assert.equal(def.get('R5BiankaMd010011BodyEX01'), 'R5BiankaMd010011BodyOL')
  assert.equal(def.get('R5BiankaMd010011Face'), 'R5BiankaMd010011FaceOL')
  assert.equal(def.get('R5BiankaMd010011FaceEX'), 'R5BiankaMd010011FaceOL')
  for (const veil of ['Alpha', 'Alpha01', 'AlphaEX', 'AlphaEX01']) assert.equal(def.get(`R5BiankaMd010011${veil}`), null, veil)
  assert.equal(def.get('R5BiankaMd010011Eye'), null)
  assert.equal(def.get('R5BiankaMd010011Shade'), null)

  const final = pairsByName(gltf('r5biankamd010031'))
  assert.equal(final.get('R5BiankaMd010031Body'), 'R5BiankaMd010011BodyOL', 'Generic - Final shares the default outlines')

  const sonata = pairsByName(gltf('r5biankamd019241'))
  assert.equal(sonata.get('R5BiankaMd019241Upper'), 'R5BiankaMd019241UpperOL')
  assert.equal(sonata.get('R5BiankaMd019241UpperEX'), 'R5BiankaMd019241UpperEXOL')
  assert.equal(sonata.get('R5BiankaMd019241Hair01'), 'R5BiankaMd019241Hair01OL')
  assert.equal(sonata.get('R5BiankaMd019241Hair02'), 'R5BiankaMd019241Hair01OL')
  assert.equal(sonata.get('R5BiankaMd019241Alpha01'), 'R5BiankaMd019241Alpha01OL')

  const tides = pairsByName(gltf('r5biankamd019271'))
  assert.equal(tides.get('R5BiankaMd019271Alpha_1'), null, 'AlphaOL is written after Alpha_1, so it is not its outline')
  assert.equal(tides.get('R5BiankaMd019271Alpha_2'), 'R5BiankaMd019271AlphaOL')
  assert.equal(tides.get('R5BiankaMd019271Cloth02_3'), 'R5BiankaMd019271Cloth02OL')

  assert.equal(pairsByName(gltf('qr5biankamd010011_chibi')).get('QR5BiankaMd010011'), 'QR5BiankaMd010011OL')
})

test('real models: meshes with an outline, per skin', { skip }, () => {
  const counts: Record<string, string> = {}
  for (const id of MODELS) {
    const json = gltf(id)
    const pairs = pairOutlines(materialRefs(json.materials))
    const meshes = json.nodes.filter((n) => n.mesh !== undefined)
    const outlined = meshes.filter((n) => json.meshes[n.mesh!]!.primitives.some((p) => pairs.has(p.material ?? -1)))
    counts[id] = `${outlined.length}/${meshes.length}`
  }
  assert.deepEqual(counts, {
    r5biankamd010011: '11/17',
    r5biankamd010021: '11/17',
    r5biankamd010031: '11/17',
    r5biankamd019011: '14/16',
    r5biankamd019241: '20/43',
    r5biankamd019271: '18/21',
    qr5biankamd010011_chibi: '1/1',
  })
})

test('real models of Stigmata, Veritas and Zero: every material parses; meshes use character, effectCharacter or fur materials', { skip: !existsSync(new URL('../data/stigmata/models/r4biankamd010031.glb', import.meta.url)) && 'data/ is not present' }, () => {
  let materials = 0
  let withOutline = 0
  let meshMaterials = 0
  let untoned = 0
  for (const frame of ['stigmata', 'veritas', 'zero']) {
    const dir = new URL(`../data/${frame}/models/`, import.meta.url)
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.glb'))) {
      const b = readFileSync(new URL(file, dir))
      const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) as Gltf
      for (const material of json.materials) {
        const p = parseToonMaterial(material, json.textures)
        const family = material.extras?.family
        if (family === 'character' || family === 'outline' || family === 'effectCharacter') {
          assert.ok(p, `${frame}/${file} ${material.name}`)
          for (const slot of Object.values(p.textures)) assert.ok(slot.index < json.textures.length, `${frame}/${file} ${material.name}`)
          materials++
        } else {
          assert.equal(p, null, `${frame}/${file} ${material.name}`)
        }
      }
      const pairs = pairOutlines(materialRefs(json.materials))
      for (const mesh of json.meshes) {
        for (const prim of mesh.primitives) {
          meshMaterials++
          // `effectCharacter` (Stigmata's veils) is toon-shaded as its character layer (H17); `fur` (Veritas' and Zero's) is not:
          // those meshes keep their glTF material (known gap, AGENTS.md "Not built").
          const family = json.materials[prim.material ?? -1]?.extras?.family
          assert.ok(['character', 'effectCharacter', 'fur'].includes(family ?? ''), `${frame}/${file}: family ${family}`)
          if (family === 'fur') untoned++
          if (pairs.has(prim.material ?? -1)) withOutline++
        }
      }
    }
  }
  assert.ok(materials > 100, `only ${materials} materials checked`)
  assert.ok(withOutline > 0 && withOutline <= meshMaterials, 'some meshes have an outline')
  assert.ok(untoned > 0 && untoned < meshMaterials / 4, `${untoned} of ${meshMaterials} mesh materials keep the glTF material`)
})

test('real models of the four frames: emission, colour ramps, zones, matcap and effect veils on meshes', { skip: !existsSync(new URL('../data/stigmata/models/r4biankamd010031.glb', import.meta.url)) && 'data/ is not present' }, () => {
  const counts: Record<string, Record<string, number>> = {}
  for (const frame of ['crepuscule', 'stigmata', 'veritas', 'zero']) {
    const dir = new URL(`../data/${frame}/models/`, import.meta.url)
    const c = { emission: 0, flowing: 0, matcap: 0, skinRamp: 0, multiSkin: 0, shadowSets: 0, effect: 0 }
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.glb'))) {
      const b = readFileSync(new URL(file, dir))
      const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) as Gltf
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
    }
    counts[frame] = c
  }
  assert.deepEqual(counts, {
    crepuscule: { emission: 27, flowing: 3, matcap: 13, skinRamp: 73, multiSkin: 13, shadowSets: 7, effect: 0 },
    stigmata: { emission: 12, flowing: 1, matcap: 9, skinRamp: 30, multiSkin: 8, shadowSets: 3, effect: 9 },
    veritas: { emission: 7, flowing: 0, matcap: 1, skinRamp: 16, multiSkin: 0, shadowSets: 0, effect: 0 },
    zero: { emission: 1, flowing: 0, matcap: 0, skinRamp: 3, multiSkin: 0, shadowSets: 0, effect: 0 },
  })

  // Stigmata's suit: four ramp bands with their own rates, two colour sets in use.
  const b = readFileSync(new URL('../data/stigmata/models/r4biankamd010031.glb', import.meta.url))
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) as Gltf
  const cloth = parseToonMaterial(json.materials.find((m) => m.name === 'R4BiankaMd010011Cloth'), json.textures)
  assert.equal(cloth?.emission?.intensity, 5)
  assert.equal(cloth?.skinRamp?.multi, true)
  assert.deepEqual(cloth?.skinRamp?.zoneRates.map((r) => Math.round(r * 100)), [45, 0, 20, 28])
  assert.equal(cloth?.shadowSets?.length, 4)
})
