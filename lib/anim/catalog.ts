// Animation list per context, built from the manifest. Pure TypeScript: no three.js, no Vue, no extension APIs.
//
// Menu: the clips of `contexts.menu.base` plus the menu idle clip. `BoardAct*` -> "Board actions", the rest -> "Idle".
// Fight: the unique clips of `contexts.fight.base` and every `levels` controller (all layers), grouped by name, then cut down
// to the clips worth showing (see `FIGHT_SHOWN`). There is no `Bind pose` item: the list is only clips.
// Other frames lend their clips (`withSources`): their groups follow the shown frame's own, labelled with the frame's name. A frame's
// extra clips (Stigmata's Solitary Dream Board actions) also join its own list on its skins that lack them. A frame with no clip set of its
// own (Erza) has no own groups: its list is the sources' groups only, and it starts on the first source's default clip.
import type { AnimManifest, Controller } from './manifest.ts'

export type ContextId = 'menu' | 'fight'

/** Where a clip lent by another frame comes from. */
export interface CatalogSourceRef {
  /** The lending frame's construct id. */
  frame: string
  /** Its display name, as group headers and the field show it. */
  frameLabel: string
  /** The manifest the clip index refers to, under `/<frame>/`. */
  manifestPath: string
}

export interface CatalogItem {
  /** Unique within a list; what a selection holds (`#12` for the shown frame's clip 12, `stigmata:anim/manifest.json#40` for a lent one). */
  id: string
  /** Index into `AnimManifest.clips` of the manifest the item comes from (the shown skin's, or `source.manifestPath`). */
  clip: number
  name: string
  /** `name`, or `name (<folder>)` when another item in the list has the same name. */
  label: string
  /** What the field shows when the item is selected: `label`, prefixed with the frame for a lent clip (`Veritas · Win`). */
  fieldLabel: string
  loop: boolean
  /** Null for the shown frame's own clips. */
  source: CatalogSourceRef | null
}

export interface CatalogGroup {
  label: string
  items: CatalogItem[]
}

export interface Catalog {
  groups: CatalogGroup[]
  /** Clip index (of the shown skin's manifest) played when the context is entered; null for a frame with no clip set of its own. */
  defaultClip: number | null
  /** Id of the item played when the context is entered: the shown skin's default clip, or for a frame with none the first source's own default. */
  defaultItem: string
}

/** The catalog of one skin's own manifest: it always has a default clip. */
export type OwnCatalog = Catalog & { defaultClip: number }

/** Id of the shown frame's clip `clip` in a list. */
export const ownItemId = (clip: number): string => `#${clip}`

// Fight groups. Exact names are checked first (so `Standup` is a reaction, not idle), then prefixes in this order.
const FIGHT_REACTIONS = new Set(['Behitfly', 'Hoverhit', 'Falldown', 'Hitdown', 'Lieonfloor', 'Standup', 'Stun', 'Death'])
const FIGHT_GROUPS: { label: string; prefixes: string[] }[] = [
  { label: 'Idle', prefixes: ['Stand'] },
  { label: 'Movement', prefixes: ['Run', 'Walk', 'Move', 'Jump', 'Stop'] },
  { label: 'Attacks', prefixes: ['Attack'] },
  { label: 'Level skills', prefixes: ['LevelAttack'] },
  { label: 'Reactions', prefixes: ['Hit'] },
]

/**
 * What the Fight list shows, by group. A group that is not named here is shown whole; `none` leaves a group out, and a set keeps
 * only the clips with exactly those names (so `Walk` does not bring `WalkStart`). The clips stay in the manifest: this only
 * decides what the list offers.
 */
const FIGHT_SHOWN: Record<string, 'none' | ReadonlySet<string>> = {
  Attacks: 'none',
  Reactions: 'none',
  Movement: new Set(['Walk', 'Run']),
  'Level skills': new Set(['LevelAttack08_NunWalk', 'LevelAttack11_Loop', 'LevelAttack013Loop', 'LevelAttack14']),
}

/** Names starting with one of these are never listed, whatever their group (Stigmata's squat stance). */
const FIGHT_HIDDEN_PREFIXES = ['Squat']

