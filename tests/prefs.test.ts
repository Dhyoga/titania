import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  defaultLobby,
  defaultPrefs,
  DEFAULT_DISPLAY,
  importPrefs,
  parsePrefs,
  PrefsError,
  savedSkinCount,
  serializePrefs,
  withOwnOff,
  withPool,
  withSkinParts,
  type Prefs,
} from '../lib/prefs/prefs.ts'
import { DEFAULT_LIGHTING } from '../lib/viewer/lighting.ts'

const camera = { zoom: 0.6, azimuthDeg: 20, polarDeg: 80, target: { x: 0, y: 0.15, z: 0 } }

const sample = (): Prefs => ({
  version: 1,
  display: { backgroundMode: 'solid', solidColor: '#102030', grid: true, follow: false, toon: false, intensity: 1.5, azimuthDeg: -40 },
  camera,
  lobby: { frame: 'pavo', skin: 'r2qumd010011', camera: { ...camera, zoom: 0.45 }, pools: { shukra: ['pavo:BoardAct0201', 'fourth:UiStand1'], third: [] }, ownOff: { shukra: ['shukra:Win'] } },
  skins: { r3qumd010011: { parts: { R3QuMd010011Weapon: 'hide', Band: 'show' } } },
})

test('the defaults are what the panel started with before preferences existed', () => {
  assert.deepEqual(defaultPrefs(), {
    version: 1,
    display: { backgroundMode: 'gradient', solidColor: '#cfd8e6', grid: false, follow: true, toon: true, intensity: 1, azimuthDeg: 0 },
    camera: null,
    lobby: { frame: null, skin: null, camera: null, pools: {}, ownOff: {} },
    skins: {},
  })
  assert.equal(DEFAULT_DISPLAY.intensity, DEFAULT_LIGHTING.intensity)
  assert.equal(DEFAULT_DISPLAY.azimuthDeg, DEFAULT_LIGHTING.azimuthDeg)
})

test('defaults when nothing is stored', () => {
  for (const text of [null, undefined, '']) assert.deepEqual(parsePrefs(text), defaultPrefs())
})

test('corrupt text and things that are not a record fall back to the defaults without throwing', () => {
  for (const text of ['not json', '{', '[]', 'null', '42', '"x"', 'true']) assert.deepEqual(parsePrefs(text), defaultPrefs(), text)
})

test('an unknown or missing version is not read', () => {
  assert.deepEqual(parsePrefs(JSON.stringify({ ...sample(), version: 2 })), defaultPrefs())
  assert.deepEqual(parsePrefs(JSON.stringify({ ...sample(), version: '1' })), defaultPrefs())
  const { version: _version, ...noVersion } = sample()
  assert.deepEqual(parsePrefs(JSON.stringify(noVersion)), defaultPrefs())
})

test('round trip', () => {
  const prefs = sample()
  assert.deepEqual(parsePrefs(serializePrefs(prefs)), prefs)
  assert.deepEqual(importPrefs(serializePrefs(prefs)), prefs)
  assert.deepEqual(parsePrefs(serializePrefs(defaultPrefs())), defaultPrefs())
})

test('each field falls back on its own', () => {
  const text = JSON.stringify({
    version: 1,
    display: { backgroundMode: 'neon', solidColor: 'red', grid: 'yes', follow: false, toon: null, intensity: 'bright', azimuthDeg: 30 },
    camera: { zoom: 'near' },
    skins: { a: { parts: { Hat: 'hide', Hair: 'maybe' } }, b: 'nope', c: { parts: 3 } },
  })
  assert.deepEqual(parsePrefs(text), {
    version: 1,
    display: { ...DEFAULT_DISPLAY, follow: false, azimuthDeg: 30 },
    camera: null,
    lobby: defaultLobby(),
    skins: { a: { parts: { Hat: 'hide' } } },
  })
})

test('a partial record keeps what it has and defaults the rest', () => {
  const only = parsePrefs(JSON.stringify({ version: 1, display: { toon: false } }))
  assert.equal(only.display.toon, false)
  assert.deepEqual({ ...only.display, toon: true }, DEFAULT_DISPLAY)
  assert.equal(only.camera, null)
  assert.deepEqual(only.skins, {})
  assert.deepEqual(parsePrefs(JSON.stringify({ version: 1, camera })).camera, camera)
})

test('values are kept inside their ranges and a colour is lower-cased', () => {
  const p = parsePrefs(JSON.stringify({ version: 1, display: { intensity: 99, azimuthDeg: -999, solidColor: '#ABCDEF' } }))
  assert.equal(p.display.intensity, 2)
  assert.equal(p.display.azimuthDeg, -180)
  assert.equal(p.display.solidColor, '#abcdef')
})

