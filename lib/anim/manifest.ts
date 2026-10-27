// Animation manifest (`anim/manifest.json`, `anim-skins/<skin>/manifest.json`): types and validation.
// Pure TypeScript: no three.js, no Vue, no extension APIs. Only the fields the app uses are validated;
// everything else in the file is ignored. Errors name the field path, e.g. `contexts.menu.hiddenNodes`.

export interface ClipEntry {
  name: string
  /** Path starting with `anim/`, relative to the folder of the manifest (see `resolveClipPath`). */
  file: string
  duration: number
  frameRate: number
  loop: boolean
  rootNode: number
}

export interface StateEntry {
  /** Index into `AnimManifest.clips`. */
  clip: number
  blend?: number[]
  skills?: number[]
}

export interface Layer {
  name: string
  blending: string
  default: string
  states: Record<string, StateEntry>
}

export interface Controller {
  id: string
  layers: Layer[]
}

export interface Mount {
  slot: number
  name: string
  node: number
  skillNode: number | null
}

export interface StateRef {
  controller: string
  layer: number
  state: string
}

export interface MenuContext {
  /** Id of the controller whose states are the menu clips. */
  base: string
  entry: { clip: number }
  idle: { clip: number }
  /** glTF node indices of the original GLB that are hidden in the menu. They differ per skin. */
  hiddenNodes: number[]
  /** Per clip name: node indices hidden while that clip plays. */
  stateHides: Record<string, number[]>
  mounts: Mount[]
}

export interface FightContext {
  base: string
  entry: StateRef
  idle: StateRef
  /** Extra controllers layered on the base one; absent in some skins. */
  levels?: string[]
  hiddenNodes: number[]
  mounts: Mount[]
  /** Blend times between states; not interpreted yet. */
  transitions?: unknown
}

export interface AnimManifest {
  formatVersion: 1
  /** Skin id the clips were exported from; indices in the manifest and in clips are nodes of that GLB. */
  target: string
  model: string
  defaultContext: string
  clips: ClipEntry[]
  controllers: Controller[]
  contexts: { menu: MenuContext; fight: FightContext }
}

type Obj = Record<string, unknown>

function fail(path: string, problem: string): never {
  throw new Error(`manifest ${path}: ${problem}`)
}

function object(value: unknown, path: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'expected an object')
  return value as Obj
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'expected a list')
  return value
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'expected a string')
  return value
}

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'expected a number')
  return value
}

function index(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) fail(path, 'expected a non-negative integer')
  return value
}

function indexList(value: unknown, path: string): number[] {
  return array(value, path).map((item, i) => index(item, `${path}[${i}]`))
}

function parseMounts(value: unknown, path: string): Mount[] {
  return array(value, path).map((item, i) => {
    const m = object(item, `${path}[${i}]`)
    const skillNode = m.skillNode
    return {
      slot: index(m.slot, `${path}[${i}].slot`),
      name: string(m.name, `${path}[${i}].name`),
      node: index(m.node, `${path}[${i}].node`),
      skillNode: skillNode === null || skillNode === undefined ? null : index(skillNode, `${path}[${i}].skillNode`),
    }
  })
}

function parseClipRef(value: unknown, path: string, clipCount: number): { clip: number } {
  const clip = index(object(value, path).clip, `${path}.clip`)
  if (clip >= clipCount) fail(`${path}.clip`, `clip index ${clip} is outside the ${clipCount} clips`)
  return { clip }
}

