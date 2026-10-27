import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assetPath } from '../lib/assetPath.ts'

test('plain paths are unchanged', () => {
  assert.equal(assetPath('shukra', 'anim/manifest.json'), '/shukra/anim/manifest.json')
  assert.equal(assetPath('pavo', 'models/r2qumd010011.glb'), '/pavo/models/r2qumd010011.glb')
  assert.equal(assetPath('shukra', 'voices.json'), '/shukra/voices.json')
})

test('a space in a folder name is encoded (Pavo: anim/Base Layer)', () => {
  assert.equal(assetPath('pavo', 'anim/Base Layer/BoardAct0201.json'), '/pavo/anim/Base%20Layer/BoardAct0201.json')
})

test('other characters that cannot stand in a URL path are encoded per segment, slashes stay', () => {
  assert.equal(assetPath('x', 'a b/c#d/e?f/100%'), '/x/a%20b/c%23d/e%3Ff/100%25')
})
