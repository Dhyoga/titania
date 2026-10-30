import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { buildCatalog, withSources, type AnimationSource } from '../lib/anim/catalog.ts'
import { parseManifest } from '../lib/anim/manifest.ts'
import { getConstruct, lendingFrames, type LobbyConfig } from '../lib/constructs/index.ts'
import { pickWeighted } from '../lib/lobby/director.ts'
import { defaultChoice, listCandidates, resolvePool, type LobbyPool, type PoolItem } from '../lib/lobby/pool.ts'
import { parseVoices, voiceFor, type Voices } from '../lib/voice/voices.ts'

const BOARD = ['BoardAct0201', 'BoardAct0202', 'BoardAct0203', 'BoardAct1001', 'BoardAct1002', 'BoardAct1003', 'BoardAct1004', 'BoardAct1005', 'BoardAct1006', 'BoardAct1007']
const IDLES = ['UiStand1', 'StandAct0101']
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
const nameOf = (pool: LobbyPool, id: string) => pool.candidates.find((c) => c.id === id)!.name
const count = (pool: LobbyPool, frame: string) => framesOf(pool, pool.actions).filter((f) => f === frame).length

/** The pool a frame's Display gets with nothing chosen: its construct config's defaults. */
function byDefault(list: PoolItem[], shown: string, lobby: LobbyConfig | undefined, line = hasLine): LobbyPool {
  const chosen = new Set(defaultChoice(lobby, listCandidates(list, line, shown)))
  return resolvePool(list, line, { frame: shown, chosen })
}

test('Shukra by default: every voiced action of its own, Pavo and the third frame, and four idles, its own two at 0.75 and Pavo\'s at 0.25 (3 : 2 within each)', () => {
  const pavo = [...all, 'BoardAct10021', 'BoardAct10022']
  const pool = byDefault(items({ own: all, pavo, third: all, fourth: all }), 'shukra', LOBBY)
  assert.equal(pool.actions.length, 10 + 12 + 8)
  assert.deepEqual([count(pool, 'shukra'), count(pool, 'pavo'), count(pool, 'third'), count(pool, 'fourth')], [10, 12, 8, 0])
  assert.deepEqual(pool.idles.map((i) => `${framesOf(pool, [i.id])[0]}:${nameOf(pool, i.id)}`), ['shukra:UiStand1', 'shukra:StandAct0101', 'pavo:UiStand1', 'pavo:StandAct0101'])
  pool.idles.forEach((i, n) => near(i.weight, [0.45, 0.3, 0.15, 0.1][n]!))
  near(sum(pool.idles), 1)
})

test('a receiver with no lobby config gets its own clips alone by default', () => {
  const pool = byDefault(items({ own: all, pavo: all, third: all }), 'fourth', undefined)
  assert.equal(pool.actions.length, 10)
  assert.ok(pool.actions.every((id) => id.startsWith('#')))
  assert.deepEqual(pool.idles.map((i) => nameOf(pool, i.id)), ['UiStand1', 'StandAct0101'])
  near(pool.idles[0]!.weight, 0.6)
  near(pool.idles[1]!.weight, 0.4)
})

