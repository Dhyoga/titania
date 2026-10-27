// Camera framing from model bounds. Pure numbers, no three.js, so it can be tested in Node.

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Bounds {
  min: Vec3
  max: Vec3
}

/**
 * Share of the bounds' width that the width limit of the default framing uses, for a person (Generic and coating skins): the bounds
 * are taken in the bind pose, whose A-pose arms are wider than the silhouette in most poses (measured in `default-camera`: the
 * resting silhouette is 58 to 86 % of the bounds' width on the four frames).
 */
export const PERSON_WIDTH_SHARE = 0.8
/** A chibi's bounds are its body (its silhouette is 96 to 100 % of them), so its whole width is kept in view. */
export const CHIBI_WIDTH_SHARE = 1
/** Even room above the crown and below the feet in the default framing, as a fraction of the half-height. */
export const DEFAULT_MARGIN = 0.25
/** Room around the whole body in the full-body distance (`Framing.fitDistance`), which the farthest zoom is measured from. */
const FIT_MARGIN = 0.08

export interface FramingOptions {
  /** Vertical field of view in degrees. */
  fovDeg: number
  /** Canvas width / height. */
  aspect: number
  /** Where the orbit target sits, as a fraction of the model height from the bottom. Mid-body keeps a full-body view centred. */
  targetHeight?: number
  /** Even room above the crown and below the feet in the default framing, as a fraction of the half-height. */
  margin?: number
  /**
   * Share of the bounds' half-width that the width limit of the default framing fits into the canvas width (1: the whole bounds).
   * The default framing is led by the model's height; the width only keeps arms and hair from leaving a narrow panel.
   */
  widthShare?: number
  /**
   * Closest camera distance as a fraction of the model height (a face close-up: about 0.29 m on a 1.92 m model), so it does not
   * depend on how wide the canvas is.
   */
  closest?: number
  /** Farthest camera distance as a multiple of the full-body distance. */
  maxZoom?: number
}

export interface Framing {
  target: Vec3
  /** Default camera distance: the model's height fits the whole canvas (see `margin`), limited by the width (see `widthShare`). */
  distance: number
  /** Distance at which the whole body, arms and hair included, fits the canvas. At least `distance`. */
  fitDistance: number
  minDistance: number
  maxDistance: number
}

/** Default camera distance (looking down -Z at the target), the full-body distance and the zoom limits for a model's bounds. */
export function computeFraming(bounds: Bounds, opts: FramingOptions): Framing {
  const { min, max } = bounds
  const targetHeight = opts.targetHeight ?? 0.5
  const margin = opts.margin ?? DEFAULT_MARGIN
  const widthShare = opts.widthShare ?? 1
  const height = max.y - min.y
  const widthX = max.x - min.x
  const depthZ = max.z - min.z
  if (!(height > 0) || !(opts.aspect > 0)) throw new Error('computeFraming needs bounds with a height and a positive aspect')

  const target: Vec3 = { x: (min.x + max.x) / 2, y: min.y + targetHeight * height, z: (min.z + max.z) / 2 }
  const tanHalfV = Math.tan((opts.fovDeg * Math.PI) / 360)
  const tanHalfH = tanHalfV * opts.aspect

  // Vertical: the farther of crown and feet from the target must fit.
  const halfHeight = Math.max(max.y - target.y, target.y - min.y)
  // Horizontal: the model turns when orbiting, so use the wider of its two horizontal extents.
  const halfWidth = Math.max(widthX, depthZ) / 2
  // Distances are measured to the target; the front surface is half a depth closer to the camera.
  const front = depthZ / 2
  const distance = Math.max((halfHeight * (1 + margin)) / tanHalfV, (halfWidth * widthShare * (1 + FIT_MARGIN)) / tanHalfH) + front
  const fitDistance = Math.max(distance, Math.max((halfHeight * (1 + FIT_MARGIN)) / tanHalfV, (halfWidth * (1 + FIT_MARGIN)) / tanHalfH) + front)

  return {
    target,
    distance,
    fitDistance,
    minDistance: Math.min(distance, height * (opts.closest ?? 0.15)),
    maxDistance: fitDistance * (opts.maxZoom ?? 2),
  }
}
