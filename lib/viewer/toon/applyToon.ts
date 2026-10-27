// Toon resources of one loaded model (design D2, D8, D13): a toon material per mesh next to its glTF material, outline
// children, and the self-shadow flags; `setOn` swaps the sets. Everything built here is owned here and freed by `dispose`,
// whichever set is shown. No Vue imports.
import * as THREE from 'three'
import type { GLTFParser } from 'three/addons/loaders/GLTFLoader.js'
import { materialRefs, pairOutlines, parseToonMaterial, type ToonParams } from './params'
import { createOutlineMaterial, createOutlineMesh } from './OutlineMaterial'
import { alphaClip, createToonMaterial, receivesSelfShadow, type SharedToonUniforms } from './ToonMaterial'

// Texture slots the toon shader samples; the others (`_MatCapTex`, `_EmissionFlowMap`, the effect layer's, …) are not loaded.
const SLOTS = ['_MainTex', '_MaskTex', '_BumpMap', '_PBRMask', '_SkinRampAO', '_SkinRamp', '_FaceMap', '_DetailMap'] as const

/**
 * Whether a parsed material is drawn with a toon material: character materials and the character layer of effect characters
 * (Stigmata's veils, H17); the others (`fur`) keep their glTF material.
 */
function toned(params: ToonParams | null | undefined): params is ToonParams {
  return params?.family === 'character' || params?.family === 'effectCharacter'
}

interface GltfJson {
  materials?: unknown[]
  textures?: unknown[]
  meshes?: { primitives?: { material?: number }[] }[]
  nodes?: { mesh?: number }[]
  scenes?: { extras?: { anchors?: { head?: unknown } } }[]
  scene?: number
}

interface Entry {
  mesh: THREE.Mesh
  original: THREE.Material
  toon: THREE.ShaderMaterial
  outline: THREE.Mesh | null
  caster: boolean
  receiver: boolean
  depth: THREE.MeshDepthMaterial | null
}

export interface ToonCounts {
  meshes: number
  materials: number
  outlines: number
  casters: number
  receivers: number
}

/** Parameters and textures of a model, loaded before the model is shown (the only asynchronous part). */
export interface ToonSources {
  params: (ToonParams | null)[]
  outlines: Map<number, number>
  textures: Map<number, THREE.Texture>
}

export async function loadToonSources(parser: GLTFParser): Promise<ToonSources> {
  const json = parser.json as GltfJson
  const gltfTextures = json.textures ?? []
  const materials = json.materials ?? []
  const params = materials.map((m) => parseToonMaterial(m, gltfTextures))
  const outlines = pairOutlines(materialRefs(materials))

  // Only the slots of the materials that are on meshes.
  const used = new Set<number>()
  for (const mesh of json.meshes ?? []) for (const primitive of mesh.primitives ?? []) if (primitive.material !== undefined) used.add(primitive.material)
  const wanted = new Map<number, boolean>() // texture index → sRGB
  for (const index of used) {
    const p = params[index]
    if (!toned(p)) continue
    for (const slot of SLOTS) {
      const t = p.textures[slot]
      if (t) wanted.set(t.index, t.srgb)
    }
  }
  const textures = new Map<number, THREE.Texture>()
  await Promise.all(
    [...wanted].map(async ([index, srgb]) => {
      const texture = (await parser.getDependency('texture', index)) as THREE.Texture
      // Shared with the glTF material when it uses the same image (the base colour); that one is already sRGB.
      if (srgb && texture.colorSpace !== THREE.SRGBColorSpace) {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.needsUpdate = true
      }
      textures.set(index, texture)
    }),
  )
  return { params, outlines, textures }
}

export class ToonModel {
  private readonly entries: Entry[] = []
  private readonly materials = new Set<THREE.ShaderMaterial>()
  private readonly textureSet = new Set<THREE.Texture>()
  private readonly head: THREE.Object3D | null
  // Head axes in the head's own space, measured in the bind pose against the model's front (+Z) and right (+X).
  private readonly headForward = new THREE.Vector3(0, 0, 1)
  private readonly headRight = new THREE.Vector3(1, 0, 0)
  private on = false
  private wireframe = false

