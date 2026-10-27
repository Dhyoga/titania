// Toon `ShaderMaterial`s built from parsed material parameters (see `params.ts`, design D3–D7). No Vue imports.
import * as THREE from 'three'
import type { Rgba, ToonParams } from './params'
import { toonFragment, toonVertex } from './shaders'

/** Uniforms every toon and outline material of a viewer shares (by reference), updated by the viewer before rendering. */
export interface SharedToonUniforms {
  uLightDir: { value: THREE.Vector3 }
  uLightColor: { value: THREE.Color }
  uSpecScale: { value: number }
  uSpecExponent: { value: number }
  uHairExponent: { value: number }
  uMaskCut: { value: number }
  uSoftBand: { value: number }
  uFormMin: { value: number }
  uHeadForward: { value: THREE.Vector3 }
  uHeadRight: { value: THREE.Vector3 }
  uFaceFlip: { value: number }
  uOutlinePx: { value: number }
  uPixelScale: { value: number }
  /** The viewer's prefiltered environment (PMREM), null until a model with PBR materials needs it. */
  envMap: { value: THREE.Texture | null }
  uEnvStrength: { value: number }
  uEnvContrast: { value: number }
  uReflectShadow: { value: number }
}

// Tuned by eye against the in-game reference (tasks 4.1–4.3); recorded in AGENTS.md.
export const TOON_DEFAULTS = {
  specScale: 0.6,
  specExponent: 8,
  hairExponent: 24,
  maskCut: 0.02,
  softBand: 0.3,
  formMin: 0.8,
  faceFlip: -1,
  outlinePx: 0.7,
  /** H10: `_PBRMask` R is roughness and G metal (false: R metal, G roughness, the reading first planned). */
  pbrRIsRoughness: true,
  /** H15: a dark environment keeps dark metal dark under the map reading (H14); 1.2 before `fix-toon-material-variants`. */
  envStrength: 0.35,
  envContrast: 2,
  reflectShadow: 0.6,
  /** ACES exposure while toon shading is on (H9); the original materials are not tone mapped. */
  exposure: 1.25,
}

export function createSharedUniforms(): SharedToonUniforms {
  return {
    uLightDir: { value: new THREE.Vector3(0, 0, 1) },
    uLightColor: { value: new THREE.Color(1, 1, 1) },
    uSpecScale: { value: TOON_DEFAULTS.specScale },
    uSpecExponent: { value: TOON_DEFAULTS.specExponent },
    uHairExponent: { value: TOON_DEFAULTS.hairExponent },
    uMaskCut: { value: TOON_DEFAULTS.maskCut },
    uSoftBand: { value: TOON_DEFAULTS.softBand },
    uFormMin: { value: TOON_DEFAULTS.formMin },
    uHeadForward: { value: new THREE.Vector3(0, 0, 1) },
    uHeadRight: { value: new THREE.Vector3(1, 0, 0) },
    uFaceFlip: { value: TOON_DEFAULTS.faceFlip },
    uOutlinePx: { value: TOON_DEFAULTS.outlinePx },
    uPixelScale: { value: 0.001 },
    envMap: { value: null },
    uEnvStrength: { value: TOON_DEFAULTS.envStrength },
    uEnvContrast: { value: TOON_DEFAULTS.envContrast },
    uReflectShadow: { value: TOON_DEFAULTS.reflectShadow },
  }
}

/** The game stores colours as sRGB values; shading runs in three's linear working space (products are unchanged by it). */
export function srgbColor(c: Rgba): THREE.Color {
  return new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace)
}

export interface ToonGeometryInfo {
  tangents: boolean
  uv1: boolean
  /** The geometry has `_PGRZONE` (colour zones: ramp band in x, shadow colour set in y). */
  zone: boolean
}

export interface ToonMaterialOptions {
  /** The glTF material's side (the exporter already resolved culling and winding into it). */
  side: THREE.Side
  /** The model has a head anchor, so the face shadow can follow the head. */
  head: boolean
}