function fightShown(name: string): boolean {
  if (FIGHT_HIDDEN_PREFIXES.some((p) => name.startsWith(p))) return false
  const rule = FIGHT_SHOWN[fightGroup(name)]
  return rule === undefined || (rule !== 'none' && rule.has(name))
}

/** Folders of the controller layer every frame's own clips live in (Veritas and Zero spell it with a space). */
const BASE_LAYER_FOLDERS = new Set(['BaseLayer', 'Base Layer'])

/**
 * Of the clips that share a name, keep the ones in the base layer when there are any: `Layer1`, `Layer2` and `LevelCombine…` hold
 * stance and form variants of the same names (Stigmata's `Layer1/Walk` is the base motion with a turned prop bone, `Layer2/Walk` a
 * different stance, Crepuscule's two `Walk` are the same motion). Names with no base-layer clip keep all of theirs.
 */
function preferBaseLayer(manifest: AnimManifest, clips: number[]): number[] {
  const isBase = (clip: number): boolean => BASE_LAYER_FOLDERS.has(fileParts(manifest.clips[clip]!.file).folder)
  const baseNames = new Set(clips.filter(isBase).map((clip) => manifest.clips[clip]!.name))
  return clips.filter((clip) => isBase(clip) || !baseNames.has(manifest.clips[clip]!.name))
}

const FIGHT_ORDER = ['Idle', 'Movement', 'Attacks', 'Level skills', 'Reactions', 'Other']

function fightGroup(name: string): string {
  if (FIGHT_REACTIONS.has(name)) return 'Reactions'
  for (const group of FIGHT_GROUPS) {
    if (group.prefixes.some((p) => name.startsWith(p))) return group.label
  }
  return 'Other'
}

/** Natural order: digit runs compare by value (`Attack2` < `Attack11`), the rest by code unit. */
export function naturalCompare(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g
  const pa = a.match(re) ?? []
  const pb = b.match(re) ?? []
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const x = pa[i]!
    const y = pb[i]!
    if (x === y) continue
    const nx = /^\d/.test(x)
    const ny = /^\d/.test(y)
    if (nx && ny) {
      const d = Number(x) - Number(y)
      if (d !== 0) return d
      return x.length - y.length // `02` after `2`
    }
    return x < y ? -1 : 1
  }
  return pa.length - pb.length
}

function controller(manifest: AnimManifest, id: string, path: string): Controller {
  const found = manifest.controllers.find((c) => c.id === id)
  if (!found) throw new Error(`${path}: controller "${id}" is not in the manifest`)
  return found
}

function controllerClips(c: Controller): number[] {
  return c.layers.flatMap((layer) => Object.values(layer.states).map((s) => s.clip))
}

/** `anim/LevelCombine1Level1/Walk.json` -> { folder: 'LevelCombine1Level1', stem: 'Walk' } */
function fileParts(file: string): { folder: string; stem: string } {
  const parts = file.split('/')
  const base = parts[parts.length - 1] ?? file
  return { folder: parts.slice(1, -1).join('/'), stem: base.replace(/\.json$/, '') }
}

/** Labels for items whose names repeat: the folder, or folder and file name when the folder is shared too. */
function labelItems(manifest: AnimManifest, clips: number[]): CatalogItem[] {
  const byName = new Map<string, number[]>()
  for (const clip of clips) {
    const name = manifest.clips[clip]!.name
    byName.set(name, [...(byName.get(name) ?? []), clip])
  }
  return clips.map((clip) => {
    const entry = manifest.clips[clip]!
    const same = byName.get(entry.name)!
    let label = entry.name
    if (same.length > 1) {
      const { folder, stem } = fileParts(entry.file)
      const folderShared = same.some((other) => other !== clip && fileParts(manifest.clips[other]!.file).folder === folder)
      const suffix = folderShared ? (folder ? `${folder}/${stem}` : stem) : folder || stem
      label = `${entry.name} (${suffix})`
    }
    return { id: ownItemId(clip), clip, name: entry.name, label, fieldLabel: label, loop: entry.loop, source: null }
  })
}

