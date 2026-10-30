import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createDirector,
  loopsFor,
  pickWeighted,
  shuffled,
  LOBBY_FIGHT_IDLES,
  LOBBY_GROUP_SHARES,
  LOBBY_IDLE_WEIGHTS,
  type DirectorCommand,
  type DirectorConfig,
  type IdleChoice,
} from '../lib/lobby/director.ts'
import { defaultChoice, listCandidates, resolvePool, type PoolItem } from '../lib/lobby/pool.ts'

/** A small seeded generator (mulberry32): the tests are repeatable. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ACTIONS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']
const IDLES: IdleChoice[] = [
  { id: 'ui', weight: 3, duration: 20.5667 },
  { id: 'sa', weight: 2, duration: 10 },
]
const cfg = (over: Partial<DirectorConfig> = {}): DirectorConfig => ({ actions: ACTIONS, idles: IDLES, ...over })
const types = (cs: DirectorCommand[]): string[] => cs.map((c) => c.type)
const played = (cs: DirectorCommand[]): string | null => {
  const c = cs.find((x) => x.type === 'playAction')
  return c && c.type === 'playAction' ? c.id : null
}
const prepared = (cs: DirectorCommand[]): string | null => {
  const c = cs.find((x) => x.type === 'prepare')
  return c && c.type === 'prepare' ? c.id : null
}

test('the idles agreed for Display', () => {
  assert.deepEqual({ ...LOBBY_IDLE_WEIGHTS }, { UiStand1: 3, StandAct0101: 2 }) // StandAct0101 is back (restore-standact-idle)
})

test('loopsFor: the smallest number of whole loops that reaches the dwell, within 0.05 s', () => {
  assert.equal(loopsFor(6), 2)
  assert.equal(loopsFor(10), 1)
  assert.equal(loopsFor(20.5667), 1)
  assert.equal(loopsFor(3.333329916), 3) // 9.99999 s: three loops, not four
  assert.equal(loopsFor(3), 4) // three loops are 9 s
  assert.equal(loopsFor(13), 1)
  assert.equal(loopsFor(0), 1)
  assert.equal(loopsFor(Number.NaN), 1)
})

test('shuffled is a permutation and does not change its input', () => {
  const input = [1, 2, 3, 4, 5, 6, 7]
  const out = shuffled(input, seeded(1))
  assert.deepEqual([...out].sort(), input)
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7])
  assert.notDeepEqual(out, input)
})

test('pickWeighted follows the weights, ignores zero weights and handles degenerate input', () => {
  const random = seeded(7)
  const counts = [0, 0, 0]
  for (let i = 0; i < 6000; i++) counts[pickWeighted([3, 2, 0], random)]!++
  assert.equal(counts[2], 0)
  assert.ok(Math.abs(counts[0]! / 6000 - 0.6) < 0.03, String(counts[0]! / 6000))
  assert.equal(pickWeighted([], random), -1)
  assert.ok(pickWeighted([0, 0], () => 0.99) >= 0)
})

test('start with an action plays one and prepares the next; start with idle plays an idle', () => {
  const d = createDirector(cfg(), seeded(3))
  const first = d.handle({ type: 'start', entry: 'action' }, 0)
  assert.deepEqual(types(first), ['playAction', 'prepare'])
  assert.ok(ACTIONS.includes(played(first)!))
  assert.notEqual(prepared(first), played(first))
  assert.equal(d.state().phase, 'action')
  assert.equal(d.state().current, played(first))

  const e = createDirector(cfg(), seeded(3))
  const idle = e.handle({ type: 'start', entry: 'idle' }, 0)
  assert.equal(idle[0]!.type, 'playIdle')
  assert.equal(played(idle), null)
  assert.equal(e.state().phase, 'idle')
})

test('the bag: every block of six starts holds each action once, no action follows itself, and prepare names the next one', () => {
  const d = createDirector(cfg(), seeded(11))
  const seq: string[] = []
  let cs = d.handle({ type: 'start', entry: 'action' }, 0)
  let at = 0
  for (let i = 0; i < 60; i++) {
    const id = played(cs)!
    seq.push(id)
    const next = prepared(cs)
    at += 1000
    cs = d.handle({ type: 'tap' }, at)
    assert.equal(played(cs), next, `start ${i + 2} is the action that was prepared`)
  }
  assert.equal(seq.length, 60)
  for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1], `back to back at ${i}`)
  for (let b = 0; b < 10; b++) assert.deepEqual([...seq.slice(b * 6, b * 6 + 6)].sort(), ACTIONS, `block ${b}`)
})

test('a pool of one repeats (nothing else to play), a pool of two alternates', () => {
  const one = createDirector(cfg({ actions: ['x'] }), seeded(1))
  let cs = one.handle({ type: 'start', entry: 'action' }, 0)
  assert.equal(played(cs), 'x')
  cs = one.handle({ type: 'tap' }, 1000)
  assert.equal(played(cs), 'x')

  const two = createDirector(cfg({ actions: ['x', 'y'] }), seeded(1))
  cs = two.handle({ type: 'start', entry: 'action' }, 0)
  const seq = [played(cs)!]
  for (let i = 1; i <= 7; i++) seq.push(played(two.handle({ type: 'tap' }, i * 1000))!)
  for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1])
})

test('a tap in idle starts an action; a tap during an action interrupts it with another', () => {
  const d = createDirector(cfg(), seeded(5))
  d.handle({ type: 'start', entry: 'idle' }, 0)
  const a = d.handle({ type: 'tap' }, 1000)
  assert.deepEqual(types(a), ['playAction', 'prepare'])
  assert.equal(d.state().phase, 'action')
  const first = played(a)!
  const b = d.handle({ type: 'tap' }, 2000)
  assert.ok(played(b))
  assert.notEqual(played(b), first)
  assert.equal(d.state().current, played(b))
})

test('the tap debounce: closer than 400 ms is ignored, 400 ms is accepted, and a debounced tap still counts as input', () => {
  const d = createDirector(cfg(), seeded(5))
  d.handle({ type: 'start', entry: 'idle' }, 0)
  assert.equal(types(d.handle({ type: 'tap' }, 1000)).includes('playAction'), true)
  assert.deepEqual(d.handle({ type: 'tap' }, 1200), [])
  assert.deepEqual(d.handle({ type: 'tap' }, 1399), [])
  assert.equal(types(d.handle({ type: 'tap' }, 1400)).includes('playAction'), true)
})

test('an action that ends is followed by an idle; the end of any other action changes nothing', () => {
  const d = createDirector(cfg(), seeded(9))
  const open = d.handle({ type: 'start', entry: 'action' }, 0)
  const id = played(open)!
  assert.deepEqual(d.handle({ type: 'actionEnded', id: 'someone-else' }, 5000), [])
  assert.equal(d.state().phase, 'action')
  const after = d.handle({ type: 'actionEnded', id }, 30_000)
  assert.equal(after[0]!.type, 'playIdle')
  assert.equal(d.state().phase, 'idle')
  // the same event again is stale
  assert.deepEqual(d.handle({ type: 'actionEnded', id }, 30_100), [])
})

test('a tap just before an action ends is not lost: the end of the old action is stale', () => {
  const d = createDirector(cfg(), seeded(21))
  const open = d.handle({ type: 'start', entry: 'action' }, 0)
  const a = played(open)!
  const tap = d.handle({ type: 'tap' }, 29_900)
  const b = played(tap)!
  assert.notEqual(a, b)
  // the viewer reports the end of the old action after the tap
  assert.deepEqual(d.handle({ type: 'actionEnded', id: a }, 29_940), [])
  assert.equal(d.state().phase, 'action')
  assert.equal(d.state().current, b)
  // and the end of the new one does bring the idle
  assert.equal(d.handle({ type: 'actionEnded', id: b }, 40_000)[0]!.type, 'playIdle')
})

test('a wrap of the replaced idle is stale', () => {
  const d = createDirector(cfg({ idles: [{ id: 'ui', weight: 1, duration: 6 }] }), seeded(2))
  d.handle({ type: 'start', entry: 'idle' }, 0)
  d.handle({ type: 'tap' }, 1000) // an action replaces the idle
  assert.deepEqual(d.handle({ type: 'idleLoop', id: 'ui', loops: 1 }, 1100), [])
  assert.equal(d.state().phase, 'action')
})

test('idle dwell: a 6 s idle plays twice; the same pick again keeps looping, another pick crossfades', () => {
  // random sequence: start picks idle 0 ('a'); at the end of the dwell pick 'a' again, then 'b'
  const idles: IdleChoice[] = [
    { id: 'a', weight: 1, duration: 6 },
    { id: 'b', weight: 1, duration: 4 },
  ]
  const seq = [0.1, 0.1, 0.9]
  let i = 0
  const d = createDirector(cfg({ actions: [], idles }), () => seq[i++] ?? 0.5)
  const start = d.handle({ type: 'start', entry: 'idle' }, 0)
  assert.deepEqual(start, [{ type: 'playIdle', id: 'a' }])
  assert.equal(d.state().idleLoopsWanted, 2)
  assert.deepEqual(d.handle({ type: 'idleLoop', id: 'a', loops: 1 }, 6000), [])
  // loops 2: the dwell is over, 'a' is picked again: no command, the wanted loops move up by another dwell
  assert.deepEqual(d.handle({ type: 'idleLoop', id: 'a', loops: 2 }, 12_000), [])
  assert.equal(d.state().idleLoopsWanted, 4)
  assert.equal(d.state().current, 'a')
  assert.deepEqual(d.handle({ type: 'idleLoop', id: 'a', loops: 3 }, 18_000), [])
  // loops 4: 'b' is picked: it crossfades in and its own dwell (3 loops of 4 s) starts
  assert.deepEqual(d.handle({ type: 'idleLoop', id: 'a', loops: 4 }, 24_000), [{ type: 'playIdle', id: 'b' }])
  assert.equal(d.state().current, 'b')
  assert.equal(d.state().idleLoopsWanted, 3)
})

test('idle weights over many picks are 3 : 2', () => {
  const random = seeded(99)
  let ui = 0
  const n = 4000
  for (let i = 0; i < n; i++) {
    const d = createDirector(cfg(), random)
    const cs = d.handle({ type: 'start', entry: 'idle' }, 0)
    const first = cs[0]
    if (first && first.type === 'playIdle' && first.id === 'ui') ui++
  }
  assert.ok(Math.abs(ui / n - 0.6) < 0.03, String(ui / n))
})

test('a failed action leaves the pool: on a tap the next one starts, on open the model idles', () => {
  const d = createDirector(cfg(), seeded(13))
  d.handle({ type: 'start', entry: 'idle' }, 0)
  const tap = d.handle({ type: 'tap' }, 1000)
  const bad = played(tap)!
  const retry = d.handle({ type: 'actionFailed', id: bad }, 1100)
  assert.equal(types(retry)[0], 'playAction')
  assert.notEqual(played(retry), bad)
  assert.equal(d.state().pool.includes(bad), false)
  assert.equal(d.state().pool.length, 5)

  const e = createDirector(cfg(), seeded(13))
  const open = e.handle({ type: 'start', entry: 'action' }, 0)
  const failed = played(open)!
  const after = e.handle({ type: 'actionFailed', id: failed }, 100)
  assert.equal(after[0]!.type, 'playIdle')
  assert.equal(e.state().phase, 'idle')
  assert.equal(e.state().pool.includes(failed), false)
})

test('a failed action that is not the current one only leaves the pool; a dropped action never comes back', () => {
  const d = createDirector(cfg(), seeded(17))
  const open = d.handle({ type: 'start', entry: 'action' }, 0)
  const next = prepared(open)!
  const cur = d.state().current
  assert.deepEqual(d.handle({ type: 'actionFailed', id: next }, 500), [])
  assert.equal(d.state().phase, 'action')
  assert.equal(d.state().current, cur)
  const seen = new Set<string>()
  let at = 1000
  for (let i = 0; i < 30; i++) seen.add(played(d.handle({ type: 'tap' }, (at += 1000)))!)
  assert.equal(seen.has(next), false)
})

test('an empty pool idles and ignores taps', () => {
  const idles: IdleChoice[] = [{ id: 'i', weight: 1, duration: 6 }]
  const d = createDirector(cfg({ actions: [], idles }), seeded(1))
  const open = d.handle({ type: 'start', entry: 'action' }, 0)
  assert.deepEqual(open, [{ type: 'playIdle', id: 'i' }])
  assert.deepEqual(d.handle({ type: 'tap' }, 1000), [])
  assert.equal(d.state().phase, 'idle')
  d.handle({ type: 'idleLoop', id: 'i', loops: 1 }, 121_000)
  assert.equal(d.state().phase, 'idle')
  assert.deepEqual(d.handle({ type: 'tap' }, 130_000), [])
})

test('no idles and no actions: nothing to command, nothing breaks', () => {
  const d = createDirector({ actions: [], idles: [] }, seeded(1))
  assert.deepEqual(d.handle({ type: 'start', entry: 'action' }, 0), [])
  assert.deepEqual(d.handle({ type: 'tap' }, 1000), [])
  assert.deepEqual(d.handle({ type: 'idleLoop', id: 'x', loops: 1 }, 2000), [])
})

test('stop clears the state and makes later events no-ops; start works again', () => {
  const idles: IdleChoice[] = [{ id: 'i', weight: 1, duration: 6 }]
  const d = createDirector(cfg({ idles }), seeded(4))
  d.handle({ type: 'start', entry: 'idle' }, 0)
  d.handle({ type: 'idleLoop', id: 'i', loops: 1 }, 121_000)
  assert.deepEqual(d.handle({ type: 'stop' }, 122_000), [])
  assert.equal(d.state().phase, 'stopped')
  assert.equal(d.state().current, null)
  assert.deepEqual(d.handle({ type: 'tap' }, 123_000), [])
  assert.deepEqual(d.handle({ type: 'actionEnded', id: 'x' }, 124_000), [])
  assert.deepEqual(d.handle({ type: 'stop' }, 125_000), [])
  // a new start begins afresh: the pool is whole again
  const again = d.handle({ type: 'start', entry: 'action' }, 200_000)
  assert.equal(types(again)[0], 'playAction')
  assert.equal(d.state().pool.length, 6)
})

test('stop while an action plays gives no command', () => {
  const d = createDirector(cfg(), seeded(4))
  d.handle({ type: 'start', entry: 'action' }, 0)
  assert.deepEqual(d.handle({ type: 'stop' }, 1000), [])
})

test('start resets a pool that lost a failed action', () => {
  const idles: IdleChoice[] = [{ id: 'i', weight: 1, duration: 6 }]
  const d = createDirector(cfg({ idles }), seeded(4))
  const open = d.handle({ type: 'start', entry: 'action' }, 0)
  d.handle({ type: 'actionFailed', id: played(open)! }, 100)
  assert.equal(d.state().pool.length, 5)
  d.handle({ type: 'start', entry: 'idle' }, 500_000) // a new model
  assert.equal(d.state().pool.length, 6)
})

test('every play is followed by a prepare of the next action when there is one', () => {
  const d = createDirector(cfg(), seeded(31))
  const idle = d.handle({ type: 'start', entry: 'idle' }, 0)
  assert.deepEqual(types(idle), ['playIdle', 'prepare'])
  const tap = d.handle({ type: 'tap' }, 1000)
  assert.equal(prepared(tap) !== null, true)
  const end = d.handle({ type: 'actionEnded', id: played(tap)! }, 20_000)
  assert.deepEqual(types(end), ['playIdle', 'prepare'])
  assert.equal(prepared(end), prepared(tap), 'the prepared action is the one the next tap plays')
  assert.equal(played(d.handle({ type: 'tap' }, 21_000)), prepared(tap))
})

// ---- Borrowed clips (add-lobby-variety): the director sees ids and weights only ----

/** A shown frame's items as Display resolves them: own clips, a lender's, and a third frame's that lacks two lines (names as in the Menu list). */
function defaultPool() {
  const names = ['BoardAct0201', 'BoardAct0202', 'BoardAct0203', 'BoardAct1004', 'BoardAct1006', 'BoardAct1007', 'UiStand1', 'StandAct0101']
  const items: PoolItem[] = [
    ...names.map((name, i) => ({ id: `#${i}`, name, frame: null, duration: 10 })),
    ...names.map((name, i) => ({ id: `pavo:anim/manifest.json#${i}`, name, frame: 'pavo', duration: 10 })),
    ...names.map((name, i) => ({ id: `third:anim/manifest.json#${i}`, name, frame: 'third', duration: 10 })),
  ]
  const noLine = (frame: string | null, name: string) => frame === 'third' && (name === 'BoardAct0202' || name === 'BoardAct0203')
  const line = (frame: string | null, name: string) => !noLine(frame, name)
  const chosen = new Set(defaultChoice({ actionFrom: ['pavo', 'third'], idleFrom: ['pavo'] }, listCandidates(items, line, 'shukra')))
  return resolvePool(items, line, { frame: 'shukra', chosen })
}

