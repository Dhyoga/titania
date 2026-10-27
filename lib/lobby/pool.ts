// What Display can play on the shown model, and what it does play: the candidates the Animations popover offers, the pool of Board
// actions and the idles with their weights. Pure: no three.js, no Vue, no browser globals. The director takes the ids and weights as
// they are; this decides which items there are.

import type { LobbyConfig } from '../constructs/index.ts'
import { LOBBY_IDLE_WEIGHTS, LOBBY_LENT_IDLE_SHARE } from './director.ts'

/** A catalog item reduced to what the pool needs. */
export interface PoolItem {
  /** What the selection holds (`#12`, `stigmata:anim/manifest.json#40`). */
  id: string
  /** The clip's name. */
  name: string
  /** The frame the item comes from; null for the shown frame's own clips (a lent item of the shown frame, such as Stigmata's Solitary Dream extras on its other skins, is its own too). */
  frame: string | null
  /** Seconds. */
  duration: number
  /** The wiki title of the voice line that plays with it, if it has one. */
  title?: string
}

export type CandidateKind = 'action' | 'idle'

/** One thing Display may play: a row of the Animations popover. */
export interface Candidate {
  id: string
  /** What a saved choice names: `<frame>:<clip name>`, the frame being the one the clip comes from (the shown frame for its own). */
  key: string
  /** The frame the clip comes from. */
  frame: string
  /** One of the shown frame's own clips: always played, never chosen. */
  own: boolean
  kind: CandidateKind
  name: string
  duration: number
  title: string | null
}

export interface LobbyIdle {
  id: string
  /** Weights of all idles sum to 1. */
  weight: number
}

export interface LobbyPool {
  /** Item ids: the shown frame's own actions first, then the chosen ones of each other frame in the order of the items. */
  actions: string[]
  idles: LobbyIdle[]
  /** Everything Display could play, own first and then each other frame in the order of the items (own ones always in the pool). */
  candidates: Candidate[]
}

export interface PoolChoice {
  /** The shown (Display) frame's id. */
  frame: string
  /** The keys (`<frame>:<clip name>`) of the borrowed animations the user chose; keys that match no candidate are ignored. */
  chosen: ReadonlySet<string>
}

export const choiceKey = (frame: string, name: string): string => `${frame}:${name}`

/**
 * The candidates in the Menu list's items. Actions: clips named `BoardAct…` that have a voice line (`hasLine(item.frame, name)`; a clip
 * without one is not a candidate). Idles: the clips named in `LOBBY_IDLE_WEIGHTS` (`UiStand1`), which need no line. One candidate per
 * clip name and source; sources are ordered own first, then by first appearance in `items`.
 */
export function listCandidates(items: readonly PoolItem[], hasLine: (frame: string | null, name: string) => boolean, shown: string): Candidate[] {
  const sourceOf = (item: PoolItem): string => item.frame ?? shown
  const order: string[] = [shown]
  for (const item of items) if (!order.includes(sourceOf(item))) order.push(sourceOf(item))
  const seen = new Set<string>()
  const found: Candidate[] = []
  for (const item of items) {
    const kind: CandidateKind | null = item.name.startsWith('BoardAct') ? 'action' : (LOBBY_IDLE_WEIGHTS[item.name] ?? 0) > 0 ? 'idle' : null
    if (kind === null) continue
    if (kind === 'action' && !hasLine(item.frame, item.name)) continue
    const frame = sourceOf(item)
    const key = choiceKey(frame, item.name)
    if (seen.has(key)) continue
    seen.add(key)
    found.push({ id: item.id, key, frame, own: frame === shown, kind, name: item.name, duration: item.duration, title: item.title ?? null })
  }
  // Items keep their order inside a source (the list's natural order: `BoardAct0201`, `0202` …).
  return found.sort((a, b) => order.indexOf(a.frame) - order.indexOf(b.frame))
}

/** The keys chosen when the user has chosen nothing: the frames of the construct config's `lobby`, every voiced action and the idle. */
export function defaultChoice(lobby: LobbyConfig | undefined, candidates: readonly Candidate[]): string[] {
  const actionFrom = lobby?.actionFrom ?? []
  const idleFrom = lobby?.idleFrom ?? []
  return candidates.filter((c) => !c.own && (c.kind === 'action' ? actionFrom : idleFrom).includes(c.frame)).map((c) => c.key)
}

/**
 * The pool and the idles for a model, from the Menu list's items.
 *
 * Actions: the shown frame's own candidates always, then the chosen borrowed ones. Idles: the own ones together taking
 * `1 − LOBBY_LENT_IDLE_SHARE` and the chosen borrowed ones the rest, split evenly over the lending frames; a name keeps its weight
 * relative to the others within a source. With nothing borrowed the own idles take all of it (and the borrowed ones all of it when the
 * shown skin has no idle of its own).
 */
export function resolvePool(items: readonly PoolItem[], hasLine: (frame: string | null, name: string) => boolean, choice: PoolChoice): LobbyPool {
  const candidates = listCandidates(items, hasLine, choice.frame)
  const active = candidates.filter((c) => c.own || choice.chosen.has(c.key))
  const actions = active.filter((c) => c.kind === 'action').map((c) => c.id)

  const own = active.filter((c) => c.kind === 'idle' && c.own)
  const lenders = [...new Set(active.filter((c) => c.kind === 'idle' && !c.own).map((c) => c.frame))].map((f) => active.filter((c) => c.kind === 'idle' && c.frame === f))
  const weights = (list: Candidate[], total: number): LobbyIdle[] => {
    const sum = list.reduce((s, c) => s + LOBBY_IDLE_WEIGHTS[c.name]!, 0)
    return list.map((c) => ({ id: c.id, weight: (total * LOBBY_IDLE_WEIGHTS[c.name]!) / sum }))
  }
  const lentTotal = own.length > 0 ? LOBBY_LENT_IDLE_SHARE : 1
  const ownTotal = lenders.length > 0 ? 1 - LOBBY_LENT_IDLE_SHARE : 1
  const idles = [...(own.length > 0 ? weights(own, ownTotal) : []), ...lenders.flatMap((list) => weights(list, lentTotal / lenders.length))]
  return { actions, idles, candidates }
}
