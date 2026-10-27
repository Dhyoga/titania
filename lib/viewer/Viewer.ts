// Framework-free three.js viewer for one model in a container element. No Vue imports.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader, type GLTFParser } from 'three/addons/loaders/GLTFLoader.js'
import type { Clip } from '../anim/clip'
import { rigFromGltf, type Rig } from '../anim/rig'
import type { VoiceTimeline } from '../voice/timeline'
import { fromCameraView, sameCameraView, toCameraView, type CameraView, type ViewBasis } from './cameraView'
import { ClipCache } from './ClipCache'
import type { TimelineClock } from './clock'
import { disposeObject3D } from './dispose'
import { FOLLOW_BONES, followFraction, nearestAnchor } from './follow'
import { computeFraming, type Bounds } from './framing'
import { DEFAULT_LIGHTING, type Lighting } from './lighting'
import { hiddenNodeSet, lightFormChoices, listMeshes, type Mesh, type MeshOverride } from './parts'
import { Playback, type PlaybackState } from './Playback'
import { collectTextures, estimateTextureBytes, type ViewerStats } from './stats'
import { toAnimationClip } from './threeClip'
import { loadToonSources, ToonModel, type ToonCounts, type ToonSources } from './toon/applyToon'
import { createSharedUniforms, TOON_DEFAULTS } from './toon/ToonMaterial'

export interface LoadOptions {
  /** glTF node indices to hide (alternate-state duplicate meshes). */
  hiddenNodes: number[]
  /** Called with a 0..1 fraction, or null when the total size is unknown. */
  onProgress?: (fraction: number | null) => void
  signal?: AbortSignal
  /** Keep a camera the user has moved (switching skins); the zoom limits still follow the new model. */
  keepCamera?: boolean
  /** Start in the model's Light form (`lightFormChoices`): the default per-mesh choices, under the user's own. */
  lightForm?: boolean
  /** Share of the bounds' half-width the default framing's width limit uses (`skinWidthShare`); 1 when omitted. */
  widthShare?: number
  /** The user's saved default camera (`setCameraView`), used instead of the built-in default framing; none when omitted. */
  cameraView?: CameraView | null
  /**
   * Keep the loaded model invisible until its first clip starts (or the bind pose is asked for), or `REVEAL_HOLD_MS` after the load, so
   * that a panel which is about to play a clip never shows the model's bind pose first. Hidden after the bounds are measured.
   */
  holdReveal?: boolean
}

export interface PlayClipOptions {
  /** glTF node index of the clip's root (the manifest's `rootNode`). */
  rootNode: number
  loop: boolean
  /** glTF node indices hidden while this clip plays. */
  hiddenNodes: number[]
  /** Play with a voice line: the clock owns the time, and the idle clip fills a timeline longer than the clip. */
  voice?: VoiceOptions
}

/** The stage background as the screenshot paints it (the page shows it with CSS). */
export type StageBackground = { type: 'gradient'; top: string; bottom: string } | { type: 'solid'; color: string }

export { DEFAULT_LIGHTING, type Lighting }

export interface VoiceOutput {
  volume: number
  muted: boolean
}

export interface VoiceOptions {
  /** Handed over to the viewer, which starts it and disposes it when the clip is left. */
  clock: TimelineClock
  timeline: VoiceTimeline
  /** The idle clip (cached with `cacheClip`) and the nodes hidden while it shows. */
  idle: { key: string; hiddenNodes: number[] }
}

const FOV_DEG = 24
const MAX_PIXEL_RATIO = 2
// Clips are keyed at 30 fps, so rendering faster than that while animating only costs GPU time. The threshold sits
// a little under 1/30 s so display refresh rates that are not multiples of 30 (or a late frame) do not skip a frame.
const MIN_FRAME_MS = 30
// Longest time step handed to the mixer; a hidden tab or a stall must not make the clip jump.
const MAX_STEP_S = 0.1
// Time updates to listeners while playing (changes of state are reported at once).
const STATE_INTERVAL_MS = 66
/** How long a model loaded with `holdReveal` stays invisible when no clip starts. */
const REVEAL_HOLD_MS = 1500
// Light levels at intensity 1, and where the directional light sits (height, distance from the vertical axis).
const HEMISPHERE_INTENSITY = 1.6
const DIRECTIONAL_INTENSITY = 2.2
const KEY_HEIGHT = 4
const KEY_DISTANCE = 5.4
// Auto-rotate: OrbitControls speed 2 is a full turn in 30 s.
const AUTO_ROTATE_SPEED = 2
// Floor grid: 0.25 m cells, at least this wide.
const GRID_CELL = 0.25
const GRID_MIN_SIZE = 2
// Decoded key data of built clips kept for reuse (a Board action is 3 to 6 MiB).
const CLIP_CACHE_BYTES = 64 * 1024 * 1024
// After a user camera move, follow picks its part again once the controls' damping has settled (about 0.3 s at factor 0.12).
const FOLLOW_SETTLE_MS = 350
// Clips play in place: the root node's position track is left out (see AGENTS.md, data contracts).
const IN_PLACE = true
// The exported models face -Z; the wrapper turns them to face the default camera on +Z.
const FACING_YAW = Math.PI
// Self-shadow of the character (toon shading, design D13): map size, how much larger than the model's bounding sphere the
// shadow box is (Board actions reach outside the bind pose), and the biases against acne on the face.
const SHADOW_MAP_SIZE = 2048
const SHADOW_PAD = 1.35
const SHADOW_BIAS = -0.0004
const SHADOW_NORMAL_BIAS = 0.012
const SHADOW_RADIUS = 2.5
// Colour of the toon key light at intensity 1 (the lit side shows the texture as the game does).
const TOON_LIGHT = new THREE.Color(1, 1, 1)
// The toon look is tone mapped like the game's image (skin reads pale; exposure in TOON_DEFAULTS); the original materials are not (H9).
const TOON_TONE_MAPPING = THREE.ACESFilmicToneMapping

interface CachedClip {
  animation: THREE.AnimationClip
}

