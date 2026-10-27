import * as THREE from 'three'

export interface ViewerStats {
  /** Geometries and textures currently alive in the renderer (`renderer.info.memory`). */
  geometries: number
  textures: number
  /** Draw calls and triangles of the last rendered frame. */
  calls: number
  triangles: number
  /** Number of frames rendered since the renderer was created. */
  frames: number
  /** Unique textures reachable from the loaded model's materials. */
  modelTextures: number
  /** Estimated GPU memory of those textures in bytes (RGBA8, plus a third for mipmaps). */
  textureBytes: number
  /** Built animation clips in the viewer's cache and their decoded size in bytes. */
  cachedClips: number
  cachedClipBytes: number
  /** Shader programs the renderer holds (toon materials compile one per keyword set). */
  programs: number
}

/** Unique textures referenced by the materials under `root`. */
export function collectTextures(root: THREE.Object3D): Set<THREE.Texture> {
  const textures = new Set<THREE.Texture>()
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value)
    }
  })
  return textures
}

export function estimateTextureBytes(textures: Iterable<THREE.Texture>): number {
  let bytes = 0
  for (const texture of textures) {
    const image = texture.image as { width?: number; height?: number } | null // image type depends on the loader
    if (!image?.width || !image.height) continue
    bytes += image.width * image.height * 4 * (texture.generateMipmaps ? 4 / 3 : 1)
  }
  return Math.round(bytes)
}
