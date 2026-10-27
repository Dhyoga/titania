import assert from 'node:assert/strict'
import { test } from 'node:test'
import { displaySkins, resolveDisplayModel } from '../lib/constructs/display.ts'
import { DEFAULT_FRAME, FRAMES, getConstruct, type ConstructConfig } from '../lib/constructs/index.ts'

const resolve = (frame: string | null, skin: string | null) => resolveDisplayModel(FRAMES, { frame, skin }, DEFAULT_FRAME)

// Qu has no chibi skin, so the chibi cases run on a frame of Shukra's with one added.
const withChibi: ConstructConfig = {
  ...getConstruct('shukra'),
  skins: [...getConstruct('shukra').skins, { id: 'qr3qumd010011_chibi', name: 'Chibi', group: 'chibi', manifest: null }],
}

test('nothing saved: Shukra Generic', () => {
  assert.deepEqual(resolve(null, null), { frame: 'shukra', skin: 'r3qumd010011' })
})

test('a saved skin of a frame is shown', () => {
  assert.deepEqual(resolve('pavo', 'r2qumd010011'), { frame: 'pavo', skin: 'r2qumd010011' })
  assert.deepEqual(resolve('shukra', 'r3qumd010011'), { frame: 'shukra', skin: 'r3qumd010011' })
})

test('an unknown frame (a Bianca frame from a PGR preferences file) gives the default model', () => {
  assert.deepEqual(resolve('crepuscule', 'r5biankamd010031'), { frame: 'shukra', skin: 'r3qumd010011' })
})

test('a skin that the frame lacks gives the frame default skin', () => {
  assert.deepEqual(resolve('pavo', 'r3qumd010011'), { frame: 'pavo', skin: getConstruct('pavo').defaultSkin })
  assert.deepEqual(resolve('pavo', null), { frame: 'pavo', skin: 'r2qumd010011' })
})

test('a chibi is not a Display model', () => {
  assert.deepEqual(resolveDisplayModel([withChibi], { frame: 'shukra', skin: 'qr3qumd010011_chibi' }, 'shukra'), { frame: 'shukra', skin: 'r3qumd010011' })
})

test('Display lists every skin but a chibi', () => {
  assert.deepEqual(displaySkins(withChibi).map((s) => s.id), ['r3qumd010011'])
  for (const frame of FRAMES) {
    const skins = displaySkins(frame)
    assert.ok(skins.every((s) => s.group !== 'chibi'), frame.id)
    assert.ok(skins.some((s) => s.id === frame.defaultSkin), frame.id)
  }
  assert.deepEqual(displaySkins(getConstruct('shukra')).map((s) => s.name), ['Generic'])
  assert.deepEqual(displaySkins(getConstruct('pavo')).map((s) => s.name), ['Generic'])
})