export class Viewer {
  private readonly container: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.1, 100)
  private readonly controls: OrbitControls
  private readonly wrapper = new THREE.Group()
  private readonly observer: ResizeObserver
  private readonly loader = new GLTFLoader()

  private model: THREE.Object3D | null = null
  /** Object of every glTF node of the model, by node index. */
  private nodes: THREE.Object3D[] = []
  /** Listed meshes of the loaded model; empty for a single-mesh model. */
  private meshes: Mesh[] = []
  /** glTF JSON of the loaded model and the rig read from it on first use (retargeting clips of other frames onto it). */
  private gltfJson: unknown = null
  private rig: Rig | null = null
  /** The user's show/hide choices by node name. Belongs to the viewer, not the model: it survives `loadModel` (skin switches). */
  private overrides: Record<string, MeshOverride> = {}
  /** The loaded model's default choices (its Light form, when the skin asks for it); the user's choices win over them. */
  private meshDefaults: Record<string, MeshOverride> = {}
  /** The manifest's hidden list for the current state; the user's choices are applied on top of it. */
  private manifestHidden: number[] = []
  private readonly stateHiddenListeners = new Set<(hidden: number[]) => void>()
  private playback: Playback | null = null
  private readonly hemisphere = new THREE.HemisphereLight(0xffffff, 0x9aa4b4, HEMISPHERE_INTENSITY)
  private readonly keyLight = new THREE.DirectionalLight(0xffffff, DIRECTIONAL_INTENSITY)
  private lighting: Lighting = { ...DEFAULT_LIGHTING }
  private grid: THREE.GridHelper | null = null
  private gridOn = false
  private wireframeOn = false
  /** Toon shading asked for (kept across model loads), the shown model's toon resources, and the uniforms they share. */
  private toonOn = true
  private toon: ToonModel | null = null
  private readonly toonUniforms = createSharedUniforms()
  /** The environment PBR toon materials reflect: built once, on first need, kept across models (add-pbr-metal D3). */
  private environment: THREE.WebGLRenderTarget | null = null
  private autoRotate = false
  /** The model is hidden until its first clip starts (`LoadOptions.holdReveal`), and the timer that shows it anyway. */
  private holdingReveal = false
  private revealTimer: ReturnType<typeof setTimeout> | null = null
  /** The user is dragging the camera (auto-rotate waits). */
  private dragging = false
  /** Orbit, zoom and pan input is ignored (Display mode's locked camera); the camera still follows, refits and resets. */
  private inputLocked = false
  /** rAF time of the last auto-rotate step, or null when not rotating. */
  private lastRotate: number | null = null
  /**
   * Follow the animation (design D2–D4 of `improve-camera-close-ups`): the bones that may be followed (`FOLLOW_BONES`, null where the
   * model lacks one), the one followed now with the target's offset from it, and when to pick again after a user move (once the
   * controls' damping has settled).
   */
  private follow = false
  private followBones: (THREE.Object3D | null)[] = []
  private followAnchor: THREE.Object3D | null = null
  private readonly followOffset = new THREE.Vector3()
  private followRelockAt: number | null = null
  /** World position of each `followBones` entry when the model was loaded (its rest pose), to tell how far a clip has moved it. */
  private followRest: (THREE.Vector3 | null)[] = []
  private speed = 1
  private voiceOutput: VoiceOutput = { volume: 1, muted: false }
  /** Set while the current clip plays with a voice line. */
  private voice: (VoiceOptions & { clipHiddenNodes: number[]; segment: 'clip' | 'idle' }) | null = null
  private readonly clipCache = new ClipCache<CachedClip>({
    budgetBytes: CLIP_CACHE_BYTES,
    isProtected: (key) => this.playback?.state().key === key || this.voice?.idle.key === key,
    onEvict: (_key, entry) => this.playback?.release(entry.animation),
  })
  private readonly stateListeners = new Set<(state: PlaybackState) => void>()
  private bounds: THREE.Box3 | null = null
  private userMoved = false
  /** The user's saved default camera, relative to the default framing; null for the built-in default. */
  private savedView: CameraView | null = null
  /** Share of the bounds' width the default framing's width limit uses (`LoadOptions.widthShare`). */
  private widthShare = 1
  private raf = 0
  private dirty = false
  /** rAF time of the last mixer step while animating, or null when not animating. */
  private lastStep: number | null = null
  private lastStateEmit = 0
  private disposed = false
  private loadToken = 0
  private loadAbort: AbortController | null = null
  private contextLostHandler: (() => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setClearColor(0x000000, 0) // transparent: the stage card's gradient shows through
    // Only the key light casts, and only while toon shading is on (`applyShadow`); with no casting light nothing changes.
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    const canvas = this.renderer.domElement
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    container.appendChild(canvas)
    canvas.addEventListener('webglcontextlost', this.handleContextLost)

    this.wrapper.rotation.y = FACING_YAW
    this.scene.add(this.wrapper)
    this.scene.add(this.hemisphere)
    this.scene.add(this.keyLight)
    this.scene.add(this.keyLight.target) // the shadow box follows the model, so the target moves
    const shadow = this.keyLight.shadow
    shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
    shadow.bias = SHADOW_BIAS
    shadow.normalBias = SHADOW_NORMAL_BIAS
    shadow.radius = SHADOW_RADIUS
    this.applyLighting()

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.12
    this.controls.screenSpacePanning = true
    // Wheel and pinch zoom towards the point under the pointer (a face close-up without panning first), about twice as fast per
    // wheel notch as three's default: from the full-body framing to the closest distance in about 30 notches.
    this.controls.zoomToCursor = true
    this.controls.zoomSpeed = 2
    this.controls.maxPolarAngle = Math.PI / 2 // never below the target height, so never below the floor
    this.updateControls() // off until a model is shown
    this.controls.addEventListener('change', () => this.requestRender())
    this.controls.addEventListener('start', () => {
      this.userMoved = true
      this.dragging = true
    })
    this.controls.addEventListener('end', () => {
      this.dragging = false
      // Follow the part nearest to where the user left the camera, once the damping tail of the move has played out.
      if (this.follow) this.followRelockAt = performance.now() + FOLLOW_SETTLE_MS
    })
    this.controls.autoRotateSpeed = AUTO_ROTATE_SPEED // `autoRotate` itself is switched per step (see `tick`)

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(container)
    this.resize()
  }

  /** Called once if the WebGL context is lost; the viewer is unusable afterwards. */
  onContextLost(handler: () => void): void {
    this.contextLostHandler = handler
  }

  /** Replace the shown model. Disposes the previous one first. Rejects if aborted, replaced or failed. */
  async loadModel(url: string, options: LoadOptions): Promise<void> {
    this.assertAlive()
    this.loadAbort?.abort()
    const abort = new AbortController()
    this.loadAbort = abort
    options.signal?.addEventListener('abort', () => abort.abort(), { once: true })
    const token = ++this.loadToken

    this.disposeModel()
    this.updateControls()

    const gltf = await new Promise<Awaited<ReturnType<GLTFLoader['loadAsync']>>>((resolve, reject) => {
      this.loader.load(
        url,
        resolve,
        (event) => options.onProgress?.(event.lengthComputable && event.total > 0 ? event.loaded / event.total : null),
        (err) => reject(new Error(`Could not load ${url} (${err instanceof Error ? err.message : String(err)})`)),
      )
    })

    const stale = () => this.disposed || abort.signal.aborted || token !== this.loadToken
    if (stale()) {
      disposeObject3D(gltf.scene)
      throw new DOMException('Model load was replaced or cancelled', 'AbortError')
    }

    let nodes: THREE.Object3D[]
    let toonSources: ToonSources | null = null
    try {
      nodes = await resolveNodes(gltf.parser)
      for (const index of options.hiddenNodes) {
        if (!nodes[index]) throw new Error(`Hidden node ${index} does not exist in ${url}`)
      }
      // The toon textures load before the model is shown, so a toon-on viewer never shows a frame of glTF materials.
      try {
        toonSources = await loadToonSources(gltf.parser)
      } catch (err) {
        console.warn(`Toon shading unavailable for ${url}; showing the original materials`, err)
      }
    } catch (err) {
      disposeObject3D(gltf.scene)
      throw err
    }
    if (stale()) {
      disposeObject3D(gltf.scene)
      throw new DOMException('Model load was replaced or cancelled', 'AbortError')
    }

    this.nodes = nodes
    this.meshes = listMeshes(meshRefs(gltf.parser))
    this.gltfJson = gltf.parser.json
    this.meshDefaults = options.lightForm ? lightFormChoices(this.gltfJson, this.meshes) : {}
    this.widthShare = options.widthShare ?? 1
    this.savedView = options.cameraView ?? null
    applyHiddenNodes(nodes, new Set(options.hiddenNodes)) // the manifest's list only: the framing below must not depend on the user's choices
    this.model = gltf.scene
    this.playback = new Playback(gltf.scene)
    this.playback.setSpeed(this.speed)
    this.playback.onChange(this.handlePlaybackChange)
    this.wrapper.add(gltf.scene)
    // A skinned mesh is culled by a bounding sphere three computes once, from its first pose, and never moves with the clip (the
    // eyes' sphere sits up to 26 cm from the eyes in a Board action), so close-ups lost the eyes and the face. The model fills the
    // view in nearly every framing, so it is always drawn; outlines copy the flag when the toon set is built below.
    gltf.scene.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) object.frustumCulled = false
    })
    this.bounds = this.measureBounds()
    this.applyVisibility(options.hiddenNodes)
    this.buildToon(gltf.parser, nodes, toonSources)
    this.buildGrid()
    this.applyWireframe()
    this.applyShadow()
    const keep = options.keepCamera === true && this.userMoved
    if (!keep) this.userMoved = false
    this.updateControls()
    // The followed bones' rest positions come first: a saved view is placed relative to the bone's displacement from them.
    this.followBones = FOLLOW_BONES.map((name) => nodes.find((node) => node.name === name) ?? null)
    this.followRest = this.followBones.map((bone) => (bone ? bone.getWorldPosition(new THREE.Vector3()) : null))
    this.followAnchor = null
    this.applyFraming(!keep)
    this.lockFollow()
    this.clearRevealTimer()
    this.holdingReveal = options.holdReveal === true
    if (this.holdingReveal) {
      gltf.scene.visible = false // after `measureBounds` and the toon set: both walk the visible objects
      this.revealTimer = setTimeout(() => this.reveal(), REVEAL_HOLD_MS)
    }
    this.requestRender()
  }

  /** Default framing again, or the saved default camera (also forgets that the user moved the camera). */
  resetCamera(): void {
    this.userMoved = false
    this.applyFraming(true)
    this.lockFollow()
    this.requestRender()
  }

  /**
   * The camera as it is now, relative to the default framing of the shown model (`cameraView.ts`), or null before a model. With
   * follow on the target is taken where it is heading (the followed bone plus the offset kept from it: it trails the bone by up to
   * a fraction of a second while the clip moves, and the camera by the same amount), and the bone's displacement from its rest
   * position is left out, so the view does not depend on the clip's moment.
   */
  getCameraView(): CameraView | null {
    const basis = this.viewBasis()
    if (!basis) return null
    const target = this.controls.target.clone()
    const position = this.camera.position.clone()
    if (this.follow && this.followAnchor) {
      if (this.followRelockAt !== null) {
        this.followRelockAt = null // the user has just moved the camera: keep what they set, not the offset from before
        this.lockFollow()
      }
      const anchor = this.followAnchor
      const rest = anchor ? this.followRest[this.followBones.indexOf(anchor)] : null
      if (anchor && rest) {
        const heading = anchor.getWorldPosition(new THREE.Vector3()).add(this.followOffset)
        const trail = heading.clone().sub(target)
        const away = this.followDisplacement()
        target.add(trail).sub(away)
        position.add(trail).sub(away)
      }
    }
    return toCameraView({ target, position }, basis)
  }

  /**
   * Set the saved default camera, which replaces the default framing on load, on resize of an unmoved camera and on `resetCamera`;
   * null returns to the built-in default. A view that is already set changes nothing (a skin switch keeps a moved camera); a
   * different one is shown at once.
   */
  setCameraView(view: CameraView | null): void {
    if (sameCameraView(view, this.savedView)) return
    this.savedView = view
    if (!this.model) return
    this.userMoved = false
    this.applyFraming(true)
    this.lockFollow()
    this.requestRender()
  }

  /** How far the followed bone is from its rest position; zero when not following. */
  private followDisplacement(): THREE.Vector3 {
    const away = new THREE.Vector3()
    if (!this.follow || !this.followAnchor) return away
    const rest = this.followRest[this.followBones.indexOf(this.followAnchor)]
    return rest ? this.followAnchor.getWorldPosition(away).sub(rest) : away
  }

  /** Render a frame on the next animation frame. */
  requestRender(): void {
    this.dirty = true
    if (!this.raf && !this.disposed) this.raf = requestAnimationFrame(this.tick)
  }

  /** Show the mesh nodes not listed in `indices` (glTF node indices of the model), except the parts the user hid. */
  setHiddenNodes(indices: number[]): void {
    this.applyVisibility(indices)
    this.requestRender()
  }

  /** The loaded model's skeleton (names, parents, rest pose, morph target names); null before a model. */
  getRig(): Rig | null {
    if (!this.rig && this.gltfJson) this.rig = rigFromGltf(this.gltfJson)
    return this.rig
  }

  /** The loaded model's listed meshes; empty before a model and for a single-mesh model. */
  getMeshes(): Mesh[] {
    return this.meshes
  }

  /** The loaded model's default choices by node name (empty unless it was loaded in its Light form). */
  getMeshDefaults(): Readonly<Record<string, MeshOverride>> {
    return this.meshDefaults
  }

  /**
   * The user's show/hide choices by node name, applied on top of the manifest's lists and the model's defaults: `hide` hides a mesh in every state,
   * `show` shows one the manifest hides. Kept for later models: a name the shown model lacks is ignored now and applies to the
   * next one that has it.
   */
  setMeshOverrides(overrides: Readonly<Record<string, MeshOverride>>): void {
    this.overrides = { ...overrides }
    this.applyVisibility(this.manifestHidden)
    this.requestRender()
  }

  /** The manifest's hidden node list for the current state (it changes with the clip). */
  getStateHidden(): number[] {
    return this.manifestHidden
  }

  /** Listen for changes of that list. Returns an unsubscribe. */
  onStateHidden(listener: (hidden: number[]) => void): () => void {
    this.stateHiddenListeners.add(listener)
    return () => this.stateHiddenListeners.delete(listener)
  }

  /** Whether a clip of this key is built and cached, so `playCachedClip` works without fetching it. */
  hasClip(key: string): boolean {
    return this.clipCache.has(key)
  }

  /** Build `clip`, cache it under `key`, and play it from 0 with a crossfade from the current clip. */
  playClip(key: string, clip: Clip, options: PlayClipOptions): void {
    const playback = this.requirePlayback(options.voice)
    const built = toAnimationClip(clip, this.nodes, { rootNode: options.rootNode, inPlace: IN_PLACE })
    if (built.skipped > 0) console.warn(`Clip ${clip.name}: ${built.skipped} tracks skipped (node or morph target missing)`)
    // The clip being replaced under the same key is not the playing one by uuid, so it is released by the cache.
    this.clipCache.set(key, { animation: built.clip }, built.bytes)
    this.start(playback, key, built.clip, options)
  }

  /** Build and cache a clip without playing it (the idle clip of a voice timeline). */
  cacheClip(key: string, clip: Clip, options: { rootNode: number }): void {
    this.requirePlayback()
    const built = toAnimationClip(clip, this.nodes, { rootNode: options.rootNode, inPlace: IN_PLACE })
    if (built.skipped > 0) console.warn(`Clip ${clip.name}: ${built.skipped} tracks skipped (node or morph target missing)`)
    this.clipCache.set(key, { animation: built.clip }, built.bytes)
  }

  /** Play a clip that `hasClip` reported as cached. */
  playCachedClip(key: string, options: PlayClipOptions): void {
    const playback = this.requirePlayback(options.voice)
    const entry = this.clipCache.get(key)
    if (!entry) {
      options.voice?.clock.dispose()
      throw new Error(`Clip ${key} is not cached`)
    }
    this.start(playback, key, entry.animation, options)
  }

  /** Back to the model's own pose, showing the nodes not in `hiddenNodes`. */
  bindPose(hiddenNodes: number[]): void {
    const playback = this.requirePlayback()
    this.detachVoice()
    playback.bindPose()
    this.reveal() // the bind pose was asked for: show it
    this.stepFollow(Infinity, performance.now()) // the pose jumped: no frames to ease over
    this.setHiddenNodes(hiddenNodes)
    this.requestRender()
  }

  setPaused(paused: boolean): void {
    const playback = this.requirePlayback()
    const voice = this.voice
    if (voice) {
      if (paused) voice.clock.pause()
      else voice.clock.play()
      this.poseVoice(playback, voice) // stop exactly at the clock's time
      playback.update(0)
    } else {
      playback.setPaused(paused)
    }
    this.requestRender()
  }

  setLoop(loop: boolean): void {
    const playback = this.requirePlayback()
    if (this.voice) this.voice.clock.setLoop(loop)
    else playback.setLoop(loop)
  }

  /** Show the pose at `seconds` of the current clip (of the voice timeline when there is one). */
  seek(seconds: number): void {
    const playback = this.requirePlayback()
    const voice = this.voice
    if (voice) {
      voice.clock.seek(seconds)
      playback.settleDriven()
      this.poseVoice(playback, voice)
      playback.update(0)
    } else {
      playback.seek(seconds)
    }
    this.stepFollow(Infinity, performance.now()) // the pose jumped: no frames to ease over
    this.requestRender()
  }

  getPlaybackState(): PlaybackState {
    const voice = this.voice
    const state = this.playback?.state() ?? { ...IDLE_STATE }
    if (!voice) return state
    const { clock } = voice
    return { key: state.key, time: clock.time(), duration: clock.duration, playing: clock.playing, loop: clock.loop, finished: clock.finished, loops: 0 }
  }

  /** Listen for playback state: discrete changes at once, the time of a playing clip at about 15 Hz. Returns an unsubscribe. */
  onPlaybackState(listener: (state: PlaybackState) => void): () => void {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }

  /** Stage lighting: level and direction (see `Lighting`). */
  setLighting(lighting: Lighting): void {
    if (!Number.isFinite(lighting.intensity) || !Number.isFinite(lighting.azimuthDeg)) return
    this.lighting = { ...lighting }
    this.applyLighting()
    this.requestRender()
  }

  resetLighting(): void {
    this.setLighting(DEFAULT_LIGHTING)
  }

  getLighting(): Lighting & { hemisphereIntensity: number; directionalIntensity: number } {
    return { ...this.lighting, hemisphereIntensity: this.hemisphere.intensity, directionalIntensity: this.keyLight.intensity }
  }

  setGrid(on: boolean): void {
    this.gridOn = on
    if (this.grid) this.grid.visible = on
    this.requestRender()
  }

  setWireframe(on: boolean): void {
    this.wireframeOn = on
    this.applyWireframe()
    this.requestRender()
  }

  /**
   * Toon shading (the default) or the GLB's own materials. Kept across model loads; switching needs no reload. Outlines and the
   * self-shadow follow it.
   */
  setToon(on: boolean): void {
    this.toonOn = on
    this.toon?.setOn(on)
    this.applyShadow()
    this.requestRender()
  }

  /**
   * Ignore the user's orbit, zoom and pan input (true) or take it again. Follow, the refit on resize and `resetCamera` still move the
   * camera; auto-rotate does not run while locked.
   */
  setInputLocked(locked: boolean): void {
    this.inputLocked = locked
    this.dragging = false
    this.updateControls()
    this.requestRender()
  }

  /** The controls take input only with a model shown and the input not locked; `stepControls` reads the same flag for auto-rotate. */
  private updateControls(): void {
    this.controls.enabled = this.model !== null && !this.inputLocked
  }

  /** Orbit the camera once in about 30 s (at the 30 fps cap), pausing while the user drags. */
  setAutoRotate(on: boolean): void {
    this.autoRotate = on
    this.lastRotate = null
    if (on) this.requestRender()
  }

  /**
   * Keep the camera on the body part it looks at while the clip moves (the head in a face close-up, the pelvis in a full-body
   * view), moving the orbit target and the camera together. Off leaves the camera where it is.
   */
  setFollow(on: boolean): void {
    this.follow = on
    this.followRelockAt = null
    this.lockFollow()
  }

  /** What `setGrid`, `setWireframe` and `setAutoRotate` currently ask for (for checks). */
  getDisplayState(): { grid: boolean; gridInScene: boolean; wireframe: boolean; autoRotate: boolean; toon: boolean; toonBuilt: ToonCounts | null; selfShadow: boolean } {
    return {
      grid: this.gridOn,
      gridInScene: this.grid?.visible ?? false,
      wireframe: this.wireframeOn,
      autoRotate: this.autoRotate,
      toon: this.toonOn,
      toonBuilt: this.toon?.counts() ?? null,
      selfShadow: this.keyLight.castShadow,
    }
  }

  /** PNG of the stage as shown: one frame with the current pose and camera over `background`. Always opaque. */
  screenshot(options: { background: StageBackground }): Promise<Blob> {
    this.assertAlive()
    // Render and copy in one task: the drawing buffer is only guaranteed to hold the frame until the task ends,
    // so `preserveDrawingBuffer` is not needed.
    this.render()
    const source = this.renderer.domElement
    const out = document.createElement('canvas')
    out.width = source.width
    out.height = source.height
    const ctx = out.getContext('2d')
    if (!ctx) return Promise.reject(new Error('Could not create a 2D canvas for the screenshot'))
    const { background } = options
    if (background.type === 'solid') {
      ctx.fillStyle = background.color
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, out.height)
      gradient.addColorStop(0, background.top)
      gradient.addColorStop(1, background.bottom)
      ctx.fillStyle = gradient
    }
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(source, 0, 0)
    return new Promise((resolve, reject) => out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png'))
  }

  /** Speed multiplier (1 = real time) of clips and voice lines, now and for every clip started later. */
  setSpeed(rate: number): void {
    if (!(rate > 0) || !Number.isFinite(rate)) return
    this.speed = rate
    this.playback?.setSpeed(rate)
    this.voice?.clock.setRate(rate)
  }

  /** Voice volume (0 to 1) and mute for the line playing now and every later one. */
  setVoiceOutput(output: VoiceOutput): void {
    this.voiceOutput = { ...output }
    this.voice?.clock.setOutput(this.voiceOutput)
  }

  getStats(): ViewerStats {
    const { memory, render } = this.renderer.info
    const textures = this.model ? collectTextures(this.model) : new Set<THREE.Texture>()
    for (const texture of this.toon?.textures() ?? []) textures.add(texture) // toon textures live in uniforms; both sets count
    return {
      geometries: memory.geometries,
      textures: memory.textures,
      calls: render.calls,
      triangles: render.triangles,
      frames: render.frame,
      modelTextures: textures.size,
      textureBytes: estimateTextureBytes(textures),
      cachedClips: this.clipCache.size,
      cachedClipBytes: this.clipCache.bytes,
      programs: this.renderer.info.programs?.length ?? 0,
    }
  }

  /** Bounds of the visible model parts in world space (after the facing rotation), or null before a model is shown. */
  getBounds(): Bounds | null {
    if (!this.bounds) return null
    const { min, max } = this.bounds
    return { min: { x: min.x, y: min.y, z: min.z }, max: { x: max.x, y: max.y, z: max.z } }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.loadAbort?.abort()
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    this.observer.disconnect()
    const canvas = this.renderer.domElement
    canvas.removeEventListener('webglcontextlost', this.handleContextLost)
    this.controls.dispose()
    this.stateListeners.clear()
    this.stateHiddenListeners.clear()
    this.disposeModel()
    this.environment?.dispose()
    this.environment = null
    this.toonUniforms.envMap.value = null
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    canvas.remove()
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault()
    this.contextLostHandler?.()
  }

  /**
   * One animation frame. An idle viewer renders nothing. While a clip plays it steps the mixer and renders at most
   * every MIN_FRAME_MS; a camera move (or any other request) renders right away at the display rate.
   */
  private readonly tick = (now: number): void => {
    this.raf = 0
    if (this.disposed) return
    const rotating = this.stepControls(now)
    const playback = this.playback
    if (playback && this.isAnimating(playback)) {
      if (this.lastStep === null) this.lastStep = now // first frame of a run: no time has passed yet
      const elapsed = now - this.lastStep
      if (elapsed >= MIN_FRAME_MS) {
        this.lastStep = now
        if (this.voice) this.poseVoice(playback, this.voice) // the clip's time comes from the voice clock
        playback.update(Math.min(elapsed / 1000, MAX_STEP_S))
        this.stepFollow(elapsed / 1000, now)
        this.dirty = true
        if (now - this.lastStateEmit >= STATE_INTERVAL_MS) this.emitState(now)
      }
    } else {
      this.lastStep = null
    }
    if (this.dirty) {
      this.dirty = false
      this.render()
    }
    if (!this.raf && ((playback && this.isAnimating(playback)) || rotating)) this.raf = requestAnimationFrame(this.tick)
  }

  /** Pick the followed bone (the one nearest to the orbit target) and remember the target's offset from it; none when follow is off. */
  private lockFollow(): void {
    this.followAnchor = null
    if (!this.follow || !this.model) return
    const positions = this.followBones.map((bone) => (bone ? bone.getWorldPosition(new THREE.Vector3()) : null))
    const index = nearestAnchor(this.controls.target, positions)
    const anchor = index >= 0 ? this.followBones[index] : null
    if (!anchor) return
    this.followAnchor = anchor
    this.followOffset.copy(this.controls.target).sub(positions[index]!)
  }

  /**
   * Move the orbit target, and the camera by the same amount, towards the followed bone plus its offset: a part of the way by the
   * time passed (`followFraction`), all the way when the pose jumped (`dt` Infinity). Waits while the user moves the camera.
   */
  private stepFollow(dt: number, now: number): void {
    if (!this.follow || this.dragging) return
    if (this.followRelockAt !== null) {
      if (now < this.followRelockAt) return
      this.followRelockAt = null
      this.lockFollow()
    }
    const anchor = this.followAnchor
    if (!anchor) return
    const move = anchor.getWorldPosition(new THREE.Vector3()).add(this.followOffset).sub(this.controls.target)
    move.multiplyScalar(followFraction(dt))
    if (move.lengthSq() < 1e-12) return
    this.controls.target.add(move)
    this.camera.position.add(move)
    this.dirty = true
  }

  /**
   * Apply damping, and auto-rotate by the real elapsed time at most every MIN_FRAME_MS (OrbitControls would otherwise turn
   * on every display frame; while rotating, damping is applied at the same steps). Returns whether the camera is auto-rotating, which keeps the frames coming.
   * `controls.update()` dispatches 'change' (so a frame is rendered) whenever the camera moved.
   */
  private stepControls(now: number): boolean {
    const rotating = this.autoRotate && !this.dragging && this.controls.enabled
    if (!rotating) {
      this.lastRotate = null
      this.controls.autoRotate = false
      this.controls.update()
      return false
    }
    if (this.lastRotate === null) this.lastRotate = now
    const elapsed = now - this.lastRotate
    if (elapsed >= MIN_FRAME_MS) {
      this.lastRotate = now
      this.controls.autoRotate = true // for this one step
      this.controls.update(Math.min(elapsed / 1000, MAX_STEP_S))
      this.controls.autoRotate = false
    }
    // Between steps the controls are left alone: a damping update would move the camera a little on every display frame
    // and so render above the cap. The damping tail of a user drag is applied by the steps instead.
    return true
  }

  /** One frame. The toon uniforms that depend on the camera and the pose (light and head directions) are set first. */
  private render(): void {
    if (this.toon && this.toonOn) {
      this.scene.updateMatrixWorld()
      this.camera.updateMatrixWorld()
      const view = this.camera.matrixWorldInverse
      this.toonUniforms.uLightDir.value.copy(this.keyLight.position).sub(this.keyLight.target.position).normalize().transformDirection(view)
      this.toon.updateHead(this.camera)
    }
    // Programs are rebuilt by three when the tone mapping changes, so switching toon shading needs nothing else.
    const toned = this.toon !== null && this.toonOn
    this.renderer.toneMapping = toned ? TOON_TONE_MAPPING : THREE.NoToneMapping
    this.renderer.toneMappingExposure = toned ? TOON_DEFAULTS.exposure : 1
    this.renderer.render(this.scene, this.camera)
  }

  private applyLighting(): void {
    const { intensity, azimuthDeg } = this.lighting
    this.hemisphere.intensity = HEMISPHERE_INTENSITY * intensity
    this.keyLight.intensity = DIRECTIONAL_INTENSITY * intensity
    this.toonUniforms.uLightColor.value.copy(TOON_LIGHT).multiplyScalar(intensity)
    this.applyShadow()
  }

  /**
   * Place the key light along its direction from the model's centre, and fit its shadow box around the model (padded). It
   * casts only while toon shading is on and some toon mesh casts (design D13).
   */
  private applyShadow(): void {
    const azimuth = (this.lighting.azimuthDeg * Math.PI) / 180
    const direction = new THREE.Vector3(Math.sin(azimuth) * KEY_DISTANCE, KEY_HEIGHT, Math.cos(azimuth) * KEY_DISTANCE).normalize()
    const light = this.keyLight
    const sphere = this.bounds?.getBoundingSphere(new THREE.Sphere()) ?? new THREE.Sphere(new THREE.Vector3(), 1)
    const radius = sphere.radius * SHADOW_PAD
    light.target.position.copy(sphere.center)
    light.position.copy(sphere.center).addScaledVector(direction, radius * 3)
    light.target.updateMatrixWorld()
    light.updateMatrixWorld()
    const camera = light.shadow.camera
    camera.left = -radius
    camera.right = radius
    camera.top = radius
    camera.bottom = -radius
    camera.near = radius
    camera.far = radius * 5
    camera.updateProjectionMatrix()
    light.castShadow = this.toonOn && this.model !== null && (this.toon?.hasCasters() ?? false)
  }

  /** Toon resources of the model just loaded (none when its sources failed to load); shown at once when toon shading is on. */
  private buildToon(parser: GLTFParser, nodes: THREE.Object3D[], sources: ToonSources | null): void {
    if (!sources) return
    this.wrapper.updateMatrixWorld(true)
    if (sources.params.some((p) => p?.pbr)) this.ensureEnvironment()
    try {
      this.toon = new ToonModel(parser, nodes, sources, this.toonUniforms)
      this.toon.setOn(this.toonOn)
    } catch (err) {
      console.warn('Toon shading could not be built; showing the original materials', err)
      this.toon?.dispose()
      this.toon = null
    }
  }

  /**
   * A neutral studio (three's `RoomEnvironment`) prefiltered for roughness, shared by the toon materials through their `envMap`.
   * The GLBs reference no environment of their own. Only toon materials see it: `scene.environment` stays unset, so the original
   * materials are unchanged. Freed with the viewer.
   */
  private ensureEnvironment(): void {
    if (this.environment) return
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const room = new RoomEnvironment()
    try {
      this.environment = pmrem.fromScene(room, 0.04)
      this.toonUniforms.envMap.value = this.environment.texture
    } catch (err) {
      console.warn('Environment for reflections could not be built; metal stays toon only', err)
    } finally {
      room.dispose()
      pmrem.dispose()
    }
  }

  /** The floor grid under the model, sized from its bounds. It is in the scene, not the wrapper, so it does not turn with the model. */
  private buildGrid(): void {
    this.disposeGrid()
    const bounds = this.bounds
    if (!bounds) return
    const extent = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z)
    const size = Math.max(GRID_MIN_SIZE, Math.ceil((extent * 2) / GRID_CELL) * GRID_CELL)
    const grid = new THREE.GridHelper(size, Math.round(size / GRID_CELL), 0x6f7f99, 0x9aa8bd)
    grid.position.y = bounds.min.y + 0.001 // just above the feet, so the lines do not z-fight with the sole
    const materials = Array.isArray(grid.material) ? grid.material : [grid.material]
    for (const material of materials) {
      material.transparent = true
      material.opacity = 0.7
    }
    grid.visible = this.gridOn
    this.scene.add(grid)
    this.grid = grid
  }

  /**
   * The one place that sets node visibility: the manifest's hidden list for the current state with the model's default
   * choices and then the user's per-mesh choices on top.
   */
  private applyVisibility(manifestHidden: number[]): void {
    const changed = manifestHidden.length !== this.manifestHidden.length || manifestHidden.some((n, i) => n !== this.manifestHidden[i])
    this.manifestHidden = manifestHidden
    applyHiddenNodes(this.nodes, hiddenNodeSet(manifestHidden, this.meshes, { ...this.meshDefaults, ...this.overrides }))
    if (changed) for (const listener of this.stateHiddenListeners) listener(manifestHidden)
  }

  private disposeGrid(): void {
    const grid = this.grid
    if (!grid) return
    this.scene.remove(grid)
    grid.geometry.dispose()
    for (const material of Array.isArray(grid.material) ? grid.material : [grid.material]) material.dispose()
    this.grid = null
  }

  /** Draw the model as wireframe, or normally (both material sets when there is a toon set). */
  private applyWireframe(): void {
    this.toon?.setWireframe(this.wireframeOn)
    this.model?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if ('wireframe' in material) (material as THREE.MeshBasicMaterial).wireframe = this.wireframeOn
      }
    })
  }

  private isAnimating(playback: Playback): boolean {
    return playback.isAnimating() || (this.voice?.clock.playing ?? false)
  }

  /** Pose the driven clip at the clock's time; switch the hidden nodes when the timeline enters or leaves the idle tail. */
  private poseVoice(playback: Playback, voice: NonNullable<Viewer['voice']>): void {
    const sample = voice.timeline.sample(voice.clock.time())
    playback.pose(sample)
    if (sample.segment !== voice.segment) {
      voice.segment = sample.segment
      this.applyVisibility(sample.segment === 'idle' ? voice.idle.hiddenNodes : voice.clipHiddenNodes)
    }
  }

  /** Stop and release the voice clock (leaving a voiced clip stops its audio). */
  private detachVoice(): void {
    const voice = this.voice
    if (!voice) return
    this.voice = null
    voice.clock.onChange(null)
    voice.clock.dispose()
  }

  private start(playback: Playback, key: string, animation: THREE.AnimationClip, options: PlayClipOptions): void {
    this.detachVoice()
    this.applyVisibility(options.hiddenNodes)
    const voice = options.voice
    if (!voice) {
      playback.play(key, animation, { loop: options.loop }) // reports the change, which also asks for a frame
      this.revealWithPose(playback)
      this.requestRender()
      return
    }
    const idle = this.clipCache.get(voice.idle.key)
    if (!idle) {
      voice.clock.dispose()
      throw new Error(`Idle clip ${voice.idle.key} is not cached`)
    }
    this.voice = { ...voice, clipHiddenNodes: options.hiddenNodes, segment: 'clip' }
    voice.clock.setOutput(this.voiceOutput)
    voice.clock.setRate(this.speed)
    voice.clock.onChange(this.handlePlaybackChange)
    playback.playDriven(key, animation, idle.animation)
    if (this.holdingReveal) {
      // The first frame of a model that was kept hidden compiles its shaders and uploads its textures (0.6 to 2.2 s in software GL).
      // Render it now, before the line is started: the clock waits only 600 ms for the audio, and would give up during that frame.
      this.poseVoice(playback, this.voice)
      this.revealWithPose(playback)
      this.render()
    }
    voice.clock.play()
    this.poseVoice(playback, this.voice)
    this.requestRender()
  }

  /**
   * Show a model that `holdReveal` kept hidden, with the clip's first pose already applied: the render tick does not step the mixer on
   * the first frame of a run, so revealing without this would show one or two frames of the bind pose.
   */
  private revealWithPose(playback: Playback): void {
    if (!this.holdingReveal) return
    playback.update(0)
    this.reveal()
  }

  private reveal(): void {
    this.clearRevealTimer()
    this.holdingReveal = false
    if (this.model) this.model.visible = true
    this.requestRender()
  }

  private clearRevealTimer(): void {
    if (this.revealTimer !== null) clearTimeout(this.revealTimer)
    this.revealTimer = null
  }

  /** The playback of the loaded model. A voice clock handed in with the call is disposed if there is none to take it. */
  private requirePlayback(voice?: VoiceOptions): Playback {
    if (this.disposed || !this.playback) {
      voice?.clock.dispose()
      this.assertAlive()
      throw new Error('No model is loaded')
    }
    return this.playback
  }

  private readonly handlePlaybackChange = (): void => {
    this.emitState(performance.now())
    this.requestRender()
  }

  private emitState(now: number): void {
    this.lastStateEmit = now
    const state = this.getPlaybackState()
    for (const listener of this.stateListeners) listener(state)
  }

  private resize(): void {
    if (this.disposed) return
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (width < 1 || height < 1) return
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    // Outline width is in CSS pixels: the view-space size of one pixel at distance 1.
    this.toonUniforms.uPixelScale.value = (2 * Math.tan((FOV_DEG * Math.PI) / 360)) / height
    // A camera the user has not touched follows the new aspect; a moved one stays where it is.
    // While following, the target is where the followed bone has taken it: refit by distance only, or toggling Focus (which resizes
    // the canvas) would jump the view to the bind-pose target and glide back.
    if (this.model && !this.userMoved) this.applyFraming(true, this.follow && this.followAnchor !== null)
    this.requestRender()
  }

  private measureBounds(): THREE.Box3 {
    this.wrapper.updateMatrixWorld(true)
    const box = new THREE.Box3()
    const part = new THREE.Box3()
    this.wrapper.traverseVisible((object) => {
      if (!(object instanceof THREE.Mesh)) return
      if (object instanceof THREE.SkinnedMesh) object.computeBoundingBox() // includes the bind pose of the bones
      else object.geometry.computeBoundingBox()
      const local = object instanceof THREE.SkinnedMesh ? object.boundingBox : object.geometry.boundingBox
      if (!local) return
      part.copy(local).applyMatrix4(object.matrixWorld)
      box.union(part)
    })
    if (box.isEmpty()) throw new Error('Model has no visible meshes')
    return box
  }

  /** The default framing of the shown model at the canvas' current aspect. */
  private framing(bounds: THREE.Box3): ReturnType<typeof computeFraming> {
    return computeFraming(bounds, { fovDeg: FOV_DEG, aspect: this.camera.aspect, widthShare: this.widthShare })
  }

  private basisOf(framing: ReturnType<typeof computeFraming>, bounds: THREE.Box3): ViewBasis {
    return {
      target: framing.target,
      distance: framing.distance,
      minDistance: framing.minDistance,
      maxDistance: framing.maxDistance,
      height: bounds.max.y - bounds.min.y,
    }
  }

  /** What a saved view is relative to (the default framing of the shown model), or null before a model. */
  private viewBasis(): ViewBasis | null {
    return this.bounds ? this.basisOf(this.framing(this.bounds), this.bounds) : null
  }

  /** `keepTarget`: leave the orbit target and the viewing direction, and only set the distance (a resize while following). */
  private applyFraming(moveCamera: boolean, keepTarget = false): void {
    if (!this.bounds) return
    // The model's height fits the whole canvas; controls laid over the stage cover part of it and do not change the framing.
    const framing = this.framing(this.bounds)
    this.controls.minDistance = framing.minDistance
    this.controls.maxDistance = framing.maxDistance
    // Close enough for a face close-up without clipping the nose or the bangs in front of the target.
    this.camera.near = Math.max(0.01, framing.minDistance / 20)
    this.camera.far = framing.maxDistance * 4
    this.camera.updateProjectionMatrix()
    if (moveCamera) {
      const { target, distance } = framing
      // Damping keeps leftover inertia inside OrbitControls; with damping off, one update() flushes and clears it,
      // so the camera lands exactly on the default framing instead of drifting by the remainder.
      this.controls.enableDamping = false
      this.controls.update()
      if (keepTarget) {
        const direction = this.camera.position.clone().sub(this.controls.target).normalize()
        const length = this.savedView
          ? Math.min(Math.max(this.savedView.zoom * distance, framing.minDistance), framing.maxDistance)
          : distance
        this.camera.position.copy(this.controls.target).addScaledVector(direction, length)
      } else if (this.savedView) {
        // The saved view is relative to the default framing; with follow on it is also relative to where the followed bone is now.
        const pose = fromCameraView(this.savedView, this.basisOf(framing, this.bounds))
        const away = this.followDisplacement()
        this.controls.target.set(pose.target.x + away.x, pose.target.y + away.y, pose.target.z + away.z)
        this.camera.position.set(pose.position.x + away.x, pose.position.y + away.y, pose.position.z + away.z)
      } else {
        this.controls.target.set(target.x, target.y, target.z)
        this.camera.position.set(target.x, target.y, target.z + distance)
      }
      this.camera.lookAt(this.controls.target)
      this.controls.update()
      this.controls.enableDamping = true
    }
  }

  private disposeModel(): void {
    this.clearRevealTimer()
    this.holdingReveal = false
    const hadPlayback = this.playback !== null
    this.detachVoice()
    this.playback?.dispose()
    this.playback = null
    this.clipCache.clear()
    this.nodes = []
    this.meshes = []
    this.meshDefaults = {}
    this.gltfJson = null
    this.rig = null
    this.manifestHidden = []
    this.disposeGrid()
    this.lastStep = null
    if (hadPlayback) this.emitState(performance.now()) // listeners go back to "no clip"
    this.toon?.dispose() // puts the glTF materials back, so the model's own disposal below frees them
    this.toon = null
    if (this.model) {
      this.wrapper.remove(this.model)
      disposeObject3D(this.model)
    }
    this.model = null
    this.bounds = null
    this.keyLight.castShadow = false
  }

  private assertAlive(): void {
    if (this.disposed) throw new Error('Viewer is disposed')
  }
}

const IDLE_STATE: PlaybackState = { key: null, time: 0, duration: 0, playing: false, loop: true, finished: false, loops: 0 }

/** Object of every glTF node of a loaded model, by node index (the parser caches them, so this is cheap). */
function resolveNodes(parser: GLTFParser): Promise<THREE.Object3D[]> {
  const json = parser.json as { nodes?: unknown[] }
  return Promise.all((json.nodes ?? []).map((_, index) => parser.getDependency('node', index) as Promise<THREE.Object3D>))
}

/** The model's mesh nodes (index and name), straight from the glTF JSON. */
function meshRefs(parser: GLTFParser): { index: number; name: string }[] {
  const json = parser.json as { nodes?: { name?: string; mesh?: number }[] }
  return (json.nodes ?? []).flatMap((node, index) => (node.mesh === undefined ? [] : [{ index, name: node.name ?? '' }]))
}

/** Every node visible except the listed ones. */
function applyHiddenNodes(nodes: THREE.Object3D[], hidden: ReadonlySet<number>): void {
  nodes.forEach((node, index) => {
    node.visible = !hidden.has(index)
  })
}
