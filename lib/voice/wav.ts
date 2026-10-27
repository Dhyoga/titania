// PCM WAV encoding. Pure TypeScript: no three.js, no Vue, no browser globals.
//
// A decoded voice line is re-encoded as 16 bit PCM so an `<audio>` element can play it: unlike the VBR MP3s (no seek
// table) a WAV seeks exactly, and the element can change speed without changing pitch.

const HEADER_BYTES = 44

/** 16 bit PCM WAV of equally long float channels in [-1, 1] (values outside are clipped). */
export function encodeWav(channels: readonly Float32Array[], sampleRate: number): ArrayBuffer {
  if (channels.length === 0) throw new Error('encodeWav: no channels')
  const frames = channels[0]!.length
  if (channels.some((c) => c.length !== frames)) throw new Error('encodeWav: channels differ in length')
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) throw new Error(`encodeWav: invalid sample rate ${sampleRate}`)

  const count = channels.length
  const dataBytes = frames * count * 2
  const view = new DataView(new ArrayBuffer(HEADER_BYTES + dataBytes))
  const text = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, count, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * count * 2, true) // byte rate
  view.setUint16(32, count * 2, true) // block align
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, dataBytes, true)

  let offset = HEADER_BYTES
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < count; c++) {
      const v = Math.max(-1, Math.min(1, channels[c]![i]!))
      view.setInt16(offset, v < 0 ? Math.round(v * 0x8000) : Math.round(v * 0x7fff), true)
      offset += 2
    }
  }
  return view.buffer
}
