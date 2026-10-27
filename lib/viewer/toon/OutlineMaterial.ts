// Outlines (design D8): an inverted hull per mesh that has an outline material, drawn by a child mesh that shares the
// geometry, skeleton and morph weights of its mesh, so it animates, morphs and hides with it. No Vue imports.
import * as THREE from 'three'
import type { ToonParams } from './params'
import { alphaClip, srgbColor, type SharedToonUniforms } from './ToonMaterial'
import { outlineFragment, outlineVertex } from './shaders'

export function createOutlineMaterial(
  outline: ToonParams,
  main: ToonParams,
  mainTexture: THREE.Texture | null,
  shared: SharedToonUniforms,
  tangents: boolean,
): THREE.ShaderMaterial {
  const params = outline.outline ?? { width: 1, color: [0, 0, 0, 1] }
  const defines: Record<string, string> = {}
  if (tangents) defines.USE_TANGENT = ''
  const mainSlot = main.textures._MainTex
  const uniforms: Record<string, THREE.IUniform> = {
    uWidth: { value: params.width },
    uColor: { value: srgbColor(params.color) },
    uMainST: { value: new THREE.Vector4(mainSlot?.scale[0] ?? 1, mainSlot?.scale[1] ?? 1, mainSlot?.offset[0] ?? 0, mainSlot?.offset[1] ?? 0) },
    uOutlinePx: shared.uOutlinePx,
    uPixelScale: shared.uPixelScale,
  }
  // The outline is tinted by the outlined mesh's texture (H7), and a cut-out mesh's hull is cut out the same way, or it
  // outlines the whole card.
  if (mainTexture) {
    defines.HAS_MAIN = ''
    uniforms.tMain = { value: mainTexture }
    const cutoff = alphaClip(main)
    if (cutoff !== null) {
      defines.ALPHA_CLIP = ''
      uniforms.uCutoff = { value: cutoff }
    }
  }
  return new THREE.ShaderMaterial({
    name: `outline:${outline.name}`,
    vertexShader: outlineVertex,
    fragmentShader: outlineFragment,
    uniforms,
    defines,
    side: outline.render.cull === 'back' ? THREE.FrontSide : outline.render.cull === 'none' ? THREE.DoubleSide : THREE.BackSide,
    depthWrite: outline.render.depthWrite,
  })
}

/** The outline mesh of `mesh`: same geometry, skeleton, bind matrix and morph weights (the array itself, so clips drive both). */
export function createOutlineMesh(mesh: THREE.Mesh, material: THREE.ShaderMaterial, renderOrder: number): THREE.Mesh {
  let outline: THREE.Mesh
  if (mesh instanceof THREE.SkinnedMesh) {
    const skinned = new THREE.SkinnedMesh(mesh.geometry, material)
    skinned.bindMode = mesh.bindMode
    skinned.bind(mesh.skeleton, mesh.bindMatrix)
    outline = skinned
  } else {
    outline = new THREE.Mesh(mesh.geometry, material)
  }
  outline.name = `${mesh.name}:outline`
  outline.morphTargetInfluences = mesh.morphTargetInfluences
  outline.morphTargetDictionary = mesh.morphTargetDictionary
  outline.renderOrder = renderOrder
  outline.frustumCulled = mesh.frustumCulled
  outline.castShadow = false
  outline.receiveShadow = false
  outline.raycast = () => {}
  return outline
}