test('a camera that is not a usable view is dropped', () => {
  const bad = [
    { ...camera, zoom: 0 },
    { ...camera, zoom: 1e6 },
    { ...camera, polarDeg: 200 },
    { ...camera, azimuthDeg: Infinity },
    { ...camera, target: { x: 0, y: 0 } },
    { ...camera, target: { x: 0, y: 1e9, z: 0 } },
    { ...camera, target: null },
    [],
    5,
  ]
  for (const c of bad) assert.equal(parsePrefs(JSON.stringify({ version: 1, camera: c })).camera, null, JSON.stringify(c))
})

test('a key that would set the prototype is ignored', () => {
  const text = '{"version":1,"skins":{"__proto__":{"parts":{"Hat":"hide"}},"a":{"parts":{"__proto__":"hide","Hat":"show"}}}}'
  const p = parsePrefs(text)
  assert.deepEqual(p.skins, { a: { parts: { Hat: 'show' } } })
  assert.equal(Object.getPrototypeOf(p.skins), Object.prototype)
  assert.equal(({} as Record<string, unknown>).parts, undefined)
})

test('a skin with no usable parts is not kept', () => {
  assert.deepEqual(parsePrefs(JSON.stringify({ version: 1, skins: { a: { parts: {} }, b: { parts: { Hat: 'x' } } } })).skins, {})
})

test('strict import takes a valid record', () => {
  assert.deepEqual(importPrefs(JSON.stringify({ version: 1 })), defaultPrefs())
  assert.deepEqual(importPrefs(JSON.stringify({ version: 1, camera: null })), defaultPrefs())
})

test('strict import rejects what is not a preferences record', () => {
  for (const text of ['not json', '[]', 'null', '42', '{}', '{"version":2}', '{"version":"1"}', '{"volume":0.5,"muted":true}']) {
    assert.throws(() => importPrefs(text), PrefsError, text)
  }
})

test('strict import rejects a field of the wrong type instead of defaulting it', () => {
  const bad = [
    { version: 1, display: { grid: 'yes' } },
    { version: 1, display: 3 },
    { version: 1, display: { backgroundMode: 'neon' } },
    { version: 1, camera: { zoom: 'near' } },
    { version: 1, skins: [] },
    { version: 1, skins: { a: 5 } },
    { version: 1, skins: { a: { parts: { Hat: 'maybe' } } } },
    { version: 1, lobby: 'shukra' },
    { version: 1, lobby: { frame: 3 } },
    { version: 1, lobby: { skin: '' } },
    { version: 1, lobby: { camera: 'close' } },
  ]
  for (const record of bad) assert.throws(() => importPrefs(JSON.stringify(record)), PrefsError, JSON.stringify(record))
})

test('parts of one skin do not touch another', () => {
  let p = defaultPrefs()
  p = withSkinParts(p, 'a', { Hat: 'hide' })
  p = withSkinParts(p, 'b', { Hair: 'show' })
  assert.deepEqual(p.skins, { a: { parts: { Hat: 'hide' } }, b: { parts: { Hair: 'show' } } })
  const replaced = withSkinParts(p, 'a', { Cape: 'hide' })
  assert.deepEqual(replaced.skins, { a: { parts: { Cape: 'hide' } }, b: { parts: { Hair: 'show' } } })
  assert.deepEqual(p.skins.a, { parts: { Hat: 'hide' } }, 'the old record is not changed')
  assert.equal(savedSkinCount(replaced), 2)
})

test('no parts, or none at all, removes the skin', () => {
  const p = withSkinParts(withSkinParts(defaultPrefs(), 'a', { Hat: 'hide' }), 'b', { Hat: 'hide' })
  assert.deepEqual(withSkinParts(p, 'a', null).skins, { b: { parts: { Hat: 'hide' } } })
  assert.deepEqual(withSkinParts(p, 'a', {}).skins, { b: { parts: { Hat: 'hide' } } })
  assert.equal(savedSkinCount(withSkinParts(p, 'zzz', null)), 2)
})

test('the record holds no voice settings, and an imported file cannot bring any in', () => {
  const text = serializePrefs(sample())
  for (const key of ['volume', 'muted', 'subtitles']) assert.ok(!text.includes(`"${key}"`), key)
  const withVoice = JSON.stringify({ ...sample(), volume: 0.2, muted: true, subtitles: false, display: { ...sample().display, volume: 0.1 } })
  const imported = importPrefs(withVoice)
  const again = serializePrefs(imported)
  for (const key of ['volume', 'muted', 'subtitles']) assert.ok(!again.includes(`"${key}"`), key)
  assert.deepEqual(Object.keys(JSON.parse(again)).sort(), ['camera', 'display', 'lobby', 'skins', 'version'])
})