export function parseManifest(raw: unknown): AnimManifest {
  const root = object(raw, '(root)')
  if (root.formatVersion !== 1) fail('formatVersion', `unsupported version ${String(root.formatVersion)} (expected 1)`)

  const clips: ClipEntry[] = array(root.clips, 'clips').map((item, i) => {
    const c = object(item, `clips[${i}]`)
    const file = string(c.file, `clips[${i}].file`)
    if (!file.startsWith('anim/')) fail(`clips[${i}].file`, `"${file}" does not start with "anim/"`)
    if (typeof c.loop !== 'boolean') fail(`clips[${i}].loop`, 'expected true or false')
    return {
      name: string(c.name, `clips[${i}].name`),
      file,
      duration: finite(c.duration, `clips[${i}].duration`),
      frameRate: finite(c.frameRate, `clips[${i}].frameRate`),
      loop: c.loop,
      rootNode: index(c.rootNode, `clips[${i}].rootNode`),
    }
  })

  const controllers: Controller[] = array(root.controllers, 'controllers').map((item, i) => {
    const c = object(item, `controllers[${i}]`)
    const controllerId = string(c.id, `controllers[${i}].id`)
    const layers = array(c.layers, `controllers[${i}].layers`).map((layerItem, j) => {
      const base = `controllers[${i}].layers[${j}]`
      const l = object(layerItem, base)
      const states: Record<string, StateEntry> = {}
      for (const [stateName, stateValue] of Object.entries(object(l.states, `${base}.states`))) {
        const s = object(stateValue, `${base}.states.${stateName}`)
        const clip = index(s.clip, `${base}.states.${stateName}.clip`)
        if (clip >= clips.length) {
          fail(`${base}.states.${stateName}.clip`, `clip index ${clip} is outside the ${clips.length} clips (controller ${controllerId}, state ${stateName})`)
        }
        const state: StateEntry = { clip }
        if (s.blend !== undefined) state.blend = indexList(s.blend, `${base}.states.${stateName}.blend`)
        if (s.skills !== undefined) state.skills = indexList(s.skills, `${base}.states.${stateName}.skills`)
        states[stateName] = state
      }
      return { name: string(l.name, `${base}.name`), blending: string(l.blending, `${base}.blending`), default: string(l.default, `${base}.default`), states }
    })
    return { id: controllerId, layers }
  })

  const contexts = object(root.contexts, 'contexts')

  const menu = object(contexts.menu, 'contexts.menu')
  const stateHides: Record<string, number[]> = {}
  // Optional: the frames without alternate-state meshes (Stigmata, Veritas, Zero) have neither list.
  for (const [clipName, nodes] of Object.entries(menu.stateHides === undefined ? {} : object(menu.stateHides, 'contexts.menu.stateHides'))) {
    stateHides[clipName] = indexList(nodes, `contexts.menu.stateHides.${clipName}`)
  }
  const menuContext: MenuContext = {
    base: string(menu.base, 'contexts.menu.base'),
    entry: parseClipRef(menu.entry, 'contexts.menu.entry', clips.length),
    idle: parseClipRef(menu.idle, 'contexts.menu.idle', clips.length),
    hiddenNodes: menu.hiddenNodes === undefined ? [] : indexList(menu.hiddenNodes, 'contexts.menu.hiddenNodes'),
    stateHides,
    mounts: parseMounts(menu.mounts, 'contexts.menu.mounts'),
  }

  const fight = object(contexts.fight, 'contexts.fight')
  const stateRef = (value: unknown, path: string): StateRef => {
    const r = object(value, path)
    return { controller: string(r.controller, `${path}.controller`), layer: index(r.layer, `${path}.layer`), state: string(r.state, `${path}.state`) }
  }
  const fightContext: FightContext = {
    base: string(fight.base, 'contexts.fight.base'),
    entry: stateRef(fight.entry, 'contexts.fight.entry'),
    idle: stateRef(fight.idle, 'contexts.fight.idle'),
    hiddenNodes: fight.hiddenNodes === undefined ? [] : indexList(fight.hiddenNodes, 'contexts.fight.hiddenNodes'),
    mounts: parseMounts(fight.mounts, 'contexts.fight.mounts'),
  }
  if (fight.levels !== undefined) fightContext.levels = array(fight.levels, 'contexts.fight.levels').map((id, i) => string(id, `contexts.fight.levels[${i}]`))
  if (fight.transitions !== undefined) fightContext.transitions = fight.transitions

  return {
    formatVersion: 1,
    target: string(root.target, 'target'),
    model: string(root.model, 'model'),
    defaultContext: string(root.defaultContext, 'defaultContext'),
    clips,
    controllers,
    contexts: { menu: menuContext, fight: fightContext },
  }
}
