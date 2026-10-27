<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ time: number; duration: number; disabled?: boolean }>()
const emit = defineEmits<{ start: []; seek: [seconds: number]; end: [] }>()

const fill = computed(() => (props.duration > 0 ? Math.min(100, Math.max(0, (props.time / props.duration) * 100)) : 0))
const valueText = computed(() => `${props.time.toFixed(2)} of ${props.duration.toFixed(2)} seconds`)

function onInput(event: Event): void {
  emit('seek', Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <input
    type="range"
    class="slider min-w-0 flex-1"
    min="0"
    :max="duration"
    step="0.01"
    :value="time"
    :disabled="disabled"
    :style="{ '--fill': `${fill}%` }"
    aria-label="Animation time"
    :aria-valuetext="valueText"
    @pointerdown="emit('start')"
    @input="onInput"
    @change="emit('end')"
    @pointercancel="emit('end')"
  />
</template>
