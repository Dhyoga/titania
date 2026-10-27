// GLSL of the toon and outline materials. Skinning, morph targets and the shadow map come from three.js's own chunks, so
// animation, the face morphs and the self-shadow work as with the built-in materials.
//
// Lighting is the shader's own (see design D3/D4): the key light's direction in view space and a light colour come in as
// shared uniforms, and colours are tinted, not lit physically. Keywords of the game's material become `#define`s:
//   HAS_MASK, HAS_BUMP, HAS_PBR, HAS_STRAND, HAS_FACEMAP,
//   HAS_DETAIL                                             texture slots in use
//   ALPHA_CLIP                                             discard below `uCutoff`
//   FACE_SHADOW                                            shadow edge from the face mask (H2)
//   SELF_SHADOW                                            receives the character shadow map (H5)
//   SMOOTH_SHADOW                                          soft shadow edge and form gradient (H8)
//   SPECULAR, HAIR_STRAND, HAIR_BITANGENT, HAIR_NONE       highlight kinds (D6, H3, H6)
//   RIM                                                    rim light
//   PBR, PBR_FULL, PBR_R_METAL                             reflections (add-pbr-metal; matcap was tried twice and left out)
//   EMISSION                                               emission (H12)
//   SKIN_RAMP, RAMP_ZONES, SHADOW_SETS                     colour ramp and colour zones (H13)
//   USE_TANGENT, USE_UV1, USE_ZONE                         the geometry has tangents / a second UV set / colour zones

export const toonVertex = /* glsl */ `
#include <common>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>

uniform vec4 uMainST;

varying vec3 vViewPosition;
varying vec3 vToonNormal;
varying vec2 vUv0;
varying vec2 vUvMain;
#ifdef USE_TANGENT
	varying vec3 vToonTangent;
	varying vec3 vToonBitangent;
#endif
#ifdef USE_UV1
	varying vec2 vUv1;
#endif
#ifdef USE_ZONE
	attribute vec2 _pgrzone;
	varying vec2 vZone;
#endif

void main() {
	vUv0 = uv;
	vUvMain = uv * uMainST.xy + uMainST.zw;
	#ifdef USE_UV1
		vUv1 = uv1;
	#endif
	#ifdef USE_ZONE
		vZone = _pgrzone;
	#endif

	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>

	vToonNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vToonTangent = normalize( transformedTangent );
		vToonBitangent = normalize( cross( vToonNormal, vToonTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vToonBitangent = - vToonBitangent;
		#endif
	#endif

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>

	vViewPosition = - mvPosition.xyz;

	#include <worldpos_vertex>
	#include <shadowmap_vertex>
}
`