test('400 idle picks on Shukra\'s weights give 20 % to 30 % borrowed ones', () => {
  const pool = defaultPool()
  assert.equal(pool.idles.length, 4) // own and the lender's UiStand1 and StandAct0101
  const idles: IdleChoice[] = pool.idles.map((i) => ({ ...i, duration: 20.5667 }))
  for (const seed of [1, 2, 3]) {
    const d = createDirector({ actions: pool.actions, idles }, seeded(seed))
    d.handle({ type: 'start', entry: 'idle' }, 0)
    let borrowed = d.state().current!.startsWith('pavo:') ? 1 : 0
    for (let n = 1; n < 400; n++) {
      // The last loop of the dwell: the director picks the next idle (the same one just goes on looping).
      d.handle({ type: 'idleLoop', id: d.state().current!, loops: d.state().idleLoopsWanted }, n)
      if (d.state().current!.startsWith('pavo:')) borrowed++
    }
    assert.ok(borrowed >= 80 && borrowed <= 120, `seed ${seed}: ${borrowed} of 400 borrowed`)
  }
})

test('400 idle picks on a frame that borrows nothing: 32 % to 48 % StandAct0101, the rest UiStand1', () => {
  const names = ['UiStand1', 'StandAct0101']
  const own: PoolItem[] = names.map((name, i) => ({ id: `#${i}`, name, frame: null, duration: 6 }))
  const pool = resolvePool(own, () => true, { frame: 'zero', chosen: new Set() })
  for (const seed of [1, 2, 3]) {
    const d = createDirector({ actions: [], idles: pool.idles.map((i) => ({ ...i, duration: 6 })) }, seeded(seed))
    d.handle({ type: 'start', entry: 'idle' }, 0)
    let standAct = d.state().current === '#1' ? 1 : 0
    for (let n = 1; n < 400; n++) {
      d.handle({ type: 'idleLoop', id: d.state().current!, loops: d.state().idleLoopsWanted }, n)
      if (d.state().current === '#1') standAct++
    }
    assert.ok(standAct >= 128 && standAct <= 192, `seed ${seed}: ${standAct} of 400 are StandAct0101`)
  }
})

