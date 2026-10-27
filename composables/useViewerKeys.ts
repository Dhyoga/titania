import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { CLICKABLE, isListOpen, shouldIgnoreKey } from './keyGuard'
import type { Mode } from './mode'

export interface ViewerKeyActions {
  toggleMute(): void
  toggleSubtitles(): void
  resetCamera(): void
  toggleFocus(): void
  togglePlayer(): void
  /** Close the open popover; returns true if it closed something. */
  escape(): boolean
  /** Display: `Space` or `Enter` on the stage acts as a tap (the lobby director starts an action). */
  tap(): void
}

/**
 * Viewer shortcuts:
 * - `M` mute the voice, `C` toggle subtitles, `R` reset the camera — work from inside an open popover.
 * - `F` toggle Focus, `H` toggle the player — ignored inside an open popover.
 * - `Esc` close the open popover (focus back on its trigger), else the stage menu, else ignored.
 * In Display only `M`, `C`, `R` and `Esc` act (`F` and `H` belong to Playground's header, skin area and player), and `Space` and
 * `Enter` are a tap, unless focus is on a control that uses them (a focused menu button still gets its key).
 */
export function useViewerKeys(actions: ViewerKeyActions, mode: Ref<Mode>): void {
  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isListOpen()) return
      if (actions.escape()) event.preventDefault()
      return
    }
    const key = event.key.toLowerCase()
    if (key === 'm' || key === 'c' || key === 'r') {
      if (shouldIgnoreKey(event, { allowInPopover: true })) return
      if (key === 'm') actions.toggleMute()
      else if (key === 'c') actions.toggleSubtitles()
      else actions.resetCamera()
      event.preventDefault()
      return
    }
    if (mode.value === 'display' && (event.key === ' ' || event.key === 'Enter')) {
      if (shouldIgnoreKey(event, { allowInPopover: false })) return
      if (event.target instanceof Element && event.target.closest(CLICKABLE)) return
      actions.tap()
      event.preventDefault()
      return
    }
    if ((key === 'f' || key === 'h') && mode.value === 'playground') {
      // F and H are ignored inside an open popover (unlike M/C/R).
      if (shouldIgnoreKey(event, { allowInPopover: false })) return
      if (key === 'f') actions.toggleFocus()
      else actions.togglePlayer()
      event.preventDefault()
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
