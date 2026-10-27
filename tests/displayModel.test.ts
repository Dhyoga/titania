import assert from 'node:assert/strict'
import { test } from 'node:test'
import { displaySkins, resolveDisplayModel } from '../lib/constructs/display.ts'
import { DEFAULT_FRAME, FRAMES, getConstruct } from '../lib/constructs/index.ts'

const resolve = (frame: string | null, skin: string | null) => resolveDisplayModel(FRAMES, { frame, skin }, DEFAULT_FRAME)

test('nothing saved: Crepuscule Generic - Final', () => {
  assert.deepEqual(resolve(null, null), { frame: 'crepuscule', skin: 'r5biankamd010031' })
})

test('a saved skin of a frame is shown', () => {
  assert.deepEqual(resolve('stigmata', 'r4biankamd019241'), { frame: 'stigmata', skin: 'r4biankamd019241' })
  assert.deepEqual(resolve('veritas', 'r3biankamd019191'), { frame: 'veritas', skin: 'r3biankamd019191' })
})

test('an unknown frame gives the default model', () => {
  assert.deepEqual(resolve('dirge', 'r5biankamd010031'), { frame: 'crepuscule', skin: 'r5biankamd010031' })
})

test('a skin that the frame lacks, or a chibi, gives the frame default skin', () => {
  assert.deepEqual(resolve('veritas', 'r5biankamd019241'), { frame: 'veritas', skin: getConstruct('veritas').defaultSkin })
  assert.deepEqual(resolve('crepuscule', 'qr5biankamd010011_chibi'), { frame: 'crepuscule', skin: 'r5biankamd010031' })
  assert.deepEqual(resolve('zero', null), { frame: 'zero', skin: getConstruct('zero').defaultSkin })
})

test('Display lists every skin but the dorm chibi', () => {
  for (const frame of FRAMES) {
    const skins = displaySkins(frame)
    assert.equal(skins.length, frame.skins.length - 1, frame.id)
    assert.ok(skins.every((s) => s.group !== 'chibi'), frame.id)
    assert.ok(skins.some((s) => s.id === frame.defaultSkin), frame.id)
  }
  assert.deepEqual(
    displaySkins(getConstruct('crepuscule')).map((s) => s.name),
    ['Generic', 'Generic - Modified', 'Generic - Final', 'Thorns of Crimson', 'Night Sonata', 'Sunlit Tides'],
  )
})