function sortItems(items: CatalogItem[]): CatalogItem[] {
  return items.sort((a, b) => naturalCompare(a.name, b.name) || naturalCompare(a.label, b.label) || a.clip - b.clip)
}

function buildGroups(manifest: AnimManifest, clips: number[], groupOf: (name: string) => string, order: string[]): CatalogGroup[] {
  const unique = [...new Set(clips)]
  const items = labelItems(manifest, unique)
  return order
    .map((label) => ({ label, items: sortItems(items.filter((item) => groupOf(item.name) === label)) }))
    .filter((group) => group.items.length > 0)
}

/** Clip index of `contexts.fight.idle` (controller, layer, state). Throws if any part does not resolve. */
export function resolveFightIdle(manifest: AnimManifest): number {
  const ref = manifest.contexts.fight.idle
  const path = 'contexts.fight.idle'
  const layer = controller(manifest, ref.controller, path).layers[ref.layer]
  if (!layer) throw new Error(`${path}: controller "${ref.controller}" has no layer ${ref.layer}`)
  const state = layer.states[ref.state]
  if (!state) throw new Error(`${path}: layer ${ref.layer} of controller "${ref.controller}" has no state "${ref.state}"`)
  return state.clip
}

export function buildCatalog(manifest: AnimManifest, context: ContextId): OwnCatalog {
  if (context === 'menu') {
    const menu = manifest.contexts.menu
    const clips = [...controllerClips(controller(manifest, menu.base, 'contexts.menu.base')), menu.idle.clip]
    const groupOf = (name: string) => (name.startsWith('BoardAct') ? 'Board actions' : 'Idle')
    return { groups: buildGroups(manifest, clips, groupOf, ['Idle', 'Board actions']), defaultClip: menu.idle.clip, defaultItem: ownItemId(menu.idle.clip) }
  }
  const fight = manifest.contexts.fight
  const ids = [fight.base, ...(fight.levels ?? [])]
  const clips = ids
    .flatMap((id, i) => controllerClips(controller(manifest, id, i === 0 ? 'contexts.fight.base' : `contexts.fight.levels[${i - 1}]`)))
    .filter((clip) => fightShown(manifest.clips[clip]!.name))
  const defaultClip = resolveFightIdle(manifest)
  return { groups: buildGroups(manifest, preferBaseLayer(manifest, [...new Set(clips)]), fightGroup, FIGHT_ORDER), defaultClip, defaultItem: ownItemId(defaultClip) }
}

/**
 * GlTF node indices hidden for a context and clip: `stateHides[<clip name>]` when the context has an entry for the
 * clip (only Menu has them), otherwise the context's `hiddenNodes`. Bind pose (`clipName` null) uses `hiddenNodes`.
 */
export function hiddenNodesFor(manifest: AnimManifest, context: ContextId, clipName: string | null): number[] {
  if (context === 'menu') {
    const { stateHides, hiddenNodes } = manifest.contexts.menu
    return (clipName !== null ? stateHides[clipName] : undefined) ?? hiddenNodes
  }
  return manifest.contexts.fight.hiddenNodes
}

/**
 * A frame that lends its clips: its Generic clip set, plus named clips of another of its clip sets. An extra either adds clips the
 * Generic set lacks (Stigmata's Solitary Dream) or, with `replace`, lends its clips in place of the same-named Generic ones (Veritas'
 * `BoardAct1005` from Ink-lit Hermit, whose hand sits on the hip) and does not join the frame's own list.
 */
export interface AnimationSource {
  frame: string
  label: string
  manifestPath: string
  manifest: AnimManifest
  extras?: { manifestPath: string; manifest: AnimManifest; clips: readonly string[]; label?: string; replace?: boolean }[]
}

/**
 * The groups a lending frame adds to the list for `context`: its own list (cut down by the same rules), with group labels and item
 * ids that name the frame. Extra clips join the group they belong to; a name the set already has, or that is missing, is skipped,
 * except that a `replace` extra's clip takes the place (group, position, label) of the same-named Generic clip.
 */
