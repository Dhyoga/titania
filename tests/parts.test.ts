import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  choicesElsewhere,
  groupMeshes,
  hasChoicesHere,
  hiddenNodeSet,
  isMeshShown,
  lightFormChoices,
  listMeshes,
  partStem,
  partsToSave,
  stripModelPrefix,
  type Mesh,
} from '../lib/viewer/parts.ts'

test('stems: prefix, EX markers and trailing numbers are dropped', () => {
  const cases: [string, string | null][] = [
    ['R5BiankaMd019271Cloth02EX', 'Cloth'],
    ['R5BiankaMd019271Cloth01', 'Cloth'],
    ['R5BiankaMd019241Alpha03_1EX', 'Alpha'],
    ['R5BiankaMd019271BodyEX_2', 'Body'],
    ['R5BiankaMd010011Hair01', 'Hair'],
    ['R5BiankaMd010011Eye', 'Eye'],
    ['R5BiankaMd010011FaceEX', 'Face'],
    ['R5BiankaMd019241Alpha07_1', 'Alpha'],
    ['R5BiankaMd019271FashiEX02', 'Fashi'],
    ['R5BiankaMd019011Alpha01EX', 'Alpha'],
    ['QR5BiankaMd010011', null], // the chibi: nothing after the model code
    ['R5BiankaMd010011', null],
    ['R5BiankaMd010011EX', null],
  ]
  for (const [name, stem] of cases) assert.equal(partStem(name), stem, name)
})

const GENERIC_FINAL = [
  { index: 2, name: 'R5BiankaMd010011Alpha' },
  { index: 4, name: 'R5BiankaMd010011Body' },
  { index: 10, name: 'R5BiankaMd010031Down' },
  { index: 393, name: 'R5BiankaMd010011Alpha01' },
  { index: 392, name: 'R5BiankaMd010011BodyEX02' },
  { index: 7, name: 'R5BiankaMd010011Hair02' },
  { index: 8, name: 'R5BiankaMd010011Hair10' },
  { index: 9, name: 'R5BiankaMd010011Hair01' },
  { index: 70, name: 'QR5BiankaMd010011' },
]

test('meshes: label and model id come from the name; a mesh named only after the model is not listed', () => {
  const meshes = listMeshes(GENERIC_FINAL)
  assert.equal(meshes.length, 8)
  assert.deepEqual(meshes[2], { index: 10, name: 'R5BiankaMd010031Down', label: 'Down', group: '010031' })
  // A name without a prefix is listed under its full name in the Other group.
  assert.deepEqual(listMeshes([{ index: 1, name: 'Cheek' }]), [{ index: 1, name: 'Cheek', label: 'Cheek', group: 'Other' }])
  assert.deepEqual(listMeshes([{ index: 1, name: '' }]), [])
})

test('meshes: five-digit model ids (Veritas, Zero) and other spellings of the prefix', () => {
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
  const groups = groupMeshes(listMeshes(GENERIC_FINAL))
  assert.deepEqual(groups.map((g) => g.id), ['010011', '010031'])
  assert.deepEqual(groups[0]!.meshes.map((m) => m.label), ['Alpha', 'Alpha01', 'Body', 'BodyEX02', 'Hair01', 'Hair02', 'Hair10'])
  assert.deepEqual(groups[1]!.meshes.map((m) => m.label), ['Down'])
  assert.deepEqual(groupMeshes([]), [])
})

test('hidden set: the manifest list, then the choices on top', () => {
  const meshes = listMeshes(GENERIC_FINAL)
  const sorted = (set: Set<number>) => [...set].sort((a, b) => a - b)
  assert.deepEqual(sorted(hiddenNodeSet([392], meshes, {})), [392])
  assert.deepEqual(sorted(hiddenNodeSet([392], meshes, { R5BiankaMd010011Hair01: 'hide' })), [9, 392])
  assert.deepEqual(sorted(hiddenNodeSet([392], meshes, { R5BiankaMd010011BodyEX02: 'show' })), [], 'show beats the manifest')
  assert.deepEqual(sorted(hiddenNodeSet([392], meshes, { R5BiankaMd019271Hat: 'hide' })), [392], 'a name the model lacks is ignored')
})

