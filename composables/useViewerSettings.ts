import { computed, ref, watch, type Ref } from 'vue'
import { sameDisplay, type DisplayPrefs } from '~/lib/prefs/prefs'
import { DEFAULT_LIGHTING, type Lighting } from '~/lib/viewer/lighting'
import type { Mode } from './mode'
import { usePreferences } from './usePreferences'
import type { ViewerSession } from './useViewer'

export type { BackgroundMode } from '~/lib/prefs/prefs'

export const SPEEDS = [0.25, 0.5, 1, 1.5, 2] as const

/**
 * Stage, shading and playback-speed settings of the viewer. They are plain values that are pushed to the viewer when one is
 * shown, and again to a new one (retry). Background, grid, follow, toon shading and lighting start from what the user last set
 * (`usePreferences`, saved as they change, and refreshed when another panel or an import changes them); auto-rotate, wireframe and
 * the playback speed start from their defaults on every open.
 */
export function useViewerSettings(session: Ref<ViewerSession | null>, mode: Ref<Mode>) {
  const { prefs, update } = usePreferences()
  const initial = prefs.value.display
  const backgroundMode = ref(initial.backgroundMode)
  const solidColor = ref(initial.solidColor)
  const grid = ref(initial.grid)
  const autoRotate = ref(false)
  const follow = ref(initial.follow)
  const wireframe = ref(false)
  const toon = ref(initial.toon)
  const intensity = ref(initial.intensity)
  const azimuthDeg = ref(initial.azimuthDeg)
  const speed = ref<number>(1)

  const display = (): DisplayPrefs => ({
    backgroundMode: backgroundMode.value,
    solidColor: solidColor.value,
    grid: grid.value,
    follow: follow.value,
    toon: toon.value,
    intensity: intensity.value,
    azimuthDeg: azimuthDeg.value,
  })

  // Remembered as they change (a write is debounced), and taken from the store when it changes under us.
  watch([backgroundMode, solidColor, grid, follow, toon, intensity, azimuthDeg], () => {
    const next = display()
    if (!sameDisplay(next, prefs.value.display)) update((p) => ({ ...p, display: next }))
  })
  watch(
    () => prefs.value.display,
    (stored) => {
      backgroundMode.value = stored.backgroundMode
      solidColor.value = stored.solidColor
      grid.value = stored.grid
      follow.value = stored.follow
      toon.value = stored.toon
      intensity.value = stored.intensity
      azimuthDeg.value = stored.azimuthDeg
    },
  )

  const lighting = computed<Lighting>(() => ({ intensity: intensity.value, azimuthDeg: azimuthDeg.value }))
  const lightingIsDefault = computed(() => intensity.value === DEFAULT_LIGHTING.intensity && azimuthDeg.value === DEFAULT_LIGHTING.azimuthDeg)

  watch(
    [session, lighting, grid, autoRotate, wireframe, toon, speed, mode],
    () => {
      const viewer = session.value?.viewer
      if (!viewer) return
      viewer.setLighting(lighting.value)
      viewer.setGrid(grid.value)
      viewer.setAutoRotate(autoRotate.value)
      viewer.setWireframe(wireframe.value)
      viewer.setToon(toon.value)
      viewer.setSpeed(mode.value === 'display' ? 1 : speed.value) // Display plays at normal speed; the Playground value comes back with Playground
    },
    { immediate: true },
  )

  // Display always follows (its bust framing leaves the low poses of the Fight idles, `LevelAttack013Loop` and `14`, out of the frame
  // otherwise); the setting is Playground's. Watching the effective value, not the mode, so that a switch that changes nothing does not
  // pick the followed part again.
  const effectiveFollow = computed(() => mode.value === 'display' || follow.value)
  // Its own watcher: setting follow picks the followed part again, which other settings (a lighting slider) must not do.
  watch(
    [session, effectiveFollow],
    () => session.value?.viewer.setFollow(effectiveFollow.value),
    { immediate: true },
  )

  function resetLighting(): void {
    intensity.value = DEFAULT_LIGHTING.intensity
    azimuthDeg.value = DEFAULT_LIGHTING.azimuthDeg
  }

  return { backgroundMode, solidColor, grid, autoRotate, follow, wireframe, toon, intensity, azimuthDeg, lightingIsDefault, speed, resetLighting }
}

export type ViewerSettingsApi = ReturnType<typeof useViewerSettings>