export const toonFragment = /* glsl */ `
#include <common>
#include <packing>
uniform bool receiveShadow; // set by the renderer from the mesh (declared by three's lights chunk, not included here)
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

uniform sampler2D tMain;
#ifdef HAS_MASK
	uniform sampler2D tMask;
#endif
#ifdef HAS_BUMP
	uniform sampler2D tBump;
	uniform float uBumpScale;
#endif
#ifdef HAS_PBR
	uniform sampler2D tPBR;
#endif
#ifdef HAS_STRAND
	uniform sampler2D tStrand;
#endif
#ifdef HAS_FACEMAP
	uniform sampler2D tFace;
#endif
#ifdef HAS_DETAIL
	uniform sampler2D tDetail;
#endif

uniform vec4 uAlbedo;
uniform vec3 uNoShadow;
uniform vec3 uFirstColor;
uniform vec3 uSecondColor;
uniform float uFirst;
uniform float uSecond;
uniform float uSmooth;
uniform vec3 uSpecColor;
uniform float uSpecIntensity;
uniform float uSpecShininess;
uniform float uSpecSmooth;
uniform vec3 uRimColor;
uniform float uRimMin;
uniform float uRimMax;
uniform float uRimIntensity;
uniform float uCutoff;
#ifdef PBR
	#include <cube_uv_reflection_fragment>
	uniform sampler2D envMap;
	uniform float uMetallic;
	uniform float uRoughness;
	uniform float uMetalScale;
	uniform float uRoughScale;
	uniform float uPbrRate;
	uniform float uPbrSpec;
	uniform vec3 uPbrSpecColor;
	uniform float uCubeIntensity;
	uniform vec3 uCubeColor;
#endif
#ifdef EMISSION
	uniform vec3 uEmission;
#endif
#ifdef SKIN_RAMP
	uniform sampler2D tRamp;
	uniform float uSkinRate;
	uniform float uSkinIntensity;
	uniform vec4 uZoneRates;
	uniform vec4 uZoneIntensities;
#endif
#ifdef SHADOW_SETS
	uniform vec3 uNoShadowSets[ 4 ];
	uniform vec3 uFirstSets[ 4 ];
	uniform vec3 uSecondSets[ 4 ];
#endif

// Shared by every toon material of the viewer.
uniform float uEnvStrength;    // global scale of reflections (tuned)
uniform float uEnvContrast;    // exponent on the environment's brightness (tuned)
uniform float uReflectShadow;  // reflection strength in the shadow band
uniform vec3 uLightDir;      // towards the key light, view space
uniform vec3 uLightColor;    // light colour times the stage intensity
uniform float uSpecScale;    // global specular scale (the game's intensities assume its own exposure)
uniform float uSpecExponent; // Blinn-Phong exponent per unit of _SpecularShiness
uniform float uHairExponent; // width of the hair highlight
uniform float uMaskCut;      // mask G below this is "always shadow" (H1)
uniform float uSoftBand;     // least width of a soft shadow edge (H8)
uniform float uFormMin;      // darkest point of the gentle form gradient on the lit side (H8)
uniform vec3 uHeadForward;   // head axes, view space (face shadow)
uniform vec3 uHeadRight;
uniform float uFaceFlip;     // which side of the face mask belongs to light from the right (+1 or -1)

varying vec3 vViewPosition;
varying vec3 vToonNormal;
varying vec2 vUv0;
varying vec2 vUvMain;
#ifdef USE_TANGENT
	varying vec3 vToonTangent;
	varying vec3 vToonBitangent;
#endif
#ifdef USE_UV1
	varying vec2 vUv1;
#endif
#ifdef USE_ZONE
	varying vec2 vZone;
#endif

float band( float edge, float soft, float x ) {
	float s = max( soft, 1e-4 );
	return smoothstep( edge - s, edge + s, x );
}

void main() {
	vec4 base = texture2D( tMain, vUvMain );
	float alpha = base.a * uAlbedo.a;
	#ifdef ALPHA_CLIP
		if ( alpha < uCutoff ) discard;
	#endif
	#ifdef OPAQUE
		alpha = 1.0;
	#endif
	vec3 albedo = base.rgb * uAlbedo.rgb;

	float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
	vec3 N = normalize( vToonNormal );
	#ifdef DOUBLE_SIDED
		N *= faceDirection;
	#endif
	#if defined( HAS_BUMP ) && defined( USE_TANGENT )
		vec3 T = normalize( vToonTangent );
		vec3 B = normalize( vToonBitangent );
		#ifdef DOUBLE_SIDED
			T *= faceDirection;
			B *= faceDirection;
		#endif
		vec3 mapN = texture2D( tBump, vUv0 ).xyz * 2.0 - 1.0;
		mapN.xy *= uBumpScale;
		N = normalize( mat3( T, B, N ) * mapN );
	#endif

	vec3 L = normalize( uLightDir );
	vec3 V = normalize( vViewPosition );
	float nl = 0.5 * dot( N, L ) + 0.5; // half Lambert

	#ifdef SMOOTH_SHADOW
		float lit = band( uFirst, max( uSmooth, uSoftBand ), nl ); // H8: IF_SMOOTH_SHADOW is a soft edge
	#else
		float lit = band( uFirst, uSmooth, nl );
	#endif

	#ifdef HAS_MASK
		vec4 mask = texture2D( tMask, vUv0 );
	#endif

	#ifdef FACE_SHADOW
		// The face mask's B is a threshold map: the face is lit where it exceeds how far the light has turned away from the
		// front, read as is for light from one side and mirrored for the other (H2).
		float f = dot( L, uHeadForward );
		float r = dot( L, uHeadRight );
		vec2 flat2 = vec2( f, r );
		float len = length( flat2 );
		if ( len > 1e-3 ) {
			flat2 /= len;
			float threshold = 0.5 - 0.5 * flat2.x;
			vec2 faceUv = r * uFaceFlip >= 0.0 ? vUv0 : vec2( 1.0 - vUv0.x, vUv0.y );
			float sdf = texture2D( tMask, faceUv ).b;
			lit = band( threshold, max( uSmooth, 0.01 ), sdf );
		} else {
			lit = 1.0;
		}
	#endif

	// The light term the colour ramp is read along: half Lambert, or the face mask's verdict on the face, with the same masks as the band.
	#ifdef FACE_SHADOW
		float shade = lit;
	#else
		float shade = nl;
	#endif

	#ifdef HAS_MASK
		lit *= step( uMaskCut, mask.g ); // H1: mask G of 0 is always in shadow
		shade *= step( uMaskCut, mask.g );
	#endif

	#if defined( SELF_SHADOW ) && defined( USE_SHADOWMAP )
		float selfShadow = getShadowMask();
		lit = min( lit, selfShadow );
		shade = min( shade, mix( min( shade, uFirst - 0.1 ), 1.0, selfShadow ) );
	#endif

	float band2 = uSecond < uFirst ? band( uSecond, uSmooth, nl ) : 1.0;
	#ifdef SHADOW_SETS
		// Colour set per vertex (_MUTLI_CHANEL_SHADOW_COLOR): _PGRZONE.y in quarters picks _NoShadowColor{,1,2,3} and the rest.
		int colorSet = int( clamp( floor( vZone.y * 4.0 ), 0.0, 3.0 ) );
		vec3 tint = mix( mix( uSecondSets[ colorSet ], uFirstSets[ colorSet ], band2 ), uNoShadowSets[ colorSet ], lit );
	#else
		vec3 tint = mix( mix( uSecondColor, uFirstColor, band2 ), uNoShadow, lit );
	#endif
	vec3 color = albedo * tint * uLightColor;
	#if defined( SMOOTH_SHADOW ) && !defined( FACE_SHADOW )
		color *= mix( uFormMin, 1.0, smoothstep( 0.2, 1.0, nl ) ); // H8: a gentle gradient of form; the face stays flat
	#endif

	#ifdef SKIN_RAMP
		// Colour ramp (IF_SKIN, H13): read along the light term, mixed in by _SkinRate (per band of _PGRZONE.x with
		// _MUTLI_CHANEL_SKIN).
		float rampU = shade;
		float rampV = 0.5;
		float rampRate = uSkinRate;
		float rampScale = uSkinIntensity;
		#ifdef RAMP_ZONES
			int zoneBand = int( clamp( floor( vZone.x * 4.0 ), 0.0, 3.0 ) );
			// Bands counted from the top of the stored image (H13: matched the reference; counting from the bottom, as Unity's v
			// would after the exporter's flip, tinted Stigmata's coat pinkish brown).
			rampV = ( float( zoneBand ) + 0.5 ) / 4.0;
			rampRate = uZoneRates[ zoneBand ];
			rampScale = uZoneIntensities[ zoneBand ];
		#endif
		vec3 rampColor = texture2D( tRamp, vec2( clamp( rampU, 0.004, 0.996 ), rampV ) ).rgb * rampScale;
		color *= mix( vec3( 1.0 ), rampColor, rampRate );
	#endif

	float smoothness = 1.0; // for the toon highlight's mask (H3, H10)
	#ifdef PBR
		// Metal and environment reflections (add-pbr-metal D2, D4). Metal and roughness per texel from the PBR mask alone (H10: R is
		// roughness, G is metal; H14: the map decides, scaled by the map scales) or from the scalars on simple materials.
		float metal = uMetallic;
		float rough = uRoughness;
		#ifdef HAS_PBR
			vec4 pbrMask = texture2D( tPBR, vUv0 );
			#ifdef PBR_R_METAL
				metal = clamp( uMetalScale * pbrMask.r, 0.0, 1.0 ); // the reading first planned, kept for comparison
				rough = uRoughScale * pbrMask.g;
			#else
				metal = clamp( uMetalScale * pbrMask.g, 0.0, 1.0 );
				rough = uRoughScale * pbrMask.r;
			#endif
		#endif
		rough = clamp( rough, 0.04, 1.0 );
		smoothness = 1.0 - rough;
		float NdotV = max( dot( N, V ), 1e-4 );
		vec3 F0 = mix( vec3( 0.04 ), albedo, metal );
		vec3 fresnel = F0 + ( max( vec3( 1.0 - rough ), F0 ) - F0 ) * pow( 1.0 - NdotV, 5.0 );
		vec3 reflectWorld = inverseTransformDirection( reflect( - V, N ), viewMatrix );
		// The studio is bright on every side; squaring it gives metal the dark bands it shows on huaxu and in game.
		vec3 envColor = pow( textureCubeUV( envMap, reflectWorld, rough ).rgb, vec3( uEnvContrast ) );
		vec3 reflection = envColor * fresnel * uCubeIntensity * uCubeColor * uEnvStrength * mix( uReflectShadow, 1.0, lit );
		// H18: a rough surface reflects less of the environment. Fully rough metal would otherwise show the studio's bright average
		// (its HDR lights), and dark matte metal (Solitary Dream's bodysuit, Stigmata's suit) read mid grey.
		reflection *= 1.0 - rough;
		vec3 pbrColor = color * ( 1.0 - metal ) + reflection * uLightColor;
		#ifdef PBR_FULL
			vec3 Hp = normalize( L + V );
			float NdotH = max( dot( N, Hp ), 0.0 );
			float a2 = pow( rough, 4.0 );
			float dd = NdotH * NdotH * ( a2 - 1.0 ) + 1.0;
			float ggx = a2 / ( PI * dd * dd );
			pbrColor += F0 * ggx * 0.25 * max( dot( N, L ), 0.0 ) * uPbrSpec * uPbrSpecColor * lit * uLightColor;
		#endif
		#ifdef HAS_PBR
			color = mix( color, pbrColor, uPbrRate * pbrMask.a ); // H11: the mask's A is where the PBR term applies
		#else
			color = mix( color, pbrColor, uPbrRate );
		#endif
	#elif defined( HAS_PBR )
		smoothness = texture2D( tPBR, vUv0 ).g; // no environment: the toon change's reading (H3)
	#endif

	#ifdef SPECULAR
		vec3 H = normalize( L + V );
		float nh = max( dot( N, H ), 0.0 );
		float s = 0.0;
		#if defined( HAIR_STRAND )
			s = pow( nh, uHairExponent ) * texture2D( tStrand, vUv0 ).r;
		#elif defined( HAIR_BITANGENT )
			#ifdef USE_TANGENT
				float th = dot( normalize( vToonBitangent ), H );
				s = pow( sqrt( max( 1.0 - th * th, 0.0 ) ), uHairExponent * 4.0 );
			#endif
		#elif !defined( HAIR_NONE )
			s = band( 0.5, uSpecSmooth, pow( nh, max( uSpecShininess, 1.0 ) * uSpecExponent ) );
		#endif
		#if defined( HAS_PBR )
			s *= smoothness; // H3 with H10: smoothness from the PBR mask
		#elif defined( HAS_MASK ) && !defined( HAIR_STRAND )
			s *= mask.r; // H3: without a PBR mask, the mask's R marks where highlights may appear
		#endif
		// The game's intensities (up to 9.4) assume its own exposure: saturate softly instead of adding them as they are.
		float strength = 1.0 - exp( - uSpecIntensity * uSpecScale );
		color += uSpecColor * strength * s * lit * uLightColor;
	#endif

	#ifdef RIM
		float fres = 1.0 - max( dot( N, V ), 0.0 );
		color += uRimColor * uRimIntensity * band( 0.5 * ( uRimMin + uRimMax ), 0.5 * abs( uRimMax - uRimMin ), fres ) * lit * uLightColor;
	#endif

	#ifdef HAS_DETAIL
		// Albedo detail on the second UV set (the thorn tattoos of the EX body), laid over by its alpha and shaded the same way.
		vec4 detail = texture2D( tDetail, vUv1 );
		color = mix( color, detail.rgb * tint * uLightColor, detail.a );
	#endif

	#ifdef HAS_FACEMAP
		// The chibi's face (brows, eyes, mouth) laid over the shaded skin by its alpha, shaded like the skin under it.
		vec4 faceMap = texture2D( tFace, vUv1 );
		color = mix( color, faceMap.rgb * tint * uLightColor, faceMap.a );
	#endif

	#ifdef EMISSION
		// H12: the mask's A marks the emissive texels, lit in the base colour times _EmissionColor and _EmissionIntensity,
		// independent of the light and the bands.
		color += albedo * uEmission * mask.a;
	#endif

	gl_FragColor = vec4( color, alpha );

	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <premultiplied_alpha_fragment>
}
`

