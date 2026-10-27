// Shared rules for the panel's keyboard shortcuts: where a key already means something else.

// Typing and arrow keys belong to these; `[data-popover]` is an open popover (its sliders use the arrows themselves).
const OWN_KEYS = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="listbox"]'
const IN_POPOVER = '[data-popover]'
/** Controls that use Space (and Enter) themselves: a focused button clicks, a link follows. */
export const CLICKABLE = 'button, a[href], summary, [role="button"], [role="combobox"]'

/** The animation list is open (its field keeps focus while the list is shown). */
export function isListOpen(): boolean {
  const active = document.activeElement
  return active?.getAttribute('role') === 'combobox' && active.getAttribute('aria-expanded') === 'true'
}

/**
 * Whether a shortcut should leave `event` alone: another handler took it, a modifier is held, focus is in a text field,
 * slider or the open animation list, or (unless `allowInPopover`) inside an open popover.
 */
export function shouldIgnoreKey(event: KeyboardEvent, options: { allowInPopover?: boolean } = {}): boolean {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return true
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest(OWN_KEYS)) return true
  if (!options.allowInPopover && target?.closest(IN_POPOVER)) return true
  return isListOpen()
}
