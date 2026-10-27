import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { crepuscule } from '../lib/constructs/crepuscule.ts'
import { DEFAULT_FRAME, FRAMES, getConstruct } from '../lib/constructs/index.ts'
import { stigmata } from '../lib/constructs/stigmata.ts'
import { veritas } from '../lib/constructs/veritas.ts'
import { zero } from '../lib/constructs/zero.ts'
import { findSkin, initials, skinAssets, skinGroups, skinWidthShare, type SkinConfig } from '../lib/constructs/skins.ts'
import { CHIBI_WIDTH_SHARE, PERSON_WIDTH_SHARE } from '../lib/viewer/framing.ts'

test('Crepuscule: seven skins in strip order, Generic - Final is the default', () => {
  assert.deepEqual(
    crepuscule.skins.map((s) => s.name),
    ['Generic', 'Generic - Modified', 'Generic - Final', 'Thorns of Crimson', 'Night Sonata', 'Sunlit Tides', 'Chibi'],
  )
  assert.equal(crepuscule.skins.find((s) => s.id === crepuscule.defaultSkin)?.name, 'Generic - Final')
  assert.equal(new Set(crepuscule.skins.map((s) => s.id)).size, 7)
})

test('groups are consecutive runs with their labels', () => {
  assert.deepEqual(
    skinGroups(crepuscule.skins).map((g) => [g.label, g.skins.length]),
    [['GENERIC', 3], ['COATINGS', 3], ['CHIBI', 1]],
  )
  const mixed: SkinConfig[] = [
    { id: 'a', name: 'A', group: 'generic', manifest: null },
    { id: 'b', name: 'B', group: 'coating', manifest: null },
    { id: 'c', name: 'C', group: 'generic', manifest: null },
  ]
  assert.deepEqual(skinGroups(mixed).map((g) => g.group), ['generic', 'coating', 'generic'], 'list order is kept')
})

test('asset paths: default anim/, others anim-skins/<id>/, chibi none', () => {
  assert.deepEqual(skinAssets(findSkin(crepuscule.skins, 'r5biankamd010011')), {
    modelPath: 'models/r5biankamd010011.glb',
    manifestPath: 'anim/manifest.json',
    iconPath: 'icons/r5biankamd010011.webp',
  })
  assert.equal(skinAssets(findSkin(crepuscule.skins, 'r5biankamd019241')).manifestPath, 'anim-skins/r5biankamd019241/manifest.json')
  const chibi = skinAssets(findSkin(crepuscule.skins, 'qr5biankamd010011_chibi'))
  assert.equal(chibi.modelPath, 'models/qr5biankamd010011_chibi.glb')
  assert.equal(chibi.manifestPath, null)
  assert.throws(() => findSkin(crepuscule.skins, 'nope'), /Unknown skin: nope/)
})

test('initials for placeholder tiles', () => {
  assert.equal(initials('Thorns of Crimson'), 'TC')
  assert.equal(initials('Generic - Modified'), 'GM')
  assert.equal(initials('Generic'), 'G')
  assert.equal(initials('Night Sonata'), 'NS')
  assert.equal(initials('the of'), '?')
})

test('icons is served; the other served paths are unchanged', () => {
  assert.deepEqual(crepuscule.servedPaths, ['models', 'anim', 'anim-skins', 'voices_ja', 'voices.json', 'icons'])
})

test('the frame list: Crepuscule, Stigmata, Veritas, Zero; the panel opens on Crepuscule', () => {
  assert.deepEqual(FRAMES.map((f) => f.id), ['crepuscule', 'stigmata', 'veritas', 'zero'])
  assert.deepEqual(FRAMES.map((f) => f.displayName), ['Crepuscule', 'Stigmata', 'Veritas', 'Zero'])
  assert.equal(DEFAULT_FRAME, 'crepuscule')
  assert.equal(getConstruct('zero'), zero)
  assert.throws(() => getConstruct('dirge'), /Unknown construct: dirge/)
})

