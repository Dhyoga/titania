import { computed, onBeforeUnmount, watch, type Ref } from 'vue'
import {
  createDirector,
  type Director,
  type DirectorCommand,
  type DirectorConfig,
  type DirectorEvent,
} from '~/lib/lobby/director'
import { defaultChoice, listCandidates, resolvePool, type LobbyPool, type PoolItem } from '~/lib/lobby/pool'
import type { PlaybackState } from '~/lib/viewer/Playback'
import type { Mode } from './mode'
import type { PlaybackApi } from './usePlayback'
import { usePreferences } from './usePreferences'
import type { ViewerSession } from './useViewer'

/** Taps: a press and release of the primary pointer within this distance (px) and time (ms). */
const TAP_MAX_MOVE_PX = 10
const TAP_MAX_MS = 500
/** The next action is prepared this long after a clip starts, so the preparing does not compete with the clip that has just started. */
const PREPARE_DELAY_MS = 1000

export interface LobbyDirectorOptions {
  session: Ref<ViewerSession | null>
  playback: PlaybackApi
  mode: Ref<Mode>
  /** The viewer's container (the element that holds the canvas): a press on it is a press on the stage. */
  container: Ref<HTMLElement | null>
  /** The menu is pinned, a popover is open or the camera is being adjusted: a press then only closes them and is not a tap. */
  engaged: () => boolean
  /** The camera is being adjusted: Display does not fall asleep meanwhile (the user is working on the view, not away). */
  adjusting: () => boolean
  /** Called once per start: `'idle'` when Display was entered from Playground, `'action'` otherwise (opening, a new Display model). */
  entry: () => 'action' | 'idle'
}

/** What Display plays on the shown model and what the Animations popover shows: the pool, and the choice behind it. */
export interface LobbyResolution {
  /** The Display frame's id. */
  frame: string
  pool: LobbyPool
  /** The borrowed animations in the pool (keys), the user's choice or the frame's default. */
  chosen: ReadonlySet<string>
  /** The user has chosen for this frame (otherwise `chosen` is the default). */
  saved: boolean
}

/**
 * Display's lobby: starts the director when Display shows a model and stops it when Display is left. The decisions are
 * `lib/lobby/director.ts`'s; this turns the viewer's state into its events (by item id), its commands into playback calls, and presses
 * on the stage into taps.
 */