export const outlineVertex = /* glsl */ `
#include <common>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>

attribute vec4 _pgrcolor;
attribute vec3 _pgrsmoothnormal;

uniform float uWidth;       // _XCharOutlineWidth
uniform float uOutlinePx;   // pixels per width unit (shared)
uniform float uPixelScale;  // view-space size of one pixel at distance 1 (shared)
uniform vec4 uMainST;

varying vec2 vUvMain;

void main() {
	vUvMain = uv * uMainST.xy + uMainST.zw;

	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>

	// The model's own smooth normal is stored in tangent space (D8).
	vec3 n = normalize( objectNormal );
	#ifdef USE_TANGENT
		vec3 t = objectTangent - n * dot( n, objectTangent );
		vec3 dir = n;
		if ( dot( t, t ) > 1e-8 ) {
			t = normalize( t );
			vec3 b = cross( n, t ) * tangent.w;
			vec3 d = t * _pgrsmoothnormal.x + b * _pgrsmoothnormal.y + n * _pgrsmoothnormal.z;
			if ( dot( d, d ) > 1e-8 ) dir = normalize( d );
		}
	#else
		vec3 dir = n;
	#endif

	vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
	vec3 nView = normalize( normalMatrix * dir );
	// About constant on screen: the push grows with the distance from the camera (H4: vertex colour A scales the width).
	mvPosition.xyz += nView * uWidth * _pgrcolor.a * uOutlinePx * uPixelScale * max( - mvPosition.z, 0.0 );
	gl_Position = projectionMatrix * mvPosition;
}
`

export const outlineFragment = /* glsl */ `
#include <common>

uniform vec3 uColor;
#ifdef HAS_MAIN
	uniform sampler2D tMain;
#endif
#ifdef ALPHA_CLIP
	uniform float uCutoff;
#endif

varying vec2 vUvMain;

void main() {
	vec3 color = uColor;
	#ifdef HAS_MAIN
		vec4 base = texture2D( tMain, vUvMain );
		#ifdef ALPHA_CLIP
			if ( base.a < uCutoff ) discard;
		#endif
		// H7: the outline takes a darker shade of what it outlines (the game's outline colours are about 0.3).
		color *= base.rgb * 2.0;
	#endif
	gl_FragColor = vec4( color, 1.0 );
	#include <colorspace_fragment>
}
`
