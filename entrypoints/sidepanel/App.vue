<script setup lang="ts">
import { computed, ref } from 'vue'
import { DEFAULT_FRAME, FRAMES, getConstruct } from '~/lib/constructs'
import { resolveDisplayModel, type ModelChoice } from '~/lib/constructs/display'
import type { Mode } from '~/composables/mode'
import { usePreferences } from '~/composables/usePreferences'
import PanelHeader from '~/components/PanelHeader.vue'
import ModelTab from '~/components/ModelTab.vue'

const { prefs, update, flush } = usePreferences()
const frames = FRAMES.map((f) => ({ id: f.id, name: f.displayName }))

// The panel always opens in Display, on the saved Display model (Crepuscule Generic - Final until the user chooses another).
const mode = ref<Mode>('display')
const displayModel = computed(() => resolveDisplayModel(FRAMES, prefs.value.lobby, DEFAULT_FRAME))
// Playground starts from the Display model every time it is entered; what is chosen in it stays in it.
const playgroundModel = ref<ModelChoice>({ ...displayModel.value })
/** The one place that decides which frame and skin the viewer shows; everything below receives it as a prop. */
const shown = computed(() => (mode.value === 'display' ? displayModel.value : playgroundModel.value))

// The header's frame picker (Playground only): the frame's default skin, as a skin switch.
const playgroundFrame = computed({
  get: () => playgroundModel.value.frame,
  set: (id: string) => {
    if (id !== playgroundModel.value.frame) playgroundModel.value = { frame: id, skin: getConstruct(id).defaultSkin }
  },
})

function selectPlaygroundSkin(id: string): void {
  playgroundModel.value = { frame: playgroundModel.value.frame, skin: id }
}

// The Display model is saved as soon as it is chosen.
function chooseDisplayFrame(id: string): void {
  update((p) => ({ ...p, lobby: { ...p.lobby, frame: id, skin: getConstruct(id).defaultSkin } }))
  flush()
}

function chooseDisplaySkin(id: string): void {
  update((p) => ({ ...p, lobby: { ...p.lobby, frame: displayModel.value.frame, skin: id } }))
  flush()
}

// Focus hides the header and skin area so the stage fills the panel (Playground only). Lives here because both the
// header (child of App) and the skin area (child of ModelTab) are controlled by it.
const focus = ref(false)

function switchMode(next: Mode): void {
  if (next === mode.value) return
  if (next === 'playground') playgroundModel.value = { ...displayModel.value }
  focus.value = false
  mode.value = next
}
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <PanelHeader v-if="mode === 'playground' && !focus" v-model="playgroundFrame" :frames="frames" @display="switchMode('display')" />
    <ModelTab
      v-model:focus="focus"
      :model="shown"
      :mode="mode"
      :display-model="displayModel"
      :frames="frames"
      @select-skin="selectPlaygroundSkin"
      @choose-display-frame="chooseDisplayFrame"
      @choose-display-skin="chooseDisplaySkin"
      @switch-mode="switchMode"
    />
  </div>
</template>