test('Pavo\'s StandAct0101 (3.33 s) as an idle plays three loops before the next pick', () => {
  const d = createDirector({ actions: [], idles: [{ id: 'pavo:StandAct0101', weight: 1, duration: 3.333329916 }] }, seeded(2))
  d.handle({ type: 'start', entry: 'idle' }, 0)
  assert.equal(d.state().idleLoopsWanted, 3)
})

test('borrowed actions are one bag with the own ones: sixteen starts hold each once, none follows itself', () => {
  const pool = defaultPool()
  assert.equal(pool.actions.length, 16)
  const d = createDirector({ actions: pool.actions, idles: [{ id: 'i', weight: 1, duration: 6 }] }, seeded(9))
  const taken: string[] = [played(d.handle({ type: 'start', entry: 'action' }, 0))!]
  for (let n = 1; n < 48; n++) taken.push(played(d.handle({ type: 'tap' }, n * 1000))!)
  for (let n = 1; n < taken.length; n++) assert.notEqual(taken[n], taken[n - 1])
  for (let block = 0; block < 3; block++) assert.deepEqual(new Set(taken.slice(block * 16, block * 16 + 16)).size, 16, `block ${block}`)
})

// ---- setPool (add-lobby-pool-menu) ----

const setPool = (d: ReturnType<typeof createDirector>, actions: string[], now: number, idles: IdleChoice[] = IDLES) => d.handle({ type: 'setPool', actions, idles }, now)

