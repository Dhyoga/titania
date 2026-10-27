import assert from 'node:assert/strict'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { serveAssets, type ServeMode } from '../lib/build/serveAssets.ts'

/** A project root with data/c/{models/a.glb, voices.json}; `icons` is missing. */
function project() {
  const root = mkdtempSync(join(tmpdir(), 'serve-'))
  mkdirSync(join(root, 'data', 'c', 'models'), { recursive: true })
  writeFileSync(join(root, 'data', 'c', 'models', 'a.glb'), 'glb')
  writeFileSync(join(root, 'data', 'c', 'voices.json'), '{}')
  return { root, outDir: join(root, 'dist'), cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

for (const mode of ['symlink', 'copy'] as ServeMode[]) {
  test(`${mode}: present paths are served, a missing one is skipped with a warning`, () => {
    const { root, outDir, cleanup } = project()
    try {
      const warnings: string[] = []
      serveAssets({ root, outDir, constructId: 'c', servedPaths: ['models', 'voices.json', 'icons'], mode, warn: (m) => warnings.push(m) })
      assert.equal(readFileSync(join(outDir, 'c', 'models', 'a.glb'), 'utf8'), 'glb')
      assert.equal(readFileSync(join(outDir, 'c', 'voices.json'), 'utf8'), '{}')
      assert.equal(existsSync(join(outDir, 'c', 'icons')), false)
      let dangling = false
      try {
        dangling = lstatSync(join(outDir, 'c', 'icons')).isSymbolicLink()
      } catch {
        // nothing there, as expected
      }
      assert.equal(dangling, false, 'no dangling link')
      assert.equal(warnings.length, 1)
      assert.match(warnings[0]!, /data\/c\/icons does not exist/)
      assert.equal(lstatSync(join(outDir, 'c', 'models')).isSymbolicLink(), mode === 'symlink')
    } finally {
      cleanup()
    }
  })
}

test('a path that disappears from data/ is removed from the output on the next build', () => {
  const { root, outDir, cleanup } = project()
  try {
    mkdirSync(join(root, 'data', 'c', 'icons'))
    serveAssets({ root, outDir, constructId: 'c', servedPaths: ['icons'], mode: 'symlink', warn: () => {} })
    assert.ok(lstatSync(join(outDir, 'c', 'icons')).isSymbolicLink())
    rmSync(join(root, 'data', 'c', 'icons'), { recursive: true })
    serveAssets({ root, outDir, constructId: 'c', servedPaths: ['icons'], mode: 'symlink', warn: () => {} })
    assert.throws(() => lstatSync(join(outDir, 'c', 'icons')), 'the stale link is gone')
  } finally {
    cleanup()
  }
})

test('several constructs are served side by side, each under its own id, and nothing else', () => {
  const { root, outDir, cleanup } = project()
  try {
    mkdirSync(join(root, 'data', 'd', 'models'), { recursive: true })
    writeFileSync(join(root, 'data', 'd', 'models', 'b.glb'), 'glb2')
    mkdirSync(join(root, 'data', 'other', 'models'), { recursive: true }) // not in the frame list: never served
    for (const [constructId, servedPaths] of [['c', ['models']], ['d', ['models']]] as const) {
      serveAssets({ root, outDir, constructId, servedPaths: [...servedPaths], mode: 'symlink', warn: () => {} })
    }
    assert.equal(readFileSync(join(outDir, 'c', 'models', 'a.glb'), 'utf8'), 'glb')
    assert.equal(readFileSync(join(outDir, 'd', 'models', 'b.glb'), 'utf8'), 'glb2')
    assert.equal(existsSync(join(outDir, 'other')), false)
  } finally {
    cleanup()
  }
})
