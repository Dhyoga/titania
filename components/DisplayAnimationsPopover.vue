<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { Candidate } from '~/lib/lobby/pool'
import Icon from './Icon.vue'

const props = defineProps<{
  /** Every frame, in the picker's order. */
  frames: { id: string; name: string }[]
  /** The frame Display shows: its animations are always played. */
  displayFrame: string
  /** Everything Display may play on the shown model (own first). */
  candidates: Candidate[]
  /** Keys of the borrowed animations in the pool. */
  chosen: ReadonlySet<string>
  /** The user has chosen for this frame (otherwise the shown choice is the frame's default). */
  saved: boolean
  /** The last write did not stick (storage unavailable or full). */
  saveError: boolean
}>()
const emit = defineEmits<{ toggle: [key: string]; setFrame: [frame: string, on: boolean]; useDefault: [] }>()

interface Section {
  id: string
  name: string
  own: boolean
  /** The idle first, then the Board actions. */
  rows: Candidate[]
  /** Rows in the pool. */
  count: number
}

const sections = computed<Section[]>(() => {
  const ordered = [...props.frames.filter((f) => f.id === props.displayFrame), ...props.frames.filter((f) => f.id !== props.displayFrame)]
  return ordered.map((f) => {
    const rows = props.candidates.filter((c) => c.frame === f.id).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'idle' ? -1 : 1))
    const own = f.id === props.displayFrame
    return { id: f.id, name: f.name, own, rows, count: rows.filter((c) => own || props.chosen.has(c.key)).length }
  })
})

const actions = computed(() => sections.value.reduce((n, s) => n + s.rows.filter((c) => c.kind === 'action' && (s.own || props.chosen.has(c.key))).length, 0))
const idles = computed(() => sections.value.reduce((n, s) => n + s.rows.filter((c) => c.kind === 'idle' && (s.own || props.chosen.has(c.key))).length, 0))

/** Sections start folded, except one that is partly chosen; the user's own folding wins from then on. */
const opened = reactive(new Map<string, boolean>(sections.value.map((s) => [s.id, !s.own && s.count > 0 && s.count < s.rows.length])))
const isOpen = (id: string): boolean => opened.get(id) ?? false
const fold = (id: string): void => void opened.set(id, !isOpen(id))

const seconds = (s: number): string => `${s.toFixed(1)} s`
const button = 'w-full rounded-button border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text disabled:opacity-40'
</script>

<template>
  <div class="space-y-2 text-xs text-text">
    <div class="flex items-center justify-between gap-2">
      <p class="font-medium" aria-live="polite">{{ actions }} actions · {{ idles }} {{ idles === 1 ? 'idle' : 'idles' }} in Display</p>
    </div>
    <div class="max-h-[min(24rem,calc(100vh-16rem))] space-y-1 overflow-y-auto pr-1 [color-scheme:dark]">
      <section v-for="s in sections" :key="s.id" :aria-label="s.name">
        <div class="flex items-center gap-1">
          <label v-if="!s.own" class="flex min-w-0 flex-1 items-center gap-2 rounded-button px-1 py-1.5 text-sm" :class="s.rows.length === 0 && 'opacity-50'">
            <input
              type="checkbox"
              class="size-4 shrink-0 accent-accent"
              :aria-label="`All of ${s.name}`"
              :checked="s.rows.length > 0 && s.count === s.rows.length"
              :indeterminate="s.count > 0 && s.count < s.rows.length"
              :disabled="s.rows.length === 0"
              @change="emit('setFrame', s.id, s.count !== s.rows.length)"
            />
            <span class="min-w-0 truncate">{{ s.name }}</span>
          </label>
          <p v-else class="min-w-0 flex-1 truncate px-1 py-1.5 text-sm">{{ s.name }} <span class="text-text-muted">· this model</span></p>
          <span class="shrink-0 text-text-muted">{{ s.rows.length === 0 ? 'Could not be read' : `${s.count} / ${s.rows.length}` }}</span>
          <button
            type="button"
            class="flex size-7 shrink-0 items-center justify-center rounded-button text-text-muted disabled:opacity-40"
            :aria-label="isOpen(s.id) ? `Collapse ${s.name}` : `Expand ${s.name}`"
            :aria-expanded="isOpen(s.id)"
            :disabled="s.rows.length === 0"
            @click="fold(s.id)"
          >
            <Icon name="chevron-down" class="size-4 transition-transform" :class="!isOpen(s.id) && '-rotate-90'" />
          </button>
        </div>
        <ul v-show="isOpen(s.id)" class="space-y-0.5 pl-3">
          <li v-if="s.own" class="px-1 pb-0.5 text-text-muted">Always played</li>
          <li v-for="c in s.rows" :key="c.key">
            <label class="flex items-start gap-2 rounded-button px-1 py-1" :class="s.own && 'opacity-70'">
              <input
                type="checkbox"
                class="mt-0.5 size-4 shrink-0 accent-accent"
                :checked="s.own || chosen.has(c.key)"
                :disabled="s.own"
                @change="emit('toggle', c.key)"
              />
              <span class="min-w-0">
                <span class="block truncate">{{ c.kind === 'idle' ? 'Idle' : (c.title ?? c.name) }}</span>
                <span class="block truncate text-text-muted">{{ c.name }} · {{ seconds(c.duration) }}</span>
              </span>
            </label>
          </li>
        </ul>
      </section>
    </div>
    <button type="button" :class="button" :disabled="!saved" @click="emit('useDefault')">Use default</button>
    <p v-if="saveError" role="alert" class="text-red-400">Could not save: storage is unavailable. Changes last until the panel closes.</p>
  </div>
</template>
