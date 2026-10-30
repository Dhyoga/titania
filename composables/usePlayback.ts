import { computed, onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import { buildCatalog, hiddenNodesFor, resolveFightIdle, withSources, type AnimationSource, type Catalog, type CatalogItem, type ContextId } from '~/lib/anim/catalog'
import type { Clip } from '~/lib/anim/clip'
import type { AnimManifest, ClipEntry } from '~/lib/anim/manifest'
import { loadClip, loadGlbJson, loadManifest } from '~/lib/anim/loader'
import { resolveClipPath, targetModelPath } from '~/lib/anim/paths'
import { retargetClip } from '~/lib/anim/retarget'
import { rigFromGltf, type Rig } from '~/lib/anim/rig'
import { assetUrl } from '~/lib/assets'
import { FRAMES } from '~/lib/constructs'
import type { PlaybackState } from '~/lib/viewer/Playback'
import type { PlayClipOptions, VoiceOptions } from '~/lib/viewer/Viewer'
import { MediaClock } from '~/lib/voice/MediaClock'
import { buildCues, cueAt, type Cue } from '~/lib/voice/subtitles'
import { voiceTimeline } from '~/lib/voice/timeline'
import { parseVoices, voiceAudioPath, voiceFor, type Voices } from '~/lib/voice/voices'
import { loadVoiceLine, type LineBytes, type VoiceLine } from './voiceLine'
import type { ViewerSession } from './useViewer'

/** The id of a list item (`CatalogItem.id`), or `bind` for the model without any clip. */
export type Selection = string

/**
 * How a `select` ended: `started` (with the viewer's cache key of the clip that plays, which names it in the viewer's state events),
 * `superseded` (a newer choice or a new model won; nothing is wrong) or `failed` (the message is in `error`).
 */
export interface SelectResult {
  status: 'started' | 'superseded' | 'failed'
  key?: string
}

/** The next item, ready to start without a request: its line decoded (its clip and the idle clip are in the viewer's cache). */
interface Prepared {
  id: Selection
  line: VoiceLine | null
}
interface Preparing {
  id: Selection
  controller: AbortController
  promise: Promise<void>
}

/** An item of either list, with the list it is in. */
export interface LobbyItem {
  item: CatalogItem
  context: ContextId
}

/** The shown model's own idle clip, or the idle of the frame a lent action comes from: what a voiced timeline falls back on. */
interface IdleRequest {
  key: string
  entry: ClipEntry
  rootNode: number
  /** The decoded clip, ready for the shown model (null when `key` is already cached). */
  load: (signal: AbortSignal) => Promise<Clip | null>
}

/** Seconds per step of the frame-step shortcuts; the clips are keyed at 30 fps. */
const FRAME_STEP = 1 / 30
const BIND = 'bind'
const isAbort = (err: unknown): boolean => err instanceof DOMException && err.name === 'AbortError'

/** What a clip needs to be played: its entry, how to get it built for the shown model, and its voice line if any. */
interface PlayRequest {
  id: string
  key: string
  entry: ClipEntry
  /** The decoded clip, ready for the shown model (null when `key` is already cached). */
  load: (signal: AbortSignal) => Promise<Clip | null>
  /** Asset URL and transcript of the paired line. */
  line?: { url: string; text: string | undefined }
}

/**
 * Animation state for the panel: which clip is chosen, loading it, and the plain values the controls show. Besides the shown frame's
 * own clips the list offers the other frames' (retargeted onto the shown model, with their own voice lines). All three.js work stays in
 * the `Viewer`; this only calls its playback API and mirrors its state events. `takeOver` says that something else (Display's lobby
 * director) chooses what a new model plays: `begin` then does nothing, instead of taking up the remembered clip (Playground).
 */
export function usePlayback(session: Ref<ViewerSession | null>, options: { takeOver?: () => boolean } = {}) {
  const context = ref<ContextId>('menu')
  const selected = ref<Selection | null>(null)
  /** Item being fetched; the previous clip keeps playing meanwhile. */
  const pending = ref<Selection | null>(null)
  const error = ref('')
  const playing = ref(false)
  const time = ref(0)
  const duration = ref(0)
  const loop = ref(true)

  /** Every frame's lent clip sets and voice pairing, read once (plain data, kept shallow). */
  const lent = shallowRef<AnimationSource[]>([])
  const voicesByFrame = shallowRef<ReadonlyMap<string, Voices>>(new Map())
  /** Subtitle cues of the voice line playing with the selected clip; null when there is none. Plain data, kept shallow. */
  const cues = shallowRef<Cue[] | null>(null)

  /** Set once every frame's data has been read: until then a frame with no clip set of its own has no sources yet, which is not "no animations". */
  const framesRead = ref(false)

  /** The shown model can play something: it has a clip set of its own, or at least one other frame lends it clips. */
  const canPlay = (s: ViewerSession | null): s is ViewerSession => s !== null && (s.manifest !== null || lent.value.some((l) => l.frame !== s.construct.id))

  /** The shown skin's list for a context: its own clips and the other frames' (`withSources`). */
  function catalogOf(ctx: ContextId): Catalog | null {
    const current = session.value
    if (!current) return null
    const frame = current.construct.id
    const others = lent.value.filter((s) => s.frame !== frame)
    // A frame with no clip set of its own (Erza) has no own groups: its list is the sources' groups only.
    if (!current.manifest) return withSources(null, others, ctx)
    return withSources(buildCatalog(current.manifest, ctx), others, ctx, lent.value.find((s) => s.frame === frame))
  }
  const catalog = computed<Catalog | null>(() => catalogOf(context.value))
  const items = computed(() => new Map((catalog.value?.groups ?? []).flatMap((g) => g.items).map((i) => [i.id, i])))
  /**
   * The items of both lists, Menu and Fight, tagged with the list they come from, whatever the current context is: what Display chooses
   * from (its idles are Menu and Fight clips). Ids do not collide (a clip index belongs to one clip, and the lists hold different clips).
   */
  const lobbyItems = computed(() => {
    const map = new Map<string, LobbyItem>()
    for (const ctx of ['menu', 'fight'] as const) {
      let list: Catalog | null = null
      try {
        list = catalogOf(ctx)
      } catch (err) {
        console.warn(`Display cannot list the ${ctx} clips (${err instanceof Error ? err.message : String(err)})`)
      }
      for (const group of list?.groups ?? []) for (const item of group.items) map.set(item.id, { item, context: ctx })
    }
    return map
  })
  /** An item of the current list, else one of the other list (Display's Fight clips while the context is Menu), with the list it is in. */
  function find(id: Selection): LobbyItem | null {
    const here = items.value.get(id)
    return here ? { item: here, context: context.value } : (lobbyItems.value.get(id) ?? null)
  }
  /** Voice pairing of the frame an item comes from. */
  const voicesOf = (item: CatalogItem): Voices | undefined => voicesByFrame.value.get(item.source?.frame ?? session.value?.construct.id ?? '')
  /** Items in the current list that play with a voice line (Menu only). */
  const voiced = computed(() => {
    const set = new Set<string>()
    if (context.value !== 'menu') return set
    for (const item of items.value.values()) {
      const v = voicesOf(item)
      if (v && voiceFor(v, item.name)) set.add(item.id)
    }
    return set
  })
  /** Menu items that play with a voice line, whatever the current context is (Display's pool is read from the Menu list). */
  const lobbyVoiced = computed(() => {
    const set = new Set<string>()
    for (const { item, context: ctx } of lobbyItems.value.values()) {
      const v = ctx === 'menu' ? voicesOf(item) : undefined
      if (v && voiceFor(v, item.name)) set.add(item.id)
    }
    return set
  })
  /** The subtitle to show now: the cue at the timeline time (the voice's own time), or null. */
  const subtitle = computed(() => (cues.value ? (cueAt(cues.value, time.value)?.text ?? null) : null))
  const isBindPose = computed(() => selected.value === BIND)
  /** The controls (play, scrubber, loop) work only with a clip selected. */
  const hasClip = computed(() => selected.value !== null && selected.value !== BIND)

  /** The last selection that took effect, restored on the next skin or frame by its frame and name (see `begin`). */
  let remembered: { context: ContextId; clip: { frame: string; name: string; label: string } | 'bind' } | null = null
  let unsubscribe: (() => void) | null = null
  let loadAbort: AbortController | null = null
  let resumeAfterScrub = false
  /** What the user chose with the loop toggle; null until they touch it. Once set it applies to every clip chosen afterwards. */
  let loopChoice: boolean | null = null
  /** Compressed bytes of lines already fetched, by URL. Decoded lines are not kept. */
  const audioBytes: LineBytes = new Map()
  /**
   * The shown model's idle clip for a context (by its asset URL), decoded once: a lent clip leaves the bones the source does not drive
   * (the dress's front panel, repair and twist bones) in this pose instead of the bind pose.
   */
  const fillClips = new Map<string, Promise<Clip>>()
  /** The one prepared item (see `prepare`) and the preparing in flight. */
  let prepared: Prepared | null = null
  let preparing: Preparing | null = null
  /** Rigs of the models the lent clip sets were made for (by frame and model path), read from their GLB's JSON chunk on first use. */
  const rigs = new Map<string, Promise<Rig>>()
  let frameData: Promise<void> | null = null

  /** Read every frame's lent clip sets and `voices.json`, once. A frame that fails lends nothing (or plays silently); nothing throws. */
  function loadFrameData(): Promise<void> {
    frameData ??= Promise.all(
      FRAMES.map(async (frame) => {
        const src = frame.animationSource
        // No clip set of its own: nothing to lend, and no voice lines either (so no request, no warning in the console).
        if (!src) return { frame: frame.id, source: null, voices: null }
        let source: AnimationSource | null = null
        try {
          const read = (path: string) => loadManifest(assetUrl(frame.id, path))
          const [manifest, ...extras] = await Promise.all([read(src.manifest), ...src.extras.map((e) => read(e.manifest))])
          source = {
            frame: frame.id,
            label: frame.displayName,
            manifestPath: src.manifest,
            manifest: manifest!,
            extras: src.extras.map((e, i) => ({ manifestPath: e.manifest, manifest: extras[i]!, clips: e.clips, label: e.label, replace: e.replace })),
          }
        } catch (err) {
          console.warn(`${frame.displayName} lends no clips (${err instanceof Error ? err.message : String(err)})`)
        }
        let voices: Voices | null = null
        const url = assetUrl(frame.id, 'voices.json')
        try {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          voices = parseVoices(await res.json())
        } catch (err) {
          console.warn(`No voice lines: could not read ${url} (${err instanceof Error ? err.message : String(err)})`)
        }
        return { frame: frame.id, source, voices }
      }),
    ).then((results) => {
      lent.value = results.flatMap((r) => (r.source ? [r.source] : []))
      voicesByFrame.value = new Map(results.flatMap((r) => (r.voices ? [[r.frame, r.voices] as const] : [])))
      framesRead.value = true
    })
    return frameData
  }

  function rigOf(frame: string, modelPath: string, signal: AbortSignal): Promise<Rig> {
    const key = `${frame}/${modelPath}`
    let rig = rigs.get(key)
    if (!rig) {
      rig = loadGlbJson(assetUrl(frame, modelPath)).then(rigFromGltf)
      rig.catch(() => rigs.delete(key)) // a failed read is retried next time
      rigs.set(key, rig)
    }
    return signal.aborted ? Promise.reject(new DOMException('Load was aborted', 'AbortError')) : rig
  }

  /** The shown model's own idle clip, read once per URL; a failed read is not kept (the lent clip then plays without the fill). */
  function fillClip(url: string, name: string, signal: AbortSignal): Promise<Clip | undefined> {
    let clip = fillClips.get(url)
    if (!clip) {
      clip = loadClip(url, name, { signal })
      clip.catch(() => fillClips.delete(url))
      fillClips.set(url, clip)
    }
    return clip.catch((err) => {
      if (signal.aborted) throw err
      console.warn(`Lent clip plays without the idle pose fill (${err instanceof Error ? err.message : String(err)})`)
      return undefined
    })
  }

  function applyState(state: PlaybackState): void {
    playing.value = state.playing
    time.value = state.time
    duration.value = state.duration
    loop.value = state.loop
  }

  function cancelLoad(): void {
    loadAbort?.abort()
    loadAbort = null
    pending.value = null
  }

  /** The manifest a lent item's clip index refers to (its frame's Generic set, or one of its extras). */
  function sourceManifestOf(item: CatalogItem): AnimManifest | undefined {
    if (!item.source) return undefined
    const { frame, manifestPath } = item.source
    const source = lent.value.find((s) => s.frame === frame)
    return manifestPath === source?.manifestPath ? source.manifest : source?.extras?.find((e) => e.manifestPath === manifestPath)?.manifest
  }

  /** Name, frame, length and loop flag of an item of the current list, own or lent; null when the list has no such item. */
  function itemInfo(id: Selection): { name: string; frame: string; duration: number; loop: boolean } | null {
    const current = session.value
    if (!current) return null
    const item = find(id)?.item
    if (!item) return null
    const entry = item.source ? sourceManifestOf(item)?.clips[item.clip] : current.manifest?.clips[item.clip]
    if (!entry) return null
    return { name: item.name, frame: item.source?.frame ?? current.construct.id, duration: entry.duration, loop: entry.loop }
  }

  /** The wiki title of the voice line that plays with an item (its own frame's: "General Greeting 12"), or null when it has none. */
  function lineTitle(id: Selection): string | null {
    const item = find(id)?.item
    const voices = item ? voicesOf(item) : undefined
    return (item && voices ? voiceFor(voices, item.name)?.title : undefined) ?? null
  }

  /**
   * The clip's root node: a lent clip carries the shown model's node indices, so the shown model's root rule applies: its idle clip's root, or
   * for a model with no clip set of its own the shown rig's `Bip001` (the pelvis, whose position track is its height).
   */
  function rootNodeOf(current: ViewerSession, item: CatalogItem, req: PlayRequest): number {
    const { manifest } = current
    if (!item.source) return req.entry.rootNode
    if (manifest) return manifest.clips[manifest.contexts.menu.idle.clip]?.rootNode ?? req.entry.rootNode
    return current.viewer.getRig()?.byName.get('Bip001') ?? req.entry.rootNode
  }

  /** Nodes hidden for a context and clip name: the manifest's rule, or none for a model with no manifest (only the user hides parts). */
  function hiddenFor(current: ViewerSession, ctx: ContextId, clipName: string | null): number[] {
    return current.manifest ? hiddenNodesFor(current.manifest, ctx, clipName) : []
  }

  /** The voice line of a Board action in the Menu list (its own frame's), or null; a Fight clip has none. */
  function lineOf(current: ViewerSession, item: CatalogItem, name: string, ctx: ContextId): { url: string; text: string | undefined } | null {
    const voices = ctx === 'menu' ? voicesOf(item) : undefined
    const line = voices ? voiceFor(voices, name) : undefined
    if (!voices || !line) return null
    const origin = item.source?.frame ?? current.construct.id
    return { url: assetUrl(origin, voiceAudioPath(voices, line)), text: line.text }
  }

  /**
   * What a voiced timeline falls back on when the line outlasts the clip: the shown model's own Menu idle clip, or, for a model with no clip
   * set of its own, the Menu idle (`UiStand1`) of the frame the action comes from, retargeted onto the shown model like any lent clip.
   */
  function idleOf(current: ViewerSession, item: CatalogItem): IdleRequest | null {
    const { viewer, manifest, manifestPath, construct } = current
    if (manifest && manifestPath) {
      const index = manifest.contexts.menu.idle.clip
      const entry = manifest.clips[index]!
      const key = `${construct.id}/${manifestPath}#${index}`
      const url = assetUrl(construct.id, resolveClipPath(manifestPath, entry.file))
      return { key, entry, rootNode: entry.rootNode, load: (signal) => (viewer.hasClip(key) ? Promise.resolve(null) : loadClip(url, entry.name, { signal })) }
    }
    const lender = lent.value.find((s) => s.frame === item.source?.frame)
    if (!lender) return null
    const idleItem = lobbyItems.value.get(`${lender.frame}:${lender.manifestPath}#${lender.manifest.contexts.menu.idle.clip}`)?.item
    const req = idleItem ? request(current, idleItem, 'menu') : null
    return idleItem && req ? { key: req.key, entry: req.entry, rootNode: rootNodeOf(current, idleItem, req), load: req.load } : null
  }

  /** How to play `item` on the shown model: its own clip, or another frame's clip retargeted (the key names the frame and the skin). */
  function request(current: ViewerSession, item: CatalogItem, ctx: ContextId): PlayRequest | null {
    const { viewer, manifest, manifestPath, construct, skin } = current
    if (!item.source) {
      const entry = manifest?.clips[item.clip]
      if (!manifest || !manifestPath) return null
      if (!entry) return null
      // The frame is part of the key: every frame has an `anim/manifest.json`, so the path alone does not name a clip.
      const key = `${construct.id}/${manifestPath}#${item.clip}`
      const url = assetUrl(construct.id, resolveClipPath(manifestPath, entry.file))
      return { id: item.id, key, entry, load: (signal) => (viewer.hasClip(key) ? Promise.resolve(null) : loadClip(url, entry.name, { signal })) }
    }
    const { frame, manifestPath: sourcePath } = item.source
    const sourceManifest = sourceManifestOf(item)
    const entry = sourceManifest?.clips[item.clip]
    if (!entry) return null
    // The fill pose depends on the shown skin and the list the clip is in, so the key names both.
    const key = `${frame}/${sourcePath}#${item.clip}@${construct.id}/${skin.id}/${ctx}`
    const url = assetUrl(frame, resolveClipPath(sourcePath, entry.file))
    // The fill pose is the shown model's own idle clip; a model with no clip set of its own has none, so what the sources do not drive keeps its bind pose.
    const idleEntry = manifest?.clips[ctx === 'menu' ? manifest.contexts.menu.idle.clip : resolveFightIdle(manifest)]
    const idleUrl = idleEntry && manifestPath ? assetUrl(construct.id, resolveClipPath(manifestPath, idleEntry.file)) : null
    return {
      id: item.id,
      key,
      entry,
      load: async (signal) => {
        if (viewer.hasClip(key)) return null
        const target = viewer.getRig()
        if (!target) throw new Error('The shown model has no rig to play other frames’ clips on')
        // The clips address the node indices of their manifest's target model, so its rig is the source (not the frame's Generic one).
        const [clip, rig, fill] = await Promise.all([
          loadClip(url, entry.name, { signal }),
          rigOf(frame, targetModelPath(sourceManifest.target), signal),
          idleEntry && idleUrl ? fillClip(idleUrl, idleEntry.name, signal) : Promise.resolve(undefined),
        ])
        return retargetClip(clip, rig, target, { fill, contact: true })
      },
    }
  }

  /**
   * `loop` overrides the loop choice for this clip (the lobby director's idles loop and its actions end, whatever the user chose).
   * `look: 'menuIdle'` shows the meshes the shown skin's rule gives its Menu idle instead of the rule of the list the clip is in (Display
   * plays Fight clips that way, so no mesh appears or goes at a crossfade with a Menu clip). An item of the other list than the current
   * one can be selected (Display's Fight clips); it plays with the rules of its own list.
   */
  async function select(choice: Selection, play: { loop?: boolean; look?: 'menuIdle' } = {}): Promise<SelectResult> {
    const current = session.value
    if (!canPlay(current)) return { status: 'failed' }
    const { viewer } = current
    cancelLoad()
    error.value = ''

    if (choice === BIND) {
      viewer.bindPose(hiddenFor(current, context.value, null))
      cues.value = null
      selected.value = BIND
      return { status: 'started' }
    }

    const found = find(choice)
    const item = found?.item
    const req = found ? request(current, found.item, found.context) : null
    if (!found || !item || !req) return { status: 'failed' }
    const options: PlayClipOptions = {
      rootNode: rootNodeOf(current, item, req),
      loop: play.loop ?? loopChoice ?? req.entry.loop,
      // Visibility follows the shown skin's rule for a clip of that name (Board action names are shared by every frame), or its Menu idle's.
      hiddenNodes: play.look === 'menuIdle' && current.manifest ? hiddenFor(current, 'menu', current.manifest.clips[current.manifest.contexts.menu.idle.clip]!.name) : hiddenFor(current, found.context, req.entry.name),
    }
    const line = lineOf(current, item, req.entry.name, found.context)
    if (line) return playVoiced(current, item, { ...req, line }, options)

    const controller = new AbortController()
    loadAbort = controller
    pending.value = choice
    try {
      if (preparing?.id === choice) await preparing.promise // a clip that is being prepared is not loaded twice
      if (controller.signal.aborted || session.value !== current) return { status: 'superseded' } // a newer selection (or a new model) won
      const clip = await req.load(controller.signal)
      if (controller.signal.aborted || session.value !== current) return { status: 'superseded' }
      if (clip) viewer.playClip(req.key, clip, options)
      else viewer.playCachedClip(req.key, options)
      cues.value = null
      selected.value = choice
      return { status: 'started', key: req.key }
    } catch (err) {
      if (controller.signal.aborted) return { status: 'superseded' }
      error.value = err instanceof Error ? err.message : String(err) // names the clip URL; the previous clip keeps playing
      return { status: 'failed' }
    } finally {
      if (loadAbort === controller) {
        loadAbort = null
        pending.value = null
      }
    }
  }

  /**
   * A Board action with a voice line: the clip, the shown model's idle clip (the tail when the line is longer) and the line load
   * together (one abort for all), unless `prepare` has them ready. The line is optional: if it cannot be fetched, decoded or heard,
   * the clip plays without one.
   */
  async function playVoiced(current: ViewerSession, item: CatalogItem, req: PlayRequest & { line: NonNullable<PlayRequest['line']> }, options: PlayClipOptions): Promise<SelectResult> {
    const { viewer } = current
    const idle = idleOf(current, item)
    if (!idle) {
      error.value = `No idle clip to follow ${req.entry.name} with`
      return { status: 'failed' }
    }
    const controller = new AbortController()
    loadAbort = controller
    pending.value = req.id
    let line: VoiceLine | null = null // released unless it is handed to a clock
    try {
      if (preparing?.id === req.id) await preparing.promise // a line that is being prepared is not loaded twice
      if (controller.signal.aborted || session.value !== current) return { status: 'superseded' }
      const taken = prepared?.id === req.id ? prepared.line : null
      if (prepared?.id === req.id) prepared = null // the slot's line is ours now (released below unless a clock takes it)
      line = taken
      const [clip, idleClip, loaded] = await Promise.all([
        req.load(controller.signal),
        idle.load(controller.signal),
        taken
          ? Promise.resolve(taken)
          : loadVoiceLine(req.line.url, audioBytes, controller.signal).catch((err: unknown) => {
              if (!isAbort(err)) console.warn(`Voice line ${req.line.url} unavailable (${err instanceof Error ? err.message : String(err)}); ${req.entry.name} plays without sound`)
              return null
            }),
      ])
      line = loaded
      if (controller.signal.aborted || session.value !== current) return { status: 'superseded' } // a newer selection (or a new model) won
      if (idleClip) viewer.cacheClip(idle.key, idleClip, { rootNode: idle.rootNode })

      let voice: VoiceOptions | undefined
      let lineCues: Cue[] | null = null
      if (line) {
        const { el, duration, speech, release } = line
        if (req.line.text) lineCues = buildCues(req.line.text, duration, speech)
        const timeline = voiceTimeline({ clipDuration: req.entry.duration, audioDuration: duration, idleDuration: idle.entry.duration })
        voice = {
          clock: new MediaClock(el, {
            duration: timeline.duration,
            audioDuration: duration,
            loop: options.loop,
            onSilent: (reason) => console.warn(`Voice line ${req.line.url} could not start (${reason}); ${req.entry.name} runs without sound`),
            release,
          }),
          timeline,
          idle: { key: idle.key, hiddenNodes: hiddenFor(current, 'menu', idle.entry.name) },
        }
        line = null // the clock owns it now (the viewer disposes the clock, which releases the line)
      }
      if (clip) viewer.playClip(req.key, clip, { ...options, voice })
      else viewer.playCachedClip(req.key, { ...options, voice })
      cues.value = lineCues && lineCues.length > 0 ? lineCues : null
      selected.value = req.id
      return { status: 'started', key: req.key }
    } catch (err) {
      if (controller.signal.aborted) return { status: 'superseded' }
      error.value = err instanceof Error ? err.message : String(err) // a clip failed: names its URL; the previous clip keeps playing
      return { status: 'failed' }
    } finally {
      line?.release()
      if (loadAbort === controller) {
        loadAbort = null
        pending.value = null
      }
    }
  }

  /**
   * Get an item ready to start without a request: its clip and the shown model's idle clip built into the viewer's cache, and for a
   * Board action with a line the line fetched, decoded and encoded. There is one slot: preparing another item releases the one before.
   * A failure is only logged (the item then loads when it is started). Menu context only.
   */
  function prepare(id: Selection): Promise<void> {
    const current = session.value
    if (!canPlay(current) || context.value !== 'menu') return Promise.resolve()
    if (prepared?.id === id) return Promise.resolve()
    if (preparing?.id === id) return preparing.promise
    const item = items.value.get(id)
    const req = item ? request(current, item, 'menu') : null
    if (!item || !req) return Promise.resolve()
    releasePrepared()
    const { viewer } = current
    const controller = new AbortController()
    const job: Preparing = { id, controller, promise: Promise.resolve() }
    preparing = job
    job.promise = (async () => {
      let line: VoiceLine | null = null // released unless the slot takes it
      try {
        const voiced = lineOf(current, item, req.entry.name, 'menu')
        const idle = voiced ? idleOf(current, item) : null
        const rootNode = rootNodeOf(current, item, req)
        const [clip, idleClip, loaded] = await Promise.all([
          req.load(controller.signal),
          idle ? idle.load(controller.signal) : Promise.resolve(null),
          voiced ? loadVoiceLine(voiced.url, audioBytes, controller.signal).catch(() => null) : Promise.resolve(null),
        ])
        line = loaded
        if (controller.signal.aborted || session.value !== current || preparing !== job) return
        if (clip) viewer.cacheClip(req.key, clip, { rootNode })
        if (idle && idleClip) viewer.cacheClip(idle.key, idleClip, { rootNode: idle.rootNode })
        prepared = { id, line }
        line = null // the slot owns it now
      } catch (err) {
        if (!isAbort(err)) console.warn(`Could not prepare ${item.name} (${err instanceof Error ? err.message : String(err)}); it loads when it is started`)
      } finally {
        line?.release()
        if (preparing === job) preparing = null
      }
    })()
    return job.promise
  }

  /** Drop what `prepare` holds: stop a preparing in flight and release the prepared line (its blob URL is revoked). */
  function releasePrepared(): void {
    preparing?.controller.abort()
    preparing = null
    prepared?.line?.release()
    prepared = null
  }

  /** Switch to a context and play its default clip. */
  function setContext(next: ContextId): void {
    if (!canPlay(session.value)) return
    context.value = next
    selected.value = null
    const defaultItem = catalog.value?.defaultItem
    if (defaultItem !== undefined) void select(defaultItem)
  }

  /**
   * Switch to the Menu context without playing anything: the catalog (and so `select` and the lobby's pool) is built for the current
   * context, and Playground may have been left in Fight, where Board actions are not listed.
   */
  function useMenuContext(): void {
    if (context.value === 'menu') return
    context.value = 'menu'
    selected.value = null
  }

  /**
   * Leaving Display while one of its Fight clips plays (the context is Menu then): make that clip's list the context, so the player
   * shows it selected, and let that list's rule decide its meshes from now on. Does nothing for a clip of the current list.
   */
  function adoptSelectionContext(): void {
    const current = session.value
    const id = selected.value
    if (!canPlay(current) || id === null || id === BIND) return
    const found = lobbyItems.value.get(id)
    if (!found || found.context === context.value) return
    context.value = found.context
    current.viewer.setHiddenNodes(hiddenFor(current, found.context, found.item.name))
    remembered = { context: found.context, clip: { frame: found.item.source?.frame ?? current.construct.id, name: found.item.name, label: found.item.label } }
  }

  function togglePlay(): void {
    if (!hasClip.value) return
    session.value?.viewer.setPaused(playing.value)
  }

  function toggleLoop(): void {
    if (!hasClip.value) return
    loopChoice = !loop.value
    session.value?.viewer.setLoop(loopChoice)
  }

  function seekStart(): void {
    if (!hasClip.value) return
    resumeAfterScrub = playing.value
    session.value?.viewer.setPaused(true)
  }

  function seek(seconds: number): void {
    if (!hasClip.value) return
    session.value?.viewer.seek(seconds)
    time.value = seconds
  }

  function seekEnd(): void {
    if (resumeAfterScrub) session.value?.viewer.setPaused(false)
    resumeAfterScrub = false
  }

  /** Start the current clip again from 0 and play it (the compact toolbar's reset). */
  function restart(): void {
    const viewer = session.value?.viewer
    if (!viewer || !hasClip.value) return
    viewer.seek(0)
    if (!playing.value) viewer.setPaused(false)
  }

  /** One frame forward (+1) or back (-1). Only while paused. */
  function step(direction: 1 | -1): void {
    if (!hasClip.value || playing.value) return
    const target = Math.min(Math.max(time.value + direction * FRAME_STEP, 0), duration.value)
    seek(target)
  }

  function reset(): void {
    cancelLoad()
    releasePrepared()
    unsubscribe?.()
    unsubscribe = null
    selected.value = null
    cues.value = null
    error.value = ''
    resumeAfterScrub = false
    applyState({ key: null, time: 0, duration: 0, playing: false, loop: true, finished: false, loops: 0 })
  }

  // Remember what the user picked, by the frame it comes from and its name, so the next skin or frame can pick the same.
  watch(selected, (choice) => {
    if (choice === null) return
    if (choice === BIND) {
      remembered = { context: context.value, clip: BIND }
      return
    }
    const item = items.value.get(choice)
    const frame = item?.source?.frame ?? session.value?.construct.id
    if (item && frame) remembered = { context: context.value, clip: { frame, name: item.name, label: item.label } }
  })

  // A new model: the first one opens in Menu with its idle clip; after a skin or frame switch the same context and the same clip
  // (same frame and name: the shown frame's own clip when the clip comes from it, else that frame's lent one), else the context's
  // default clip. A model without clips (the chibi) just stands in its bind pose. The frames' data is read first, so a remembered
  // Board action plays with its line.
  function begin(current: ViewerSession): void {
    if (!canPlay(current)) return
    if (options.takeOver?.()) return // the lobby director starts the first clip
    const want = remembered
    context.value = want?.context ?? 'menu'
    const all = [...items.value.values()]
    let choice: Selection | undefined
    const clip = want?.clip
    if (clip === BIND) choice = BIND
    else if (clip) {
      // Items of that frame: the shown skin's own first, then lent ones (a frame's extra clips are lent to its other skins).
      const ofFrame = (i: CatalogItem) => (i.source?.frame ?? current.construct.id) === clip.frame
      const candidates = all.filter(ofFrame).sort((a, b) => Number(a.source !== null) - Number(b.source !== null))
      choice = (candidates.find((i) => i.label === clip.label) ?? candidates.find((i) => i.name === clip.name))?.id
    }
    const fallback = catalog.value?.defaultItem
    if (choice !== undefined) void select(choice)
    else if (fallback !== undefined) void select(fallback)
  }

  watch(
    session,
    (current) => {
      reset()
      if (!current) return
      unsubscribe = current.viewer.onPlaybackState(applyState)
      void loadFrameData().then(() => session.value === current && begin(current))
    },
    { immediate: true },
  )

  onBeforeUnmount(reset)

  return {
    context,
    catalog,
    voiced,
    lobbyItems,
    lobbyVoiced,
    subtitle,
    selected,
    pending,
    error,
    playing,
    time,
    duration,
    loop,
    isBindPose,
    hasClip,
    ready: computed(() => session.value !== null),
    /** Every frame's clip sets are read: the list is complete (a frame with no clip set of its own has none before). */
    framesRead,
    select,
    setContext,
    useMenuContext,
    adoptSelectionContext,
    itemInfo,
    lineTitle,
    prepare,
    releasePrepared,
    dataReady: loadFrameData,
    togglePlay,
    toggleLoop,
    seekStart,
    seek,
    seekEnd,
    step,
    restart,
  }
}

export type PlaybackApi = ReturnType<typeof usePlayback>
