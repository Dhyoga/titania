// The game's material parameters (glTF `material.extras`, written by the asset exporter) as typed toon parameters, and the
// outline material each main material pairs with. Pure TypeScript, no three.js, so it runs in Node tests.
//
// `extras.family` names the Unity shader family (`character`, `outline`, `sparkle`, `bloom`, `effectCharacter`, `fur`);
// `extras.shader` holds its keywords, texture slots, floats, colours and vectors; `extras.render` the render state. Nothing here
// throws: a missing or malformed value takes its default, and a material that is not a character, effect character or outline
// material parses to null.

import { partStem, stripModelPrefix } from '../parts.ts'

export type Rgba = [number, number, number, number]

export interface TextureSlot {
  /** glTF texture index. */
  index: number
  /** UV set (0 or 1). */
  texCoord: number
  scale: [number, number]
  offset: [number, number]
  /** From the glTF texture's `extras.colorSpace`; textures without it are taken as linear data. */
  srgb: boolean
}

export type Blend = 'none' | 'alpha' | 'premultiplied'
export type Cull = 'none' | 'back' | 'front'

export interface RenderState {
  blend: Blend
  depthWrite: boolean
  cull: Cull
  /** Alpha clip threshold from the render state (0 = none). */
  alphaTest: number
  renderOrder: number
}

export interface PbrParams {
  mode: 'full' | 'simple'
  metallic: number
  roughness: number
  metallicMapScale: number
  roughnessMapScale: number
  /** `_PBRRate`: how much of the PBR result replaces the toon colour. */
  rate: number
  specularIntensity: number
  specularColor: Rgba
  cubemapIntensity: number
  cubemapColor: Rgba
}

export interface ShadowColorSet {
  noColor: Rgba
  firstColor: Rgba
  secondColor: Rgba
}

export interface ToonParams {
  name: string
  /** `effectCharacter` (Stigmata's veils): a character material with an effect layer on top; only the character layer is read. */
  family: 'character' | 'outline' | 'effectCharacter'
  keywords: Set<string>
  /** Texture slots by Unity property name (`_MainTex`, `_MaskTex`, `_BumpMap`, `_PBRMask`, `_SkinRampAO`, `_FaceMap`, …). */
  textures: Record<string, TextureSlot>
  /** `_AlbedoColor` with `_AlbedoColorIntensity` applied to RGB; colours are sRGB values as the game stores them. */
  albedo: Rgba
  bumpScale: number
  /** `soft`: `IF_SMOOTH_SHADOW` = 1, a soft shadow edge with a gentle gradient of form (H8). */
  shadow: { first: number; second: number; smooth: number; soft: boolean; noColor: Rgba; firstColor: Rgba; secondColor: Rgba }
  specular: { intensity: number; shininess: number; smooth: number; color: Rgba }
  rim: { enabled: boolean; min: number; max: number; intensity: number; color: Rgba }
  /** `_Cutoff`: alpha clip threshold when `_ALPHACLIP` is set. */
  cutoff: number
  render: RenderState
  /** Outline materials only. */
  outline: { width: number; color: Rgba } | null
  /** `_PBR` (mode 2, with `_PBRMask`) or `_SIMPLE_PBR` (mode 1, scalars only); null on other materials. */
  pbr: PbrParams | null
  /** `_USE_MATCAP` materials (`_MatCapTex`); null on others. */
  matcap: { yScale: number; mask: number; metallic: number } | null
  /** `_EmissionIntensity` above 0; the emissive texels are marked by `_MaskTex` A. Null on others. */
  emission: { intensity: number; color: Rgba; flowing: boolean } | null
  /**
   * `IF_SKIN` with a `_SkinRamp`: how much of the ramp tints the colour (`rate`) and its scale (`intensity`). With
   * `_MUTLI_CHANEL_SKIN` the ramp has four bands, picked per vertex by `_PGRZONE.x`, each with its own rate and intensity
   * (`_MutliSkinRate`, `_MutliSkinIntensity`). Null on others.
   */
  skinRamp: { rate: number; intensity: number; multi: boolean; zoneRates: Vec4; zoneIntensities: Vec4 } | null
  /** `_MUTLI_CHANEL_SHADOW_COLOR`: colour sets 0 to 3 (set 0 is `shadow`), picked per vertex by `_PGRZONE.y`. Null on others. */
  shadowSets: ShadowColorSet[] | null
}

export type Vec4 = [number, number, number, number]

