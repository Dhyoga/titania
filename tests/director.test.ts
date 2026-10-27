import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createDirector,
  loopsFor,
  pickWeighted,
  shuffled,
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
  assert.deepEqual({ ...LOBBY_IDLE_WEIGHTS }, { UiStand1: 1 }) // StandAct0101 is not a Display idle on any frame
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

test('sleep: only at an idle wrap, only 120 s after the last input, and an input postpones it', () => {
  const idles: IdleChoice[] = [{ id: 'i', weight: 1, duration: 6 }]
  const d = createDirector(cfg({ actions: [], idles }), seeded(4))
  d.handle({ type: 'start', entry: 'idle' }, 0)
  assert.deepEqual(d.handle({ type: 'idleLoop', id: 'i', loops: 1 }, 119_999), [])
  assert.equal(d.state().phase, 'idle')
  // an input at 110 s moves the deadline to 230 s
  d.handle({ type: 'input' }, 110_000)
  assert.deepEqual(d.handle({ type: 'idleLoop', id: 'i', loops: 3 }, 125_000), [])
  assert.deepEqual(d.handle({ type: 'idleLoop', id: 'i', loops: 5 }, 229_999), [])
  assert.deepEqual(d.handle({ type: 'idleLoop', id: 'i', loops: 6 }, 230_000), [{ type: 'sleep' }])
  assert.equal(d.state().phase, 'asleep')
})

test('sleep never comes during an action, and an action that ended late sleeps at the first idle wrap', () => {
  const idles: IdleChoice[] = [{ id: 'i', weight: 1, duration: 6 }]
  const d = createDirector(cfg({ idles }), seeded(8))
  const open = d.handle({ type: 'start', entry: 'action' }, 0)
  const id = played(open)!
  // an idle wrap reported while an action plays is stale
  assert.deepEqual(d.handle({ type: 'idleLoop', id: 'i', loops: 9 }, 119_000), [])
  assert.equal(d.state().phase, 'action')
  // the 51 s action ends at 150 s: the first idle wrap after that sleeps (more than 120 s without input)
  assert.equal(d.handle({ type: 'actionEnded', id }, 150_000)[0]!.type, 'playIdle')
  assert.deepEqual(d.handle({ type: 'idleLoop', id: 'i', loops: 1 }, 156_000), [{ type: 'sleep' }])
})

