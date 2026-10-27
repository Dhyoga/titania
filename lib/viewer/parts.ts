// Meshes of a model and the user's show/hide choices for them. Pure TypeScript, no three.js, so it runs in Node tests.
//
// A skin is built from 6 to 43 meshes, among them alternate-state "EX" copies that the animation manifest swaps in and out
// per clip (`Alpha`, `AlphaEX`, `AlphaEX01`). The manifest decides which are hidden in the current state; the user can
// override that per mesh (hide a shown one, show a hidden one) or hide a whole model-id group at once.

import { MODEL_PREFIX as PREFIX, stripModelPrefix } from '../anim/names.ts'

export { stripModelPrefix }

export interface MeshRef {
  /** glTF node index. */
  index: number
  name: string
}

/** A mesh as the parts popover lists it. */
export interface Mesh {
  /** glTF node index. */
  index: number
  /** Node name, the key of the user's choices (it carries over to a skin that has a mesh of the same name). */
  name: string
  /** Name without the model prefix (`Alpha01`, `BodyEX01`). */
  label: string
  /** The model id inside the prefix (`010031`, or `01001` on Veritas and Zero): the model a mesh was built for. A skin can mix several. `Other` for a name without a prefix. */
  group: string
}

/** The user's choice for one mesh; no entry means "as the animation data says". */
export type MeshOverride = 'hide' | 'show'

export interface MeshGroup {
  id: string
  /** Sorted by label, numbers by value. */
  meshes: Mesh[]
}


/** Group of the meshes whose name has no prefix (Zero's `Cheek`). */
export const OTHER_GROUP = 'Other'


/**
 * The part a mesh belongs to: its node name without the model prefix, without every `EX` marker and without trailing digits and
 * underscores (`R5BiankaMd019271Cloth02EX` → `Cloth`, `Alpha03_1EX` → `Alpha`, `BodyEX_2` → `Body`). Null when nothing is left
 * (the chibi's single mesh is named after the model).
 */
export function partStem(nodeName: string): string | null {
  const rest = stripModelPrefix(nodeName)
  const stem = rest.replace(/EX/g, '').replace(/[\d_]+$/, '')
  return stem === '' ? null : stem
}

/**
 * The meshes of a model, from its node list. A mesh whose name is only a prefix (a dorm chibi's body) is not listed; a name
 * without a prefix is listed under its full name in the `Other` group.
 */
export function listMeshes(refs: readonly MeshRef[]): Mesh[] {
  const meshes: Mesh[] = []
  for (const { index, name } of refs) {
    const match = PREFIX.exec(name)
    if (!match) {
      if (name !== '') meshes.push({ index, name, label: name, group: OTHER_GROUP })
      continue
    }
    if (match[0].length === name.length) continue
    meshes.push({ index, name, label: name.slice(match[0].length), group: match[1]! })
  }
  return meshes
}

const byLabel = (a: Mesh, b: Mesh): number => a.label.localeCompare(b.label, 'en', { numeric: true })

/** Meshes grouped by model id (ascending, `Other` last), each group sorted by label. */
export function groupMeshes(meshes: readonly Mesh[]): MeshGroup[] {
  const byId = new Map<string, Mesh[]>()
  for (const mesh of meshes) {
    const list = byId.get(mesh.group)
    if (list) list.push(mesh)
    else byId.set(mesh.group, [mesh])
  }
  const order = (id: string): string => (id === OTHER_GROUP ? '\uffff' : id)
  return [...byId.entries()].sort(([a], [b]) => (order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : 0)).map(([id, list]) => ({ id, meshes: list.sort(byLabel) }))
}

/** Node indices to hide: the manifest's list, then the user's choices on top (`hide` adds, `show` removes). */
export function hiddenNodeSet(manifestHidden: readonly number[], meshes: readonly Mesh[], overrides: Readonly<Record<string, MeshOverride>>): Set<number> {
  const hidden = new Set(manifestHidden)
  for (const mesh of meshes) {
    const choice = overrides[mesh.name]
    if (choice === 'hide') hidden.add(mesh.index)
    else if (choice === 'show') hidden.delete(mesh.index)
  }
  return hidden
}

/** Whether a mesh is shown: the user's choice if there is one, else the manifest's list. */
export function isMeshShown(mesh: Mesh, manifestHidden: ReadonlySet<number>, overrides: Readonly<Record<string, MeshOverride>>): boolean {
  const choice = overrides[mesh.name]
  return choice ? choice === 'show' : !manifestHidden.has(mesh.index)
}

type Choices = Readonly<Record<string, MeshOverride>>

/**
 * What "Save" stores for a skin (`user-preferences`): the shown state of the model's meshes (the unsaved choice, else what was saved).
 * A saved name the model lacks is kept; an unsaved choice for a name it lacks belongs to another model and is not saved here.
 */
export function partsToSave(saved: Choices, unsaved: Choices, present: ReadonlySet<string>): Record<string, MeshOverride> {
  const next: Record<string, MeshOverride> = {}
  for (const [name, choice] of Object.entries(saved)) if (!present.has(name)) next[name] = choice
  for (const name of present) {
    const choice = unsaved[name] ?? saved[name]
    if (choice !== undefined) next[name] = choice
  }
  return next
}

/** The unsaved choices for names the model lacks: what is left after Save or Forget saved on it (they are kept for other models). */
export function choicesElsewhere(unsaved: Choices, present: ReadonlySet<string>): Record<string, MeshOverride> {
  const rest: Record<string, MeshOverride> = {}
  for (const [name, choice] of Object.entries(unsaved)) if (!present.has(name)) rest[name] = choice
  return rest
}

/** Whether the model has something to save: an unsaved choice for one of its meshes that differs from what it shows without it (`base`). */
export function hasChoicesHere(unsaved: Choices, present: ReadonlySet<string>, base: Choices): boolean {
  return Object.entries(unsaved).some(([name, choice]) => present.has(name) && base[name] !== choice)
}
