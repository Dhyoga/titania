import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DISPLAY_PRESET,
  fromCameraView,
  readCameraView,
  sameCameraView,
  toCameraView,
  type CameraView,
  type ViewBasis,
} from '../lib/viewer/cameraView.ts'
import { computeFraming, PERSON_WIDTH_SHARE, type Bounds } from '../lib/viewer/framing.ts'

const person: Bounds = { min: { x: -0.52, y: 0, z: -0.3 }, max: { x: 0.52, y: 1.9, z: 0.3 } }
const chibi: Bounds = { min: { x: -0.37, y: 0, z: -0.33 }, max: { x: 0.37, y: 1.23, z: 0.33 } }

function basisOf(bounds: Bounds, aspect: number): ViewBasis {
  const f = computeFraming(bounds, { fovDeg: 24, aspect, widthShare: PERSON_WIDTH_SHARE })
  return { target: f.target, distance: f.distance, minDistance: f.minDistance, maxDistance: f.maxDistance, height: bounds.max.y - bounds.min.y }
}

const close = (a: number, b: number, eps = 1e-9): void => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`)
function assertViewClose(a: CameraView, b: CameraView): void {
  close(a.zoom, b.zoom)
  close(a.azimuthDeg, b.azimuthDeg, 1e-7)
  close(a.polarDeg, b.polarDeg, 1e-7)
  close(a.target.x, b.target.x)
  close(a.target.y, b.target.y)
  close(a.target.z, b.target.z)
}

const view: CameraView = { zoom: 0.4, azimuthDeg: 25, polarDeg: 78, target: { x: 0.02, y: 0.18, z: -0.01 } }

test('the default framing is the view zoom 1, azimuth 0, polar 90, no offset', () => {
  const b = basisOf(person, 387 / 1045)
  const pose = { target: b.target, position: { x: b.target.x, y: b.target.y, z: b.target.z + b.distance } }
  assertViewClose(toCameraView(pose, b), { zoom: 1, azimuthDeg: 0, polarDeg: 90, target: { x: 0, y: 0, z: 0 } })
})

test('a pose survives a round trip through its view', () => {
  const b = basisOf(person, 387 / 1045)
  const pose = fromCameraView(view, b)
  assertViewClose(toCameraView(pose, b), view)
})

test('the same view is the same relative view at two panel shapes', () => {
  const narrow = basisOf(person, 387 / 1045)
  const wide = basisOf(person, 600 / 800)
  assert.notEqual(narrow.distance, wide.distance, 'the panels frame the model differently')
  const onNarrow = fromCameraView(view, narrow)
  const onWide = fromCameraView(view, wide)
  assert.notDeepEqual(onNarrow.position, onWide.position)
  assertViewClose(toCameraView(onNarrow, narrow), view)
  assertViewClose(toCameraView(onWide, wide), view)
})

test('two models of different size give the same relative view', () => {
  const a = basisOf(person, 0.37)
  const c = basisOf(chibi, 0.37)
  assertViewClose(toCameraView(fromCameraView(view, a), a), toCameraView(fromCameraView(view, c), c))
})

test('the target offset scales with the model height', () => {
  const a = basisOf(person, 0.37)
  const c = basisOf(chibi, 0.37)
  const offsetA = fromCameraView(view, a).target.y - a.target.y
  const offsetC = fromCameraView(view, c).target.y - c.target.y
  close(offsetA / 1.9, view.target.y)
  close(offsetC / 1.23, view.target.y)
})

test('the distance is kept inside the zoom limits of the model shown', () => {
  const b = basisOf(chibi, 0.37)
  const dist = (pose: ReturnType<typeof fromCameraView>): number =>
    Math.hypot(pose.position.x - pose.target.x, pose.position.y - pose.target.y, pose.position.z - pose.target.z)
  close(dist(fromCameraView({ ...view, zoom: 0.001 }, b)), b.minDistance)
  close(dist(fromCameraView({ ...view, zoom: 50 }, b)), b.maxDistance)
  const inside = dist(fromCameraView(view, b))
  assert.ok(inside >= b.minDistance && inside <= b.maxDistance)
})

test('a smaller model\'s closest zoom wins over a saved distance that is closer', () => {
  const big = basisOf(person, 0.37)
  const small = basisOf(chibi, 0.37)
  const closeView = { ...view, zoom: big.minDistance / big.distance } // the person's closest zoom
  const pose = fromCameraView(closeView, small)
  const d = Math.hypot(pose.position.x - pose.target.x, pose.position.y - pose.target.y, pose.position.z - pose.target.z)
  assert.ok(d >= small.minDistance - 1e-9)
})

test('the polar angle is kept inside the controls\' limits (never below the target)', () => {
  const b = basisOf(person, 0.37)
  const low = fromCameraView({ ...view, polarDeg: 150 }, b)
  assert.ok(low.position.y >= low.target.y - 1e-9, 'not below the orbit target')
  close(toCameraView(low, b).polarDeg, 90, 1e-6)
  const top = fromCameraView({ ...view, polarDeg: -10 }, b)
  close(toCameraView(top, b).polarDeg, 0, 1e-6)
  const custom = fromCameraView({ ...view, polarDeg: 150 }, b, { minDeg: 0, maxDeg: 120 })
  close(toCameraView(custom, b).polarDeg, 120, 1e-6)
})

test('azimuth turns around the target', () => {
  const b = basisOf(person, 0.37)
  const front = fromCameraView({ ...view, azimuthDeg: 0, polarDeg: 90 }, b)
  const side = fromCameraView({ ...view, azimuthDeg: 90, polarDeg: 90 }, b)
  assert.ok(front.position.z > front.target.z && Math.abs(front.position.x - front.target.x) < 1e-9)
  assert.ok(side.position.x > side.target.x && Math.abs(side.position.z - side.target.z) < 1e-9)
})

test('readCameraView accepts a view, null, and refuses the rest', () => {
  assert.deepEqual(readCameraView(view), view)
  assert.equal(readCameraView(null), null)
  for (const bad of [undefined, 3, 'x', [], {}, { ...view, zoom: -1 }, { ...view, target: undefined }, { ...view, polarDeg: NaN }]) {
    assert.equal(readCameraView(bad), undefined)
  }
})

test('sameCameraView compares every number', () => {
  assert.ok(sameCameraView(view, { ...view, target: { ...view.target } }))
  assert.ok(sameCameraView(null, null))
  assert.ok(!sameCameraView(view, null))
  assert.ok(!sameCameraView(null, view))
  assert.ok(!sameCameraView(view, { ...view, zoom: 0.41 }))
  assert.ok(!sameCameraView(view, { ...view, target: { ...view.target, z: 0 } }))
})

test('the Display preset is a usable view whose zoom limits keep the bust framing', () => {
  assert.deepEqual(readCameraView(JSON.parse(JSON.stringify(DISPLAY_PRESET))), DISPLAY_PRESET)
  const height = 1.9
  for (const aspect of [0.3, 0.36, 0.75, 1.3]) {
    for (const bounds of [person, chibi]) {
      const basis = basisOf(bounds, aspect)
      const pose = fromCameraView(DISPLAY_PRESET, basis)
      const distance = Math.hypot(pose.position.x - pose.target.x, pose.position.y - pose.target.y, pose.position.z - pose.target.z)
      // inside the zoom limits, so the clamp does not change the framing
      assert.ok(distance >= basis.minDistance - 1e-9 && distance <= basis.maxDistance + 1e-9, `${aspect}: ${distance}`)
      // level with the target and in front of the model, looking at the chest
      close(pose.position.y, pose.target.y, 1e-9)
      close(pose.position.x, pose.target.x, 1e-9)
      assert.ok(pose.position.z > pose.target.z)
      close(pose.target.y, basis.target.y + DISPLAY_PRESET.target.y * basis.height, 1e-9)
    }
  }
  // the person's chest is above mid-body, so the target is in the upper half of the body
  const basis = basisOf(person, 0.36)
  const target = fromCameraView(DISPLAY_PRESET, basis).target
  assert.ok(target.y > height * 0.5 && target.y < height * 0.8, String(target.y))
})
