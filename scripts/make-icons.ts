// Makes the extension icons: a monogram T in the panel's accent colour on its dark background, as 16, 32, 48, 96 and 128 px PNG files.
// No game asset and no dependency: the shape is drawn from geometry (4 x 4 samples per pixel at every size, so each size is crisp rather
// than a scaled copy) and the PNG is written with Node's `zlib`. The output is deterministic (no timestamps), so the files can be committed.
//
// Usage (from the repository root):
//   node scripts/make-icons.ts [--out <folder>]      # default: public/icon (WXT adds public/icon/<size>.png to the manifest)
// Reads nothing from data/; writes only <size>.png into the folder.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { crc32, deflateSync } from 'node:zlib'

export const SIZES = [16, 32, 48, 96, 128] as const

// The panel's colours (assets/app.css): --color-bg and --color-accent.
const BACKGROUND: [number, number, number] = [0x11, 0x12, 0x14]
const ACCENT: [number, number, number] = [0x9c, 0xbd, 0x6f]
const SAMPLES = 4

/** What lies at a point (x, y in 0..1): outside the rounded square, the letter, or the square's background. */
function shape(x: number, y: number): 'outside' | 'letter' | 'background' {
  // Rounded square filling the canvas, corner radius 0.22.
  const r = 0.22
  const cx = Math.min(Math.max(x, r), 1 - r)
  const cy = Math.min(Math.max(y, r), 1 - r)
  if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) return 'outside'
  // The T: a top bar and a stem, centred.
  const bar = x >= 0.2 && x <= 0.8 && y >= 0.22 && y <= 0.4
  const stem = x >= 0.42 && x <= 0.58 && y >= 0.22 && y <= 0.8
  return bar || stem ? 'letter' : 'background'
}

/** RGBA pixels of the icon at `size` px, row by row. */
export function render(size: number): Uint8Array {
  const out = new Uint8Array(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let letter = 0
      let background = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const s = shape((px + (sx + 0.5) / SAMPLES) / size, (py + (sy + 0.5) / SAMPLES) / size)
          if (s === 'letter') letter++
          else if (s === 'background') background++
        }
      }
      const covered = letter + background
      const o = (py * size + px) * 4
      if (covered === 0) continue // fully transparent
      for (let c = 0; c < 3; c++) out[o + c] = Math.round((ACCENT[c]! * letter + BACKGROUND[c]! * background) / covered)
      out[o + 3] = Math.round((255 * covered) / (SAMPLES * SAMPLES))
    }
  }
  return out
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

/** A PNG file (8-bit RGBA, no interlace) of `size` × `size` pixels. */
export function png(size: number): Buffer {
  const pixels = render(size)
  const rows = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0 // filter: none
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(rows, y * (size * 4 + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const i = args.indexOf('--out')
  const out = resolve(i >= 0 ? (args[i + 1] ?? '') : join(import.meta.dirname, '..', 'public', 'icon'))
  if (i >= 0 && !args[i + 1]) {
    console.error('make-icons: --out needs a folder')
    process.exit(1)
  }
  mkdirSync(out, { recursive: true })
  for (const size of SIZES) writeFileSync(join(out, `${size}.png`), png(size))
  console.log(`make-icons: wrote ${SIZES.map((s) => `${s}.png`).join(', ')} to ${out}`)
}
