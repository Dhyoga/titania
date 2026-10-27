// Build-time only (runs in Node from wxt.config.ts). Makes a construct's served paths reachable at
// `<outDir>/<id>/<path>` by symlinking into data/, or copying. Only ever reads from data/.
import { cpSync, existsSync, lstatSync, mkdirSync, rmSync, symlinkSync, unlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export type ServeMode = 'symlink' | 'copy'

export function serveAssets(opts: {
  root: string
  outDir: string
  constructId: string
  servedPaths: string[]
  mode: ServeMode
  /** Defaults to console.warn. */
  warn?: (message: string) => void
}): void {
  const { root, outDir, constructId, servedPaths, mode } = opts
  const warn = opts.warn ?? ((message: string) => console.warn(message))
  for (const path of servedPaths) {
    const source = resolve(root, 'data', constructId, path)
    const target = join(outDir, constructId, path)
    mkdirSync(dirname(target), { recursive: true })
    removeIfPresent(target)
    // Optional data (e.g. icons before the download script fetched them): skip it instead of leaving a dangling
    // link or failing the copy.
    if (!existsSync(source)) {
      warn(`serveAssets: data/${constructId}/${path} does not exist; not served`)
      continue
    }
    if (mode === 'symlink') symlinkSync(source, target)
    else cpSync(source, target, { recursive: true })
  }
}

function removeIfPresent(target: string): void {
  let stat
  try {
    stat = lstatSync(target)
  } catch {
    return
  }
  // A symlink is removed as a link: its target in data/ is never touched.
  if (stat.isSymbolicLink()) unlinkSync(target)
  else rmSync(target, { recursive: true, force: true })
}
