<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch } from 'vue'
import { getConstruct } from '~/lib/constructs'
import type { ModelChoice } from '~/lib/constructs/display'
import { savedSkinCount as countSavedSkins } from '~/lib/prefs/prefs'
import type { Mode } from '~/composables/mode'
import { useCameraPreference } from '~/composables/useCameraPreference'
import { useLobbyDirector } from '~/composables/useLobbyDirector'
import { usePlayback } from '~/composables/usePlayback'
import { usePlaybackKeys } from '~/composables/usePlaybackKeys'
import { useParts } from '~/composables/useParts'
import { usePreferenceFiles } from '~/composables/usePreferenceFiles'
import { usePreferences } from '~/composables/usePreferences'
import { useScreenshot } from '~/composables/useScreenshot'
import { useViewer } from '~/composables/useViewer'
import { useViewerKeys } from '~/composables/useViewerKeys'
import { useViewerSettings } from '~/composables/useViewerSettings'
import { useVoiceOutput } from '~/composables/useVoiceOutput'
import AdjustCameraBar from './AdjustCameraBar.vue'
import DisplayAnimationsPopover from './DisplayAnimationsPopover.vue'
import DisplayModelPopover from './DisplayModelPopover.vue'
import Icon from './Icon.vue'
import IconButton from './IconButton.vue'
import LightingPopover from './LightingPopover.vue'
import ModelViewer from './ModelViewer.vue'
import PartsPopover from './PartsPopover.vue'
import PlaybackPopover from './PlaybackPopover.vue'
import PreferencesPopover from './PreferencesPopover.vue'
import Player from './Player.vue'
import Popover from './Popover.vue'
import SettingsPopover from './SettingsPopover.vue'
import SkinStrip from './SkinStrip.vue'
import SkinTitle from './SkinTitle.vue'
import StageCard from './StageCard.vue'
import StageMenu from './StageMenu.vue'
import SubtitleOverlay from './SubtitleOverlay.vue'

const props = defineProps<{
  /** The model shown (the Display model in Display, Playground's own in Playground). */
  model: ModelChoice
  mode: Mode
  /** The saved Display model, which the Display menu's Model popover edits. */
  displayModel: ModelChoice
  /** Every frame, in the picker's order. */
  frames: { id: string; name: string }[]
  /** The frames the Display menu offers: those with a clip set of their own. */
  displayFrames: { id: string; name: string }[]
}>()
const emit = defineEmits<{
  /** Playground's skin strip chose a skin (temporary: App.vue holds it). */
  selectSkin: [id: string]
  /** The Display menu's Model popover chose a frame (its default skin) or a skin of the Display frame. */
  chooseDisplayFrame: [id: string]
  chooseDisplaySkin: [id: string]
  switchMode: [mode: Mode]
}>()
/** Controlled by App.vue: hides the header and skin area so the stage fills the panel. */
const focus = defineModel<boolean>('focus', { required: true })

const mode = toRef(props, 'mode')
const construct = computed(() => getConstruct(props.model.frame))
const displayConstruct = computed(() => getConstruct(props.displayModel.frame))

const viewerEl = ref<InstanceType<typeof ModelViewer> | null>(null)
const container = computed(() => viewerEl.value?.container ?? null)
// A model loads with the camera of the mode it is shown in (`camera` is defined below; the load runs after mount). A camera the user
// moved is kept across skin and frame switches within a mode, not into the other mode: `shownMode` is the mode the model on show
// belongs to (set when a model finishes loading, and on a mode switch that loads nothing).
let shownMode: Mode = props.mode
const { status, progress, error, session, skin, retry } = useViewer(container, toRef(props, 'model'), {
  view: () => camera.activeView(),
  keep: () => props.mode === shownMode,
  hold: () => props.mode === 'display', // Display never shows the bind pose first: the model appears with its first clip
})
watch(session, (shown) => {
  if (shown) shownMode = props.mode
})