test('setPool: removing the action that plays lets it finish, and it never starts again', () => {
  const d = createDirector(cfg(), seeded(11))
  const first = played(d.handle({ type: 'start', entry: 'action' }, 0))!
  const cmds = setPool(d, ACTIONS.filter((a) => a !== first), 1)
  assert.ok(!types(cmds).includes('playAction'), 'nothing is interrupted')
  assert.equal(d.state().current, first)
  assert.equal(d.state().phase, 'action')
  d.handle({ type: 'actionEnded', id: first }, 5000)
  for (let n = 0; n < 40; n++) assert.notEqual(played(d.handle({ type: 'tap' }, 10_000 + n * 1000)), first)
  assert.ok(!d.state().pool.includes(first))
})

test('setPool: removing the prepared head prepares the new head, and a head that stays prepares nothing', () => {
  const d = createDirector(cfg(), seeded(12))
  const open = d.handle({ type: 'start', entry: 'action' }, 0)
  const head = prepared(open)!
  const kept = setPool(d, ACTIONS.filter((a) => a !== ACTIONS.find((x) => x !== head && x !== played(open))), 1)
  assert.equal(prepared(kept), null, 'removing an action behind the head changes nothing to prepare')
  const cmds = setPool(d, ACTIONS.filter((a) => a !== head && a !== played(open)), 2)
  const next = prepared(cmds)
  assert.ok(next !== null && next !== head)
  const tapped = played(d.handle({ type: 'tap' }, 3000))
  assert.equal(tapped, next, 'the tap starts what was prepared')
})

