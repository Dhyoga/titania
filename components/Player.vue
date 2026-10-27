<script setup lang="ts">
import type { CatalogGroup, ContextId } from '~/lib/anim/catalog'
import type { Selection } from '~/composables/usePlayback'
import AnimationSelect from './AnimationSelect.vue'
import ContextToggle from './ContextToggle.vue'
import Icon from './Icon.vue'
import IconButton from './IconButton.vue'
import LoopToggle from './LoopToggle.vue'
import Scrubber from './Scrubber.vue'

defineProps<{
  groups: CatalogGroup[]
  selected: Selection | null
  pending: Selection | null
  voiced: ReadonlySet<string>
  error: string
  playing: boolean
  time: number
  duration: number
  context: ContextId
  /** No model yet: everything is disabled. */
  disabled: boolean
  /** Bind pose or no clip: play, scrubber and loop are disabled. */
  controlsDisabled: boolean
  playbackOpen: boolean
  /** The shown skin has no clips (chibi): Fight/Menu toggle off. */
  noClips: boolean
}>()
const loop = defineModel<boolean>('loop', { required: true })
defineEmits<{
  select: [choice: Selection]
  togglePlay: []
  seekStart: []
  seek: [seconds: number]
  seekEnd: []
  togglePlaybackOptions: [event: Event]
  hide: []
  'update:context': [value: ContextId]
}>()
</script>

<template>
  <!-- The player: a rounded card overlaid on the bottom of the stage. Three rows. It takes pointer input back from the bottom group. -->
  <section class="pointer-events-auto relative rounded-card bg-surface p-3 shadow-md" aria-label="Playback">
    <!-- Row 1: Fight/Menu toggle (left) + hide button (right) -->
    <div class="mb-2 flex items-center justify-between gap-2">
      <ContextToggle
        :model-value="context"
        :disabled="disabled || noClips"
        @update:model-value="$emit('update:context', $event)"
      />
      <IconButton
        size="sm"
        icon="chevron-down"
        label="Hide player"
        title="Hide player (H)"
        data-player-hide
        :disabled="disabled"
        @click="$emit('hide')"
      />
    </div>
    <!-- Row 2: Animation select + playback options button -->
    <div class="flex items-center gap-2">
      <AnimationSelect
        class="flex-1"
        :groups="groups"
        :selected="selected"
        :pending="pending"
        :voiced="voiced"
        :disabled="disabled"
        @select="$emit('select', $event)"
      />
      <IconButton
        icon="sliders-horizontal"
        label="Playback options"
        :pressed="playbackOpen"
        :disabled="disabled"
        data-popover-trigger
        aria-haspopup="dialog"
        :aria-expanded="playbackOpen"
        @click="$emit('togglePlaybackOptions', $event)"
      />
    </div>
    <!-- Error -->
    <p v-if="error" role="alert" class="mt-2 break-words text-xs text-red-400">{{ error }}</p>
    <!-- Row 3: Transport -->
    <div class="mt-3 flex items-center gap-2">
      <button
        type="button"
        class="flex size-9 shrink-0 items-center justify-center rounded-button bg-surface-2 text-text disabled:opacity-40"
        :disabled="controlsDisabled"
        :aria-label="playing ? 'Pause' : 'Play'"
        :title="playing ? 'Pause (Space)' : 'Play (Space)'"
        @click="$emit('togglePlay')"
      >
        <Icon :name="playing ? 'pause' : 'play'" class="size-5" />
      </button>
      <Scrubber
        :time="time"
        :duration="duration"
        :disabled="controlsDisabled"
        @start="$emit('seekStart')"
        @seek="$emit('seek', $event)"
        @end="$emit('seekEnd')"
      />
      <span class="shrink-0 text-xs tabular-nums text-text-muted">{{ time.toFixed(2) }} / {{ duration.toFixed(2) }} s</span>
      <LoopToggle v-model="loop" :disabled="controlsDisabled" />
    </div>
    <slot name="popover" />
  </section>
</template>
