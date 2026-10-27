import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_VOICE_SETTINGS, parseVoiceSettings, serializeVoiceSettings } from '../lib/voice/voiceSettings.ts'

test('defaults when nothing is stored', () => {
  assert.deepEqual(parseVoiceSettings(null), DEFAULT_VOICE_SETTINGS)
  assert.deepEqual(parseVoiceSettings(undefined), DEFAULT_VOICE_SETTINGS)
  assert.deepEqual(parseVoiceSettings(''), DEFAULT_VOICE_SETTINGS)
})

test('round trip', () => {
  const s = { volume: 0.4, muted: true, subtitles: false }
  assert.deepEqual(parseVoiceSettings(serializeVoiceSettings(s)), s)
})

test('garbage falls back to the defaults without throwing', () => {
  for (const text of ['not json', '[]', 'null', '42', '"x"', '{"volume":"loud","muted":"yes","subtitles":"no"}']) {
    assert.deepEqual(parseVoiceSettings(text), DEFAULT_VOICE_SETTINGS, text)
  }
})

test('each field falls back on its own', () => {
  assert.deepEqual(parseVoiceSettings('{"volume":0.25}'), { volume: 0.25, muted: false, subtitles: true })
  assert.deepEqual(parseVoiceSettings('{"muted":true}'), { volume: 1, muted: true, subtitles: true })
  assert.deepEqual(parseVoiceSettings('{"volume":null,"muted":true}'), { volume: 1, muted: true, subtitles: true })
})

test('subtitles can be stored off', () => {
  assert.equal(parseVoiceSettings('{"subtitles":false}').subtitles, false)
})

test('volume is clamped to 0..1', () => {
  assert.equal(parseVoiceSettings('{"volume":7}').volume, 1)
  assert.equal(parseVoiceSettings('{"volume":-3}').volume, 0)
})

test('the defaults object is not shared with callers', () => {
  const a = parseVoiceSettings(null)
  a.volume = 0
  assert.equal(parseVoiceSettings(null).volume, 1)
})