/** Whether the material clips, and at which alpha. */
export function alphaClip(params: ToonParams): number | null {
  if (params.keywords.has('_ALPHACLIP')) return params.cutoff
  if (params.render.alphaTest > 0) return params.render.alphaTest
  return null
}

export function receivesSelfShadow(params: ToonParams): boolean {
  return params.keywords.has('_CHAR_SHADOWMAP')
}

export function createToonMaterial(
  params: ToonParams,
  textures: Readonly<Record<string, THREE.Texture>>,
  shared: SharedToonUniforms,
  geometry: ToonGeometryInfo,
  options: ToonMaterialOptions,
): THREE.ShaderMaterial {
  const k = params.keywords
  const defines: Record<string, string> = {}
  const uniforms: Record<string, THREE.IUniform> = {}
  const main = params.textures._MainTex

  uniforms.tMain = { value: textures._MainTex ?? null }
  uniforms.uMainST = { value: new THREE.Vector4(main?.scale[0] ?? 1, main?.scale[1] ?? 1, main?.offset[0] ?? 0, main?.offset[1] ?? 0) }
  if (geometry.tangents) defines.USE_TANGENT = ''

  const mask = textures._MaskTex
  if (mask) {
    defines.HAS_MASK = ''
    uniforms.tMask = { value: mask }
  }
  if (textures._BumpMap && geometry.tangents) {
    defines.HAS_BUMP = ''
    uniforms.tBump = { value: textures._BumpMap }
    uniforms.uBumpScale = { value: params.bumpScale }
  }
  if (textures._PBRMask && (k.has('_PBR') || k.has('_SIMPLE_PBR'))) {
    defines.HAS_PBR = ''
    uniforms.tPBR = { value: textures._PBRMask }
  }
  if (textures._FaceMap && k.has('_FACE') && geometry.uv1) {
    defines.HAS_FACEMAP = ''
    defines.USE_UV1 = ''
    uniforms.tFace = { value: textures._FaceMap }
  }
  if (textures._DetailMap && k.has('_ALBEDO_DETAIL') && geometry.uv1) {
    defines.HAS_DETAIL = ''
    defines.USE_UV1 = ''
    uniforms.tDetail = { value: textures._DetailMap }
  }
  if (mask && k.has('_SHADOW_OBJECT_SPACE_NORMAL_MAP') && options.head) defines.FACE_SHADOW = ''
  if (receivesSelfShadow(params)) defines.SELF_SHADOW = ''
  if (params.shadow.soft) defines.SMOOTH_SHADOW = ''

  if (params.specular.intensity > 0) {
    defines.SPECULAR = ''
    // Shininess 0 occurs only on hair: never the Blinn-Phong lobe there, it would light the whole hair (H6).
    if (params.specular.shininess === 0) {
      if (textures._SkinRampAO && k.has('_HAIR_SKIN_RAMP_AO')) {
        defines.HAIR_STRAND = ''
        defines.HAS_STRAND = ''
        uniforms.tStrand = { value: textures._SkinRampAO }
      } else if (k.has('_SPEC_BITANGENT_OFFSET') && geometry.tangents) {
        defines.HAIR_BITANGENT = ''
      } else {
        defines.HAIR_NONE = ''
      }
    }
  }
  if (params.rim.enabled && params.rim.intensity > 0) defines.RIM = ''

  // Reflections need the viewer's environment (D3); without it the material stays toon only.
  const pbr = params.pbr
  const env = shared.envMap.value
  if (pbr && env) {
    defines.PBR = ''
    if (pbr.mode === 'full') defines.PBR_FULL = ''
    if (!TOON_DEFAULTS.pbrRIsRoughness) defines.PBR_R_METAL = ''
    Object.assign(uniforms, {
      uMetallic: { value: pbr.metallic },
      uRoughness: { value: pbr.roughness },
      uMetalScale: { value: pbr.metallicMapScale },
      uRoughScale: { value: pbr.roughnessMapScale },
      uPbrRate: { value: pbr.rate },
      uPbrSpec: { value: pbr.specularIntensity },
      uPbrSpecColor: { value: srgbColor(pbr.specularColor) },
      uCubeIntensity: { value: pbr.cubemapIntensity },
      uCubeColor: { value: srgbColor(pbr.cubemapColor) },
    })
  }

  // Emission (H12): the mask's A marks the emissive texels (a material without a mask shows none).
  if (params.emission && mask) {
    defines.EMISSION = ''
    uniforms.uEmission = { value: srgbColor(params.emission.color).multiplyScalar(params.emission.intensity) }
  }

  // Colour ramp (H13); with `_MUTLI_CHANEL_SKIN` its band, rate and scale per vertex from `_PGRZONE.x`.
  const ramp = params.skinRamp
  if (ramp && textures._SkinRamp) {
    defines.SKIN_RAMP = ''
    if (ramp.multi && geometry.zone) defines.RAMP_ZONES = ''
    Object.assign(uniforms, {
      tRamp: { value: textures._SkinRamp },
      uSkinRate: { value: ramp.rate },
      uSkinIntensity: { value: ramp.intensity },
      uZoneRates: { value: new THREE.Vector4(...ramp.zoneRates) },
      uZoneIntensities: { value: new THREE.Vector4(...ramp.zoneIntensities) },
    })
  }

  // Shadow colour sets per vertex from `_PGRZONE.y` (`_MUTLI_CHANEL_SHADOW_COLOR`).
  const sets = params.shadowSets
  if (sets && geometry.zone) {
    defines.SHADOW_SETS = ''
    uniforms.uNoShadowSets = { value: sets.map((s) => srgbColor(s.noColor)) }
    uniforms.uFirstSets = { value: sets.map((s) => srgbColor(s.firstColor)) }
    uniforms.uSecondSets = { value: sets.map((s) => srgbColor(s.secondColor)) }
  }
  if ('RAMP_ZONES' in defines || 'SHADOW_SETS' in defines) defines.USE_ZONE = ''

  const cutoff = alphaClip(params)
  if (cutoff !== null) defines.ALPHA_CLIP = ''

  const { shadow, specular, rim } = params
  Object.assign(uniforms, {
    uAlbedo: { value: new THREE.Vector4(...srgbColor(params.albedo).toArray(), params.albedo[3]) },
    uNoShadow: { value: srgbColor(shadow.noColor) },
    uFirstColor: { value: srgbColor(shadow.firstColor) },
    uSecondColor: { value: srgbColor(shadow.secondColor) },
    uFirst: { value: shadow.first },
    uSecond: { value: shadow.second },
    uSmooth: { value: shadow.smooth },
    uSpecColor: { value: srgbColor(specular.color) },
    uSpecIntensity: { value: specular.intensity },
    uSpecShininess: { value: specular.shininess },
    uSpecSmooth: { value: specular.smooth },
    uRimColor: { value: srgbColor(rim.color) },
    uRimMin: { value: rim.min },
    uRimMax: { value: rim.max },
    uRimIntensity: { value: rim.intensity },
    uCutoff: { value: cutoff ?? 0 },
  })
  for (const [name, uniform] of Object.entries(shared)) uniforms[name] = uniform
  const selfShadow = 'SELF_SHADOW' in defines
  // Receivers need three's light uniforms (shadow maps and matrices); the others use only the shared ones.
  const allUniforms = selfShadow ? { ...THREE.UniformsUtils.clone(THREE.UniformsLib.lights), ...uniforms } : uniforms

  const material = new THREE.ShaderMaterial({
    name: `toon:${params.name}`,
    vertexShader: toonVertex,
    fragmentShader: toonFragment,
    uniforms: allUniforms,
    defines,
    lights: selfShadow,
    side: options.side,
    transparent: params.render.blend !== 'none',
    depthWrite: params.render.depthWrite,
    premultipliedAlpha: params.render.blend === 'premultiplied',
  })
  material.userData.renderOrder = params.render.renderOrder
  // The renderer reads `envMap` to give the program the defines for sampling a prefiltered environment (CUBEUV_*).
  if ('PBR' in defines) (material as THREE.ShaderMaterial & { envMap: THREE.Texture | null }).envMap = env
  return material
}