test('a record or file from before Display mode reads the Display defaults and keeps the rest', () => {
  const { lobby: _lobby, ...old } = sample()
  const text = JSON.stringify(old)
  assert.deepEqual(parsePrefs(text), { ...sample(), lobby: defaultLobby() })
  assert.deepEqual(importPrefs(text), { ...sample(), lobby: defaultLobby() })
})

test('each Display field falls back on its own', () => {
  const read = (lobby: unknown) => parsePrefs(JSON.stringify({ ...sample(), lobby })).lobby
  assert.deepEqual(read('shukra'), defaultLobby())
  assert.deepEqual(read({ frame: 'third', skin: 7, camera: 'close' }), { frame: 'third', skin: null, camera: null, pools: {}, ownOff: {} })
  assert.deepEqual(read({ frame: '', skin: 'r3qumd019011', camera }), { frame: null, skin: 'r3qumd019011', camera, pools: {}, ownOff: {} })
  assert.deepEqual(read({ frame: 'x'.repeat(65) }), defaultLobby())
  // The Display camera is independent of the Playground one.
  const p = parsePrefs(JSON.stringify({ ...sample(), camera: 'bad' }))
  assert.equal(p.camera, null)
  assert.deepEqual(p.lobby, sample().lobby)
})

test('the Display model and camera survive a round trip and go with forget all', () => {
  const text = serializePrefs(sample())
  assert.deepEqual(JSON.parse(text).lobby, sample().lobby)
  assert.deepEqual(importPrefs(text).lobby, sample().lobby)
  assert.deepEqual(defaultPrefs().lobby, defaultLobby())
})

// ---- the Display animation choices (add-lobby-pool-menu) ----

test('the animation choices read tolerantly: a bad entry or key is dropped on its own, duplicates once, an empty list is kept', () => {
  const read = (pools: unknown) => parsePrefs(JSON.stringify({ ...sample(), lobby: { ...sample().lobby, pools } })).lobby.pools
  assert.deepEqual(read('all'), {})
  assert.deepEqual(read([['a:b']]), {})
  assert.deepEqual(read({ shukra: 'x', third: ['fourth:BoardAct1004', 'fourth:BoardAct1004', 7, 'nocolon', ':x', 'x:', 'z'.repeat(70) + ':a', null] }), { third: ['fourth:BoardAct1004'] })
  assert.deepEqual(read({ pavo: [] }), { pavo: [] })
  assert.deepEqual(read({ '': ['a:b'], ['x'.repeat(65)]: ['a:b'] }), {})
  assert.deepEqual(read(JSON.parse('{"__proto__": ["a:b"], "fourth": ["third:Run"]}')), { fourth: ['third:Run'] })
  assert.deepEqual(Object.keys(read(JSON.parse('{"__proto__": ["a:b"]}'))), [])
  // The other Display fields are unaffected.
  const p = parsePrefs(JSON.stringify({ ...sample(), lobby: { ...sample().lobby, pools: 3 } }))
  assert.deepEqual({ ...p.lobby, pools: {} }, { ...sample().lobby, pools: {} })
})

test('the animation choices read strictly: any wrong shape is an error and names the field', () => {
  const imp = (pools: unknown) => () => importPrefs(JSON.stringify({ ...sample(), lobby: { ...sample().lobby, pools } }))
  assert.throws(imp('all'), PrefsError)
  assert.throws(imp([]), PrefsError)
  assert.throws(imp({ shukra: 'pavo:BoardAct0201' }), /lobby\.pools\.shukra/)
  assert.throws(imp({ shukra: ['pavo:BoardAct0201', 5] }), /lobby\.pools\.shukra/)
  assert.throws(imp({ shukra: ['no colon'] }), PrefsError)
  assert.doesNotThrow(imp({ shukra: ['pavo:BoardAct0201'], third: [] }))
})

test('a record or file without the animation choices reads every frame on its default', () => {
  const { pools: _pools, ...lobby } = sample().lobby
  const text = JSON.stringify({ ...sample(), lobby })
  assert.deepEqual(parsePrefs(text).lobby.pools, {})
  assert.deepEqual(importPrefs(text).lobby.pools, {})
  assert.deepEqual(parsePrefs(text).lobby.frame, 'pavo')
})

test('the animation choices survive a round trip and an export, and go with forget all', () => {
  const text = serializePrefs(sample())
  assert.deepEqual(JSON.parse(text).lobby.pools, sample().lobby.pools)
  assert.deepEqual(importPrefs(text).lobby.pools, sample().lobby.pools)
  assert.deepEqual(defaultPrefs().lobby.pools, {})
})

