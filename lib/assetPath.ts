// Pure part of `assetUrl` (lib/assets.ts), so Node tests can import it.

/**
 * The path `/<constructId>/<path>` with every segment URL-encoded, so a folder name with a space (Veritas' and Zero's
 * `anim/Base Layer/…`) or any other character that is not allowed in a URL path loads. `/` stays the separator.
 */
export function assetPath(constructId: string, path: string): string {
  return `/${[constructId, ...path.split('/')].map(encodeURIComponent).join('/')}`
}
