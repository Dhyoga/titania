import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  choicesElsewhere,
  groupMeshes,
  hasChoicesHere,
  hiddenNodeSet,
  isMeshShown,
  listMeshes,
  partStem,
  partsToSave,
  stripModelPrefix,
  type Mesh,
} from '../lib/viewer/parts.ts'

test('stems: prefix, EX markers and trailing numbers are dropped', () => {
  const cases: [string, string | null][] = [
    ['R3QuMd010011Cloth02EX', 'Cloth'],
    ['R3QuMd010011Cloth01', 'Cloth'],
    ['R3QuMd010031Alpha03_1EX', 'Alpha'],
    ['R3QuMd010011BodyEX_2', 'Body'],
    ['R3QuMd010011Hair01', 'Hair'],
    ['R2QuMd010011Eye', 'Eye'],
    ['R2QuMd010011FaceEX', 'Face'],
    ['R2QuMd010011Alpha07_1', 'Alpha'],
    ['R3QuMd010011FashiEX02', 'Fashi'],
    ['R3QuMd019011Alpha01EX', 'Alpha'],
    ['QR3QuMd010011', null], // a chibi: nothing after the model code
    ['R3QuMd010011', null],
    ['R3QuMd010011EX', null],
  ]
  for (const [name, stem] of cases) assert.equal(partStem(name), stem, name)
})

// A made-up skin built from two model ids and an alternate-state copy: it exercises grouping and the manifest's hides, which Qu's real
// models (one id, no hidden nodes) do not.
const SYNTHETIC = [
  { index: 2, name: 'R3QuMd010011Alpha' },
  { index: 4, name: 'R3QuMd010011Body' },
  { index: 10, name: 'R3QuMd010031Down' },
  { index: 393, name: 'R3QuMd010011Alpha01' },
  { index: 392, name: 'R3QuMd010011BodyEX02' },
  { index: 7, name: 'R3QuMd010011Hair02' },
  { index: 8, name: 'R3QuMd010011Hair10' },
  { index: 9, name: 'R3QuMd010011Hair01' },
  { index: 70, name: 'QR3QuMd010011' },
]

test('meshes: label and model id come from the name; a mesh named only after the model is not listed', () => {
  const meshes = listMeshes(SYNTHETIC)
  assert.equal(meshes.length, 8)
  assert.deepEqual(meshes[2], { index: 10, name: 'R3QuMd010031Down', label: 'Down', group: '010031' })
  // A name without a prefix is listed under its full name in the Other group.
  assert.deepEqual(listMeshes([{ index: 1, name: 'Cheek' }]), [{ index: 1, name: 'Cheek', label: 'Cheek', group: 'Other' }])
  assert.deepEqual(listMeshes([{ index: 1, name: '' }]), [])
})

test('meshes: five-digit model ids and other spellings of the prefix', () => {
  const meshes = listMeshes([
    { index: 1, name: 'R3Bianka01001Eye' },
    { index: 2, name: 'R3Bianka019101Upper001' },
    { index: 3, name: 'R2AolisuoMd019011Body' },
    { index: 4, name: 'QR3BiankaMd010011' }, // a dorm chibi's body: only a prefix
    { index: 5, name: 'QR3BiankaMd010011Sleeve' },
    { index: 6, name: 'Cheek' },
  ])
  assert.deepEqual(meshes.map((m) => [m.label, m.group]), [['Eye', '01001'], ['Upper001', '019101'], ['Body', '019011'], ['Sleeve', '010011'], ['Cheek', 'Other']])
  assert.deepEqual(groupMeshes(meshes).map((g) => g.id), ['01001', '010011', '019011', '019101', 'Other'], 'ascending, Other last')
  assert.equal(partStem('R3Bianka01001Eye'), 'Eye')
})

test('groups: by model id ascending, labels sorted with numbers by value', () => {
  const groups = groupMeshes(listMeshes(SYNTHETIC))
  assert.deepEqual(groups.map((g) => g.id), ['010011', '010031'])
  assert.deepEqual(groups[0]!.meshes.map((m) => m.label), ['Alpha', 'Alpha01', 'Body', 'BodyEX02', 'Hair01', 'Hair02', 'Hair10'])
  assert.deepEqual(groups[1]!.meshes.map((m) => m.label), ['Down'])
  assert.deepEqual(groupMeshes([]), [])
})

test('hidden set: the manifest list, then the choices on top', () => {
  const meshes = listMeshes(SYNTHETIC)
  const sorted = (set: Set<number>) => [...set].sort((a, b) => a - b)
  assert.deepEqual(sorted(hiddenNodeSet([392], meshes, {})), [392])
  assert.deepEqual(sorted(hiddenNodeSet([392], meshes, { R3QuMd010011Hair01: 'hide' })), [9, 392])
  assert.deepEqual(sorted(hiddenNodeSet([392], meshes, { R3QuMd010011BodyEX02: 'show' })), [], 'show beats the manifest')
  assert.deepEqual(sorted(hiddenNodeSet([392], meshes, { R2QuMd010011Hat: 'hide' })), [392], 'a name the model lacks is ignored')
})

test('shown: a choice wins over the manifest', () => {
  const [alpha, , , , bodyEx] = listMeshes(SYNTHETIC) as [Mesh, Mesh, Mesh, Mesh, Mesh]
  const hidden = new Set([392])
  assert.equal(isMeshShown(alpha, hidden, {}), true)
  assert.equal(isMeshShown(bodyEx, hidden, {}), false)
  assert.equal(isMeshShown(bodyEx, hidden, { [bodyEx.name]: 'show' }), true)
  assert.equal(isMeshShown(alpha, hidden, { [alpha.name]: 'hide' }), false)
})

