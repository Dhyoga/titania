import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ClipCache } from '../lib/viewer/ClipCache.ts'

function make(budget: number, protectedKey: string | null = null) {
  const evicted: string[] = []
  const state = { protectedKey }
  const cache = new ClipCache<string>({
    budgetBytes: budget,
    isProtected: (key) => key === state.protectedKey,
    onEvict: (key) => evicted.push(key),
  })
  return { cache, evicted, state }
}

test('keeps entries within the budget', () => {
  const { cache, evicted } = make(100)
  cache.set('a', 'A', 40)
  cache.set('b', 'B', 40)
  assert.equal(cache.bytes, 80)
  assert.deepEqual(evicted, [])
  cache.set('c', 'C', 40)
  assert.deepEqual(evicted, ['a'])
  assert.equal(cache.bytes, 80)
  assert.equal(cache.has('a'), false)
  assert.equal(cache.size, 2)
})

test('get marks an entry as recently used', () => {
  const { cache, evicted } = make(100)
  cache.set('a', 'A', 40)
  cache.set('b', 'B', 40)
  assert.equal(cache.get('a'), 'A')
  cache.set('c', 'C', 40)
  assert.deepEqual(evicted, ['b'])
  assert.equal(cache.get('missing'), undefined)
})

test('never evicts the protected entry', () => {
  const { cache, evicted } = make(100, 'a')
  cache.set('a', 'A', 60)
  cache.set('b', 'B', 30)
  cache.set('c', 'C', 30)
  assert.deepEqual(evicted, ['b'])
  assert.equal(cache.has('a'), true)
  assert.equal(cache.bytes, 90)
})

test('a clip over the budget stays while it is the only entry, and goes once it is unprotected', () => {
  const { cache, evicted, state } = make(100, 'big')
  cache.set('big', 'BIG', 150)
  assert.equal(cache.has('big'), true)
  assert.equal(cache.bytes, 150)
  state.protectedKey = null
  cache.set('small', 'S', 10)
  assert.deepEqual(evicted, ['big'])
  assert.equal(cache.bytes, 10)
})

test('the entry just added is kept even when everything else is protected', () => {
  const { cache, evicted } = make(10, 'a')
  cache.set('a', 'A', 8)
  cache.set('b', 'B', 8)
  assert.deepEqual(evicted, [])
  assert.equal(cache.size, 2)
})

test('replacing a key releases the old value and fixes the byte count', () => {
  const { cache, evicted } = make(100)
  cache.set('a', 'A1', 50)
  cache.set('a', 'A2', 20)
  assert.deepEqual(evicted, ['a'])
  assert.equal(cache.bytes, 20)
  assert.equal(cache.get('a'), 'A2')
})

test('clear forgets everything without eviction callbacks', () => {
  const { cache, evicted } = make(100)
  cache.set('a', 'A', 40)
  cache.clear()
  assert.equal(cache.size, 0)
  assert.equal(cache.bytes, 0)
  assert.deepEqual(evicted, [])
})
