import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { png, render, SIZES } from '../scripts/make-icons.ts'

const icons = new URL('../public/icon/', import.meta.url)

/** Width and height from a PNG's IHDR, after checking the signature. */
function dimensions(file: Buffer): [number, number, number, number] {
  assert.deepEqual([...file.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'a PNG signature')
  assert.equal(file.subarray(12, 16).toString('ascii'), 'IHDR')
  return [file.readUInt32BE(16), file.readUInt32BE(20), file[24]!, file[25]!]
}

test('the five committed icons are square PNGs of exactly 16, 32, 48, 96 and 128 px, 8-bit RGBA', () => {
  assert.deepEqual([...SIZES], [16, 32, 48, 96, 128])
  assert.deepEqual(readdirSync(icons).sort(), SIZES.map((s) => `${s}.png`).sort())
  for (const size of SIZES) assert.deepEqual(dimensions(readFileSync(new URL(`${size}.png`, icons))), [size, size, 8, 6], `${size}.png`)
})

test('the committed icons are what the script makes, and making them again gives the same bytes', () => {
  const out = mkdtempSync(join(tmpdir(), 'titania-icons-'))
  try {
    const run = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/make-icons.ts', import.meta.url)), '--out', out], { encoding: 'utf8' })
    assert.equal(run.status, 0, run.stderr)
    assert.deepEqual(readdirSync(out).sort(), SIZES.map((s) => `${s}.png`).sort(), 'only the five files')
    for (const size of SIZES) {
      const made = readFileSync(join(out, `${size}.png`))
      assert.ok(made.equals(png(size)), `${size}.png: the script and the module agree`)
      assert.ok(made.equals(readFileSync(new URL(`${size}.png`, icons))), `${size}.png differs from the committed file (run node scripts/make-icons.ts)`)
    }
  } finally {
    rmSync(out, { recursive: true, force: true })
  }
})

test('the icon has a transparent corner, the panel background beside the letter and the accent colour in it', () => {
  const size = 128
  const pixels = render(size)
  const at = (x: number, y: number) => [...pixels.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)]
  assert.equal(at(0, 0)[3], 0, 'the corner of the rounded square is transparent')
  assert.deepEqual(at(10, 100), [0x11, 0x12, 0x14, 255], 'the background is the panel\'s --color-bg')
  assert.deepEqual(at(64, 60), [0x9c, 0xbd, 0x6f, 255], 'the stem of the T is the accent colour')
})

