import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { buildCues, cueAt, speechSpan } from '../lib/voice/subtitles.ts'

test('one short sentence is one cue over the whole voice', () => {
  const cues = buildCues('Rest now, rest now.', 10, { start: 1, end: 9 })
  assert.deepEqual(cues, [{ start: 1, end: 9, text: 'Rest now, rest now.' }])
})

test('sentences become cues in order, touching, within the speech span', () => {
  const text = 'Welcome back, my Commandant... It is only natural to grow attached to places full of memories. Before I knew it, this was my home.'
  const cues = buildCues(text, 20, { start: 0.5, end: 18 })
  assert.equal(cues.length, 3)
  assert.equal(cues.map((c) => c.text).join(' '), text)
  assert.equal(cues[0]!.start, 0.5)
  assert.ok(Math.abs(cues[2]!.end - 18) < 1e-9)
  for (let i = 1; i < cues.length; i++) assert.ok(Math.abs(cues[i]!.start - cues[i - 1]!.end) < 1e-9)
  assert.ok(cues[1]!.end - cues[1]!.start > cues[0]!.end - cues[0]!.start, 'longer sentence gets more time')
})

test('very short pieces are joined, abbreviations are not split', () => {
  const cues = buildCues('Watch out...! Commandant, stay close to me! Huh? Sigh... Never mind…', 10)
  assert.deepEqual(cues.map((c) => c.text), ['Watch out...! Commandant, stay close to me!', 'Huh? Sigh... Never mind…'])
  assert.equal(buildCues('they gather in my M.I.N.D., scene after scene and more words here.', 5).length, 1)
})

test('a long sentence is cut at a comma near its middle', () => {
  const text = 'I understand that you are thinking of the long road ahead of you, but my concern lies with what is in front of me right now.'
  const cues = buildCues(text, 12)
  assert.equal(cues.length, 2)
  assert.ok(cues[0]!.text.endsWith(','))
  assert.ok(cues.every((c) => c.text.length <= 100))
})

test('no text or no duration gives no cues', () => {
  assert.deepEqual(buildCues('   ', 5), [])
  assert.deepEqual(buildCues('Hello there, Commandant.', 0), [])
})

test('cueAt: nothing before the voice, the cue in range, nothing a moment after the end', () => {
  const cues = buildCues('One sentence goes here for sure. Another one follows right behind it.', 10, { start: 1, end: 9 })
  assert.equal(cueAt(cues, 0.5), null)
  assert.equal(cueAt(cues, 1)?.text, cues[0]!.text)
  assert.equal(cueAt(cues, cues[1]!.start)?.text, cues[1]!.text)
  assert.equal(cueAt(cues, 9.2)?.text, cues[1]!.text)
  assert.equal(cueAt(cues, 9.5), null)
  assert.equal(cueAt([], 3), null)
})

test('speechSpan finds where the sound starts and stops', () => {
  const rate = 100
  const samples = new Float32Array(1000)
  samples.fill(0.5, 200, 700)
  const span = speechSpan([samples], rate)
  assert.equal(span.start, 2)
  assert.equal(span.end, 7)
  assert.deepEqual(speechSpan([new Float32Array(300)], rate), { start: 0, end: 3 })
})

test('every shipped paired line gets cues of readable length', { skip: !existsSync('data/crepuscule/voices.json') }, () => {
  const raw = JSON.parse(readFileSync('data/crepuscule/voices.json', 'utf8')) as { entries: { animation?: string; text?: string }[] }
  const paired = raw.entries.filter((e) => e.animation && e.text)
  assert.equal(paired.length, 10)
  for (const e of paired) {
    const cues = buildCues(e.text!, 30, { start: 0.3, end: 29 })
    assert.ok(cues.length >= 1 && cues.length <= 8, `${e.animation}: ${cues.length} cues`)
    assert.ok(cues.every((c) => c.text.length <= 140 && c.end > c.start), e.animation!)
    assert.equal(cues.map((c) => c.text).join(' '), e.text!.replace(/\s+/g, ' ').trim(), e.animation!)
  }
})