test('shown: a choice wins over the manifest', () => {
  const [alpha, , , , bodyEx] = listMeshes(GENERIC_FINAL) as [Mesh, Mesh, Mesh, Mesh, Mesh]
  const hidden = new Set([392])
  assert.equal(isMeshShown(alpha, hidden, {}), true)
  assert.equal(isMeshShown(bodyEx, hidden, {}), false)
  assert.equal(isMeshShown(bodyEx, hidden, { [bodyEx.name]: 'show' }), true)
  assert.equal(isMeshShown(alpha, hidden, { [alpha.name]: 'hide' }), false)
})

test('Light form: LightDisable meshes hidden, the other ModelCase meshes shown; nothing without the tags', () => {
  const meshes = listMeshes(GENERIC_FINAL)
  const tags = (list: { name: string; nodes: number[] }[]) => ({ scenes: [{ extras: { objectTags: list } }] })
  const json = tags([
    { name: 'ModelCase', nodes: [2, 4, 10, 392, 393] },
    { name: 'LightDisable', nodes: [392] },
    { name: 'DarkDisable', nodes: [2, 4, 393] },
  ])
  assert.deepEqual(lightFormChoices(json, meshes), {
    R5BiankaMd010011Alpha: 'show',
    R5BiankaMd010011Body: 'show',
    R5BiankaMd010031Down: 'show',
    R5BiankaMd010011BodyEX02: 'hide',
    R5BiankaMd010011Alpha01: 'show',
  })
  assert.deepEqual(lightFormChoices(tags([{ name: 'ModelCase', nodes: [2] }]), meshes), {}, 'no LightDisable tag')
  assert.deepEqual(lightFormChoices({ scenes: [{}] }, meshes), {})
  assert.deepEqual(lightFormChoices(null, meshes), {})
})

// Real data: the part lists of every shipped model. Skipped without data/.
const dataDir = new URL('../data/crepuscule/models/', import.meta.url)
const skip = !existsSync(new URL('r5biankamd010011.glb', dataDir)) && 'data/crepuscule is not present'

function meshes(file: string): { index: number; name: string }[] {
  const b = readFileSync(new URL(file, dataDir))
  const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) as { nodes: { name: string; mesh?: number }[] }
  return json.nodes.flatMap((n, index) => (n.mesh === undefined ? [] : [{ index, name: n.name }]))
}

test('real models: every skin lists its meshes in groups; the chibi lists none', { skip }, () => {
  const expected: Record<string, [string, number][]> = {
    r5biankamd010011: [['010011', 17]],
    r5biankamd010031: [['010011', 14], ['010031', 3]],
  }
  for (const [id, groups] of Object.entries(expected)) {
    assert.deepEqual(groupMeshes(listMeshes(meshes(`${id}.glb`))).map((g) => [g.id, g.meshes.length]), groups, id)
  }
  for (const id of ['r5biankamd010021', 'r5biankamd019011', 'r5biankamd019241', 'r5biankamd019271']) {
    const list = meshes(`${id}.glb`)
    assert.equal(listMeshes(list).length, list.length, `${id}: every mesh is listed`)
  }
  assert.deepEqual(listMeshes(meshes('qr5biankamd010011_chibi.glb')), [], 'the chibi has no list')
})

test('real models: the default skin keeps its manifest hides when Hair01 is hidden', { skip }, () => {
  const list = listMeshes(meshes('r5biankamd010011.glb'))
  const hidden = hiddenNodeSet([392, 394, 395, 396], list, { R5BiankaMd010011Hair01: 'hide' })
  assert.deepEqual([...hidden].sort((a, b) => a - b), [8, 392, 394, 395, 396])
})

