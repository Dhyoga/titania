<script setup lang="ts">
import Icon, { type IconName } from './Icon.vue'

withDefaults(
  defineProps<{
    icon: IconName
    /** Accessible name; also the tooltip unless `title` is given. */
    label: string
    title?: string
    /** Shown pressed (and `aria-pressed` set) when true or false; omit for a plain button. */
    pressed?: boolean
    disabled?: boolean
    size?: 'sm' | 'md'
  }>(),
  { size: 'md', pressed: undefined, title: undefined },
)
</script>

<template>
  <button
    type="button"
    class="flex shrink-0 items-center justify-center rounded-button border border-border text-text transition-colors disabled:opacity-40"
    :class="[size === 'sm' ? 'size-8' : 'size-9', pressed ? 'bg-surface-2' : 'bg-surface']"
    :aria-label="label"
    :title="title ?? label"
    :aria-pressed="pressed"
    :disabled="disabled"
  >
    <Icon :name="icon" :class="size === 'sm' ? 'size-4' : 'size-5'" />
  </button>
</template>