  /**
   * `nodes[i]` is the object of glTF node `i`; the model must already be in the scene with its world matrices updated (the
   * head axes are measured from them).
   */
  constructor(parser: GLTFParser, nodes: readonly THREE.Object3D[], sources: ToonSources, private readonly shared: SharedToonUniforms) {
    const json = parser.json as GltfJson
    const sceneExtras = json.scenes?.[json.scene ?? 0]?.extras
    const headIndex = sceneExtras?.anchors?.head
    this.head = typeof headIndex === 'number' ? (nodes[headIndex] ?? null) : null
    if (this.head) {
      const q = this.head.getWorldQuaternion(new THREE.Quaternion()).invert()
      this.headForward.set(0, 0, 1).applyQuaternion(q)
      this.headRight.set(1, 0, 0).applyQuaternion(q)
    }

    for (const texture of sources.textures.values()) this.textureSet.add(texture)
    const toonCache = new Map<string, THREE.ShaderMaterial>()
    const outlineCache = new Map<string, THREE.ShaderMaterial>()
  
    ;(json.nodes ?? []).forEach((node, nodeIndex) => {
      if (node.mesh === undefined) return
      const mesh = nodes[nodeIndex]
      if (!(mesh instanceof THREE.Mesh) || Array.isArray(mesh.material)) return
      const materialIndex = json.meshes?.[node.mesh]?.primitives?.[0]?.material
      if (materialIndex === undefined) return
      const params = sources.params[materialIndex]
      if (!toned(params)) return // keeps its glTF material

      const geometry = mesh.geometry
      const tangents = geometry.getAttribute('tangent') !== undefined
      const uv1 = geometry.getAttribute('uv1') !== undefined
      const zone = geometry.getAttribute('_pgrzone') !== undefined
      const textures: Record<string, THREE.Texture> = {}
      for (const slot of SLOTS) {
        const t = params.textures[slot]
        const texture = t ? sources.textures.get(t.index) : undefined
        if (texture) textures[slot] = texture
      }
      const original = mesh.material
      const key = `${materialIndex}|${tangents}|${uv1}|${zone}|${original.side}`
      let toon = toonCache.get(key)
      if (!toon) {
        toon = createToonMaterial(params, textures, shared, { tangents, uv1, zone }, { side: original.side, head: this.head !== null })
        toonCache.set(key, toon)
        this.materials.add(toon)
      }

      let outline: THREE.Mesh | null = null
      const outlineIndex = sources.outlines.get(materialIndex)
      const outlineParams = outlineIndex === undefined ? null : sources.params[outlineIndex]
      if (outlineParams?.outline && geometry.getAttribute('_pgrcolor') && geometry.getAttribute('_pgrsmoothnormal')) {
        const outlineKey = `${outlineIndex}|${materialIndex}|${tangents}`
        let material = outlineCache.get(outlineKey)
        if (!material) {
          material = createOutlineMaterial(outlineParams, params, textures._MainTex ?? null, shared, tangents)
          outlineCache.set(outlineKey, material)
          this.materials.add(material)
        }
        outline = createOutlineMesh(mesh, material, outlineParams.render.renderOrder)
        outline.visible = false
        mesh.add(outline)
      }

      const blended = params.render.blend !== 'none'
      const cutoff = alphaClip(params)
      let depth: THREE.MeshDepthMaterial | null = null
      if (!blended && cutoff !== null && textures._MainTex) {
        depth = new THREE.MeshDepthMaterial({ map: textures._MainTex, alphaTest: cutoff })
      }
      this.entries.push({ mesh, original, toon, outline, caster: !blended, receiver: receivesSelfShadow(params), depth })
    })
  }

  /** Show the toon set (materials, outlines, self-shadow flags) or the glTF materials. */
  setOn(on: boolean): void {
    this.on = on
    for (const entry of this.entries) {
      const { mesh, toon, original, outline } = entry
      mesh.material = on ? toon : original
      mesh.renderOrder = on ? orderOf(toon) : 0
      if (outline) outline.visible = on && !this.wireframe
      mesh.castShadow = on && entry.caster
      mesh.receiveShadow = on && entry.receiver
      mesh.customDepthMaterial = on && entry.depth ? entry.depth : undefined
    }
  }

  /** Wireframe on both sets; outlines are left out of the wireframe view. */
  setWireframe(on: boolean): void {
    this.wireframe = on
    for (const entry of this.entries) {
      for (const material of [entry.toon, entry.original]) if ('wireframe' in material) (material as THREE.MeshBasicMaterial).wireframe = on
      if (entry.outline) entry.outline.visible = this.on && !on
    }
  }

  /** Whether any mesh casts the self-shadow when toon shading is on. */
  hasCasters(): boolean {
    return this.entries.some((e) => e.caster)
  }

  /** Head axes in view space for the face shadow; called before each render. */
  updateHead(camera: THREE.Camera): void {
    if (!this.head) return
    const q = this.head.getWorldQuaternion(new THREE.Quaternion())
    const view = camera.matrixWorldInverse
    this.shared.uHeadForward.value.copy(this.headForward).applyQuaternion(q).transformDirection(view)
    this.shared.uHeadRight.value.copy(this.headRight).applyQuaternion(q).transformDirection(view)
  }

  /** Textures of both sets: the toon textures and those of the glTF materials (whichever set is shown). */
  textures(): Set<THREE.Texture> {
    const all = new Set(this.textureSet)
    for (const entry of this.entries) {
      for (const value of Object.values(entry.original)) if (value instanceof THREE.Texture) all.add(value)
    }
    return all
  }

  counts(): ToonCounts {
    return {
      meshes: this.entries.length,
      materials: this.materials.size,
      outlines: this.entries.filter((e) => e.outline).length,
      casters: this.entries.filter((e) => e.caster).length,
      receivers: this.entries.filter((e) => e.receiver).length,
    }
  }

  /**
   * Put the glTF materials back on the meshes (the model's own disposal frees those and their textures), remove the outlines,
   * and free the toon materials, depth materials and the textures loaded for them.
   */
  dispose(): void {
    this.setOn(false)
    for (const entry of this.entries) {
      // The outline's geometry and skeleton are its mesh's, freed with the model.
      if (entry.outline) entry.mesh.remove(entry.outline)
      entry.depth?.dispose()
    }
    for (const material of this.materials) material.dispose()
    for (const texture of this.textureSet) {
      texture.dispose()
      const image: unknown = texture.image
      if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close()
    }
    this.entries.length = 0
    this.materials.clear()
    this.textureSet.clear()
  }
}

/** Draw order of a toon material: the game's render queue (opaque 2000, outlines 2001, veils 2905 to 3101). */
function orderOf(material: THREE.ShaderMaterial): number {
  return material.userData.renderOrder as number
}
