// The outline of a model whose materials have no outline material to pair with (add-erza-model): an inverted hull of the mesh's own geometry,
// pushed out along the view-space normal by a width that is constant on screen, in a darker shade of the surface it outlines. It is built like
// the PGR outlines (`createOutlineMesh`: a child mesh sharing the geometry, skeleton and morph weights, so it animates and hides with its
// mesh), but needs none of their vertex attributes. No Vue imports.
import * as THREE from 'three'
import type { SharedToonUniforms } from './ToonMaterial'

/** Width in the units of `uOutlinePx` (0.7 px each, shared): about 1.4 px. */
export const DEFAULT_OUTLINE = { width: 2, shade: 0.3 }

export const defaultOutlineVertex = /* glsl */ `
#include <common>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>

uniform float uWidth;
uniform float uOutlinePx;   // pixels per width unit (shared)
uniform float uPixelScale;  // view-space size of one pixel at distance 1 (shared)

varying vec2 vUvBase;

void main() {
	vUvBase = uv;

	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>

	vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
	vec3 nView = normalize( normalMatrix * normalize( objectNormal ) );
	// About constant on screen: the push grows with the distance from the camera.
	mvPosition.xyz += nView * uWidth * uOutlinePx * uPixelScale * max( - mvPosition.z, 0.0 );
	gl_Position = projectionMatrix * mvPosition;
}
`

export const defaultOutlineFragment = /* glsl */ `
#include <common>

uniform sampler2D tBase;
uniform float uShade;

varying vec2 vUvBase;

void main() {
	gl_FragColor = vec4( texture2D( tBase, vUvBase ).rgb * uShade, 1.0 );
	#include <colorspace_fragment>
}
`

/** Shared across a model's meshes that use the same base texture. */
export function createDefaultOutlineMaterial(base: THREE.Texture, shared: SharedToonUniforms, name: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: `outline:${name}`,
    vertexShader: defaultOutlineVertex,
    fragmentShader: defaultOutlineFragment,
    uniforms: {
      tBase: { value: base },
      uShade: { value: DEFAULT_OUTLINE.shade },
      uWidth: { value: DEFAULT_OUTLINE.width },
      uOutlinePx: shared.uOutlinePx,
      uPixelScale: shared.uPixelScale,
    },
    side: THREE.BackSide,
  })
}
