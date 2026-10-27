// Least-recently-used cache with a byte budget, for built animation clips. No three.js, no Vue.
//
// A clip that is playing must stay; `isProtected` says which. The cache may then sit above its budget (a single
// clip larger than the budget, for example) until the protected entry is no longer protected and another entry is added.

export interface ClipCacheOptions<T> {
  budgetBytes: number
  /** Entries the cache must keep, e.g. the clip that is playing. */
  isProtected: (key: string) => boolean
  /** Called for each evicted entry, after it has left the cache. */
  onEvict: (key: string, value: T) => void
}

export class ClipCache<T> {
  private readonly entries = new Map<string, { value: T; bytes: number }>() // oldest first
  private total = 0
  private readonly options: ClipCacheOptions<T>

  // No parameter property: Node's type stripping (used by the tests) does not support it.
  constructor(options: ClipCacheOptions<T>) {
    this.options = options
  }

  get bytes(): number {
    return this.total
  }

  get size(): number {
    return this.entries.size
  }

  has(key: string): boolean {
    return this.entries.has(key)
  }

  /** The cached value, marked as most recently used. */
  get(key: string): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }

  /** Add (or replace) an entry as most recently used, then evict oldest entries until the budget holds. */
  set(key: string, value: T, bytes: number): void {
    const old = this.entries.get(key)
    if (old) {
      this.entries.delete(key)
      this.total -= old.bytes
      if (old.value !== value) this.options.onEvict(key, old.value)
    }
    this.entries.set(key, { value, bytes })
    this.total += bytes
    this.evict(key)
  }

  /** Forget everything without calling `onEvict` (the owner is being disposed as a whole). */
  clear(): void {
    this.entries.clear()
    this.total = 0
  }

  private evict(justAdded: string): void {
    for (const [key, entry] of this.entries) {
      if (this.total <= this.options.budgetBytes) return
      if (key === justAdded || this.options.isProtected(key)) continue
      this.entries.delete(key)
      this.total -= entry.bytes
      this.options.onEvict(key, entry.value)
    }
  }
}
