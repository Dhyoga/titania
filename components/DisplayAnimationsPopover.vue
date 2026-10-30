<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { Candidate } from '~/lib/lobby/pool'
import Icon from './Icon.vue'

const props = defineProps<{
  /** Every frame, in the picker's order. */
  frames: { id: string; name: string }[]
  /** The frame Display shows: its Menu animations are always played. */
  displayFrame: string
  /** Everything Display may play on the shown model (own first). */
  candidates: Candidate[]
  /** Keys of the borrowed animations in the pool. */
  chosen: ReadonlySet<string>
  /** Keys of the Display frame's own Fight clips turned off. */
  ownOff: ReadonlySet<string>
  /** The user has chosen for this frame (otherwise the shown choice is the frame's default). */
  saved: boolean
  /** The last write did not stick (storage unavailable or full). */
  saveError: boolean
}>()
const emit = defineEmits<{
  toggle: [key: string]
  toggleOwn: [key: string]
  setFrame: [frame: string, on: boolean, kind: 'menu' | 'fight']
  setOwnFight: [on: boolean]
  useDefault: []
}>()

interface Section {
  id: string
  frame: string
  name: string
  fight: boolean
  /** The Display frame's Menu rows: always played, never checkable. */
  locked: boolean
  /** The first Fight section: it carries the "Fight" heading. */
  firstFight: boolean
  /** The idle first, then the Board actions (Menu); the Fight clips in their order. */
  rows: Candidate[]
  /** Rows in the pool. */
  count: number
}

/** Whether a row is in what Display plays. */
const isOn = (c: Candidate): boolean => (c.own ? c.kind !== 'fight' || !props.ownOff.has(c.key) : props.chosen.has(c.key))

const sections = computed<Section[]>(() => {
  const ordered = [...props.frames.filter((f) => f.id === props.displayFrame), ...props.frames.filter((f) => f.id !== props.displayFrame)]
  const make = (f: { id: string; name: string }, fight: boolean): Section => {
    const rows = props.candidates
      .filter((c) => c.frame === f.id && (c.kind === 'fight') === fight)
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'idle' ? -1 : 1))
    return { id: `${f.id}:${fight ? 'fight' : 'menu'}`, frame: f.id, name: f.name, fight, locked: !fight && f.id === props.displayFrame, firstFight: false, rows, count: rows.filter(isOn).length }
  }
  const fight = ordered.map((f) => make(f, true))
  if (fight[0]) fight[0].firstFight = true
  return [...ordered.map((f) => make(f, false)), ...fight]
})

const actions = computed(() => props.candidates.filter((c) => c.kind === 'action' && isOn(c)).length)
const idles = computed(() => props.candidates.filter((c) => c.kind !== 'action' && isOn(c)).length)

/** Sections start folded, except one that is partly chosen; the user's own folding wins from then on. */
const opened = reactive(new Map<string, boolean>(sections.value.map((s) => [s.id, !s.locked && s.count > 0 && s.count < s.rows.length])))
const isOpen = (id: string): boolean => opened.get(id) ?? false
const fold = (id: string): void => void opened.set(id, !isOpen(id))

/** The section checkbox: the Display frame's own Fight clips are turned off or on, another frame's are chosen or not. */
function setSection(s: Section): void {
  const on = s.count !== s.rows.length
  if (s.fight && s.frame === props.displayFrame) emit('setOwnFight', on)
  else emit('setFrame', s.frame, on, s.fight ? 'fight' : 'menu')
}
/** One row: the Display frame's own Fight clips are turned off or on, another frame's are chosen or not. */
const setRow = (c: Candidate): void => (c.own ? emit('toggleOwn', c.key) : emit('toggle', c.key))

const seconds = (s: number): string => `${s.toFixed(1)} s`
const button = 'w-full rounded-button border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text disabled:opacity-40'
</script>

<template>
  <div class="space-y-2 text-xs text-text">
    <div class="flex items-center justify-between gap-2">
      <p class="font-medium" aria-live="polite">{{ actions }} actions · {{ idles }} {{ idles === 1 ? 'idle' : 'idles' }} in Display</p>
    </div>
    <div class="max-h-[min(24rem,calc(100vh-16rem))] space-y-1 overflow-y-auto pr-1 [color-scheme:dark]">
      <template v-for="s in sections" :key="s.id">
        <p v-if="s.firstFight" class="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Fight</p>
        <section :aria-label="s.fight ? `${s.name} Fight` : s.name">
          <div class="flex items-center gap-1">
            <label v-if="!s.locked" class="flex min-w-0 flex-1 items-center gap-2 rounded-button px-1 py-1.5 text-sm" :class="s.rows.length === 0 && 'opacity-50'">
              <input
                type="checkbox"
                class="size-4 shrink-0 accent-accent"
                :aria-label="`All of ${s.name}${s.fight ? ' (Fight)' : ''}`"
                :checked="s.rows.length > 0 && s.count === s.rows.length"
                :indeterminate="s.count > 0 && s.count < s.rows.length"
                :disabled="s.rows.length === 0"
                @change="setSection(s)"
              />
              <span class="min-w-0 truncate">{{ s.name }}<span v-if="s.frame === displayFrame" class="text-text-muted"> · this model</span></span>
            </label>
            <p v-else class="min-w-0 flex-1 truncate px-1 py-1.5 text-sm">{{ s.name }} <span class="text-text-muted">· this model</span></p>
            <span class="shrink-0 text-text-muted">{{ s.rows.length === 0 ? (s.fight ? 'None' : 'Could not be read') : `${s.count} / ${s.rows.length}` }}</span>
            <button
              type="button"
              class="flex size-7 shrink-0 items-center justify-center rounded-button text-text-muted disabled:opacity-40"
              :aria-label="isOpen(s.id) ? `Collapse ${s.name}${s.fight ? ' (Fight)' : ''}` : `Expand ${s.name}${s.fight ? ' (Fight)' : ''}`"
              :aria-expanded="isOpen(s.id)"
              :disabled="s.rows.length === 0"
              @click="fold(s.id)"
            >
              <Icon name="chevron-down" class="size-4 transition-transform" :class="!isOpen(s.id) && '-rotate-90'" />
            </button>
          </div>
          <ul v-show="isOpen(s.id)" class="space-y-0.5 pl-3">
            <li v-if="s.locked" class="px-1 pb-0.5 text-text-muted">Always played</li>
            <li v-for="c in s.rows" :key="c.key">
              <label class="flex items-start gap-2 rounded-button px-1 py-1" :class="s.locked && 'opacity-70'">
                <input type="checkbox" class="mt-0.5 size-4 shrink-0 accent-accent" :checked="isOn(c)" :disabled="s.locked" @change="setRow(c)" />
                <span class="min-w-0">
                  <!-- Idle rows lead with their clip name (two of them would both read "Idle"); a Board action with its line's title. -->
                  <span class="block truncate">{{ c.kind === 'action' ? (c.title ?? c.name) : c.name }}</span>
                  <span class="block truncate text-text-muted">{{ c.kind === 'action' ? c.name : c.kind === 'fight' ? 'Fight' : 'Idle' }} · {{ seconds(c.duration) }}{{ c.once ? ' · once' : '' }}</span>
                </span>
              </label>
            </li>
          </ul>
        </section>
      </template>
    </div>
    <button type="button" :class="button" :disabled="!saved" @click="emit('useDefault')">Use default</button>
    <p v-if="saveError" role="alert" class="text-red-400">Could not save: storage is unavailable. Changes last until the panel closes.</p>
  </div>
</template>
