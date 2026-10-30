// What Display can play on the shown model, and what it does play: the candidates the Animations popover offers, the pool of Board
// actions and the idles with their weights. Pure: no three.js, no Vue, no browser globals. The director takes the ids and weights as
// they are; this decides which items there are.

import type { LobbyConfig } from '../constructs/index.ts'
import { LOBBY_FIGHT_IDLES, LOBBY_GROUP_SHARES, LOBBY_IDLE_WEIGHTS } from './director.ts'

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
  /** The list the item comes from: the Menu list (the default) or the Fight list. */
  context?: 'menu' | 'fight'
  /** The manifest's `loop` flag; absent means it loops. A Fight clip that does not loop is an interlude (`Win`, `LevelAttack14` …). */
  loop?: boolean
}

/** `action`: a voiced Board action. `idle`: a Menu idle. `fight`: a Fight clip that Display idles on (`LOBBY_FIGHT_IDLES`). */
export type CandidateKind = 'action' | 'idle' | 'fight'

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
  /** The clip does not loop: it plays once (only Fight clips; `Standchange`, `Win`, `LevelAttack013Loop`, `LevelAttack14`). */
  once: boolean
}

export interface LobbyIdle {
  id: string
  /** Weights of all idles sum to 1. */
  weight: number
  /** The clip does not loop: it plays once and the next idle is picked at its end. */
  once: boolean
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
  /** The keys (`<frame>:<clip name>`, the shown frame) of its own Fight clips the user turned off; absent means all on. */
  ownOff?: ReadonlySet<string>
}

export const choiceKey = (frame: string, name: string): string => `${frame}:${name}`

/**
 * The candidates in the Menu and Fight lists' items. Actions: Menu clips named `BoardAct…` that have a voice line (`hasLine(item.frame,
 * name)`; a clip without one is not a candidate). Idles: Menu clips named in `LOBBY_IDLE_WEIGHTS` (`UiStand1`, `StandAct0101`), which need no
 * line. Fight clips: those named in `LOBBY_FIGHT_IDLES`, no line either. One candidate per clip name and source (Menu and Fight names do
 * not collide); sources are ordered own first, then by first appearance in `items`.
 */
function candidateKind(item: PoolItem): CandidateKind | null {
  if (item.context === 'fight') return LOBBY_FIGHT_IDLES.includes(item.name) ? 'fight' : null
  if (item.name.startsWith('BoardAct')) return 'action'
  return (LOBBY_IDLE_WEIGHTS[item.name] ?? 0) > 0 ? 'idle' : null
}

export function listCandidates(items: readonly PoolItem[], hasLine: (frame: string | null, name: string) => boolean, shown: string): Candidate[] {
  const sourceOf = (item: PoolItem): string => item.frame ?? shown
  const order: string[] = [shown]
  for (const item of items) if (!order.includes(sourceOf(item))) order.push(sourceOf(item))
  const seen = new Set<string>()
  const found: Candidate[] = []
  for (const item of items) {
    const kind = candidateKind(item)
    if (kind === null) continue
    if (kind === 'action' && !hasLine(item.frame, item.name)) continue
    const frame = sourceOf(item)
    const key = choiceKey(frame, item.name)
    if (seen.has(key)) continue
    seen.add(key)
    found.push({ id: item.id, key, frame, own: frame === shown, kind, name: item.name, duration: item.duration, title: item.title ?? null, once: kind === 'fight' && item.loop === false })
  }
  // Items keep their order inside a source (the list's natural order: `BoardAct0201`, `0202` …).
  return found.sort((a, b) => order.indexOf(a.frame) - order.indexOf(b.frame))
}