test('real models: the Generic skins\' Light form hides the dark meshes in idle and in Board actions, body and veil shown', { skip }, () => {
  const light = ['AlphaEX', 'AlphaEX01', 'Band', 'BodyEX01', 'BodyEX02', 'FaceEX']
  for (const id of ['r5biankamd010011', 'r5biankamd010021', 'r5biankamd010031']) {
    const b = readFileSync(new URL(`${id}.glb`, dataDir))
    const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) as unknown
    const list = listMeshes(meshes(`${id}.glb`))
    const choices = lightFormChoices(json, list)
    // UiStand1 (the menu list) and a Board action's stateHides, which shows the dark veil and hides Body and Alpha.
    for (const manifestHidden of [[392, 394, 395, 396], [2, 4, 392, 393, 396]]) {
      const hidden = hiddenNodeSet(manifestHidden, list, choices)
      assert.deepEqual(list.filter((m) => hidden.has(m.index)).map((m) => m.label).sort(), light, `${id} ${manifestHidden}`)
    }
  }
  for (const id of ['r5biankamd019011', 'qr5biankamd010011_chibi']) {
    const b = readFileSync(new URL(`${id}.glb`, dataDir))
    const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) as unknown
    if (id.startsWith('q')) assert.deepEqual(lightFormChoices(json, listMeshes(meshes(`${id}.glb`))), {}, 'the chibi has no form tags')
    else assert.ok(Object.keys(lightFormChoices(json, listMeshes(meshes(`${id}.glb`)))).length > 0, 'coatings carry the tags too (not used)')
  }
})

test('real models of Stigmata, Veritas and Zero: groups per skin, the battle chibi and Stigmata\'s dorm chibi list nothing', { skip: !existsSync(new URL('../data/stigmata/models/r4biankamd010031.glb', import.meta.url)) && 'data/ is not present' }, () => {
  const groups = (frame: string, id: string) => {
    const b = readFileSync(new URL(`../data/${frame}/models/${id}.glb`, import.meta.url))
    const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) as { nodes: { name: string; mesh?: number }[] }
    const refs = json.nodes.flatMap((n, index) => (n.mesh === undefined ? [] : [{ index, name: n.name }]))
    return groupMeshes(listMeshes(refs)).map((g) => `${g.id}:${g.meshes.length}`)
  }
  assert.deepEqual(groups('stigmata', 'r4biankamd010011'), ['010011:7'])
  assert.deepEqual(groups('stigmata', 'r4biankamd010031'), ['010011:3', '010031:5'])
  assert.deepEqual(groups('stigmata', 'r4biankamd019281'), ['010011:2', '019281:8'])
  assert.deepEqual(groups('stigmata', 'q4biankamd010011'), [])
  assert.deepEqual(groups('stigmata', 'qr4biankamd010011_chibi'), [])
  assert.deepEqual(groups('veritas', 'r3biankamd010011'), ['01001:6'])
  assert.deepEqual(groups('veritas', 'r3biankamd010031'), ['01001:3', '01003:3'])
  assert.deepEqual(groups('veritas', 'r3biankamd019101'), ['01001:3', '019101:6'], 'its Hair02 is spelled R3Bianka0191011Hair02 in the model (label 1Hair02)')
  assert.deepEqual(groups('veritas', 'r3biankamd019131'), ['019131:8'])
  assert.deepEqual(groups('veritas', 'qr3biankamd010011_chibi'), ['010011:1'], 'the chibi has a body (not listed) and a sleeve: one listed mesh disables the parts menu')
  assert.deepEqual(groups('zero', 'r2biankamd010011'), ['01001:7', 'Other:1'])
  assert.deepEqual(groups('zero', 'r2biankamd010031'), ['01001:2', '01003:4', 'Other:1'])
  assert.deepEqual(groups('zero', 'r2biankamd019011'), ['01001:2', '019011:3', 'Other:1'])
  assert.deepEqual(groups('zero', 'qr2biankamd010011_chibi'), [])
})

test('stripModelPrefix: one rule for five- and six-digit prefixes; names without one are kept', () => {
  assert.equal(stripModelPrefix('R5BiankaMd010031Body'), 'Body')
  assert.equal(stripModelPrefix('R5BiankaMd010011BodyOL'), 'BodyOL')
  assert.equal(stripModelPrefix('R3Bianka01001Eye'), 'Eye')
  assert.equal(stripModelPrefix('R2AolisuoMd019011Cloth'), 'Cloth')
  assert.equal(stripModelPrefix('Cheek'), 'Cheek')
})

