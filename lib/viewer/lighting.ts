// The stage lights' two user settings and their defaults. Pure, so the preferences module (and its Node tests) can use them.

export interface Lighting {
  /** Multiplies both stage lights; 1 is the default level. */
  intensity: number
  /** Direction of the directional light around the vertical axis, degrees from +Z towards +X. */
  azimuthDeg: number
}

export const DEFAULT_LIGHTING: Lighting = { intensity: 1, azimuthDeg: 0 }

/** The sliders' ranges, which a stored value is kept inside. */
export const LIGHT_INTENSITY_RANGE = { min: 0.25, max: 2 } as const
export const LIGHT_AZIMUTH_RANGE = { min: -180, max: 180 } as const
