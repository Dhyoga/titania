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
/** A made-up default lobby config (Qu's real ones are in `lobbyConfig.test.ts`): two lenders for actions, one for idles. */
const LOBBY: LobbyConfig = { actionFrom: ['pavo', 'third'], idleFrom: ['pavo'] }
const NONE = new Set<string>()

/** Items as the Menu list gives them: own ones (`#n`) and each lender's (`<frame>:<manifest>#n`). */
function items(frames: Record<string, string[]>): PoolItem[] {
  return Object.entries(frames).flatMap(([frame, names]) =>
    names.map((name, i) => ({ id: frame === 'own' ? `#${i}` : `${frame}:anim/manifest.json#${i}`, name, frame: frame === 'own' ? null : frame, duration: 10 + i })),
  )
}
const all = [...BOARD, ...IDLES, 'Extra', 'Stand1']
/** Every frame has a line for the ten Board actions, except the third frame, which has none for 0202 and 0203. */
const hasLine = (frame: string | null, name: string): boolean => name.startsWith('BoardAct') && !(frame === 'third' && (name === 'BoardAct0202' || name === 'BoardAct0203'))
const sum = (list: { weight: number }[]) => list.reduce((s, i) => s + i.weight, 0)
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≉ ${b}`)
const framesOf = (pool: LobbyPool, ids: string[]) => ids.map((id) => pool.candidates.find((c) => c.id === id)!.frame)
const count = (pool: LobbyPool, frame: string) => framesOf(pool, pool.actions).filter((f) => f === frame).length

/** The pool a frame's Display gets with nothing chosen: its construct config's defaults. */
function byDefault(list: PoolItem[], shown: string, lobby: LobbyConfig | undefined, line = hasLine): LobbyPool {
  const chosen = new Set(defaultChoice(lobby, listCandidates(list, line, shown)))
  return resolvePool(list, line, { frame: shown, chosen })
}

test('by default: every voiced action of the shown frame and of its two configured lenders, and two idles, its own UiStand1 at 0.75 and the first lender\'s at 0.25', () => {
  const pavo = [...all, 'BoardAct10021', 'BoardAct10022'] // a lender with two extra voiced actions
  const pool = byDefault(items({ own: all, pavo, third: all, fourth: all }), 'shukra', LOBBY)
  assert.equal(pool.actions.length, 10 + 12 + 8)
  assert.deepEqual([count(pool, 'shukra'), count(pool, 'pavo'), count(pool, 'third'), count(pool, 'fourth')], [10, 12, 8, 0])
  assert.equal(pool.idles.length, 2)
  near(pool.idles[0]!.weight, 0.75)
  near(pool.idles[1]!.weight, 0.25)
  assert.deepEqual(framesOf(pool, pool.idles.map((i) => i.id)), ['shukra', 'pavo'])
  near(sum(pool.idles), 1)
})

test('a receiver with no lobby config gets its own clips alone by default', () => {
  const pool = byDefault(items({ own: all, pavo: all, third: all }), 'fourth', undefined)
  assert.equal(pool.actions.length, 10)
  assert.ok(pool.actions.every((id) => id.startsWith('#')))
  assert.equal(pool.idles.length, 1)
  near(pool.idles[0]!.weight, 1)
})

test('the own actions are always in, even when the choice is empty or names them', () => {
  const list = items({ own: all, pavo: all })
  for (const chosen of [NONE, new Set(['shukra:BoardAct0201']), new Set(['shukra:UiStand1'])]) {
    const pool = resolvePool(list, hasLine, { frame: 'shukra', chosen })
    assert.equal(pool.actions.length, 10)
    assert.ok(pool.actions.every((id) => id.startsWith('#')))
    assert.equal(pool.idles.length, 1)
    near(pool.idles[0]!.weight, 1)
  }
})

test('every voiced Board action is a candidate, not only six; a clip without a line is not', () => {
  const list = items({ own: [...all, 'BoardAct0204', 'BoardAct0205'], third: all })
  const pool = resolvePool(list, hasLine, { frame: 'shukra', chosen: NONE })
  const own = pool.candidates.filter((c) => c.own && c.kind === 'action').map((c) => c.name)
  assert.deepEqual(own, BOARD.concat('BoardAct0204', 'BoardAct0205').filter((n) => hasLine(null, n)))
  assert.ok(own.includes('BoardAct1005'))
  const third = pool.candidates.filter((c) => c.frame === 'third' && c.kind === 'action').map((c) => c.name)
  assert.deepEqual(third, BOARD.filter((n) => n !== 'BoardAct0202' && n !== 'BoardAct0203'))
  const noLine = resolvePool(items({ own: all }), (_f, name) => name !== 'BoardAct0201', { frame: 'shukra', chosen: NONE })
  assert.equal(noLine.actions.length, 9)
})

test('clips that are neither a Board action nor an idle are not candidates; StandAct0101 never is', () => {
  const pool = resolvePool(items({ own: all, pavo: all }), () => true, { frame: 'shukra', chosen: new Set(['pavo:Stand1', 'pavo:StandAct0101']) })
  assert.ok(pool.candidates.every((c) => c.name.startsWith('BoardAct') || c.name === 'UiStand1'))
  assert.ok(!pool.idles.some((i) => pool.candidates.find((c) => c.id === i.id)!.name === 'StandAct0101'))
})

test('a fourth frame can be chosen: its actions and idle join', () => {
  const list = items({ own: all, pavo: all, fourth: all })
  const pool = resolvePool(list, hasLine, { frame: 'shukra', chosen: new Set(['fourth:BoardAct1004', 'fourth:UiStand1']) })
  assert.equal(pool.actions.length, 11)
  assert.equal(count(pool, 'fourth'), 1)
  assert.equal(pool.idles.length, 2)
  near(pool.idles[0]!.weight, 0.75)
  near(pool.idles[1]!.weight, 0.25)
  assert.equal(pool.candidates.find((c) => c.key === 'fourth:BoardAct1004')!.own, false)
})

test('a key that matches no candidate is ignored', () => {
  const list = items({ own: all, pavo: all })
  const base = resolvePool(list, hasLine, { frame: 'shukra', chosen: NONE })
  const odd = resolvePool(list, hasLine, { frame: 'shukra', chosen: new Set(['pavo:BoardActX', 'third:BoardAct0201', 'nonsense', '']) })
  assert.deepEqual(odd, base)
})

test('a frame\'s extra clips, listed as lent by that frame itself, are its own and not borrowed', () => {
  // On the first lender Generic - Final the catalog lists them as lent by the first lender itself.
  const list: PoolItem[] = [...items({ own: all }), { id: 'pavo:anim-skins/x/manifest.json#4', name: 'BoardAct10021', frame: 'pavo', duration: 46.7 }]
  const pool = resolvePool(list, hasLine, { frame: 'pavo', chosen: NONE })
  const sd = pool.candidates.find((c) => c.name === 'BoardAct10021')!
  assert.equal(sd.own, true)
  assert.equal(sd.key, 'pavo:BoardAct10021')
  assert.ok(pool.actions.includes(sd.id))
  assert.equal(pool.actions.length, 11)
})

test('candidates: own first, then the other frames in the order of the items, with title, length and key', () => {
  const list = items({ own: all, third: all, pavo: all }).map((i) => (i.name === 'BoardAct0201' ? { ...i, title: `T ${i.frame}` } : i))
  const { candidates } = resolvePool(list, hasLine, { frame: 'shukra', chosen: NONE })
  assert.deepEqual([...new Set(candidates.map((c) => c.frame))], ['shukra', 'third', 'pavo'])
  const first = candidates.find((c) => c.frame === 'third' && c.name === 'BoardAct0201')!
  assert.equal(first.title, 'T third')
  assert.equal(first.key, 'third:BoardAct0201')
  assert.equal(first.kind, 'action')
  assert.equal(candidates.find((c) => c.frame === 'third' && c.name === 'BoardAct0203'), undefined)
  assert.equal(candidates.find((c) => c.frame === 'shukra' && c.name === 'BoardAct0202')!.title, null)
  const own = candidates.filter((c) => c.frame === 'shukra').map((c) => c.name)
  assert.deepEqual(own, [...BOARD, 'UiStand1'].sort((a, b) => all.indexOf(a) - all.indexOf(b)))
})

test('defaultChoice: the voiced actions of actionFrom and the idle of idleFrom, nothing else', () => {
  const candidates = listCandidates(items({ own: all, pavo: all, third: all, fourth: all }), hasLine, 'shukra')
  const keys = defaultChoice(LOBBY, candidates)
  assert.equal(keys.length, 10 + 1 + 8)
  assert.ok(keys.includes('pavo:UiStand1'))
  assert.ok(!keys.includes('third:UiStand1'))
  assert.ok(!keys.some((k) => k.startsWith('fourth:') || k.startsWith('shukra:')))
  assert.deepEqual(defaultChoice(undefined, candidates), [])
})

test('three borrowed idles share the borrowed weight evenly', () => {
  const list = items({ own: all, pavo: all, third: all, fourth: all })
  const pool = resolvePool(list, hasLine, { frame: 'shukra', chosen: new Set(['pavo:UiStand1', 'third:UiStand1', 'fourth:UiStand1']) })
  assert.equal(pool.idles.length, 4)
  near(pool.idles[0]!.weight, 0.75)
  for (const i of pool.idles.slice(1)) near(i.weight, 0.25 / 3)
  near(sum(pool.idles), 1)
})

test('a lender with no items gives nothing and the rest stays', () => {
  const pool = byDefault(items({ own: all, third: all }), 'shukra', LOBBY)
  assert.equal(pool.actions.length, 10 + 8)
  assert.equal(pool.idles.length, 1)
  near(pool.idles[0]!.weight, 1) // nothing borrowed: the own idle takes everything
  assert.ok(!pool.candidates.some((c) => c.frame === 'pavo'))
})

test('a lender with no lines offers its idle only', () => {
  const pool = byDefault(items({ own: all, pavo: all, third: all }), 'shukra', LOBBY, (frame, name) => frame !== 'third' && hasLine(frame, name))
  assert.equal(pool.actions.length, 10 + 10)
  assert.deepEqual(pool.candidates.filter((c) => c.frame === 'third').map((c) => c.name), ['UiStand1'])
})

test('a clip name listed twice by one frame counts once', () => {
  const dup = [...items({ own: all }), ...items({ pavo: ['BoardAct0201', 'BoardAct0201'] })]
  assert.equal(resolvePool(dup, hasLine, { frame: 'shukra', chosen: new Set(['pavo:BoardAct0201']) }).actions.filter((id) => id.startsWith('pavo:')).length, 1)
})

test('a shown skin with no idle of its own gives the borrowed one all the weight', () => {
  const pool = resolvePool(items({ own: ['BoardAct0201'], pavo: all }), hasLine, { frame: 'shukra', chosen: new Set(['pavo:UiStand1']) })
  assert.deepEqual(pool.idles.map((i) => i.weight), [1])
})

test('a single own idle takes the whole weight', () => {
  const pool = byDefault(items({ own: ['UiStand1'] }), 'shukra', LOBBY)
  assert.deepEqual(pool.idles.map((i) => i.weight), [1])
})

// ---- the real frames ----

const dataDir = new URL('../data/', import.meta.url)
const skip = !FRAMES.every((f) => existsSync(new URL(`${f.id}/anim/manifest.json`, dataDir)) && existsSync(new URL(`${f.id}/voices.json`, dataDir))) && 'data/ is not present (voices.json comes from build_voices.py)'

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
  return { pool: resolvePool(poolItems, line, { frame, chosen: new Set(keys) }), poolItems, voiced: (f: string) => BOARD.filter((n) => !!voiceFor(voices.get(f)!, n)) }
}

const namesOf = (pool: LobbyPool, frame: string, kind: 'action' | 'idle') => pool.candidates.filter((c) => c.frame === frame && c.kind === kind).map((c) => c.name)

// The counts below follow from which Board actions voice_pairings.json pairs, so they are computed from voices.json, not written down.

test('real data: by default Shukra plays its voiced Board actions and Pavo\'s, with two idles (own at 0.75, Pavo\'s at 0.25), and Pavo the mirror', { skip }, () => {
  for (const [shown, lender] of [['shukra', 'pavo'], ['pavo', 'shukra']] as const) {
    const skin = getConstruct(shown).defaultSkin
    const { pool, voiced } = realPool(shown, skin)
    assert.ok(voiced(shown).length > 0 && voiced(lender).length > 0, 'the pairings give both frames at least one voiced Board action')
    assert.equal(pool.actions.length, voiced(shown).length + voiced(lender).length, shown)
    assert.deepEqual([count(pool, shown), count(pool, lender)], [voiced(shown).length, voiced(lender).length], shown)
    assert.deepEqual(namesOf(pool, lender, 'action').sort(), voiced(lender).sort(), `${shown}: the lender's voiced actions`)
    assert.equal(pool.idles.length, 2, shown)
    near(pool.idles[0]!.weight, 0.75)
    near(pool.idles[1]!.weight, 0.25)
    assert.deepEqual(framesOf(pool, pool.idles.map((i) => i.id)), [shown, lender])
    near(sum(pool.idles), 1)
  }
})

