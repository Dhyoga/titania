import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { buildCatalog, withSources, type AnimationSource } from '../lib/anim/catalog.ts'
import { parseManifest } from '../lib/anim/manifest.ts'
import { FRAMES, getConstruct, type LobbyConfig } from '../lib/constructs/index.ts'
import { defaultChoice, listCandidates, resolvePool, type LobbyPool, type PoolItem } from '../lib/lobby/pool.ts'
import { parseVoices, voiceFor, type Voices } from '../lib/voice/voices.ts'

const BOARD = ['BoardAct0201', 'BoardAct0202', 'BoardAct0203', 'BoardAct1001', 'BoardAct1002', 'BoardAct1003', 'BoardAct1004', 'BoardAct1005', 'BoardAct1006', 'BoardAct1007']
const IDLES = ['UiStand1', 'StandAct0101']
const LOBBY: LobbyConfig = { actionFrom: ['stigmata', 'veritas'], idleFrom: ['stigmata'] }
const NONE = new Set<string>()

/** Items as the Menu list gives them: own ones (`#n`) and each lender's (`<frame>:<manifest>#n`). */
function items(frames: Record<string, string[]>): PoolItem[] {
  return Object.entries(frames).flatMap(([frame, names]) =>
    names.map((name, i) => ({ id: frame === 'own' ? `#${i}` : `${frame}:anim/manifest.json#${i}`, name, frame: frame === 'own' ? null : frame, duration: 10 + i })),
  )
}
const all = [...BOARD, ...IDLES, 'Extra', 'Stand1']
/** Every frame has a line for the ten Board actions, except Veritas, which has none for 0202 and 0203. */
const hasLine = (frame: string | null, name: string): boolean => name.startsWith('BoardAct') && !(frame === 'veritas' && (name === 'BoardAct0202' || name === 'BoardAct0203'))
const sum = (list: { weight: number }[]) => list.reduce((s, i) => s + i.weight, 0)
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≉ ${b}`)
const framesOf = (pool: LobbyPool, ids: string[]) => ids.map((id) => pool.candidates.find((c) => c.id === id)!.frame)
const count = (pool: LobbyPool, frame: string) => framesOf(pool, pool.actions).filter((f) => f === frame).length

/** The pool a frame's Display gets with nothing chosen: its construct config's defaults. */
function byDefault(list: PoolItem[], shown: string, lobby: LobbyConfig | undefined, line = hasLine): LobbyPool {
  const chosen = new Set(defaultChoice(lobby, listCandidates(list, line, shown)))
  return resolvePool(list, line, { frame: shown, chosen })
}

test('Crepuscule by default: every voiced action of its own, Stigmata and Veritas, and two idles, its own UiStand1 at 0.75 and Stigmata\'s at 0.25', () => {
  const stigmata = [...all, 'BoardAct10021', 'BoardAct10022']
  const pool = byDefault(items({ own: all, stigmata, veritas: all, zero: all }), 'crepuscule', LOBBY)
  assert.equal(pool.actions.length, 10 + 12 + 8)
  assert.deepEqual([count(pool, 'crepuscule'), count(pool, 'stigmata'), count(pool, 'veritas'), count(pool, 'zero')], [10, 12, 8, 0])
  assert.equal(pool.idles.length, 2)
  near(pool.idles[0]!.weight, 0.75)
  near(pool.idles[1]!.weight, 0.25)
  assert.deepEqual(framesOf(pool, pool.idles.map((i) => i.id)), ['crepuscule', 'stigmata'])
  near(sum(pool.idles), 1)
})

test('a receiver with no lobby config gets its own clips alone by default', () => {
  const pool = byDefault(items({ own: all, stigmata: all, veritas: all }), 'zero', undefined)
  assert.equal(pool.actions.length, 10)
  assert.ok(pool.actions.every((id) => id.startsWith('#')))
  assert.equal(pool.idles.length, 1)
  near(pool.idles[0]!.weight, 1)
})

test('the own actions are always in, even when the choice is empty or names them', () => {
  const list = items({ own: all, stigmata: all })
  for (const chosen of [NONE, new Set(['crepuscule:BoardAct0201']), new Set(['crepuscule:UiStand1'])]) {
    const pool = resolvePool(list, hasLine, { frame: 'crepuscule', chosen })
    assert.equal(pool.actions.length, 10)
    assert.ok(pool.actions.every((id) => id.startsWith('#')))
    assert.equal(pool.idles.length, 1)
    near(pool.idles[0]!.weight, 1)
  }
})

test('every voiced Board action is a candidate, not only six; a clip without a line is not', () => {
  const list = items({ own: [...all, 'BoardAct0204', 'BoardAct0205'], veritas: all })
  const pool = resolvePool(list, hasLine, { frame: 'crepuscule', chosen: NONE })
  const own = pool.candidates.filter((c) => c.own && c.kind === 'action').map((c) => c.name)
  assert.deepEqual(own, BOARD.concat('BoardAct0204', 'BoardAct0205').filter((n) => hasLine(null, n)))
  assert.ok(own.includes('BoardAct1005'))
  const veritas = pool.candidates.filter((c) => c.frame === 'veritas' && c.kind === 'action').map((c) => c.name)
  assert.deepEqual(veritas, BOARD.filter((n) => n !== 'BoardAct0202' && n !== 'BoardAct0203'))
  const noLine = resolvePool(items({ own: all }), (_f, name) => name !== 'BoardAct0201', { frame: 'crepuscule', chosen: NONE })
  assert.equal(noLine.actions.length, 9)
})

test('clips that are neither a Board action nor an idle are not candidates; StandAct0101 never is', () => {
  const pool = resolvePool(items({ own: all, stigmata: all }), () => true, { frame: 'crepuscule', chosen: new Set(['stigmata:Stand1', 'stigmata:StandAct0101']) })
  assert.ok(pool.candidates.every((c) => c.name.startsWith('BoardAct') || c.name === 'UiStand1'))
  assert.ok(!pool.idles.some((i) => pool.candidates.find((c) => c.id === i.id)!.name === 'StandAct0101'))
})

test('Zero can be chosen: its actions and idle join', () => {
  const list = items({ own: all, stigmata: all, zero: all })
  const pool = resolvePool(list, hasLine, { frame: 'crepuscule', chosen: new Set(['zero:BoardAct1004', 'zero:UiStand1']) })
  assert.equal(pool.actions.length, 11)
  assert.equal(count(pool, 'zero'), 1)
  assert.equal(pool.idles.length, 2)
  near(pool.idles[0]!.weight, 0.75)
  near(pool.idles[1]!.weight, 0.25)
  assert.equal(pool.candidates.find((c) => c.key === 'zero:BoardAct1004')!.own, false)
})

test('a key that matches no candidate is ignored', () => {
  const list = items({ own: all, stigmata: all })
  const base = resolvePool(list, hasLine, { frame: 'crepuscule', chosen: NONE })
  const odd = resolvePool(list, hasLine, { frame: 'crepuscule', chosen: new Set(['stigmata:BoardActX', 'veritas:BoardAct0201', 'nonsense', '']) })
  assert.deepEqual(odd, base)
})

test('Solitary Dream\'s actions are Stigmata\'s own on its other skins, and playing there are not borrowed', () => {
  // On Stigmata Generic - Final the catalog lists them as lent by Stigmata itself.
  const list: PoolItem[] = [...items({ own: all }), { id: 'stigmata:anim-skins/x/manifest.json#4', name: 'BoardAct10021', frame: 'stigmata', duration: 46.7 }]
  const pool = resolvePool(list, hasLine, { frame: 'stigmata', chosen: NONE })
  const sd = pool.candidates.find((c) => c.name === 'BoardAct10021')!
  assert.equal(sd.own, true)
  assert.equal(sd.key, 'stigmata:BoardAct10021')
  assert.ok(pool.actions.includes(sd.id))
  assert.equal(pool.actions.length, 11)
})

test('candidates: own first, then the other frames in the order of the items, with title, length and key', () => {
  const list = items({ own: all, veritas: all, stigmata: all }).map((i) => (i.name === 'BoardAct0201' ? { ...i, title: `T ${i.frame}` } : i))
  const { candidates } = resolvePool(list, hasLine, { frame: 'crepuscule', chosen: NONE })
  assert.deepEqual([...new Set(candidates.map((c) => c.frame))], ['crepuscule', 'veritas', 'stigmata'])
  const first = candidates.find((c) => c.frame === 'veritas' && c.name === 'BoardAct0201')!
  assert.equal(first.title, 'T veritas')
  assert.equal(first.key, 'veritas:BoardAct0201')
  assert.equal(first.kind, 'action')
  assert.equal(candidates.find((c) => c.frame === 'veritas' && c.name === 'BoardAct0203'), undefined)
  assert.equal(candidates.find((c) => c.frame === 'crepuscule' && c.name === 'BoardAct0202')!.title, null)
  const own = candidates.filter((c) => c.frame === 'crepuscule').map((c) => c.name)
  assert.deepEqual(own, [...BOARD, 'UiStand1'].sort((a, b) => all.indexOf(a) - all.indexOf(b)))
})

test('defaultChoice: the voiced actions of actionFrom and the idle of idleFrom, nothing else', () => {
  const candidates = listCandidates(items({ own: all, stigmata: all, veritas: all, zero: all }), hasLine, 'crepuscule')
  const keys = defaultChoice(LOBBY, candidates)
  assert.equal(keys.length, 10 + 1 + 8)
  assert.ok(keys.includes('stigmata:UiStand1'))
  assert.ok(!keys.includes('veritas:UiStand1'))
  assert.ok(!keys.some((k) => k.startsWith('zero:') || k.startsWith('crepuscule:')))
  assert.deepEqual(defaultChoice(undefined, candidates), [])
})

test('three borrowed idles share the borrowed weight evenly', () => {
  const list = items({ own: all, stigmata: all, veritas: all, zero: all })
  const pool = resolvePool(list, hasLine, { frame: 'crepuscule', chosen: new Set(['stigmata:UiStand1', 'veritas:UiStand1', 'zero:UiStand1']) })
  assert.equal(pool.idles.length, 4)
  near(pool.idles[0]!.weight, 0.75)
  for (const i of pool.idles.slice(1)) near(i.weight, 0.25 / 3)
  near(sum(pool.idles), 1)
})

test('a lender with no items gives nothing and the rest stays', () => {
  const pool = byDefault(items({ own: all, veritas: all }), 'crepuscule', LOBBY)
  assert.equal(pool.actions.length, 10 + 8)
  assert.equal(pool.idles.length, 1)
  near(pool.idles[0]!.weight, 1) // nothing borrowed: the own idle takes everything
  assert.ok(!pool.candidates.some((c) => c.frame === 'stigmata'))
})

test('a lender with no lines offers its idle only', () => {
  const pool = byDefault(items({ own: all, stigmata: all, veritas: all }), 'crepuscule', LOBBY, (frame, name) => frame !== 'veritas' && hasLine(frame, name))
  assert.equal(pool.actions.length, 10 + 10)
  assert.deepEqual(pool.candidates.filter((c) => c.frame === 'veritas').map((c) => c.name), ['UiStand1'])
})

test('a clip name listed twice by one frame counts once', () => {
  const dup = [...items({ own: all }), ...items({ stigmata: ['BoardAct0201', 'BoardAct0201'] })]
  assert.equal(resolvePool(dup, hasLine, { frame: 'crepuscule', chosen: new Set(['stigmata:BoardAct0201']) }).actions.filter((id) => id.startsWith('stigmata:')).length, 1)
})

test('a shown skin with no idle of its own gives the borrowed one all the weight', () => {
  const pool = resolvePool(items({ own: ['BoardAct0201'], stigmata: all }), hasLine, { frame: 'crepuscule', chosen: new Set(['stigmata:UiStand1']) })
  assert.deepEqual(pool.idles.map((i) => i.weight), [1])
})

test('a single own idle takes the whole weight', () => {
  const pool = byDefault(items({ own: ['UiStand1'] }), 'crepuscule', LOBBY)
  assert.deepEqual(pool.idles.map((i) => i.weight), [1])
})

// ---- the real frames ----

const dataDir = new URL('../data/', import.meta.url)
const skip = !FRAMES.every((f) => existsSync(new URL(`${f.id}/anim/manifest.json`, dataDir)) && existsSync(new URL(`${f.id}/voices.json`, dataDir))) && 'data/ is not present'

const readJson = (url: URL): unknown => JSON.parse(readFileSync(url, 'utf8'))
const manifestOf = (frame: string, path: string) => parseManifest(readJson(new URL(`${frame}/${path}`, dataDir)))
const voicesOf = (frame: string): Voices => parseVoices(readJson(new URL(`${frame}/voices.json`, dataDir)), () => {})

/** What Display on `skin` of `frame` would resolve to, read from the real manifests and voices (`chosen` null: the frame's default). */
function realPool(frame: string, skinId: string, chosen: string[] | null = null) {
  const sources: AnimationSource[] = FRAMES.map((f) => ({
    frame: f.id,
    label: f.displayName,
    manifestPath: f.animationSource.manifest,
    manifest: manifestOf(f.id, f.animationSource.manifest),
    extras: f.animationSource.extras.map((e) => ({ manifestPath: e.manifest, manifest: manifestOf(f.id, e.manifest), clips: e.clips, label: e.label, replace: e.replace })),
  }))
  const construct = getConstruct(frame)
  const skin = construct.skins.find((s) => s.id === skinId)!
  const own = buildCatalog(manifestOf(frame, skin.manifest!), 'menu')
  const catalog = withSources(own, sources.filter((s) => s.frame !== frame), 'menu', sources.find((s) => s.frame === frame))
  const poolItems: PoolItem[] = catalog.groups.flatMap((g) => g.items).map((i) => ({ id: i.id, name: i.name, frame: i.source?.frame ?? null, duration: 1 }))
  const voices = new Map(FRAMES.map((f) => [f.id, voicesOf(f.id)]))
  const line = (from: string | null, name: string) => !!voiceFor(voices.get(from ?? frame)!, name)
  const keys = chosen ?? defaultChoice(construct.lobby, listCandidates(poolItems, line, frame))
  return { pool: resolvePool(poolItems, line, { frame, chosen: new Set(keys) }), poolItems }
}

const namesOf = (pool: LobbyPool, frame: string, kind: 'action' | 'idle') => pool.candidates.filter((c) => c.frame === frame && c.kind === kind).map((c) => c.name)

test('real data: Crepuscule by default gives 30 actions (10, 12, 8: Veritas has no line for 0202 and 0203) and 2 idles, on every skin', { skip }, () => {
  for (const skin of getConstruct('crepuscule').skins.filter((s) => s.group !== 'chibi')) {
    const { pool } = realPool('crepuscule', skin.id)
    assert.equal(pool.actions.length, 30, skin.name)
    assert.deepEqual([count(pool, 'crepuscule'), count(pool, 'stigmata'), count(pool, 'veritas'), count(pool, 'zero')], [10, 12, 8, 0], skin.name)
    assert.deepEqual(namesOf(pool, 'veritas', 'action').sort(), BOARD.filter((n) => n !== 'BoardAct0202' && n !== 'BoardAct0203').sort(), skin.name)
    assert.ok(namesOf(pool, 'stigmata', 'action').includes('BoardAct10021'), skin.name)
    assert.equal(pool.idles.length, 2, skin.name)
    near(sum(pool.idles), 1)
  }
})

test('real data: no unvoiced clip is offered (Night Sonata\'s 0204 and 0205, Veritas\' 0202 and 0203), and every row has a frame with lines', { skip }, () => {
  const { pool } = realPool('crepuscule', 'r5biankamd019241')
  const own = namesOf(pool, 'crepuscule', 'action')
  assert.ok(!own.includes('BoardAct0204') && !own.includes('BoardAct0205'))
  assert.equal(own.length, 10)
  assert.ok(!namesOf(pool, 'veritas', 'action').some((n) => n === 'BoardAct0202' || n === 'BoardAct0203'))
})

test('real data: every frame offers Zero, and choosing all of it adds its ten actions and idle on Crepuscule', { skip }, () => {
  const { pool: base } = realPool('crepuscule', 'r5biankamd010031')
  assert.equal(namesOf(base, 'zero', 'action').length, 10)
  assert.deepEqual(namesOf(base, 'zero', 'idle'), ['UiStand1'])
  const chosen = base.candidates.filter((c) => !c.own).map((c) => c.key)
  const { pool } = realPool('crepuscule', 'r5biankamd010031', chosen)
  assert.equal(count(pool, 'zero'), 10)
  assert.equal(pool.actions.length, 10 + 12 + 8 + 10)
  assert.equal(pool.idles.length, 4) // its own and the three lenders'
  near(sum(pool.idles), 1)
})

test('real data: Stigmata, Veritas and Zero play their own clips only by default; Stigmata\'s own include Solitary Dream\'s two on every skin', { skip }, () => {
  const expected: Record<string, number> = { stigmata: 12, veritas: 8, zero: 10 }
  for (const frame of ['stigmata', 'veritas', 'zero']) {
    for (const skin of getConstruct(frame).skins.filter((s) => s.group !== 'chibi')) {
      const { pool, poolItems } = realPool(frame, skin.id)
      assert.equal(pool.actions.length, expected[frame], `${frame} ${skin.name}`)
      assert.ok(
        [...pool.actions, ...pool.idles.map((i) => i.id)].every((id) => {
          const from = poolItems.find((i) => i.id === id)!.frame
          return from === null || from === frame
        }),
        `${frame} ${skin.name}`,
      )
      assert.equal(pool.idles.length, 1, `${frame} ${skin.name}`)
    }
  }
})
