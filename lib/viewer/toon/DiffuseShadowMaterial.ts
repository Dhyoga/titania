// Erza's toon material (add-erza-model, design D6): a base-colour texture where the surface faces the light and a shadow-colour texture where
// it faces away, a few percent of N·L apart. The textures share one UV layout (the game's `_SH` image is a flat, darker version of the diffuse
// one). Nothing from the PGR parameters is read: no ramp, mask, PBR, matcap or emission, and no self-shadow. Skinning comes from three.js's
// own chunks, so it animates like the built-in materials. No Vue imports.
import * as THREE from 'three'
import type { SharedToonUniforms } from './ToonMaterial'

/** Where the lit/shadow edge sits on N·L (−1 to 1) and how wide it is: tuned by eye against the textures, see AGENTS.md. */
export const DIFFUSE_SHADOW = { edge: 0.1, soft: 0.04 }

/** The draw order of the main material; her outline follows at +1 (the PGR materials use 2000 and 2001 the same way). */
export const DIFFUSE_SHADOW_RENDER_ORDER = 2000

export const diffuseShadowVertex = /* glsl */ `
#include <common>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>

varying vec3 vNormalView;
varying vec2 vUvBase;

void main() {
	vUvBase = uv;

	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>

	vNormalView = normalize( transformedNormal );

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
}
`

export const diffuseShadowFragment = /* glsl */ `
#include <common>

uniform sampler2D tBase;
uniform sampler2D tShadow;
uniform float uEdge;        // N·L at the middle of the edge
uniform float uSoft;        // half the width of the edge, in N·L
uniform vec3 uLightDir;     // towards the key light, view space (shared)
uniform vec3 uLightColor;   // light colour times the stage intensity (shared)

varying vec3 vNormalView;
varying vec2 vUvBase;

void main() {
	vec3 N = normalize( vNormalView );
	#ifdef DOUBLE_SIDED
		N *= gl_FrontFacing ? 1.0 : - 1.0;
	#endif
	float nl = dot( N, normalize( uLightDir ) );
	float lit = smoothstep( uEdge - uSoft, uEdge + uSoft, nl );
	vec3 color = mix( texture2D( tShadow, vUvBase ).rgb, texture2D( tBase, vUvBase ).rgb, lit );
	gl_FragColor = vec4( color * uLightColor, 1.0 );
	#include <colorspace_fragment>
}
`

/** `base` and `shadow` are sRGB textures; the light direction and intensity are the viewer's shared ones (the Lighting popover). */
export function createDiffuseShadowMaterial(base: THREE.Texture, shadow: THREE.Texture, shared: SharedToonUniforms, options: { name: string; side: THREE.Side }): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    name: `diffuseShadow:${options.name}`,
    vertexShader: diffuseShadowVertex,
    fragmentShader: diffuseShadowFragment,
    uniforms: {
      tBase: { value: base },
      tShadow: { value: shadow },
      uEdge: { value: DIFFUSE_SHADOW.edge },
      uSoft: { value: DIFFUSE_SHADOW.soft },
      uLightDir: shared.uLightDir,
      uLightColor: shared.uLightColor,
    },
    side: options.side,
  })
  material.userData.renderOrder = DIFFUSE_SHADOW_RENDER_ORDER
  return material
}
