import * as THREE from 'three'

function disposeTexture(texture: THREE.Texture): void {
  texture.dispose()
  // Decoded WebP/PNG data of a GLTFLoader texture is an ImageBitmap; free it now instead of waiting for GC.
  const image: unknown = texture.image
  if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close()
}

function disposeMaterial(material: THREE.Material): void {
  // Any property that holds a texture (map, normalMap, ...), whatever the material type.
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) disposeTexture(value)
  }
  material.dispose()
}

/** Release the GPU resources of everything under `root`: geometries, materials, textures and skeletons. */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose()
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) disposeMaterial(material)
    }
  })
}
