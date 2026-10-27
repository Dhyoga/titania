const CLIP_PREFIX = 'anim/'

/**
 * Asset path (under `/<constructId>/`) of a clip file listed in a manifest. The `file` value always starts with
 * `anim/` and is relative to the folder that holds the manifest, with that prefix stripped:
 *   manifest `anim/manifest.json`                        + `anim/BaseLayer/Born.json` -> `anim/BaseLayer/Born.json`
 *   manifest `anim-skins/<skin>/manifest.json`           + `anim/BaseLayer/Born.json` -> `anim-skins/<skin>/BaseLayer/Born.json`
 */
export function resolveClipPath(manifestPath: string, clipFile: string): string {
  if (!clipFile.startsWith(CLIP_PREFIX)) throw new Error(`Unexpected clip file "${clipFile}": expected it to start with "${CLIP_PREFIX}"`)
  const slash = manifestPath.lastIndexOf('/')
  const folder = slash >= 0 ? manifestPath.slice(0, slash) : ''
  const rest = clipFile.slice(CLIP_PREFIX.length)
  return folder ? `${folder}/${rest}` : rest
}

/**
 * Asset path (under `/<constructId>/`) of the model a clip set was made for: its manifest's `target`. The clips address that model's
 * glTF node indices, so a clip is retargeted from that model's rig (Solitary Dream's clips do not fit the Generic rig).
 */
export function targetModelPath(target: string): string {
  return `models/${target}.glb`
}
