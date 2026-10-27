// What Display plays: a pure state machine. Events in, commands out. No three.js, no Vue, no browser globals.
//
// The director never looks at names, frames or the viewer: it works on opaque item ids, and the caller turns what the viewer reports
// into events and the commands into playback calls. The random source and the clock (`now`, in milliseconds, any origin) are injected,
// so the tests use a seeded generator and plain numbers.
//
// Phases:  stopped → idle ⇄ action,  idle → asleep → action.
// The phase changes when a command is issued, not when the viewer reports the new clip. The viewer's state events are about whatever
// clip is current, so an event about a clip other than the one last started (the end of an action a tap has just replaced, a wrap of
// the idle that is being replaced) is stale and is ignored.

/** Whole seconds an idle plays at least before the next pick. */
export const LOBBY_DWELL_S = 10
/** Without input for this long, Display falls asleep at the next idle wrap. */
export const LOBBY_SLEEP_AFTER_MS = 120_000
/** Taps closer than this to the last accepted one are ignored. */
export const LOBBY_TAP_DEBOUNCE_MS = 400
/** A dwell may fall this short of `LOBBY_DWELL_S` (a 3.33 s clip plays three times, not four). */
const DWELL_TOLERANCE_S = 0.05

/**
 * The idle clips Display stands in, with their weights within a source (own or lender). `StandAct0101` is left out on purpose: a nearly
 * still pose, dropped for every frame, own and borrowed (`add-lobby-variety`); add a name here to bring an idle back.
 */
export const LOBBY_IDLE_WEIGHTS: Readonly<Record<string, number>> = { UiStand1: 1 }
/** The share of idle picks that go to borrowed idles (split evenly over the lenders), when the frame borrows any. */
export const LOBBY_LENT_IDLE_SHARE = 0.25

export interface IdleChoice {
  id: string
  weight: number
  /** Seconds. */
  duration: number
}

export interface DirectorConfig {
  /** Item ids of the Board actions, in any order. */
  actions: readonly string[]
  idles: readonly IdleChoice[]
  dwellS?: number
  sleepAfterMs?: number
  tapDebounceMs?: number
}

export type DirectorEvent =
  | { type: 'start'; entry: 'action' | 'idle' }
  /** An accepted tap, or `Space`/`Enter` on the stage. */
  | { type: 'tap' }
  /** Any other input: it only resets the sleep time. */
  | { type: 'input' }
  | { type: 'actionEnded'; id: string }
  | { type: 'idleLoop'; id: string; loops: number }
  | { type: 'actionFailed'; id: string }
  /**
   * The pool and the idles changed (the user's choice): see `createDirector`. Valid in any phase; the clip that plays is never
   * interrupted, and an action that failed since the last start stays out.
   */
  | { type: 'setPool'; actions: readonly string[]; idles: readonly IdleChoice[] }
  | { type: 'stop' }

export type DirectorCommand =
  | { type: 'playAction'; id: string }
  | { type: 'playIdle'; id: string }
  /** Get this action ready (clip built, line decoded); asking again for the id already prepared does nothing. */
  | { type: 'prepare'; id: string }
  | { type: 'sleep' }
  | { type: 'wake' }

export type DirectorPhase = 'stopped' | 'idle' | 'action' | 'asleep'

export interface DirectorState {
  phase: DirectorPhase
  /** The id last started (an action or an idle), or null. */
  current: string | null
  /** Actions still in the pool (a failed one has left it). */
  pool: readonly string[]
  /** The idle loops that must be reached before the next idle pick. */
  idleLoopsWanted: number
}

export interface Director {
  handle(event: DirectorEvent, now: number): DirectorCommand[]
  state(): DirectorState
}

/** How many whole loops of a clip of `duration` seconds make a dwell of at least `dwellS` seconds (within a small tolerance). */
export function loopsFor(duration: number, dwellS: number = LOBBY_DWELL_S): number {
  if (!(duration > 0) || !Number.isFinite(duration)) return 1
  return Math.max(1, Math.ceil((dwellS - DWELL_TOLERANCE_S) / duration))
}

/** A shuffled copy (Fisher–Yates) with the injected random source. */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** The index chosen by weight (`random()` in [0, 1)); items without a positive weight are never chosen unless none has one. */
export function pickWeighted(weights: readonly number[], random: () => number): number {
  const total = weights.reduce((sum, w) => sum + (w > 0 ? w : 0), 0)
  if (!(total > 0)) return weights.length > 0 ? Math.min(weights.length - 1, Math.floor(random() * weights.length)) : -1
  let at = random() * total
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i]! > 0 ? weights[i]! : 0
    if (at < w) return i
    at -= w
  }
  return weights.length - 1
}

