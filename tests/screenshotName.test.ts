import assert from 'node:assert/strict'
import { test } from 'node:test'
import { screenshotName } from '../lib/viewer/screenshotName.ts'

test('construct, skin, clip and time in seconds with two decimals', () => {
  assert.equal(screenshotName({ construct: 'shukra', skin: 'r3qumd010011', clip: 'BoardAct0201', time: 12.3 }), 'shukra_r3qumd010011_BoardAct0201_12.30s.png')
  assert.equal(screenshotName({ construct: 'c', skin: 's', clip: 'UiStand1', time: 0 }), 'c_s_UiStand1_0.00s.png')
  assert.equal(screenshotName({ construct: 'c', skin: 's', clip: 'UiStand1', time: 20.566669 }), 'c_s_UiStand1_20.57s.png')
})

test('bind pose is named bindpose', () => {
  assert.equal(screenshotName({ construct: 'c', skin: 's', clip: null, time: 0 }), 'c_s_bindpose_0.00s.png')
})

test('characters outside A-Za-z0-9._- are replaced by _', () => {
  assert.equal(screenshotName({ construct: 'c', skin: 's', clip: 'Walk (LevelCombine1Level1)', time: 1 }), 'c_s_Walk__LevelCombine1Level1__1.00s.png')
  assert.equal(screenshotName({ construct: 'a/b', skin: 'x y', clip: '../x', time: 1 }), 'a_b_x_y_.._x_1.00s.png')
})