/** The keys chosen when the user has chosen nothing: the frames of the construct config's `lobby`, every voiced action and the Menu idles (no other frame's Fight clip). */
export function defaultChoice(lobby: LobbyConfig | undefined, candidates: readonly Candidate[]): string[] {
  const actionFrom = lobby?.actionFrom ?? []
  const idleFrom = lobby?.idleFrom ?? []
  return candidates.filter((c) => !c.own && c.kind !== 'fight' && (c.kind === 'action' ? actionFrom : idleFrom).includes(c.frame)).map((c) => c.key)
}

/**
 * The pool and the idles for a model, from the Menu and Fight lists' items.
 *
 * Actions: the shown frame's own candidates always, then the chosen borrowed ones. Idles, three groups: the own Fight clips (all on unless
 * the user turned them off), the own Menu idles (always), and the chosen borrowed ones (Menu idles and Fight clips of other frames); they
 * take `LOBBY_GROUP_SHARES` of the picks, renormalized over the groups that are not empty. Inside a group: own Fight, equal weights; own
 * Menu, `LOBBY_IDLE_WEIGHTS` (3 : 2); borrowed, the lending frames evenly, and within a lender its Fight clips and its Menu idles at the
 * ratio of the own groups (60 : 30) when it lends both, each part split as above. All weights sum to 1.
 */
export function resolvePool(items: readonly PoolItem[], hasLine: (frame: string | null, name: string) => boolean, choice: PoolChoice): LobbyPool {
  const candidates = listCandidates(items, hasLine, choice.frame)
  const off = choice.ownOff ?? new Set<string>()
  const active = candidates.filter((c) => (c.own ? !(c.kind === 'fight' && off.has(c.key)) : choice.chosen.has(c.key)))
  const actions = active.filter((c) => c.kind === 'action').map((c) => c.id)
  const idleOf = (c: Candidate): LobbyIdle => ({ id: c.id, weight: 0, once: c.once })

  const ownFight = active.filter((c) => c.kind === 'fight' && c.own)
  const ownMenu = active.filter((c) => c.kind === 'idle' && c.own)
  const lenders = [...new Set(active.filter((c) => c.kind !== 'action' && !c.own).map((c) => c.frame))].map((f) => active.filter((c) => c.kind !== 'action' && c.frame === f))

  /** `list` split by the weight of each clip, summing to `total`. */
  const spread = (list: Candidate[], total: number, weightOf: (c: Candidate) => number): LobbyIdle[] => {
    const sum = list.reduce((s, c) => s + weightOf(c), 0)
    return list.map((c) => ({ ...idleOf(c), weight: (total * weightOf(c)) / sum }))
  }
  const menuWeight = (c: Candidate): number => LOBBY_IDLE_WEIGHTS[c.name]!
  /** A Fight part and a Menu part sharing `total` at the ratio of the own groups, either alone taking all of it. */
  const parts = (fight: Candidate[], menu: Candidate[], total: number): LobbyIdle[] => {
    const f = fight.length > 0 ? LOBBY_GROUP_SHARES.ownFight : 0
    const m = menu.length > 0 ? LOBBY_GROUP_SHARES.ownMenu : 0
    return [...spread(fight, (total * f) / (f + m), () => 1), ...spread(menu, (total * m) / (f + m), menuWeight)]
  }

  const shares = { ownFight: ownFight.length > 0 ? LOBBY_GROUP_SHARES.ownFight : 0, ownMenu: ownMenu.length > 0 ? LOBBY_GROUP_SHARES.ownMenu : 0, borrowed: lenders.length > 0 ? LOBBY_GROUP_SHARES.borrowed : 0 }
  const total = shares.ownFight + shares.ownMenu + shares.borrowed
  const idles = [
    ...(ownFight.length > 0 ? spread(ownFight, shares.ownFight / total, () => 1) : []),
    ...(ownMenu.length > 0 ? spread(ownMenu, shares.ownMenu / total, menuWeight) : []),
    ...lenders.flatMap((list) => parts(list.filter((c) => c.kind === 'fight'), list.filter((c) => c.kind === 'idle'), shares.borrowed / total / lenders.length)),
  ]
  return { actions, idles, candidates }
}
