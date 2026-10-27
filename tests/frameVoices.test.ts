import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

// Checks of the generated `voices.json` of Shukra and Pavo against data/ and the pairing table
// (`voice_pairings.json`, read by build_voices.py). Skipped when data/ or a voices.json is absent.

const FRAMES = ['shukra', 'pavo'] as const
/** The huaxu voice folder of each frame's audio (design D3 of bootstrap-titania). */
const VOICE_FOLDER = { shukra: 'v_qus', pavo: 'v_qu' } as const
const dataDir = new URL('../data/', import.meta.url)
const skip = !FRAMES.every((f) => existsSync(new URL(`${f}/voices.json`, dataDir))) && 'data/ or a voices.json is not present (run build_voices.py)'

interface Entry {
  id: string
  file: string
  animation?: string
  title?: string
  text: string
  lang: string
  note?: string
}
interface VoicesFile {
  version: number
  audioLang: string
  textLang: string
  entries: Entry[]
}

const readJson = <T>(url: URL): T => JSON.parse(readFileSync(url, 'utf8')) as T
const voices = (frame: string): VoicesFile => readJson<VoicesFile>(new URL(`${frame}/voices.json`, dataDir))
const table = readJson<Record<string, Record<string, string>>>(new URL('../voice_pairings.json', import.meta.url))

/** Names of every clip of the frame's manifests (the Generic set, and any `anim-skins/` set), read raw: no parsing needed here. */
function clipNames(frame: string): Set<string> {
  const skins = new URL(`${frame}/anim-skins/`, dataDir)
  const folders = ['anim', ...(existsSync(skins) ? readdirSync(skins).map((d) => `anim-skins/${d}`) : [])]
  const names = new Set<string>()
  for (const folder of folders) {
    const manifest = new URL(`${frame}/${folder}/manifest.json`, dataDir)
    if (!existsSync(manifest)) continue
    for (const clip of readJson<{ clips: { name: string }[] }>(manifest).clips) names.add(clip.name)
  }
  return names
}

for (const frame of FRAMES) {
  test(`${frame}: voices.json entries are well formed and their audio exists`, { skip }, () => {
    const v = voices(frame)
    assert.equal(v.version, 1)
    assert.equal(v.audioLang, 'ja')
    assert.equal(v.textLang, 'en')
    const files = new Set(readdirSync(new URL(`${frame}/voices_ja/`, dataDir)))
    assert.equal(v.entries.length, files.size, 'one entry per file of voices_ja/')
    assert.equal(new Set(v.entries.map((e) => e.id)).size, v.entries.length, 'ids are unique')
    for (const e of v.entries) {
      assert.equal(e.file, `${e.id}.mp3`, e.id)
      assert.ok(files.has(e.file), `${frame}: ${e.file} is not in voices_ja/`)
      assert.equal(e.lang, 'en')
      if (e.title) assert.ok(e.text.length > 0, `${e.id} has a title but no text`)
      else assert.ok(e.note && e.text === '', `${e.id} has neither a title nor a note`)
    }
  })

  test(`${frame}: every pairing names a Board action of the frame and no clip is paired twice`, { skip }, () => {
    const names = clipNames(frame)
    const paired = voices(frame).entries.filter((e) => e.animation !== undefined)
    const clips = paired.map((e) => e.animation!)
    assert.equal(new Set(clips).size, clips.length, `${frame}: a clip is paired twice`)
    for (const e of paired) {
      assert.ok(e.title, `${e.id} is paired but has no title`)
      assert.match(e.animation!, /^BoardAct\d+$/, e.id)
      assert.ok(names.has(e.animation!), `${frame}: ${e.animation} (${e.id}) is not a clip of the frame's manifests`)
    }
  })

  test(`${frame}: every pairing of voice_pairings.json is present, and only those`, { skip }, () => {
    const wanted = table[frame] ?? {}
    const paired = new Map(voices(frame).entries.filter((e) => e.animation !== undefined).map((e) => [e.animation!, e]))
    assert.deepEqual([...paired.keys()].sort(), Object.keys(wanted).sort(), `${frame}: paired clips differ from the table`)
    for (const [clip, title] of Object.entries(wanted)) assert.equal(paired.get(clip)?.title, title, `${frame}: ${clip}`)
  })
}

for (const frame of FRAMES) {
  test(`${frame}: every entry's audio comes from the frame's own voice folder (${VOICE_FOLDER[frame]})`, { skip }, () => {
    for (const e of voices(frame).entries) assert.match(e.id, new RegExp(`^${VOICE_FOLDER[frame]}_\\d`), e.id)
  })
}

test('the pairing table says that the pairs were chosen by listening', { skip }, () => {
  const comment = (table as unknown as { _comment?: string })._comment ?? ''
  assert.match(comment, /listen/i, 'the `_comment` of voice_pairings.json must say how the pairs were chosen')
})