test('a tap while asleep wakes first, then starts an action; an input does not wake', () => {
  const idles: IdleChoice[] = [{ id: 'i', weight: 1, duration: 6 }]
  const d = createDirector(cfg({ idles }), seeded(6))
  d.handle({ type: 'start', entry: 'idle' }, 0)
  d.handle({ type: 'idleLoop', id: 'i', loops: 1 }, 121_000)
  assert.equal(d.state().phase, 'asleep')
  assert.deepEqual(d.handle({ type: 'input' }, 122_000), [])
  assert.equal(d.state().phase, 'asleep')
  const wake = d.handle({ type: 'tap' }, 130_000)
  assert.deepEqual(types(wake), ['wake', 'playAction', 'prepare'])
  assert.equal(d.state().phase, 'action')
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

test('an empty pool idles, ignores taps, and a tap while asleep only wakes', () => {
  const idles: IdleChoice[] = [{ id: 'i', weight: 1, duration: 6 }]
  const d = createDirector(cfg({ actions: [], idles }), seeded(1))
  const open = d.handle({ type: 'start', entry: 'action' }, 0)
  assert.deepEqual(open, [{ type: 'playIdle', id: 'i' }])
  assert.deepEqual(d.handle({ type: 'tap' }, 1000), [])
  assert.equal(d.state().phase, 'idle')
  d.handle({ type: 'idleLoop', id: 'i', loops: 1 }, 121_000)
  assert.equal(d.state().phase, 'asleep')
  assert.deepEqual(d.handle({ type: 'tap' }, 130_000), [{ type: 'wake' }])
  assert.equal(d.state().phase, 'idle')
})

test('no idles and no actions: nothing to command, nothing breaks', () => {
  const d = createDirector({ actions: [], idles: [] }, seeded(1))
  assert.deepEqual(d.handle({ type: 'start', entry: 'action' }, 0), [])
  assert.deepEqual(d.handle({ type: 'tap' }, 1000), [])
  assert.deepEqual(d.handle({ type: 'idleLoop', id: 'x', loops: 1 }, 2000), [])
})

test('stop wakes a sleeper, clears the state and makes later events no-ops; start works again', () => {
  const idles: IdleChoice[] = [{ id: 'i', weight: 1, duration: 6 }]
  const d = createDirector(cfg({ idles }), seeded(4))
  d.handle({ type: 'start', entry: 'idle' }, 0)
  d.handle({ type: 'idleLoop', id: 'i', loops: 1 }, 121_000)
  assert.deepEqual(d.handle({ type: 'stop' }, 122_000), [{ type: 'wake' }])
  assert.equal(d.state().phase, 'stopped')
  assert.equal(d.state().current, null)
  assert.deepEqual(d.handle({ type: 'tap' }, 123_000), [])
  assert.deepEqual(d.handle({ type: 'actionEnded', id: 'x' }, 124_000), [])
  assert.deepEqual(d.handle({ type: 'stop' }, 125_000), [])
  // a new start begins afresh: the pool is whole again and the last input is now
  const again = d.handle({ type: 'start', entry: 'action' }, 200_000)
  assert.equal(types(again)[0], 'playAction')
  assert.equal(d.state().pool.length, 6)
})

test('stop while an action plays gives no wake', () => {
  const d = createDirector(cfg(), seeded(4))
  d.handle({ type: 'start', entry: 'action' }, 0)
  assert.deepEqual(d.handle({ type: 'stop' }, 1000), [])
})

test('start resets a pool that lost a failed action and the sleep clock', () => {
  const idles: IdleChoice[] = [{ id: 'i', weight: 1, duration: 6 }]
  const d = createDirector(cfg({ idles }), seeded(4))
  const open = d.handle({ type: 'start', entry: 'action' }, 0)
  d.handle({ type: 'actionFailed', id: played(open)! }, 100)
  assert.equal(d.state().pool.length, 5)
  d.handle({ type: 'start', entry: 'idle' }, 500_000) // a new model: input now
  assert.equal(d.state().pool.length, 6)
  assert.deepEqual(d.handle({ type: 'idleLoop', id: 'i', loops: 1 }, 560_000), [])
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

/** Crepuscule's items as Display resolves them: own clips and Stigmata's / Veritas' (names as in the Menu list). */
function crepusculePool() {
  const names = ['BoardAct0201', 'BoardAct0202', 'BoardAct0203', 'BoardAct1004', 'BoardAct1006', 'BoardAct1007', 'UiStand1', 'StandAct0101']
  const items: PoolItem[] = [
    ...names.map((name, i) => ({ id: `#${i}`, name, frame: null, duration: 10 })),
    ...names.map((name, i) => ({ id: `stigmata:anim/manifest.json#${i}`, name, frame: 'stigmata', duration: 10 })),
    ...names.map((name, i) => ({ id: `veritas:anim/manifest.json#${i}`, name, frame: 'veritas', duration: 10 })),
  ]
  const noLine = (frame: string | null, name: string) => frame === 'veritas' && (name === 'BoardAct0202' || name === 'BoardAct0203')
  const line = (frame: string | null, name: string) => !noLine(frame, name)
  const chosen = new Set(defaultChoice({ actionFrom: ['stigmata', 'veritas'], idleFrom: ['stigmata'] }, listCandidates(items, line, 'crepuscule')))
  return resolvePool(items, line, { frame: 'crepuscule', chosen })
}

test('400 idle picks on Crepuscule\'s weights give 20 % to 30 % borrowed ones', () => {
  const pool = crepusculePool()
  const idles: IdleChoice[] = pool.idles.map((i) => ({ ...i, duration: 20.5667 })) // own and Stigmata's UiStand1
  for (const seed of [1, 2, 3]) {
    const d = createDirector({ actions: pool.actions, idles }, seeded(seed))
    d.handle({ type: 'start', entry: 'idle' }, 0)
    let borrowed = d.state().current!.startsWith('stigmata:') ? 1 : 0
    for (let n = 1; n < 400; n++) {
      // The last loop of the dwell: the director picks the next idle (the same one just goes on looping).
      d.handle({ type: 'idleLoop', id: d.state().current!, loops: d.state().idleLoopsWanted }, n)
      if (d.state().current!.startsWith('stigmata:')) borrowed++
    }
    assert.ok(borrowed >= 80 && borrowed <= 120, `seed ${seed}: ${borrowed} of 400 borrowed`)
  }
})

test('400 idle picks on Crepuscule and on a receiver with its own clips only never name StandAct0101', () => {
  const names = ['UiStand1', 'StandAct0101']
  const own: PoolItem[] = names.map((name, i) => ({ id: `#${i}`, name, frame: null, duration: 6 }))
  const lent: PoolItem[] = names.map((name, i) => ({ id: `stigmata:anim/manifest.json#${i}`, name, frame: 'stigmata', duration: 6 }))
  const nameOf = (id: string) => names[Number(id.slice(id.lastIndexOf('#') + 1))]
  const cases: [PoolItem[], string[]][] = [[[...own, ...lent], ['stigmata:UiStand1', 'stigmata:StandAct0101']], [own, []]]
  for (const [items, chosen] of cases) {
    const pool = resolvePool(items, () => true, { frame: 'crepuscule', chosen: new Set(chosen) })
    const d = createDirector({ actions: [], idles: pool.idles.map((i) => ({ ...i, duration: 6 })) }, seeded(5))
    d.handle({ type: 'start', entry: 'idle' }, 0)
    const picked = new Set([nameOf(d.state().current!)])
    for (let n = 1; n < 400; n++) {
      d.handle({ type: 'idleLoop', id: d.state().current!, loops: d.state().idleLoopsWanted }, n)
      picked.add(nameOf(d.state().current!))
    }
    assert.deepEqual([...picked], ['UiStand1'])
  }
})

test('borrowed actions are one bag with the own ones: sixteen starts hold each once, none follows itself', () => {
  const pool = crepusculePool()
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

test('setPool in stopped issues nothing and the next start uses the new lists; asleep issues nothing either', () => {
  const d = createDirector(cfg({ actions: ['a1', 'a2'] }), seeded(7))
  assert.deepEqual(setPool(d, ['b1', 'b2', 'b3'], 0, [{ id: 'z', weight: 1, duration: 6 }]), [])
  const open = d.handle({ type: 'start', entry: 'action' }, 1)
  assert.ok(['b1', 'b2', 'b3'].includes(played(open)!))
  d.handle({ type: 'actionEnded', id: d.state().current! }, 2)
  d.handle({ type: 'idleLoop', id: 'z', loops: 1 }, 121_000)
  assert.equal(d.state().phase, 'asleep')
  assert.deepEqual(setPool(d, ['b1'], 122_000), [])
  assert.deepEqual(d.state().pool, ['b1'])
  assert.deepEqual(d.handle({ type: 'tap' }, 123_000).map((c) => c.type).slice(0, 2), ['wake', 'playAction'])
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
