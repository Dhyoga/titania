import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { buildCatalog, hiddenNodesFor, naturalCompare, ownItemId, resolveFightIdle, withSources, type AnimationSource } from '../lib/anim/catalog.ts'
import { FRAMES } from '../lib/constructs/index.ts'
import { parseManifest, type AnimManifest } from '../lib/anim/manifest.ts'

/** A manifest with the given clips; `menu` and `fight` list clip names per controller. */
function synthetic(opts: {
  clips: { name: string; file?: string; loop?: boolean }[]
  menu: string[]
  fight: string[]
  levels?: string[]
  menuIdle: string
  fightIdle: string
}): AnimManifest {
  const index = (name: string, from = 0) => {
    const i = opts.clips.findIndex((c, n) => n >= from && c.name === name)
    assert.ok(i >= 0, `clip ${name} missing in test setup`)
    return i
  }
  const states = (names: string[]) => Object.fromEntries(names.map((n, i) => [`${n}#${i}`, { clip: index(n) }]))
  const layer = (names: string[]) => ({ name: 'BaseLayer', blending: 'override', default: 'x', states: states(names) })
  const controllers = [
    { id: 'menuCtl', layers: [layer(opts.menu)] },
    { id: 'fightCtl', layers: [layer(opts.fight)] },
    ...(opts.levels ? [{ id: 'levelCtl', layers: [layer(opts.levels)] }] : []),
  ]
  return parseManifest({
    formatVersion: 1,
    target: 'skin',
    model: 'base.glb',
    defaultContext: 'menu',
    clips: opts.clips.map((c) => ({ name: c.name, file: c.file ?? `anim/BaseLayer/${c.name}.json`, duration: 1, frameRate: 30, loop: c.loop ?? false, rootNode: 0 })),
    controllers,
    contexts: {
      menu: { base: 'menuCtl', entry: { clip: index(opts.menuIdle) }, idle: { clip: index(opts.menuIdle) }, hiddenNodes: [], stateHides: {}, mounts: [] },
      fight: {
        base: 'fightCtl',
        entry: { controller: 'fightCtl', layer: 0, state: `${opts.fightIdle}#0` },
        idle: { controller: 'fightCtl', layer: 0, state: `${opts.fightIdle}#${opts.fight.indexOf(opts.fightIdle)}` },
        ...(opts.levels ? { levels: ['levelCtl'] } : {}),
        hiddenNodes: [],
        mounts: [],
      },
    },
  })
}

const labels = (m: AnimManifest, ctx: 'menu' | 'fight') => buildCatalog(m, ctx).groups.map((g) => [g.label, g.items.map((i) => i.label)] as const)

test('naturalCompare orders digit runs by value', () => {
  const sorted = ['Attack11', 'Attack2', 'Attack01', 'Attack1'].sort(naturalCompare)
  assert.deepEqual(sorted, ['Attack1', 'Attack01', 'Attack2', 'Attack11']) // equal values: the shorter spelling first
  assert.ok(naturalCompare('BoardAct0203', 'BoardAct1001') < 0)
  assert.ok(naturalCompare('Run', 'RunStart') < 0)
})

test('menu: idle and board actions, sorted, idle clip added and default', () => {
  const m = synthetic({
    clips: [{ name: 'BoardAct1001' }, { name: 'BoardAct0201' }, { name: 'StandAct0101', loop: true }, { name: 'UiStand1', loop: true }, { name: 'Stand1' }],
    menu: ['BoardAct1001', 'BoardAct0201', 'StandAct0101'], // UiStand1 is only the idle clip
    fight: ['Stand1'],
    menuIdle: 'UiStand1',
    fightIdle: 'Stand1',
  })
  const catalog = buildCatalog(m, 'menu')
  assert.deepEqual(labels(m, 'menu'), [
    ['Idle', ['StandAct0101', 'UiStand1']],
    ['Board actions', ['BoardAct0201', 'BoardAct1001']],
  ])
  assert.equal(catalog.defaultClip, 3)
  assert.deepEqual(catalog.groups[0]!.items.map((i) => i.loop), [true, true])
})

test('menu: an empty group is left out', () => {
  const m = synthetic({ clips: [{ name: 'UiStand1' }, { name: 'Stand1' }], menu: [], fight: ['Stand1'], menuIdle: 'UiStand1', fightIdle: 'Stand1' })
  assert.deepEqual(labels(m, 'menu'), [['Idle', ['UiStand1']]])
})

