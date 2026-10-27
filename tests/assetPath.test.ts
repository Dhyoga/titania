import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assetPath } from '../lib/assetPath.ts'

test('plain paths are unchanged', () => {
  assert.equal(assetPath('crepuscule', 'anim/manifest.json'), '/crepuscule/anim/manifest.json')
  assert.equal(assetPath('stigmata', 'models/r4biankamd010031.glb'), '/stigmata/models/r4biankamd010031.glb')
  assert.equal(assetPath('zero', 'voices.json'), '/zero/voices.json')
})

test('a space in a folder name is encoded (Veritas and Zero: anim/Base Layer)', () => {
  assert.equal(assetPath('veritas', 'anim/Base Layer/BoardAct0201.json'), '/veritas/anim/Base%20Layer/BoardAct0201.json')
})

test('other characters that cannot stand in a URL path are encoded per segment, slashes stay', () => {
  assert.equal(assetPath('x', 'a b/c#d/e?f/100%'), '/x/a%20b/c%23d/e%3Ff/100%25')
})