export function sourceGroups(source: AnimationSource, context: ContextId): CatalogGroup[] {
  const ref = (manifestPath: string): CatalogSourceRef => ({ frame: source.frame, frameLabel: source.label, manifestPath })
  const lend = (item: CatalogItem, manifestPath: string): CatalogItem => ({
    ...item,
    id: `${source.frame}:${manifestPath}#${item.clip}`,
    fieldLabel: `${source.label} · ${item.label}`,
    source: ref(manifestPath),
  })
  const groups = buildCatalog(source.manifest, context).groups.map((g) => ({ label: g.label, items: g.items.map((i) => lend(i, source.manifestPath)) }))
  for (const extra of source.extras ?? []) {
    for (const group of buildCatalog(extra.manifest, context).groups) {
      const wanted = group.items.filter((i) => extra.clips.includes(i.name))
      if (wanted.length === 0) continue
      let target = groups.find((g) => g.label === group.label)
      if (!target) groups.push((target = { label: group.label, items: [] }))
      for (const item of wanted) {
        const same = target.items.findIndex((i) => i.name === item.name)
        if (same < 0) target.items.push(lend(item, extra.manifestPath))
        else if (extra.replace) target.items[same] = lend(item, extra.manifestPath)
      }
      target.items.sort((a, b) => naturalCompare(a.name, b.name) || naturalCompare(a.label, b.label))
    }
  }
  return groups.map((g) => ({ label: `${source.label} · ${g.label}`, items: g.items }))
}

/**
 * The shown frame's extra clips its shown skin lacks (Solitary Dream's Board actions on Stigmata's other skins), added to its own
 * groups as clips lent by that frame, labelled with the extra's skin.
 */
function ownExtras(own: Catalog, source: AnimationSource, context: ContextId): Catalog {
  const groups = own.groups.map((g) => ({ ...g, items: [...g.items] }))
  const names = new Set(groups.flatMap((g) => g.items.map((i) => i.name)))
  for (const extra of source.extras ?? []) {
    if (extra.replace) continue // lent in place of the Generic clip only; the frame's own skins play their own clips
    for (const group of buildCatalog(extra.manifest, context).groups) {
      const wanted = group.items.filter((i) => extra.clips.includes(i.name) && !names.has(i.name))
      if (wanted.length === 0) continue
      let target = groups.find((g) => g.label === group.label)
      if (!target) groups.push((target = { label: group.label, items: [] }))
      for (const item of wanted) {
        names.add(item.name)
        target.items.push({
          ...item,
          id: `${source.frame}:${extra.manifestPath}#${item.clip}`,
          fieldLabel: `${extra.label ?? source.label} · ${item.label}`,
          source: { frame: source.frame, frameLabel: source.label, manifestPath: extra.manifestPath },
        })
      }
    }
  }
  return { ...own, groups }
}

/** Id of a lending frame's own default clip for `context` (its menu idle, its fight idle) among the items `sourceGroups` lists. */
export function sourceDefaultItem(source: AnimationSource, context: ContextId): string {
  return `${source.frame}:${source.manifestPath}#${buildCatalog(source.manifest, context).defaultClip}`
}

/**
 * The shown frame's list (with its own extras when `ownSource` is given) followed by the groups of every lending frame, in the given
 * order. A frame with no clip set of its own (`own` null) gets the sources' groups only and starts on the first source's default clip; with
 * no source either there is no list (null).
 */
export function withSources(own: Catalog, sources: readonly AnimationSource[], context: ContextId, ownSource?: AnimationSource): Catalog
export function withSources(own: null, sources: readonly AnimationSource[], context: ContextId): Catalog | null
export function withSources(own: Catalog | null, sources: readonly AnimationSource[], context: ContextId, ownSource?: AnimationSource): Catalog | null {
  if (own === null) {
    const first = sources[0]
    if (!first) return null
    return { groups: sources.flatMap((s) => sourceGroups(s, context)), defaultClip: null, defaultItem: sourceDefaultItem(first, context) }
  }
  const shown = ownSource ? ownExtras(own, ownSource, context) : own
  return { ...own, groups: [...shown.groups, ...sources.flatMap((s) => sourceGroups(s, context))] }
}