test('fight: groups by name, natural order, hidden groups and clips left out', () => {
  const names = ['Win', 'Attack11', 'Attack01', 'LevelAttack02', 'LevelAttack14', 'Hit1', 'Standup', 'Stand2', 'Stand1', 'Run', 'Walk', 'Jumprise1', 'Death', 'Standchange', 'UiStand1']
  const m = synthetic({
    clips: names.map((name) => ({ name })),
    menu: ['UiStand1'],
    fight: names.filter((n) => n !== 'UiStand1' && n !== 'Hit1'),
    levels: ['Hit1', 'LevelAttack02', 'Attack01'], // duplicates across controllers count once
    menuIdle: 'UiStand1',
    fightIdle: 'Stand1',
  })
  assert.deepEqual(labels(m, 'fight'), [
    ['Idle', ['Stand1', 'Stand2', 'Standchange']],
    ['Movement', ['Run', 'Walk']], // Jumprise1 is left out
    ['Level skills', ['LevelAttack14']], // LevelAttack02 is left out
    ['Other', ['Win']],
  ])
  const total = buildCatalog(m, 'fight').groups.reduce((n, g) => n + g.items.length, 0)
  assert.equal(total, 7)
})

test('fight: no Other group when every clip has a place', () => {
  const m = synthetic({ clips: [{ name: 'Stand1' }, { name: 'Run' }, { name: 'UiStand1' }], menu: ['UiStand1'], fight: ['Stand1', 'Run'], menuIdle: 'UiStand1', fightIdle: 'Stand1' })
  assert.deepEqual(labels(m, 'fight').map(([g]) => g), ['Idle', 'Movement'])
})

test('duplicate names carry their folder; same folder adds the file name', () => {
  const m = synthetic({
    clips: [
      { name: 'Stand1' },
      { name: 'Walk', file: 'anim/BaseLayer/Walk.json' },
      { name: 'Walk', file: 'anim/LevelCombine1Level1/Walk.json' },
      { name: 'Walk', file: 'anim/BaseLayer/Walk_2.json' },
      { name: 'UiStand1' },
    ],
    menu: ['UiStand1'],
    fight: ['Stand1', 'Walk'],
    levels: ['Stand1'],
    menuIdle: 'UiStand1',
    fightIdle: 'Stand1',
  })
  // `index()` in the helper resolves a name to its first clip, so add the other two Walk clips through a layer by hand.
  m.controllers.push({ id: 'extra', layers: [{ name: 'L', blending: 'override', default: 'x', states: { a: { clip: 2 }, b: { clip: 3 } } }] })
  m.contexts.fight.levels = ['extra']
  const groups = labels(m, 'fight')
  assert.deepEqual(groups.find(([g]) => g === 'Movement')![1], ['Walk (BaseLayer/Walk)', 'Walk (BaseLayer/Walk_2)']) // LevelCombine1Level1/Walk is a variant
  assert.deepEqual(groups.find(([g]) => g === 'Idle')![1], ['Stand1']) // a unique name stays plain
})

test('fight default comes from contexts.fight.idle', () => {
  const m = synthetic({ clips: [{ name: 'Born' }, { name: 'Stand1' }, { name: 'UiStand1' }], menu: ['UiStand1'], fight: ['Born', 'Stand1'], menuIdle: 'UiStand1', fightIdle: 'Stand1' })
  assert.equal(buildCatalog(m, 'fight').defaultClip, 1)
  assert.equal(resolveFightIdle(m), 1)
})

test('fight idle that does not resolve fails with a clear error', () => {
  const base = () => synthetic({ clips: [{ name: 'Stand1' }, { name: 'UiStand1' }], menu: ['UiStand1'], fight: ['Stand1'], menuIdle: 'UiStand1', fightIdle: 'Stand1' })

  const noController = base()
  noController.contexts.fight.idle.controller = 'nope'
  assert.throws(() => buildCatalog(noController, 'fight'), /contexts\.fight\.idle.*controller "nope"/)

  const noLayer = base()
  noLayer.contexts.fight.idle.layer = 4
  assert.throws(() => buildCatalog(noLayer, 'fight'), /contexts\.fight\.idle.*no layer 4/)

  const noState = base()
  noState.contexts.fight.idle.state = 'Missing'
  assert.throws(() => buildCatalog(noState, 'fight'), /contexts\.fight\.idle.*no state "Missing"/)
})

