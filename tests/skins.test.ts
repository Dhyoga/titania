import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DEFAULT_FRAME, FRAMES, getConstruct } from '../lib/constructs/index.ts'
import { pavo } from '../lib/constructs/pavo.ts'
import { shukra } from '../lib/constructs/shukra.ts'
import { findSkin, initials, skinAssets, skinGroups, skinWidthShare, type SkinConfig } from '../lib/constructs/skins.ts'
import { CHIBI_WIDTH_SHARE, PERSON_WIDTH_SHARE } from '../lib/viewer/framing.ts'

// The skin helpers are generic (coatings and chibis exist in the type), so those cases use made-up skins; the real frames are Qu's,
// each with its Generic skin only.
const synthetic: SkinConfig[] = [
  { id: 'x010011', name: 'Generic', group: 'generic', manifest: 'anim/manifest.json' },
  { id: 'x019241', name: 'Night Sonata', group: 'coating', manifest: 'anim-skins/x019241/manifest.json' },
  { id: 'qx010011_chibi', name: 'Chibi', group: 'chibi', manifest: null },
]

test('Shukra and Pavo: one Generic skin each, which is also the default', () => {
  assert.deepEqual(shukra.skins, [{ id: 'r3qumd010011', name: 'Generic', group: 'generic', manifest: 'anim/manifest.json' }])
  assert.deepEqual(pavo.skins, [{ id: 'r2qumd010011', name: 'Generic', group: 'generic', manifest: 'anim/manifest.json' }])
  assert.equal(shukra.defaultSkin, 'r3qumd010011')
  assert.equal(pavo.defaultSkin, 'r2qumd010011')
})

test('the strip lists one group, Generic, with one tile', () => {
  for (const frame of FRAMES) {
    assert.deepEqual(skinGroups(frame.skins).map((g) => [g.label, g.skins.length]), [['GENERIC', 1]], frame.id)
  }
})

test('groups are consecutive runs with their labels, and a group without skins is not listed', () => {
  assert.deepEqual(skinGroups(synthetic).map((g) => [g.label, g.skins.length]), [['GENERIC', 1], ['COATINGS', 1], ['CHIBI', 1]])
  const mixed: SkinConfig[] = [
    { id: 'a', name: 'A', group: 'generic', manifest: null },
    { id: 'b', name: 'B', group: 'coating', manifest: null },
    { id: 'c', name: 'C', group: 'generic', manifest: null },
  ]
  assert.deepEqual(skinGroups(mixed).map((g) => g.group), ['generic', 'coating', 'generic'], 'list order is kept')
  assert.deepEqual(skinGroups([]), [])
})

test('asset paths: Generic anim/, others anim-skins/<id>/, chibi none', () => {
  assert.deepEqual(skinAssets(findSkin(shukra.skins, 'r3qumd010011')), {
    modelPath: 'models/r3qumd010011.glb',
    manifestPath: 'anim/manifest.json',
    iconPath: 'icons/r3qumd010011.webp',
  })
  assert.equal(skinAssets(findSkin(synthetic, 'x019241')).manifestPath, 'anim-skins/x019241/manifest.json')
  const chibi = skinAssets(findSkin(synthetic, 'qx010011_chibi'))
  assert.equal(chibi.modelPath, 'models/qx010011_chibi.glb')
  assert.equal(chibi.manifestPath, null)
  assert.throws(() => findSkin(shukra.skins, 'nope'), /Unknown skin: nope/)
})

test('initials for placeholder tiles', () => {
  assert.equal(initials('Generic'), 'G')
  assert.equal(initials('Generic - Modified'), 'GM')
  assert.equal(initials('Thorns of Crimson'), 'TC')
  assert.equal(initials('Ink-lit Hermit'), 'IL') // the first two words, split at hyphens too
  assert.equal(initials('the of'), '?')
})

test('the frame list: Shukra, Pavo; the panel opens on Shukra', () => {
  assert.deepEqual(FRAMES.map((f) => f.id), ['shukra', 'pavo'])
  assert.deepEqual(FRAMES.map((f) => f.displayName), ['Shukra', 'Pavo'])
  assert.equal(DEFAULT_FRAME, 'shukra')
  assert.equal(getConstruct('pavo'), pavo)
  assert.throws(() => getConstruct('crepuscule'), /Unknown construct: crepuscule/)
})

test('every frame: Generic is the default, ids are unique, all serve the same paths without anim-skins', () => {
  for (const frame of FRAMES) {
    assert.equal(frame.skins.find((s) => s.id === frame.defaultSkin)?.name, 'Generic', frame.id)
    assert.equal(new Set(frame.skins.map((s) => s.id)).size, frame.skins.length, frame.id)
    assert.deepEqual(frame.servedPaths, ['models', 'anim', 'voices_ja', 'voices.json', 'icons'], frame.id)
    assert.ok(frame.skins.every((s) => s.group === 'generic' && s.manifest === 'anim/manifest.json'), `${frame.id}: no coating or chibi`)
    assert.ok(frame.skins.every((s) => s.id.endsWith('010011')), `${frame.id}: \`anim/\` belongs to the skin whose id ends in 010011`)
  }
})

// Real data: every model and manifest exists, each manifest was exported for its skin, and every icon exists.
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
  for (const skin of [...FRAMES.flatMap((f) => f.skins), ...synthetic]) {
    assert.equal(skinWidthShare(skin), skin.group === 'chibi' ? CHIBI_WIDTH_SHARE : PERSON_WIDTH_SHARE, skin.id)
  }
  assert.ok(PERSON_WIDTH_SHARE < CHIBI_WIDTH_SHARE)
})