// In Display the lobby director chooses what plays; in Playground a new model takes up the clip the user had chosen.
const playback = usePlayback(session, { takeOver: () => props.mode === 'display' })
const settings = useViewerSettings(session, mode)
const parts = useParts(session)
const voice = useVoiceOutput(session)
const camera = useCameraPreference(session, mode)
const preferences = usePreferences()
const files = usePreferenceFiles()
const savedSkinCount = computed(() => countSavedSkins(preferences.prefs.value))
const { takeScreenshot } = useScreenshot(session, playback, settings)
usePlaybackKeys(playback, mode)

const groups = computed(() => playback.catalog.value?.groups ?? [])
const loop = computed({
  get: () => playback.loop.value,
  set: () => playback.toggleLoop(),
})
const disabled = computed(() => !playback.ready.value)
const controlsDisabled = computed(() => !playback.hasClip.value)
/** The shown model has no clip set of its own and no frame lends it one (the chibi); a frame with sources only (Erza) has clips. */
const noClips = computed(() => playback.ready.value && playback.framesRead.value && !playback.catalog.value)
const shownSkin = computed(() => construct.value.skins.find((s) => s.id === skin.value) ?? construct.value.skins[0]!)

// ---- Player hidden state ----
/** The player is shown on every open; choice is not persisted. */
const playerHidden = ref(false)

// The player's options popover goes with the player.
watch(playerHidden, (hidden) => {
  if (hidden && openPopover.value === 'playback') openPopover.value = null
})

// Hiding or showing removes the control that was pressed, which would drop keyboard focus on the page: hand it to the one that
// takes its place (only when focus was in the bottom group, so `H` from elsewhere moves nothing).
const bottomGroup = ref<HTMLElement | null>(null)
const playerHandle = ref<HTMLElement | null>(null)
watch(playerHidden, (hidden) => {
  if (!bottomGroup.value?.contains(document.activeElement)) return
  void nextTick(() => {
    const next = hidden ? playerHandle.value : bottomGroup.value?.querySelector<HTMLElement>('[data-player-hide]')
    next?.focus({ preventScroll: true })
  })
})

// An error forces the player visible.
watch(
  () => playback.error.value,
  (err) => { if (err) playerHidden.value = false },
)

// ---- Popover state ----
type PopoverId = 'settings' | 'lighting' | 'playback' | 'parts' | 'preferences' | 'model' | 'animations'
const openPopover = ref<PopoverId | null>(null)
/** A popover of the stage menu is open (the player's own playback popover is not one). */
const menuPopoverOpen = computed(() => openPopover.value !== null && openPopover.value !== 'playback')
/** The button that opened the current popover, so Esc can return focus to it. */
let popoverTrigger: HTMLElement | null = null

const stageMenu = ref<InstanceType<typeof StageMenu> | null>(null)

function togglePopover(id: PopoverId, event: Event): void {
  if (openPopover.value === id) {
    openPopover.value = null
    return
  }
  popoverTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  openPopover.value = id
}

function closePopovers(): void {
  openPopover.value = null
}

// ---- Skin strip ref for scroll-into-view after Focus off ----
const skinStripEl = ref<InstanceType<typeof SkinStrip> | null>(null)

// When Focus is turned off, scroll the selected tile back into view (it may have slid off-screen).
watch(focus, (on) => {
  if (!on) void nextTick(() => skinStripEl.value?.revealSelected())
})

function resetCamera(): void {
  session.value?.viewer.resetCamera()
}

// ---- Display: the camera is locked, "Adjust camera" unlocks it until Save, Use built-in or Cancel ----
const adjusting = ref(false)

// Locked in Display unless adjusting; follow, refit and reset still move it. Set again for every new viewer.
watch(
  [session, mode, adjusting],
  () => session.value?.viewer.setInputLocked(mode.value === 'display' && !adjusting.value),
  { immediate: true },
)

function startAdjust(): void {
  if (!session.value) return
  stageMenu.value?.close()
  adjusting.value = true
}

function saveAdjust(): void {
  // A save that did not stick keeps the bar (with its message); the view still holds for the session.
  if (camera.saveDisplayView() || !preferences.saveError.value) adjusting.value = false
}

function builtInAdjust(): void {
  camera.useBuiltInDisplay()
  adjusting.value = false
}

function cancelAdjust(): void {
  adjusting.value = false
  resetCamera() // back to the Display view it had (the viewer still holds it)
}