// Real data: the part lists of Qu's two Generic models. Skipped without data/.
const models = (frame: string, id: string) => new URL(`../data/${frame}/models/${id}.glb`, import.meta.url)
const skip = !(existsSync(models('shukra', 'r3qumd010011')) && existsSync(models('pavo', 'r2qumd010011'))) && 'data/ is not present'

function meshes(frame: string, id: string): { index: number; name: string }[] {
  const b = readFileSync(models(frame, id))
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) as { nodes: { name: string; mesh?: number }[] }
  return json.nodes.flatMap((n, index) => (n.mesh === undefined ? [] : [{ index, name: n.name }]))
}

test('real models: Shukra\'s ten meshes and Pavo\'s eight are listed in one group each, from the node names', { skip }, () => {
  const labels = (frame: string, id: string) => groupMeshes(listMeshes(meshes(frame, id))).map((g) => [g.id, g.meshes.map((m) => m.label)])
  assert.deepEqual(labels('shukra', 'r3qumd010011'), [['010011', ['Alpha', 'Body', 'Down', 'Eye', 'Face', 'Hair01', 'Hair02', 'Huangyu', 'Upper', 'Weapon']]])
  assert.deepEqual(labels('pavo', 'r2qumd010011'), [['010011', ['Bead', 'Body', 'Cloth', 'Eye', 'Face', 'Hair01', 'Hair02', 'Head']]])
})

test('real models: hiding Hair01 hides that mesh alone (no manifest hides)', { skip }, () => {
  for (const [frame, id, prefix] of [['shukra', 'r3qumd010011', 'R3QuMd010011'], ['pavo', 'r2qumd010011', 'R2QuMd010011']] as const) {
    const list = listMeshes(meshes(frame, id))
    const hidden = hiddenNodeSet([], list, { [`${prefix}Hair01`]: 'hide' })
    assert.deepEqual(list.filter((m) => hidden.has(m.index)).map((m) => m.label), ['Hair01'], frame)
  }
})

test('stripModelPrefix: one rule for five- and six-digit prefixes; names without one are kept', () => {
  assert.equal(stripModelPrefix('R3QuMd010031Body'), 'Body')
  assert.equal(stripModelPrefix('R2QuMd010011BodyOL'), 'BodyOL')
  assert.equal(stripModelPrefix('R3Bianka01001Eye'), 'Eye')
  assert.equal(stripModelPrefix('R2AolisuoMd019011Cloth'), 'Cloth')
  assert.equal(stripModelPrefix('Cheek'), 'Cheek')
})

// ---- saved parts (user-preferences)

const shukra = new Set(['R3QuMd010011Weapon', 'R3QuMd010011Hair01', 'R3QuMd010011Body'])
const pavo = new Set(['R2QuMd010011Bead', 'R2QuMd010011Hair01', 'R2QuMd010011Body'])

test('Save stores the shown state of the model\'s meshes', () => {
  assert.deepEqual(partsToSave({}, { R3QuMd010011Weapon: 'hide' }, shukra), { R3QuMd010011Weapon: 'hide' })
  // an unsaved choice wins over what was saved; what was saved and not changed stays
  assert.deepEqual(
    partsToSave({ R3QuMd010011Weapon: 'hide', R3QuMd010011Hair01: 'hide' }, { R3QuMd010011Hair01: 'show' }, shukra),
    { R3QuMd010011Weapon: 'hide', R3QuMd010011Hair01: 'show' },
  )
  // `show` of a mesh the manifest hides is a choice worth keeping
  assert.deepEqual(partsToSave({}, { R3QuMd010011Body: 'show' }, shukra), { R3QuMd010011Body: 'show' })
})

test('Save keeps a saved name the model lacks and does not save another model\'s unsaved choice', () => {
  const saved = { R3QuMd010011Weapon: 'hide', Gone: 'hide' } as const
  const unsaved = { R2QuMd010011Hair01: 'hide' } as const // made on Pavo, not on this model
  assert.deepEqual(partsToSave(saved, unsaved, shukra), { R3QuMd010011Weapon: 'hide', Gone: 'hide' })
})

test('after Save or Forget saved, the unsaved choices for other models are kept', () => {
  // Hair01 hidden on Pavo without saving, then Weapon hidden and saved on Shukra: Pavo's Hair01 must survive
  const unsaved = { R2QuMd010011Hair01: 'hide', R3QuMd010011Weapon: 'hide' } as const
  assert.deepEqual(choicesElsewhere(unsaved, shukra), { R2QuMd010011Hair01: 'hide' })
  assert.deepEqual(choicesElsewhere(unsaved, pavo), { R3QuMd010011Weapon: 'hide' })
  assert.deepEqual(choicesElsewhere({}, shukra), {})
})

test('there is something to save only when an unsaved choice changes this model', () => {
  assert.equal(hasChoicesHere({}, shukra, {}), false)
  assert.equal(hasChoicesHere({ R3QuMd010011Weapon: 'hide' }, shukra, {}), true)
  // only choices for another model: nothing to save here
  assert.equal(hasChoicesHere({ R2QuMd010011Hair01: 'hide' }, shukra, {}), false)
  // a choice that equals what this skin already shows (what is saved): nothing to save
  assert.equal(hasChoicesHere({ R3QuMd010011Weapon: 'hide' }, shukra, { R3QuMd010011Weapon: 'hide' }), false)
  assert.equal(hasChoicesHere({ R3QuMd010011Weapon: 'show' }, shukra, { R3QuMd010011Weapon: 'hide' }), true)
})
