<script setup lang="ts">
import type { BackgroundMode } from '~/composables/useViewerSettings'
import SwitchField from './SwitchField.vue'

const mode = defineModel<BackgroundMode>('mode', { required: true })
const color = defineModel<string>('color', { required: true })
const grid = defineModel<boolean>('grid', { required: true })
const autoRotate = defineModel<boolean>('autoRotate', { required: true })
const follow = defineModel<boolean>('follow', { required: true })
const wireframe = defineModel<boolean>('wireframe', { required: true })
const toon = defineModel<boolean>('toon', { required: true })
const subtitles = defineModel<boolean>('subtitles', { required: true })

const options: { id: BackgroundMode; label: string }[] = [
  { id: 'gradient', label: 'Gradient' },
  { id: 'solid', label: 'Solid' },
  { id: 'transparent', label: 'Transparent' },
]
</script>

<template>
  <div class="space-y-2">
    <SwitchField v-model="toon" label="Toon shading" />
    <SwitchField v-model="subtitles" label="Subtitles" />
    <p class="pt-1 text-xs font-medium text-text">Background</p>
    <div role="radiogroup" aria-label="Background" class="flex rounded-button bg-surface-2 p-0.5">
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        role="radio"
        :aria-checked="mode === option.id"
        class="min-w-0 flex-1 rounded-[10px] px-1 py-1.5 text-[11px] font-semibold transition-colors"
        :class="mode === option.id ? 'bg-accent text-accent-fg' : 'text-text'"
        @click="mode = option.id"
      >
        {{ option.label }}
      </button>
    </div>
    <label v-if="mode === 'solid'" class="flex items-center justify-between gap-3 text-xs text-text">
      Colour
      <input v-model="color" type="color" class="h-7 w-12 cursor-pointer rounded border border-border bg-transparent p-0" />
    </label>
    <div class="space-y-0.5 pt-1">
      <SwitchField v-model="grid" label="Show grid floor" />
      <SwitchField v-model="autoRotate" label="Auto-rotate" />
      <SwitchField v-model="follow" label="Follow animation" />
      <SwitchField v-model="wireframe" label="Wireframe" />
    </div>
  </div>
</template>
