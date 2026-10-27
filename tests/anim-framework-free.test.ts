import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

/** Source without comments, so a header that says "no three.js" does not count as an import. */
function code(dir: URL, file: string): string {
  return readFileSync(new URL(file, dir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

// lib/voice gets its audio context injected, so it stays testable in Node like lib/anim; lib/lobby is a pure state machine.
for (const [folder, minFiles] of [['anim', 4], ['voice', 3], ['lobby', 1]] as const) {
  test(`lib/${folder} has no three.js, Vue, WXT or extension API dependency`, () => {
    const dir = new URL(`../lib/${folder}/`, import.meta.url)
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'))
    assert.ok(files.length >= minFiles, `expected the ${folder} modules, found ${files.join(', ')}`)
    for (const file of files) {
      const src = code(dir, file)
      assert.doesNotMatch(src, /from\s+['"](three|vue|wxt)(\/[^'"]*)?['"]/, `${file} imports a framework`)
      assert.doesNotMatch(src, /from\s+['"]~\//, `${file} imports through the app alias`)
      assert.doesNotMatch(src, /\b(browser|chrome)\s*\./, `${file} uses an extension API`)
      assert.doesNotMatch(src, /\bwindow\b|\bdocument\b/, `${file} touches the DOM`)
    }
  })
}
