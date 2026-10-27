// A camera view relative to the default framing, so a saved view gives the same picture on every frame, skin and panel shape.
// Pure numbers, no three.js, so it can be tested in Node.

import type { Vec3 } from './framing.ts'

/**
 * `zoom` is the distance from the orbit target as a share of the default distance; the angles are OrbitControls' azimuth (around
 * +Y, from +Z towards +X) and polar angle (from +Y), in degrees; `target` is the orbit target's offset from the default target,
 * in model heights.
 */
export interface CameraView {
  zoom: number
  azimuthDeg: number
  polarDeg: number
  target: Vec3
}

/** What a view is relative to: the default framing of the model shown, its zoom limits and its height. */
export interface ViewBasis {
  target: Vec3
  distance: number
  minDistance: number
  maxDistance: number
  height: number
}

export interface CameraPose {
  target: Vec3
  position: Vec3
}

/** The polar angles the orbit controls allow (never below the target's height, so never below the floor). */
export interface PolarLimits {
  minDeg: number
  maxDeg: number
}

export const ORBIT_POLAR_LIMITS: Readonly<PolarLimits> = { minDeg: 0, maxDeg: 90 }

const RAD = Math.PI / 180
const MAX_ZOOM_SHARE = 100
const MAX_OFFSET = 20

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

/** The view of a camera pose against the default framing. */
export function toCameraView(pose: CameraPose, basis: ViewBasis): CameraView {
  const dx = pose.position.x - pose.target.x
  const dy = pose.position.y - pose.target.y
  const dz = pose.position.z - pose.target.z
  const distance = Math.max(Math.hypot(dx, dy, dz), 1e-9)
  return {
    zoom: distance / basis.distance,
    azimuthDeg: Math.atan2(dx, dz) / RAD,
    polarDeg: Math.acos(clamp(dy / distance, -1, 1)) / RAD,
    target: {
      x: (pose.target.x - basis.target.x) / basis.height,
      y: (pose.target.y - basis.target.y) / basis.height,
      z: (pose.target.z - basis.target.z) / basis.height,
    },
  }
}

/** The camera pose of a view on a model: the distance is kept inside the model's zoom limits and the polar angle inside the controls'. */
export function fromCameraView(view: CameraView, basis: ViewBasis, polar: Readonly<PolarLimits> = ORBIT_POLAR_LIMITS): CameraPose {
  const distance = clamp(view.zoom * basis.distance, basis.minDistance, basis.maxDistance)
  const polarRad = clamp(view.polarDeg, polar.minDeg, polar.maxDeg) * RAD
  const azimuthRad = view.azimuthDeg * RAD
  const target = {
    x: basis.target.x + view.target.x * basis.height,
    y: basis.target.y + view.target.y * basis.height,
    z: basis.target.z + view.target.z * basis.height,
  }
  const flat = Math.sin(polarRad) * distance
  return {
    target,
    position: {
      x: target.x + flat * Math.sin(azimuthRad),
      y: target.y + Math.cos(polarRad) * distance,
      z: target.z + flat * Math.cos(azimuthRad),
    },
  }
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** A stored view: the view, null for `null` (no saved view), undefined for anything that is not a usable view. */
export function readCameraView(raw: unknown): CameraView | null | undefined {
  if (raw === null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const { zoom, azimuthDeg, polarDeg, target } = raw as Record<string, unknown>
  if (!finite(zoom) || zoom <= 0 || zoom > MAX_ZOOM_SHARE) return undefined
  if (!finite(azimuthDeg) || Math.abs(azimuthDeg) > 720) return undefined
  if (!finite(polarDeg) || polarDeg < 0 || polarDeg > 180) return undefined
  if (typeof target !== 'object' || target === null) return undefined
  const { x, y, z } = target as Record<string, unknown>
  if (!finite(x) || !finite(y) || !finite(z)) return undefined
  if (Math.abs(x) > MAX_OFFSET || Math.abs(y) > MAX_OFFSET || Math.abs(z) > MAX_OFFSET) return undefined
  return { zoom, azimuthDeg, polarDeg, target: { x, y, z } }
}

export function sameCameraView(a: CameraView | null, b: CameraView | null): boolean {
  if (a === null || b === null) return a === b
  return (
    a.zoom === b.zoom &&
    a.azimuthDeg === b.azimuthDeg &&
    a.polarDeg === b.polarDeg &&
    a.target.x === b.target.x &&
    a.target.y === b.target.y &&
    a.target.z === b.target.z
  )
}

/**
 * Display mode's built-in camera: a bust framing from the crown to the upper thighs, from the front at eye level, the face in the upper
 * third of the stage (the user's reference screenshot). Relative to the default framing like every view, so it gives the same picture on
 * every frame, skin and panel size: about 0.42 of the default distance (about 1.1 m of the body fills the height), the target 0.23 model
 * heights above the default (mid-body) target, i.e. at chest height.
 */
export const DISPLAY_PRESET: Readonly<CameraView> = { zoom: 0.42, azimuthDeg: 0, polarDeg: 90, target: { x: 0, y: 0.23, z: 0 } }