export function useLobbyDirector(options: LobbyDirectorOptions) {
  const { session, playback, mode, container } = options
  const preferences = usePreferences()
  let director: Director | null = null
  /** The session the running director was started for: a pool change meant for another model is not sent to it. */
  let directedSession: ViewerSession | null = null
  /** Bumped by every start and stop: what an older start was waiting for is dropped. */
  let epoch = 0
  let unsubscribe: (() => void) | null = null
  let prepareTimer: ReturnType<typeof setTimeout> | null = null
  /** Item ids by the viewer's cache key of the clip that plays them (what `select` reports), to read state events. */
  const idByKey = new Map<string, string>()
  let idleId: string | null = null
  let seenLoops = 0
  let endedKey: string | null = null
  let listening = false
  /** The pool last given to the director (a signature), so an unchanged pool is not sent again. */
  let lastSent = ''

  const now = (): number => performance.now()

  function send(event: DirectorEvent): void {
    if (!director) return
    run(director.handle(event, now()))
  }

  /** Commands run outside the viewer's frame (a state event arrives from inside its tick). */
  function run(commands: DirectorCommand[], immediately = false): void {
    if (commands.length === 0) return
    const mine = epoch
    const go = () => {
      if (mine !== epoch) return
      for (const command of commands) execute(command)
    }
    if (immediately) go()
    else queueMicrotask(go)
  }

  function execute(command: DirectorCommand): void {
    const viewer = session.value?.viewer
    switch (command.type) {
      case 'playAction':
      case 'playIdle':
        void play(command.id, command.type === 'playIdle')
        break
      case 'prepare':
        schedulePrepare(command.id)
        break
      case 'sleep':
        viewer?.setPaused(true)
        break
      case 'wake':
        viewer?.setPaused(false)
        break
    }
  }

  async function play(id: string, idle: boolean): Promise<void> {
    const mine = epoch
    if (idle) {
      idleId = id
      seenLoops = 0
    }
    // An idle loops until the director picks the next clip; an action ends, whatever the loop choice in Playground was.
    const result = await playback.select(id, { loop: idle })
    if (mine !== epoch) return
    if (result.status === 'started' && result.key) {
      idByKey.set(result.key, id)
      endedKey = null
    } else if (result.status === 'failed') {
      console.warn(`Lobby: ${id} could not be played${playback.error.value ? ` (${playback.error.value})` : ''}`)
      if (!idle) send({ type: 'actionFailed', id })
    }
  }

  function schedulePrepare(id: string): void {
    if (prepareTimer !== null) clearTimeout(prepareTimer)
    const mine = epoch
    prepareTimer = setTimeout(() => {
      prepareTimer = null
      if (mine === epoch) void playback.prepare(id)
    }, PREPARE_DELAY_MS)
  }

  /** The viewer's state, as events about the item that plays: an idle wrapped around, an action reached the end of its timeline. */
  function onState(state: PlaybackState): void {
    if (!state.key) return
    const id = idByKey.get(state.key)
    if (id === undefined) return
    if (id === idleId && state.loops > seenLoops) {
      seenLoops = state.loops
      if (options.adjusting()) send({ type: 'input' }) // adjusting the camera is being here: the sleep time starts over
      send({ type: 'idleLoop', id, loops: state.loops })
    } else if (id !== idleId && state.finished && endedKey !== state.key) {
      endedKey = state.key
      send({ type: 'actionEnded', id })
    }
  }

  /**
   * The pool of the shown model, from the Menu list's items: its own voiced Board actions and idle, and the borrowed ones the user
   * chose for this Display frame, or the frame's default (`lobby` in its construct configuration) when they have chosen nothing.
   * Reactive: it follows the catalog, the voice data and the saved choice.
   */
  const resolution = computed<LobbyResolution | null>(() => {
    const current = session.value
    if (!current?.manifest) return null
    const items = (playback.catalog.value?.groups ?? []).flatMap((g) => g.items)
    const voiced = playback.voiced.value
    const poolItems: PoolItem[] = items.map((i) => ({
      id: i.id,
      name: i.name,
      frame: i.source?.frame ?? null,
      duration: playback.itemInfo(i.id)?.duration ?? 0,
      title: playback.lineTitle(i.id) ?? undefined,
    }))
    const withLine = new Set(items.filter((i) => voiced.has(i.id)).map((i) => `${i.source?.frame ?? ''}:${i.name}`))
    const hasLine = (frame: string | null, name: string) => withLine.has(`${frame ?? ''}:${name}`)
    const frame = current.construct.id
    const savedKeys = preferences.prefs.value.lobby.pools[frame]
    const keys = savedKeys ?? defaultChoice(current.construct.lobby, listCandidates(poolItems, hasLine, frame))
    const pool = resolvePool(poolItems, hasLine, { frame, chosen: new Set(keys) })
    const chosen = new Set(pool.candidates.filter((c) => !c.own && keys.includes(c.key)).map((c) => c.key))
    return { frame, pool, chosen, saved: savedKeys !== undefined }
  })

  const idlesOf = (pool: LobbyPool) => pool.idles.map(({ id, weight }) => ({ id, weight, duration: pool.candidates.find((c) => c.id === id)?.duration ?? 0 }))
  const signature = (pool: LobbyPool): string => JSON.stringify([pool.actions, pool.idles])

  /** The director's configuration for the shown model. A frame whose clips or voice lines could not be read is left out with a warning. */
  function configFor(current: ViewerSession): DirectorConfig {
    const r = resolution.value
    const pool: LobbyPool = r?.pool ?? { actions: [], idles: [], candidates: [] }
    const items = (playback.catalog.value?.groups ?? []).flatMap((g) => g.items)
    const voiced = playback.voiced.value
    const lobby = current.construct.lobby
    const saved = preferences.prefs.value.lobby.pools[current.construct.id]
    const actionFrames = new Set(saved ? saved.filter((k) => k.includes(':BoardAct')).map((k) => k.split(':')[0]!) : (lobby?.actionFrom ?? []))
    const idleFrames = new Set(saved ? saved.filter((k) => !k.includes(':BoardAct')).map((k) => k.split(':')[0]!) : (lobby?.idleFrom ?? []))
    for (const frame of new Set([...actionFrames, ...idleFrames])) {
      if (frame === current.construct.id) continue
      const lends = items.filter((i) => i.source?.frame === frame)
      if (lends.length === 0) console.warn(`Lobby: ${frame} lends no clips; its clips are left out of Display`)
      else if (actionFrames.has(frame) && !lends.some((i) => voiced.has(i.id))) {
        console.warn(`Lobby: ${frame} has no readable voice lines; its actions are left out of Display`)
      }
    }
    return { actions: pool.actions, idles: idlesOf(pool), ...(import.meta.env.MODE !== 'production' ? devOverrides() : {}) }
  }

  // A change of the pool while Display runs (a choice in the Animations popover, an import, another panel's write) goes to the director.
  watch(resolution, (next) => {
    if (!director || !next || directedSession !== session.value) return
    if (signature(next.pool) === lastSent) return
    lastSent = signature(next.pool)
    send({ type: 'setPool', actions: next.pool.actions, idles: idlesOf(next.pool) })
  })

  /**
   * Change the choice for the Display frame: `change` edits the set of chosen borrowed keys, which is saved whole. Keys the shown model
   * does not offer stay as they were. Returns false when the record could not be stored.
   */
  function choose(change: (chosen: Set<string>) => void): boolean {
    const r = resolution.value
    if (!r) return false
    const known = new Set(r.pool.candidates.map((c) => c.key))
    const kept = (preferences.prefs.value.lobby.pools[r.frame] ?? []).filter((k) => !known.has(k))
    const chosen = new Set(r.chosen)
    change(chosen)
    return preferences.setPool(r.frame, [...kept, ...chosen])
  }
  /** One borrowed animation on or off. */
  const toggle = (key: string): boolean => choose((chosen) => void (chosen.delete(key) || chosen.add(key)))
  /** All of a frame's borrowed animations on or off. */
  const setFrame = (frame: string, on: boolean): boolean =>
    choose((chosen) => {
      for (const c of resolution.value?.pool.candidates ?? []) if (!c.own && c.frame === frame) on ? chosen.add(c.key) : chosen.delete(c.key)
    })
  /** Forget the choice for the Display frame: its default applies again. */
  const useDefault = (): boolean => {
    const r = resolution.value
    return r ? preferences.setPool(r.frame, null) : false
  }

  async function start(current: ViewerSession): Promise<void> {
    stop()
    const mine = ++epoch
    const entry = options.entry() // consumed even when nothing starts
    if (!current.manifest) return // a model without clips (no Display model is one, but be safe)
    playback.useMenuContext() // Playground may have been left in Fight: the pool is read from the Menu list
    await playback.dataReady()
    if (mine !== epoch || session.value !== current || mode.value !== 'display') return
    director = createDirector(configFor(current), Math.random)
    directedSession = current
    lastSent = resolution.value ? signature(resolution.value.pool) : ''
    unsubscribe = current.viewer.onPlaybackState(onState)
    listen(true)
    if (import.meta.env.MODE !== 'production') (globalThis as { __pgrLobby?: unknown }).__pgrLobby = { director, tap, send }
    send({ type: 'start', entry })
  }

  /** Display is left, or another model is shown: nothing runs, a sleeping pose resumes, the prepared line is released. */
  function stop(): void {
    const old = director
    ++epoch
    director = null
    directedSession = null
    if (prepareTimer !== null) clearTimeout(prepareTimer)
    prepareTimer = null
    unsubscribe?.()
    unsubscribe = null
    listen(false)
    idByKey.clear()
    idleId = null
    seenLoops = 0
    endedKey = null
    if (old) run(old.handle({ type: 'stop' }, now()), true) // `wake` for a sleeper, at once
    playback.releasePrepared()
  }

  /** A tap on the stage, or `Space`/`Enter`. Ignored until the director has started. */
  function tap(): void {
    send({ type: 'tap' })
  }

  // ---- Presses on the stage ----
  // Whether the menu was engaged must be read before this same press closes it: `Popover` and `StageMenu` close and unpin from capture
  // listeners on `document`, and a listener on `window` with `capture: true` runs before every one of them.
  // `at` is the event's own `timeStamp` (when the input was made), not the time the page got to handle it: a busy main thread (a frame
  // that compiles shaders, a heavy pose) delays `pointerup` by hundreds of milliseconds, and a quick tap would then look like a long press.
  const downs = new Map<number, { x: number; y: number; at: number; engaged: boolean; onStage: boolean }>()

  function onWindowDown(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0) return
    send({ type: 'input' })
    downs.set(event.pointerId, { x: event.clientX, y: event.clientY, at: event.timeStamp, engaged: options.engaged(), onStage: false })
  }
  function onStageDown(event: PointerEvent): void {
    const down = downs.get(event.pointerId)
    if (down) down.onStage = true
  }
  function onWindowUp(event: PointerEvent): void {
    const down = downs.get(event.pointerId)
    downs.delete(event.pointerId)
    const moved = down ? Math.hypot(event.clientX - down.x, event.clientY - down.y) : 0
    const took = down ? event.timeStamp - down.at : 0
    trace({ up: event.pointerType, id: event.pointerId, down: !!down, onStage: down?.onStage, engaged: down?.engaged, moved, took })
    if (!down || !down.onStage || down.engaged) return
    if (moved > TAP_MAX_MOVE_PX || took > TAP_MAX_MS) return
    tap()
  }
  function onWindowCancel(event: PointerEvent): void {
    downs.delete(event.pointerId)
  }
  function onKeyInput(): void {
    send({ type: 'input' })
  }

  let stageEl: HTMLElement | null = null
  function listen(on: boolean): void {
    if (on === listening) return
    listening = on
    const method = on ? 'addEventListener' : 'removeEventListener'
    window[method]('pointerdown', onWindowDown as EventListener, true)
    window[method]('pointerup', onWindowUp as EventListener)
    window[method]('pointercancel', onWindowCancel as EventListener)
    window[method]('keydown', onKeyInput, true)
    if (on) {
      stageEl = container.value
      stageEl?.addEventListener('pointerdown', onStageDown as EventListener)
    } else {
      stageEl?.removeEventListener('pointerdown', onStageDown as EventListener)
      stageEl = null
      downs.clear()
    }
  }

  watch(
    [session, mode],
    ([current, next]) => {
      if (current && next === 'display') void start(current)
      else stop()
    },
    { immediate: true },
  )
  onBeforeUnmount(stop)

  return { tap, resolution, toggle, setFrame, useDefault }
}

/** Development only: what the tap detection decided, for the checks (`globalThis.__pgrLobbyTrace`). */
function trace(entry: Record<string, unknown>): void {
  if (import.meta.env.MODE === 'production') return
  ;((globalThis as { __pgrLobbyTrace?: unknown[] }).__pgrLobbyTrace ??= []).push(entry)
}

/** Development only: timings can be overridden from the console (`globalThis.__pgrLobbyOverrides`) so the checks need not wait minutes. */
function devOverrides(): Partial<DirectorConfig> {
  return (globalThis as { __pgrLobbyOverrides?: Partial<DirectorConfig> }).__pgrLobbyOverrides ?? {}
}
