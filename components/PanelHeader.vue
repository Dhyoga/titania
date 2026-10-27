<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import Icon from './Icon.vue'

const props = defineProps<{ frames: { id: string; name: string }[] }>()
/** The Display button was pressed: back to the quiet view. */
const emit = defineEmits<{ display: [] }>()
/** Id of the frame shown. */
const selected = defineModel<string>({ required: true })

const uid = useId()
const root = ref<HTMLElement | null>(null)
const button = ref<HTMLButtonElement | null>(null)
const open = ref(false)
/** Index of the highlighted frame while the list is open. */
const active = ref(0)

const selectedIndex = computed(() => Math.max(0, props.frames.findIndex((f) => f.id === selected.value)))
const shownName = computed(() => props.frames[selectedIndex.value]?.name ?? '')
const optionId = (i: number): string => `${uid}-frame-${i}`

function openList(): void {
  active.value = selectedIndex.value
  open.value = true
}

function closeList(focus = false): void {
  open.value = false
  if (focus) void nextTick(() => button.value?.focus())
}

function choose(index: number): void {
  const frame = props.frames[index]
  if (frame) selected.value = frame.id
  closeList(true)
}

function move(index: number): void {
  active.value = Math.min(Math.max(index, 0), props.frames.length - 1)
}

function onKeydown(event: KeyboardEvent): void {
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
      move(props.frames.length - 1)
      break
    case 'Enter':
    case ' ':
      choose(active.value)
      break
    case 'Escape':
      closeList(true)
      break
    case 'Tab':
      closeList()
      return
    default:
      return
  }
  event.preventDefault()
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (open.value && !root.value?.contains(event.target as Node)) closeList()
}

onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown, true))
</script>

<template>
  <header class="flex items-center justify-between gap-2 bg-bg px-4 py-3">
    <!-- The construct name is the frame picker: a button with a chevron that opens a short list of the frames. -->
    <div ref="root" class="relative inline-block">
      <h1 class="text-base font-semibold text-text">
        <button
          ref="button"
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-label="Frame"
          :aria-expanded="open"
          :aria-controls="`${uid}-list`"
          :aria-activedescendant="open ? optionId(active) : undefined"
          class="-ml-2 flex items-center gap-1.5 rounded-button px-2 py-1 transition-colors hover:bg-surface"
          @click="open ? closeList() : openList()"
          @keydown="onKeydown"
        >
          {{ shownName }}
          <Icon name="chevron-down" class="size-4 text-text-muted transition-transform" :class="open && 'rotate-180'" />
        </button>
      </h1>
      <ul
        v-if="open"
        :id="`${uid}-list`"
        role="listbox"
        aria-label="Frames"
        class="absolute left-0 top-full z-40 mt-1 min-w-44 max-w-[calc(100vw-2rem)] rounded-button border border-border bg-surface py-1 shadow-lg"
        @mousedown.prevent
      >
        <li
          v-for="(frame, i) in frames"
          :id="optionId(i)"
          :key="frame.id"
          role="option"
          :aria-selected="frame.id === selected"
          class="cursor-pointer truncate px-3 py-1.5 text-sm"
          :class="[active === i ? 'bg-accent/20 text-accent' : 'text-text', frame.id === selected && 'font-semibold']"
          @mousemove="active = i"
          @click="choose(i)"
        >
          {{ frame.name }}
        </li>
      </ul>
    </div>
    <button
      type="button"
      class="flex shrink-0 items-center gap-1.5 rounded-button border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-text transition-colors hover:bg-surface-2"
      aria-label="Display mode"
      title="Display mode"
      @click="emit('display')"
    >
      <Icon name="monitor" class="size-4" />
      Display
    </button>
  </header>
</template>
