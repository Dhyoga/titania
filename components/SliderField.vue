<script setup lang="ts">
import { computed, useId } from 'vue'

const props = defineProps<{
  label: string
  min: number
  max: number
  step: number
  /** The value as text beside the label, e.g. `1.00×`. */
  display: string
  disabled?: boolean
}>()
const value = defineModel<number>({ required: true })

const id = useId()
const fill = computed(() => `${Math.min(100, Math.max(0, ((value.value - props.min) / (props.max - props.min)) * 100))}%`)

function onInput(event: Event): void {
  value.value = Number((event.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="min-w-0">
    <div class="mb-1 flex items-baseline justify-between gap-2 text-xs">
      <label :for="id" class="font-medium text-text">{{ label }}</label>
      <span class="tabular-nums text-text-muted">{{ display }}</span>
    </div>
    <input
      :id="id"
      type="range"
      class="slider w-full"
      :min="min"
      :max="max"
      :step="step"
      :value="value"
      :disabled="disabled"
      :style="{ '--fill': fill }"
      @input="onInput"
    />
  </div>
</template>
