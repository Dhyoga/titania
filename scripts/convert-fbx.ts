// Converts a source folder (Model.fbx and its PNG textures) into a GLB under data/erza/models/, with the conventions of Qu's models so that
// lib/anim/rig.ts, retarget.ts and the viewer need nothing special for it (design D1, D2 of add-erza-model):
//   * Y up, metres, facing -Z: a source that faces +Z gets a parent node `Root` turned 180 degrees about Y (never a mirroring);
//   * the node transforms are the pose the mesh was bound in (the skin's bind matrices), so the skinned mesh is undeformed at rest;
//   * names that start with `Bip001` are written without separators (`Bip001 L Thigh` -> `Bip001LThigh`), the others as the file gives them;
//   * one mesh node `Erza_Body`; the weapon (its own material, and every triangle skinned to a `Bone_wq_*` bone) is left out unless `--weapon`
//     keeps it as a second mesh node `Erza_Weapon` on the same skin;
//   * the diffuse PNG of each material and its `_SH` shadow-colour PNG are embedded; the material's extras name the shadow texture.
//
// Usage (from the repository root):
//   node scripts/convert-fbx.ts <source folder> [--out <file.glb>] [--weapon]
//   node scripts/convert-fbx.ts "data/erza/source/Erza Scarlet"
// The output defaults to data/erza/models/<folder name as a slug>.glb; `--out` must stay under data/erza/. The script reads only the source
// folder (Model.fbx and the PNGs the FBX names; the DAE, OBJ and MTL are not used), writes only the one file, and gives the same bytes every time.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

const REPO = resolve(import.meta.dirname, '..')
const WEAPON_BONE = /^Bone_wq_/
const WEAPON_TEXTURE = /_weapon$/i

function fail(message: string): never {
  console.error(`convert-fbx: ${message}`)
  process.exit(1)
}

/** `Bip001 L Thigh` and its loader spelling `Bip001_L_Thigh` -> `Bip001LThigh`; other names are kept. */
export function normaliseName(name: string): string {
  return name.startsWith('Bip001') ? name.replace(/[ _]/g, '') : name
}

/** The file stem of a folder as a slug: `Erza Scarlet` -> `erza-scarlet`. */
export function slugOf(folder: string): string {
  return basename(folder).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

interface Options {
  source: string
  out: string
  weapon: boolean
}

function parseArgs(argv: string[]): Options {
  let source: string | undefined
  let out: string | undefined
  let weapon = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--weapon') weapon = true
    else if (arg === '--out') out = argv[++i] ?? fail('--out needs a file name')
    else if (arg.startsWith('--')) fail(`unknown option ${arg}`)
    else if (source === undefined) source = arg
    else fail(`unexpected argument ${arg}`)
  }
  if (source === undefined) fail('usage: node scripts/convert-fbx.ts <source folder> [--out <file.glb>] [--weapon]')
  const folder = resolve(source)
  const target = resolve(out ?? join(REPO, 'data', 'erza', 'models', `${slugOf(folder)}.glb`))
  const allowed = join(REPO, 'data', 'erza') + sep
  if (!target.startsWith(allowed)) fail(`the output must be under ${allowed} (got ${target})`)
  if (target.startsWith(folder + sep)) fail('the output must not be inside the source folder')
  return { source: folder, out: target, weapon }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Reading the FBX

interface Source {
  skinned: THREE.SkinnedMesh
  /** The Bone objects of the skeleton, parents before children, from the root bone down. */
  bones: THREE.Object3D[]
  /** Diffuse file name of each material of the skinned mesh. */
  textureFiles: string[]
}

function readFbx(folder: string): Source {
  const file = join(folder, 'Model.fbx')
  if (!existsSync(file)) fail(`${file} does not exist`)
  const bytes = readFileSync(file)
  // The loader's texture loader needs a DOM; the PNGs are read from disk by the writer, so the loader only gets to learn the file names.
  const manager = new THREE.LoadingManager()
  const stub = {
    path: '',
    setPath() {
      return this
    },
    load(url: string) {
      const texture = new THREE.Texture()
      texture.userData.file = url
      return texture
    },
  }
  manager.addHandler(/\.(png|jpe?g|tga|bmp)$/i, stub as unknown as THREE.Loader)
  const root = new FBXLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, folder + sep)
  root.updateMatrixWorld(true)

  const skinned: THREE.SkinnedMesh[] = []
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh)
  })
  if (skinned.length !== 1) fail(`expected one skinned mesh, found ${skinned.length}`)
  const mesh = skinned[0]!
  if (!(mesh.geometry.getIndex() === null)) fail('expected an unindexed geometry')

  // The skeleton's Bone objects form their own tree (the loader also builds a tree of plain groups for the model nodes, which is not used).
  let top: THREE.Object3D = mesh.skeleton.bones[0]!
  while (top.parent && (top.parent as THREE.Bone).isBone) top = top.parent
  const bones: THREE.Object3D[] = []
  const visit = (o: THREE.Object3D): void => {
    bones.push(o)
    for (const child of o.children) if ((child as THREE.Bone).isBone) visit(child)
  }
  visit(top)
  for (const b of mesh.skeleton.bones) if (!bones.includes(b)) fail(`bone ${b.name} is outside the bone tree`)
  let groups = 0
  root.traverse((o) => {
    if (o !== root && !(o as THREE.Bone).isBone && !(o as THREE.Mesh).isMesh) groups++
  })
  if (groups > 0) console.log(`convert-fbx: left out ${groups} plain group nodes of the loader's scene tree (a copy of the bone tree, the camera target); only the skeleton is written`)

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  const textureFiles = materials.map((m) => {
    const map = (m as THREE.MeshPhongMaterial).map
    const name = map?.userData.file as string | undefined
    if (name === undefined) fail(`material ${m.name} has no texture`)
    return basename(name.replace(/\\/g, '/'))
  })
  return { skinned: mesh, bones, textureFiles }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// glTF writer

