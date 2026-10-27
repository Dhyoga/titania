<script setup lang="ts">
defineProps<{
  /** The cue to show, or null for none. */
  text: string | null
}>()
</script>

<template>
  <!-- Above the player, in the bottom group wrapper's flow. Never takes a click away from the canvas. -->
  <div class="pointer-events-none flex justify-center px-2 pb-1">
    <p v-if="text" class="max-w-full rounded-button bg-black/70 px-3 py-1.5 text-center text-sm leading-snug text-white">{{ text }}</p>
  </div>
</template>