test('unknown menu controller fails with a clear error', () => {
  const m = synthetic({ clips: [{ name: 'Stand1' }, { name: 'UiStand1' }], menu: ['UiStand1'], fight: ['Stand1'], menuIdle: 'UiStand1', fightIdle: 'Stand1' })
  m.contexts.menu.base = 'gone'
  assert.throws(() => buildCatalog(m, 'menu'), /contexts\.menu\.base.*"gone"/)
})

test('hiddenNodesFor: stateHides of the clip in Menu, else the context list', () => {
  const m = synthetic({ clips: [{ name: 'Stand1' }, { name: 'UiStand1' }], menu: ['UiStand1'], fight: ['Stand1'], menuIdle: 'UiStand1', fightIdle: 'Stand1' })
  m.contexts.menu.hiddenNodes = [1, 2]
  m.contexts.menu.stateHides = { BoardAct0201: [5, 6] }
  m.contexts.fight.hiddenNodes = [9]
  assert.deepEqual(hiddenNodesFor(m, 'menu', 'BoardAct0201'), [5, 6])
  assert.deepEqual(hiddenNodesFor(m, 'menu', 'UiStand1'), [1, 2]) // no entry
  assert.deepEqual(hiddenNodesFor(m, 'menu', null), [1, 2]) // bind pose
  assert.deepEqual(hiddenNodesFor(m, 'fight', 'BoardAct0201'), [9]) // Fight ignores Menu's stateHides
  assert.deepEqual(hiddenNodesFor(m, 'fight', null), [9])
})

// Real data: the shipped default skin. Skipped when data/ is absent.
const manifestUrl = new URL('../data/crepuscule/anim/manifest.json', import.meta.url)
const skip = !existsSync(manifestUrl) && 'data/crepuscule is not present'

test('default skin: Menu list equals huaxu (12 items, in order)', { skip }, () => {
  const m = parseManifest(JSON.parse(readFileSync(manifestUrl, 'utf8')))
  const catalog = buildCatalog(m, 'menu')
  assert.deepEqual(labels(m, 'menu'), [
    ['Idle', ['StandAct0101', 'UiStand1']],
    ['Board actions', ['BoardAct0201', 'BoardAct0202', 'BoardAct0203', 'BoardAct1001', 'BoardAct1002', 'BoardAct1003', 'BoardAct1004', 'BoardAct1005', 'BoardAct1006', 'BoardAct1007']],
  ])
  assert.equal(m.clips[catalog.defaultClip]!.name, 'UiStand1')
  const loops = Object.fromEntries(catalog.groups.flatMap((g) => g.items).map((i) => [i.name, i.loop]))
  assert.equal(loops.UiStand1, true)
  assert.equal(loops.BoardAct0201, false)
})

test('default skin: the Fight list is cut down to idles, one Walk, Run and four level clips', { skip }, () => {
  const m = parseManifest(JSON.parse(readFileSync(manifestUrl, 'utf8')))
  const catalog = buildCatalog(m, 'fight')
  const items = catalog.groups.flatMap((g) => g.items)
  assert.equal(items.length, 12)
  assert.equal(new Set(items.map((i) => i.label)).size, 12, 'labels are unique within the list')
  assert.equal(m.clips[catalog.defaultClip]!.name, 'Stand1')
  assert.deepEqual(labels(m, 'fight'), [
    ['Idle', ['Stand1', 'Stand2', 'Standchange']],
    ['Movement', ['Run', 'Walk']], // the LevelCombine1Level1 Walk is the same motion
    ['Level skills', ['LevelAttack08_NunWalk', 'LevelAttack11_Loop', 'LevelAttack013Loop', 'LevelAttack14']],
    ['Other', ['Born', 'Save', 'Win']],
  ])
})

test('fight: Squat* is hidden and layer variants of a name give way to the base layer', () => {
  const m = synthetic({
    clips: [
      { name: 'Stand1' },
      { name: 'Walk', file: 'anim/BaseLayer/Walk.json' },
      { name: 'Walk', file: 'anim/Layer1/Walk.json' },
      { name: 'Walk', file: 'anim/Layer2/Walk.json' },
      { name: 'Run', file: 'anim/Base Layer/Run.json' },
      { name: 'Run', file: 'anim/Layer1/Run.json' },
      { name: 'Win', file: 'anim/LevelCombine1Level1/Win.json' }, // only exists outside the base layer: kept
      { name: 'Squat' },
      { name: 'Squatrun' },
      { name: 'UiStand1' },
    ],
    menu: ['UiStand1'],
    fight: ['Stand1', 'Squat', 'Squatrun'],
    levels: ['Stand1'],
    menuIdle: 'UiStand1',
    fightIdle: 'Stand1',
  })
  // `index()` in the helper resolves a name to its first clip: add the other variants through a layer by hand.
  m.controllers.push({ id: 'extra', layers: [{ name: 'L', blending: 'override', default: 'x', states: { a: { clip: 1 }, b: { clip: 2 }, c: { clip: 3 }, d: { clip: 4 }, e: { clip: 5 }, f: { clip: 6 } } }] })
  m.contexts.fight.levels = ['extra']
  assert.deepEqual(labels(m, 'fight'), [
    ['Idle', ['Stand1']],
    ['Movement', ['Run', 'Walk']],
    ['Other', ['Win']],
  ])
})