test('withPool sets, replaces and forgets one frame\'s choice and leaves the rest alone', () => {
  const base = sample()
  const set = withPool(base, 'fourth', ['pavo:BoardAct1004', 'pavo:BoardAct1004'])
  assert.deepEqual(set.lobby.pools, { ...base.lobby.pools, fourth: ['pavo:BoardAct1004'] })
  assert.deepEqual(base.lobby.pools.shukra, ['pavo:BoardAct0201', 'fourth:UiStand1'], 'the input is not changed')
  assert.deepEqual(withPool(set, 'fourth', []).lobby.pools.fourth, [])
  assert.equal('fourth' in withPool(set, 'fourth', null).lobby.pools, false)
  assert.deepEqual(withPool(base, 'shukra', null).lobby.pools, { third: [] })
  assert.equal(withPool(base, '__proto__', ['a:b']), base)
  assert.deepEqual({ ...set.lobby, pools: {} }, { ...base.lobby, pools: {} })
})

// ---- the own Fight clips turned off (port-pgr-updates, from PGR's add-lobby-fight-idles) ----

test('own Fight clips turned off read tolerantly and strictly like the animation choices, naming their own field', () => {
  const read = (ownOff: unknown) => parsePrefs(JSON.stringify({ ...sample(), lobby: { ...sample().lobby, ownOff } })).lobby.ownOff
  assert.deepEqual(read('all'), {})
  assert.deepEqual(read({ shukra: 'x', third: ['third:Win', 'third:Win', 7, 'nocolon'] }), { third: ['third:Win'] })
  assert.deepEqual(read({ fourth: [] }), { fourth: [] })
  assert.deepEqual(Object.keys(read(JSON.parse('{"__proto__": ["a:b"]}'))), [])
  // The borrowed choices are unaffected by a bad ownOff.
  assert.deepEqual(parsePrefs(JSON.stringify({ ...sample(), lobby: { ...sample().lobby, ownOff: 3 } })).lobby.pools, sample().lobby.pools)
  const imp = (ownOff: unknown) => () => importPrefs(JSON.stringify({ ...sample(), lobby: { ...sample().lobby, ownOff } }))
  assert.throws(imp('all'), /lobby\.ownOff/)
  assert.throws(imp({ shukra: 'shukra:Win' }), /lobby\.ownOff\.shukra/)
  assert.throws(imp({ shukra: ['shukra:Win', 5] }), /lobby\.ownOff\.shukra/)
  assert.doesNotThrow(imp({ shukra: ['shukra:Win'], third: [] }))
})

test('a record or file from before Fight idles has no own Fight clip off and keeps its borrowed choice', () => {
  const { ownOff: _ownOff, ...lobby } = sample().lobby
  const text = JSON.stringify({ ...sample(), lobby })
  assert.deepEqual(parsePrefs(text).lobby.ownOff, {})
  assert.deepEqual(importPrefs(text).lobby.ownOff, {})
  assert.deepEqual(parsePrefs(text).lobby.pools, sample().lobby.pools)
})

test('own Fight clips turned off survive a round trip and an export, and go with forget all', () => {
  const text = serializePrefs(sample())
  assert.deepEqual(JSON.parse(text).lobby.ownOff, sample().lobby.ownOff)
  assert.deepEqual(importPrefs(text).lobby.ownOff, sample().lobby.ownOff)
  assert.deepEqual(defaultPrefs().lobby.ownOff, {})
})

test('withOwnOff sets and clears one frame\'s list, and forgetting a frame\'s choice clears both lists', () => {
  const base = sample()
  const set = withOwnOff(base, 'third', ['third:Save', 'third:Save'])
  assert.deepEqual(set.lobby.ownOff, { shukra: ['shukra:Win'], third: ['third:Save'] })
  assert.deepEqual(base.lobby.ownOff, { shukra: ['shukra:Win'] }, 'the input is not changed')
  assert.equal('third' in withOwnOff(set, 'third', []).lobby.ownOff, false)
  assert.equal('third' in withOwnOff(set, 'third', null).lobby.ownOff, false)
  assert.equal(withOwnOff(base, '__proto__', ['a:b']), base)
  const forgotten = withPool(base, 'shukra', null)
  assert.deepEqual(forgotten.lobby.pools, { third: [] })
  assert.deepEqual(forgotten.lobby.ownOff, {})
  assert.deepEqual(withPool(base, 'shukra', ['fourth:Run']).lobby.ownOff, base.lobby.ownOff, 'saving borrowed keys leaves ownOff')
})
