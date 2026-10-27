// Following the animation with the camera (design D2, D3 of `improve-camera-close-ups`). Pure numbers, no three.js, so it runs in Node.
//
// The camera keeps its view on the body part nearest to where it looks: the head in a face close-up, the chest in a chest view, the
// pelvis in a full-body view. The viewer moves the orbit target (and the camera with it) towards that part plus the offset it had when
// the part was picked, easing by `followFraction` so the motion is smooth at any frame rate.

export interface Vec3 {
  x: number
  y: number
  z: number
}

/** Bones a camera may follow, by name; every frame's rig has them (`Bip001…`). */
export const FOLLOW_BONES = ['Bip001Head', 'Bip001Spine2', 'Bip001Pelvis'] as const

/** Time constant of the easing, in seconds: the camera covers about 63 % of the way to the followed part in this time. */
export const FOLLOW_TAU = 0.15

/** Index of the anchor nearest to `target` (missing anchors skipped), or -1 when there is none. */
export function nearestAnchor(target: Vec3, anchors: readonly (Vec3 | null)[]): number {
  let best = -1
  let bestDistance = Infinity
  anchors.forEach((anchor, index) => {
    if (!anchor) return
    const d = (anchor.x - target.x) ** 2 + (anchor.y - target.y) ** 2 + (anchor.z - target.z) ** 2
    if (d < bestDistance) {
      bestDistance = d
      best = index
    }
  })
  return best
}

/**
 * The part of the remaining distance covered in `dt` seconds: `1 − exp(−dt / tau)`. Two steps of `dt / 2` cover what one step of `dt`
 * does, so the easing does not depend on the frame rate. No time moves nothing; a time constant of 0 jumps at once.
 */
export function followFraction(dt: number, tau = FOLLOW_TAU): number {
  if (!(dt > 0)) return 0
  if (!(tau > 0)) return 1
  return 1 - Math.exp(-dt / tau)
}
