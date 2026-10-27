// The skeleton of a model as the retargeting code needs it, read from the glTF JSON (no three.js, no binary buffers): node names,
// parents, rest transforms and the names of each mesh's morph targets.
import { stripModelPrefix } from './names.ts'
import type { Quat, Vec3 } from './quat.ts'

export interface RigNode {
  name: string
  /** Index of the parent node, or -1 for a scene root. */
  parent: number
  /** Rest transform (glTF TRS; scale is not used by the retargeting). */
  translation: Vec3
  rotation: Quat
  /** Morph target names of the node's mesh (`mesh.extras.targetNames`), or null when the node has no morphed mesh. */
  morphTargets: string[] | null
}

export interface Rig {
  nodes: RigNode[]
  /** Node index by name; the first node wins when a name repeats (hair and cloth bones do, `Bip001…` bones never). */
  byName: Map<string, number>
  /** Node indices with every parent before its children. */
  order: number[]
}

interface GltfJson {
  nodes?: { name?: string; children?: number[]; translation?: number[]; rotation?: number[]; matrix?: number[]; mesh?: number }[]
  meshes?: { extras?: { targetNames?: unknown } }[]
}

function vec(value: number[] | undefined, fallback: number[], length: number, path: string): number[] {
  if (value === undefined) return fallback
  if (!Array.isArray(value) || value.length !== length || value.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
    throw new Error(`rig: ${path} is not a list of ${length} numbers`)
  }
  return value
}

/** The rig of a model from its glTF JSON. Throws on node matrices (not used by these models) and broken hierarchies. */
export function rigFromGltf(raw: unknown): Rig {
  const json = raw as GltfJson
  if (typeof json !== 'object' || json === null || !Array.isArray(json.nodes)) throw new Error('rig: no node list')
  const src = json.nodes
  const parents = new Array<number>(src.length).fill(-1)
  src.forEach((node, i) => {
    for (const child of node.children ?? []) {
      if (!Number.isInteger(child) || child < 0 || child >= src.length) throw new Error(`rig: nodes[${i}] has child ${child} outside the node list`)
      if (parents[child] !== -1) throw new Error(`rig: node ${child} has two parents`)
      parents[child] = i
    }
  })
  const nodes: RigNode[] = src.map((node, i) => {
    if (node.matrix !== undefined) throw new Error(`rig: nodes[${i}] uses a matrix, not translation/rotation`)
    const targetNames = node.mesh === undefined ? undefined : json.meshes?.[node.mesh]?.extras?.targetNames
    return {
      name: node.name ?? '',
      parent: parents[i]!,
      translation: vec(node.translation, [0, 0, 0], 3, `nodes[${i}].translation`) as Vec3,
      rotation: vec(node.rotation, [0, 0, 0, 1], 4, `nodes[${i}].rotation`) as Quat,
      morphTargets: Array.isArray(targetNames) && targetNames.every((n) => typeof n === 'string') ? (targetNames as string[]) : null,
    }
  })

  const byName = new Map<string, number>()
  nodes.forEach((node, i) => {
    if (!byName.has(node.name)) byName.set(node.name, i)
  })

  const order: number[] = []
  const placed = new Array<boolean>(nodes.length).fill(false)
  const place = (i: number, depth: number): void => {
    if (placed[i]) return
    if (depth > nodes.length) throw new Error('rig: the node hierarchy has a cycle')
    const p = nodes[i]!.parent
    if (p >= 0) place(p, depth + 1)
    placed[i] = true
    order.push(i)
  }
  for (let i = 0; i < nodes.length; i++) place(i, 0)
  return { nodes, byName, order }
}

/**
 * The role of a morphed mesh, which pairs face meshes across models: its name without the model prefix and without a trailing `EX`
 * (`R5BiankaMd010011FaceEX` → `Face`, `R3Bianka01001Eye` → `Eye`, `Cheek` → `Cheek`).
 */
export function meshRole(name: string): string {
  return stripModelPrefix(name).replace(/EX\d*$/, '')
}
