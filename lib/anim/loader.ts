// Load and decode animation data over fetch. `fetch` can be replaced so this also runs in Node tests.
import { decodeClip, type Clip, type RawClip } from './clip.ts'
import { parseManifest, type AnimManifest } from './manifest.ts'

export interface LoadOptions {
  signal?: AbortSignal
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch
}

const isAbort = (err: unknown): boolean => typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError'

/** Fetch JSON, then build the result from it. Failures say which URL and why; aborts stay aborts. */
async function load<T>(url: string, options: LoadOptions, build: (raw: unknown) => T): Promise<T> {
  const fetcher = options.fetch ?? fetch
  const reason = (err: unknown): string => (err instanceof Error ? err.message : String(err))
  const abort = (err: unknown): Error | null => {
    if (isAbort(err)) return err as Error
    return options.signal?.aborted ? new DOMException('Load was aborted', 'AbortError') : null
  }

  let raw: unknown
  try {
    const res = await fetcher(url, { signal: options.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    raw = await res.json()
  } catch (err) {
    throw abort(err) ?? new Error(`Could not read ${url} (${reason(err)})`)
  }
  try {
    return build(raw)
  } catch (err) {
    throw new Error(`Could not read ${url} (${reason(err)})`)
  }
}

export function loadManifest(url: string, options: LoadOptions = {}): Promise<AnimManifest> {
  return load(url, options, parseManifest)
}

export function loadClip(url: string, name: string, options: LoadOptions = {}): Promise<Clip> {
  return load(url, options, (raw) => decodeClip(raw as RawClip, name))
}

const GLB_MAGIC = 0x46546c67 // 'glTF'
const JSON_CHUNK = 0x4e4f534a // 'JSON'

/**
 * The JSON chunk of a GLB, read from the start of the file and the download stopped there: a model's rig is described in its first
 * 125 to 300 KB, the rest (3.7 to 17 MB of buffers) is not needed. Falls back to reading the whole body when it is not a stream.
 */
export async function loadGlbJson(url: string, options: LoadOptions = {}): Promise<unknown> {
  const fetcher = options.fetch ?? fetch
  let res: Response
  try {
    res = await fetcher(url, { signal: options.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    if (isAbort(err) || options.signal?.aborted) throw isAbort(err) ? err : new DOMException('Load was aborted', 'AbortError')
    throw new Error(`Could not read ${url} (${err instanceof Error ? err.message : String(err)})`)
  }
  const fail = (problem: string): never => {
    throw new Error(`Could not read ${url} (${problem})`)
  }
  let bytes = new Uint8Array(0)
  let needed = 20
  const reader = res.body?.getReader()
  if (!reader) bytes = new Uint8Array(await res.arrayBuffer())
  else {
    while (bytes.length < needed) {
      const { done, value } = await reader.read()
      if (done) break
      const joined = new Uint8Array(bytes.length + value.length)
      joined.set(bytes)
      joined.set(value, bytes.length)
      bytes = joined
      if (needed === 20 && bytes.length >= 20) needed = 20 + new DataView(bytes.buffer).getUint32(12, true)
    }
    void reader.cancel().catch(() => {}) // the rest of the file is not needed
  }
  if (bytes.length < 20) fail('too short for a GLB')
  const view = new DataView(bytes.buffer)
  if (view.getUint32(0, true) !== GLB_MAGIC) fail('not a GLB')
  if (view.getUint32(16, true) !== JSON_CHUNK) fail('the first chunk is not JSON')
  const length = view.getUint32(12, true)
  if (bytes.length < 20 + length) fail('the file ends inside its JSON chunk')
  try {
    return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length)))
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err))
  }
}