// ---- saved parts (user-preferences)

const sunlit = new Set(['R5BiankaMd019271Hat', 'R5BiankaMd019271Hair01', 'R5BiankaMd019271BodyEX'])
const generic = new Set(['R5BiankaMd010011Hair01', 'R5BiankaMd010011Band', 'R5BiankaMd010011Body'])

test('Save stores the shown state of the model\'s meshes', () => {
  assert.deepEqual(partsToSave({}, { R5BiankaMd019271Hat: 'hide' }, sunlit, {}), { R5BiankaMd019271Hat: 'hide' })
  // an unsaved choice wins over what was saved; what was saved and not changed stays
  assert.deepEqual(
    partsToSave({ R5BiankaMd019271Hat: 'hide', R5BiankaMd019271Hair01: 'hide' }, { R5BiankaMd019271Hair01: 'show' }, sunlit, {}),
    { R5BiankaMd019271Hat: 'hide', R5BiankaMd019271Hair01: 'show' },
  )
  // `show` of a mesh the manifest hides is a choice worth keeping
  assert.deepEqual(partsToSave({}, { R5BiankaMd019271BodyEX: 'show' }, sunlit, {}), { R5BiankaMd019271BodyEX: 'show' })
})

test('Save leaves out what the default form already says', () => {
  const form = { R5BiankaMd010011Band: 'hide', R5BiankaMd010011Body: 'show' } as const
  assert.deepEqual(partsToSave({}, { R5BiankaMd010011Band: 'show' }, generic, form), { R5BiankaMd010011Band: 'show' })
  // back to the form: the saved entry goes
  assert.deepEqual(partsToSave({ R5BiankaMd010011Band: 'show' }, { R5BiankaMd010011Band: 'hide' }, generic, form), {})
})

test('Save keeps a saved name the model lacks and does not save another model\'s unsaved choice', () => {
  const saved = { R5BiankaMd019271Hat: 'hide', Gone: 'hide' } as const
  const unsaved = { R5BiankaMd010011Hair01: 'hide' } as const // made on Generic, not on this model
  assert.deepEqual(partsToSave(saved, unsaved, sunlit, {}), { R5BiankaMd019271Hat: 'hide', Gone: 'hide' })
})

test('after Save or Forget saved, the unsaved choices for other models are kept', () => {
  // Hair01 hidden on Generic without saving, then Hat hidden and saved on Sunlit Tides: Generic's Hair01 must survive
  const unsaved = { R5BiankaMd010011Hair01: 'hide', R5BiankaMd019271Hat: 'hide' } as const
  assert.deepEqual(choicesElsewhere(unsaved, sunlit), { R5BiankaMd010011Hair01: 'hide' })
  assert.deepEqual(choicesElsewhere(unsaved, generic), { R5BiankaMd019271Hat: 'hide' })
  assert.deepEqual(choicesElsewhere({}, sunlit), {})
})

test('there is something to save only when an unsaved choice changes this model', () => {
  assert.equal(hasChoicesHere({}, sunlit, {}), false)
  assert.equal(hasChoicesHere({ R5BiankaMd019271Hat: 'hide' }, sunlit, {}), true)
  // only choices for another model: nothing to save here
  assert.equal(hasChoicesHere({ R5BiankaMd010011Hair01: 'hide' }, sunlit, {}), false)
  // a choice that equals what this skin already shows (saved, else the default form): nothing to save
  assert.equal(hasChoicesHere({ R5BiankaMd019271Hat: 'hide' }, sunlit, { R5BiankaMd019271Hat: 'hide' }), false)
  assert.equal(hasChoicesHere({ R5BiankaMd010011Band: 'hide' }, generic, { R5BiankaMd010011Band: 'hide' }), false)
  assert.equal(hasChoicesHere({ R5BiankaMd010011Band: 'show' }, generic, { R5BiankaMd010011Band: 'hide' }), true)
})
