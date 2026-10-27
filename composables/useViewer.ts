import { onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue'
import { loadManifest } from '~/lib/anim/loader'
import type { AnimManifest } from '~/lib/anim/manifest'
import { assetUrl } from '~/lib/assets'
import { getConstruct, type ConstructConfig, type SkinConfig } from '~/lib/constructs'
import type { ModelChoice } from '~/lib/constructs/display'
import { findSkin, skinAssets, skinWidthShare } from '~/lib/constructs/skins'
import type { CameraView } from '~/lib/viewer/cameraView'
import { Viewer } from '~/lib/viewer/Viewer'

export type ViewerStatus = 'loading' | 'ready' | 'error'

/** What playback needs once a model is shown. Held in a shallowRef: never made reactive. */
export interface ViewerSession {
  viewer: Viewer
  /** The frame (construct) the skin belongs to: where its clips, voices and icons are served from. */
  construct: ConstructConfig
  skin: SkinConfig
  /** The skin's animation manifest; null for a model without clips (the chibi). */
  manifest: AnimManifest | null
  /** Asset path of the manifest, which clip files and cache keys are resolved against; null without a manifest. */
  manifestPath: string | null
}

const sameModel = (a: ModelChoice, b: ModelChoice): boolean => a.frame === b.frame && a.skin === b.skin

/**
 * Owns the three.js viewer and the model it shows. The Viewer lives in a plain variable (never in reactive state); only
 * small values are exposed to the template. `session` hands the viewer, the skin and its manifest to the playback
 * composable without making them reactive. `model` (chosen in `App.vue`) says which frame and skin to show; a new value loads
 * into the same viewer (the canvas, the WebGL context and the display settings pushed to it stay), and the value already shown or
 * loading loads nothing. `camera` says how a model is placed when it loads: `view` is the camera it loads with (the mode's saved
 * view, or null for the default framing), `keep` whether a camera the user moved stays where it is (a skin switch) or not (a model
 * loaded for another mode starts at that mode's own view), `hold` whether the model stays invisible until its first clip starts (Display).
 */
export function useViewer(container: Ref<HTMLElement | null>, model: Ref<ModelChoice>, camera: { view: () => CameraView | null; keep: () => boolean; hold?: () => boolean }) {
  const status = ref<ViewerStatus>('loading')
  /** Whole percent, or null while unknown. */
  const progress = ref<number | null>(null)
  const error = ref('')
  /** Id of the skin shown, or being loaded. */
  const skin = ref(model.value.skin)
  /** The model shown or being loaded (null before the first load and after a stop). */
  let current: ModelChoice | null = null
  /** Set when the model is shown, null while loading, after an error and after unmount. */
  const session = shallowRef<ViewerSession | null>(null)

  let viewer: Viewer | null = null
  let abort: AbortController | null = null

  function stop(): void {
    session.value = null
    abort?.abort()
    abort = null
    viewer?.dispose()
    viewer = null
    current = null
  }

  /** The viewer is gone (WebGL context lost): only a full restart helps. */
  function fail(message: string): void {
    stop()
    error.value = message
    status.value = 'error'
  }

  /** Load `choice` into the current viewer. A newer call cancels this one; a failure leaves the viewer usable for the next. */
  async function loadModel(choice: ModelChoice): Promise<void> {
    const shown = viewer
    if (!shown) return
    current = { ...choice }
    skin.value = choice.skin
    abort?.abort()
    const controller = new AbortController()
    abort = controller
    session.value = null
    status.value = 'loading'
    progress.value = null
    error.value = ''
    try {
      const frame: ConstructConfig = getConstruct(choice.frame)
      const info = findSkin(frame.skins, choice.skin)
      const assets = skinAssets(info)
      const manifest = assets.manifestPath ? await loadManifest(assetUrl(frame.id, assets.manifestPath), { signal: controller.signal }) : null
      await shown.loadModel(assetUrl(frame.id, assets.modelPath), {
        hiddenNodes: manifest?.contexts.menu.hiddenNodes ?? [],
        keepCamera: camera.keep(),
        widthShare: skinWidthShare(info),
        cameraView: camera.view(),
        holdReveal: camera.hold?.() === true,
        signal: controller.signal,
        onProgress: (fraction) => {
          progress.value = fraction === null ? null : Math.round(fraction * 100)
        },
      })
      if (viewer !== shown || abort !== controller) return
      session.value = { viewer: shown, construct: frame, skin: info, manifest, manifestPath: assets.manifestPath }
      status.value = 'ready'
    } catch (err) {
      if (controller.signal.aborted) return // replaced by a newer choice, a restart or unmount
      error.value = err instanceof Error ? err.message : String(err)
      status.value = 'error'
    }
  }

  async function start(): Promise<void> {
    const element = container.value
    if (!element) return
    stop()
    const created = new Viewer(element)
    viewer = created
    created.onContextLost(() => {
      if (viewer === created) fail('The 3D view stopped working (the WebGL context was lost).')
    })
    // Debug handle for checks from the page console / test harness; not present in production builds.
    if (import.meta.env.MODE !== 'production') (globalThis as { __pgrViewer?: Viewer }).__pgrViewer = created
    await loadModel(model.value)
  }

  /** Try the current model again (a new viewer if the old one is gone). */
  function retry(): void {
    if (viewer) void loadModel(model.value)
    else void start()
  }

  // Another model (a skin, a frame, or a mode that shows another one); the model shown or loading is not loaded again, except to
  // recover from an error. A model chosen while one loads replaces it.
  watch(
    () => ({ frame: model.value.frame, skin: model.value.skin }),
    (next) => {
      if (current && sameModel(current, next) && status.value !== 'error') return
      if (viewer) void loadModel(next)
      else void start()
    },
  )

  onMounted(start)
  onBeforeUnmount(stop)

  return { status, progress, error, session, skin, retry }
}