test('setPool: an added action plays before any action plays twice and never follows the one just taken', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const d = createDirector(cfg({ actions: ['a1', 'a2', 'a3', 'a4'] }), seeded(seed))
    const taken = [played(d.handle({ type: 'start', entry: 'action' }, 0))!]
    setPool(d, ['a1', 'a2', 'a3', 'a4', 'new'], 1)
    for (let n = 1; n < 6; n++) taken.push(played(d.handle({ type: 'tap' }, n * 1000))!)
    assert.ok(taken.slice(0, 5).includes('new'), `seed ${seed}: ${taken.join(',')}`)
    assert.equal(new Set(taken.slice(0, 5)).size, 5, `seed ${seed}: ${taken.join(',')}`)
    for (let n = 1; n < taken.length; n++) assert.notEqual(taken[n], taken[n - 1])
  }
})

test('setPool: an added action does not become the prepared head', () => {
  const d = createDirector(cfg({ actions: ['a1', 'a2', 'a3'] }), seeded(3))
  const open = d.handle({ type: 'start', entry: 'action' }, 0)
  const head = prepared(open)
  assert.equal(prepared(setPool(d, ['a1', 'a2', 'a3', 'n1', 'n2'], 1)), null)
  assert.equal(played(d.handle({ type: 'tap' }, 2000)), head)
})

