import { computed, watch, type Ref } from 'vue'
import { DISPLAY_PRESET, type CameraView } from '~/lib/viewer/cameraView'
import type { Mode } from './mode'
import { usePreferences } from './usePreferences'
import type { ViewerSession } from './useViewer'

/**
 * The saved cameras (`user-preferences`, `display-mode`): Playground's default camera and Display's own. The view of the current mode
 * is kept in the viewer while it changes (a save, an import, another panel, "Use the built-in default", a mode switch), and a save
 * takes the viewer's camera as it is now. A model loads with `activeView()` through `useViewer`; the viewer ignores a view it already
 * holds, so a skin switch keeps a camera the user moved. A mode switch resets the camera to the view of the mode it enters.
 */
export function useCameraPreference(session: Ref<ViewerSession | null>, mode: Ref<Mode>) {
  const { prefs, update, flush } = usePreferences()
  const hasSaved = computed(() => prefs.value.camera !== null)
  const hasSavedDisplay = computed(() => prefs.value.lobby.camera !== null)

  /** The view the mode's camera starts from: Playground's saved default (null: the built-in framing), Display's saved or built-in. */
  function activeView(): CameraView | null {
    return mode.value === 'display' ? (prefs.value.lobby.camera ?? DISPLAY_PRESET) : prefs.value.camera
  }

  watch(
    [session, mode, () => prefs.value.camera, () => prefs.value.lobby.camera],
    () => session.value?.viewer.setCameraView(activeView()),
    { immediate: true },
  )
  // A camera moved in one mode does not carry into the other (`setCameraView` ignores a view it already holds).
  watch(mode, () => session.value?.viewer.resetCamera())

  /** Save Playground's camera as it is now, relative to the default framing. False when there is no model or the save did not stick. */
  function saveCurrentView(): boolean {
    const view = session.value?.viewer.getCameraView()
    if (!view) return false
    update((p) => ({ ...p, camera: view }))
    return flush()
  }

  /** Remove Playground's saved camera: the built-in default framing again, now and on the next open. */
  function useBuiltInDefault(): boolean {
    update((p) => ({ ...p, camera: null }))
    return flush()
  }

  /** Save the camera as it is now as Display's camera. False when there is no model or the save did not stick. */
  function saveDisplayView(): boolean {
    const view = session.value?.viewer.getCameraView()
    if (!view) return false
    update((p) => ({ ...p, lobby: { ...p.lobby, camera: view } }))
    return flush()
  }

  /** Remove Display's saved camera and show the built-in bust framing now (also when none was saved: the camera may have been moved). */
  function useBuiltInDisplay(): boolean {
    update((p) => ({ ...p, lobby: { ...p.lobby, camera: null } }))
    const viewer = session.value?.viewer
    if (mode.value === 'display' && viewer) {
      viewer.setCameraView(DISPLAY_PRESET)
      viewer.resetCamera()
    }
    return flush()
  }

  return { hasSaved, hasSavedDisplay, activeView, saveCurrentView, useBuiltInDefault, saveDisplayView, useBuiltInDisplay }
}

export type CameraPreferenceApi = ReturnType<typeof useCameraPreference>
