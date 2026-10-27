// Small quaternion and vector helpers for the retargeting code. Pure TypeScript; quaternions are [x, y, z, w] like glTF and three.js.

export type Vec3 = [number, number, number]
export type Quat = [number, number, number, number]

export const IDENTITY: Readonly<Quat> = [0, 0, 0, 1]

/** a · b (b is applied first). */
export function qmul(a: Readonly<Quat>, b: Readonly<Quat>): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ]
}

/** Inverse of a unit quaternion. */
export function qinv(q: Readonly<Quat>): Quat {
  return [-q[0], -q[1], -q[2], q[3]]
}

export function qnormalize(q: Readonly<Quat>): Quat {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
}

/** `v` rotated by unit quaternion `q`. */
export function qrotate(q: Readonly<Quat>, v: Readonly<Vec3>): Vec3 {
  // v' = v + 2w(u × v) + 2u × (u × v), u = q.xyz
  const [x, y, z, w] = q
  const cx = y * v[2] - z * v[1]
  const cy = z * v[0] - x * v[2]
  const cz = x * v[1] - y * v[0]
  return [
    v[0] + 2 * (w * cx + y * cz - z * cy),
    v[1] + 2 * (w * cy + z * cx - x * cz),
    v[2] + 2 * (w * cz + x * cy - y * cx),
  ]
}

/** The shortest rotation that turns unit vector `from` into unit vector `to`. */
export function qfromUnitVectors(from: Readonly<Vec3>, to: Readonly<Vec3>): Quat {
  const d = from[0] * to[0] + from[1] * to[1] + from[2] * to[2]
  if (d < -1 + 1e-9) {
    // Opposite: half a turn around any axis perpendicular to `from`.
    const axis = Math.abs(from[0]) > 0.9 ? cross(from, [0, 1, 0]) : cross(from, [1, 0, 0])
    const n = normalize(axis)
    return [n[0], n[1], n[2], 0]
  }
  const c = cross(from, to)
  return qnormalize([c[0], c[1], c[2], 1 + d])
}

/** Angle in degrees between two rotations. */
export function qangle(a: Readonly<Quat>, b: Readonly<Quat>): number {
  const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])
  return (2 * Math.acos(Math.min(1, d)) * 180) / Math.PI
}

export function cross(a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

export function normalize(v: Readonly<Vec3>): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

export function sub(a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

/** Angle in degrees between two directions. */
export function vangle(a: Readonly<Vec3>, b: Readonly<Vec3>): number {
  const na = normalize(a)
  const nb = normalize(b)
  const d = na[0] * nb[0] + na[1] * nb[1] + na[2] * nb[2]
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI
}

/**
 * The rotation that turns the frame (`fromDir`, `fromRef`) into the frame (`toDir`, `toRef`): the directions are matched exactly and
 * the reference vectors as closely as the directions allow (their components across the directions are matched). Used where a
 * bone's roll matters, e.g. the hand's palm.
 */
export function qfromFrames(fromDir: Readonly<Vec3>, fromRef: Readonly<Vec3>, toDir: Readonly<Vec3>, toRef: Readonly<Vec3>): Quat {
  const basis = (d: Readonly<Vec3>, r: Readonly<Vec3>): [Vec3, Vec3, Vec3] => {
    const x = normalize(d)
    const z = normalize(cross(x, r))
    return [x, cross(z, x), z]
  }
  const [fx, fy, fz] = basis(fromDir, fromRef)
  const [tx, ty, tz] = basis(toDir, toRef)
  // M = T · Fᵀ, with the basis vectors as columns.
  const m = (r: number, c: number): number => tx[r]! * fx[c]! + ty[r]! * fy[c]! + tz[r]! * fz[c]!
  return qfromMatrix(m(0, 0), m(0, 1), m(0, 2), m(1, 0), m(1, 1), m(1, 2), m(2, 0), m(2, 1), m(2, 2))
}

/** Unit quaternion of a rotation matrix given row by row. */
export function qfromMatrix(m00: number, m01: number, m02: number, m10: number, m11: number, m12: number, m20: number, m21: number, m22: number): Quat {
  const trace = m00 + m11 + m22
  let q: Quat
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1)
    q = [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22)
    q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22)
    q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11)
    q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]
  }
  return qnormalize(q)
}
