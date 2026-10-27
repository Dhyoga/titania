import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadClip, loadGlbJson, loadManifest } from '../lib/anim/loader.ts'

type Fetch = typeof fetch

/** Fake fetch serving a table of url -> body (object = JSON, number = HTTP status). */
function fakeFetch(table: Record<string, unknown>): Fetch {
  return (async (input: unknown, init?: { signal?: AbortSignal }) => {
    const url = String(input)
    const entry = table[url]
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError')
    if (entry === undefined) throw new TypeError('Failed to fetch')
    if (typeof entry === 'number') return { ok: false, status: entry, json: async () => ({}) }
    if (entry === 'badjson') return { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <') } }
    return { ok: true, status: 200, json: async () => entry }
  }) as unknown as Fetch
}

const clipJson = {
  version: 1,
  tracks: [{ node: 3, property: 'position', value: [1, 2, 3] }],
}

const manifestJson = {
  formatVersion: 1,
  target: 't',
  model: 'base.glb',
  defaultContext: 'menu',
  clips: [{ name: 'A', file: 'anim/A.json', duration: 1, frameRate: 30, loop: true, rootNode: 1 }],
  controllers: [],
  contexts: {
    menu: { base: 'b', entry: { clip: 0 }, idle: { clip: 0 }, hiddenNodes: [5], stateHides: {}, mounts: [] },
    fight: { base: 'b', entry: { controller: 'b', layer: 0, state: 'x' }, idle: { controller: 'b', layer: 0, state: 'x' }, hiddenNodes: [], mounts: [] },
  },
}

test('loads and decodes a clip, and loads and parses a manifest, with an injected fetch', async () => {
  const f = fakeFetch({ 'u://clip': clipJson, 'u://manifest': manifestJson })
  const clip = await loadClip('u://clip', 'A', { fetch: f })
  assert.equal(clip.name, 'A')
  assert.deepEqual(Array.from(clip.tracks[0]!.values), [1, 2, 3])
  const manifest = await loadManifest('u://manifest', { fetch: f })
  assert.deepEqual(manifest.contexts.menu.hiddenNodes, [5])
})

test('HTTP errors, network errors and bad JSON name the URL and the reason', async () => {
  const f = fakeFetch({ 'u://missing': 404, 'u://html': 'badjson' })
  await assert.rejects(loadClip('u://missing', 'A', { fetch: f }), (e: Error) => e.message.includes('u://missing') && e.message.includes('404'))
  await assert.rejects(loadClip('u://nowhere', 'A', { fetch: f }), (e: Error) => e.message.includes('u://nowhere') && e.message.includes('Failed to fetch'))
  await assert.rejects(loadManifest('u://html', { fetch: f }), (e: Error) => e.message.includes('u://html') && e.message.includes('Unexpected token'))
})

test('content that does not decode or validate also names the URL and the cause', async () => {
  const f = fakeFetch({ 'u://clip': { version: 3, tracks: [] }, 'u://manifest': { ...manifestJson, contexts: { ...manifestJson.contexts, menu: { ...manifestJson.contexts.menu, hiddenNodes: 'x' } } } })
  await assert.rejects(loadClip('u://clip', 'A', { fetch: f }), (e: Error) => e.message.includes('u://clip') && e.message.includes('unsupported version 3'))
  await assert.rejects(loadManifest('u://manifest', { fetch: f }), (e: Error) => e.message.includes('u://manifest') && e.message.includes('contexts.menu.hiddenNodes'))
})

test('an aborted load rejects with an AbortError, not a load failure', async () => {
  const controller = new AbortController()
  controller.abort()
  const f = fakeFetch({ 'u://clip': clipJson })
  await assert.rejects(loadClip('u://clip', 'A', { fetch: f, signal: controller.signal }), (e: Error) => e.name === 'AbortError' && !/Could not read/.test(e.message))

  // Aborted while the request is in flight: fetch rejects with something that is not an AbortError itself.
  const late = new AbortController()
  const slow = (async () => {
    late.abort()
    throw new TypeError('network error after abort')
  }) as unknown as Fetch
  await assert.rejects(loadManifest('u://manifest', { fetch: slow, signal: late.signal }), (e: Error) => e.name === 'AbortError')
})

test('loadGlbJson reads the JSON chunk and stops the download there', async () => {
  const json = new TextEncoder().encode(JSON.stringify({ nodes: [{ name: 'Bip001' }] }) + '  ')
  const header = new Uint8Array(20)
  const view = new DataView(header.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(12, json.length, true)
  view.setUint32(16, 0x4e4f534a, true)
  const body = new Uint8Array(20 + json.length + 1_000_000) // a large binary chunk after the JSON
  body.set(header)
  body.set(json, 20)
  let pulled = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled >= body.length) return controller.close()
      const chunk = body.subarray(pulled, pulled + 16_384)
      pulled += chunk.length
      controller.enqueue(chunk)
    },
  })
  const fetcher = (async () => new Response(stream)) as unknown as typeof fetch
  const out = (await loadGlbJson('mem://model.glb', { fetch: fetcher })) as { nodes: { name: string }[] }
  assert.equal(out.nodes[0]!.name, 'Bip001')
  assert.ok(pulled < 100_000, `read ${pulled} bytes of ${body.length}`)

  const notGlb = (async () => new Response(new Uint8Array(40))) as unknown as typeof fetch
  await assert.rejects(loadGlbJson('mem://x.glb', { fetch: notGlb }), /x\.glb.*not a GLB/)
  const missing = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch
  await assert.rejects(loadGlbJson('mem://y.glb', { fetch: missing }), /y\.glb.*404/)
})