test('Stigmata, Veritas and Zero: Fight lists follow the same cut (base layer only, Run, Walk where it exists, no Squat)', { skip: !existsSync(new URL('../data/stigmata/anim/manifest.json', import.meta.url)) && 'data/ is not present' }, () => {
  const frames: [string, string[], string[]][] = [
    ['stigmata', ['Run', 'Walk'], ['Born', 'Save', 'Win']],
    ['veritas', ['Run'], ['Born', 'Save', 'Win']],
    ['zero', ['Run'], ['Born', 'Save', 'Win']],
  ]
  for (const [frame, movement, other] of frames) {
    const m = parseManifest(JSON.parse(readFileSync(new URL(`../data/${frame}/anim/manifest.json`, import.meta.url), 'utf8')))
    assert.deepEqual(labels(m, 'fight'), [
      ['Idle', ['Stand1', 'Stand2', 'Standchange']],
      ['Movement', movement],
      ['Other', other],
    ], frame)
    const items = buildCatalog(m, 'fight').groups.flatMap((g) => g.items)
    assert.ok(items.every((i) => !/\((Layer\d|LevelCombine)/.test(i.label)), `${frame}: no layer labels`)
    assert.equal(m.clips[buildCatalog(m, 'fight').defaultClip]!.name, 'Stand1', frame)
  }
})

test('Stigmata, Veritas and Zero: Menu lists are Idle and the ten Board actions; Solitary Dream adds two', { skip: !existsSync(new URL('../data/stigmata/anim/manifest.json', import.meta.url)) && 'data/ is not present' }, () => {
  const board = ['BoardAct0201', 'BoardAct0202', 'BoardAct0203', 'BoardAct1001', 'BoardAct1002', 'BoardAct1003', 'BoardAct1004', 'BoardAct1005', 'BoardAct1006', 'BoardAct1007']
  for (const frame of ['stigmata', 'veritas', 'zero']) {
    const m = parseManifest(JSON.parse(readFileSync(new URL(`../data/${frame}/anim/manifest.json`, import.meta.url), 'utf8')))
    assert.deepEqual(labels(m, 'menu'), [['Idle', ['StandAct0101', 'UiStand1']], ['Board actions', board]], frame)
    assert.equal(m.clips[buildCatalog(m, 'menu').defaultClip]!.name, 'UiStand1', frame)
  }
  const sd = parseManifest(JSON.parse(readFileSync(new URL('../data/stigmata/anim-skins/r4biankamd019241/manifest.json', import.meta.url), 'utf8')))
  const sdBoard = labels(sd, 'menu')[1]![1]
  assert.equal(sdBoard.length, 12)
  assert.ok(sdBoard.includes('BoardAct10021') && sdBoard.includes('BoardAct10022'))
  assert.deepEqual(sdBoard.filter((n) => board.includes(n)), board, 'the ten usual Board actions are all there')
})

test('every skin: no attacks or reactions, movement is Walk and Run, level skills are the four kept', { skip }, () => {
  const root = new URL('../data/crepuscule/', import.meta.url)
  const manifests = ['anim', ...readdirSync(new URL('anim-skins/', root))].map((d) => new URL(d === 'anim' ? 'anim/manifest.json' : `anim-skins/${d}/manifest.json`, root))
  assert.equal(manifests.length, 6)
  for (const url of manifests) {
    const m = parseManifest(JSON.parse(readFileSync(url, 'utf8')))
    const groups = buildCatalog(m, 'fight').groups
    assert.ok(groups.every((g) => g.label !== 'Attacks' && g.label !== 'Reactions'), url.pathname)
    const names = (label: string) => new Set(groups.find((g) => g.label === label)?.items.map((i) => i.name))
    assert.ok([...names('Movement')].every((n) => n === 'Walk' || n === 'Run'), url.pathname)
    assert.ok([...names('Level skills')].every((n) => ['LevelAttack08_NunWalk', 'LevelAttack11_Loop', 'LevelAttack013Loop', 'LevelAttack14'].includes(n)), url.pathname)
    assert.ok(names('Movement').has('Walk') && names('Movement').has('Run'), url.pathname)
  }
})

test('default skin: node visibility rules per context and clip', { skip }, () => {
  const m = parseManifest(JSON.parse(readFileSync(manifestUrl, 'utf8')))
  assert.deepEqual(hiddenNodesFor(m, 'menu', 'UiStand1'), [392, 394, 395, 396])
  assert.deepEqual(hiddenNodesFor(m, 'menu', 'BoardAct0201'), [2, 4, 392, 393, 396])
  assert.deepEqual(hiddenNodesFor(m, 'menu', 'StandAct0101'), [2, 4, 392, 393, 396])
  assert.deepEqual(hiddenNodesFor(m, 'fight', 'Stand1'), [3, 391, 392, 394, 395, 396])
})

// ---------------------------------------------------------------- lending frames (add-cross-frame-animation)


const haveFrames = existsSync(new URL('../data/stigmata/anim/manifest.json', import.meta.url))

function sourcesFor(shown: string): AnimationSource[] {
  return FRAMES.filter((f) => f.id !== shown).map((f) => sourceOf(f.id))
}

function sourceOf(id: string): AnimationSource {
  return FRAMES.filter((f) => f.id === id).map((f) => {
    const read = (path: string) => parseManifest(JSON.parse(readFileSync(new URL(`../data/${f.id}/${path}`, import.meta.url), 'utf8')))
    return {
      frame: f.id,
      label: f.displayName,
      manifestPath: f.animationSource.manifest,
      manifest: read(f.animationSource.manifest),
      extras: f.animationSource.extras.map((e) => ({ manifestPath: e.manifest, manifest: read(e.manifest), clips: e.clips, label: e.label, replace: e.replace })),
    }
  })[0]!
}

test('lending frames: Crepuscule\'s Menu list adds Stigmata, Veritas and Zero, Solitary Dream\'s two Board actions included', { skip: !haveFrames && 'data/ is not present' }, () => {
  const own = parseManifest(JSON.parse(readFileSync(manifestUrl, 'utf8')))
  const catalog = withSources(buildCatalog(own, 'menu'), sourcesFor('crepuscule'), 'menu')
  assert.deepEqual(catalog.groups.map((g) => g.label), ['Idle', 'Board actions', 'Stigmata · Idle', 'Stigmata · Board actions', 'Veritas · Idle', 'Veritas · Board actions', 'Zero · Idle', 'Zero · Board actions'])
  const group = (label: string) => catalog.groups.find((g) => g.label === label)!.items
  assert.deepEqual(group('Stigmata · Idle').map((i) => i.label), ['StandAct0101', 'UiStand1'])
  const stigmataBoard = group('Stigmata · Board actions')
  assert.equal(stigmataBoard.length, 12)
  const sd = stigmataBoard.filter((i) => i.name === 'BoardAct10021' || i.name === 'BoardAct10022')
  assert.deepEqual(sd.map((i) => i.source?.manifestPath), ['anim-skins/r4biankamd019241/manifest.json', 'anim-skins/r4biankamd019241/manifest.json'])
  assert.equal(stigmataBoard.find((i) => i.name === 'BoardAct0201')!.source!.manifestPath, 'anim/manifest.json')
  assert.equal(group('Zero · Board actions').length, 10)
  const all = catalog.groups.flatMap((g) => g.items)
  assert.equal(new Set(all.map((i) => i.id)).size, all.length, 'item ids are unique')
  assert.equal(group('Board actions')[0]!.id, ownItemId(group('Board actions')[0]!.clip))
  assert.equal(group('Board actions')[0]!.source, null)
  assert.equal(group('Veritas · Board actions')[0]!.fieldLabel, 'Veritas · BoardAct0201')
  assert.equal(catalog.defaultClip, buildCatalog(own, 'menu').defaultClip, 'the default stays the shown frame\'s idle clip')
})

test('lending frames: Veritas\' Fight list offers Crepuscule\'s four level skills; the cut-down rules apply to lent clips', { skip: !haveFrames && 'data/ is not present' }, () => {
  const own = parseManifest(JSON.parse(readFileSync(new URL('../data/veritas/anim/manifest.json', import.meta.url), 'utf8')))
  const catalog = withSources(buildCatalog(own, 'fight'), sourcesFor('veritas'), 'fight')
  const group = (label: string) => catalog.groups.find((g) => g.label === label)?.items.map((i) => i.label)
  assert.deepEqual(group('Crepuscule · Level skills'), ['LevelAttack08_NunWalk', 'LevelAttack11_Loop', 'LevelAttack013Loop', 'LevelAttack14'])
  assert.deepEqual(group('Crepuscule · Movement'), ['Run', 'Walk'])
  assert.deepEqual(group('Stigmata · Movement'), ['Run', 'Walk'])
  assert.deepEqual(group('Zero · Movement'), ['Run'])
  assert.ok(catalog.groups.every((g) => !/Attacks|Reactions/.test(g.label)))
  assert.ok(catalog.groups.flatMap((g) => g.items).every((i) => !i.name.startsWith('Squat')))
  assert.deepEqual(group('Movement'), ['Run'], 'the shown frame\'s own groups come first, unprefixed')
})

test('own extras: Stigmata\'s other skins get Solitary Dream\'s two Board actions; Solitary Dream keeps its own', { skip: !haveFrames && 'data/ is not present' }, () => {
  const read = (path: string) => parseManifest(JSON.parse(readFileSync(new URL(`../data/stigmata/${path}`, import.meta.url), 'utf8')))
  const generic = withSources(buildCatalog(read('anim/manifest.json'), 'menu'), sourcesFor('stigmata'), 'menu', sourceOf('stigmata'))
  const board = generic.groups.find((g) => g.label === 'Board actions')!.items
  const sd = board.filter((i) => i.name === 'BoardAct10021' || i.name === 'BoardAct10022')
  assert.deepEqual(sd.map((i) => i.fieldLabel), ['Solitary Dream · BoardAct10021', 'Solitary Dream · BoardAct10022'])
  assert.ok(sd.every((i) => i.source?.frame === 'stigmata' && i.source.manifestPath === 'anim-skins/r4biankamd019241/manifest.json'))
  const all = generic.groups.flatMap((g) => g.items)
  assert.equal(new Set(all.map((i) => i.id)).size, all.length, 'item ids are unique')

  const solitary = withSources(buildCatalog(read('anim-skins/r4biankamd019241/manifest.json'), 'menu'), sourcesFor('stigmata'), 'menu', sourceOf('stigmata'))
  const own = solitary.groups.find((g) => g.label === 'Board actions')!.items.filter((i) => i.name === 'BoardAct10021')
  assert.equal(own.length, 1, 'no lent copy next to the native clip')
  assert.equal(own[0]!.source, null)
})

test('replace extras: on another frame Veritas\' BoardAct1005 comes from Ink-lit Hermit in the same place; Veritas\' own list is unchanged', { skip: !haveFrames && 'data/ is not present' }, () => {
  const own = parseManifest(JSON.parse(readFileSync(manifestUrl, 'utf8')))
  const catalog = withSources(buildCatalog(own, 'menu'), sourcesFor('crepuscule'), 'menu')
  const board = catalog.groups.find((g) => g.label === 'Veritas · Board actions')!.items
  assert.equal(board.length, 10, 'replaced in place, not added')
  const lent = board.find((i) => i.name === 'BoardAct1005')!
  assert.equal(lent.source?.manifestPath, 'anim-skins/r3biankamd019141/manifest.json')
  assert.equal(lent.fieldLabel, 'Veritas · BoardAct1005')
  assert.equal(board.find((i) => i.name === 'BoardAct1004')!.source?.manifestPath, 'anim/manifest.json', 'the other Board actions stay Generic')
  assert.deepEqual(board.map((i) => i.name), [...board.map((i) => i.name)].sort((a, b) => naturalCompare(a, b)), 'order kept')
  const all = catalog.groups.flatMap((g) => g.items)
  assert.equal(new Set(all.map((i) => i.id)).size, all.length, 'item ids are unique')

  // Veritas' own skins: its own clip, nothing from Ink-lit added.
  const veritas = parseManifest(JSON.parse(readFileSync(new URL('../data/veritas/anim-skins/r3biankamd010031/manifest.json', import.meta.url), 'utf8')))
  const mine = withSources(buildCatalog(veritas, 'menu'), sourcesFor('veritas'), 'menu', sourceOf('veritas'))
  const myBoard = mine.groups.find((g) => g.label === 'Board actions')!.items
  assert.equal(myBoard.length, 10)
  assert.equal(myBoard.find((i) => i.name === 'BoardAct1005')!.source, null)
})