test('every frame: Generic - Final is the default, ids are unique, all serve the same paths', () => {
  for (const frame of FRAMES) {
    assert.equal(frame.skins.find((s) => s.id === frame.defaultSkin)?.name, 'Generic - Final', frame.id)
    assert.equal(new Set(frame.skins.map((s) => s.id)).size, frame.skins.length, frame.id)
    assert.deepEqual(frame.servedPaths, ['models', 'anim', 'anim-skins', 'voices_ja', 'voices.json', 'icons'], frame.id)
    assert.equal(frame.skins.filter((s) => s.manifest === null).length, 1, `${frame.id}: only the chibi has no clips`)
    assert.equal(frame.skins.at(-1)!.group, 'chibi', frame.id)
    // `anim/` belongs to the skin whose id ends in 010011, `anim-skins/<id>/` to the others.
    for (const skin of frame.skins.filter((s) => s.manifest !== null)) {
      assert.equal(skin.manifest, skin.id.endsWith('010011') ? 'anim/manifest.json' : `anim-skins/${skin.id}/manifest.json`, skin.id)
    }
  }
})

test('Stigmata, Veritas and Zero: skins as named on their huaxu pages, battle chibi not offered', () => {
  assert.deepEqual(stigmata.skins.map((s) => s.name), ['Generic', 'Generic - Modified', 'Generic - Final', 'Exorcist', 'Solitary Dream', 'Pyrewatch', 'Chibi'])
  assert.deepEqual(veritas.skins.map((s) => s.name), ['Generic', 'Generic - Modified', 'Generic - Final', 'Pact of Zero', 'Spring Huntress', 'Ink-lit Hermit', 'Grace', 'Chibi'])
  assert.deepEqual(zero.skins.map((s) => s.name), ['Generic', 'Generic - Modified', 'Generic - Final', 'Gray Feathers: Zero', 'Thistle', 'Chibi'])
  assert.ok(!stigmata.skins.some((s) => s.id === 'q4biankamd010011'))
  assert.deepEqual(skinGroups(zero.skins).map((g) => [g.label, g.skins.length]), [['GENERIC', 3], ['COATINGS', 2], ['CHIBI', 1]])
  assert.equal(initials('Gray Feathers: Zero'), 'GF')
  assert.equal(initials('Ink-lit Hermit'), 'IL') // the first two words, split at hyphens too
})

// Real data: every model and manifest exists, each manifest was exported for its skin, and (after the scrape) every icon exists.
const skip = !FRAMES.every((f) => existsSync(new URL(`../data/${f.id}/models/`, import.meta.url))) && 'data/ is not present'

for (const frame of FRAMES) {
  test(`${frame.id}: every skin model and manifest exists, each manifest targets its skin, every icon exists`, { skip }, () => {
    const dataDir = new URL(`../data/${frame.id}/`, import.meta.url)
    for (const skin of frame.skins) {
      const { modelPath, manifestPath, iconPath } = skinAssets(skin)
      assert.ok(existsSync(new URL(modelPath, dataDir)), modelPath)
      assert.ok(existsSync(new URL(iconPath, dataDir)), `${iconPath} (run download_construct.py ${frame.id})`)
      if (manifestPath === null) continue
      const manifest = JSON.parse(readFileSync(new URL(manifestPath, dataDir), 'utf8')) as { target: string }
      assert.equal(manifest.target, skin.id, manifestPath)
    }
  })
}

test('width share of the default framing: a person is limited to part of the bounds, a chibi keeps all of it', () => {
  for (const frame of FRAMES) {
    for (const skin of frame.skins) {
      assert.equal(skinWidthShare(skin), skin.group === 'chibi' ? CHIBI_WIDTH_SHARE : PERSON_WIDTH_SHARE, `${frame.id}/${skin.id}`)
    }
  }
  assert.ok(PERSON_WIDTH_SHARE < CHIBI_WIDTH_SHARE)
})
