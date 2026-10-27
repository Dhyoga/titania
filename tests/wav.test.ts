import assert from 'node:assert/strict'
import { test } from 'node:test'
import { encodeWav } from '../lib/voice/wav.ts'

/** A tiny WAV reader for the round trip: header fields and interleaved samples as floats. */
function decode(buffer: ArrayBuffer) {
  const v = new DataView(buffer)
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3))
  const channels = v.getUint16(22, true)
  const samples: number[] = []
  for (let o = 44; o < 44 + v.getUint32(40, true); o += 2) samples.push(v.getInt16(o, true))
  return {
    riff: tag(0), riffSize: v.getUint32(4, true), wave: tag(8), fmt: tag(12), fmtSize: v.getUint32(16, true), format: v.getUint16(20, true), channels,
    rate: v.getUint32(24, true), byteRate: v.getUint32(28, true), align: v.getUint16(32, true), bits: v.getUint16(34, true), data: tag(36), dataSize: v.getUint32(40, true), samples,
  }
}

test('header describes 16 bit PCM at the given rate', () => {
  const wav = encodeWav([new Float32Array(100)], 48000)
  const h = decode(wav)
  assert.equal(wav.byteLength, 44 + 200)
  assert.deepEqual([h.riff, h.wave, h.fmt, h.data], ['RIFF', 'WAVE', 'fmt ', 'data'])
  assert.equal(h.riffSize, wav.byteLength - 8)
  assert.deepEqual([h.fmtSize, h.format, h.channels, h.rate, h.byteRate, h.align, h.bits, h.dataSize], [16, 1, 1, 48000, 96000, 2, 16, 200])
})

test('sample values: silence, full scale, half scale', () => {
  const h = decode(encodeWav([Float32Array.of(0, 1, -1, 0.5, -0.5)], 8000))
  assert.deepEqual(h.samples, [0, 32767, -32768, 16384, -16384])
})

test('values outside [-1, 1] are clipped', () => {
  const h = decode(encodeWav([Float32Array.of(2, -3, 1.0001)], 8000))
  assert.deepEqual(h.samples, [32767, -32768, 32767])
})

test('channels are interleaved', () => {
  const wav = encodeWav([Float32Array.of(1, 0.5), Float32Array.of(-1, -0.5)], 44100)
  const h = decode(wav)
  assert.equal(h.channels, 2)
  assert.equal(h.align, 4)
  assert.equal(h.byteRate, 44100 * 4)
  assert.deepEqual(h.samples, [32767, -32768, 16384, -16384])
})

test('round trip stays within two 16 bit steps', () => {
  const src = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i / 7) * 0.9)
  const h = decode(encodeWav([src], 48000))
  for (let i = 0; i < src.length; i++) assert.ok(Math.abs(h.samples[i]! / 32768 - src[i]!) <= 2 / 32768, `sample ${i}`) // 32767 up, 32768 down, plus rounding
})

test('an empty line is a valid header-only file', () => {
  const wav = encodeWav([new Float32Array(0)], 48000)
  assert.equal(wav.byteLength, 44)
  assert.equal(decode(wav).dataSize, 0)
})

test('bad input is rejected', () => {
  assert.throws(() => encodeWav([], 48000), /no channels/)
  assert.throws(() => encodeWav([new Float32Array(2), new Float32Array(3)], 48000), /differ in length/)
  assert.throws(() => encodeWav([new Float32Array(2)], 0), /sample rate/)
  assert.throws(() => encodeWav([new Float32Array(2)], 44100.5), /sample rate/)
})
