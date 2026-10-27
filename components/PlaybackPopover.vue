<script setup lang="ts">
import { SPEEDS } from '~/composables/useViewerSettings'
import IconButton from './IconButton.vue'
import SliderField from './SliderField.vue'

const speed = defineModel<number>('speed', { required: true })
/** 0 to 1. */
const volume = defineModel<number>('volume', { required: true })
const muted = defineModel<boolean>('muted', { required: true })

const label = (rate: number): string => `${rate}×`
</script>

<template>
  <div class="space-y-3">
    <div>
      <p class="mb-1 text-xs font-medium text-text">Speed</p>
      <div role="radiogroup" aria-label="Playback speed" class="flex rounded-button bg-surface-2 p-0.5">
        <button
          v-for="rate in SPEEDS"
          :key="rate"
          type="button"
          role="radio"
          :aria-checked="speed === rate"
          class="min-w-0 flex-1 rounded-[10px] px-1 py-1.5 text-xs font-semibold tabular-nums transition-colors"
          :class="speed === rate ? 'bg-accent text-accent-fg' : 'text-text'"
          @click="speed = rate"
        >
          {{ label(rate) }}
        </button>
      </div>
    </div>
    <div class="flex items-end gap-2">
      <SliderField
        class="flex-1"
        :model-value="Math.round(volume * 100)"
        label="Voice volume"
        :min="0"
        :max="100"
        :step="1"
        :display="`${Math.round(volume * 100)}%`"
        @update:model-value="volume = $event / 100"
      />
      <IconButton
        :icon="muted ? 'volume-x' : 'volume-2'"
        :label="muted ? 'Unmute voice' : 'Mute voice'"
        :title="muted ? 'Unmute voice (M)' : 'Mute voice (M)'"
        :pressed="muted"
        size="sm"
        @click="muted = !muted"
      />
    </div>
  </div>
</template>