// A mode switch ends adjusting (the camera follows the mode's own view, see `useCameraPreference`) and closes popovers. Coming back to
// Display from Playground starts the lobby in idle, not with a new action (`returning`, read once by the director's start).
let returning = false
watch(mode, (next) => {
  adjusting.value = false
  openPopover.value = null
  if (session.value) shownMode = next // nothing loads (the model is the same): the camera is reset by `useCameraPreference`
  returning = next === 'display'
})

const lobby = useLobbyDirector({
  session,
  playback,
  mode,
  container,
  // A press that closes a popover, unpins the menu or happens while adjusting the camera is not a tap.
  engaged: () => openPopover.value !== null || (stageMenu.value?.isPinned() ?? false) || adjusting.value,
  adjusting: () => adjusting.value,
  entry: () => {
    const entry = returning ? 'idle' : 'action'
    returning = false
    return entry
  },
})

/** What Display plays and the choice behind it (the Animations popover's data). */
const lobbyPool = lobby.resolution

useViewerKeys({
  toggleMute: voice.toggleMute,
  toggleSubtitles: voice.toggleSubtitles,
  resetCamera,
  toggleFocus: () => { focus.value = !focus.value },
  togglePlayer: () => { playerHidden.value = !playerHidden.value },
  tap: () => {
    if (!adjusting.value) lobby.tap()
  },
  escape: () => {
    if (adjusting.value) {
      cancelAdjust()
      return true
    }
    if (openPopover.value) {
      const trigger = popoverTrigger
      openPopover.value = null
      trigger?.focus()
      return true
    }
    if (stageMenu.value?.isOpen()) {
      stageMenu.value.close()
      return true
    }
    return false
  },
}, mode)
</script>