export function createDirector(config: DirectorConfig, random: () => number): Director {
  const dwellS = config.dwellS ?? LOBBY_DWELL_S
  const sleepAfterMs = config.sleepAfterMs ?? LOBBY_SLEEP_AFTER_MS
  const tapDebounceMs = config.tapDebounceMs ?? LOBBY_TAP_DEBOUNCE_MS

  let phase: DirectorPhase = 'stopped'
  /** The actions a `start` begins with: the config's, or the last `setPool`'s. */
  let wanted: string[] = [...config.actions]
  let pool: string[] = [...wanted]
  /** Actions that failed since the last start: `setPool` does not bring them back. */
  const failed = new Set<string>()
  let bag: string[] = []
  let lastTaken: string | null = null
  let current: string | null = null
  let startedBy: 'open' | 'tap' | null = null
  let idleLoopsWanted = 0
  let lastInput = 0
  let lastTapAt: number | null = null

  let idles = config.idles.filter((i) => i.weight > 0)

  /** The bag is refilled when it runs out; a new bag never starts with the action that was just taken. */
  function ensureBag(): void {
    if (bag.length > 0 || pool.length === 0) return
    bag = shuffled(pool, random)
    if (bag.length > 1 && bag[0] === lastTaken) bag.push(bag.shift()!)
  }
  function peekAction(): string | null {
    ensureBag()
    return bag[0] ?? null
  }
  function takeAction(): string | null {
    ensureBag()
    const id = bag.shift() ?? null
    if (id !== null) lastTaken = id
    return id
  }

  function prepareNext(): DirectorCommand[] {
    const next = peekAction()
    return next === null ? [] : [{ type: 'prepare', id: next }]
  }

  function startAction(by: 'open' | 'tap'): DirectorCommand[] {
    const id = takeAction()
    if (id === null) return startIdle()
    phase = 'action'
    current = id
    startedBy = by
    idleLoopsWanted = 0
    return [{ type: 'playAction', id }, ...prepareNext()]
  }

  function startIdle(): DirectorCommand[] {
    phase = 'idle'
    startedBy = null
    const at = pickWeighted(idles.map((i) => i.weight), random)
    const pick = idles[at]
    if (!pick) {
      current = null
      idleLoopsWanted = 0
      return []
    }
    current = pick.id
    idleLoopsWanted = loopsFor(pick.duration, dwellS)
    return [{ type: 'playIdle', id: pick.id }, ...prepareNext()]
  }

  function dropFromPool(id: string): void {
    failed.add(id)
    pool = pool.filter((p) => p !== id)
    bag = bag.filter((b) => b !== id)
  }

  /**
   * The pool and idles are replaced. The bag keeps what is left of it; an added action goes to a random place behind the head (the head
   * is the one being prepared, and a new action is never the one just taken), so it plays before any action plays twice. The action or
   * idle that plays goes on whatever happens to it; the next idle pick uses the new idles. Returns `prepare` when the bag's head changed.
   */
  function setPool(actions: readonly string[], newIdles: readonly IdleChoice[]): DirectorCommand[] {
    wanted = [...actions]
    idles = newIdles.filter((i) => i.weight > 0)
    if (phase === 'stopped') return [] // `start` takes the lists
    const headBefore = bag[0] ?? null
    const before = new Set(pool)
    pool = wanted.filter((id) => !failed.has(id))
    const inPool = new Set(pool)
    bag = bag.filter((id) => inPool.has(id))
    for (const id of pool) {
      if (before.has(id) || bag.length === 0) continue // an empty bag is refilled from the pool, the added action included
      bag.splice(1 + Math.min(bag.length - 1, Math.floor(random() * bag.length)), 0, id)
    }
    // Removals may have left the action just taken at the head.
    if (bag.length > 1 && bag[0] === lastTaken) [bag[0], bag[1]] = [bag[1]!, bag[0]!]
    else if (bag.length === 1 && bag[0] === lastTaken && pool.length > 1) bag = []
    if (phase === 'asleep') return []
    const next = peekAction()
    return next !== null && next !== headBefore ? [{ type: 'prepare', id: next }] : []
  }

  function handle(event: DirectorEvent, now: number): DirectorCommand[] {
    if (event.type === 'setPool') return setPool(event.actions, event.idles)
    if (event.type === 'start') {
      pool = [...wanted]
      failed.clear()
      bag = []
      lastTaken = null
      lastTapAt = null
      lastInput = now
      return event.entry === 'action' ? startAction('open') : startIdle()
    }
    if (phase === 'stopped') return []

    switch (event.type) {
      case 'input':
        lastInput = now
        return []

      case 'tap': {
        lastInput = now
        if (lastTapAt !== null && now - lastTapAt < tapDebounceMs) return []
        lastTapAt = now
        if (phase === 'asleep') {
          // The pose resumes first; with nothing to perform the model just goes on idling.
          if (pool.length === 0) {
            phase = 'idle'
            return [{ type: 'wake' }]
          }
          return [{ type: 'wake' }, ...startAction('tap')]
        }
        if (pool.length === 0) return []
        return startAction('tap')
      }

      case 'actionEnded':
        if (phase !== 'action' || event.id !== current) return []
        return startIdle()

      case 'idleLoop': {
        if (phase !== 'idle' || event.id !== current) return []
        // A wrap is where a looping clip is back at its first pose: the place to freeze it, or to crossfade to the next idle.
        if (now - lastInput >= sleepAfterMs) {
          phase = 'asleep'
          return [{ type: 'sleep' }]
        }
        if (event.loops < idleLoopsWanted) return []
        const at = pickWeighted(idles.map((i) => i.weight), random)
        const pick = idles[at]
        if (!pick) return []
        if (pick.id === current) {
          idleLoopsWanted = event.loops + loopsFor(pick.duration, dwellS) // the same idle goes on looping, no restart
          return []
        }
        current = pick.id
        idleLoopsWanted = loopsFor(pick.duration, dwellS)
        return [{ type: 'playIdle', id: pick.id }, ...prepareNext()]
      }

      case 'actionFailed': {
        const wasCurrent = phase === 'action' && event.id === current
        const by = startedBy
        dropFromPool(event.id)
        if (!wasCurrent) return []
        // A tap that failed gets the next action; a failed action on open leaves the model idling.
        return by === 'tap' && pool.length > 0 ? startAction('tap') : startIdle()
      }

      case 'stop': {
        const wasAsleep = phase === 'asleep'
        phase = 'stopped'
        current = null
        startedBy = null
        bag = []
        idleLoopsWanted = 0
        return wasAsleep ? [{ type: 'wake' }] : []
      }
    }
  }

  return {
    handle,
    state: () => ({ phase, current, pool: [...pool], idleLoopsWanted }),
  }
}
