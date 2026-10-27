import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parseManifest } from '../lib/anim/manifest.ts'

/**
 * Smallest manifest the parser accepts; tests copy and break parts of it.
 * `any`: the tests mutate arbitrary nested fields to produce invalid input.
 */
function manifest(): Record<string, any> {
  return {
    formatVersion: 1,
    target: 'skin1',
    model: 'base.glb',
    defaultContext: 'menu',
    clips: [
      { name: 'Born', file: 'anim/BaseLayer/Born.json', duration: 2, frameRate: 30, loop: false, rootNode: 13 },
      { name: 'UiStand1', file: 'anim/UiStand1.json', duration: 20, frameRate: 30, loop: true, rootNode: 13 },
    ],
    controllers: [
      { id: 'ctl', layers: [{ name: 'BaseLayer', blending: 'override', default: 'Born', states: { Born: { clip: 0 }, Run: { clip: 1, blend: [0, 1], skills: [5] } } }] },
    ],
    contexts: {
      menu: {
        base: 'ctl',
        entry: { clip: 1 },
        idle: { clip: 1 },
        hiddenNodes: [3, 4],
        stateHides: { Born: [7] },
        mounts: [{ slot: 1, name: 'UiWeaponCase1', node: 9, skillNode: null }],
      },
      fight: {
        base: 'ctl',
        entry: { controller: 'ctl', layer: 0, state: 'Born' },
        idle: { controller: 'ctl', layer: 0, state: 'Run' },
        hiddenNodes: [],
        mounts: [],
        transitions: { default: 0.1 },
      },
    },
    eventTables: { stopAnimNames: [] },
  }
}

test('parses a valid manifest into typed data', () => {
  const m = parseManifest(manifest())
  assert.equal(m.target, 'skin1')
  assert.equal(m.clips.length, 2)
  assert.equal(m.clips[1]!.name, 'UiStand1')
  assert.deepEqual(m.contexts.menu.hiddenNodes, [3, 4])
  assert.deepEqual(m.contexts.menu.stateHides, { Born: [7] })
  assert.equal(m.contexts.menu.idle.clip, 1)
  assert.deepEqual(m.controllers[0]!.layers[0]!.states.Run, { clip: 1, blend: [0, 1], skills: [5] })
  assert.equal(m.contexts.menu.mounts[0]!.skillNode, null)
})

test('optional fight.levels may be missing and unknown keys are ignored', () => {
  const raw = manifest()
  raw.somethingNew = { a: 1 }
  raw.contexts.other = { whatever: true }
  const m = parseManifest(raw)
  assert.equal(m.contexts.fight.levels, undefined)
  assert.equal('eventTables' in m, false)
  assert.equal('somethingNew' in m, false)
  raw.contexts.fight.levels = ['a', 'b']
  assert.deepEqual(parseManifest(raw).contexts.fight.levels, ['a', 'b'])
})

test('errors name the field path', () => {
  const cases: [string, (m: Record<string, any>) => void, RegExp][] = [
    ['hiddenNodes not a list of integers', (m) => (m.contexts.menu.hiddenNodes = [1, 'x']), /contexts\.menu\.hiddenNodes\[1\]/],
    ['hiddenNodes negative', (m) => (m.contexts.menu.hiddenNodes = [-1]), /contexts\.menu\.hiddenNodes\[0\]/],
    ['fight hiddenNodes not a list', (m) => (m.contexts.fight.hiddenNodes = 'x'), /contexts\.fight\.hiddenNodes/],
    ['stateHides not an object', (m) => (m.contexts.menu.stateHides = 5), /contexts\.menu\.stateHides/],
    ['wrong formatVersion', (m) => (m.formatVersion = 2), /formatVersion/],
    ['clip file without anim/ prefix', (m) => (m.clips[0].file = 'BaseLayer/Born.json'), /clips\[0\]\.file/],
    ['clip duration not a number', (m) => (m.clips[1].duration = '20'), /clips\[1\]\.duration/],
    ['clip loop not boolean', (m) => (m.clips[0].loop = 1), /clips\[0\]\.loop/],
    ['menu idle clip out of range', (m) => (m.contexts.menu.idle.clip = 2), /contexts\.menu\.idle\.clip/],
    ['fight idle without state', (m) => delete m.contexts.fight.idle.state, /contexts\.fight\.idle\.state/],
    ['stateHides entry not a list', (m) => (m.contexts.menu.stateHides.Born = 'x'), /contexts\.menu\.stateHides\.Born/],
    ['mount node missing', (m) => delete m.contexts.menu.mounts[0].node, /contexts\.menu\.mounts\[0\]\.node/],
    ['contexts missing', (m) => delete m.contexts, /contexts/],
  ]
  for (const [label, mutate, pattern] of cases) {
    const raw = manifest()
    mutate(raw)
    assert.throws(() => parseManifest(raw), pattern, label)
  }
  assert.throws(() => parseManifest(null), /\(root\)/)
  assert.throws(() => parseManifest([]), /\(root\)/)
})

test('hiddenNodes and stateHides are optional and default to empty', () => {
  const raw = manifest()
  delete raw.contexts.menu.hiddenNodes
  delete raw.contexts.menu.stateHides
  delete raw.contexts.fight.hiddenNodes
  const m = parseManifest(raw)
  assert.deepEqual(m.contexts.menu.hiddenNodes, [])
  assert.deepEqual(m.contexts.menu.stateHides, {})
  assert.deepEqual(m.contexts.fight.hiddenNodes, [])
})

test('a controller state with a clip index outside the list names the controller and the state', () => {
  const raw = manifest()
  raw.controllers[0].layers[0].states.Run.clip = 500
  assert.throws(() => parseManifest(raw), (err: Error) => /ctl/.test(err.message) && /Run/.test(err.message) && /500/.test(err.message))
})

// ---------------------------------------------------------------- the real file (skipped when data/ is absent)

const defaultManifest = new URL('../data/crepuscule/anim/manifest.json', import.meta.url)

test('real default manifest parses', { skip: !existsSync(defaultManifest) && 'data/ is not present' }, () => {
  const m = parseManifest(JSON.parse(readFileSync(defaultManifest, 'utf8')))
  assert.equal(m.target, 'r5biankamd010011')
  assert.equal(m.clips.length, 139)
  assert.deepEqual(m.contexts.menu.hiddenNodes, [392, 394, 395, 396])
  assert.equal(m.clips[m.contexts.menu.idle.clip]!.name, 'UiStand1')
  assert.equal(m.clips[m.contexts.menu.entry.clip]!.name, 'UiStand1')
})

test('real manifests of Stigmata, Veritas and Zero parse (no hidden node lists)', { skip: !existsSync(new URL('../data/stigmata/anim/manifest.json', import.meta.url)) && 'data/ is not present' }, () => {
  for (const [frame, clips] of [['stigmata', 113], ['veritas', 55], ['zero', 51]] as const) {
    const m = parseManifest(JSON.parse(readFileSync(new URL(`../data/${frame}/anim/manifest.json`, import.meta.url), 'utf8')))
    assert.equal(m.clips.length, clips, frame)
    assert.deepEqual(m.contexts.menu.hiddenNodes, [], frame)
    assert.deepEqual(m.contexts.menu.stateHides, {}, frame)
    assert.equal(m.clips[m.contexts.menu.idle.clip]!.name, 'UiStand1', frame)
  }
})
