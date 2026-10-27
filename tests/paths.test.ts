import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveClipPath, targetModelPath } from '../lib/anim/paths.ts'

test('default skin: the manifest folder is anim/', () => {
  assert.equal(resolveClipPath('anim/manifest.json', 'anim/BaseLayer/Born.json'), 'anim/BaseLayer/Born.json')
  assert.equal(resolveClipPath('anim/manifest.json', 'anim/UiStand1.json'), 'anim/UiStand1.json')
})

test('other skins: clips sit next to their own manifest', () => {
  assert.equal(
    resolveClipPath('anim-skins/r5biankamd019241/manifest.json', 'anim/BaseLayer/BoardAct0204.json'),
    'anim-skins/r5biankamd019241/BaseLayer/BoardAct0204.json',
  )
  assert.equal(resolveClipPath('anim-skins/r5biankamd019241/manifest.json', 'anim/UiStand1.json'), 'anim-skins/r5biankamd019241/UiStand1.json')
})

test('a manifest at the root keeps the stripped path', () => {
  assert.equal(resolveClipPath('manifest.json', 'anim/UiStand1.json'), 'UiStand1.json')
})

test('a clip file without the anim/ prefix is an error naming the file', () => {
  assert.throws(() => resolveClipPath('anim/manifest.json', 'BaseLayer/Born.json'), /BaseLayer\/Born\.json/)
  assert.throws(() => resolveClipPath('anim/manifest.json', 'animation/Born.json'), /animation\/Born\.json/)
})

test('a clip set comes from the model its manifest targets', () => {
  assert.equal(targetModelPath('r4biankamd019241'), 'models/r4biankamd019241.glb')
})
