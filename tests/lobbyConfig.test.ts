import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FRAMES, getConstruct } from '../lib/constructs/index.ts'

// The lobby configuration of the real frame list: who borrows from whom for Display by default (`add-lobby-variety`; the user's choice
// in the Animations popover replaces it, `add-lobby-pool-menu`).

const ids = FRAMES.map((f) => f.id)
const configured = FRAMES.filter((f) => f.lobby)

test('a frame never lists itself', () => {
  for (const frame of configured) {
    const { actionFrom, idleFrom } = frame.lobby!
    assert.ok(!actionFrom.includes(frame.id), `${frame.id} lists itself in actionFrom`)
    assert.ok(!idleFrom.includes(frame.id), `${frame.id} lists itself in idleFrom`)
  }
})

test('every listed name is a frame, once per list', () => {
  for (const frame of configured) {
    for (const list of [frame.lobby!.actionFrom, frame.lobby!.idleFrom]) {
      for (const name of list) assert.ok(ids.includes(name), `${frame.id} lists unknown frame "${name}"`)
      assert.equal(new Set(list).size, list.length, `${frame.id} lists a frame twice`)
    }
  }
})

test('Shukra and Pavo borrow from each other by default: Board actions and idles', () => {
  assert.deepEqual(configured.map((f) => f.id), ['shukra', 'pavo'])
  assert.deepEqual(getConstruct('shukra').lobby, { actionFrom: ['pavo'], idleFrom: ['pavo'] })
  assert.deepEqual(getConstruct('pavo').lobby, { actionFrom: ['shukra'], idleFrom: ['shukra'] })
})