const WHITE: Rgba = [1, 1, 1, 1]

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(source: Json, key: string, fallback: number): number {
  const value = source[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function rgba(source: Json, key: string, fallback: Rgba): Rgba {
  const value = source[key]
  if (!Array.isArray(value) || value.length < 3) return [...fallback]
  const out = [0, 1, 2, 3].map((i) => (typeof value[i] === 'number' && Number.isFinite(value[i]) ? (value[i] as number) : fallback[i]))
  return out as Rgba
}

function vec4(source: Json, key: string, fallback: Vec4): Vec4 {
  const value = source[key]
  if (!Array.isArray(value)) return [...fallback]
  return [0, 1, 2, 3].map((i) => (typeof value[i] === 'number' && Number.isFinite(value[i]) ? (value[i] as number) : fallback[i])) as Vec4
}

function pair(value: unknown, fallback: [number, number]): [number, number] {
  if (!Array.isArray(value) || value.length < 2) return [...fallback]
  const [a, b] = value
  return typeof a === 'number' && Number.isFinite(a) && typeof b === 'number' && Number.isFinite(b) ? [a, b] : [...fallback]
}

function parseBlend(value: unknown): Blend {
  if (!isObject(value)) return 'none'
  if (value.dst !== 'oneMinusSrcAlpha') return 'none'
  if (value.src === 'srcAlpha') return 'alpha'
  if (value.src === 'one') return 'premultiplied'
  return 'none'
}

function parseCull(value: unknown): Cull {
  return value === 'none' || value === 'front' ? value : 'back'
}

function parseRender(value: unknown, defaultOrder: number): RenderState {
  const render = isObject(value) ? value : {}
  return {
    blend: parseBlend(render.blend),
    depthWrite: render.depthWrite !== false,
    cull: parseCull(render.cull),
    alphaTest: num(render, 'alphaTest', 0),
    renderOrder: Math.round(num(render, 'renderOrder', defaultOrder)),
  }
}

function parseTextures(value: unknown, gltfTextures: readonly unknown[]): Record<string, TextureSlot> {
  const out: Record<string, TextureSlot> = {}
  if (!isObject(value)) return out
  for (const [slot, raw] of Object.entries(value)) {
    if (!isObject(raw)) continue
    const index = raw.index
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) continue
    const texture = gltfTextures[index]
    if (gltfTextures.length > 0 && texture === undefined) continue // points past the texture list
    const extras = isObject(texture) && isObject(texture.extras) ? texture.extras : {}
    const texCoord = typeof raw.texCoord === 'number' && Number.isInteger(raw.texCoord) ? raw.texCoord : 0
    out[slot] = { index, texCoord, scale: pair(raw.scale, [1, 1]), offset: pair(raw.offset, [0, 0]), srgb: extras.colorSpace === 'sRGB' }
  }
  return out
}

/**
 * Toon parameters of one glTF material (`gltfTextures` is the glTF `textures` list, for the colour spaces). Null for a material
 * without the game's parameters or of a family that is not drawn (sparkle, bloom).
 */
export function parseToonMaterial(material: unknown, gltfTextures: readonly unknown[] = []): ToonParams | null {
  if (!isObject(material) || !isObject(material.extras)) return null
  const extras = material.extras
  const family = extras.family
  if (family !== 'character' && family !== 'outline' && family !== 'effectCharacter') return null
  const shader = isObject(extras.shader) ? extras.shader : {}
  const floats = isObject(shader.floats) ? shader.floats : {}
  const colors = isObject(shader.colors) ? shader.colors : {}
  const vectors = isObject(shader.vectors) ? shader.vectors : {}
  const keywords = new Set(Array.isArray(shader.keywords) ? shader.keywords.filter((k): k is string => typeof k === 'string') : [])
  const name = typeof material.name === 'string' ? material.name : ''

  const albedoColor = rgba(colors, '_AlbedoColor', WHITE)
  const albedoIntensity = num(floats, '_AlbedoColorIntensity', 1)
  const first = num(floats, '_FirstShadow', 0.5)
  const firstColor = rgba(colors, '_FirstShadowColor', WHITE)
  const textures = parseTextures(shader.textures, gltfTextures)
  const shadowSet = (suffix: string): ShadowColorSet => {
    const setFirst = rgba(colors, `_FirstShadowColor${suffix}`, WHITE)
    return { noColor: rgba(colors, `_NoShadowColor${suffix}`, WHITE), firstColor: setFirst, secondColor: rgba(colors, `_SecondShadowColor${suffix}`, setFirst) }
  }
  const emissionIntensity = Math.max(0, num(floats, '_EmissionIntensity', 0))

  return {
    name,
    family,
    keywords,
    textures,
    albedo: [albedoColor[0] * albedoIntensity, albedoColor[1] * albedoIntensity, albedoColor[2] * albedoIntensity, albedoColor[3]],
    bumpScale: num(floats, '_BumpScale', 1),
    shadow: {
      first,
      second: num(floats, '_SecondShadow', first),
      smooth: Math.max(0, num(floats, '_SmoothFactor', 0.01)),
      soft: num(floats, 'IF_SMOOTH_SHADOW', 0) === 1,
      noColor: rgba(colors, '_NoShadowColor', WHITE),
      firstColor,
      secondColor: rgba(colors, '_SecondShadowColor', firstColor),
    },
    specular: {
      intensity: Math.max(0, num(floats, '_SpecularIntensity', 0)),
      shininess: Math.max(0, num(floats, '_SpecularShiness', 1)),
      smooth: Math.max(0, num(floats, '_SpecularSmoothFactor', 0.01)),
      color: rgba(colors, '_SpecularColor', WHITE),
    },
    rim: {
      enabled: num(floats, 'IF_RIM', 0) === 1,
      min: num(floats, '_RimMin', 0.7),
      max: num(floats, '_RimMax', 1),
      intensity: Math.max(0, num(floats, '_RimIntensity', 0)),
      color: rgba(colors, '_RimColor', WHITE),
    },
    cutoff: num(floats, '_Cutoff', 0.5),
    render: parseRender(extras.render, family === 'outline' ? 2001 : 2000),
    outline: family === 'outline' ? { width: Math.max(0, num(floats, '_XCharOutlineWidth', 1)), color: rgba(colors, '_OutlineColor', [0, 0, 0, 1]) } : null,
    pbr: parsePbr(keywords, floats, colors),
    matcap: keywords.has('_USE_MATCAP')
      ? {
          yScale: num(floats, '_MatCapYScale', 0),
          mask: clamp01(num(floats, '_MatcapMask', 1)),
          metallic: clamp01(num(floats, '_Metallic', 0) * num(floats, '_MetallicMapScale', 1)),
        }
      : null,
    emission: emissionIntensity > 0
      ? { intensity: emissionIntensity, color: rgba(colors, '_EmissionColor', WHITE), flowing: keywords.has('_USE_EMISSION_FLOWING') }
      : null,
    skinRamp: num(floats, 'IF_SKIN', 0) === 1 && textures._SkinRamp
      ? {
          rate: clamp01(num(floats, '_SkinRate', 0)),
          intensity: Math.max(0, num(floats, '_SkinIntensity', 1)),
          multi: keywords.has('_MUTLI_CHANEL_SKIN'),
          zoneRates: vec4(vectors, '_MutliSkinRate', [1, 1, 1, 1]).map(clamp01) as Vec4,
          zoneIntensities: vec4(vectors, '_MutliSkinIntensity', [1, 1, 1, 1]).map((v) => Math.max(0, v)) as Vec4,
        }
      : null,
    shadowSets: keywords.has('_MUTLI_CHANEL_SHADOW_COLOR') ? ['', '1', '2', '3'].map(shadowSet) : null,
  }
}

/**
 * The family of models that carry no PGR parameters (add-erza-model): `extras.family` is `diffuseShadow`, the base colour is the material's
 * `baseColorTexture` and `extras.shadowTexture` is the glTF index of a shadow-colour texture with the same UV layout. Separate from
 * `parseToonMaterial` on purpose: the PGR families stay as they are.
 */
export interface DiffuseShadowParams {
  name: string
  /** glTF texture index of the base-colour texture (the lit colour). */
  base: number
  /** glTF texture index of the shadow-colour texture. */
  shadow: number
  doubleSided: boolean
}

/** Null for any other material, and for a `diffuseShadow` one without both textures. */
export function parseDiffuseShadowMaterial(material: unknown): DiffuseShadowParams | null {
  if (!isObject(material) || !isObject(material.extras) || material.extras.family !== 'diffuseShadow') return null
  const pbr = isObject(material.pbrMetallicRoughness) ? material.pbrMetallicRoughness : {}
  const base = isObject(pbr.baseColorTexture) ? pbr.baseColorTexture.index : undefined
  const shadow = material.extras.shadowTexture
  const index = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
  if (!index(base) || !index(shadow)) return null
  return { name: typeof material.name === 'string' ? material.name : '', base, shadow, doubleSided: material.doubleSided === true }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function parsePbr(keywords: ReadonlySet<string>, floats: Json, colors: Json): PbrParams | null {
  const mode = keywords.has('_PBR') ? 'full' : keywords.has('_SIMPLE_PBR') ? 'simple' : null
  if (!mode) return null
  return {
    mode,
    metallic: clamp01(num(floats, '_Metallic', 0)),
    roughness: clamp01(num(floats, '_Roughness', 0.5)),
    metallicMapScale: Math.max(0, num(floats, '_MetallicMapScale', 1)),
    roughnessMapScale: Math.max(0, num(floats, '_RoughnessMapScale', 1)),
    rate: clamp01(num(floats, '_PBRRate', 1)),
    specularIntensity: Math.max(0, num(floats, '_PBRSpecularIntensity', 0)),
    specularColor: rgba(colors, '_PBRSpecularColor', WHITE),
    cubemapIntensity: Math.max(0, num(floats, '_CubemapIntensity', 1)),
    cubemapColor: rgba(colors, '_CubemapColor', WHITE),
  }
}

/** A material name without its model prefix (`R5BiankaMd010031Body` → `Body`; skins share materials across prefixes). */
function key(name: string): string {
  return stripModelPrefix(name)
}

/** Looser names a main material may share an outline under, most specific first (`Cloth02_3` → `Cloth02`, `Cloth`). */
function relaxedKeys(name: string): string[] {
  const exact = key(name)
  const out: string[] = []
  const add = (k: string | null) => {
    if (k !== null && k !== '' && k !== exact && !out.includes(k)) out.push(k)
  }
  add(exact.replace(/_\d+$/, ''))
  add(exact.replace(/EX/g, ''))
  add(exact.replace(/_\d+$/, '').replace(/EX/g, ''))
  add(partStem(name))
  return out
}

export interface MaterialRef {
  name: string
  /** `extras.family`, or null when the material has none. */
  family: string | null
}

/** The glTF material list as `MaterialRef`s. */
export function materialRefs(materials: readonly unknown[]): MaterialRef[] {
  return materials.map((material) => {
    const m = isObject(material) ? material : {}
    const extras = isObject(m.extras) ? m.extras : {}
    return { name: typeof m.name === 'string' ? m.name : '', family: typeof extras.family === 'string' ? extras.family : null }
  })
}

const PASS_FAMILIES = new Set(['outline', 'sparkle', 'bloom'])

/**
 * The outline material of each main (character) material: main material index → outline material index. The exporter writes
 * the pass materials of a mesh right before the main material that first uses them, and a shared material only once, so an
 * outline can only belong to a main material that comes after it. In order:
 * 1. the outline named `<name>OL` (model prefix ignored);
 * 2. an outline in the run of pass materials directly before the main material;
 * 3. the outline of a looser name (`_<n>` suffix, `EX`, then the part stem dropped: `BodyEX01` → `BodyOL`).
 * Main materials matched by none have no outline (the veils of the default skin).
 */
export function pairOutlines(materials: readonly MaterialRef[]): Map<number, number> {
  const outlinesByKey = new Map<string, number[]>()
  materials.forEach((material, index) => {
    if (material.family !== 'outline' || !material.name.endsWith('OL')) return
    const k = key(material.name.slice(0, -2))
    const list = outlinesByKey.get(k)
    if (list) list.push(index)
    else outlinesByKey.set(k, [index])
  })
  // The nearest outline of that name before the main material.
  const before = (k: string, mainIndex: number): number | undefined => {
    const list = outlinesByKey.get(k)
    if (!list) return undefined
    let found: number | undefined
    for (const index of list) if (index < mainIndex) found = index
    return found
  }

  const pairs = new Map<number, number>()
  materials.forEach((material, index) => {
    if (material.family !== 'character') return
    let outline = before(key(material.name), index)
    if (outline === undefined) {
      for (let i = index - 1; i >= 0 && PASS_FAMILIES.has(materials[i]?.family ?? ''); i--) {
        if (materials[i]?.family === 'outline') {
          outline = i
          break
        }
      }
    }
    if (outline === undefined) {
      for (const k of relaxedKeys(material.name)) {
        outline = before(k, index)
        if (outline !== undefined) break
      }
    }
    if (outline !== undefined) pairs.set(index, outline)
  })
  return pairs
}
