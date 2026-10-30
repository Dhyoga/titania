import assert from 'node:assert/strict'
import { test } from 'node:test'
import { displaySkins, isDisplayFrame, resolveDisplayModel } from '../lib/constructs/display.ts'
import { DEFAULT_FRAME, FRAMES, getConstruct, lendingFrames, type ConstructConfig } from '../lib/constructs/index.ts'

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

// ---- Erza (add-erza-model): a frame with no clip set of its own is shown in Playground only ----

test('Display offers Shukra and Pavo, not Erza', () => {
  assert.deepEqual(FRAMES.filter(isDisplayFrame).map((f) => f.id), ['shukra', 'pavo'])
  assert.deepEqual(FRAMES.filter(isDisplayFrame).map((f) => f.id), lendingFrames().map((f) => f.id), 'the Display frames are exactly the ones with a clip set')
})

test('a saved Erza (an edited record or an import) opens on Shukra Generic and the stored value is kept', () => {
  const stored = { frame: 'erza', skin: 'erza-scarlet' }
  assert.deepEqual(resolve(stored.frame, stored.skin), { frame: 'shukra', skin: 'r3qumd010011' })
  assert.deepEqual(resolve('erza', null), { frame: 'shukra', skin: 'r3qumd010011' })
  assert.deepEqual(stored, { frame: 'erza', skin: 'erza-scarlet' }, 'resolving changes nothing in what was stored')
})

test('a frame list with no Display frame left has nothing to show', () => {
  assert.throws(() => resolveDisplayModel([getConstruct('erza')], { frame: 'erza', skin: 'erza-scarlet' }, 'erza'), /No frames to show/)
})
