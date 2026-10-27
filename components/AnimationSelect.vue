<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import type { CatalogGroup } from '~/lib/anim/catalog'
import type { Selection } from '~/composables/usePlayback'
import Icon from './Icon.vue'

const props = defineProps<{
  groups: CatalogGroup[]
  /** The clip that is playing; null before the first one. */
  selected: Selection | null
  /** Clip being fetched: its name is shown with a spinner. */
  pending: Selection | null
  /** Clips that play with a voice line: shown with a speaker glyph. */
  voiced?: ReadonlySet<string>
  disabled?: boolean
  /** `compact` is the toolbar's narrow field; its list is wider than the field (up to the panel width). */
  variant?: 'compact' | 'full'
}>()
const emit = defineEmits<{ select: [choice: Selection] }>()

interface Option {
  value: Selection
  label: string
}

const TYPE_AHEAD_RESET_MS = 700
const LIST_MAX_PX = 256
const COMPACT_LIST_PX = 320
const EDGE_PX = 8

const uid = useId()
const root = ref<HTMLElement | null>(null)
const field = ref<HTMLButtonElement | null>(null)
const open = ref(false)
/** Fixed position of the list, set when it opens: it must not be clipped by the stage card or the toolbar. */
const listStyle = ref<Record<string, string>>({})
/** Index into `options` of the highlighted item. */
const active = ref(0)

/** Every selectable item in display order: the groups' items. Headers are not options. */
// The field and type-ahead use `fieldLabel` (`Veritas · Win` for a clip another frame lends); the list shows `label` under its group.
const options = computed<Option[]>(() => props.groups.flatMap((g) => g.items.map((i) => ({ value: i.id, label: i.fieldLabel }))))
const optionIndex = computed(() => new Map(options.value.map((o, i) => [o.value, i])))
const shownValue = computed<Selection | null>(() => props.pending ?? props.selected)
const shownLabel = computed(() => {
  const i = shownValue.value === null ? undefined : optionIndex.value.get(shownValue.value)
  if (i !== undefined) return options.value[i]!.label
  return props.groups.length === 0 ? 'No animations' : 'Choose an animation'
})

const optionId = (index: number): string => `${uid}-opt-${index}`
const groupStart = computed(() => {
  let next = 0
  return props.groups.map((g) => {
    const start = next
    next += g.items.length
    return start
  })
})

function scrollToActive(): void {
  void nextTick(() => document.getElementById(optionId(active.value))?.scrollIntoView({ block: 'nearest' }))
}

function openList(): void {
  if (props.disabled || open.value) return
  const rect = field.value?.getBoundingClientRect()
  if (rect) {
    const width = props.variant === 'compact' ? Math.min(COMPACT_LIST_PX, window.innerWidth - 2 * EDGE_PX) : rect.width
    const left = Math.min(Math.max(rect.left, EDGE_PX), window.innerWidth - width - EDGE_PX)
    const below = window.innerHeight - rect.bottom - EDGE_PX
    const above = rect.top - EDGE_PX
    const up = below < LIST_MAX_PX && above > below
    listStyle.value = {
      left: `${left}px`,
      width: `${width}px`,
      maxHeight: `${Math.max(120, Math.min(LIST_MAX_PX, up ? above : below))}px`,
      ...(up ? { bottom: `${window.innerHeight - rect.top + 4}px` } : { top: `${rect.bottom + 4}px` }),
    }
  }
  active.value = (props.selected === null ? undefined : optionIndex.value.get(props.selected)) ?? 0
  open.value = true
  scrollToActive()
}

function closeList(): void {
  open.value = false
  typed = ''
}

function choose(index: number): void {
  const option = options.value[index]
  closeList()
  if (option) emit('select', option.value)
}

function move(index: number): void {
  active.value = Math.min(Math.max(index, 0), options.value.length - 1)
  scrollToActive()
}

let typed = ''
let typedTimer: ReturnType<typeof setTimeout> | undefined