test('the own actions are always in, even when the choice is empty or names them', () => {
  const list = items({ own: all, pavo: all })
  for (const chosen of [NONE, new Set(['shukra:BoardAct0201']), new Set(['shukra:UiStand1'])]) {
    const pool = resolvePool(list, hasLine, { frame: 'shukra', chosen })
    assert.equal(pool.actions.length, 10)
    assert.ok(pool.actions.every((id) => id.startsWith('#')))
    assert.ok(pool.idles.every((i) => i.id.startsWith('#')))
    near(sum(pool.idles), 1)
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

test('clips that are neither a Board action nor an idle are not candidates; StandAct0101 is an idle, own locked and borrowed choosable', () => {
  const pool = resolvePool(items({ own: all, pavo: all }), () => true, { frame: 'shukra', chosen: new Set(['pavo:Stand1', 'pavo:StandAct0101']) })
  assert.ok(pool.candidates.every((c) => c.name.startsWith('BoardAct') || c.name === 'UiStand1' || c.name === 'StandAct0101'))
  const standAct = pool.candidates.filter((c) => c.name === 'StandAct0101')
  assert.deepEqual(standAct.map((c) => [c.key, c.kind, c.own]), [['shukra:StandAct0101', 'idle', true], ['pavo:StandAct0101', 'idle', false]])
  // Pavo's StandAct0101 alone is borrowed: it takes the whole borrowed share.
  assert.deepEqual(pool.idles.map((i) => `${framesOf(pool, [i.id])[0]}:${nameOf(pool, i.id)}`), ['shukra:UiStand1', 'shukra:StandAct0101', 'pavo:StandAct0101'])
  pool.idles.forEach((i, n) => near(i.weight, [0.45, 0.3, 0.25][n]!))
})

test('the fourth frame can be chosen: its actions and idle join', () => {
  const list = items({ own: all, pavo: all, fourth: all })
  const pool = resolvePool(list, hasLine, { frame: 'shukra', chosen: new Set(['fourth:BoardAct1004', 'fourth:UiStand1']) })
  assert.equal(pool.actions.length, 11)
  assert.equal(count(pool, 'fourth'), 1)
  assert.equal(pool.idles.length, 3)
  pool.idles.forEach((i, n) => near(i.weight, [0.45, 0.3, 0.25][n]!))
  assert.equal(pool.candidates.find((c) => c.key === 'fourth:BoardAct1004')!.own, false)
})

test('a key that matches no candidate is ignored', () => {
  const list = items({ own: all, pavo: all })
  const base = resolvePool(list, hasLine, { frame: 'shukra', chosen: NONE })
  const odd = resolvePool(list, hasLine, { frame: 'shukra', chosen: new Set(['pavo:BoardActX', 'third:BoardAct0201', 'nonsense', '']) })
  assert.deepEqual(odd, base)
})

test('Solitary Dream\'s actions are Pavo\'s own on its other skins, and playing there are not borrowed', () => {
  // On Pavo Generic - Final the catalog lists them as lent by Pavo itself.
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
  assert.deepEqual(own, [...BOARD, ...IDLES].sort((a, b) => all.indexOf(a) - all.indexOf(b)))
})

test('defaultChoice: the voiced actions of actionFrom and both idles of idleFrom, nothing else', () => {
  const candidates = listCandidates(items({ own: all, pavo: all, third: all, fourth: all }), hasLine, 'shukra')
  const keys = defaultChoice(LOBBY, candidates)
  assert.equal(keys.length, 10 + 2 + 8)
  assert.ok(keys.includes('pavo:UiStand1') && keys.includes('pavo:StandAct0101'))
  assert.ok(!keys.includes('third:UiStand1'))
  assert.ok(!keys.some((k) => k.startsWith('fourth:') || k.startsWith('shukra:')))
  assert.deepEqual(defaultChoice(undefined, candidates), [])
})

test('three borrowed idles share the borrowed weight evenly', () => {
  const list = items({ own: all, pavo: all, third: all, fourth: all })
  const pool = resolvePool(list, hasLine, { frame: 'shukra', chosen: new Set(['pavo:UiStand1', 'third:UiStand1', 'fourth:UiStand1']) })
  assert.equal(pool.idles.length, 5)
  near(pool.idles[0]!.weight, 0.45)
  near(pool.idles[1]!.weight, 0.3)
  for (const i of pool.idles.slice(2)) near(i.weight, 0.25 / 3)
  near(sum(pool.idles), 1)
})

test('a lender with no items gives nothing and the rest stays', () => {
  const pool = byDefault(items({ own: all, third: all }), 'shukra', LOBBY)
  assert.equal(pool.actions.length, 10 + 8)
  // Nothing borrowed: the own idles take everything, 3 : 2.
  assert.deepEqual(pool.idles.map((i) => i.weight), [0.6, 0.4])
  assert.ok(!pool.candidates.some((c) => c.frame === 'pavo'))
})

test('a lender with no lines offers its idles only', () => {
  const pool = byDefault(items({ own: all, pavo: all, third: all }), 'shukra', LOBBY, (frame, name) => frame !== 'third' && hasLine(frame, name))
  assert.equal(pool.actions.length, 10 + 10)
  assert.deepEqual(pool.candidates.filter((c) => c.frame === 'third').map((c) => c.name), ['UiStand1', 'StandAct0101'])
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

// ---- Fight idles (add-lobby-fight-idles) ----

const FIGHT = ['Born', 'Stand1', 'Stand2', 'Standchange', 'Save', 'Win']
const LEVEL = ['LevelAttack08_NunWalk', 'LevelAttack11_Loop', 'LevelAttack013Loop', 'LevelAttack14']
const ONCE = new Set(['Born', 'Standchange', 'Win', 'LevelAttack013Loop', 'LevelAttack14'])
/** Fight items as the Fight list gives them, with the manifest's loop flag (`Run` and `Walk` are in the list, not candidates). */
function fightItems(frames: Record<string, string[]>): PoolItem[] {
  return Object.entries(frames).flatMap(([frame, names]) =>
    names.map((name, i) => ({
      id: frame === 'own' ? `#f${i}` : `${frame}:anim/manifest.json#f${i}`,
      name,
      frame: frame === 'own' ? null : frame,
      duration: 3,
      context: 'fight' as const,
      loop: !ONCE.has(name),
    })),
  )
}
const withExtras = ['Run', 'Walk']
const weightOfName = (pool: LobbyPool, frame: string, name: string) => pool.idles.find((i) => pool.candidates.find((c) => c.id === i.id)!.key === `${frame}:${name}`)!.weight

test('Fight clips: only the ten named ones are candidates; Run and Walk are not; once marks the ones that do not loop', () => {
  const list = [...items({ own: all }), ...fightItems({ own: [...FIGHT, ...LEVEL, ...withExtras] })]
  const { candidates } = resolvePool(list, hasLine, { frame: 'shukra', chosen: NONE })
  const fight = candidates.filter((c) => c.kind === 'fight')
  assert.deepEqual(fight.map((c) => c.name), [...FIGHT, ...LEVEL])
  assert.deepEqual(fight.filter((c) => c.once).map((c) => c.name).sort(), [...ONCE].sort())
  assert.ok(fight.every((c) => c.own && c.key === `shukra:${c.name}`))
})

test('Shukra by default: own Fight 60 % (each of ten 6 %), own Menu 30 % (3 : 2), Pavo\'s two Menu idles 10 % (3 : 2)', () => {
  const list = [...items({ own: all, pavo: all, third: all }), ...fightItems({ own: [...FIGHT, ...LEVEL], pavo: FIGHT, third: FIGHT })]
  const pool = byDefault(list, 'shukra', LOBBY)
  near(sum(pool.idles), 1)
  for (const name of [...FIGHT, ...LEVEL]) near(weightOfName(pool, 'shukra', name), 0.6 / 10)
  near(weightOfName(pool, 'shukra', 'UiStand1'), 0.18)
  near(weightOfName(pool, 'shukra', 'StandAct0101'), 0.12)
  near(weightOfName(pool, 'pavo', 'UiStand1'), 0.06)
  near(weightOfName(pool, 'pavo', 'StandAct0101'), 0.04)
  assert.equal(pool.idles.length, 10 + 2 + 2, 'no other frame\'s Fight clip is borrowed by default')
  assert.deepEqual(pool.idles.filter((i) => i.once).map((i) => nameOf(pool, i.id)).sort(), [...ONCE].sort())
})

test('nothing borrowed: the own Fight clips take two thirds and the own Menu idles one third', () => {
  const list = [...items({ own: all }), ...fightItems({ own: FIGHT })]
  const pool = byDefault(list, 'third', undefined)
  near(sum(pool.idles), 1)
  for (const name of FIGHT) near(weightOfName(pool, 'third', name), 0.6 / 0.9 / FIGHT.length)
  near(weightOfName(pool, 'third', 'UiStand1'), (0.3 / 0.9) * 0.6)
  near(weightOfName(pool, 'third', 'StandAct0101'), (0.3 / 0.9) * 0.4)
})

test('all own Fight clips off: the own Menu idles and the borrowed ones share three quarters and a quarter, as before Fight idles', () => {
  const list = [...items({ own: all, pavo: all }), ...fightItems({ own: [...FIGHT, ...LEVEL] })]
  const ownOff = new Set([...FIGHT, ...LEVEL].map((n) => `shukra:${n}`))
  const pool = resolvePool(list, hasLine, { frame: 'shukra', chosen: new Set(['pavo:UiStand1', 'pavo:StandAct0101']), ownOff })
  assert.deepEqual(pool.idles.map((i) => `${framesOf(pool, [i.id])[0]}:${nameOf(pool, i.id)}`), ['shukra:UiStand1', 'shukra:StandAct0101', 'pavo:UiStand1', 'pavo:StandAct0101'])
  pool.idles.forEach((i, n) => near(i.weight, [0.45, 0.3, 0.15, 0.1][n]!))
  // The candidates still list the clips that are off, so the popover can show them unchecked.
  assert.equal(pool.candidates.filter((c) => c.kind === 'fight').length, 10)
})

test('one own Fight clip off leaves the other nine at equal weights; an unknown key in ownOff is ignored', () => {
  const list = [...items({ own: all }), ...fightItems({ own: [...FIGHT, ...LEVEL] })]
  const pool = resolvePool(list, hasLine, { frame: 'shukra', chosen: NONE, ownOff: new Set(['shukra:LevelAttack14', 'shukra:Nope', 'third:Win']) })
  assert.equal(pool.idles.filter((i) => pool.candidates.find((c) => c.id === i.id)!.kind === 'fight').length, 9)
  for (const name of [...FIGHT, ...LEVEL].filter((n) => n !== 'LevelAttack14')) near(weightOfName(pool, 'shukra', name), 0.6 / 0.9 / 9)
  near(sum(pool.idles), 1)
})

test('a lender that lends Fight and Menu clips splits its share 60 : 30; the borrowed share goes evenly over the lenders', () => {
  const list = [...items({ own: all, pavo: all, third: all }), ...fightItems({ own: FIGHT, pavo: FIGHT, third: LEVEL })]
  const chosen = new Set(['pavo:Stand1', 'pavo:Win', 'pavo:UiStand1', 'third:LevelAttack14'])
  const pool = resolvePool(list, hasLine, { frame: 'shukra', chosen })
  near(sum(pool.idles), 1)
  // own: 0.6 Fight, 0.3 Menu; borrowed 0.1 over two lenders = 0.05 each
  near(weightOfName(pool, 'shukra', 'Save'), 0.6 / FIGHT.length)
  near(weightOfName(pool, 'pavo', 'Stand1'), (0.05 * (0.6 / 0.9)) / 2)
  near(weightOfName(pool, 'pavo', 'Win'), (0.05 * (0.6 / 0.9)) / 2)
  near(weightOfName(pool, 'pavo', 'UiStand1'), 0.05 * (0.3 / 0.9))
  near(weightOfName(pool, 'third', 'LevelAttack14'), 0.05)
  assert.equal(pool.idles.find((i) => i.id.startsWith('third:'))!.once, true)
})

test('a lent Fight clip is only in the pool when chosen, never by the frame\'s default', () => {
  const list = [...items({ own: all, pavo: all }), ...fightItems({ own: FIGHT, pavo: FIGHT })]
  const candidates = listCandidates(list, hasLine, 'shukra')
  assert.ok(!defaultChoice(LOBBY, candidates).some((k) => FIGHT.some((n) => k === `pavo:${n}`)))
  const pool = byDefault(list, 'shukra', LOBBY)
  assert.ok(!pool.idles.some((i) => FIGHT.some((n) => pool.candidates.find((c) => c.id === i.id)!.key === `pavo:${n}`)))
  const chosen = resolvePool(list, hasLine, { frame: 'shukra', chosen: new Set(['pavo:Save']) })
  assert.ok(chosen.idles.some((i) => chosen.candidates.find((c) => c.id === i.id)!.key === 'pavo:Save'))
})

test('a Fight candidate has no voice line and does not need one', () => {
  const pool = resolvePool(fightItems({ own: FIGHT }), () => false, { frame: 'fourth', chosen: NONE })
  assert.equal(pool.candidates.length, FIGHT.length)
  assert.deepEqual(pool.actions, [])
  near(sum(pool.idles), 1)
})
// ---- the real frames ----

const dataDir = new URL('../data/', import.meta.url)
// Frames with a clip set: Erza (add-erza-model) is not a Display model and lends nothing.
const FRAMES = lendingFrames()
const skip = !FRAMES.every((f) => existsSync(new URL(`${f.id}/anim/manifest.json`, dataDir)) && existsSync(new URL(`${f.id}/voices.json`, dataDir))) && 'data/ is not present (voices.json comes from build_voices.py)'

const readJson = (url: URL): unknown => JSON.parse(readFileSync(url, 'utf8'))
const manifestOf = (frame: string, path: string) => parseManifest(readJson(new URL(`${frame}/${path}`, dataDir)))
const voicesOf = (frame: string): Voices => parseVoices(readJson(new URL(`${frame}/voices.json`, dataDir)), () => {})

/**
 * What Display on `skin` of `frame` would resolve to, read from the real manifests and voices (`chosen` null: the frame's default). `withFight` adds the Fight
 * items as Display reads them; `ownOff` is the own Fight clips turned off.
 */
function realPool(frame: string, skinId: string, chosen: string[] | null = null, withFight = false, ownOff: string[] = []) {
  const sources: AnimationSource[] = FRAMES.map((f) => ({
    frame: f.id,
    label: f.displayName,
    manifestPath: f.animationSource!.manifest,
    manifest: manifestOf(f.id, f.animationSource!.manifest),
    extras: f.animationSource!.extras.map((e) => ({ manifestPath: e.manifest, manifest: manifestOf(f.id, e.manifest), clips: e.clips, label: e.label, replace: e.replace })),
  }))
  const construct = getConstruct(frame)
  const skin = construct.skins.find((s) => s.id === skinId)!
  const own = buildCatalog(manifestOf(frame, skin.manifest!), 'menu')
  const catalog = withSources(own, sources.filter((s) => s.frame !== frame), 'menu', sources.find((s) => s.frame === frame))
  const poolItems: PoolItem[] = catalog.groups.flatMap((g) => g.items).map((i) => ({ id: i.id, name: i.name, frame: i.source?.frame ?? null, duration: 1 }))
  if (withFight) {
    const fightOwn = buildCatalog(manifestOf(frame, skin.manifest!), 'fight')
    const fight = withSources(fightOwn, sources.filter((s) => s.frame !== frame), 'fight', sources.find((s) => s.frame === frame))
    poolItems.push(...fight.groups.flatMap((g) => g.items).map((i) => ({ id: i.id, name: i.name, frame: i.source?.frame ?? null, duration: 1, context: 'fight' as const, loop: i.loop })))
  }
  const voices = new Map(FRAMES.map((f) => [f.id, voicesOf(f.id)]))
  const line = (from: string | null, name: string) => !!voiceFor(voices.get(from ?? frame)!, name)
  const keys = chosen ?? defaultChoice(construct.lobby, listCandidates(poolItems, line, frame))
  return { pool: resolvePool(poolItems, line, { frame, chosen: new Set(keys), ownOff: new Set(ownOff) }), poolItems, voiced: (f: string) => BOARD.filter((n) => !!voiceFor(voices.get(f)!, n)) }
}

const namesOf = (pool: LobbyPool, frame: string, kind: 'action' | 'idle' | 'fight') => pool.candidates.filter((c) => c.frame === frame && c.kind === kind).map((c) => c.name)

// The counts below follow from which Board actions voice_pairings.json pairs, so they are computed from voices.json, not written down.

test('real data: by default Shukra plays its voiced Board actions and Pavo\'s, with four idles (its own two at 0.45 and 0.30, Pavo\'s at 0.15 and 0.10), and Pavo the mirror', { skip }, () => {
  for (const [shown, lender] of [['shukra', 'pavo'], ['pavo', 'shukra']] as const) {
    const skin = getConstruct(shown).defaultSkin
    const { pool, voiced } = realPool(shown, skin)
    assert.ok(voiced(shown).length > 0 && voiced(lender).length > 0, 'the pairings give both frames at least one voiced Board action')
    assert.equal(pool.actions.length, voiced(shown).length + voiced(lender).length, shown)
    assert.deepEqual([count(pool, shown), count(pool, lender)], [voiced(shown).length, voiced(lender).length], shown)
    assert.deepEqual(namesOf(pool, lender, 'action').sort(), voiced(lender).sort(), `${shown}: the lender's voiced actions`)
    assert.equal(pool.idles.length, 4, shown)
    const weight = (key: string) => pool.idles.find((i) => pool.candidates.find((c) => c.id === i.id)!.key === key)!.weight
    near(weight(`${shown}:UiStand1`), 0.45)
    near(weight(`${shown}:StandAct0101`), 0.3)
    near(weight(`${lender}:UiStand1`), 0.15)
    near(weight(`${lender}:StandAct0101`), 0.1)
    near(sum(pool.idles), 1)
  }
})

test('real data: no unvoiced clip is offered, and both Menu idles are', { skip }, () => {
  for (const [shown, lender] of [['shukra', 'pavo'], ['pavo', 'shukra']] as const) {
    const { pool, voiced } = realPool(shown, getConstruct(shown).defaultSkin)
    for (const frame of [shown, lender]) {
      const offered = namesOf(pool, frame, 'action')
      assert.deepEqual(offered.sort(), voiced(frame).sort(), `${shown}: ${frame} offers exactly its voiced Board actions`)
      assert.deepEqual(namesOf(pool, frame, 'idle').sort(), ['StandAct0101', 'UiStand1'], `${frame}: both Menu idles`)
    }
  }
})

test('real data: clearing the lender leaves the shown frame\'s own actions and idles alone; choosing it again restores the default', { skip }, () => {
  for (const [shown, lender] of [['shukra', 'pavo'], ['pavo', 'shukra']] as const) {
    const skin = getConstruct(shown).defaultSkin
    const { pool: base, voiced } = realPool(shown, skin)
    const { pool: own } = realPool(shown, skin, [])
    assert.equal(own.actions.length, voiced(shown).length, `${shown}: own actions are always in`)
    assert.equal(count(own, lender), 0)
    assert.equal(own.idles.length, 2)
    assert.deepEqual(own.idles.map((i) => i.weight).sort(), [0.4, 0.6])
    const { pool: again } = realPool(shown, skin, base.candidates.filter((c) => !c.own).map((c) => c.key))
    assert.deepEqual(again.actions, base.actions, `${shown}: choosing every borrowed row gives the default pool`)
  }
})

test('real data: Fight candidates per frame (Shukra six, Pavo seven), Pavo\'s LevelAttack14 offered to Shukra, once only on the clips that do not loop', { skip }, () => {
  const expected: Record<string, string[]> = { shukra: FIGHT, pavo: [...FIGHT, 'LevelAttack14'] }
  const once = new Set(['Born', 'Standchange', 'Win', 'LevelAttack14'])
  for (const [frame, other] of [['shukra', 'pavo'], ['pavo', 'shukra']] as const) {
    const { pool } = realPool(frame, getConstruct(frame).defaultSkin, null, true)
    assert.deepEqual(pool.candidates.filter((c) => c.own && c.kind === 'fight').map((c) => c.name).sort(), expected[frame]!.slice().sort(), frame)
    assert.deepEqual(namesOf(pool, other, 'fight').sort(), expected[other]!.slice().sort(), `${frame} is offered ${other}'s Fight clips`)
    for (const c of pool.candidates.filter((c) => c.kind === 'fight')) assert.equal(c.once, once.has(c.name), `${frame}:${c.name}`)
    near(sum(pool.idles), 1)
  }
})

test('real data: Shukra by default has 6 own Fight, 2 own Menu and 2 Pavo idles (10, 18, 12, 6, 4 %), and turning off every own Fight clip gives the 75 / 25 again', { skip }, () => {
  const { pool } = realPool('shukra', getConstruct('shukra').defaultSkin, null, true)
  assert.equal(pool.idles.length, 10)
  const weight = (key: string) => pool.idles.find((i) => pool.candidates.find((c) => c.id === i.id)!.key === key)!.weight
  for (const name of FIGHT) near(weight(`shukra:${name}`), 0.1)
  near(weight('shukra:UiStand1'), 0.18)
  near(weight('shukra:StandAct0101'), 0.12)
  near(weight('pavo:UiStand1'), 0.06)
  near(weight('pavo:StandAct0101'), 0.04)
  const off = FIGHT.map((n) => `shukra:${n}`)
  const { pool: plain } = realPool('shukra', getConstruct('shukra').defaultSkin, null, true, off)
  const byKey = Object.fromEntries(plain.idles.map((i) => [plain.candidates.find((c) => c.id === i.id)!.key, i.weight.toFixed(3)]))
  assert.deepEqual(byKey, { 'shukra:UiStand1': '0.450', 'shukra:StandAct0101': '0.300', 'pavo:UiStand1': '0.150', 'pavo:StandAct0101': '0.100' })
  assert.equal(plain.actions.length, pool.actions.length, 'the actions do not change')
})

// The spec's sampling scenarios ("Idle candidates and their shares"), on the real frames: 1000 picks with the director's own weighted pick.
function sample(pool: LobbyPool, picks: number, seed: number): Record<string, number> {
  let a = seed >>> 0
  const random = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const counts: Record<string, number> = { fight: 0, ownMenu: 0, borrowedMenu: 0 }
  const weights = pool.idles.map((i) => i.weight)
  for (let n = 0; n < picks; n++) {
    const picked = pool.idles[pickWeighted(weights, random)]!
    const c = pool.candidates.find((x) => x.id === picked.id)!
    counts[c.kind === 'fight' && c.own ? 'fight' : c.own ? 'ownMenu' : 'borrowedMenu']!++
  }
  return counts
}

test('real data: 1000 idle picks on Shukra give 55-65 % own Fight, 25-35 % own Menu, 7-13 % Pavo\'s Menu idles; with Pavo cleared 61-72 % Fight; with all own Fight off 70-80 % own Menu', { skip }, () => {
  const skin = getConstruct('shukra').defaultSkin
  const share = (c: Record<string, number>, k: string) => c[k]! / 10
  for (const seed of [1, 2, 3]) {
    const d = sample(realPool('shukra', skin, null, true).pool, 1000, seed)
    assert.ok(share(d, 'fight') >= 55 && share(d, 'fight') <= 65, `seed ${seed}: Fight ${share(d, 'fight')} %`)
    assert.ok(share(d, 'ownMenu') >= 25 && share(d, 'ownMenu') <= 35, `seed ${seed}: own Menu ${share(d, 'ownMenu')} %`)
    assert.ok(share(d, 'borrowedMenu') >= 7 && share(d, 'borrowedMenu') <= 13, `seed ${seed}: borrowed ${share(d, 'borrowedMenu')} %`)
    const alone = sample(realPool('shukra', skin, [], true).pool, 600, seed)
    assert.ok(alone.fight! / 6 >= 61 && alone.fight! / 6 <= 72, `seed ${seed}: nothing borrowed, Fight ${(alone.fight! / 6).toFixed(1)} %`)
    const off = sample(realPool('shukra', skin, null, true, FIGHT.map((n) => `shukra:${n}`)).pool, 1000, seed)
    assert.ok(share(off, 'ownMenu') >= 70 && share(off, 'ownMenu') <= 80, `seed ${seed}: own Fight off, own Menu ${share(off, 'ownMenu')} %`)
  }
})