interface Primitive {
  materialSlot: number
  positions: number[]
  normals: number[]
  uvs: number[]
  joints: number[]
  weights: number[]
  indices: number[]
}

/** Appends data to the binary chunk with 4-byte alignment and returns the buffer view it became. */
class BinaryChunk {
  private parts: Buffer[] = []
  private size = 0
  readonly views: Record<string, unknown>[] = []

  add(data: Buffer, target?: number): number {
    const view: Record<string, unknown> = { buffer: 0, byteOffset: this.size, byteLength: data.length }
    if (target !== undefined) view.target = target
    this.views.push(view)
    this.parts.push(data)
    this.size += data.length
    const pad = (4 - (data.length % 4)) % 4
    if (pad > 0) {
      this.parts.push(Buffer.alloc(pad))
      this.size += pad
    }
    return this.views.length - 1
  }

  get bytes(): Buffer {
    return Buffer.concat(this.parts)
  }
}

const f32 = (values: ArrayLike<number>): Buffer => Buffer.from(new Float32Array(values).buffer)

/** A number as it is written to JSON: single precision, so the file does not depend on double-precision noise. */
const round = (x: number): number => Number(Math.fround(x).toPrecision(8))

function glb(json: unknown, bin: Buffer): Buffer {
  const text = Buffer.from(JSON.stringify(json), 'utf8')
  const jsonPad = Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)
  const binPad = Buffer.alloc((4 - (bin.length % 4)) % 4)
  const jsonLength = text.length + jsonPad.length
  const binLength = bin.length + binPad.length
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonLength + 8 + binLength, 8)
  const jsonHead = Buffer.alloc(8)
  jsonHead.writeUInt32LE(jsonLength, 0)
  jsonHead.writeUInt32LE(0x4e4f534a, 4)
  const binHead = Buffer.alloc(8)
  binHead.writeUInt32LE(binLength, 0)
  binHead.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, jsonHead, text, jsonPad, binHead, bin, binPad])
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Conversion

