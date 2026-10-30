import { ref, shallowRef } from 'vue'
import { defaultPrefs, importPrefs, parsePrefs, PREFS_KEY, serializePrefs, withOwnOff, withPool, type Prefs } from '~/lib/prefs/prefs'

/** How long a change waits before it is written, so a slider drag is one write. A Save button writes at once. */
const WRITE_DELAY_MS = 300

/** Stored preferences, or the defaults when storage is missing, blocked or holds something unusable. */
function readStored(): Prefs {
  try {
    return parsePrefs(localStorage.getItem(PREFS_KEY))
  } catch {
    return defaultPrefs() // storage can throw in private windows or with blocked site data
  }
}

// One store for the whole panel (a module-level state: every composable that needs a preference reads the same record).
const prefs = shallowRef<Prefs>(readStored())
/** The last write did not stick (storage unavailable or full). Controls keep working for the session. */
const saveError = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let dirty = false
let listening = false

function write(): boolean {
  clearTimeout(timer)
  timer = undefined
  if (!dirty) return !saveError.value
  dirty = false
  try {
    localStorage.setItem(PREFS_KEY, serializePrefs(prefs.value))
    saveError.value = false
    return true
  } catch {
    saveError.value = true
    return false
  }
}

/** Change the record (from the current one, so two callers never overwrite each other's field) and write it soon. */
function update(change: (current: Prefs) => Prefs): void {
  prefs.value = change(prefs.value)
  dirty = true
  clearTimeout(timer)
  timer = setTimeout(write, WRITE_DELAY_MS)
}

/** Write a pending change now. False when it could not be stored. */
function flush(): boolean {
  return write()
}

/** Replace everything (import, forget all) and write at once. */
function replace(next: Prefs): boolean {
  update(() => next)
  return flush()
}

/** A Display frame's chosen borrowed animations (null forgets its whole choice, own Fight clips turned off included: its default applies), written at once. False when it could not be stored. */
function setPool(frame: string, keys: readonly string[] | null): boolean {
  update((p) => withPool(p, frame, keys))
  return flush()
}

/** A Display frame's own Fight clips that are turned off (none: all on), written at once. False when it could not be stored. */
function setOwnOff(frame: string, keys: readonly string[] | null): boolean {
  update((p) => withOwnOff(p, frame, keys))
  return flush()
}

function forgetAll(): boolean {
  return replace(defaultPrefs())
}

/** The text "Export" downloads. */
function exportText(): string {
  return serializePrefs(prefs.value)
}

/** Replace the preferences with an imported file's text; throws `PrefsError` (changing nothing) when it is not a preferences record. */
function importText(text: string): boolean {
  return replace(importPrefs(text))
}

function listen(): void {
  if (listening || typeof window === 'undefined') return
  listening = true
  // Another open panel wrote: take its record (last write wins). `key` is null when the whole storage was cleared.
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== PREFS_KEY) return
    clearTimeout(timer)
    timer = undefined
    dirty = false
    prefs.value = parsePrefs(event.newValue)
  })
  // The panel can close within the delay of the last change.
  window.addEventListener('pagehide', () => void flush())
}

/** The panel's preferences (see `lib/prefs/prefs.ts`): reactive, shared, saved to local storage, refreshed when another panel writes. */
export function usePreferences() {
  listen()
  return { prefs, saveError, update, flush, replace, setPool, setOwnOff, forgetAll, exportText, importText }
}

export type PreferencesApi = ReturnType<typeof usePreferences>
