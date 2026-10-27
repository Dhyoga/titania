import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FOLLOW_BONES, followFraction, nearestAnchor } from '../lib/viewer/follow.ts'

const near = (a: number, b: number, msg = '') => assert.ok(Math.abs(a - b) < 1e-9, `${msg} ${a} != ${b}`)

test('the anchor nearest the orbit target is followed: head for a face close-up, pelvis for a full body', () => {
  const head = { x: 0, y: 1.6, z: 0.05 }
  const chest = { x: 0, y: 1.3, z: 0 }
  const pelvis = { x: 0, y: 1.0, z: 0 }
  assert.equal(nearestAnchor({ x: 0, y: 1.62, z: 0.1 }, [head, chest, pelvis]), 0)
  assert.equal(nearestAnchor({ x: 0, y: 1.35, z: 0 }, [head, chest, pelvis]), 1)
  assert.equal(nearestAnchor({ x: 0, y: 0.96, z: 0 }, [head, chest, pelvis]), 2, 'the mid-body target of the default framing')
  assert.deepEqual(FOLLOW_BONES, ['Bip001Head', 'Bip001Spine2', 'Bip001Pelvis'])
})

test('missing anchors are skipped; none at all follows nothing', () => {
  assert.equal(nearestAnchor({ x: 0, y: 1.6, z: 0 }, [null, null, { x: 0, y: 1, z: 0 }]), 2)
  assert.equal(nearestAnchor({ x: 0, y: 1.6, z: 0 }, [null, null, null]), -1)
  assert.equal(nearestAnchor({ x: 0, y: 1.6, z: 0 }, []), -1)
})

test('the easing does not depend on the frame rate', () => {
  const one = followFraction(1 / 30, 0.15)
  const half = followFraction(1 / 60, 0.15)
  near(1 - (1 - half) ** 2, one, 'two steps of 1/60 s cover one step of 1/30 s')
  near(followFraction(0.15, 0.15), 1 - Math.exp(-1), 'one time constant covers about 63 %')
  assert.ok(one > 0 && one < 1)
})

test('no time moves nothing; a time constant of 0 jumps at once', () => {
  assert.equal(followFraction(0), 0)
  assert.equal(followFraction(-1), 0)
  assert.equal(followFraction(Number.NaN), 0)
  assert.equal(followFraction(0.016, 0), 1)
})
