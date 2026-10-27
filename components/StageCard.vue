<script setup lang="ts">
import type { BackgroundMode } from '~/composables/useViewerSettings'

withDefaults(
  defineProps<{
    background?: BackgroundMode
    /** Colour of the `solid` background. */
    solid?: string
  }>(),
  { background: 'gradient', solid: undefined },
)
</script>

<template>
  <!-- The stage: fills its parent (absolutely, because the parent's height comes from flex, which a percentage height cannot see). No fixed aspect, no radius. -->
  <div
    class="absolute inset-0 overflow-hidden"
    :class="[
      background === 'gradient' && 'bg-linear-to-b from-stage-top to-stage-bottom',
      background === 'transparent' && 'checker',
    ]"
    :style="background === 'solid' ? { backgroundColor: solid } : undefined"
  >
    <slot />
  </div>
</template>
