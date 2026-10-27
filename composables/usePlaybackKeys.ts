import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { CLICKABLE, shouldIgnoreKey } from './keyGuard'
import type { Mode } from './mode'
import type { PlaybackApi } from './usePlayback'


/**
 * Keyboard shortcuts for the playback panel: `Space` play/pause, `←` `→` step one frame while paused, `L` loop.
 * Ignored where `shouldIgnoreKey` says so (modifier keys, text fields, sliders, the open animation list or a popover,
 * keys another handler already took). Display has no player: none of these keys act there.
 */
export function usePlaybackKeys(playback: PlaybackApi, mode: Ref<Mode>): void {
  function onKeydown(event: KeyboardEvent): void {
    if (mode.value !== 'playground' || shouldIgnoreKey(event)) return
    const target = event.target instanceof Element ? event.target : null

    switch (event.key) {
      case ' ':
        if (target?.closest(CLICKABLE)) return
        playback.togglePlay()
        break
      case 'ArrowLeft':
      case 'ArrowRight':
        if (playback.playing.value || !playback.hasClip.value) return
        playback.step(event.key === 'ArrowRight' ? 1 : -1)
        break
      case 'l':
      case 'L':
        playback.toggleLoop()
        break
      default:
        return
    }
    event.preventDefault()
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