function typeAhead(char: string): void {
  clearTimeout(typedTimer)
  typed += char.toLowerCase()
  typedTimer = setTimeout(() => (typed = ''), TYPE_AHEAD_RESET_MS)
  const found = options.value.findIndex((o) => o.label.toLowerCase().startsWith(typed))
  if (found >= 0) move(found)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (!open.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      openList()
    }
    return
  }
  switch (event.key) {
    case 'ArrowDown':
      move(active.value + 1)
      break
    case 'ArrowUp':
      move(active.value - 1)
      break
    case 'Home':
      move(0)
      break
    case 'End':
      move(options.value.length - 1)
      break
    case 'Enter':
    case ' ':
      choose(active.value)
      break
    case 'Escape':
      closeList()
      event.stopPropagation()
      break
    case 'Tab':
      closeList()
      return // focus moves on as usual
    default:
      if (event.key.length !== 1) return
      typeAhead(event.key)
  }
  event.preventDefault() // the key was ours: no scrolling, no click, no panel shortcut
}

// Space on a button clicks it on key release; the list already handled the key on key down.
function onKeyup(event: KeyboardEvent): void {
  if (event.key === ' ') event.preventDefault()
}

// Keyboard focus leaving the control (Tab) closes the list; clicks on its items keep focus on the field.
function onFocusout(event: FocusEvent): void {
  if (!root.value?.contains(event.relatedTarget as Node | null)) closeList()
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!root.value?.contains(event.target as Node)) closeList()
}

// The list is placed in viewport coordinates, so it closes when the page scrolls or resizes under it.
function onViewportChange(event: Event): void {
  if (event.target instanceof Element && event.target.closest('[role=listbox]')) return // the list's own scrolling
  closeList()
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
  } else {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true)
    window.removeEventListener('resize', onViewportChange)
    window.removeEventListener('scroll', onViewportChange, true)
  }
})
watch(
  () => props.disabled,
  (isDisabled) => isDisabled && closeList(),
)
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
  clearTimeout(typedTimer)
})
</script>

<template>
  <div ref="root" class="relative min-w-0" @focusout="onFocusout">
    <button
      ref="field"
      type="button"
      role="combobox"
      class="flex w-full items-center rounded-button border border-border bg-surface-2 text-left text-sm text-text disabled:opacity-50"
      :class="variant === 'compact' ? 'h-8 gap-1 px-2' : 'h-10 gap-2 px-3'"
      aria-haspopup="listbox"
      aria-label="Animation"
      :aria-expanded="open"
      :aria-controls="`${uid}-list`"
      :aria-activedescendant="open ? optionId(active) : undefined"
      :disabled="disabled"
      @click="open ? closeList() : openList()"
      @keydown="onKeydown"
      @keyup="onKeyup"
    >
      <span class="min-w-0 flex-1 truncate">{{ shownLabel }}</span>
      <Icon v-if="pending !== null" name="loader" class="size-4 shrink-0 animate-spin text-text-muted" />
      <Icon name="chevron-down" class="shrink-0 text-text-muted transition-transform" :class="[open && 'rotate-180', variant === 'compact' ? 'size-3.5' : 'size-4']" />
    </button>

    <ul
      v-if="open"
      :id="`${uid}-list`"
      role="listbox"
      aria-label="Animations"
      class="fixed z-50 overflow-y-auto overscroll-contain rounded-button border border-border bg-surface py-1 shadow-lg [color-scheme:dark]"
      :style="listStyle"
      @mousedown.prevent
    >
      <li v-for="(group, g) in groups" :key="group.label" role="presentation">
        <!-- Sticky: with other frames' groups the list is long, and the header says whose clips these are. -->
        <div :id="`${uid}-group-${g}`" class="sticky top-0 z-10 bg-surface px-3 pb-1 pt-2 text-sm font-bold text-text" role="presentation">{{ group.label }}</div>
        <ul role="group" :aria-labelledby="`${uid}-group-${g}`">
          <li
            v-for="(item, i) in group.items"
            :id="optionId(groupStart[g]! + i)"
            :key="item.id"
            role="option"
            :aria-selected="selected === item.id"
            class="scroll-mt-9 cursor-pointer truncate py-1.5 pl-6 pr-3 text-sm"
            :class="[active === groupStart[g]! + i ? 'bg-accent/20 text-accent' : 'text-text', selected === item.id && 'font-semibold']"
            @mousemove="active = groupStart[g]! + i"
            @click="choose(groupStart[g]! + i)"
          >
            {{ item.label }}
            <template v-if="voiced?.has(item.id)">
              <Icon name="volume-2" class="ml-0.5 inline size-3.5 align-[-2px] text-text-muted" />
              <span class="sr-only">with voice</span>
            </template>
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>
