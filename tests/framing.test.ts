import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CHIBI_WIDTH_SHARE, computeFraming, DEFAULT_MARGIN, PERSON_WIDTH_SHARE } from '../lib/viewer/framing.ts'

const standing = { min: { x: -0.3, y: 0.175, z: -0.2 }, max: { x: 0.3, y: 1.925, z: 0.2 } }
const tanHalf = Math.tan((24 * Math.PI) / 360)

test('tall model in a wide enough canvas is led by height: the whole canvas, an even margin', () => {
  const f = computeFraming(standing, { fovDeg: 24, aspect: 2 / 3 })
  const target = 0.175 + 0.5 * 1.75
  assert.ok(Math.abs(f.target.y - target) < 1e-9)
  // Crown and feet, with the margin, fit the vertical field of view; mid-body target leaves equal room above and below.
  const needed = (0.875 * (1 + DEFAULT_MARGIN)) / tanHalf
  assert.ok(f.distance >= needed)
  assert.ok(f.distance < needed + 0.5)
})

test('very narrow canvas is limited by width, through the width share', () => {
  const narrow = computeFraming(standing, { fovDeg: 24, aspect: 0.2, widthShare: PERSON_WIDTH_SHARE })
  const normal = computeFraming(standing, { fovDeg: 24, aspect: 2 / 3, widthShare: PERSON_WIDTH_SHARE })
  assert.ok(narrow.distance > normal.distance)
  const tanHalfH = tanHalf * 0.2
  assert.ok(narrow.distance >= (0.3 * PERSON_WIDTH_SHARE * 1.08) / tanHalfH)
  const full = computeFraming(standing, { fovDeg: 24, aspect: 0.2, widthShare: CHIBI_WIDTH_SHARE })
  assert.ok(full.distance > narrow.distance, 'a share of 1 keeps the whole width in view, so it stands farther back')
})

// Crepuscule's bounds (bind pose, A-pose arms): about 1.04 m wide, 1.9 m tall, 0.6 m deep.
const person = { min: { x: -0.52, y: 0, z: -0.3 }, max: { x: 0.52, y: 1.9, z: 0.3 } }

test('a person is framed closer than the full-body fit in a narrow panel (the 387 x 1045 reference)', () => {
  const f = computeFraming(person, { fovDeg: 24, aspect: 387 / 1045, widthShare: PERSON_WIDTH_SHARE })
  assert.ok(f.distance < f.fitDistance)
  // Body height as a fraction of the canvas height at the default distance (front surface at half a depth closer).
  const visible = 2 * (f.distance - 0.3) * tanHalf
  const body = 1.9 / visible
  assert.ok(body > 0.7 && body < 0.85, `body fills ${body.toFixed(3)} of the height`)
  const old = computeFraming(person, { fovDeg: 24, aspect: 387 / 1045, widthShare: 1, margin: 0.08 })
  assert.ok(f.distance < old.distance, 'closer than the old width-led default')
})

test('a chibi keeps its whole width in a narrow panel', () => {
  const chibi = { min: { x: -0.37, y: 0, z: -0.33 }, max: { x: 0.37, y: 1.23, z: 0.33 } }
  const f = computeFraming(chibi, { fovDeg: 24, aspect: 387 / 1045, widthShare: CHIBI_WIDTH_SHARE })
  const visibleWidth = 2 * (f.distance - 0.33) * tanHalf * (387 / 1045)
  assert.ok(visibleWidth >= 0.74, 'the bounds fit the canvas width')
})

test('the full-body distance fits height and width with the old margin and is never closer than the default', () => {
  const f = computeFraming(standing, { fovDeg: 24, aspect: 2 / 3 })
  const wide = Math.max((0.875 * 1.08) / tanHalf, (0.3 * 1.08) / (tanHalf * (2 / 3))) + 0.2
  assert.ok(f.fitDistance >= wide - 1e-9)
  for (const share of [0.5, 0.8, 1]) for (const aspect of [0.2, 0.37, 2 / 3, 1.5]) {
    const g = computeFraming(standing, { fovDeg: 24, aspect, widthShare: share })
    assert.ok(g.fitDistance >= g.distance)
  }
})

test('zoom limits: closest by the model height (whatever the canvas width), farthest by the full-body distance', () => {
  const f = computeFraming(standing, { fovDeg: 24, aspect: 2 / 3 })
  assert.ok(Math.abs(f.minDistance - 1.75 * 0.15) < 1e-9)
  assert.ok(Math.abs(f.maxDistance - f.fitDistance * 2) < 1e-9)
  const narrow = computeFraming(standing, { fovDeg: 24, aspect: 0.2 })
  assert.ok(narrow.distance > f.distance)
  assert.equal(narrow.minDistance, f.minDistance, 'a narrow panel zooms as close as a wide one')
})

test('the farthest zoom does not depend on the width share', () => {
  const a = computeFraming(standing, { fovDeg: 24, aspect: 0.37, widthShare: 0.8 })
  const b = computeFraming(standing, { fovDeg: 24, aspect: 0.37, widthShare: 1 })
  assert.ok(Math.abs(a.maxDistance - b.maxDistance) < 1e-9)
})

test('a smaller model gets a smaller distance (no construct-specific numbers)', () => {
  const chibi = { min: { x: -0.2, y: 0, z: -0.15 }, max: { x: 0.2, y: 0.6, z: 0.15 } }
  assert.ok(computeFraming(chibi, { fovDeg: 24, aspect: 2 / 3 }).distance < computeFraming(standing, { fovDeg: 24, aspect: 2 / 3 }).distance)
})

test('rejects empty bounds', () => {
  assert.throws(() => computeFraming({ min: { x: 0, y: 1, z: 0 }, max: { x: 1, y: 1, z: 1 } }, { fovDeg: 24, aspect: 1 }))
})