test('real data: no unvoiced clip is offered, and StandAct0101 never', { skip }, () => {
  for (const [shown, lender] of [['shukra', 'pavo'], ['pavo', 'shukra']] as const) {
    const { pool, voiced } = realPool(shown, getConstruct(shown).defaultSkin)
    for (const frame of [shown, lender]) {
      const offered = namesOf(pool, frame, 'action')
      assert.deepEqual(offered.sort(), voiced(frame).sort(), `${shown}: ${frame} offers exactly its voiced Board actions`)
      assert.ok(!namesOf(pool, frame, 'idle').includes('StandAct0101'), `${frame}: no StandAct0101`)
    }
  }
})

test('real data: clearing the lender leaves the shown frame\'s own actions and idle alone; choosing it again restores the default', { skip }, () => {
  for (const [shown, lender] of [['shukra', 'pavo'], ['pavo', 'shukra']] as const) {
    const skin = getConstruct(shown).defaultSkin
    const { pool: base, voiced } = realPool(shown, skin)
    const { pool: own } = realPool(shown, skin, [])
    assert.equal(own.actions.length, voiced(shown).length, `${shown}: own actions are always in`)
    assert.equal(count(own, lender), 0)
    assert.equal(own.idles.length, 1)
    near(own.idles[0]!.weight, 1)
    const { pool: again } = realPool(shown, skin, base.candidates.filter((c) => !c.own).map((c) => c.key))
    assert.deepEqual(again.actions, base.actions, `${shown}: choosing every borrowed row gives the default pool`)
  }
})
