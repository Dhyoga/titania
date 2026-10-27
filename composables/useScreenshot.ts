import type { Ref } from 'vue'
import { screenshotName } from '~/lib/viewer/screenshotName'
import type { StageBackground } from '~/lib/viewer/Viewer'
import { downloadBlob } from './download'
import type { PlaybackApi } from './usePlayback'
import type { ViewerSettingsApi } from './useViewerSettings'
import type { ViewerSession } from './useViewer'

// Used only if the theme tokens cannot be read (they are the values of `--color-stage-top` and `--color-stage-bottom`).
const FALLBACK_TOP = '#a9bfdc'
const FALLBACK_BOTTOM = '#e9eef5'

function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

/** Take a PNG of the stage as shown and download it as `<construct>_<skin>_<clip>_<time>.png`. */
export function useScreenshot(session: Ref<ViewerSession | null>, playback: PlaybackApi, settings: ViewerSettingsApi) {
  /** Gradient, or the solid colour. "Transparent" is only a view aid: the PNG is always opaque, so it gets the gradient. */
  function background(): StageBackground {
    if (settings.backgroundMode.value === 'solid') return { type: 'solid', color: settings.solidColor.value }
    return { type: 'gradient', top: token('--color-stage-top', FALLBACK_TOP), bottom: token('--color-stage-bottom', FALLBACK_BOTTOM) }
  }

  function clipLabel(): string | null {
    const selected = playback.selected.value
    if (selected === null) return null
    for (const group of playback.catalog.value?.groups ?? []) {
      const item = group.items.find((i) => i.id === selected)
      if (item) return item.source ? `${item.source.frameLabel}-${item.label}` : item.label // a lent clip names its frame
    }
    return null
  }

  async function takeScreenshot(): Promise<void> {
    const current = session.value
    if (!current) return
    const viewer = current.viewer
    const name = screenshotName({ construct: current.construct.id, skin: current.skin.id, clip: clipLabel(), time: playback.time.value })
    const blob = await viewer.screenshot({ background: background() })
    downloadBlob(blob, name)
  }

  return { takeScreenshot }
}
