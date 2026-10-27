<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  label: string
  /** Where the card opens relative to the bar it is placed in: above it or below it. */
  placement: 'up' | 'down'
}>()
const emit = defineEmits<{ close: [] }>()

const card = ref<HTMLElement | null>(null)

// A press on a trigger button toggles the popover itself, so it must not also count as "outside".
function onDocumentPointerDown(event: PointerEvent): void {
  const target = event.target as Element | null
  if (target?.closest('[data-popover], [data-popover-trigger]')) return
  emit('close')
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  // Keyboard users land in the card; the first control is the one they came for.
  void nextTick(() => card.value?.querySelector<HTMLElement>('button, input, [tabindex]')?.focus({ preventScroll: true }))
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown, true))
</script>

<template>
  <!-- Positioned by the bar that holds it (`absolute inset-x-0`), so it always fits the panel width. -->
  <div
    ref="card"
    data-popover
    role="dialog"
    :aria-label="label"
    class="absolute inset-x-0 z-30 rounded-card border border-border bg-surface p-3 text-text shadow-lg"
    :class="props.placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'"
  >
    <slot />
  </div>
</template>
