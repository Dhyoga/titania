import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

// Checks of the generated `voices.json` of each Bianca frame against data/ and the pairing table
// (`voice_pairings.json`, read by build_voices.py). Crepuscule's shipped file is included: the table's Crepuscule section is what
// the builder is checked with. Skipped when data/ is absent.

const FRAMES = ['crepuscule', 'stigmata', 'veritas', 'zero'] as const
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

/** Names of every clip of the frame's manifests (default set and all skin sets), read raw: foreign manifests need no parsing here. */
function clipNames(frame: string): Set<string> {
  const folders = ['anim', ...readdirSync(new URL(`${frame}/anim-skins/`, dataDir)).map((d) => `anim-skins/${d}`)]
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

test('Stigmata: the paired lines are as long as the user\'s table suggests (BoardAct0201 is General Greeting 6)', { skip }, () => {
  const entry = voices('stigmata').entries.find((e) => e.animation === 'BoardAct0201')
  assert.equal(entry?.id, 'v_biankasuper_9_6')
  assert.equal(entry?.title, 'General Greeting 6')
})

test('Solitary Dream\'s extra Board actions exist only in skin r4biankamd019241 and are paired', { skip }, () => {
  const v = voices('stigmata')
  for (const clip of ['BoardAct10021', 'BoardAct10022']) {
    assert.ok(v.entries.some((e) => e.animation === clip), `${clip} is paired`)
    const m = readJson<{ clips: { name: string }[] }>(new URL('stigmata/anim/manifest.json', dataDir))
    assert.ok(!m.clips.some((c) => c.name === clip), `${clip} is not in the default clip set`)
    const sd = readJson<{ clips: { name: string }[] }>(new URL('stigmata/anim-skins/r4biankamd019241/manifest.json', dataDir))
    assert.ok(sd.clips.some((c) => c.name === clip), `${clip} is in skin 019241's clip set`)
  }
})

test('Veritas has no line for BoardAct0202 and BoardAct0203', { skip }, () => {
  const paired = new Set(voices('veritas').entries.map((e) => e.animation))
  assert.ok(!paired.has('BoardAct0202') && !paired.has('BoardAct0203'))
})