function convert(options: Options): Buffer {
  const { skinned, bones, textureFiles } = readFbx(options.source)
  const skeleton = skinned.skeleton
  const geometry = skinned.geometry
  const position = geometry.attributes.position!
  const normal = geometry.attributes.normal!
  const uv = geometry.attributes.uv!
  const skinIndex = geometry.attributes.skinIndex!
  const skinWeight = geometry.attributes.skinWeight!
  const triangleCount = position.count / 3
  if (!Number.isInteger(triangleCount)) fail('the vertex count is not a multiple of 3')

  // Bind world matrices (in the space of skinned.bindMatrix * vertex): the inverse of each skinned bone's inverse bind matrix; the bones
  // the mesh is not skinned to (Bip001, the props) take their pose in the scene, which the bind pose shares.
  const jointOf = new Map<THREE.Object3D, number>()
  skeleton.bones.forEach((b, i) => jointOf.set(b, i))
  const bindWorld = new Map<THREE.Object3D, THREE.Matrix4>()
  let sceneVersusBind = 0
  for (const b of bones) {
    const joint = jointOf.get(b)
    const scene = b.matrixWorld.clone()
    if (joint === undefined) {
      bindWorld.set(b, scene)
    } else {
      const bind = skeleton.boneInverses[joint]!.clone().invert()
      sceneVersusBind = Math.max(sceneVersusBind, new THREE.Vector3().setFromMatrixPosition(bind).distanceTo(new THREE.Vector3().setFromMatrixPosition(scene)))
      bindWorld.set(b, bind)
    }
  }

  // Nodes: 0 is `Root`; then the bones depth first; then the mesh nodes.
  const nodeOf = new Map<THREE.Object3D, number>()
  bones.forEach((b, i) => nodeOf.set(b, i + 1))
  const names = bones.map((b) => normaliseName(b.name))
  const seen = new Set<string>()
  for (const name of names) {
    if (seen.has(name)) fail(`two nodes are named ${name} once normalised`)
    seen.add(name)
  }
  const nodes: Record<string, unknown>[] = [{ name: 'Root', rotation: [0, 1, 0, 0], children: [1] }]
  let scaleDrift = 0
  const tmpP = new THREE.Vector3()
  const tmpQ = new THREE.Quaternion()
  const tmpS = new THREE.Vector3()
  bones.forEach((b, i) => {
    const world = bindWorld.get(b)!
    const parent = b.parent && nodeOf.has(b.parent) ? bindWorld.get(b.parent)! : new THREE.Matrix4()
    const local = parent.clone().invert().multiply(world)
    local.decompose(tmpP, tmpQ, tmpS)
    scaleDrift = Math.max(scaleDrift, Math.abs(tmpS.x - 1), Math.abs(tmpS.y - 1), Math.abs(tmpS.z - 1))
    if (tmpQ.w < 0) tmpQ.set(-tmpQ.x, -tmpQ.y, -tmpQ.z, -tmpQ.w)
    const node: Record<string, unknown> = { name: names[i] }
    const children = b.children.filter((c) => nodeOf.has(c)).map((c) => nodeOf.get(c)!)
    if (children.length > 0) node.children = children
    if (tmpP.lengthSq() > 0) node.translation = [round(tmpP.x), round(tmpP.y), round(tmpP.z)]
    node.rotation = [round(tmpQ.x), round(tmpQ.y), round(tmpQ.z), round(tmpQ.w)]
    nodes.push(node)
  })
  if (scaleDrift > 1e-3) console.warn(`convert-fbx: a bone is scaled by up to ${scaleDrift.toFixed(4)}; scale is not written`)
  if (sceneVersusBind > 1e-3) console.warn(`convert-fbx: the scene pose differs from the bind pose by up to ${sceneVersusBind.toFixed(4)} m; the bind pose is written`)

  // Triangles: which go to the body and which to the weapon.
  const boneName = (v: number): string => {
    let best = 0
    let bestIndex = 0
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(v, k)
      if (w > best) {
        best = w
        bestIndex = skinIndex.getComponent(v, k)
      }
    }
    return skeleton.bones[bestIndex]!.name
  }
  const groupOf = new Array<number>(position.count)
  for (const g of geometry.groups) for (let v = g.start; v < g.start + g.count; v++) groupOf[v] = g.materialIndex ?? 0
  const materialIsWeapon = textureFiles.map((f) => WEAPON_TEXTURE.test(f.replace(/\.[^.]+$/, '')))

  const bind = skinned.bindMatrix
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(bind)
  const body = new Map<number, Primitive>()
  const weapon = new Map<number, Primitive>()
  const vertexIds = new Map<string, number>()
  const dropped = { weaponMaterial: 0, weaponBones: 0 }
  const tmpV = new THREE.Vector3()
  const tmpN = new THREE.Vector3()
  const addVertex = (prim: Primitive, key: string, v: number): number => {
    const found = vertexIds.get(key)
    if (found !== undefined) return found
    const id = prim.positions.length / 3
    vertexIds.set(key, id)
    tmpV.fromBufferAttribute(position, v).applyMatrix4(bind)
    tmpN.fromBufferAttribute(normal, v).applyMatrix3(normalMatrix).normalize()
    prim.positions.push(Math.fround(tmpV.x), Math.fround(tmpV.y), Math.fround(tmpV.z))
    prim.normals.push(Math.fround(tmpN.x), Math.fround(tmpN.y), Math.fround(tmpN.z))
    // FBX texture coordinates start at the bottom left, glTF's at the top left.
    prim.uvs.push(Math.fround(uv.getX(v)), Math.fround(1 - uv.getY(v)))
    let total = 0
    for (let k = 0; k < 4; k++) total += skinWeight.getComponent(v, k)
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(v, k) / (total || 1)
      prim.joints.push(w > 0 ? skinIndex.getComponent(v, k) : 0)
      prim.weights.push(Math.fround(w))
    }
    return id
  }
  for (let t = 0; t < triangleCount; t++) {
    const slot = groupOf[t * 3]!
    const viaBone = [0, 1, 2].some((k) => WEAPON_BONE.test(boneName(t * 3 + k)))
    const isWeapon = materialIsWeapon[slot]! || viaBone
    if (isWeapon && !options.weapon) {
      if (materialIsWeapon[slot]!) dropped.weaponMaterial++
      else dropped.weaponBones++
      continue
    }
    const set = isWeapon ? weapon : body
    let prim = set.get(slot)
    if (prim === undefined) {
      prim = { materialSlot: slot, positions: [], normals: [], uvs: [], joints: [], weights: [], indices: [] }
      set.set(slot, prim)
    }
    // Vertices are shared only inside one primitive (and one mesh node): the key carries the set and the slot.
    for (let k = 0; k < 3; k++) {
      const v = t * 3 + k
      const key = `${isWeapon ? 'w' : 'b'}${slot}|${[position, normal, uv, skinIndex, skinWeight].map((a) => Array.from({ length: a.itemSize }, (_, c) => a.getComponent(v, c)).join(',')).join('|')}`
      prim.indices.push(addVertex(prim, key, v))
    }
  }
  if (!options.weapon && dropped.weaponMaterial + dropped.weaponBones > 0) {
    console.log(`convert-fbx: dropped ${dropped.weaponMaterial} triangles of the weapon material and ${dropped.weaponBones} triangles skinned to ${WEAPON_BONE} bones (use --weapon to keep them)`)
  }

  // Binary chunk, accessors, textures and materials.
  const bin = new BinaryChunk()
  const accessors: Record<string, unknown>[] = []
  const accessor = (view: number, componentType: number, count: number, type: string, extra: Record<string, unknown> = {}): number => {
    accessors.push({ bufferView: view, componentType, count, type, ...extra })
    return accessors.length - 1
  }

  const images: Record<string, unknown>[] = []
  const textures: Record<string, unknown>[] = []
  const imageIndexOf = new Map<string, number>()
  const textureIndex = (file: string): number | null => {
    const path = join(options.source, file)
    if (!existsSync(path)) return null
    let image = imageIndexOf.get(file)
    if (image === undefined) {
      image = images.length
      images.push({ name: file.replace(/\.[^.]+$/, ''), mimeType: 'image/png', bufferView: bin.add(readFileSync(path)) })
      imageIndexOf.set(file, image)
    }
    const texture = textures.findIndex((t) => t.source === image)
    if (texture >= 0) return texture
    textures.push({ sampler: 0, source: image })
    return textures.length - 1
  }

  const materials: Record<string, unknown>[] = []
  const materialIndexOf = new Map<number, number>()
  const materialFor = (slot: number): number => {
    const found = materialIndexOf.get(slot)
    if (found !== undefined) return found
    const file = textureFiles[slot]!
    const stem = file.replace(/\.[^.]+$/, '')
    const diffuse = textureIndex(file)
    if (diffuse === null) fail(`the texture ${file} is not in ${options.source}`)
    const shadow = textureIndex(`${stem}_SH.png`)
    const material: Record<string, unknown> = {
      name: stem,
      pbrMetallicRoughness: { baseColorTexture: { index: diffuse }, metallicFactor: 0, roughnessFactor: 1 },
      doubleSided: false,
    }
    if (shadow !== null) material.extras = { family: 'diffuseShadow', shadowTexture: shadow }
    else console.warn(`convert-fbx: ${stem}_SH.png is missing; ${stem} gets no shadow-colour texture`)
    materials.push(material)
    materialIndexOf.set(slot, materials.length - 1)
    return materials.length - 1
  }

  const primitiveOf = (p: Primitive): Record<string, unknown> => {
    let min = [Infinity, Infinity, Infinity]
    let max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < p.positions.length; i += 3) {
      min = min.map((m, k) => Math.min(m, p.positions[i + k]!))
      max = max.map((m, k) => Math.max(m, p.positions[i + k]!))
    }
    const count = p.positions.length / 3
    const attributes = {
      POSITION: accessor(bin.add(f32(p.positions), 34962), 5126, count, 'VEC3', { min: min.map(round), max: max.map(round) }),
      NORMAL: accessor(bin.add(f32(p.normals), 34962), 5126, count, 'VEC3'),
      TEXCOORD_0: accessor(bin.add(f32(p.uvs), 34962), 5126, count, 'VEC2'),
      JOINTS_0: accessor(bin.add(Buffer.from(new Uint16Array(p.joints).buffer), 34962), 5123, count, 'VEC4'),
      WEIGHTS_0: accessor(bin.add(f32(p.weights), 34962), 5126, count, 'VEC4'),
    }
    const wide = count > 65535
    const indices = accessor(bin.add(Buffer.from((wide ? new Uint32Array(p.indices) : new Uint16Array(p.indices)).buffer), 34963), wide ? 5125 : 5123, p.indices.length, 'SCALAR')
    return { attributes, indices, material: materialFor(p.materialSlot), mode: 4 }
  }

  const meshes: Record<string, unknown>[] = []
  const addMesh = (name: string, set: Map<number, Primitive>): number | null => {
    if (set.size === 0) return null
    const primitives = [...set.keys()].sort((a, b) => a - b).map((slot) => primitiveOf(set.get(slot)!))
    meshes.push({ name, primitives })
    return meshes.length - 1
  }
  const bodyMesh = addMesh('Erza_Body', body)
  if (bodyMesh === null) fail('the body has no triangles')
  const weaponMesh = options.weapon ? addMesh('Erza_Weapon', weapon) : null

  // The skin: every skeleton bone is a joint, the inverse bind matrix of each is the inverse of its bind world matrix.
  const ibm = new Float32Array(skeleton.bones.length * 16)
  skeleton.bones.forEach((b, i) => ibm.set(bindWorld.get(b)!.clone().invert().elements, i * 16))
  const skin = {
    name: 'Skin',
    inverseBindMatrices: accessor(bin.add(Buffer.from(ibm.buffer)), 5126, skeleton.bones.length, 'MAT4'),
    skeleton: 1,
    joints: skeleton.bones.map((b) => nodeOf.get(b)!),
  }

  // Mesh nodes sit under Root at identity: the vertices were baked into the space of the bind world matrices.
  const rootChildren = nodes[0]!.children as number[]
  for (const [name, mesh] of [['Erza_Body', bodyMesh], ['Erza_Weapon', weaponMesh]] as const) {
    if (mesh === null) continue
    nodes.push({ name, mesh, skin: 0 })
    rootChildren.push(nodes.length - 1)
  }

  const json = {
    asset: { version: '2.0', generator: 'titania scripts/convert-fbx.ts' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    meshes,
    skins: [skin],
    materials,
    textures,
    images,
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    accessors,
    bufferViews: bin.views,
    buffers: [{ byteLength: bin.bytes.length }],
  }
  const triangles = [...body.values(), ...(options.weapon ? [...weapon.values()] : [])].reduce((n, p) => n + p.indices.length / 3, 0)
  console.log(`convert-fbx: ${bones.length} bones, ${triangles} triangles, ${materials.length} materials, ${textures.length} textures`)
  return glb(json, bin.bytes)
}

if (import.meta.main) {
  const options = parseArgs(process.argv.slice(2))
  const output = convert(options)
  mkdirSync(dirname(options.out), { recursive: true })
  writeFileSync(options.out, output)
  console.log(`convert-fbx: wrote ${relative(REPO, options.out)} (${output.length} bytes)`)
}
