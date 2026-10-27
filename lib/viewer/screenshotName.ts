// File name of a screenshot: `<construct>_<skin>_<clip>_<time>.png`. Pure, so it is tested in Node.

export interface ScreenshotNameParts {
  construct: string
  skin: string
  /** Clip name as shown in the list; null in bind pose. */
  clip: string | null
  /** Seconds into the clip. */
  time: number
}

const safe = (text: string): string => text.replace(/[^A-Za-z0-9._-]/g, '_')

export function screenshotName(parts: ScreenshotNameParts): string {
  const clip = parts.clip === null ? 'bindpose' : safe(parts.clip)
  return `${safe(parts.construct)}_${safe(parts.skin)}_${clip}_${parts.time.toFixed(2)}s.png`
}