test('setPool: the idles of the next pick are the new ones, and the idle that plays goes on', () => {
  const d = createDirector(cfg({ actions: [], idles: [{ id: 'ui', weight: 1, duration: 6 }] }), seeded(4))
  d.handle({ type: 'start', entry: 'idle' }, 0)
  assert.equal(d.state().current, 'ui')
  const cmds = setPool(d, [], 1, [{ id: 'other', weight: 1, duration: 6 }])
  assert.deepEqual(cmds, [])
  assert.equal(d.state().current, 'ui')
  assert.deepEqual(d.handle({ type: 'idleLoop', id: 'ui', loops: 1 }, 6000), [])
  const next = d.handle({ type: 'idleLoop', id: 'ui', loops: 2 }, 12_000)
  assert.deepEqual(next, [{ type: 'playIdle', id: 'other' }])
})

test('setPool: an action that failed does not come back with a new pool, until the next start', () => {
  const d = createDirector(cfg({ actions: ['a1', 'a2', 'a3'] }), seeded(6))
  d.handle({ type: 'start', entry: 'idle' }, 0)
  d.handle({ type: 'actionFailed', id: 'a2' }, 1)
  setPool(d, ['a1', 'a2', 'a3', 'a4'], 2)
  assert.deepEqual([...d.state().pool].sort(), ['a1', 'a3', 'a4'])
  d.handle({ type: 'start', entry: 'idle' }, 3)
  assert.deepEqual([...d.state().pool].sort(), ['a1', 'a2', 'a3', 'a4'], 'a start takes the last pool, failed ones included')
})

test('setPool in stopped issues nothing and the next start uses the new lists', () => {
  const d = createDirector(cfg({ actions: ['a1', 'a2'] }), seeded(7))
  assert.deepEqual(setPool(d, ['b1', 'b2', 'b3'], 0, [{ id: 'z', weight: 1, duration: 6 }]), [])
  const open = d.handle({ type: 'start', entry: 'action' }, 1)
  assert.ok(['b1', 'b2', 'b3'].includes(played(open)!))
})

test('setPool to an empty pool: the lobby idles and a tap starts nothing', () => {
  const d = createDirector(cfg(), seeded(8))
  d.handle({ type: 'start', entry: 'action' }, 0)
  assert.deepEqual(setPool(d, [], 1), [])
  assert.deepEqual(d.handle({ type: 'tap' }, 2000), [])
  setPool(d, ['a1'], 3000)
  assert.equal(played(d.handle({ type: 'tap' }, 4000)), 'a1')
})

