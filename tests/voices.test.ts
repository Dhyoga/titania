import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parseManifest } from '../lib/anim/manifest.ts'
import { parseVoices, voiceAudioPath, voiceFor } from '../lib/voice/voices.ts'

/** `any`: tests mutate arbitrary fields to produce invalid input. */
function voices(): Record<string, any> {
  return {
    version: 1,
    audioLang: 'ja',
    textLang: 'en',
    entries: [
      { id: 'v_001', file: 'v_001.mp3', title: 'Greeting', text: 'Hello', lang: 'en' },
      { id: 'v_002', file: 'v_002.mp3', text: 'Board', lang: 'en', animation: 'BoardAct0201' },
      { id: 'v_003', file: 'v_003.mp3', text: '', lang: 'en', note: 'audio variant' },
    ],
  }
}

test('pairs a clip by animation name and builds the audio path', () => {
  const v = parseVoices(voices())
  const entry = voiceFor(v, 'BoardAct0201')
  assert.equal(entry?.id, 'v_002')
  assert.equal(voiceAudioPath(v, entry!), 'voices_ja/v_002.mp3')
  assert.equal(voiceFor(v, 'UiStand1'), undefined)
  assert.equal(v.entries.length, 3)
})

test('the wiki title of a line is read when there is one', () => {
  const raw = voices()
  raw.entries[1].title = '  General Greeting 12 '
  raw.entries[2].title = 5
  const v = parseVoices(raw)
  assert.equal(voiceFor(v, 'BoardAct0201')?.title, 'General Greeting 12')
  assert.equal(v.entries[0]!.title, 'Greeting')
  assert.equal(v.entries[2]!.title, undefined)
})

test('the folder follows audioLang', () => {
  const raw = voices()
  raw.audioLang = 'en'
  const v = parseVoices(raw)
  assert.equal(voiceAudioPath(v, voiceFor(v, 'BoardAct0201')!), 'voices_en/v_002.mp3')
})

test('a second entry for the same animation is ignored with a warning', () => {
  const raw = voices()
  raw.entries.push({ id: 'v_004', file: 'v_004.mp3', animation: 'BoardAct0201' })
  const warnings: string[] = []
  const v = parseVoices(raw, (m) => warnings.push(m))
  assert.equal(voiceFor(v, 'BoardAct0201')?.id, 'v_002')
  assert.equal(warnings.length, 1)
  assert.match(warnings[0]!, /BoardAct0201.*v_002.*v_004/)
})

test('bad fields fail with their path', () => {
  const cases: [(raw: Record<string, any>) => void, RegExp][] = [
    [(r) => delete r.audioLang, /audioLang: expected a non-empty string/],
    [(r) => (r.audioLang = '../x'), /audioLang: unexpected language code/],
    [(r) => (r.entries = {}), /entries: expected a list/],
    [(r) => (r.entries[1].file = 5), /entries\[1\]\.file: expected a non-empty string/],
    [(r) => (r.entries[1].file = '../anim/manifest.json'), /entries\[1\]\.file: .* must be a file name/],
    [(r) => delete r.entries[0].id, /entries\[0\]\.id/],
    [(r) => (r.entries[1].animation = ''), /entries\[1\]\.animation/],
    [(r) => (r.entries[2] = null), /entries\[2\]: expected an object/],
  ]
  for (const [breakIt, message] of cases) {
    const raw = voices()
    breakIt(raw)
    assert.throws(() => parseVoices(raw), message)
  }
  assert.throws(() => parseVoices([]), /\(root\): expected an object/)
})

// Real data: the shipped Crepuscule voices. Skipped when data/ is absent.
const dataDir = new URL('../data/crepuscule/', import.meta.url)
const skip = !existsSync(new URL('voices.json', dataDir)) && 'data/crepuscule is not present'

test('Crepuscule: exactly the ten Board actions are paired, and every paired file exists', { skip }, () => {
  const v = parseVoices(JSON.parse(readFileSync(new URL('voices.json', dataDir), 'utf8')))
  const manifest = parseManifest(JSON.parse(readFileSync(new URL('anim/manifest.json', dataDir), 'utf8')))
  const board = manifest.clips.filter((c) => c.name.startsWith('BoardAct')).map((c) => c.name).sort()
  assert.deepEqual([...v.byAnimation.keys()].sort(), board)
  assert.equal(board.length, 10)
  assert.equal(voiceAudioPath(v, voiceFor(v, 'BoardAct0201')!), 'voices_ja/v_biankasups_009_12.mp3')
  assert.equal(voiceAudioPath(v, voiceFor(v, 'BoardAct1006')!), 'voices_ja/v_biankasups_019.mp3')
  for (const entry of v.byAnimation.values()) assert.ok(existsSync(new URL(voiceAudioPath(v, entry), dataDir)), entry.file)
  for (const name of ['UiStand1', 'StandAct0101', 'Stand1']) assert.equal(voiceFor(v, name), undefined)
})

test('keeps the transcript when there is one', () => {
  const raw = voices()
  raw.entries[2].text = '   '
  const v = parseVoices(raw)
  assert.equal(v.entries[0]!.text, 'Hello')
  assert.equal(v.entries[2]!.text, undefined)
})