<template>
  <!--
    One-mode layout: header (in App.vue, v-if="!focus"), then this section fills the rest.
    Stage is flex-1 min-h-[22rem] — fills free height, minimum 22 rem.
    Skin area uses v-show so scroll position and selected tile survive Focus.
  -->
  <main class="flex flex-1 flex-col">
    <!-- Stage: fills remaining height, edge-to-edge, no card radius -->
    <div class="relative min-h-[22rem] flex-1">
      <StageCard :background="settings.backgroundMode.value" :solid="settings.solidColor.value">
        <ModelViewer ref="viewerEl" :status="status" :progress="progress" :error="error" @retry="retry" />
      </StageCard>

      <!-- Stage menu: top-right corner. Same show/hide rules in both modes; each mode passes its own buttons and popovers. -->
      <StageMenu v-if="mode === 'playground'" ref="stageMenu" :popover-open="menuPopoverOpen" @dismiss="closePopovers">
        <IconButton
          size="sm"
          icon="puzzle"
          label="Parts"
          :pressed="openPopover === 'parts'"
          :disabled="disabled || parts.meshes.value.length < 2"
          data-popover-trigger
          aria-haspopup="dialog"
          :aria-expanded="openPopover === 'parts'"
          @click="togglePopover('parts', $event)"
        />
        <IconButton
          size="sm"
          icon="sun"
          label="Lighting"
          :pressed="openPopover === 'lighting'"
          :disabled="disabled"
          data-popover-trigger
          aria-haspopup="dialog"
          :aria-expanded="openPopover === 'lighting'"
          @click="togglePopover('lighting', $event)"
        />
        <IconButton
          size="sm"
          icon="settings"
          label="Settings"
          :pressed="openPopover === 'settings'"
          :disabled="disabled"
          data-popover-trigger
          aria-haspopup="dialog"
          :aria-expanded="openPopover === 'settings'"
          @click="togglePopover('settings', $event)"
        />
        <IconButton size="sm" icon="rotate-ccw" label="Reset camera" title="Reset camera (R)" :disabled="disabled" @click="resetCamera" />
        <IconButton size="sm" icon="camera" label="Take screenshot" :disabled="disabled" @click="takeScreenshot" />
        <IconButton
          size="sm"
          icon="bookmark"
          label="Preferences"
          :pressed="openPopover === 'preferences'"
          data-popover-trigger
          aria-haspopup="dialog"
          :aria-expanded="openPopover === 'preferences'"
          @click="togglePopover('preferences', $event)"
        />
        <IconButton
          size="sm"
          :icon="focus ? 'minimize' : 'maximize'"
          :label="focus ? 'Leave Focus' : 'Enter Focus'"
          :title="focus ? 'Leave Focus (F)' : 'Enter Focus (F)'"
          @click="focus = !focus"
        />
        <template #popover>
          <Popover v-if="openPopover === 'parts'" label="Parts" placement="down" @close="openPopover = null">
            <PartsPopover
              :state-meshes="parts.stateMeshes.value"
              :groups="parts.groups.value"
              :is-shown="parts.isShown"
              :any-changed="parts.anyChanged.value"
              :can-save="parts.canSave.value"
              :has-saved="parts.hasSaved.value"
              :save-error="parts.saveError.value"
              @toggle="parts.toggle"
              @toggle-group="parts.toggleGroup"
              @reset="parts.reset"
              @save="parts.save"
              @forget-saved="parts.forgetSaved"
            />
          </Popover>
          <Popover v-else-if="openPopover === 'lighting'" label="Lighting" placement="down" @close="openPopover = null">
            <LightingPopover
              v-model:intensity="settings.intensity.value"
              v-model:azimuth="settings.azimuthDeg.value"
              :is-default="settings.lightingIsDefault.value"
              @reset="settings.resetLighting"
            />
          </Popover>
          <Popover v-else-if="openPopover === 'settings'" label="Settings" placement="down" @close="openPopover = null">
            <SettingsPopover
              v-model:mode="settings.backgroundMode.value"
              v-model:color="settings.solidColor.value"
              v-model:grid="settings.grid.value"
              v-model:auto-rotate="settings.autoRotate.value"
              v-model:follow="settings.follow.value"
              v-model:wireframe="settings.wireframe.value"
              v-model:toon="settings.toon.value"
              v-model:subtitles="voice.subtitles.value"
            />
          </Popover>
          <Popover v-else-if="openPopover === 'preferences'" label="Preferences" placement="down" @close="openPopover = null">
            <PreferencesPopover
              :disabled="disabled"
              :has-camera="camera.hasSaved.value"
              :has-display-camera="camera.hasSavedDisplay.value"
              :skin-count="savedSkinCount"
              :save-error="preferences.saveError.value"
              :import-error="files.importError.value"
              @save-camera="camera.saveCurrentView"
              @built-in-camera="camera.useBuiltInDefault"
              @built-in-display-camera="camera.useBuiltInDisplay"
              @export="files.exportFile"
              @import="files.importFile"
              @forget-all="preferences.forgetAll"
            />
          </Popover>
        </template>
      </StageMenu>

      <StageMenu v-else ref="stageMenu" :popover-open="menuPopoverOpen" @dismiss="closePopovers">
        <IconButton
          size="sm"
          icon="user-round"
          label="Model"
          title="Display model"
          :pressed="openPopover === 'model'"
          data-popover-trigger
          aria-haspopup="dialog"
          :aria-expanded="openPopover === 'model'"
          @click="togglePopover('model', $event)"
        />
        <IconButton
          size="sm"
          icon="list-checks"
          label="Animations"
          title="Display animations"
          :pressed="openPopover === 'animations'"
          :disabled="!lobbyPool"
          data-popover-trigger
          aria-haspopup="dialog"
          :aria-expanded="openPopover === 'animations'"
          @click="togglePopover('animations', $event)"
        />
        <IconButton size="sm" icon="frame" label="Adjust camera" title="Adjust camera" :pressed="adjusting" :disabled="disabled" @click="startAdjust" />
        <IconButton
          size="sm"
          :icon="voice.muted.value ? 'volume-x' : 'volume-2'"
          :label="voice.muted.value ? 'Unmute voice' : 'Mute voice'"
          :title="voice.muted.value ? 'Unmute voice (M)' : 'Mute voice (M)'"
          :pressed="voice.muted.value"
          @click="voice.toggleMute"
        />
        <IconButton size="sm" icon="layout-dashboard" label="Playground" title="Playground" @click="emit('switchMode', 'playground')" />
        <template #popover>
          <Popover v-if="openPopover === 'model'" label="Display model" placement="down" @close="openPopover = null">
            <DisplayModelPopover
              :frames="displayFrames"
              :frame="displayConstruct"
              :skin="displayModel.skin"
              :loading="status === 'loading' ? skin : null"
              @choose-frame="emit('chooseDisplayFrame', $event)"
              @choose-skin="emit('chooseDisplaySkin', $event)"
            />
          </Popover>
          <Popover v-else-if="openPopover === 'animations' && lobbyPool" label="Display animations" placement="down" @close="openPopover = null">
            <DisplayAnimationsPopover
              :frames="displayFrames"
              :display-frame="lobbyPool.frame"
              :candidates="lobbyPool.pool.candidates"
              :chosen="lobbyPool.chosen"
              :saved="lobbyPool.saved"
              :save-error="preferences.saveError.value"
              @toggle="lobby.toggle"
              @set-frame="lobby.setFrame"
              @use-default="lobby.useDefault"
            />
          </Popover>
        </template>
      </StageMenu>

      <!-- Bottom group: caption in flow above the player (or handle). The wrapper takes no pointer input, so the canvas keeps the
           gaps and the caption's row; the player card and the handle button take it back. -->
      <div ref="bottomGroup" class="pointer-events-none absolute inset-x-2 bottom-2 z-10 flex flex-col gap-1">
        <!-- Subtitle: flow, above the player; pointer-events handled by SubtitleOverlay itself -->
        <SubtitleOverlay v-if="voice.subtitles.value" :text="playback.subtitle.value" />

        <!-- Display: the bar of the camera adjustment (the player does not exist there) -->
        <AdjustCameraBar
          v-if="mode === 'display' && adjusting"
          :save-error="preferences.saveError.value"
          @save="saveAdjust"
          @use-built-in="builtInAdjust"
          @cancel="cancelAdjust"
        />

        <!-- Player (shown) -->
        <Player
          v-else-if="mode === 'playground' && !playerHidden"
          v-model:loop="loop"
          :context="playback.context.value"
          :groups="groups"
          :selected="playback.selected.value"
          :pending="playback.pending.value"
          :voiced="playback.voiced.value"
          :error="playback.error.value"
          :playing="playback.playing.value"
          :time="playback.time.value"
          :duration="playback.duration.value"
          :disabled="disabled"
          :controls-disabled="controlsDisabled"
          :playback-open="openPopover === 'playback'"
          :no-clips="noClips"
          @update:context="playback.setContext"
          @select="playback.select"
          @toggle-play="playback.togglePlay"
          @seek-start="playback.seekStart"
          @seek="playback.seek"
          @seek-end="playback.seekEnd"
          @toggle-playback-options="togglePopover('playback', $event)"
          @hide="playerHidden = true"
        >
          <template #popover>
            <Popover v-if="openPopover === 'playback'" label="Playback options" placement="up" @close="openPopover = null">
              <PlaybackPopover v-model:speed="settings.speed.value" v-model:volume="voice.volume.value" v-model:muted="voice.muted.value" />
            </Popover>
          </template>
        </Player>

        <!-- Player handle (hidden state): a small chevron-up button at centre -->
        <div v-else-if="mode === 'playground'" class="flex justify-center">
          <button
            ref="playerHandle"
            type="button"
            class="pointer-events-auto flex size-8 items-center justify-center rounded-button bg-surface/80 text-text shadow-md backdrop-blur-sm"
            aria-label="Show player (H)"
            title="Show player (H)"
            @click="playerHidden = false"
          >
            <Icon name="chevron-up" class="size-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Skin area: hidden while Focus is on; v-show preserves scroll position and selected tile -->
    <div v-if="mode === 'playground'" v-show="!focus" class="px-4 pb-4 pt-2">
      <SkinTitle :name="shownSkin.name" :is-default="shownSkin.id === construct.defaultSkin" />
      <SkinStrip
        ref="skinStripEl"
        :construct-id="construct.id"
        :skins="construct.skins"
        :selected="skin"
        :loading="status === 'loading' ? skin : null"
        @select="emit('selectSkin', $event)"
      />
    </div>
  </main>
</template>
