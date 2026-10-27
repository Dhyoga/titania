<script setup lang="ts">
import SliderField from './SliderField.vue'

defineProps<{ isDefault: boolean }>()
defineEmits<{ reset: [] }>()
const intensity = defineModel<number>('intensity', { required: true })
const azimuth = defineModel<number>('azimuth', { required: true })
</script>

<template>
  <div class="space-y-3">
    <SliderField v-model="intensity" label="Light intensity" :min="0.25" :max="2" :step="0.05" :display="`${intensity.toFixed(2)}×`" />
    <SliderField v-model="azimuth" label="Light direction" :min="-180" :max="180" :step="1" :display="`${azimuth}°`" />
    <button
      type="button"
      class="w-full rounded-button border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text disabled:opacity-40"
      :disabled="isDefault"
      @click="$emit('reset')"
    >
      Reset lighting
    </button>
  </div>
</template>
