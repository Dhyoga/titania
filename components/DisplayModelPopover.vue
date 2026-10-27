<script setup lang="ts">
import { computed } from 'vue'
import type { ConstructConfig } from '~/lib/constructs'
import { displaySkins } from '~/lib/constructs/display'
import SkinStrip from './SkinStrip.vue'

const props = defineProps<{
  frames: { id: string; name: string }[]
  /** The frame and skin Display shows (saved as soon as it is chosen here). */
  frame: ConstructConfig
  skin: string
  /** Id of the skin being loaded, if any. */
  loading: string | null
}>()
const emit = defineEmits<{ chooseFrame: [id: string]; chooseSkin: [id: string] }>()

// No dorm chibi: it has no clips, so Display would only show a bind pose.
const skins = computed(() => displaySkins(props.frame))
const shownName = computed(() => skins.value.find((s) => s.id === props.skin)?.name ?? '')
</script>

<template>
  <div class="space-y-2 text-xs text-text">
    <p class="font-medium">Display model</p>
    <div role="radiogroup" aria-label="Frame" class="grid grid-cols-2 gap-1">
      <button
        v-for="f in frames"
        :key="f.id"
        type="button"
        role="radio"
        :aria-checked="f.id === frame.id"
        class="truncate rounded-button border px-2 py-1.5 text-xs font-semibold"
        :class="f.id === frame.id ? 'border-accent bg-accent/20 text-accent' : 'border-border bg-surface-2 text-text'"
        @click="emit('chooseFrame', f.id)"
      >
        {{ f.name }}
      </button>
    </div>
    <SkinStrip :construct-id="frame.id" :skins="skins" :selected="skin" :loading="loading" @select="emit('chooseSkin', $event)" />
    <p class="truncate text-text-muted" aria-live="polite">{{ shownName }}</p>
  </div>
</template>
