import type { PublicPath } from 'wxt/browser'
import { assetPath } from './assetPath'

/** Extension URL of a packaged asset, e.g. `assetUrl('crepuscule', 'anim/manifest.json')`. Works offline. */
export function assetUrl(constructId: string, path: string): string {
  // WXT types `getURL` to files in its public dir. Construct assets are added to the build output by
  // lib/build/serveAssets.ts instead, so they are not in that union; the cast is safe.
  return browser.runtime.getURL(assetPath(constructId, path) as PublicPath)
}