test('setPool: 300 starts with random pool changes in between never repeat an action back to back', () => {
  const universe = Array.from({ length: 12 }, (_, i) => `x${i}`)
  for (const seed of [1, 2, 3, 4]) {
    const random = seeded(seed * 100)
    const d = createDirector(cfg({ actions: universe.slice(0, 5) }), seeded(seed))
    let last = played(d.handle({ type: 'start', entry: 'action' }, 0))!
    for (let n = 1; n <= 300; n++) {
      if (random() < 0.4) {
        const size = 2 + Math.floor(random() * 10)
        setPool(d, shuffled(universe, random).slice(0, size), n * 1000 - 1)
      }
      const id = played(d.handle({ type: 'tap' }, n * 1000))
      if (id === null) continue
      if (d.state().pool.length > 1) assert.notEqual(id, last, `seed ${seed}, start ${n}`)
      assert.ok(d.state().pool.includes(id), `seed ${seed}, start ${n}: ${id} is not in the pool`)
      last = id
    }
  }
})

// ---- interludes: idles that do not loop (add-lobby-fight-idles) ----

const WIN: IdleChoice = { id: 'win', weight: 1, duration: 5.7, once: true }
const LOOP: IdleChoice = { id: 'loop', weight: 1, duration: 4 }
const playedIdle = (cs: DirectorCommand[]): string | null => {
  const c = cs.find((x) => x.type === 'playIdle')
  return c && c.type === 'playIdle' ? c.id : null
}

test('the Fight idles and shares agreed for Display', () => {
  assert.deepEqual([...LOBBY_FIGHT_IDLES], ['Born', 'Stand1', 'Stand2', 'Standchange', 'Save', 'Win', 'LevelAttack08_NunWalk', 'LevelAttack11_Loop', 'LevelAttack013Loop', 'LevelAttack14'])
  assert.deepEqual({ ...LOBBY_GROUP_SHARES }, { ownFight: 0.6, ownMenu: 0.3, borrowed: 0.1 })
})

test('an interlude plays once: it counts no loops, and its end picks the next idle', () => {
  const e = createDirector(cfg({ actions: [], idles: [WIN] }), seeded(1))
  assert.deepEqual(e.handle({ type: 'start', entry: 'idle' }, 0), [{ type: 'playIdle', id: 'win' }])
  assert.equal(e.state().idleLoopsWanted, 0)
  assert.deepEqual(e.handle({ type: 'idleLoop', id: 'win', loops: 5 }, 1000), [], 'a wrap is not an end for an interlude')
  assert.deepEqual(e.handle({ type: 'idleEnded', id: 'win' }, 6000), [{ type: 'playIdle', id: 'win' }], 'the same interlude again restarts')
  assert.equal(e.state().current, 'win')
  assert.equal(e.state().phase, 'idle')
})

test('after an interlude a looping idle takes over with its own dwell; after a looping idle an interlude takes over', () => {
  const d = createDirector(cfg({ actions: [], idles: [WIN, LOOP] }), seeded(5))
  let current = playedIdle(d.handle({ type: 'start', entry: 'idle' }, 0))!
  let t = 0
  const seen = new Set<string>()
  for (let i = 0; i < 200; i++) {
    t += 10_000
    const cs = current === 'win' ? d.handle({ type: 'idleEnded', id: 'win' }, t) : d.handle({ type: 'idleLoop', id: current, loops: 1 + i }, t)
    const next = playedIdle(cs)
    if (next === null) continue // the same looping idle goes on
    if (next === 'loop') assert.equal(d.state().idleLoopsWanted, loopsFor(4))
    if (next === 'win') assert.equal(d.state().idleLoopsWanted, 0)
    seen.add(`${current}>${next}`)
    current = next
  }
  assert.ok(seen.has('win>loop') && seen.has('loop>win') && seen.has('win>win'), [...seen].join(' '))
})

test('a stale idleEnded (another id, an action, a looping idle) is ignored', () => {
  const d = createDirector(cfg({ idles: [WIN] }), seeded(2))
  d.handle({ type: 'start', entry: 'idle' }, 0)
  assert.deepEqual(d.handle({ type: 'idleEnded', id: 'other' }, 1000), [])
  const tap = d.handle({ type: 'tap' }, 2000)
  assert.equal(d.state().phase, 'action')
  assert.deepEqual(d.handle({ type: 'idleEnded', id: 'win' }, 2100), [], 'the end of the interlude a tap replaced')
  assert.equal(d.state().phase, 'action')
  assert.ok(played(tap))
  const loopy = createDirector(cfg({ actions: [], idles: [LOOP] }), seeded(2))
  loopy.handle({ type: 'start', entry: 'idle' }, 0)
  assert.deepEqual(loopy.handle({ type: 'idleEnded', id: 'loop' }, 1000), [], 'a looping idle does not end')
})

test('a tap during an interlude starts an action; the action ending then idles again', () => {
  const d = createDirector(cfg({ idles: [WIN] }), seeded(7))
  d.handle({ type: 'start', entry: 'idle' }, 0)
  const tap = d.handle({ type: 'tap' }, 1000)
  const id = played(tap)!
  assert.equal(d.state().current, id)
  const ended = d.handle({ type: 'actionEnded', id }, 30_000)
  assert.deepEqual(ended.filter((c) => c.type === 'playIdle'), [{ type: 'playIdle', id: 'win' }])
  assert.equal(d.state().idleLoopsWanted, 0)
})

test('setPool during an interlude lets it end, and the next pick uses the new idles', () => {
  const d = createDirector(cfg({ actions: [], idles: [WIN] }), seeded(4))
  d.handle({ type: 'start', entry: 'idle' }, 0)
  d.handle({ type: 'setPool', actions: [], idles: [LOOP] }, 1000)
  assert.equal(d.state().current, 'win')
  assert.deepEqual(d.handle({ type: 'idleEnded', id: 'win' }, 6000), [{ type: 'playIdle', id: 'loop' }])
  assert.equal(d.state().idleLoopsWanted, loopsFor(4))
})

test('with no idles an idleEnded does nothing', () => {
  const d = createDirector(cfg({ actions: [], idles: [WIN] }), seeded(4))
  d.handle({ type: 'start', entry: 'idle' }, 0)
  d.handle({ type: 'setPool', actions: [], idles: [] }, 100)
  assert.deepEqual(d.handle({ type: 'idleEnded', id: 'win' }, 6000), [])
})

test('an idle that fails to play leaves the idles until the next start and another is picked; setPool does not bring it back', () => {
  const d = createDirector(cfg({ actions: [], idles: [WIN, LOOP] }), seeded(6))
  const first = playedIdle(d.handle({ type: 'start', entry: 'idle' }, 0))!
  const other = first === 'win' ? 'loop' : 'win'
  assert.deepEqual(d.handle({ type: 'idleFailed', id: first }, 500).filter((c) => c.type === 'playIdle'), [{ type: 'playIdle', id: other }])
  assert.equal(d.state().current, other)
  d.handle({ type: 'setPool', actions: [], idles: [WIN, LOOP] }, 600)
  for (let i = 0; i < 40; i++) {
    const cs = other === 'win' ? d.handle({ type: 'idleEnded', id: other }, 1000 + i) : d.handle({ type: 'idleLoop', id: other, loops: 3 + i }, 1000 + i)
    assert.notEqual(playedIdle(cs), first)
  }
  // a stale failure only marks the idle; a failure with nothing left to play changes nothing
  const e = createDirector(cfg({ actions: [], idles: [LOOP] }), seeded(1))
  e.handle({ type: 'start', entry: 'idle' }, 0)
  assert.deepEqual(e.handle({ type: 'idleFailed', id: 'loop' }, 100), [])
  assert.equal(e.state().phase, 'idle')
  // a new start gives the failed idle another chance
  assert.equal(playedIdle(e.handle({ type: 'start', entry: 'idle' }, 200)), 'loop')
})

// ---- no sleep (port-pgr-updates, from PGR's remove-lobby-sleep) ----

test('with no input at all the idles go on: 500 dwell ends hours apart still pick an idle, and the director stays in idle', () => {
  const d = createDirector(cfg(), seeded(3))
  d.handle({ type: 'start', entry: 'idle' }, 0)
  for (let n = 1; n <= 500; n++) {
    const current = d.state().current!
    const cmds = d.handle({ type: 'idleLoop', id: current, loops: d.state().idleLoopsWanted }, n * 3_600_000)
    assert.equal(d.state().phase, 'idle', `after dwell ${n}`)
    assert.ok(d.state().current !== null)
    assert.ok(!types(cmds).some((t) => String(t).includes('sleep')), 'no sleep command exists')
  }
  // and a tap after all that starts an action as ever
  assert.ok(played(d.handle({ type: 'tap' }, 501 * 3_600_000)) !== null)
})
